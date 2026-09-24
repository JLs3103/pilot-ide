package store

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"pilot-ide/internal/ai"

	_ "modernc.org/sqlite"
)

const (
	keyMode        = "ai_mode"
	keyGemini      = "gemini_key"
	keyProject     = "project_root"
	keyPanelSizes  = "panel_sizes"
)

type Store struct {
	db *sql.DB
}

type Snapshot struct {
	Mode        string
	GeminiKey   string
	ProjectRoot string
	Messages    []ai.Message
	PanelSizes  string
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
CREATE TABLE IF NOT EXISTS chat_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
`)
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

func (s *Store) ReplaceMessages(messages []ai.Message) error {
	if s == nil {
		return nil
	}
	tx, err := s.db.Begin()
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()
	if _, err := tx.Exec(`DELETE FROM chat_messages`); err != nil {
		return err
	}
	now := time.Now().Unix()
	stmt, err := tx.Prepare(`INSERT INTO chat_messages (role, content, created_at) VALUES (?, ?, ?)`)
	if err != nil {
		return err
	}
	defer stmt.Close()
	for i, m := range messages {
		if _, err := stmt.Exec(m.Role, m.Content, now+int64(i)); err != nil {
			return err
		}
	}
	return tx.Commit()
}

func (s *Store) ClearMessages() error {
	if s == nil {
		return nil
	}
	_, err := s.db.Exec(`DELETE FROM chat_messages`)
	return err
}

func (s *Store) Messages() ([]ai.Message, error) {
	if s == nil {
		return nil, nil
	}
	rows, err := s.db.Query(`SELECT role, content FROM chat_messages ORDER BY id ASC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []ai.Message
	for rows.Next() {
		var m ai.Message
		if err := rows.Scan(&m.Role, &m.Content); err != nil {
			return nil, err
		}
		out = append(out, m)
	}
	return out, rows.Err()
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
