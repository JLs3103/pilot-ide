package fsutil

import (
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
)

func TestFormatTree(t *testing.T) {
	tree := TreeNode{
		Name:  "demo",
		IsDir: true,
		Children: []TreeNode{
			{Name: "src", IsDir: true, Children: []TreeNode{{Name: "main.go"}}},
			{Name: "README.md"},
		},
	}
	got := FormatTree(tree)
	want := "demo/\n  src/\n    main.go\n  README.md"
	if got != want {
		t.Fatalf("got %q want %q", got, want)
	}
}

func TestResolveRejectsOutsidePath(t *testing.T) {
	root := t.TempDir()
	_, err := Resolve(root, filepath.Join(root, "..", "outside.txt"))
	if err == nil {
		t.Fatal("expected outside path to fail")
	}
	if runtime.GOOS == "windows" {
		_, err = Resolve(root, `C:\Windows\win.ini`)
		if err == nil {
			t.Fatal("expected different-drive path to fail")
		}
	}
}

func TestEditFile_ExactMatch(t *testing.T) {
	root := t.TempDir()
	_ = os.WriteFile(filepath.Join(root, "test.go"), []byte("func main() {\n\tfmt.Println(\"hello\")\n}\n"), 0o644)

	count, err := EditFile(root, "test.go", "\"hello\"", "\"world\"")
	if err != nil {
		t.Fatalf("EditFile failed: %v", err)
	}
	if count != 1 {
		t.Fatalf("expected 1 replacement, got %d", count)
	}

	data, _ := os.ReadFile(filepath.Join(root, "test.go"))
	if !strings.Contains(string(data), "\"world\"") {
		t.Fatal("replacement not applied")
	}
	t.Log("PASS: exact match edit works")
}

func TestEditFile_CRLFNormalization(t *testing.T) {
	root := t.TempDir()
	_ = os.WriteFile(filepath.Join(root, "test.go"), []byte("func main() {\r\n\tfmt.Println(\"hello\")\r\n}\r\n"), 0o644)

	count, err := EditFile(root, "test.go", "func main() {\n\tfmt.Println(\"hello\")\n}", "func main() {\n\tfmt.Println(\"world\")\n}")
	if err != nil {
		t.Fatalf("EditFile with CRLF should not fail: %v", err)
	}
	if count != 1 {
		t.Fatalf("expected 1 replacement, got %d", count)
	}

	data, _ := os.ReadFile(filepath.Join(root, "test.go"))
	if !strings.Contains(string(data), "\"world\"") {
		t.Fatal("CRLF-normalized replacement not applied")
	}
	t.Log("PASS: CRLF normalization fallback works")
}

func TestEditFile_TrailingWhitespace(t *testing.T) {
	root := t.TempDir()
	_ = os.WriteFile(filepath.Join(root, "test.go"), []byte("func main() {  \n\tfmt.Println(\"hello\")  \n}\n"), 0o644)

	count, err := EditFile(root, "test.go", "func main() {\n\tfmt.Println(\"hello\")\n}", "func main() {\n\tfmt.Println(\"world\")\n}")
	if err != nil {
		t.Fatalf("EditFile with trailing whitespace should not fail: %v", err)
	}
	if count != 1 {
		t.Fatalf("expected 1 replacement, got %d", count)
	}

	data, _ := os.ReadFile(filepath.Join(root, "test.go"))
	if !strings.Contains(string(data), "\"world\"") {
		t.Fatal("trailing-whitespace-normalized replacement not applied")
	}
	t.Log("PASS: trailing whitespace fuzzy match works")
}

func TestEditFile_NotFound(t *testing.T) {
	root := t.TempDir()
	_ = os.WriteFile(filepath.Join(root, "test.go"), []byte("func main() {}\n"), 0o644)

	_, err := EditFile(root, "test.go", "completely different text", "new text")
	if err == nil {
		t.Fatal("expected error when text not found")
	}
	if !strings.Contains(err.Error(), "not found") {
		t.Fatalf("expected 'not found' in error, got: %s", err.Error())
	}
	t.Log("PASS: not found error correct")
}

func TestSearchFiles_AutoRegex(t *testing.T) {
	root := t.TempDir()
	_ = os.WriteFile(filepath.Join(root, "app.go"), []byte("package main\n\nfunc NewApp() {}\nfunc main() {}\n"), 0o644)

	res, err := SearchFiles(root, `func\s+\w+`, false, false, "")
	if err != nil {
		t.Fatalf("SearchFiles failed: %v", err)
	}
	if len(res.Matches) != 2 {
		t.Fatalf("expected 2 matches for auto-regex func\\s+\\w+, got %d", len(res.Matches))
	}
	t.Logf("PASS: auto-regex detected and found %d matches", len(res.Matches))
}

func TestEditFile_SuffixRepetitionDeduplicated(t *testing.T) {
	root := t.TempDir()
	original := "Baris Satu\nBaris Dua Diedit\nBaris Tiga\n"
	_ = os.WriteFile(filepath.Join(root, "test.txt"), []byte(original), 0o644)

	newTextWithSuffix := "// edited by pilot agent\nBaris Satu\nBaris Dua Diedit\nBaris Tiga\n"
	count, err := EditFile(root, "test.txt", "Baris Satu", newTextWithSuffix)
	if err != nil {
		t.Fatalf("EditFile failed: %v", err)
	}
	if count != 1 {
		t.Fatalf("expected 1 replacement, got %d", count)
	}

	data, _ := os.ReadFile(filepath.Join(root, "test.txt"))
	expected := "// edited by pilot agent\nBaris Satu\nBaris Dua Diedit\nBaris Tiga\n"
	if string(data) != expected {
		t.Fatalf("expected non-duplicated content:\n%q\ngot:\n%q", expected, string(data))
	}
	t.Log("PASS: suffix repetition deduplicated successfully")
}

func TestEditFile_LineNumberAndQuotesAndPositional(t *testing.T) {
	root := t.TempDir()
	original := "Baris Satu\nBaris Dua Diedit\nBaris Tiga\n"

	_ = os.WriteFile(filepath.Join(root, "test1.txt"), []byte(original), 0o644)
	count, err := EditFile(root, "test1.txt", "\"Baris Satu\"", "// comment\nBaris Satu")
	if err != nil || count != 1 {
		t.Fatalf("quoted old_text failed: %v", err)
	}

	_ = os.WriteFile(filepath.Join(root, "test2.txt"), []byte(original), 0o644)
	count, err = EditFile(root, "test2.txt", "1: Baris Satu", "// comment\nBaris Satu")
	if err != nil || count != 1 {
		t.Fatalf("line number prefix failed: %v", err)
	}

	_ = os.WriteFile(filepath.Join(root, "test3.txt"), []byte(original), 0o644)
	count, err = EditFile(root, "test3.txt", "baris paling atas", "// comment\nBaris Satu")
	if err != nil || count != 1 {
		t.Fatalf("positional keyword failed: %v", err)
	}
	data, _ := os.ReadFile(filepath.Join(root, "test3.txt"))
	if !strings.HasPrefix(string(data), "// comment\nBaris Satu") {
		t.Fatalf("expected comment prepended at top, got: %s", string(data))
	}
	t.Log("PASS: all EditFile fallback matchers passed")
}
