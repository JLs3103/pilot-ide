package agent

import (
	"fmt"
	"os"
	"path/filepath"
	"sync"
)

type ActionType string

const (
	ActionCreated  ActionType = "created"
	ActionModified ActionType = "modified"
	ActionDeleted  ActionType = "deleted"
)

type FileSnapshot struct {
	Path            string     `json:"path"`
	OriginalContent string     `json:"originalContent,omitempty"`
	NewContent      string     `json:"newContent,omitempty"`
	Action          ActionType `json:"action"`
	Accepted        *bool      `json:"accepted,omitempty"`
}

type FileChange struct {
	Path            string `json:"path"`
	Action          string `json:"action"`
	OriginalContent string `json:"originalContent,omitempty"`
	NewContent      string `json:"newContent,omitempty"`
}

type SnapshotManager struct {
	mu        sync.Mutex
	turns     map[string][]FileSnapshot
	turnOrder []string
}

func NewSnapshotManager() *SnapshotManager {
	return &SnapshotManager{
		turns: make(map[string][]FileSnapshot),
	}
}

func (sm *SnapshotManager) BeginTurn(turnID string) {
	sm.mu.Lock()
	defer sm.mu.Unlock()
	if _, exists := sm.turns[turnID]; !exists {
		sm.turns[turnID] = nil
		sm.turnOrder = append(sm.turnOrder, turnID)
	}
}

func (sm *SnapshotManager) RecordCreate(turnID, absPath string) {
	sm.mu.Lock()
	defer sm.mu.Unlock()
	sm.turns[turnID] = append(sm.turns[turnID], FileSnapshot{
		Path:   absPath,
		Action: ActionCreated,
	})
}

func (sm *SnapshotManager) RecordModify(turnID, absPath string) {
	original, err := os.ReadFile(absPath)
	sm.mu.Lock()
	defer sm.mu.Unlock()
	snap := FileSnapshot{
		Path:   absPath,
		Action: ActionModified,
	}
	if err == nil {
		snap.OriginalContent = string(original)
	}
	sm.turns[turnID] = append(sm.turns[turnID], snap)
}

func (sm *SnapshotManager) RecordModifyWithNew(turnID, absPath, newContent string) {
	original, err := os.ReadFile(absPath)
	sm.mu.Lock()
	defer sm.mu.Unlock()
	snap := FileSnapshot{
		Path:       absPath,
		Action:     ActionModified,
		NewContent: newContent,
	}
	if err == nil {
		snap.OriginalContent = string(original)
	}
	sm.turns[turnID] = append(sm.turns[turnID], snap)
}

func (sm *SnapshotManager) RecordDelete(turnID, absPath string) {
	original, err := os.ReadFile(absPath)
	sm.mu.Lock()
	defer sm.mu.Unlock()
	snap := FileSnapshot{
		Path:   absPath,
		Action: ActionDeleted,
	}
	if err == nil {
		snap.OriginalContent = string(original)
	}
	sm.turns[turnID] = append(sm.turns[turnID], snap)
}

func (sm *SnapshotManager) GetPendingChanges(turnID string) []FileChange {
	sm.mu.Lock()
	defer sm.mu.Unlock()
	snaps, ok := sm.turns[turnID]
	if !ok {
		return nil
	}
	var changes []FileChange
	for _, s := range snaps {
		if s.Accepted != nil {
			continue
		}
		fc := FileChange{
			Path:            s.Path,
			Action:          string(s.Action),
			OriginalContent: s.OriginalContent,
		}
		if s.Action != ActionDeleted {
			if s.NewContent != "" {
				fc.NewContent = s.NewContent
			} else if data, err := os.ReadFile(s.Path); err == nil {
				fc.NewContent = string(data)
			}
		}
		changes = append(changes, fc)
	}
	return changes
}

func (sm *SnapshotManager) AcceptAll(turnID string) {
	sm.mu.Lock()
	defer sm.mu.Unlock()
	t := true
	snaps := sm.turns[turnID]
	for i := range snaps {
		if snaps[i].Accepted == nil {
			snaps[i].Accepted = &t
		}
	}
	sm.turns[turnID] = snaps
}

func (sm *SnapshotManager) RejectAll(turnID string) error {
	sm.mu.Lock()
	snaps, ok := sm.turns[turnID]
	if !ok {
		sm.mu.Unlock()
		return fmt.Errorf("unknown turn %s", turnID)
	}
	toRevert := make([]FileSnapshot, 0)
	for i := len(snaps) - 1; i >= 0; i-- {
		if snaps[i].Accepted == nil {
			toRevert = append(toRevert, snaps[i])
		}
	}
	sm.mu.Unlock()

	for _, snap := range toRevert {
		switch snap.Action {
		case ActionCreated:
			_ = os.Remove(snap.Path)
		case ActionModified:
			if snap.OriginalContent != "" {
				_ = os.WriteFile(snap.Path, []byte(snap.OriginalContent), 0o644)
			}
		case ActionDeleted:
			if snap.OriginalContent != "" {
				dir := filepath.Dir(snap.Path)
				_ = os.MkdirAll(dir, 0o755)
				_ = os.WriteFile(snap.Path, []byte(snap.OriginalContent), 0o644)
			}
		}
	}

	sm.mu.Lock()
	f := false
	for i := range snaps {
		if snaps[i].Accepted == nil {
			snaps[i].Accepted = &f
		}
	}
	sm.turns[turnID] = snaps
	sm.mu.Unlock()

	return nil
}

func (sm *SnapshotManager) AcceptFile(turnID, filePath string) {
	sm.mu.Lock()
	defer sm.mu.Unlock()
	t := true
	snaps := sm.turns[turnID]
	for i := range snaps {
		if snaps[i].Path == filePath && snaps[i].Accepted == nil {
			snaps[i].Accepted = &t
			break
		}
	}
}

func (sm *SnapshotManager) RejectFile(turnID, filePath string) error {
	sm.mu.Lock()
	snaps, ok := sm.turns[turnID]
	if !ok {
		sm.mu.Unlock()
		return fmt.Errorf("unknown turn %s", turnID)
	}
	var target *FileSnapshot
	for i := range snaps {
		if snaps[i].Path == filePath && snaps[i].Accepted == nil {
			target = &snaps[i]
			break
		}
	}
	if target == nil {
		sm.mu.Unlock()
		return fmt.Errorf("no pending change for %s in turn %s", filePath, turnID)
	}
	snap := *target
	sm.mu.Unlock()

	switch snap.Action {
	case ActionCreated:
		_ = os.Remove(snap.Path)
	case ActionModified:
		if snap.OriginalContent != "" {
			_ = os.WriteFile(snap.Path, []byte(snap.OriginalContent), 0o644)
		}
	case ActionDeleted:
		if snap.OriginalContent != "" {
			dir := filepath.Dir(snap.Path)
			_ = os.MkdirAll(dir, 0o755)
			_ = os.WriteFile(snap.Path, []byte(snap.OriginalContent), 0o644)
		}
	}

	sm.mu.Lock()
	f := false
	for i := range snaps {
		if snaps[i].Path == filePath && snaps[i].Accepted == nil {
			snaps[i].Accepted = &f
			break
		}
	}
	sm.mu.Unlock()
	return nil
}

func (sm *SnapshotManager) HasPending(turnID string) bool {
	sm.mu.Lock()
	defer sm.mu.Unlock()
	for _, snap := range sm.turns[turnID] {
		if snap.Accepted == nil {
			return true
		}
	}
	return false
}

func (sm *SnapshotManager) GetLatestTurnID() string {
	sm.mu.Lock()
	defer sm.mu.Unlock()
	if len(sm.turnOrder) == 0 {
		return ""
	}
	return sm.turnOrder[len(sm.turnOrder)-1]
}

func (sm *SnapshotManager) Cleanup(keepLast int) {
	sm.mu.Lock()
	defer sm.mu.Unlock()
	if len(sm.turnOrder) <= keepLast {
		return
	}
	toRemove := sm.turnOrder[:len(sm.turnOrder)-keepLast]
	for _, id := range toRemove {
		delete(sm.turns, id)
	}
	sm.turnOrder = sm.turnOrder[len(sm.turnOrder)-keepLast:]
}
