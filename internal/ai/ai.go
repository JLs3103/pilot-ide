package ai

import (
	"fmt"
	"os"
	"strings"

	"pilot-ide/internal/agent"
)

const (
	ModeLocal = "local"
	ModeCloud = "cloud"

	DefaultLocalModel = "qwen2.5-coder:7b"
	DefaultCloudModel = "gemini-3.6-flash"
	DefaultOllamaURL  = "http://localhost:11434"
)

type Message struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type Reply struct {
	Text    string         `json:"text"`
	Mode    string         `json:"mode"`
	Model   string         `json:"model"`
	Actions []agent.Action `json:"actions,omitempty"`
}

type Status struct {
	Mode           string `json:"mode"`
	LocalModel     string `json:"localModel"`
	CloudModel     string `json:"cloudModel"`
	HasGeminiKey   bool   `json:"hasGeminiKey"`
	OllamaURL      string `json:"ollamaURL"`
	OllamaUp       bool   `json:"ollamaUp"`
	OllamaAutoStart bool  `json:"ollamaAutoStart"`
}

func NormalizeMode(mode string) string {
	switch strings.ToLower(strings.TrimSpace(mode)) {
	case ModeCloud, "gemini":
		return ModeCloud
	default:
		return ModeLocal
	}
}

func OllamaBaseURL() string {
	if host := strings.TrimSpace(os.Getenv("OLLAMA_HOST")); host != "" {
		if strings.HasPrefix(host, "http://") || strings.HasPrefix(host, "https://") {
			return strings.TrimRight(host, "/")
		}
		return "http://" + strings.TrimRight(host, "/")
	}
	return DefaultOllamaURL
}

func SystemPrompt(projectRoot, tree string) string {
	var b strings.Builder
	b.WriteString("You are the coding agent inside Pilot IDE, a local desktop editor.\n")
	b.WriteString("Answer in the user's language. Be concise and practical.\n")
	b.WriteString("You can inspect and change the opened project using these tools:\n")
	b.WriteString("  - list_dir: List files and folders\n")
	b.WriteString("  - read_file: Read a file\n")
	b.WriteString("  - write_file: Create or overwrite a file (use for new files or full rewrites)\n")
	b.WriteString("  - edit_file: Partially edit a file by replacing specific text (preferred for small changes)\n")
	b.WriteString("  - delete_file: Delete a single file\n")
	b.WriteString("  - rename_file: Rename or move a file/folder\n")
	b.WriteString("  - create_dir: Create an empty directory\n")
	b.WriteString("  - search_files: Search text/regex across all project files\n")
	b.WriteString("  - get_file_info: Get file metadata (size, modified time)\n")
	b.WriteString("  - map_project_tree: Get project folder tree\n")
	b.WriteString("  - run_command: Run a shell command (destructive commands are blocked)\n")
	b.WriteString("\nPrefer edit_file over write_file when changing only part of a file.\n")
	b.WriteString("Use search_files to find code across the project instead of reading files one by one.\n")
	b.WriteString("Prefer tools over guessing file contents. Stay inside the project folder. Do not invent files that are not listed.\n")
	b.WriteString("delete_file only removes a single file, never a directory. run_command is blocked if the command looks destructive.\n")
	b.WriteString("CRITICAL: When the user asks to delete, create, edit, or rename a file or folder (e.g. 'hapus file X', 'delete X', 'buat file X'), you MUST invoke the appropriate tool (delete_file, write_file, edit_file, rename_file). You are strictly FORBIDDEN from stating in text that a file was deleted, created, or changed without calling the tool first.\n")
	b.WriteString("CONVERSATIONAL VS FILE MODIFICATION RULE:\n")
	b.WriteString("- If the user asks an explanation, guide, tutorial, list, summary, or code example (e.g. 'tuliskan panduan...', 'jelaskan...', 'buatkan contoh kode...', 'bagaimana cara...'), you MUST answer directly in the chat message using Markdown. DO NOT call write_file or edit_file!\n")
	b.WriteString("- NEVER overwrite or modify existing project files unless the user explicitly named the specific file path to change in their prompt.\n")
	b.WriteString("- Only invoke write_file if the user explicitly asks to save/create a specific file (e.g. 'buat file halo.txt' or 'simpan ke panduan.md').\n")
	if projectRoot != "" {
		b.WriteString("\nProject root: ")
		b.WriteString(projectRoot)
		b.WriteByte('\n')
	}
	if tree != "" {
		b.WriteString("\nProject tree:\n")
		b.WriteString(tree)
		b.WriteByte('\n')
	} else {
		b.WriteString("\nNo project folder is open.\n")
	}
	return b.String()
}

func emptyReply(mode, model string) error {
	return fmt.Errorf("%s (%s) returned an empty response", mode, model)
}
