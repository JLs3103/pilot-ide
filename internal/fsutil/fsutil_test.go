package fsutil

import (
	"path/filepath"
	"runtime"
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
