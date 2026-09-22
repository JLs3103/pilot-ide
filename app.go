package main

import (
	"context"
	"fmt"

	"pilot-ide/internal/fsutil"
	"pilot-ide/internal/terminal"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

type App struct {
	ctx         context.Context
	projectRoot string
}

func NewApp() *App {
	return &App{}
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
