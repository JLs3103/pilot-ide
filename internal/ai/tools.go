package ai

func toolDeclarations() []map[string]any {
	return []map[string]any{
		fn("list_dir", "List files and folders in a project-relative path. Empty path lists the project root.", map[string]any{
			"path": map[string]any{"type": "string", "description": "Relative path inside the project. Use empty string for the root."},
		}, nil),
		fn("read_file", "Read a text file inside the project.", map[string]any{
			"path": map[string]any{"type": "string", "description": "Relative or absolute path inside the project."},
		}, []string{"path"}),
		fn("write_file", "Create or overwrite a text file inside the project. Parent folders are created as needed.", map[string]any{
			"path":    map[string]any{"type": "string", "description": "Path inside the project."},
			"content": map[string]any{"type": "string", "description": "Full file contents to write."},
		}, []string{"path", "content"}),
		fn("delete_file", "Delete a single file inside the project. Directories are not allowed.", map[string]any{
			"path": map[string]any{"type": "string", "description": "Path of the file to delete."},
		}, []string{"path"}),
		fn("map_project_tree", "Return a names-only folder tree of the project. Heavy folders such as node_modules are skipped.", map[string]any{
			"maxDepth": map[string]any{"type": "integer", "description": "Maximum depth (1-8). Default 5."},
		}, nil),
		fn("run_command", "Run a shell command in the project root (cmd on Windows, sh elsewhere). Destructive commands are blocked.", map[string]any{
			"command": map[string]any{"type": "string", "description": "Command line to execute."},
		}, []string{"command"}),
	}
}

func fn(name, description string, properties map[string]any, required []string) map[string]any {
	schema := map[string]any{
		"type":       "object",
		"properties": properties,
	}
	if len(required) > 0 {
		schema["required"] = required
	}
	return map[string]any{
		"name":        name,
		"description": description,
		"parameters":  schema,
	}
}

func ollamaTools() []map[string]any {
	decls := toolDeclarations()
	out := make([]map[string]any, 0, len(decls))
	for _, d := range decls {
		out = append(out, map[string]any{
			"type":     "function",
			"function": d,
		})
	}
	return out
}

func geminiTools() []map[string]any {
	return []map[string]any{
		{"functionDeclarations": toolDeclarations()},
	}
}
