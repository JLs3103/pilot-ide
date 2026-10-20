package fsutil

import (
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
)

const maxReadBytes = 8 << 20

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
	if err != nil || rel == ".." || strings.HasPrefix(rel, ".."+string(os.PathSeparator)) {
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

func DeleteFile(root, path string) error {
	abs, err := Resolve(root, path)
	if err != nil {
		return err
	}
	info, err := os.Stat(abs)
	if err != nil {
		return err
	}
	if info.IsDir() {
		return fmt.Errorf("refusing to delete a directory")
	}
	return os.Remove(abs)
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

func FormatTree(node TreeNode) string {
	var b strings.Builder
	writeTree(&b, node, "")
	return strings.TrimRight(b.String(), "\n")
}

func writeTree(b *strings.Builder, node TreeNode, indent string) {
	marker := ""
	if node.IsDir {
		marker = "/"
	}
	b.WriteString(indent)
	b.WriteString(node.Name)
	b.WriteString(marker)
	b.WriteByte('\n')
	childIndent := indent + "  "
	for _, child := range node.Children {
		writeTree(b, child, childIndent)
	}
}

func EditFile(root, path, oldText, newText string) (int, error) {
	abs, err := Resolve(root, path)
	if err != nil {
		return 0, err
	}
	data, err := os.ReadFile(abs)
	if err != nil {
		return 0, err
	}
	content := string(data)

	if oldText == "" {
		return 0, fmt.Errorf("old_text cannot be empty")
	}

	normContent := strings.ReplaceAll(content, "\r\n", "\n")
	normOld := strings.ReplaceAll(oldText, "\r\n", "\n")
	normNew := strings.ReplaceAll(newText, "\r\n", "\n")

	if strings.Count(normContent, normOld) == 1 {
		idx := strings.Index(normContent, normOld)
		prefix := normContent[:idx]
		suffix := normContent[idx+len(normOld):]
		trimmedSuffix := strings.TrimSpace(suffix)
		trimmedPrefix := strings.TrimSpace(prefix)

		hasSuffixRepetition := len(trimmedSuffix) >= 5 && (strings.HasSuffix(normNew, suffix) || (strings.HasPrefix(suffix, "\n") && strings.HasSuffix(normNew, "\n"+trimmedSuffix)))
		hasPrefixRepetition := len(trimmedPrefix) >= 5 && (strings.HasPrefix(normNew, prefix) || (strings.HasSuffix(prefix, "\n") && strings.HasPrefix(normNew, trimmedPrefix+"\n")))

		if hasPrefixRepetition && hasSuffixRepetition {
			result := normNew
			if strings.Contains(content, "\r\n") {
				result = strings.ReplaceAll(result, "\n", "\r\n")
			}
			if err := os.WriteFile(abs, []byte(result), 0o644); err != nil {
				return 0, err
			}
			return 1, nil
		} else if hasSuffixRepetition {
			result := prefix + normNew
			if strings.Contains(content, "\r\n") {
				result = strings.ReplaceAll(result, "\n", "\r\n")
			}
			if err := os.WriteFile(abs, []byte(result), 0o644); err != nil {
				return 0, err
			}
			return 1, nil
		}
	}

	count := strings.Count(content, oldText)
	if count > 0 {
		result := strings.ReplaceAll(content, oldText, newText)
		if err := os.WriteFile(abs, []byte(result), 0o644); err != nil {
			return 0, err
		}
		return count, nil
	}

	count = strings.Count(normContent, normOld)
	if count > 0 {
		result := strings.ReplaceAll(normContent, normOld, normNew)
		if strings.Contains(content, "\r\n") {
			result = strings.ReplaceAll(result, "\n", "\r\n")
		}
		if err := os.WriteFile(abs, []byte(result), 0o644); err != nil {
			return 0, err
		}
		return count, nil
	}

	trimLines := func(s string) string {
		lines := strings.Split(s, "\n")
		for i, line := range lines {
			lines[i] = strings.TrimRight(line, " \t\r")
		}
		return strings.Join(lines, "\n")
	}
	trimContent := trimLines(normContent)
	trimOld := trimLines(normOld)
	count = strings.Count(trimContent, trimOld)
	if count > 0 {
		result := fuzzyReplace(normContent, normOld, normNew)
		if strings.Contains(content, "\r\n") {
			result = strings.ReplaceAll(result, "\n", "\r\n")
		}
		if err := os.WriteFile(abs, []byte(result), 0o644); err != nil {
			return 0, err
		}
		return count, nil
	}

	unquotedOld := normOld
	if (strings.HasPrefix(unquotedOld, "\"") && strings.HasSuffix(unquotedOld, "\"")) ||
		(strings.HasPrefix(unquotedOld, "'") && strings.HasSuffix(unquotedOld, "'")) {
		unquotedOld = unquotedOld[1 : len(unquotedOld)-1]
		if strings.Count(normContent, unquotedOld) > 0 {
			result := strings.ReplaceAll(normContent, unquotedOld, normNew)
			if strings.Contains(content, "\r\n") {
				result = strings.ReplaceAll(result, "\n", "\r\n")
			}
			if err := os.WriteFile(abs, []byte(result), 0o644); err != nil {
				return 0, err
			}
			return strings.Count(normContent, unquotedOld), nil
		}
	}

	reLineNum := regexp.MustCompile(`(?m)^\s*(?:[Ll]ine\s*)?\d+[:.]\s*`)
	strippedOld := reLineNum.ReplaceAllString(normOld, "")
	if strippedOld != normOld && strings.TrimSpace(strippedOld) != "" {
		if strings.Count(normContent, strippedOld) > 0 {
			result := strings.ReplaceAll(normContent, strippedOld, normNew)
			if strings.Contains(content, "\r\n") {
				result = strings.ReplaceAll(result, "\n", "\r\n")
			}
			if err := os.WriteFile(abs, []byte(result), 0o644); err != nil {
				return 0, err
			}
			return strings.Count(normContent, strippedOld), nil
		}
	}

	cleanOld := strings.ToLower(strings.TrimSpace(normOld))
	if cleanOld == "top" || cleanOld == "beginning" || cleanOld == "start" ||
		cleanOld == "line 1" || cleanOld == "baris 1" || cleanOld == "baris pertama" ||
		cleanOld == "baris paling atas" || cleanOld == "1" {
		lines := strings.Split(normContent, "\n")
		if len(lines) > 0 && strings.TrimSpace(lines[0]) != "" {
			firstLine := lines[0]
			replacement := normNew
			if !strings.Contains(normNew, firstLine) {
				replacement = strings.TrimRight(normNew, "\n") + "\n" + firstLine
			}
			result := strings.Replace(normContent, firstLine, replacement, 1)
			if strings.Contains(content, "\r\n") {
				result = strings.ReplaceAll(result, "\n", "\r\n")
			}
			if err := os.WriteFile(abs, []byte(result), 0o644); err != nil {
				return 0, err
			}
			return 1, nil
		}
	}

	trimmedOld := strings.TrimSpace(normOld)
	if trimmedOld != "" {
		for _, line := range strings.Split(normContent, "\n") {
			if strings.TrimSpace(line) == trimmedOld {
				result := strings.Replace(normContent, line, normNew, 1)
				if strings.Contains(content, "\r\n") {
					result = strings.ReplaceAll(result, "\n", "\r\n")
				}
				if err := os.WriteFile(abs, []byte(result), 0o644); err != nil {
					return 0, err
				}
				return 1, nil
			}
		}
	}

	return 0, fmt.Errorf("old_text not found in %s (tried exact, normalized, and trimmed matching)", path)
}

func fuzzyReplace(content, oldText, newText string) string {
	contentLines := strings.Split(content, "\n")
	oldLines := strings.Split(oldText, "\n")
	newLines := strings.Split(newText, "\n")

	trimRight := func(s string) string { return strings.TrimRight(s, " \t\r") }

	for i := 0; i <= len(contentLines)-len(oldLines); i++ {
		match := true
		for j := 0; j < len(oldLines); j++ {
			if trimRight(contentLines[i+j]) != trimRight(oldLines[j]) {
				match = false
				break
			}
		}
		if match {
			var result []string
			result = append(result, contentLines[:i]...)
			result = append(result, newLines...)
			result = append(result, contentLines[i+len(oldLines):]...)
			return strings.Join(result, "\n")
		}
	}
	return strings.ReplaceAll(content, oldText, newText)
}

func RenameOrMove(root, oldPath, newPath string) error {
	absOld, err := Resolve(root, oldPath)
	if err != nil {
		return fmt.Errorf("source: %w", err)
	}
	absNew, err := Resolve(root, newPath)
	if err != nil {
		return fmt.Errorf("destination: %w", err)
	}
	if _, err := os.Stat(absOld); err != nil {
		return fmt.Errorf("source does not exist: %s", oldPath)
	}
	if _, err := os.Stat(absNew); err == nil {
		return fmt.Errorf("destination already exists: %s", newPath)
	}
	if err := os.MkdirAll(filepath.Dir(absNew), 0o755); err != nil {
		return err
	}
	return os.Rename(absOld, absNew)
}

func CreateDir(root, path string) error {
	abs, err := Resolve(root, path)
	if err != nil {
		return err
	}
	if info, err := os.Stat(abs); err == nil {
		if info.IsDir() {
			return fmt.Errorf("directory already exists: %s", path)
		}
		return fmt.Errorf("a file already exists at that path: %s", path)
	}
	return os.MkdirAll(abs, 0o755)
}

type FileInfo struct {
	Name    string `json:"name"`
	Path    string `json:"path"`
	Size    int64  `json:"size"`
	IsDir   bool   `json:"isDir"`
	ModTime string `json:"modTime"`
	Mode    string `json:"mode"`
}

func GetFileInfo(root, path string) (FileInfo, error) {
	abs, err := Resolve(root, path)
	if err != nil {
		return FileInfo{}, err
	}
	info, err := os.Stat(abs)
	if err != nil {
		return FileInfo{}, err
	}
	return FileInfo{
		Name:    info.Name(),
		Path:    abs,
		Size:    info.Size(),
		IsDir:   info.IsDir(),
		ModTime: info.ModTime().Format("2006-01-02 15:04:05"),
		Mode:    info.Mode().String(),
	}, nil
}
