package ai

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"pilot-ide/internal/agent"
)

type ollamaChatRequest struct {
	Model    string           `json:"model"`
	Messages []ollamaMsg      `json:"messages"`
	Stream   bool             `json:"stream"`
	Tools    []map[string]any `json:"tools,omitempty"`
}

type ollamaMsg struct {
	Role      string           `json:"role"`
	Content   string           `json:"content,omitempty"`
	ToolCalls []ollamaToolCall `json:"tool_calls,omitempty"`
	ToolName  string           `json:"tool_name,omitempty"`
}

type ollamaToolCall struct {
	Type     string `json:"type,omitempty"`
	Function struct {
		Name      string `json:"name"`
		Arguments any    `json:"arguments"`
	} `json:"function"`
}

type ollamaChatResponse struct {
	Message ollamaMsg `json:"message"`
	Error   string    `json:"error"`
}

func PingOllama(ctx context.Context, baseURL string) bool {
	ctx, cancel := context.WithTimeout(ctx, 800*time.Millisecond)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, strings.TrimRight(baseURL, "/")+"/api/tags", nil)
	if err != nil {
		return false
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return false
	}
	defer resp.Body.Close()
	return resp.StatusCode >= 200 && resp.StatusCode < 300
}

func runOllama(ctx context.Context, baseURL, model, system string, history []Message, userText string, exec func(ToolCall) (string, agent.Action)) (string, []agent.Action, error) {
	msgs := []ollamaMsg{{Role: "system", Content: system}}
	for _, m := range history {
		role := m.Role
		if role != "user" && role != "assistant" {
			continue
		}
		msgs = append(msgs, ollamaMsg{Role: role, Content: m.Content})
	}
	msgs = append(msgs, ollamaMsg{Role: "user", Content: userText})

	var actions []agent.Action
	for round := 0; round < maxToolRounds; round++ {
		turn, rawMsg, err := ollamaGenerate(ctx, baseURL, model, msgs, true)
		if err != nil && looksLikeNoTools(err) {
			text, _, fallbackErr := ollamaGenerate(ctx, baseURL, model, msgs, false)
			if fallbackErr != nil {
				return "", actions, err
			}
			out := strings.TrimSpace(text.Text)
			if out == "" {
				return "", actions, emptyReply(ModeLocal, model)
			}
			return out, actions, nil
		}
		if err != nil {
			return "", actions, err
		}
		if len(turn.ToolCalls) == 0 {
			text := strings.TrimSpace(turn.Text)
			if text == "" {
				return "", actions, emptyReply(ModeLocal, model)
			}
			return text, actions, nil
		}

		msgs = append(msgs, rawMsg)
		for _, call := range turn.ToolCalls {
			out, action := exec(call)
			actions = append(actions, action)
			name := call.Name
			msgs = append(msgs, ollamaMsg{Role: "tool", Content: out, ToolName: name})
		}
	}
	return "", actions, stopAfterTools(actions, model)
}

func ollamaGenerate(ctx context.Context, baseURL, model string, msgs []ollamaMsg, withTools bool) (modelTurn, ollamaMsg, error) {
	callCtx, cancel := context.WithTimeout(ctx, 3*time.Minute)
	defer cancel()

	payload := ollamaChatRequest{
		Model:    model,
		Messages: msgs,
		Stream:   false,
	}
	if withTools {
		payload.Tools = ollamaTools()
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return modelTurn{}, ollamaMsg{}, err
	}

	endpoint := strings.TrimRight(baseURL, "/") + "/api/chat"
	req, err := http.NewRequestWithContext(callCtx, http.MethodPost, endpoint, bytes.NewReader(body))
	if err != nil {
		return modelTurn{}, ollamaMsg{}, err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		if callCtx.Err() == context.DeadlineExceeded {
			return modelTurn{}, ollamaMsg{}, fmt.Errorf("Ollama timed out. Is model %s pulled and running?", model)
		}
		return modelTurn{}, ollamaMsg{}, fmt.Errorf("Ollama is not reachable at %s. Start Ollama, then run: ollama pull %s", baseURL, model)
	}
	defer resp.Body.Close()
	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		return modelTurn{}, ollamaMsg{}, err
	}

	var parsed ollamaChatResponse
	if err := json.Unmarshal(raw, &parsed); err != nil {
		return modelTurn{}, ollamaMsg{}, fmt.Errorf("Ollama returned invalid JSON: %s", trimBody(raw))
	}
	if parsed.Error != "" {
		return modelTurn{}, ollamaMsg{}, fmt.Errorf("Ollama: %s", parsed.Error)
	}
	if resp.StatusCode >= 300 {
		return modelTurn{}, ollamaMsg{}, fmt.Errorf("Ollama HTTP %d: %s", resp.StatusCode, trimBody(raw))
	}

	turn := modelTurn{Text: parsed.Message.Content}
	for _, call := range parsed.Message.ToolCalls {
		turn.ToolCalls = append(turn.ToolCalls, ToolCall{
			Name: call.Function.Name,
			Args: parseArgs(call.Function.Arguments),
		})
	}
	if len(turn.ToolCalls) == 0 {
		if extracted := extractToolCallsFromText(parsed.Message.Content); len(extracted) > 0 {
			turn.ToolCalls = extracted
			turn.Text = ""
			parsed.Message.Content = ""
			parsed.Message.ToolCalls = toOllamaToolCalls(extracted)
		}
	}
	return turn, parsed.Message, nil
}

func toOllamaToolCalls(calls []ToolCall) []ollamaToolCall {
	out := make([]ollamaToolCall, 0, len(calls))
	for _, c := range calls {
		item := ollamaToolCall{Type: "function"}
		item.Function.Name = c.Name
		item.Function.Arguments = c.Args
		out = append(out, item)
	}
	return out
}

func looksLikeNoTools(err error) bool {
	msg := strings.ToLower(err.Error())
	return strings.Contains(msg, "does not support tools") ||
		strings.Contains(msg, "tool support") ||
		strings.Contains(msg, "no tool")
}

func trimBody(raw []byte) string {
	s := strings.TrimSpace(string(raw))
	if len(s) > 400 {
		return s[:400] + "…"
	}
	return s
}
