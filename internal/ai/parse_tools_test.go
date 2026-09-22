package ai

import "testing"

func TestExtractToolCallsFromText_QwenJSON(t *testing.T) {
	raw := `{"name": "write_file", "arguments": {"path": "hello.txt", "content": "Hello, world!"}}`
	calls := extractToolCallsFromText(raw)
	if len(calls) != 1 {
		t.Fatalf("got %d calls: %+v", len(calls), calls)
	}
	if calls[0].Name != "write_file" {
		t.Fatalf("name %s", calls[0].Name)
	}
	if calls[0].Args["path"] != "hello.txt" {
		t.Fatalf("path %v", calls[0].Args["path"])
	}
	if calls[0].Args["content"] != "Hello, world!" {
		t.Fatalf("content %v", calls[0].Args["content"])
	}
}

func TestExtractToolCallsFromText_IgnoresPlainChat(t *testing.T) {
	calls := extractToolCallsFromText("Saya akan membuat file hello.txt untuk Anda.")
	if len(calls) != 0 {
		t.Fatalf("unexpected calls %+v", calls)
	}
}
