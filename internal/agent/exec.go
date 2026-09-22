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
	case "delete_file":
		path := argString(args, "path")
		if path == "" {
			return "", fmt.Errorf("path is required")
		}
		if err := fsutil.DeleteFile(root, path); err != nil {
			return "", err
		}
		return "deleted " + path, nil
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
	case "list_dir", "read_file", "write_file", "delete_file":
		path := argString(args, "path")
		if path == "" {
			path = "."
		}
		return path
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

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n] + "\n…(truncated)"
}
