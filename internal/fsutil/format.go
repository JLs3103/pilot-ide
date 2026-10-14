package fsutil

import (
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

type FormatResult struct {
	Formatted string `json:"formatted"`
	Error     string `json:"error,omitempty"`
}

func FormatDocument(filePath, content string) FormatResult {
	ext := strings.ToLower(filepath.Ext(filePath))

	switch ext {
	case ".go":
		return formatWithCommand(content, "gofmt")
	case ".py":
		return formatWithPython(content)
	case ".js", ".jsx", ".ts", ".tsx", ".css", ".scss", ".less", ".html", ".json", ".md", ".yaml", ".yml":
		return formatWithPrettier(filePath, content)
	case ".rs":
		return formatWithCommand(content, "rustfmt")
	default:
		return FormatResult{Formatted: content}
	}
}

func formatWithCommand(content, command string) FormatResult {
	path, err := exec.LookPath(command)
	if err != nil {
		return FormatResult{Formatted: content, Error: fmt.Sprintf("%s not found in PATH", command)}
	}
	cmd := exec.Command(path)
	cmd.Stdin = strings.NewReader(content)
	out, err := cmd.Output()
	if err != nil {
		return FormatResult{Formatted: content, Error: fmt.Sprintf("%s error: %v", command, err)}
	}
	return FormatResult{Formatted: string(out)}
}

func formatWithPython(content string) FormatResult {
	if path, err := exec.LookPath("black"); err == nil {
		cmd := exec.Command(path, "-q", "--fast", "-")
		cmd.Stdin = strings.NewReader(content)
		out, err := cmd.Output()
		if err == nil {
			return FormatResult{Formatted: string(out)}
		}
	}
	if path, err := exec.LookPath("autopep8"); err == nil {
		cmd := exec.Command(path, "-")
		cmd.Stdin = strings.NewReader(content)
		out, err := cmd.Output()
		if err == nil {
			return FormatResult{Formatted: string(out)}
		}
	}
	return FormatResult{Formatted: content, Error: "No Python formatter found (install black or autopep8)"}
}

func formatWithPrettier(filePath, content string) FormatResult {
	if path, err := exec.LookPath("prettier"); err == nil {
		cmd := exec.Command(path, "--stdin-filepath", filePath)
		cmd.Stdin = strings.NewReader(content)
		out, err := cmd.Output()
		if err == nil {
			return FormatResult{Formatted: string(out)}
		}
	}
	npx := "npx"
	if _, err := exec.LookPath(npx); err == nil {
		cmd := exec.Command(npx, "prettier", "--stdin-filepath", filePath)
		cmd.Stdin = strings.NewReader(content)
		out, err := cmd.Output()
		if err == nil {
			return FormatResult{Formatted: string(out)}
		}
	}
	return FormatResult{Formatted: content, Error: "Prettier not found (install prettier globally or in project)"}
}

type ProjectSettings struct {
	FormatOnSave  bool              `json:"formatOnSave"`
	TabSize       int               `json:"tabSize,omitempty"`
	Theme         string            `json:"theme,omitempty"`
	FontSize      int               `json:"fontSize,omitempty"`
	LineHeight    float64           `json:"lineHeight,omitempty"`
	WordWrap      string            `json:"wordWrap,omitempty"`
	Minimap       *bool             `json:"minimap,omitempty"`
	Formatters    map[string]string `json:"formatters,omitempty"`
	ExcludeFiles  []string          `json:"excludeFiles,omitempty"`
	Snippets      map[string]any    `json:"snippets,omitempty"`
}

func DefaultProjectSettings() ProjectSettings {
	return ProjectSettings{
		FormatOnSave: false,
		TabSize:      4,
	}
}

func ReadProjectSettings(projectRoot string) (ProjectSettings, error) {
	settings := DefaultProjectSettings()
	if projectRoot == "" {
		return settings, nil
	}
	settingsPath := filepath.Join(projectRoot, ".pilot", "settings.json")
	data, err := os.ReadFile(settingsPath)
	if err != nil {
		if os.IsNotExist(err) {
			return settings, nil
		}
		return settings, err
	}
	if err := json.Unmarshal(data, &settings); err != nil {
		return DefaultProjectSettings(), fmt.Errorf("invalid settings.json: %w", err)
	}
	return settings, nil
}

func WriteProjectSettings(projectRoot string, settings ProjectSettings) error {
	if projectRoot == "" {
		return fmt.Errorf("no project open")
	}
	dir := filepath.Join(projectRoot, ".pilot")
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return err
	}
	data, err := json.MarshalIndent(settings, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(filepath.Join(dir, "settings.json"), data, 0o644)
}

type RecentProject struct {
	Path      string `json:"path"`
	Name      string `json:"name"`
	OpenedAt  int64  `json:"openedAt"`
}

type SnippetDef struct {
	Prefix      string   `json:"prefix"`
	Body        []string `json:"body"`
	Description string   `json:"description"`
	Language    string   `json:"language"`
}

func LoadSnippets(projectRoot string) ([]SnippetDef, error) {
	if projectRoot == "" {
		return nil, nil
	}
	snippetsDir := filepath.Join(projectRoot, ".pilot", "snippets")
	if _, err := os.Stat(snippetsDir); os.IsNotExist(err) {
		return nil, nil
	}

	var result []SnippetDef
	entries, err := os.ReadDir(snippetsDir)
	if err != nil {
		return nil, err
	}

	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".json") {
			continue
		}
		data, err := os.ReadFile(filepath.Join(snippetsDir, entry.Name()))
		if err != nil {
			continue
		}
		var snippets map[string]SnippetDef
		if err := json.Unmarshal(data, &snippets); err != nil {
			continue
		}
		for name, s := range snippets {
			if s.Description == "" {
				s.Description = name
			}
			result = append(result, s)
		}
	}
	return result, nil
}
