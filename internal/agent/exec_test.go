package agent

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestExecuteWriteReadAndBlock(t *testing.T) {
	root := t.TempDir()
	out, action := Execute(root, "write_file", map[string]any{"path": "note.txt", "content": "hello"})
	if !action.OK || !strings.Contains(out, "wrote") {
		t.Fatalf("write failed: %+v %s", action, out)
	}
	body, err := os.ReadFile(filepath.Join(root, "note.txt"))
	if err != nil || string(body) != "hello" {
		t.Fatalf("file content %q err %v", body, err)
	}
	_, action = Execute(root, "run_command", map[string]any{"command": "rm -rf /"})
	if action.OK {
		t.Fatal("expected dangerous command to be blocked")
	}
}
