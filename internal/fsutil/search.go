package fsutil

import (
	"bufio"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"
)

type SearchMatch struct {
	File       string `json:"file"`
	Line       int    `json:"line"`
	Column     int    `json:"column"`
	Text       string `json:"text"`
	MatchStart int    `json:"matchStart"`
	MatchEnd   int    `json:"matchEnd"`
}

type SearchResult struct {
	Matches []SearchMatch `json:"matches"`
	Total   int           `json:"total"`
}

const maxSearchResults = 500

var skipSearchDirs = map[string]bool{
	".git": true, "node_modules": true, "dist": true,
	"vendor": true, ".wails": true, "__pycache__": true,
	"build": true, ".next": true,
}

var binaryExts = map[string]bool{
	".png": true, ".jpg": true, ".jpeg": true, ".gif": true,
	".bmp": true, ".ico": true, ".webp": true, ".svg": true,
	".mp3": true, ".mp4": true, ".wav": true, ".avi": true,
	".zip": true, ".tar": true, ".gz": true, ".7z": true,
	".rar": true, ".exe": true, ".dll": true, ".so": true,
	".wasm": true, ".pdf": true, ".ttf": true, ".woff": true,
	".woff2": true, ".eot": true, ".db": true, ".sqlite": true,
}

func isBinaryFile(name string) bool {
	ext := strings.ToLower(filepath.Ext(name))
	return binaryExts[ext]
}

func matchesGlob(name, pattern string) bool {
	if pattern == "" {
		return true
	}
	patterns := strings.Split(pattern, ",")
	for _, p := range patterns {
		p = strings.TrimSpace(p)
		if p == "" {
			continue
		}
		if ok, _ := filepath.Match(p, name); ok {
			return true
		}
	}
	return false
}

func SearchFiles(root, query string, isRegex, caseSensitive bool, includePattern string) (SearchResult, error) {
	abs, err := filepath.Abs(root)
	if err != nil {
		return SearchResult{}, err
	}

	var re *regexp.Regexp
	if isRegex {
		pattern := query
		if !caseSensitive {
			pattern = "(?i)" + pattern
		}
		re, err = regexp.Compile(pattern)
		if err != nil {
			return SearchResult{}, fmt.Errorf("invalid regex: %v", err)
		}
	} else if !caseSensitive {
		re, err = regexp.Compile("(?i)" + regexp.QuoteMeta(query))
		if err != nil {
			return SearchResult{}, err
		}
	}

	var matches []SearchMatch
	_ = filepath.WalkDir(abs, func(path string, d os.DirEntry, walkErr error) error {
		if walkErr != nil {
			return nil
		}
		if d.IsDir() {
			if skipSearchDirs[d.Name()] {
				return filepath.SkipDir
			}
			return nil
		}
		if isBinaryFile(d.Name()) {
			return nil
		}
		if includePattern != "" && !matchesGlob(d.Name(), includePattern) {
			return nil
		}
		info, err := d.Info()
		if err != nil || info.Size() > maxReadBytes {
			return nil
		}

		fileMatches := searchInFile(path, query, re, caseSensitive)
		matches = append(matches, fileMatches...)
		if len(matches) >= maxSearchResults {
			return fmt.Errorf("limit")
		}
		return nil
	})

	if len(matches) > maxSearchResults {
		matches = matches[:maxSearchResults]
	}

	return SearchResult{Matches: matches, Total: len(matches)}, nil
}

func searchInFile(path, query string, re *regexp.Regexp, caseSensitive bool) []SearchMatch {
	f, err := os.Open(path)
	if err != nil {
		return nil
	}
	defer f.Close()

	var matches []SearchMatch
	scanner := bufio.NewScanner(f)
	buf := make([]byte, 64*1024)
	scanner.Buffer(buf, 1024*1024)
	lineNum := 0
	for scanner.Scan() {
		lineNum++
		line := scanner.Text()
		if re != nil {
			locs := re.FindAllStringIndex(line, -1)
			for _, loc := range locs {
				matches = append(matches, SearchMatch{
					File:       path,
					Line:       lineNum,
					Column:     loc[0] + 1,
					Text:       line,
					MatchStart: loc[0],
					MatchEnd:   loc[1],
				})
			}
		} else {
			haystack := line
			needle := query
			if !caseSensitive {
				haystack = strings.ToLower(haystack)
				needle = strings.ToLower(needle)
			}
			idx := 0
			for {
				pos := strings.Index(haystack[idx:], needle)
				if pos < 0 {
					break
				}
				absPos := idx + pos
				matches = append(matches, SearchMatch{
					File:       path,
					Line:       lineNum,
					Column:     absPos + 1,
					Text:       line,
					MatchStart: absPos,
					MatchEnd:   absPos + len(query),
				})
				idx = absPos + len(needle)
			}
		}
		if len(matches) > maxSearchResults {
			break
		}
	}
	if err := scanner.Err(); err != nil {
	}
	return matches
}

func ReplaceInFile(root, filePath, search, replace string, isRegex, caseSensitive bool) (int, error) {
	abs, err := Resolve(root, filePath)
	if err != nil {
		return 0, err
	}
	data, err := os.ReadFile(abs)
	if err != nil {
		return 0, err
	}
	content := string(data)
	var newContent string
	var count int

	if isRegex {
		pattern := search
		if !caseSensitive {
			pattern = "(?i)" + pattern
		}
		re, err := regexp.Compile(pattern)
		if err != nil {
			return 0, fmt.Errorf("invalid regex: %v", err)
		}
		locs := re.FindAllStringIndex(content, -1)
		count = len(locs)
		newContent = re.ReplaceAllString(content, replace)
	} else {
		if caseSensitive {
			count = strings.Count(content, search)
			newContent = strings.ReplaceAll(content, search, replace)
		} else {
			re, err := regexp.Compile("(?i)" + regexp.QuoteMeta(search))
			if err != nil {
				return 0, err
			}
			locs := re.FindAllStringIndex(content, -1)
			count = len(locs)
			newContent = re.ReplaceAllString(content, replace)
		}
	}

	if count == 0 {
		return 0, nil
	}
	return count, os.WriteFile(abs, []byte(newContent), 0o644)
}

func ReplaceInProject(root, search, replace string, isRegex, caseSensitive bool, includePattern string) (int, error) {
	abs, err := filepath.Abs(root)
	if err != nil {
		return 0, err
	}
	totalCount := 0
	_ = filepath.WalkDir(abs, func(path string, d os.DirEntry, walkErr error) error {
		if walkErr != nil {
			return nil
		}
		if d.IsDir() {
			if skipSearchDirs[d.Name()] {
				return filepath.SkipDir
			}
			return nil
		}
		if isBinaryFile(d.Name()) {
			return nil
		}
		if includePattern != "" && !matchesGlob(d.Name(), includePattern) {
			return nil
		}
		info, err := d.Info()
		if err != nil || info.Size() > maxReadBytes {
			return nil
		}
		count, err := ReplaceInFile(root, path, search, replace, isRegex, caseSensitive)
		if err == nil {
			totalCount += count
		}
		return nil
	})
	return totalCount, nil
}
