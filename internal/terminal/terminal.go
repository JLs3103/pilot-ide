package terminal

import (
	"bytes"
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"time"
)

const defaultTimeout = 2 * time.Minute

type Result struct {
	Stdout   string `json:"stdout"`
	Stderr   string `json:"stderr"`
	ExitCode int    `json:"exitCode"`
	Cwd      string `json:"cwd"`
}

const (
	ShellPowerShell = "powershell"
	ShellCMD        = "cmd"
	ShellBash       = "bash"
)

func DefaultShell() string {
	if runtime.GOOS == "windows" {
		return ShellPowerShell
	}
	return ShellBash
}

func AvailableShells() []string {
	if runtime.GOOS == "windows" {
		shells := []string{ShellPowerShell, ShellCMD}
		if _, err := exec.LookPath("bash"); err == nil {
			shells = append(shells, ShellBash)
		}
		return shells
	}
	return []string{ShellBash}
}

func ResolveCd(currentDir, target string) (string, error) {
	target = strings.TrimSpace(target)
	target = strings.Trim(target, "\"'`")

	if target == "" || target == "~" {
		home, err := os.UserHomeDir()
		if err != nil {
			return currentDir, nil
		}
		return home, nil
	}

	if len(target) == 2 && target[1] == ':' {
		target = target + string(os.PathSeparator)
	}

	var newDir string
	if filepath.IsAbs(target) {
		newDir = filepath.Clean(target)
	} else {
		newDir = filepath.Clean(filepath.Join(currentDir, target))
	}

	info, err := os.Stat(newDir)
	if err != nil {
		return "", fmt.Errorf("cd : Cannot find path '%s' because it does not exist.", target)
	}
	if !info.IsDir() {
		return "", fmt.Errorf("cd : '%s' is not a directory.", target)
	}

	return newDir, nil
}

func HandleCd(command, currentDir, shell string) (Result, bool) {
	trimmed := strings.TrimSpace(command)
	lower := strings.ToLower(trimmed)

	var target string
	isCd := false

	if len(trimmed) == 2 && trimmed[1] == ':' {
		isCd = true
		target = trimmed + string(os.PathSeparator)
	} else if lower == "cd" || lower == "chdir" {
		isCd = true
		if shell == ShellCMD {
			return Result{Stdout: currentDir + "\n", ExitCode: 0, Cwd: currentDir}, true
		}
		target = "~"
	} else if strings.HasPrefix(lower, "cd /d ") {
		isCd = true
		target = strings.TrimSpace(trimmed[6:])
	} else if strings.HasPrefix(lower, "cd..") {
		isCd = true
		target = ".." + trimmed[4:]
	} else if strings.HasPrefix(lower, "cd\\") {
		isCd = true
		target = "\\" + trimmed[3:]
	} else if strings.HasPrefix(lower, "cd/") {
		isCd = true
		target = "/" + trimmed[3:]
	} else if strings.HasPrefix(lower, "cd ") || strings.HasPrefix(lower, "cd\t") {
		isCd = true
		target = strings.TrimSpace(trimmed[3:])
	} else if strings.HasPrefix(lower, "chdir ") {
		isCd = true
		target = strings.TrimSpace(trimmed[6:])
	} else if strings.HasPrefix(lower, "set-location ") || strings.HasPrefix(lower, "sl ") {
		isCd = true
		parts := strings.Fields(trimmed)
		if len(parts) > 1 {
			target = strings.TrimSpace(strings.Join(parts[1:], " "))
		} else {
			target = "~"
		}
	}

	if !isCd {
		return Result{}, false
	}

	newDir, err := ResolveCd(currentDir, target)
	if err != nil {
		return Result{
			Stderr:   err.Error() + "\n",
			ExitCode: 1,
			Cwd:      currentDir,
		}, true
	}

	return Result{
		Stdout:   "",
		Stderr:   "",
		ExitCode: 0,
		Cwd:      newDir,
	}, true
}

func CompletePath(baseDir, pathInput string, dirsOnly bool) ([]string, error) {
	pathInput = strings.TrimSpace(pathInput)
	pathInput = strings.Trim(pathInput, "\"'`")

	sep := "/"
	if strings.Contains(pathInput, "\\") {
		sep = "\\"
	}

	var dirPart, filePrefix string
	lastSlash := strings.LastIndexAny(pathInput, "/\\")
	if lastSlash != -1 {
		dirPart = pathInput[:lastSlash+1]
		filePrefix = pathInput[lastSlash+1:]
	} else {
		dirPart = ""
		filePrefix = pathInput
	}

	var targetDir string
	if dirPart == "" {
		targetDir = baseDir
	} else if filepath.IsAbs(dirPart) {
		targetDir = filepath.Clean(dirPart)
	} else if strings.HasPrefix(dirPart, "~") {
		home, err := os.UserHomeDir()
		if err != nil {
			targetDir = baseDir
		} else {
			targetDir = filepath.Join(home, dirPart[1:])
		}
	} else {
		targetDir = filepath.Join(baseDir, dirPart)
	}

	if len(targetDir) == 2 && targetDir[1] == ':' {
		targetDir = targetDir + string(os.PathSeparator)
	}

	entries, err := os.ReadDir(targetDir)
	if err != nil {
		return nil, err
	}

	var results []string
	prefixLower := strings.ToLower(filePrefix)

	for _, e := range entries {
		if dirsOnly && !e.IsDir() {
			continue
		}
		name := e.Name()
		if filePrefix == "" || strings.HasPrefix(strings.ToLower(name), prefixLower) {
			suffix := ""
			if e.IsDir() {
				suffix = sep
			}
			results = append(results, dirPart+name+suffix)
		}
	}

	if dirsOnly && (filePrefix == "" || strings.HasPrefix("..", prefixLower)) && dirPart == "" {
		results = append([]string{".." + sep}, results...)
	}

	return results, nil
}

func OpenExternal(shell, cwd string) error {
	if cwd == "" {
		cwd = "."
	}

	if runtime.GOOS == "windows" {
		switch shell {
		case ShellPowerShell:
			cmd := exec.Command("cmd", "/c", "start", "powershell", "-NoExit", "-Command", fmt.Sprintf("Set-Location -LiteralPath '%s'", cwd))
			return cmd.Start()
		case ShellCMD:
			cmd := exec.Command("cmd", "/c", "start", "cmd", "/k", fmt.Sprintf("cd /d \"%s\"", cwd))
			return cmd.Start()
		case ShellBash:
			if _, err := exec.LookPath("git-bash"); err == nil {
				cmd := exec.Command("cmd", "/c", "start", "git-bash", fmt.Sprintf("--cd=%s", cwd))
				return cmd.Start()
			}
			cmd := exec.Command("cmd", "/c", "start", "bash")
			return cmd.Start()
		default:
			cmd := exec.Command("cmd", "/c", "start", "powershell", "-NoExit", "-Command", fmt.Sprintf("Set-Location -LiteralPath '%s'", cwd))
			return cmd.Start()
		}
	}

	return exec.Command("sh", "-c", fmt.Sprintf("cd '%s' && $SHELL", cwd)).Start()
}

func Run(cwd, command string) (Result, error) {
	return RunWithShell(cwd, command, "")
}

func RunWithShell(cwd, command, shell string) (Result, error) {
	ctx, cancel := context.WithTimeout(context.Background(), defaultTimeout)
	defer cancel()

	return RunWithContext(ctx, cwd, command, shell)
}

func RunWithContext(ctx context.Context, cwd, command, shell string) (Result, error) {
	if res, handled := HandleCd(command, cwd, shell); handled {
		return res, nil
	}

	var cmd *exec.Cmd

	if shell == "" {
		shell = DefaultShell()
	}

	switch shell {
	case ShellPowerShell:
		psExe := "powershell"
		if _, err := exec.LookPath("pwsh"); err == nil {
			psExe = "pwsh"
		}
		cmd = exec.CommandContext(ctx, psExe, "-NoProfile", "-Command", command)
	case ShellCMD:
		cmd = exec.CommandContext(ctx, "cmd", "/c", command)
	case ShellBash:
		cmd = exec.CommandContext(ctx, "bash", "-c", command)
	default:
		return Result{Cwd: cwd}, fmt.Errorf("unsupported shell: %s", shell)
	}

	cmd.Dir = cwd

	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	err := cmd.Run()
	result := Result{
		Stdout: stdout.String(),
		Stderr: stderr.String(),
		Cwd:    cwd,
	}
	if cmd.ProcessState != nil {
		result.ExitCode = cmd.ProcessState.ExitCode()
	}
	if ctx.Err() == context.DeadlineExceeded {
		return result, ctx.Err()
	}
	if err != nil && result.ExitCode == 0 {
		return result, err
	}
	return result, nil
}
