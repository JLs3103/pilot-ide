package fsutil

import "testing"

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
