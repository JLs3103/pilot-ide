package main

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
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

	chatMu     sync.Mutex
	chatCancel context.CancelFunc

	terminalMu   sync.Mutex
	terminalCwd  string
	activeCancel context.CancelFunc

	watcherMu   sync.Mutex
	watcher     *fsnotify.Watcher
	watcherDone chan struct{}

	snapshots *agent.SnapshotManager
}

func NewApp() *App {
	return &App{
		mode:      ai.ModeLocal,
		snapshots: agent.NewSnapshotManager(),
	}
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

	startedByUs, err := ai.EnsureOllamaRunning(ctx)
	if err != nil {
		runtime.LogInfo(ctx, "Ollama auto-launch: "+err.Error())
	} else if startedByUs {
		runtime.LogInfo(ctx, "Ollama started automatically by Pilot IDE")
	}
}

func (a *App) domReady(ctx context.Context) {
}

func (a *App) shutdown(ctx context.Context) {
	ai.StopOllama()
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
	a.addRecentProject(dir)
	if a.ctx != nil {
		runtime.EventsEmit(a.ctx, "project:opened", dir)
	}
	return dir, nil
}

func (a *App) OpenProjectPath(dir string) (string, error) {
	if dir == "" {
		return "", fmt.Errorf("path is empty")
	}
	info, err := os.Stat(dir)
	if err != nil || !info.IsDir() {
		return "", fmt.Errorf("directory does not exist or is not a directory")
	}
	a.projectRoot = dir
	a.terminalMu.Lock()
	a.terminalCwd = dir
	a.terminalMu.Unlock()
	runtime.WindowSetTitle(a.ctx, "Pilot IDE — "+dir)
	a.persist(a.store.SaveProjectRoot(dir))
	a.startWatcher(dir)
	a.addRecentProject(dir)
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
		Mode:            mode,
		LocalModel:      ai.DefaultLocalModel,
		CloudModel:      ai.DefaultCloudModel,
		HasGeminiKey:    hasKey,
		OllamaURL:       url,
		OllamaUp:        ai.PingOllama(context.Background(), url),
		OllamaAutoStart: ai.DidWeStartOllama(),
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

var mentionRegex = regexp.MustCompile(`@(?:\[([^\]]+)\]|([a-zA-Z0-9_\-\./\\]+))`)

func (a *App) resolveMentions(root, message string) string {
	if root == "" || message == "" {
		return ""
	}
	matches := mentionRegex.FindAllStringSubmatch(message, -1)
	if len(matches) == 0 {
		return ""
	}

	var sb strings.Builder
	seen := make(map[string]bool)

	for _, m := range matches {
		target := m[1]
		if target == "" {
			target = m[2]
		}
		target = strings.TrimSpace(target)
		if target == "" || seen[target] {
			continue
		}
		seen[target] = true

		abs, err := fsutil.Resolve(root, target)
		if err != nil {
			continue
		}
		info, err := os.Stat(abs)
		if err != nil {
			continue
		}

		if info.IsDir() {
			entries, err := os.ReadDir(abs)
			if err == nil {
				sb.WriteString(fmt.Sprintf("\n[Directory Context for @%s]:\n", target))
				count := 0
				for _, e := range entries {
					if strings.HasPrefix(e.Name(), ".") {
						continue
					}
					isD := ""
					if e.IsDir() {
						isD = "/"
					}
					sb.WriteString(fmt.Sprintf("- %s%s\n", e.Name(), isD))
					count++
					if count >= 40 {
						sb.WriteString("... (truncated)\n")
						break
					}
				}
			}
		} else {
			data, err := os.ReadFile(abs)
			if err == nil {
				limit := 64 * 1024
				content := string(data)
				truncated := ""
				if len(data) > limit {
					content = string(data[:limit])
					truncated = "\n... (truncated)"
				}
				sb.WriteString(fmt.Sprintf("\n[File Context for @%s]:\n```\n%s%s\n```\n", target, content, truncated))
			}
		}
	}

	return sb.String()
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

	augmentedPrompt := text
	if root != "" {
		if mentionCtx := a.resolveMentions(root, text); mentionCtx != "" {
			augmentedPrompt = text + "\n\n" + mentionCtx
		}
	}

	parentCtx := a.ctx
	if parentCtx == nil {
		parentCtx = context.Background()
	}
	chatCtx, chatCancel := context.WithCancel(parentCtx)
	a.chatMu.Lock()
	a.chatCancel = chatCancel
	a.chatMu.Unlock()
	defer func() {
		a.chatMu.Lock()
		a.chatCancel = nil
		a.chatMu.Unlock()
		chatCancel()
	}()

	turnID := fmt.Sprintf("turn-%d", time.Now().UnixMilli())
	a.snapshots.BeginTurn(turnID)
	hasFileChanges := false

	reply, err := ai.Run(chatCtx, ai.RunRequest{
		Mode:    mode,
		APIKey:  key,
		System:  system,
		History: history,
		User:    augmentedPrompt,
		Root:    root,
		OnBeforeAction: func(name string, args map[string]any) {
			if root == "" {
				return
			}
			switch name {
			case "write_file":
				p, _ := args["path"].(string)
				if p == "" {
					return
				}
				abs, err := fsutil.Resolve(root, p)
				if err != nil {
					return
				}
				if _, statErr := os.Stat(abs); statErr == nil {
					a.snapshots.RecordModify(turnID, abs)
				}
			case "edit_file":
				p, _ := args["path"].(string)
				if p == "" {
					return
				}
				abs, err := fsutil.Resolve(root, p)
				if err != nil {
					return
				}
				if _, statErr := os.Stat(abs); statErr == nil {
					a.snapshots.RecordModify(turnID, abs)
				}
			case "delete_file":
				p, _ := args["path"].(string)
				if p == "" {
					return
				}
				abs, err := fsutil.Resolve(root, p)
				if err != nil {
					return
				}
				a.snapshots.RecordDelete(turnID, abs)
			}
		},
		OnAction: func(action agent.Action) {
			if a.ctx != nil {
				runtime.EventsEmit(a.ctx, "agent:tool", action)
			}
			if action.OK {
				switch action.Name {
				case "write_file":
					p := action.Detail
					if root != "" && p != "" {
						abs, resolveErr := fsutil.Resolve(root, p)
						if resolveErr == nil {
							if !a.snapshots.HasPending(turnID) || !fileInTurn(a.snapshots, turnID, abs) {
								a.snapshots.RecordCreate(turnID, abs)
							}
						}
					}
					hasFileChanges = true
					a.emitFSChanged()
					a.emitEditorReload()
				case "edit_file":
					hasFileChanges = true
					a.emitFSChanged()
					a.emitEditorReload()
				case "delete_file":
					hasFileChanges = true
					a.emitFSChanged()
					a.emitEditorReload()
				case "rename_file":
					hasFileChanges = true
					a.emitFSChanged()
					a.emitEditorReload()
				case "create_dir":
					a.emitFSChanged()
				case "run_command":
					a.emitFSChanged()
				}
			}
		},
	})
	if err != nil {
		return reply, err
	}

	if hasFileChanges && a.ctx != nil {
		changes := a.snapshots.GetPendingChanges(turnID)
		if len(changes) > 0 {
			runtime.EventsEmit(a.ctx, "agent:file-changes", map[string]any{
				"turnID":  turnID,
				"changes": changes,
			})
		}
	}

	a.snapshots.Cleanup(10)

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

func (a *App) SearchInProject(query string, isRegex bool, caseSensitive bool, includePattern string) (fsutil.SearchResult, error) {
	if a.projectRoot == "" {
		return fsutil.SearchResult{}, fmt.Errorf("no project open")
	}
	if query == "" {
		return fsutil.SearchResult{}, nil
	}
	return fsutil.SearchFiles(a.projectRoot, query, isRegex, caseSensitive, includePattern)
}

func (a *App) ReplaceInFile(filePath, search, replace string, isRegex, caseSensitive bool) (int, error) {
	if a.projectRoot == "" {
		return 0, fmt.Errorf("no project open")
	}
	count, err := fsutil.ReplaceInFile(a.projectRoot, filePath, search, replace, isRegex, caseSensitive)
	if err == nil && count > 0 {
		a.emitFSChanged()
	}
	return count, err
}

func (a *App) ReplaceInProject(search, replace string, isRegex, caseSensitive bool, includePattern string) (int, error) {
	if a.projectRoot == "" {
		return 0, fmt.Errorf("no project open")
	}
	count, err := fsutil.ReplaceInProject(a.projectRoot, search, replace, isRegex, caseSensitive, includePattern)
	if err == nil && count > 0 {
		a.emitFSChanged()
	}
	return count, err
}

type GitStatusEntry struct {
	Path   string `json:"path"`
	Status string `json:"status"`
	Staged bool   `json:"staged"`
}

type GitBranchInfo struct {
	Name    string `json:"name"`
	Current bool   `json:"current"`
}

type GitLogEntry struct {
	Hash    string `json:"hash"`
	Author  string `json:"author"`
	Date    string `json:"date"`
	Message string `json:"message"`
}

func (a *App) gitExec(args ...string) (string, error) {
	if a.projectRoot == "" {
		return "", fmt.Errorf("no project open")
	}
	result, err := terminal.RunSimple(a.projectRoot, "git", args...)
	if err != nil {
		return "", err
	}
	return result, nil
}

func (a *App) GitStatus() ([]GitStatusEntry, error) {
	out, err := a.gitExec("status", "--porcelain", "-u")
	if err != nil {
		return nil, err
	}
	var entries []GitStatusEntry
	for _, line := range strings.Split(out, "\n") {
		if len(line) < 4 {
			continue
		}
		x := string(line[0])
		y := string(line[1])
		path := strings.TrimSpace(line[3:])
		if path == "" {
			continue
		}
		path = strings.Trim(path, "\"")
		if strings.Contains(path, " -> ") {
			parts := strings.Split(path, " -> ")
			path = strings.Trim(parts[len(parts)-1], "\"")
		}
		var status string
		staged := false
		switch {
		case x == "?" && y == "?":
			status = "untracked"
		case x == "A":
			status = "added"
			staged = true
		case x == "M":
			status = "modified"
			staged = true
		case x == "D":
			status = "deleted"
			staged = true
		case x == "R":
			status = "renamed"
			staged = true
		case y == "M":
			status = "modified"
		case y == "D":
			status = "deleted"
		default:
			status = "changed"
			if x != " " && x != "?" {
				staged = true
			}
		}
		entries = append(entries, GitStatusEntry{Path: path, Status: status, Staged: staged})
	}
	return entries, nil
}

func (a *App) GitStage(paths []string) error {
	if len(paths) == 0 || (len(paths) == 1 && (paths[0] == "." || paths[0] == "-A" || paths[0] == "*")) {
		_, err := a.gitExec("add", "-A")
		if err == nil {
			a.emitFSChanged()
		}
		return err
	}

	const maxBatchSize = 40
	for i := 0; i < len(paths); i += maxBatchSize {
		end := i + maxBatchSize
		if end > len(paths) {
			end = len(paths)
		}
		batch := paths[i:end]
		args := append([]string{"add", "--"}, batch...)
		if _, err := a.gitExec(args...); err != nil {
			return err
		}
	}
	a.emitFSChanged()
	return nil
}

func (a *App) GitUnstage(paths []string) error {
	if len(paths) == 0 || (len(paths) == 1 && (paths[0] == "." || paths[0] == "-A" || paths[0] == "*")) {
		_, err := a.gitExec("reset", "HEAD")
		if err == nil {
			a.emitFSChanged()
		}
		return err
	}

	const maxBatchSize = 40
	for i := 0; i < len(paths); i += maxBatchSize {
		end := i + maxBatchSize
		if end > len(paths) {
			end = len(paths)
		}
		batch := paths[i:end]
		args := append([]string{"reset", "HEAD", "--"}, batch...)
		if _, err := a.gitExec(args...); err != nil {
			return err
		}
	}
	a.emitFSChanged()
	return nil
}

func (a *App) GitCommit(message string) error {
	if message == "" {
		return fmt.Errorf("commit message is empty")
	}
	_, err := a.gitExec("commit", "-m", message)
	if err == nil {
		a.emitFSChanged()
	}
	return err
}

func (a *App) GitPush() (string, error) {
	return a.gitExec("push")
}

func (a *App) GitPull() (string, error) {
	res, err := a.gitExec("pull")
	if err == nil {
		a.emitFSChanged()
	}
	return res, err
}

func (a *App) GitBranches() ([]GitBranchInfo, error) {
	out, err := a.gitExec("branch", "--no-color")
	if err != nil {
		return nil, err
	}
	var branches []GitBranchInfo
	for _, line := range strings.Split(out, "\n") {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		current := false
		if strings.HasPrefix(line, "* ") {
			current = true
			line = line[2:]
		}
		branches = append(branches, GitBranchInfo{Name: strings.TrimSpace(line), Current: current})
	}
	return branches, nil
}

func (a *App) GitSwitchBranch(branch string) error {
	_, err := a.gitExec("checkout", branch)
	if err == nil {
		a.emitFSChanged()
	}
	return err
}

func (a *App) GitDiff(path string) (string, error) {
	if path == "" {
		return a.gitExec("diff")
	}
	return a.gitExec("diff", "--", path)
}

func (a *App) GitDiffStaged(path string) (string, error) {
	if path == "" {
		return a.gitExec("diff", "--cached")
	}
	return a.gitExec("diff", "--cached", "--", path)
}

func (a *App) GitBlame(path string) (string, error) {
	return a.gitExec("blame", "--", path)
}

func (a *App) GitLog(count int) ([]GitLogEntry, error) {
	if count <= 0 {
		count = 20
	}
	out, err := a.gitExec("log", fmt.Sprintf("-%d", count), "--pretty=format:%H|%an|%ad|%s", "--date=short")
	if err != nil {
		return nil, err
	}
	var entries []GitLogEntry
	for _, line := range strings.Split(out, "\n") {
		parts := strings.SplitN(line, "|", 4)
		if len(parts) < 4 {
			continue
		}
		entries = append(entries, GitLogEntry{
			Hash:    parts[0][:7],
			Author:  parts[1],
			Date:    parts[2],
			Message: parts[3],
		})
	}
	return entries, nil
}

func (a *App) GitCurrentBranch() (string, error) {
	out, err := a.gitExec("rev-parse", "--abbrev-ref", "HEAD")
	if err != nil {
		return "", err
	}
	return strings.TrimSpace(out), nil
}

const keyEditorSettings = "editor_settings"

func (a *App) SaveEditorSettings(settings string) error {
	return a.store.Set(keyEditorSettings, settings)
}

func (a *App) GetEditorSettings() string {
	return a.store.Get(keyEditorSettings)
}

func (a *App) FormatDocument(filePath, content string) fsutil.FormatResult {
	return fsutil.FormatDocument(filePath, content)
}

func (a *App) GetProjectSettings() (fsutil.ProjectSettings, error) {
	return fsutil.ReadProjectSettings(a.projectRoot)
}

func (a *App) SaveProjectSettings(settingsJSON string) error {
	if a.projectRoot == "" {
		return fmt.Errorf("no project open")
	}
	var settings fsutil.ProjectSettings
	if err := json.Unmarshal([]byte(settingsJSON), &settings); err != nil {
		return fmt.Errorf("invalid settings: %w", err)
	}
	err := fsutil.WriteProjectSettings(a.projectRoot, settings)
	if err == nil {
		a.emitFSChanged()
	}
	return err
}

func (a *App) GetRecentProjects() []fsutil.RecentProject {
	raw := a.store.Get(keyRecentProjects)
	if raw == "" {
		return nil
	}
	var projects []fsutil.RecentProject
	if err := json.Unmarshal([]byte(raw), &projects); err != nil {
		return nil
	}
	return projects
}

func (a *App) addRecentProject(dir string) {
	if a.store == nil || dir == "" {
		return
	}
	projects := a.GetRecentProjects()

	filtered := make([]fsutil.RecentProject, 0, len(projects))
	for _, p := range projects {
		if p.Path != dir {
			filtered = append(filtered, p)
		}
	}

	entry := fsutil.RecentProject{
		Path:     dir,
		Name:     filepath.Base(dir),
		OpenedAt: time.Now().Unix(),
	}
	filtered = append([]fsutil.RecentProject{entry}, filtered...)

	if len(filtered) > 10 {
		filtered = filtered[:10]
	}

	data, err := json.Marshal(filtered)
	if err == nil {
		_ = a.store.Set(keyRecentProjects, string(data))
	}
}

func (a *App) ClearRecentProjects() error {
	return a.store.Set(keyRecentProjects, "")
}

func (a *App) GetCustomSnippets() ([]fsutil.SnippetDef, error) {
	return fsutil.LoadSnippets(a.projectRoot)
}

func (a *App) InitProjectConfig() error {
	if a.projectRoot == "" {
		return fmt.Errorf("no project open")
	}
	settings := fsutil.DefaultProjectSettings()
	settings.FormatOnSave = true
	err := fsutil.WriteProjectSettings(a.projectRoot, settings)
	if err == nil {
		a.emitFSChanged()
	}
	return err
}

const keyRecentProjects = "recent_projects"

func (a *App) emitFSChanged() {
	if a.ctx != nil {
		runtime.EventsEmit(a.ctx, "fs:changed")
	}
}

func (a *App) emitEditorReload() {
	if a.ctx != nil {
		runtime.EventsEmit(a.ctx, "editor:reload")
	}
}

func fileInTurn(sm *agent.SnapshotManager, turnID, absPath string) bool {
	changes := sm.GetPendingChanges(turnID)
	for _, c := range changes {
		if c.Path == absPath {
			return true
		}
	}
	return false
}

func (a *App) CancelChat() {
	a.chatMu.Lock()
	defer a.chatMu.Unlock()
	if a.chatCancel != nil {
		a.chatCancel()
	}
}

func (a *App) GetPendingFileChanges(turnID string) []agent.FileChange {
	return a.snapshots.GetPendingChanges(turnID)
}

func (a *App) AcceptAllFileChanges(turnID string) {
	a.snapshots.AcceptAll(turnID)
}

func (a *App) RejectAllFileChanges(turnID string) error {
	err := a.snapshots.RejectAll(turnID)
	if err == nil {
		a.emitFSChanged()
		a.emitEditorReload()
	}
	return err
}

func (a *App) AcceptFileChange(turnID, filePath string) {
	a.snapshots.AcceptFile(turnID, filePath)
}

func (a *App) RejectFileChange(turnID, filePath string) error {
	err := a.snapshots.RejectFile(turnID, filePath)
	if err == nil {
		a.emitFSChanged()
		a.emitEditorReload()
	}
	return err
}

func (a *App) persist(err error) {
	if err != nil && a.ctx != nil {
		runtime.LogError(a.ctx, err.Error())
	}
}

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
				if ev.Op&(fsnotify.Create) != 0 {
					if info, err := os.Stat(ev.Name); err == nil && info.IsDir() {
						_ = w.Add(ev.Name)
					}
				}
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
		if strings.HasPrefix(name, ".") || name == "node_modules" || name == "vendor" || name == "__pycache__" {
			continue
		}
		sub := filepath.Join(dir, name)
		_ = w.Add(sub)
		a.addSubDirs(w, sub, depth-1)
	}
}
