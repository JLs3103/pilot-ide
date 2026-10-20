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
	b.WriteString("  - get_file_info: Get file metadata (size, last modified time)\n")
	b.WriteString("  - map_project_tree: Get project folder tree\n")
	b.WriteString("  - run_command: Run a shell command (destructive commands are blocked)\n")
	b.WriteString("\nFor file modifications, use edit_file for partial replacements or write_file for writing updated content.\n")
	b.WriteString("IMPORTANT for edit_file: The old_text MUST be copied EXACTLY from the file content. When adding/inserting lines at the top of a file, use the first line of the file as old_text (e.g. old_text: 'Baris Satu'), and in new_text write the comment followed by newline and the first line (e.g. new_text: '// edited by pilot agent\\nBaris Satu'). Alternatively, you can use write_file to write the full updated content directly.\n")
	b.WriteString("Use search_files to find code across the project instead of reading files one by one.\n")
	b.WriteString("Prefer tools over guessing file contents. Stay inside the project folder. Do not invent files that are not listed.\n")
	b.WriteString("delete_file only removes a single file, never a directory. run_command is blocked if the command looks destructive.\n")

	b.WriteString("\nCRITICAL RULES:\n")
	b.WriteString("1. When the user asks to edit, modify, replace, change, delete, create, or rename a file or text inside a file (e.g. 'ganti kata X menjadi Y', 'ubah teks', 'tambahkan komentar', 'hapus file', 'buat file'), you MUST invoke the appropriate tool (edit_file, write_file, delete_file, rename_file). NEVER claim an action was done in your message without calling the tool first.\n")
	b.WriteString("2. For multi-step file updates (e.g. 'Baca file X, lalu tambahkan/ubah Y, lalu periksa'), you MUST invoke read_file first to see the current content, then invoke edit_file (with first line as old_text) or write_file to update the file on disk, and then verify the result. NEVER claim an action was done without invoking the tools.\n")
	b.WriteString("3. When the user asks you to 'jalankan', 'run', or 'execute' a command (e.g. 'jalankan go version', 'run npm install'), ALWAYS use run_command. Do NOT interpret it as a file operation.\n")
	b.WriteString("4. NEVER fabricate or hallucinate tool output. Only report what the tool actually returned. If a tool returns data, show that data accurately.\n")
	b.WriteString("5. ALWAYS answer the user's question. NEVER say 'I cannot assist' or refuse. If the user asks about files, code, structure, functions, or anything related to the project, use tools to get the information and then summarize and answer directly.\n")

	b.WriteString("\nRESPONSE FORMAT RULE:\n")
	b.WriteString("- ALWAYS answer in the exact same language as the user's prompt (e.g. if the user asks in Indonesian, you MUST answer in Indonesian: 'Berikut adalah fungsi-fungsi utama di backend Go...'). NEVER answer in English when the user writes in Indonesian!\n")
	b.WriteString("- When the user asks to find, list, or explain functions or code across the project (e.g. 'cari fungsi utama di file-file backend Go dan sebutkan apa saja fungsinya'):\n")
	b.WriteString("  * Use search_files to find functions across the backend.\n")
	b.WriteString("  * Present the main functions found across different files (e.g. app.go, agent/exec.go, ai/loop.go, fsutil/search.go) as a structured Markdown bulleted list.\n")
	b.WriteString("  * For each main function, state its name, file location, and a concise explanation in Indonesian of what it does.\n")
	b.WriteString("  * Do NOT just read or describe a single file in English. Give a comprehensive overview across the backend.\n")
	b.WriteString("- NEVER wrap your text response inside a JSON object like {\"response\": \"...\"} or inside JSON code blocks.\n")
	b.WriteString("\nCONTEXT & ANALYSIS RULE:\n")
	b.WriteString("- When the user asks a question about the project (e.g. 'ada berapa baris?', 'apa bahasa pemrograman?', 'apa isi file ini?', 'cari fungsi X'), use the appropriate tool(s) to get the data, then provide a clear answer based on the actual tool results.\n")
	b.WriteString("- For line counting: read the file with read_file, count the lines, and report the number.\n")
	b.WriteString("- For searching: use search_files, then summarize the actual results in clear Markdown paragraphs or lists in the user's language.\n")

	b.WriteString("\nCONVERSATIONAL VS FILE MODIFICATION RULE:\n")
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
