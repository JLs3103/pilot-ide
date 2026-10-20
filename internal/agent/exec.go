package agent

import (
	"encoding/json"
	"fmt"
	"strings"

	"pilot-ide/internal/fsutil"
	"pilot-ide/internal/terminal"
)

const maxToolOutput = 24 << 10

type Action struct {
	Name   string `json:"name"`
	Detail string `json:"detail"`
	OK     bool   `json:"ok"`
	Error  string `json:"error,omitempty"`
}

func Execute(root, name string, args map[string]any) (string, Action) {
	action := Action{Name: name, Detail: summarize(name, args)}
	if strings.TrimSpace(root) == "" {
		action.Error = "open a project folder first"
		return action.Error, action
	}

	out, err := run(root, name, args)
	if err != nil {
		action.Error = err.Error()
		return err.Error(), action
	}
	action.OK = true
	return truncate(out, maxToolOutput), action
}

func run(root, name string, args map[string]any) (string, error) {
	switch name {
	case "list_dir":
		entries, err := fsutil.ListDir(root, argString(args, "path"))
		if err != nil {
			return "", err
		}
		type row struct {
			Name  string `json:"name"`
			IsDir bool   `json:"isDir"`
		}
		rows := make([]row, 0, len(entries))
		for _, e := range entries {
			rows = append(rows, row{Name: e.Name, IsDir: e.IsDir})
		}
		raw, err := json.Marshal(rows)
		return string(raw), err
	case "read_file":
		return fsutil.ReadFile(root, argFirstString(args, "path", "file_path", "filePath", "file"))
	case "write_file":
		path := argFirstString(args, "path", "file_path", "filePath", "file")
		if path == "" {
			return "", fmt.Errorf("path is required")
		}
		content := argFirstString(args, "content", "text")
		if err := fsutil.WriteFile(root, path, content); err != nil {
			return "", err
		}
		return "wrote " + path, nil
	case "edit_file":
		path := argFirstString(args, "path", "file_path", "filePath", "file")
		oldText := argFirstString(args, "old_text", "oldText", "old", "target", "search", "find", "original", "target_text", "search_text", "old_content", "from", "before", "match")
		if oldText == "" {
			if l := argString(args, "line"); l != "" {
				oldText = "line " + l
			} else if pos := argString(args, "position"); pos != "" {
				oldText = pos
			}
		}
		newText := argFirstString(args, "new_text", "newText", "new", "content", "text", "replacement", "replace", "new_content", "to", "after", "insert")
		if path == "" {
			return "", fmt.Errorf("path is required")
		}
		if oldText == "" {
			return "", fmt.Errorf("old_text is required")
		}
		if newText == "" {
			return "", fmt.Errorf("new_text is required")
		}
		count, err := fsutil.EditFile(root, path, oldText, newText)
		if err != nil {
			return "", err
		}
		return fmt.Sprintf("edited %s (%d replacement(s))", path, count), nil
	case "delete_file":
		path := argFirstString(args, "path", "file_path", "filePath", "file")
		if path == "" {
			return "", fmt.Errorf("path is required")
		}
		if err := fsutil.DeleteFile(root, path); err != nil {
			return "", err
		}
		return "deleted " + path, nil
	case "rename_file":
		oldPath := argFirstString(args, "old_path", "oldPath", "old", "from", "source", "src")
		newPath := argFirstString(args, "new_path", "newPath", "new", "to", "dest", "destination")
		if oldPath == "" || newPath == "" {
			return "", fmt.Errorf("old_path and new_path are required")
		}
		if err := fsutil.RenameOrMove(root, oldPath, newPath); err != nil {
			return "", err
		}
		return fmt.Sprintf("renamed %s → %s", oldPath, newPath), nil
	case "create_dir":
		path := argFirstString(args, "path", "dir", "dir_path", "dirPath", "directory")
		if path == "" {
			return "", fmt.Errorf("path is required")
		}
		if err := fsutil.CreateDir(root, path); err != nil {
			return "", err
		}
		return "created directory " + path, nil
	case "search_files":
		query := argFirstString(args, "query", "search", "q", "pattern")
		if query == "" {
			return "", fmt.Errorf("query is required")
		}
		isRegex := argBool(args, "is_regex") || argBool(args, "isRegex")
		caseSensitive := argBool(args, "case_sensitive") || argBool(args, "caseSensitive")
		include := argFirstString(args, "include", "pattern", "glob")
		result, err := fsutil.SearchFiles(root, query, isRegex, caseSensitive, include)
		if err != nil {
			return "", err
		}
		if len(result.Matches) == 0 {
			return fmt.Sprintf("No matches found for query: %s", query), nil
		}
		var b strings.Builder
		fmt.Fprintf(&b, "Found %d match(es) for %q:\n", len(result.Matches), query)
		for _, m := range result.Matches {
			fmt.Fprintf(&b, "- %s:%d: %s\n", m.File, m.Line, strings.TrimSpace(m.Text))
		}
		return b.String(), nil
	case "get_file_info":
		path := argFirstString(args, "path", "file_path", "filePath", "file")
		if path == "" {
			return "", fmt.Errorf("path is required")
		}
		info, err := fsutil.GetFileInfo(root, path)
		if err != nil {
			return "", err
		}
		raw, err := json.Marshal(info)
		return string(raw), err
	case "map_project_tree":
		depth := argInt(args, "maxDepth", 5)
		if depth > 8 {
			depth = 8
		}
		tree, err := fsutil.MapTree(root, depth)
		if err != nil {
			return "", err
		}
		return fsutil.FormatTree(tree), nil
	case "run_command":
		cmd := argString(args, "command")
		if err := RejectDangerousCommand(cmd); err != nil {
			return "", err
		}
		result, err := terminal.Run(root, cmd)
		if err != nil {
			return "", err
		}
		raw, err := json.Marshal(result)
		return string(raw), err
	default:
		return "", fmt.Errorf("unknown tool %s", name)
	}
}

func summarize(name string, args map[string]any) string {
	switch name {
	case "list_dir", "read_file", "write_file", "delete_file", "create_dir", "get_file_info":
		path := argString(args, "path")
		if path == "" {
			path = "."
		}
		return path
	case "edit_file":
		return argString(args, "path")
	case "rename_file":
		return fmt.Sprintf("%s → %s", argString(args, "old_path"), argString(args, "new_path"))
	case "search_files":
		return argString(args, "query")
	case "run_command":
		return argString(args, "command")
	case "map_project_tree":
		return fmt.Sprintf("depth %d", argInt(args, "maxDepth", 5))
	default:
		return name
	}
}

func argString(args map[string]any, key string) string {
	if args == nil {
		return ""
	}
	v, ok := args[key]
	if !ok || v == nil {
		return ""
	}
	switch t := v.(type) {
	case string:
		return t
	default:
		return fmt.Sprint(t)
	}
}

func argFirstString(args map[string]any, keys ...string) string {
	if args == nil {
		return ""
	}
	for _, key := range keys {
		if v, ok := args[key]; ok && v != nil {
			switch t := v.(type) {
			case string:
				if strings.TrimSpace(t) != "" {
					return t
				}
			default:
				s := strings.TrimSpace(fmt.Sprint(t))
				if s != "" && s != "<nil>" {
					return s
				}
			}
		}
	}
	return ""
}

func argInt(args map[string]any, key string, fallback int) int {
	if args == nil {
		return fallback
	}
	v, ok := args[key]
	if !ok || v == nil {
		return fallback
	}
	switch t := v.(type) {
	case int:
		return t
	case int32:
		return int(t)
	case int64:
		return int(t)
	case float64:
		return int(t)
	case json.Number:
		n, err := t.Int64()
		if err != nil {
			return fallback
		}
		return int(n)
	default:
		return fallback
	}
}

func argBool(args map[string]any, key string) bool {
	if args == nil {
		return false
	}
	v, ok := args[key]
	if !ok || v == nil {
		return false
	}
	switch t := v.(type) {
	case bool:
		return t
	case string:
		return t == "true" || t == "1"
	case float64:
		return t != 0
	default:
		return false
	}
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n] + "\n…(truncated)"
}
