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
)

type ollamaChatRequest struct {
	Model    string      `json:"model"`
	Messages []ollamaMsg `json:"messages"`
	Stream   bool        `json:"stream"`
}

type ollamaMsg struct {
	Role    string `json:"role"`
	Content string `json:"content"`
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

func ChatOllama(ctx context.Context, baseURL, model, system string, history []Message, userText string) (string, error) {
	ctx, cancel := context.WithTimeout(ctx, 3*time.Minute)
	defer cancel()

	msgs := []ollamaMsg{{Role: "system", Content: system}}
	for _, m := range history {
		role := m.Role
		if role != "user" && role != "assistant" {
			continue
		}
		msgs = append(msgs, ollamaMsg{Role: role, Content: m.Content})
	}
	msgs = append(msgs, ollamaMsg{Role: "user", Content: userText})

	body, err := json.Marshal(ollamaChatRequest{
		Model:    model,
		Messages: msgs,
		Stream:   false,
	})
	if err != nil {
		return "", err
	}

	endpoint := strings.TrimRight(baseURL, "/") + "/api/chat"
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(body))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		if ctx.Err() == context.DeadlineExceeded {
			return "", fmt.Errorf("Ollama timed out. Is model %s pulled and running?", model)
		}
		return "", fmt.Errorf("Ollama is not reachable at %s. Start Ollama, then run: ollama pull %s", baseURL, model)
	}
	defer resp.Body.Close()
	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}

	var parsed ollamaChatResponse
	if err := json.Unmarshal(raw, &parsed); err != nil {
		return "", fmt.Errorf("Ollama returned invalid JSON: %s", trimBody(raw))
	}
	if parsed.Error != "" {
		return "", fmt.Errorf("Ollama: %s", parsed.Error)
	}
	if resp.StatusCode >= 300 {
		return "", fmt.Errorf("Ollama HTTP %d: %s", resp.StatusCode, trimBody(raw))
	}
	text := strings.TrimSpace(parsed.Message.Content)
	if text == "" {
		return "", emptyReply(ModeLocal, model)
	}
	return text, nil
}

func trimBody(raw []byte) string {
	s := strings.TrimSpace(string(raw))
	if len(s) > 400 {
		return s[:400] + "…"
	}
	return s
}
