package ai

import (
	"encoding/json"
	"regexp"
	"strings"
)

var (
	toolCallTagRe = regexp.MustCompile(`(?s)<tool_call>(.*?)</tool_call>`)
	fenceRe       = regexp.MustCompile("(?s)```(?:json)?\\s*(.*?)```")
)

var knownTools = map[string]struct{}{
	"list_dir":         {},
	"read_file":        {},
	"write_file":       {},
	"delete_file":      {},
	"map_project_tree": {},
	"run_command":      {},
}

func extractToolCallsFromText(text string) []ToolCall {
	trimmed := strings.TrimSpace(text)
	if trimmed == "" {
		return nil
	}
	var calls []ToolCall
	for _, chunk := range toolChunks(trimmed) {
		calls = append(calls, callsFromJSON([]byte(chunk))...)
	}
	return uniqueCalls(calls)
}

func toolChunks(text string) []string {
	var chunks []string
	for _, m := range toolCallTagRe.FindAllStringSubmatch(text, -1) {
		if len(m) > 1 {
			chunks = append(chunks, strings.TrimSpace(m[1]))
		}
	}
	for _, m := range fenceRe.FindAllStringSubmatch(text, -1) {
		if len(m) > 1 {
			chunks = append(chunks, strings.TrimSpace(m[1]))
		}
	}
	chunks = append(chunks, text)
	return chunks
}

func callsFromJSON(raw []byte) []ToolCall {
	raw = []byte(strings.TrimSpace(string(raw)))
	if len(raw) == 0 {
		return nil
	}
	if call, ok := callFromMap(decodeMap(raw)); ok {
		return []ToolCall{call}
	}
	var arr []any
	if err := json.Unmarshal(raw, &arr); err == nil {
		var out []ToolCall
		for _, item := range arr {
			if m, ok := item.(map[string]any); ok {
				if call, ok := callFromMap(m); ok {
					out = append(out, call)
				}
			}
		}
		if len(out) > 0 {
			return out
		}
	}
	decoder := json.NewDecoder(strings.NewReader(string(raw)))
	var out []ToolCall
	for decoder.More() {
		var v any
		if err := decoder.Decode(&v); err != nil {
			break
		}
		if m, ok := v.(map[string]any); ok {
			if call, ok := callFromMap(m); ok {
				out = append(out, call)
			}
		}
	}
	if len(out) > 0 {
		return out
	}
	// Scan for embedded objects when the model wraps JSON in extra words.
	s := string(raw)
	for i, ch := range s {
		if ch != '{' {
			continue
		}
		for j := len(s); j > i+1; j-- {
			if s[j-1] != '}' {
				continue
			}
			if call, ok := callFromMap(decodeMap([]byte(s[i:j]))); ok {
				return []ToolCall{call}
			}
		}
	}
	return nil
}

func decodeMap(raw []byte) map[string]any {
	var m map[string]any
	if err := json.Unmarshal(raw, &m); err != nil {
		return nil
	}
	return m
}

func callFromMap(m map[string]any) (ToolCall, bool) {
	if m == nil {
		return ToolCall{}, false
	}
	if nested, ok := m["function"].(map[string]any); ok {
		if call, ok := callFromMap(nested); ok {
			return call, true
		}
	}
	name := strings.TrimSpace(asString(m["name"]))
	if name == "" {
		return ToolCall{}, false
	}
	if _, ok := knownTools[name]; !ok {
		return ToolCall{}, false
	}
	args := map[string]any{}
	for _, key := range []string{"arguments", "args", "parameters", "input"} {
		if v, exists := m[key]; exists {
			args = parseArgs(v)
			break
		}
	}
	return ToolCall{Name: name, Args: args}, true
}

func asString(v any) string {
	s, _ := v.(string)
	return s
}

func uniqueCalls(calls []ToolCall) []ToolCall {
	if len(calls) <= 1 {
		return calls
	}
	seen := map[string]struct{}{}
	var out []ToolCall
	for _, c := range calls {
		key := c.Name + string(mustJSON(c.Args))
		if _, ok := seen[key]; ok {
			continue
		}
		seen[key] = struct{}{}
		out = append(out, c)
	}
	return out
}

func mustJSON(v any) []byte {
	b, _ := json.Marshal(v)
	return b
}
