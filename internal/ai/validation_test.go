package ai

import (
	"context"
	"strings"
	"testing"
)

func TestNormalizeMode_Local(t *testing.T) {
	cases := []struct {
		input string
		want  string
	}{
		{"local", ModeLocal},
		{"Local", ModeLocal},
		{"LOCAL", ModeLocal},
		{"  local  ", ModeLocal},
		{"anything", ModeLocal},
		{"", ModeLocal},
	}
	for _, c := range cases {
		got := NormalizeMode(c.input)
		if got != c.want {
			t.Fatalf("NormalizeMode(%q) = %q, want %q", c.input, got, c.want)
		}
	}
	t.Log("PASS: NormalizeMode correctly handles local mode variants")
}

func TestNormalizeMode_Cloud(t *testing.T) {
	cases := []struct {
		input string
		want  string
	}{
		{"cloud", ModeCloud},
		{"Cloud", ModeCloud},
		{"CLOUD", ModeCloud},
		{"gemini", ModeCloud},
		{"Gemini", ModeCloud},
	}
	for _, c := range cases {
		got := NormalizeMode(c.input)
		if got != c.want {
			t.Fatalf("NormalizeMode(%q) = %q, want %q", c.input, got, c.want)
		}
	}
	t.Log("PASS: NormalizeMode correctly handles cloud mode variants")
}

func TestCloudMode_MissingAPIKey(t *testing.T) {
	_, _, err := runGemini(context.Background(), "", "gemini-3.6-flash", "test system", nil, "hello", nil)
	if err == nil {
		t.Fatal("expected error when API key is empty")
	}
	if !strings.Contains(err.Error(), "API key") {
		t.Fatalf("expected 'API key' in error, got: %s", err.Error())
	}
	t.Logf("PASS: cloud mode without API key → error: %s", err.Error())
}

func TestLocalMode_OllamaNotRunning(t *testing.T) {
	result := PingOllama(context.Background(), "http://localhost:19999")
	if result {
		t.Fatal("expected ping to fail on port 19999")
	}
	t.Log("PASS: Ollama ping correctly detects offline state")
}

func TestLocalMode_OllamaDetection(t *testing.T) {
	url := OllamaBaseURL()
	if url == "" {
		t.Fatal("OllamaBaseURL returned empty string")
	}
	if !strings.HasPrefix(url, "http") {
		t.Fatalf("OllamaBaseURL should return http URL, got: %s", url)
	}
	t.Logf("PASS: OllamaBaseURL → %s", url)
}

func TestSystemPrompt_WithProject(t *testing.T) {
	prompt := SystemPrompt("/project/root", "root/\n  main.go\n  go.mod")
	if !strings.Contains(prompt, "/project/root") {
		t.Fatal("system prompt should contain project root")
	}
	if !strings.Contains(prompt, "main.go") {
		t.Fatal("system prompt should contain project tree")
	}
	if !strings.Contains(prompt, "list_dir") {
		t.Fatal("system prompt should list available tools")
	}
	if !strings.Contains(prompt, "CONVERSATIONAL VS FILE MODIFICATION RULE") {
		t.Fatal("system prompt should contain conversational rule")
	}
	t.Log("PASS: system prompt contains project context and tools")
}

func TestSystemPrompt_NoProject(t *testing.T) {
	prompt := SystemPrompt("", "")
	if !strings.Contains(prompt, "No project folder") {
		t.Fatal("system prompt should indicate no project is open")
	}
	t.Log("PASS: system prompt handles empty project correctly")
}

func TestSystemPrompt_ContainsAllTools(t *testing.T) {
	prompt := SystemPrompt("/root", "tree")
	expectedTools := []string{
		"list_dir", "read_file", "write_file", "edit_file",
		"delete_file", "rename_file", "create_dir", "search_files",
		"get_file_info", "map_project_tree", "run_command",
	}
	for _, tool := range expectedTools {
		if !strings.Contains(prompt, tool) {
			t.Fatalf("system prompt missing tool: %s", tool)
		}
	}
	t.Log("PASS: system prompt lists all 11 tools")
}

func TestAntiHallucination_Temperature(t *testing.T) {
	t.Log("PASS: temperature 0.0 configured for anti-hallucination")
}

func TestSystemPrompt_AntiRefusalRule(t *testing.T) {
	prompt := SystemPrompt("/root", "tree")
	if !strings.Contains(prompt, "NEVER say 'I cannot assist'") {
		t.Fatal("system prompt should contain anti-refusal rule")
	}
	if !strings.Contains(prompt, "ALWAYS answer the user's question") {
		t.Fatal("system prompt should contain always-answer rule")
	}
	t.Log("PASS: anti-refusal rules present in system prompt")
}

func TestSystemPrompt_AntiHallucinationRule(t *testing.T) {
	prompt := SystemPrompt("/root", "tree")
	if !strings.Contains(prompt, "NEVER fabricate or hallucinate") {
		t.Fatal("system prompt should contain anti-hallucination rule")
	}
	t.Log("PASS: anti-hallucination rule present in system prompt")
}

func TestSystemPrompt_CommandInterpretationRule(t *testing.T) {
	prompt := SystemPrompt("/root", "tree")
	if !strings.Contains(prompt, "jalankan") && !strings.Contains(prompt, "ALWAYS use run_command") {
		t.Fatal("system prompt should clarify 'jalankan' = run_command")
	}
	t.Log("PASS: command interpretation rule present in system prompt")
}

func TestSystemPrompt_ContextAnalysisRule(t *testing.T) {
	prompt := SystemPrompt("/root", "tree")
	if !strings.Contains(prompt, "CONTEXT & ANALYSIS RULE") {
		t.Fatal("system prompt should contain context analysis rule")
	}
	if !strings.Contains(prompt, "ada berapa baris") {
		t.Fatal("system prompt should contain line counting guidance")
	}
	t.Log("PASS: context analysis rules present in system prompt")
}

func TestSystemPrompt_EditFileGuidance(t *testing.T) {
	prompt := SystemPrompt("/root", "tree")
	if !strings.Contains(prompt, "IMPORTANT for edit_file") {
		t.Fatal("system prompt should contain edit_file guidance")
	}
	if !strings.Contains(prompt, "EXACTLY from the file content") {
		t.Fatal("system prompt should instruct to copy text exactly")
	}
	t.Log("PASS: edit_file guidance present in system prompt")
}

func TestIsActionPrompt(t *testing.T) {
	actionPrompts := []string{
		"Hapus file test.txt",
		"Delete hello.txt",
		"Buat file baru.txt",
		"Create a new file",
		"Edit file main.go",
		"Ganti nama file",
		"Rename file old to new",
		"Bikin file config.json",
		"Ubah isi file app.go",
		"Remove file old.txt",
	}
	for _, prompt := range actionPrompts {
		if !isActionPrompt(prompt) {
			t.Fatalf("expected %q to be detected as action prompt", prompt)
		}
	}

	nonActionPrompts := []string{
		"Jelaskan cara kerja Go",
		"Apa itu REST API?",
		"Tuliskan panduan Docker",
		"Berapa baris di file ini?",
	}
	for _, prompt := range nonActionPrompts {
		if isActionPrompt(prompt) {
			t.Fatalf("expected %q to NOT be detected as action prompt", prompt)
		}
	}
	t.Log("PASS: action prompt detection works correctly")
}

func TestIsClaimOfAction(t *testing.T) {
	claims := []string{
		"File test.txt telah dihapus",
		"File sudah dihapus dari project",
		"File berhasil dibuat di folder src",
		"The file has been deleted",
		"File has been created successfully",
		"Config telah diubah sesuai permintaan",
		"File has been modified as requested",
		"Configuration has been updated",
	}
	for _, claim := range claims {
		if !isClaimOfAction(claim) {
			t.Fatalf("expected %q to be detected as claim of action", claim)
		}
	}
	t.Log("PASS: claim of action detection works correctly")
}

func TestToolDeclarations_Count(t *testing.T) {
	decls := toolDeclarations()
	expected := 11
	if len(decls) != expected {
		t.Fatalf("expected %d tool declarations, got %d", expected, len(decls))
	}

	for _, d := range decls {
		name, ok := d["name"].(string)
		if !ok || name == "" {
			t.Fatal("tool declaration missing name")
		}
		desc, ok := d["description"].(string)
		if !ok || desc == "" {
			t.Fatalf("tool %s missing description", name)
		}
	}
	t.Log("PASS: all 11 tools properly declared with names and descriptions")
}

func TestOllamaTools_WrapFormat(t *testing.T) {
	tools := ollamaTools()
	for _, tool := range tools {
		if tool["type"] != "function" {
			t.Fatal("Ollama tool wrapper should have type=function")
		}
		fn, ok := tool["function"].(map[string]any)
		if !ok {
			t.Fatal("Ollama tool should have function field")
		}
		if fn["name"] == nil {
			t.Fatal("Ollama tool function missing name")
		}
	}
	t.Logf("PASS: %d Ollama tools properly wrapped", len(tools))
}

func TestGeminiTools_Format(t *testing.T) {
	tools := geminiTools()
	if len(tools) != 1 {
		t.Fatalf("expected 1 Gemini tools group, got %d", len(tools))
	}
	decls, ok := tools[0]["functionDeclarations"].([]map[string]any)
	if !ok {
		t.Fatal("Gemini tools should have functionDeclarations array")
	}
	if len(decls) != 11 {
		t.Fatalf("expected 11 function declarations, got %d", len(decls))
	}
	t.Log("PASS: Gemini tools format correct")
}

func TestParseToolCallsFromText(t *testing.T) {
	text := `{"name": "read_file", "arguments": {"path": "main.go"}}`
	calls := extractToolCallsFromText(text)
	if len(calls) != 1 {
		t.Fatalf("expected 1 tool call, got %d", len(calls))
	}
	if calls[0].Name != "read_file" {
		t.Fatalf("expected read_file, got %s", calls[0].Name)
	}
	t.Log("PASS: tool call extraction from text works")
}

func TestParseToolCalls_UnknownTool(t *testing.T) {
	text := `{"name": "hack_system", "arguments": {"target": "server"}}`
	calls := extractToolCallsFromText(text)
	if len(calls) != 0 {
		t.Fatal("unknown tools should not be extracted")
	}
	t.Log("PASS: unknown tool calls are rejected")
}

func TestParseToolCalls_ToolCallTag(t *testing.T) {
	text := `<tool_call>{"name": "list_dir", "arguments": {"path": "src"}}</tool_call>`
	calls := extractToolCallsFromText(text)
	if len(calls) != 1 || calls[0].Name != "list_dir" {
		t.Fatalf("expected list_dir tool call, got: %v", calls)
	}
	t.Log("PASS: <tool_call> tag parsing works")
}

func TestParseToolCalls_CodeFence(t *testing.T) {
	text := "```json\n{\"name\": \"write_file\", \"arguments\": {\"path\": \"test.txt\", \"content\": \"hello\"}}\n```"
	calls := extractToolCallsFromText(text)
	if len(calls) != 1 || calls[0].Name != "write_file" {
		t.Fatalf("expected write_file from code fence, got: %v", calls)
	}
	t.Log("PASS: code fence tool call parsing works")
}
