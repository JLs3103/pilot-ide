package ai

import (
	"fmt"
	"os"
	"strings"
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
	Text  string `json:"text"`
	Mode  string `json:"mode"`
	Model string `json:"model"`
}

type Status struct {
	Mode         string `json:"mode"`
	LocalModel   string `json:"localModel"`
	CloudModel   string `json:"cloudModel"`
	HasGeminiKey bool   `json:"hasGeminiKey"`
	OllamaURL    string `json:"ollamaURL"`
	OllamaUp     bool   `json:"ollamaUp"`
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
	b.WriteString("You can see the project tree (names only, not file contents). Do not invent files that are not listed.\n")
	b.WriteString("Function calling / applying edits is not enabled yet; describe the change clearly so the user can apply it.\n")
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
