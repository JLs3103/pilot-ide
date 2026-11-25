package store

import (
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"pilot-ide/internal/ai"

	_ "modernc.org/sqlite"
)

const (
	keyMode           = "ai_mode"
	keyGemini         = "gemini_key"
	keyProject        = "project_root"
	keyPanelSizes     = "panel_sizes"
	keyOpenTabs       = "open_tabs"
	keyCurrentSession = "current_chat_session"
)

func generateUUID() string {
	b := make([]byte, 16)
	rand.Read(b)
	return hex.EncodeToString(b)
}

type Store struct {
	db *sql.DB
}

type Snapshot struct {
	Mode        string
	GeminiKey   string
	ProjectRoot string
	Messages    []ai.Message
	PanelSizes  string
	OpenTabs    string
}

type ChatSession struct {
	ID          string
	ProjectPath string
	Title       string
	CreatedAt   int64
	UpdatedAt   int64
}

func DefaultPath() (string, error) {
	base, err := os.UserConfigDir()
	if err != nil {
		return "", err
	}
	dir := filepath.Join(base, "pilot-ide")
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return "", err
	}
	return filepath.Join(dir, "pilot.db"), nil
}

func Open(path string) (*Store, error) {
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return nil, err
	}
	db, err := sql.Open("sqlite", path)
	if err != nil {
		return nil, err
	}
	s := &Store{db: db}
	if err := s.migrate(); err != nil {
		_ = db.Close()
		return nil, err
	}
	return s, nil
}

func (s *Store) Close() error {
	if s == nil || s.db == nil {
		return nil
	}
	return s.db.Close()
}

func (s *Store) migrate() error {
	_, err := s.db.Exec(`
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`)
	if err != nil {
		return err
	}

	_, err = s.db.Exec(`
CREATE TABLE IF NOT EXISTS chat_sessions (
  id TEXT PRIMARY KEY,
  project_path TEXT NOT NULL,
  title TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
`)
	if err != nil {
		return err
	}

	rows, err := s.db.Query(`PRAGMA table_info(chat_messages)`)
	if err != nil {
		return err
	}
	defer rows.Close()

	columns := make(map[string]bool)
	for rows.Next() {
		var cid int
		var name, ctype string
		var notnull int
		var dfltValue sql.NullString
		var pk int
		if err := rows.Scan(&cid, &name, &ctype, &notnull, &dfltValue, &pk); err != nil {
			return err
		}
		columns[name] = true
	}
	if err := rows.Err(); err != nil {
		return err
	}

	if !columns["session_id"] {
		_, err = s.db.Exec(`DROP TABLE IF EXISTS chat_messages`)
		if err != nil {
			return err
		}
	}

	_, err = s.db.Exec(`
CREATE TABLE IF NOT EXISTS chat_messages (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE
);
`)
	if err != nil {
		return err
	}

	_, err = s.db.Exec(`CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON chat_messages(session_id)`)
	if err != nil {
		return err
	}

	_, err = s.db.Exec(`CREATE INDEX IF NOT EXISTS idx_chat_sessions_project ON chat_sessions(project_path)`)
	return err
}

func (s *Store) Load() (Snapshot, error) {
	var snap Snapshot
	if s == nil {
		return snap, nil
	}
	snap.Mode = s.get(keyMode)
	if enc := s.get(keyGemini); enc != "" {
		plain, err := Decrypt(enc)
		if err != nil {
			return snap, err
		}
		snap.GeminiKey = plain
	}
	snap.ProjectRoot = s.get(keyProject)
	snap.PanelSizes = s.get(keyPanelSizes)
	snap.OpenTabs = s.get(keyOpenTabs)
	msgs, err := s.Messages()
	if err != nil {
		return snap, err
	}
	snap.Messages = msgs
	return snap, nil
}

func (s *Store) SaveMode(mode string) error {
	return s.set(keyMode, mode)
}

func (s *Store) SaveGeminiKey(plain string) error {
	if plain == "" {
		return s.set(keyGemini, "")
	}
	enc, err := Encrypt(plain)
	if err != nil {
		return err
	}
	return s.set(keyGemini, enc)
}

func (s *Store) SaveProjectRoot(path string) error {
	return s.set(keyProject, path)
}

func (s *Store) SavePanelSizes(sizes string) error {
	return s.set(keyPanelSizes, sizes)
}

func (s *Store) SaveOpenTabs(tabs string) error {
	return s.set(keyOpenTabs, tabs)
}

func (s *Store) ReplaceMessages(messages []ai.Message) error {
	if s == nil {
		return nil
	}
	sessionID := s.GetCurrentSessionID()
	if sessionID == "" {
		return nil
	}
	tx, err := s.db.Begin()
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()
	if _, err := tx.Exec(`DELETE FROM chat_messages WHERE session_id = ?`, sessionID); err != nil {
		return err
	}
	now := time.Now().Unix()
	stmt, err := tx.Prepare(`INSERT INTO chat_messages (id, session_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)`)
	if err != nil {
		return err
	}
	defer stmt.Close()
	for i, m := range messages {
		messageID := generateUUID()
		if _, err := stmt.Exec(messageID, sessionID, m.Role, m.Content, now+int64(i)); err != nil {
			return err
		}
	}
	return tx.Commit()
}

func (s *Store) ClearMessages() error {
	if s == nil {
		return nil
	}
	sessionID := s.GetCurrentSessionID()
	if sessionID == "" {
		return nil
	}
	_, err := s.db.Exec(`DELETE FROM chat_messages WHERE session_id = ?`, sessionID)
	return err
}

func (s *Store) Messages() ([]ai.Message, error) {
	if s == nil {
		return nil, nil
	}
	sessionID := s.GetCurrentSessionID()
	if sessionID == "" {
		return nil, nil
	}
	return s.LoadChatSession(sessionID)
}

func (s *Store) get(key string) string {
	var value string
	err := s.db.QueryRow(`SELECT value FROM settings WHERE key = ?`, key).Scan(&value)
	if err != nil {
		return ""
	}
	return value
}

func (s *Store) set(key, value string) error {
	if s == nil {
		return fmt.Errorf("store is not open")
	}
	_, err := s.db.Exec(`
INSERT INTO settings (key, value) VALUES (?, ?)
ON CONFLICT(key) DO UPDATE SET value = excluded.value
`, key, value)
	return err
}

func (s *Store) Set(key, value string) error {
	return s.set(key, value)
}

func (s *Store) Get(key string) string {
	return s.get(key)
}

// Chat session management methods

func (s *Store) CreateChatSession(projectPath, title string) (string, error) {
	if s == nil {
		return "", fmt.Errorf("store is not open")
	}
	sessionID := generateUUID()
	now := time.Now().Unix()
	_, err := s.db.Exec(`
INSERT INTO chat_sessions (id, project_path, title, created_at, updated_at)
VALUES (?, ?, ?, ?, ?)
`, sessionID, projectPath, title, now, now)
	if err != nil {
		return "", err
	}
	return sessionID, nil
}

func (s *Store) GetChatSessions(projectPath string) ([]ChatSession, error) {
	if s == nil {
		return nil, nil
	}
	rows, err := s.db.Query(`
SELECT id, project_path, title, created_at, updated_at
FROM chat_sessions
WHERE project_path = ?
ORDER BY updated_at DESC
`, projectPath)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var sessions []ChatSession
	for rows.Next() {
		var sess ChatSession
		if err := rows.Scan(&sess.ID, &sess.ProjectPath, &sess.Title, &sess.CreatedAt, &sess.UpdatedAt); err != nil {
			return nil, err
		}
		sessions = append(sessions, sess)
	}
	return sessions, rows.Err()
}

func (s *Store) LoadChatSession(sessionID string) ([]ai.Message, error) {
	if s == nil {
		return nil, nil
	}
	rows, err := s.db.Query(`
SELECT role, content
FROM chat_messages
WHERE session_id = ?
ORDER BY created_at ASC
`, sessionID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var messages []ai.Message
	for rows.Next() {
		var m ai.Message
		if err := rows.Scan(&m.Role, &m.Content); err != nil {
			return nil, err
		}
		messages = append(messages, m)
	}
	return messages, rows.Err()
}

func (s *Store) DeleteChatSession(sessionID string) error {
	if s == nil {
		return nil
	}
	_, err := s.db.Exec(`DELETE FROM chat_sessions WHERE id = ?`, sessionID)
	return err
}

func (s *Store) RenameChatSession(sessionID, newTitle string) error {
	if s == nil {
		return fmt.Errorf("store is not open")
	}
	now := time.Now().Unix()
	_, err := s.db.Exec(`
UPDATE chat_sessions
SET title = ?, updated_at = ?
WHERE id = ?
`, newTitle, now, sessionID)
	return err
}

func (s *Store) AddMessageToSession(sessionID, role, content string) error {
	if s == nil {
		return fmt.Errorf("store is not open")
	}
	messageID := generateUUID()
	now := time.Now().Unix()
	_, err := s.db.Exec(`
INSERT INTO chat_messages (id, session_id, role, content, created_at)
VALUES (?, ?, ?, ?, ?)
`, messageID, sessionID, role, content, now)
	return err
}

func (s *Store) UpdateSessionTimestamp(sessionID string) error {
	if s == nil {
		return nil
	}
	now := time.Now().Unix()
	_, err := s.db.Exec(`
UPDATE chat_sessions
SET updated_at = ?
WHERE id = ?
`, now, sessionID)
	return err
}

func (s *Store) GetCurrentSessionID() string {
	return s.get(keyCurrentSession)
}

func (s *Store) SetCurrentSessionID(sessionID string) error {
	return s.set(keyCurrentSession, sessionID)
}

func (s *Store) ClearCurrentSessionID() error {
	return s.set(keyCurrentSession, "")
}
