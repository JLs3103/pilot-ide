package main

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"pilot-ide/internal/agent"
	"pilot-ide/internal/ai"
	"pilot-ide/internal/fsutil"
	"pilot-ide/internal/store"
	"pilot-ide/internal/terminal"

	"github.com/fsnotify/fsnotify"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

const maxChatHistory = 16

type App struct {
	ctx         context.Context
	projectRoot string
	store       *store.Store

	mu          sync.Mutex
	mode        string
	geminiKey   string
	chatHistory []ai.Message

	terminalMu   sync.Mutex
	terminalCwd  string
	activeCancel context.CancelFunc

	watcherMu   sync.Mutex
	watcher     *fsnotify.Watcher
	watcherDone chan struct{}
}

func NewApp() *App {
	return &App{mode: ai.ModeLocal}
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	path, err := store.DefaultPath()
	if err != nil {
		runtime.LogError(ctx, "store path: "+err.Error())
		return
	}
	db, err := store.Open(path)
	if err != nil {
		runtime.LogError(ctx, "open store: "+err.Error())
		return
	}
	a.store = db
	snap, err := db.Load()
	if err != nil {
		runtime.LogError(ctx, "load store: "+err.Error())
		return
	}
	a.mu.Lock()
	if snap.Mode != "" {
		a.mode = ai.NormalizeMode(snap.Mode)
	}
	a.geminiKey = snap.GeminiKey
	a.chatHistory = snap.Messages
	if len(a.chatHistory) > maxChatHistory {
		a.chatHistory = a.chatHistory[len(a.chatHistory)-maxChatHistory:]
	}
	a.mu.Unlock()
	if snap.ProjectRoot != "" {
		if info, err := os.Stat(snap.ProjectRoot); err == nil && info.IsDir() {
			a.projectRoot = snap.ProjectRoot
			a.terminalMu.Lock()
			a.terminalCwd = snap.ProjectRoot
			a.terminalMu.Unlock()
			runtime.WindowSetTitle(ctx, "Pilot IDE — "+snap.ProjectRoot)
			a.startWatcher(snap.ProjectRoot)
		}
	}
}

func (a *App) shutdown(_ context.Context) {
	a.stopWatcher()
	if a.store != nil {
		_ = a.store.Close()
	}
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
	a.terminalMu.Lock()
	a.terminalCwd = dir
	a.terminalMu.Unlock()
	runtime.WindowSetTitle(a.ctx, "Pilot IDE — "+dir)
	a.persist(a.store.SaveProjectRoot(dir))
	a.startWatcher(dir)
	if a.ctx != nil {
		runtime.EventsEmit(a.ctx, "project:opened", dir)
	}
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
	if err := fsutil.WriteFile(a.projectRoot, path, content); err != nil {
		return err
	}
	a.emitFSChanged()
	return nil
}

func (a *App) SaveFileAs(defaultFilename, content string) (string, error) {
	path, err := runtime.SaveFileDialog(a.ctx, runtime.SaveDialogOptions{
		Title:           "Save File As",
		DefaultFilename: defaultFilename,
	})
	if err != nil {
		return "", err
	}
	if path == "" {
		return "", nil
	}
	if err := os.WriteFile(path, []byte(content), 0644); err != nil {
		return "", err
	}
	a.emitFSChanged()
	return path, nil
}

func (a *App) CreateFile(path string) error {
	if a.projectRoot == "" {
		return fmt.Errorf("no project open")
	}
	abs, err := fsutil.Resolve(a.projectRoot, path)
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(abs), 0o755); err != nil {
		return err
	}
	if _, err := os.Stat(abs); err == nil {
		return fmt.Errorf("file already exists")
	}
	if err := os.WriteFile(abs, []byte{}, 0o644); err != nil {
		return err
	}
	a.emitFSChanged()
	return nil
}

func (a *App) CreateFolder(path string) error {
	if a.projectRoot == "" {
		return fmt.Errorf("no project open")
	}
	abs, err := fsutil.Resolve(a.projectRoot, path)
	if err != nil {
		return err
	}
	if info, statErr := os.Stat(abs); statErr == nil && info.IsDir() {
		return fmt.Errorf("folder already exists")
	}
	if err := os.MkdirAll(abs, 0o755); err != nil {
		return err
	}
	a.emitFSChanged()
	return nil
}

func (a *App) RenameFile(oldPath, newName string) (string, error) {
	if a.projectRoot == "" {
		return "", fmt.Errorf("no project open")
	}
	newPath := filepath.Join(filepath.Dir(oldPath), newName)
	if _, err := os.Stat(newPath); err == nil {
		return "", fmt.Errorf("a file or folder with that name already exists")
	}
	if err := os.Rename(oldPath, newPath); err != nil {
		return "", err
	}
	a.emitFSChanged()
	return newPath, nil
}

func (a *App) DeleteFileOrDir(path string) error {
	if a.projectRoot == "" {
		return fmt.Errorf("no project open")
	}
	abs, err := fsutil.Resolve(a.projectRoot, path)
	if err != nil {
		return err
	}
	info, err := os.Stat(abs)
	if err != nil {
		return err
	}
	if info.IsDir() {
		if err := os.RemoveAll(abs); err != nil {
			return err
		}
	} else {
		if err := os.Remove(abs); err != nil {
			return err
		}
	}
	a.emitFSChanged()
	return nil
}

func (a *App) QuitApp() {
	runtime.Quit(a.ctx)
}

func (a *App) MapProjectTree(maxDepth int) (fsutil.TreeNode, error) {
	return fsutil.MapTree(a.projectRoot, maxDepth)
}

func (a *App) RunCommand(command, cwd string) (terminal.Result, error) {
	if command == "" {
		return terminal.Result{}, fmt.Errorf("command is empty")
	}
	if err := agent.RejectDangerousCommand(command); err != nil {
		return terminal.Result{}, err
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

func (a *App) RunCommandWithShell(command, cwd, shell string) (terminal.Result, error) {
	if command == "" {
		return terminal.Result{}, fmt.Errorf("command is empty")
	}
	if err := agent.RejectDangerousCommand(command); err != nil {
		return terminal.Result{}, err
	}

	a.terminalMu.Lock()
	dir := cwd
	if dir == "" {
		dir = a.terminalCwd
	}
	if dir == "" {
		dir = a.projectRoot
	}
	if dir == "" {
		dir = "."
	}
	if absDir, err := filepath.Abs(dir); err == nil {
		if info, err := os.Stat(absDir); err == nil && info.IsDir() {
			dir = absDir
		}
	}
	a.terminalCwd = dir
	a.terminalMu.Unlock()

	if res, handled := terminal.HandleCd(command, dir, shell); handled {
		if res.ExitCode == 0 && res.Cwd != "" {
			a.terminalMu.Lock()
			a.terminalCwd = res.Cwd
			a.terminalMu.Unlock()
		}
		return res, nil
	}

	ctx, cancel := context.WithCancel(context.Background())
	a.terminalMu.Lock()
	a.activeCancel = cancel
	a.terminalMu.Unlock()

	defer func() {
		a.terminalMu.Lock()
		a.activeCancel = nil
		a.terminalMu.Unlock()
	}()

	res, err := terminal.RunWithContext(ctx, dir, command, shell)
	if res.Cwd == "" {
		res.Cwd = dir
	}
	return res, err
}

func (a *App) KillTerminalCommand() error {
	a.terminalMu.Lock()
	defer a.terminalMu.Unlock()

	if a.activeCancel != nil {
		a.activeCancel()
	}
	return nil
}

func (a *App) OpenExternalTerminal(shell, cwd string) error {
	a.terminalMu.Lock()
	dir := cwd
	if dir == "" {
		dir = a.terminalCwd
	}
	if dir == "" {
		dir = a.projectRoot
	}
	if dir == "" {
		dir = "."
	}
	a.terminalMu.Unlock()

	return terminal.OpenExternal(shell, dir)
}

func (a *App) GetTerminalCwd() string {
	a.terminalMu.Lock()
	defer a.terminalMu.Unlock()

	if a.terminalCwd != "" {
		return a.terminalCwd
	}
	return a.projectRoot
}

func (a *App) GetPathCompletions(dir, pathInput string, dirsOnly bool) ([]string, error) {
	a.terminalMu.Lock()
	if dir == "" {
		dir = a.terminalCwd
	}
	if dir == "" {
		dir = a.projectRoot
	}
	if dir == "" {
		dir = "."
	}
	a.terminalMu.Unlock()

	return terminal.CompletePath(dir, pathInput, dirsOnly)
}

func (a *App) GetAvailableShells() []string {
	return terminal.AvailableShells()
}

func (a *App) GetDefaultShell() string {
	return terminal.DefaultShell()
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
	a.persist(a.store.SaveMode(normalized))
	return normalized
}

func (a *App) SetGeminiAPIKey(key string) {
	trimmed := strings.TrimSpace(key)
	a.mu.Lock()
	a.geminiKey = trimmed
	a.mu.Unlock()
	a.persist(a.store.SaveGeminiKey(trimmed))
}

func (a *App) SavePanelSizes(sizes string) error {
	return a.store.SavePanelSizes(sizes)
}

func (a *App) GetPanelSizes() string {
	if a.store == nil {
		return ""
	}
	snap, err := a.store.Load()
	if err != nil {
		return ""
	}
	return snap.PanelSizes
}

func (a *App) SaveOpenTabs(tabs string) error {
	if a.store == nil {
		return nil
	}
	return a.store.SaveOpenTabs(tabs)
}

func (a *App) GetOpenTabs() string {
	if a.store == nil {
		return ""
	}
	snap, err := a.store.Load()
	if err != nil {
		return ""
	}
	return snap.OpenTabs
}

func (a *App) GetChatHistory() []ai.Message {
	a.mu.Lock()
	defer a.mu.Unlock()
	out := make([]ai.Message, len(a.chatHistory))
	copy(out, a.chatHistory)
	return out
}

func (a *App) ClearChat() {
	a.mu.Lock()
	a.chatHistory = nil
	a.mu.Unlock()
	a.persist(a.store.ClearMessages())
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

	reply, err := ai.Run(ctx, ai.RunRequest{
		Mode:    mode,
		APIKey:  key,
		System:  system,
		History: history,
		User:    text,
		Root:    root,
		OnAction: func(action agent.Action) {
			if a.ctx != nil {
				runtime.EventsEmit(a.ctx, "agent:tool", action)
			}
			if action.OK && (action.Name == "write_file" || action.Name == "delete_file" || action.Name == "run_command") {
				a.emitFSChanged()
			}
		},
	})
	if err != nil {
		return reply, err
	}

	a.mu.Lock()
	a.chatHistory = append(a.chatHistory, ai.Message{Role: "user", Content: text}, ai.Message{Role: "assistant", Content: reply.Text})
	if len(a.chatHistory) > maxChatHistory {
		a.chatHistory = a.chatHistory[len(a.chatHistory)-maxChatHistory:]
	}
	saved := append([]ai.Message(nil), a.chatHistory...)
	a.mu.Unlock()
	a.persist(a.store.ReplaceMessages(saved))

	return reply, nil
}

func (a *App) emitFSChanged() {
	if a.ctx != nil {
		runtime.EventsEmit(a.ctx, "fs:changed")
	}
}

func (a *App) persist(err error) {
	if err != nil && a.ctx != nil {
		runtime.LogError(a.ctx, err.Error())
	}
}

// startWatcher sets up an fsnotify watcher on the project root so that
// external file changes (e.g. from the OS file manager) are pushed to the frontend.
func (a *App) startWatcher(root string) {
	a.stopWatcher()

	w, err := fsnotify.NewWatcher()
	if err != nil {
		if a.ctx != nil {
			runtime.LogError(a.ctx, "fs watcher: "+err.Error())
		}
		return
	}

	done := make(chan struct{})
	a.watcherMu.Lock()
	a.watcher = w
	a.watcherDone = done
	a.watcherMu.Unlock()

	// Add root and immediate subdirectories (1 level deep is enough;
	// deeper dirs get added when expanded in the UI via fs:changed reload).
	_ = w.Add(root)
	a.addSubDirs(w, root, 3)

	go func() {
		defer close(done)
		var debounce *time.Timer
		for {
			select {
			case ev, ok := <-w.Events:
				if !ok {
					return
				}
				// When a new directory is created, start watching it too.
				if ev.Op&(fsnotify.Create) != 0 {
					if info, err := os.Stat(ev.Name); err == nil && info.IsDir() {
						_ = w.Add(ev.Name)
					}
				}
				// Debounce: batch rapid changes into a single emit.
				if debounce != nil {
					debounce.Stop()
				}
				debounce = time.AfterFunc(200*time.Millisecond, func() {
					a.emitFSChanged()
				})
			case _, ok := <-w.Errors:
				if !ok {
					return
				}
			}
		}
	}()
}

func (a *App) stopWatcher() {
	a.watcherMu.Lock()
	w := a.watcher
	a.watcher = nil
	a.watcherMu.Unlock()
	if w != nil {
		_ = w.Close()
	}
}

// addSubDirs recursively watches subdirectories up to a given depth.
func (a *App) addSubDirs(w *fsnotify.Watcher, dir string, depth int) {
	if depth <= 0 {
		return
	}
	entries, err := os.ReadDir(dir)
	if err != nil {
		return
	}
	for _, e := range entries {
		if !e.IsDir() {
			continue
		}
		name := e.Name()
		// Skip hidden dirs and common heavy dirs.
		if strings.HasPrefix(name, ".") || name == "node_modules" || name == "vendor" || name == "__pycache__" {
			continue
		}
		sub := filepath.Join(dir, name)
		_ = w.Add(sub)
		a.addSubDirs(w, sub, depth-1)
	}
}
