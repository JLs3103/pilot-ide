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
		return fsutil.ReadFile(root, argString(args, "path"))
	case "write_file":
		path := argString(args, "path")
		if path == "" {
			return "", fmt.Errorf("path is required")
		}
		if err := fsutil.WriteFile(root, path, argString(args, "content")); err != nil {
			return "", err
		}
		return "wrote " + path, nil
	case "edit_file":
		path := argString(args, "path")
		oldText := argString(args, "old_text")
		newText := argString(args, "new_text")
		if path == "" {
			return "", fmt.Errorf("path is required")
		}
		if oldText == "" {
			return "", fmt.Errorf("old_text is required")
		}
		count, err := fsutil.EditFile(root, path, oldText, newText)
		if err != nil {
			return "", err
		}
		return fmt.Sprintf("edited %s (%d replacement(s))", path, count), nil
	case "delete_file":
		path := argString(args, "path")
		if path == "" {
			return "", fmt.Errorf("path is required")
		}
		if err := fsutil.DeleteFile(root, path); err != nil {
			return "", err
		}
		return "deleted " + path, nil
	case "rename_file":
		oldPath := argString(args, "old_path")
		newPath := argString(args, "new_path")
		if oldPath == "" || newPath == "" {
			return "", fmt.Errorf("old_path and new_path are required")
		}
		if err := fsutil.RenameOrMove(root, oldPath, newPath); err != nil {
			return "", err
		}
		return fmt.Sprintf("renamed %s → %s", oldPath, newPath), nil
	case "create_dir":
		path := argString(args, "path")
		if path == "" {
			return "", fmt.Errorf("path is required")
		}
		if err := fsutil.CreateDir(root, path); err != nil {
			return "", err
		}
		return "created directory " + path, nil
	case "search_files":
		query := argString(args, "query")
		if query == "" {
			return "", fmt.Errorf("query is required")
		}
		isRegex := argBool(args, "is_regex")
		caseSensitive := argBool(args, "case_sensitive")
		include := argString(args, "include")
		result, err := fsutil.SearchFiles(root, query, isRegex, caseSensitive, include)
		if err != nil {
			return "", err
		}
		raw, err := json.Marshal(result)
		return string(raw), err
	case "get_file_info":
		path := argString(args, "path")
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
