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

type geminiRequest struct {
	SystemInstruction *geminiContent  `json:"system_instruction,omitempty"`
	Contents          []geminiContent `json:"contents"`
}

type geminiContent struct {
	Role  string       `json:"role,omitempty"`
	Parts []geminiPart `json:"parts"`
}

type geminiPart struct {
	Text string `json:"text"`
}

type geminiResponse struct {
	Candidates []struct {
		Content struct {
			Parts []struct {
				Text string `json:"text"`
			} `json:"parts"`
		} `json:"content"`
	} `json:"candidates"`
	Error *struct {
		Code    int    `json:"code"`
		Message string `json:"message"`
		Status  string `json:"status"`
	} `json:"error"`
}

func ChatGemini(ctx context.Context, apiKey, model, system string, history []Message, userText string) (string, error) {
	if strings.TrimSpace(apiKey) == "" {
		return "", fmt.Errorf("Gemini API key is not set")
	}
	ctx, cancel := context.WithTimeout(ctx, 2*time.Minute)
	defer cancel()

	contents := make([]geminiContent, 0, len(history)+1)
	for _, m := range history {
		role := "user"
		if m.Role == "assistant" {
			role = "model"
		} else if m.Role != "user" {
			continue
		}
		contents = append(contents, geminiContent{
			Role:  role,
			Parts: []geminiPart{{Text: m.Content}},
		})
	}
	contents = append(contents, geminiContent{
		Role:  "user",
		Parts: []geminiPart{{Text: userText}},
	})

	payload := geminiRequest{
		SystemInstruction: &geminiContent{Parts: []geminiPart{{Text: system}}},
		Contents:          contents,
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return "", err
	}

	url := fmt.Sprintf("https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent", model)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-goog-api-key", apiKey)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		if ctx.Err() == context.DeadlineExceeded {
			return "", fmt.Errorf("Gemini timed out")
		}
		return "", fmt.Errorf("Gemini request failed: %w", err)
	}
	defer resp.Body.Close()
	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}

	var parsed geminiResponse
	if err := json.Unmarshal(raw, &parsed); err != nil {
		return "", fmt.Errorf("Gemini returned invalid JSON: %s", trimBody(raw))
	}
	if parsed.Error != nil && parsed.Error.Message != "" {
		return "", fmt.Errorf("Gemini: %s", parsed.Error.Message)
	}
	if resp.StatusCode >= 300 {
		return "", fmt.Errorf("Gemini HTTP %d: %s", resp.StatusCode, trimBody(raw))
	}

	var b strings.Builder
	for _, c := range parsed.Candidates {
		for _, p := range c.Content.Parts {
			b.WriteString(p.Text)
		}
	}
	text := strings.TrimSpace(b.String())
	if text == "" {
		return "", emptyReply(ModeCloud, model)
	}
	return text, nil
}
