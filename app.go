package main

import (
	"context"
	"fmt"
	"strings"
	"sync"

	"pilot-ide/internal/ai"
	"pilot-ide/internal/fsutil"
	"pilot-ide/internal/terminal"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

const maxChatHistory = 16

type App struct {
	ctx         context.Context
	projectRoot string

	mu          sync.Mutex
	mode        string
	geminiKey   string
	chatHistory []ai.Message
}

func NewApp() *App {
	return &App{mode: ai.ModeLocal}
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
}

func (a *App) OpenProject() (string, error) {
	dir, err := runtime.OpenDirectoryDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "Open Project Folder",
	})
	if err != nil {
		return "", err
	}
	if dir == "" {
		return a.projectRoot, nil
	}
	a.projectRoot = dir
	runtime.WindowSetTitle(a.ctx, "Pilot IDE — "+dir)
	return dir, nil
}

func (a *App) GetProjectRoot() string {
	return a.projectRoot
}

func (a *App) ListDir(path string) ([]fsutil.DirEntry, error) {
	return fsutil.ListDir(a.projectRoot, path)
}

func (a *App) ReadFile(path string) (string, error) {
	return fsutil.ReadFile(a.projectRoot, path)
}

func (a *App) WriteFile(path, content string) error {
	return fsutil.WriteFile(a.projectRoot, path, content)
}

func (a *App) MapProjectTree(maxDepth int) (fsutil.TreeNode, error) {
	return fsutil.MapTree(a.projectRoot, maxDepth)
}

func (a *App) RunCommand(command, cwd string) (terminal.Result, error) {
	if command == "" {
		return terminal.Result{}, fmt.Errorf("command is empty")
	}
	dir := cwd
	if dir == "" {
		dir = a.projectRoot
	} else {
		resolved, err := fsutil.Resolve(a.projectRoot, dir)
		if err != nil {
			return terminal.Result{}, err
		}
		dir = resolved
	}
	return terminal.Run(dir, command)
}

func (a *App) GetAIStatus() ai.Status {
	a.mu.Lock()
	mode := a.mode
	hasKey := a.geminiKey != ""
	a.mu.Unlock()

	url := ai.OllamaBaseURL()
	return ai.Status{
		Mode:         mode,
		LocalModel:   ai.DefaultLocalModel,
		CloudModel:   ai.DefaultCloudModel,
		HasGeminiKey: hasKey,
		OllamaURL:    url,
		OllamaUp:     ai.PingOllama(context.Background(), url),
	}
}

func (a *App) SetAIMode(mode string) string {
	normalized := ai.NormalizeMode(mode)
	a.mu.Lock()
	a.mode = normalized
	a.mu.Unlock()
	return normalized
}

func (a *App) SetGeminiAPIKey(key string) {
	a.mu.Lock()
	defer a.mu.Unlock()
	a.geminiKey = strings.TrimSpace(key)
}

func (a *App) ClearChat() {
	a.mu.Lock()
	defer a.mu.Unlock()
	a.chatHistory = nil
}

func (a *App) Chat(message string) (ai.Reply, error) {
	text := strings.TrimSpace(message)
	if text == "" {
		return ai.Reply{}, fmt.Errorf("message is empty")
	}

	a.mu.Lock()
	mode := a.mode
	key := a.geminiKey
	history := append([]ai.Message(nil), a.chatHistory...)
	root := a.projectRoot
	a.mu.Unlock()

	treeText := ""
	if root != "" {
		if tree, err := fsutil.MapTree(root, 5); err == nil {
			treeText = fsutil.FormatTree(tree)
		}
	}
	system := ai.SystemPrompt(root, treeText)
	ctx := a.ctx
	if ctx == nil {
		ctx = context.Background()
	}

	var (
		reply string
		err   error
		model string
	)
	switch mode {
	case ai.ModeCloud:
		model = ai.DefaultCloudModel
		reply, err = ai.ChatGemini(ctx, key, model, system, history, text)
	default:
		mode = ai.ModeLocal
		model = ai.DefaultLocalModel
		reply, err = ai.ChatOllama(ctx, ai.OllamaBaseURL(), model, system, history, text)
	}
	if err != nil {
		return ai.Reply{Mode: mode, Model: model}, err
	}

	a.mu.Lock()
	a.chatHistory = append(a.chatHistory, ai.Message{Role: "user", Content: text}, ai.Message{Role: "assistant", Content: reply})
	if len(a.chatHistory) > maxChatHistory {
		a.chatHistory = a.chatHistory[len(a.chatHistory)-maxChatHistory:]
	}
	a.mu.Unlock()

	return ai.Reply{Text: reply, Mode: mode, Model: model}, nil
}
