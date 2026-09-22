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

type geminiRequest struct {
	SystemInstruction *geminiContent   `json:"system_instruction,omitempty"`
	Contents          []geminiContent  `json:"contents"`
	Tools             []map[string]any `json:"tools,omitempty"`
}

type geminiContent struct {
	Role  string       `json:"role,omitempty"`
	Parts []geminiPart `json:"parts"`
}

type geminiPart struct {
	Text             string               `json:"text,omitempty"`
	ThoughtSignature json.RawMessage      `json:"thoughtSignature,omitempty"`
	FunctionCall     *geminiFunctionCall  `json:"functionCall,omitempty"`
	FunctionResponse *geminiFunctionReply `json:"functionResponse,omitempty"`
}

type geminiFunctionCall struct {
	Name             string          `json:"name"`
	Args             map[string]any  `json:"args"`
	ThoughtSignature json.RawMessage `json:"thoughtSignature,omitempty"`
}

type geminiFunctionReply struct {
	Name     string         `json:"name"`
	Response map[string]any `json:"response"`
}

type geminiResponse struct {
	Candidates []struct {
		Content geminiContent `json:"content"`
	} `json:"candidates"`
	Error *struct {
		Code    int    `json:"code"`
		Message string `json:"message"`
		Status  string `json:"status"`
	} `json:"error"`
}

func runGemini(ctx context.Context, apiKey, model, system string, history []Message, userText string, exec func(ToolCall) (string, agent.Action)) (string, []agent.Action, error) {
	if strings.TrimSpace(apiKey) == "" {
		return "", nil, fmt.Errorf("Gemini API key is not set")
	}

	contents := make([]geminiContent, 0, len(history)+2)
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

	var actions []agent.Action
	for round := 0; round < maxToolRounds; round++ {
		turn, err := geminiGenerate(ctx, apiKey, model, system, contents)
		if err != nil {
			return "", actions, err
		}
		if len(turn.ToolCalls) == 0 {
			text := strings.TrimSpace(turn.Text)
			if text == "" {
				return "", actions, emptyReply(ModeCloud, model)
			}
			return text, actions, nil
		}

		replyParts := make([]geminiPart, 0, len(turn.ToolCalls))
		for _, call := range turn.ToolCalls {
			out, action := exec(call)
			actions = append(actions, action)
			payload := map[string]any{"output": out}
			if !action.OK {
				payload = map[string]any{"error": action.Error}
			}
			replyParts = append(replyParts, geminiPart{
				FunctionResponse: &geminiFunctionReply{Name: call.Name, Response: payload},
			})
		}
		modelContent := geminiContent{Role: "model"}
		if turn.GeminiContent != nil && hasNativeFunctionCall(turn.GeminiContent) {
			modelContent = *turn.GeminiContent
			if modelContent.Role == "" {
				modelContent.Role = "model"
			}
		} else {
			for _, call := range turn.ToolCalls {
				modelContent.Parts = append(modelContent.Parts, geminiPart{
					FunctionCall: &geminiFunctionCall{Name: call.Name, Args: call.Args},
				})
			}
		}
		contents = append(contents,
			modelContent,
			geminiContent{Role: "user", Parts: replyParts},
		)
	}
	return "", actions, stopAfterTools(actions, model)
}

func geminiGenerate(ctx context.Context, apiKey, model, system string, contents []geminiContent) (modelTurn, error) {
	callCtx, cancel := context.WithTimeout(ctx, 2*time.Minute)
	defer cancel()

	payload := geminiRequest{
		SystemInstruction: &geminiContent{Parts: []geminiPart{{Text: system}}},
		Contents:          contents,
		Tools:             geminiTools(),
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return modelTurn{}, err
	}

	url := fmt.Sprintf("https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent", model)
	req, err := http.NewRequestWithContext(callCtx, http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return modelTurn{}, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-goog-api-key", apiKey)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		if callCtx.Err() == context.DeadlineExceeded {
			return modelTurn{}, fmt.Errorf("Gemini timed out")
		}
		return modelTurn{}, fmt.Errorf("Gemini request failed: %w", err)
	}
	defer resp.Body.Close()
	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		return modelTurn{}, err
	}

	var parsed geminiResponse
	if err := json.Unmarshal(raw, &parsed); err != nil {
		return modelTurn{}, fmt.Errorf("Gemini returned invalid JSON: %s", trimBody(raw))
	}
	if parsed.Error != nil && parsed.Error.Message != "" {
		return modelTurn{}, fmt.Errorf("Gemini: %s", parsed.Error.Message)
	}
	if resp.StatusCode >= 300 {
		return modelTurn{}, fmt.Errorf("Gemini HTTP %d: %s", resp.StatusCode, trimBody(raw))
	}
	if len(parsed.Candidates) == 0 {
		return modelTurn{}, emptyReply(ModeCloud, model)
	}

	content := parsed.Candidates[0].Content
	if content.Role == "" {
		content.Role = "model"
	}
	turn := modelTurn{GeminiContent: &content}
	var text strings.Builder
	for _, p := range content.Parts {
		if p.FunctionCall != nil && p.FunctionCall.Name != "" {
			turn.ToolCalls = append(turn.ToolCalls, ToolCall{
				Name: p.FunctionCall.Name,
				Args: parseArgs(p.FunctionCall.Args),
			})
			continue
		}
		text.WriteString(p.Text)
	}
	turn.Text = text.String()
	if len(turn.ToolCalls) == 0 {
		if extracted := extractToolCallsFromText(turn.Text); len(extracted) > 0 {
			turn.ToolCalls = extracted
			turn.Text = ""
		}
	}
	return turn, nil
}

func hasNativeFunctionCall(content *geminiContent) bool {
	if content == nil {
		return false
	}
	for _, p := range content.Parts {
		if p.FunctionCall != nil && p.FunctionCall.Name != "" {
			return true
		}
	}
	return false
}
