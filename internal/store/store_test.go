package store

import (
	"path/filepath"
	"testing"

	"pilot-ide/internal/ai"
)

func TestEncryptRoundTrip(t *testing.T) {
	enc, err := Encrypt("secret-key")
	if err != nil {
		t.Fatal(err)
	}
	if enc == "secret-key" || enc == "" {
		t.Fatal("expected ciphertext")
	}
	plain, err := Decrypt(enc)
	if err != nil {
		t.Fatal(err)
	}
	if plain != "secret-key" {
		t.Fatalf("got %q", plain)
	}
}

func TestStorePersistsSettingsAndChat(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "pilot.db")
	s, err := Open(path)
	if err != nil {
		t.Fatal(err)
	}
	defer s.Close()

	if err := s.SaveMode(ai.ModeCloud); err != nil {
		t.Fatal(err)
	}
	if err := s.SaveGeminiKey("abcd"); err != nil {
		t.Fatal(err)
	}
	if err := s.SaveProjectRoot(`D:\proj`); err != nil {
		t.Fatal(err)
	}
	msgs := []ai.Message{{Role: "user", Content: "hi"}, {Role: "assistant", Content: "hello"}}
	if err := s.ReplaceMessages(msgs); err != nil {
		t.Fatal(err)
	}

	s.Close()
	s2, err := Open(path)
	if err != nil {
		t.Fatal(err)
	}
	defer s2.Close()
	snap, err := s2.Load()
	if err != nil {
		t.Fatal(err)
	}
	if snap.Mode != ai.ModeCloud || snap.GeminiKey != "abcd" || snap.ProjectRoot != `D:\proj` {
		t.Fatalf("settings %+v", snap)
	}
	if len(snap.Messages) != 2 || snap.Messages[1].Content != "hello" {
		t.Fatalf("messages %+v", snap.Messages)
	}
	raw := s2.get(keyGemini)
	if raw == "abcd" {
		t.Fatal("api key stored in plaintext")
	}
}
