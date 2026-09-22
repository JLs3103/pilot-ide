package fsutil

import (
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
)

const maxReadBytes = 8 << 20 // 8 MiB

var skipInTree = map[string]struct{}{
	".git":         {},
	"node_modules": {},
	"dist":         {},
	"vendor":       {},
	".wails":       {},
}

type DirEntry struct {
	Name  string `json:"name"`
	Path  string `json:"path"`
	IsDir bool   `json:"isDir"`
}

type TreeNode struct {
	Name     string     `json:"name"`
	Path     string     `json:"path"`
	IsDir    bool       `json:"isDir"`
	Children []TreeNode `json:"children,omitempty"`
}

func Resolve(root, target string) (string, error) {
	if strings.TrimSpace(root) == "" {
		return "", fmt.Errorf("project folder is not set")
	}
	absRoot, err := filepath.Abs(root)
	if err != nil {
		return "", err
	}
	if strings.TrimSpace(target) == "" {
		target = absRoot
	}
	if !filepath.IsAbs(target) {
		target = filepath.Join(absRoot, target)
	}
	absTarget, err := filepath.Abs(target)
	if err != nil {
		return "", err
	}
	rel, err := filepath.Rel(absRoot, absTarget)
	if err != nil {
		return "", err
	}
	if rel == ".." || strings.HasPrefix(rel, ".."+string(os.PathSeparator)) {
		return "", fmt.Errorf("path is outside the project folder")
	}
	return absTarget, nil
}

func ListDir(root, path string) ([]DirEntry, error) {
	abs, err := Resolve(root, path)
	if err != nil {
		return nil, err
	}
	entries, err := os.ReadDir(abs)
	if err != nil {
		return nil, err
	}
	out := make([]DirEntry, 0, len(entries))
	for _, e := range entries {
		out = append(out, DirEntry{
			Name:  e.Name(),
			Path:  filepath.Join(abs, e.Name()),
			IsDir: e.IsDir(),
		})
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].IsDir != out[j].IsDir {
			return out[i].IsDir
		}
		return strings.ToLower(out[i].Name) < strings.ToLower(out[j].Name)
	})
	return out, nil
}

func ReadFile(root, path string) (string, error) {
	abs, err := Resolve(root, path)
	if err != nil {
		return "", err
	}
	info, err := os.Stat(abs)
	if err != nil {
		return "", err
	}
	if info.IsDir() {
		return "", fmt.Errorf("cannot read a directory")
	}
	if info.Size() > maxReadBytes {
		return "", fmt.Errorf("file is larger than 8 MB")
	}
	data, err := os.ReadFile(abs)
	if err != nil {
		return "", err
	}
	return string(data), nil
}

func WriteFile(root, path, content string) error {
	abs, err := Resolve(root, path)
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(abs), 0o755); err != nil {
		return err
	}
	return os.WriteFile(abs, []byte(content), 0o644)
}

func MapTree(root string, maxDepth int) (TreeNode, error) {
	abs, err := Resolve(root, "")
	if err != nil {
		return TreeNode{}, err
	}
	if maxDepth <= 0 {
		maxDepth = 6
	}
	return walkTree(abs, filepath.Base(abs), 0, maxDepth)
}

func walkTree(abs, name string, depth, maxDepth int) (TreeNode, error) {
	node := TreeNode{Name: name, Path: abs, IsDir: true}
	if depth >= maxDepth {
		return node, nil
	}
	entries, err := os.ReadDir(abs)
	if err != nil {
		return node, nil
	}
	var children []TreeNode
	for _, e := range entries {
		if _, skip := skipInTree[e.Name()]; skip {
			continue
		}
		childPath := filepath.Join(abs, e.Name())
		if e.IsDir() {
			child, err := walkTree(childPath, e.Name(), depth+1, maxDepth)
			if err != nil {
				continue
			}
			children = append(children, child)
			continue
		}
		children = append(children, TreeNode{
			Name:  e.Name(),
			Path:  childPath,
			IsDir: false,
		})
	}
	sort.Slice(children, func(i, j int) bool {
		if children[i].IsDir != children[j].IsDir {
			return children[i].IsDir
		}
		return strings.ToLower(children[i].Name) < strings.ToLower(children[j].Name)
	})
	node.Children = children
	return node, nil
}
