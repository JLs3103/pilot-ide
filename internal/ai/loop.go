package ai

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"pilot-ide/internal/agent"
)

const maxToolRounds = 8

type ToolCall struct {
	ID   string
	Name string
	Args map[string]any
}

type modelTurn struct {
	Text          string
	ToolCalls     []ToolCall
	GeminiContent *geminiContent
}

type RunRequest struct {
	Mode     string
	APIKey   string
	Model    string
	System   string
	History  []Message
	User     string
	Root     string
	OnAction func(agent.Action)
}

func Run(ctx context.Context, req RunRequest) (Reply, error) {
	mode := NormalizeMode(req.Mode)
	model := req.Model
	if model == "" {
		if mode == ModeCloud {
			model = DefaultCloudModel
		} else {
			model = DefaultLocalModel
		}
	}

	exec := func(call ToolCall) (string, agent.Action) {
		out, action := agent.Execute(req.Root, call.Name, call.Args)
		if req.OnAction != nil {
			req.OnAction(action)
		}
		return out, action
	}

	var (
		text    string
		actions []agent.Action
		err     error
	)
	if mode == ModeCloud {
		text, actions, err = runGemini(ctx, req.APIKey, model, req.System, req.History, req.User, exec)
	} else {
		text, actions, err = runOllama(ctx, OllamaBaseURL(), model, req.System, req.History, req.User, exec)
	}
	return Reply{Text: text, Mode: mode, Model: model, Actions: actions}, err
}

func parseArgs(raw any) map[string]any {
	switch t := raw.(type) {
	case map[string]any:
		return t
	case string:
		if strings.TrimSpace(t) == "" {
			return map[string]any{}
		}
		var out map[string]any
		if err := json.Unmarshal([]byte(t), &out); err != nil {
			return map[string]any{"_raw": t}
		}
		return out
	default:
		if raw == nil {
			return map[string]any{}
		}
		b, err := json.Marshal(raw)
		if err != nil {
			return map[string]any{}
		}
		var out map[string]any
		_ = json.Unmarshal(b, &out)
		if out == nil {
			return map[string]any{}
		}
		return out
	}
}

func stopAfterTools(actions []agent.Action, model string) error {
	if len(actions) == 0 {
		return fmt.Errorf("%s stopped without a final answer", model)
	}
	return fmt.Errorf("%s reached the tool-call limit before a final answer", model)
}
