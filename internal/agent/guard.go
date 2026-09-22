package agent

import (
	"fmt"
	"regexp"
	"strings"
)

var dangerous = []*regexp.Regexp{
	regexp.MustCompile(`(?i)\brm\s+(-[a-z]*r|-rf|-fr)`),
	regexp.MustCompile(`(?i)\bdel\s+/[sf]`),
	regexp.MustCompile(`(?i)\berase\s+/[sf]`),
	regexp.MustCompile(`(?i)\brmdir\s+/s`),
	regexp.MustCompile(`(?i)\brd\s+/s`),
	regexp.MustCompile(`(?i)remove-item\b.*(-recurse|-re|-force|-f)`),
	regexp.MustCompile(`(?i)\bformat\s+[a-z]:`),
	regexp.MustCompile(`(?i)\bmkfs\b`),
	regexp.MustCompile(`(?i)\bdiskpart\b`),
	regexp.MustCompile(`(?i)\bshutdown\b`),
	regexp.MustCompile(`(?i)\breboot\b`),
	regexp.MustCompile(`(?i)\breg\s+delete\b`),
	regexp.MustCompile(`(?i)\bcipher\s+/w`),
	regexp.MustCompile(`(?i)invoke-expression\b`),
	regexp.MustCompile(`(?i)\biex\b`),
	regexp.MustCompile(`(?i)\b(curl|wget|iwr|invoke-webrequest).+\|\s*(sh|bash|cmd|powershell|iex)`),
	regexp.MustCompile(`(?i)\bdrop\s+(database|table)\b`),
}

func RejectDangerousCommand(command string) error {
	trimmed := strings.TrimSpace(command)
	if trimmed == "" {
		return fmt.Errorf("command is empty")
	}
	for _, re := range dangerous {
		if re.MatchString(trimmed) {
			return fmt.Errorf("blocked potentially destructive command")
		}
	}
	return nil
}
