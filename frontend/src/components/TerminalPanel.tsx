import React, {FormEvent, useCallback, useEffect, useRef, useState} from 'react';
import {
    RunCommandWithShell,
    GetAvailableShells,
    GetDefaultShell,
    GetProjectRoot,
    GetTerminalCwd,
    GetPathCompletions,
    KillTerminalCommand,
    OpenExternalTerminal,
} from '../../wailsjs/go/main/App';
import {EventsOn} from '../../wailsjs/runtime/runtime';
import type {CommandResult} from '../types';
import {ChevronDown, Eraser, ExternalLink, Square, Terminal as TerminalIcon, Trash2} from 'lucide-react';
import './TerminalPanel.css';

type ShellType = 'powershell' | 'cmd' | 'bash';

type TerminalLine = {
    type: 'prompt' | 'output' | 'error' | 'command';
    text: string;
    shell?: ShellType;
};

const SHELL_LABELS: Record<ShellType, string> = {
    powershell: 'PowerShell',
    cmd: 'Command Prompt',
    bash: 'Bash',
};

const SHELL_ICONS: Record<ShellType, string> = {
    powershell: 'PS',
    cmd: '>_',
    bash: '$',
};

const COMMON_COMMANDS: Record<ShellType, string[]> = {
    powershell: [
        'Get-ChildItem', 'Set-Location', 'Get-Content', 'Write-Output',
        'New-Item', 'Remove-Item', 'Copy-Item', 'Move-Item',
        'Get-Process', 'Stop-Process', 'Get-Service', 'Start-Service',
        'Invoke-WebRequest', 'Select-Object', 'Where-Object', 'ForEach-Object',
        'npm', 'node', 'git', 'go', 'python', 'pip', 'cargo', 'docker',
        'cd', 'ls', 'dir', 'cls', 'clear', 'cat', 'echo', 'mkdir',
    ],
    cmd: [
        'dir', 'cd', 'cls', 'echo', 'copy', 'move', 'del', 'mkdir', 'rmdir',
        'type', 'ren', 'find', 'findstr', 'set', 'start', 'tasklist', 'taskkill',
        'npm', 'node', 'git', 'go', 'python', 'pip', 'cargo', 'docker',
    ],
    bash: [
        'ls', 'cd', 'pwd', 'cat', 'echo', 'cp', 'mv', 'rm', 'mkdir', 'rmdir',
        'grep', 'find', 'sed', 'awk', 'chmod', 'chown', 'ps', 'kill',
        'curl', 'wget', 'tar', 'zip', 'unzip', 'ssh', 'scp',
        'npm', 'node', 'git', 'go', 'python', 'pip', 'cargo', 'docker',
    ],
};

const CLEAR_COMMANDS = ['clear', 'cls'];

const ANSI_COLOR_MAP: Record<string, string> = {
    '30': '#6c757d',
    '31': '#ff6b6b',
    '32': '#51cf66',
    '33': '#fcc419',
    '34': '#339af0',
    '35': '#cc5de8',
    '36': '#22b8cf',
    '37': '#e8edf4',
    '90': '#868e96',
    '91': '#ff8787',
    '92': '#69db7c',
    '93': '#ffe066',
    '94': '#4dabf7',
    '95': '#da77f2',
    '96': '#38d9a9',
    '97': '#ffffff',
};

function renderAnsi(text: string): React.ReactNode {
    const regex = /(?:\x1b\[|\u001b\[|\[)(\d{1,2}(?:;\d+)*)m/g;
    const parts: React.ReactNode[] = [];
    let lastIdx = 0;
    let currentColor: string | undefined = undefined;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(text)) !== null) {
        if (match.index > lastIdx) {
            const chunk = text.slice(lastIdx, match.index);
            parts.push(
                currentColor ? (
                    <span key={parts.length} style={{ color: currentColor }}>
                        {chunk}
                    </span>
                ) : (
                    chunk
                )
            );
        }
        const code = match[1].split(';')[0];
        if (code === '0' || code === '39') {
            currentColor = undefined;
        } else if (ANSI_COLOR_MAP[code]) {
            currentColor = ANSI_COLOR_MAP[code];
        }
        lastIdx = regex.lastIndex;
    }

    if (lastIdx < text.length) {
        const remaining = text.slice(lastIdx);
        parts.push(
            currentColor ? (
                <span key={parts.length} style={{ color: currentColor }}>
                    {remaining}
                </span>
            ) : (
                remaining
            )
        );
    }

    return parts.length > 0 ? parts : text;
}

function formatPrompt(shell: ShellType, cwd: string): string {
    const path = cwd || '.';
    switch (shell) {
        case 'powershell':
            return `PS ${path}>`;
        case 'cmd':
            return `${path}>`;
        case 'bash': {
            const bashPath = path.replace(/\\/g, '/').replace(/^([A-Z]):/i, (_m, d) => `/mnt/${d.toLowerCase()}`);
            return `user@machine:${bashPath}$`;
        }
    }
}

interface TerminalPanelProps {
    projectRoot?: string | null;
    onClose?: () => void;
}

export function TerminalPanel({ projectRoot, onClose }: TerminalPanelProps) {
    const [command, setCommand] = useState('');
    const [lines, setLines] = useState<TerminalLine[]>([]);
    const [busy, setBusy] = useState(false);
    const [shell, setShell] = useState<ShellType>('powershell');
    const [availableShells, setAvailableShells] = useState<ShellType[]>(['powershell']);
    const [showShellMenu, setShowShellMenu] = useState(false);
    const [currentCwd, setCurrentCwd] = useState('');
    const [history, setHistory] = useState<string[]>([]);
    const [historyIndex, setHistoryIndex] = useState(-1);
    const [tabSuggestions, setTabSuggestions] = useState<string[]>([]);
    const [tabCmdPrefix, setTabCmdPrefix] = useState<string>('');
    const [tabIndex, setTabIndex] = useState(-1);
    const [savedInput, setSavedInput] = useState('');

    const logRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const shellMenuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        GetAvailableShells().then((shells: string[]) => {
            setAvailableShells(shells as ShellType[]);
        }).catch(() => {});

        GetDefaultShell().then((def: string) => {
            setShell(def as ShellType);
        }).catch(() => {});

        GetTerminalCwd().then((cwd: string) => {
            if (cwd) {
                setCurrentCwd(cwd);
            } else {
                GetProjectRoot().then((root: string) => {
                    if (root) setCurrentCwd(root);
                }).catch(() => {});
            }
        }).catch(() => {});
    }, []);

    useEffect(() => {
        if (projectRoot) {
            setCurrentCwd(projectRoot);
            setLines([]);
        }
    }, [projectRoot]);

    useEffect(() => {
        const cancel = EventsOn('project:opened', (newDir: string) => {
            if (newDir) {
                setCurrentCwd(newDir);
                setLines([]);
            }
        });
        return () => {
            if (cancel) cancel();
        };
    }, []);

    useEffect(() => {
        const timer = setTimeout(() => {
            inputRef.current?.focus();
        }, 10);
        return () => clearTimeout(timer);
    }, [busy, lines]);

    useEffect(() => {
        if (logRef.current) {
            logRef.current.scrollTop = logRef.current.scrollHeight;
        }
    }, [lines, busy]);

    useEffect(() => {
        function handleClick(e: MouseEvent) {
            if (shellMenuRef.current && !shellMenuRef.current.contains(e.target as Node)) {
                setShowShellMenu(false);
            }
        }
        if (showShellMenu) {
            document.addEventListener('mousedown', handleClick);
            return () => document.removeEventListener('mousedown', handleClick);
        }
    }, [showShellMenu]);

    const setCommandWithCaret = useCallback((newCmd: string, hasQuote: boolean) => {
        setCommand(newCmd);
        if (hasQuote && inputRef.current) {
            const pos = newCmd.length - 1;
            requestAnimationFrame(() => {
                inputRef.current?.focus();
                inputRef.current?.setSelectionRange(pos, pos);
            });
        }
    }, []);

    const clearTerminal = useCallback(() => {
        setLines([]);
    }, []);

    const handleShellChange = useCallback((newShell: ShellType) => {
        setShell(newShell);
        setShowShellMenu(false);
    }, []);

    const handleKill = useCallback(async () => {
        if (!busy) return;
        try {
            await KillTerminalCommand();
            setLines(prev => [...prev, { type: 'error', text: '^C\n' }]);
        } catch {
        } finally {
            setBusy(false);
            inputRef.current?.focus();
        }
    }, [busy]);

    const handleOpenExternal = useCallback(async () => {
        try {
            await OpenExternalTerminal(shell, currentCwd);
        } catch (err) {
            console.error('Failed to open external terminal:', err);
        }
    }, [shell, currentCwd]);

    async function run(event: FormEvent) {
        event.preventDefault();
        const next = command.trim();
        if (!next || busy) {
            return;
        }

        setTabSuggestions([]);
        setTabCmdPrefix('');
        setTabIndex(-1);

        setHistory(prev => {
            const filtered = prev.filter(h => h !== next);
            return [...filtered, next];
        });
        setHistoryIndex(-1);
        setSavedInput('');

        const cmdLower = next.toLowerCase().trim();
        if (CLEAR_COMMANDS.includes(cmdLower)) {
            setCommand('');
            clearTerminal();
            inputRef.current?.focus();
            return;
        }

        setBusy(true);
        const prompt = formatPrompt(shell, currentCwd);

        setLines(prev => [
            ...prev,
            { type: 'prompt', text: prompt, shell },
            { type: 'command', text: next, shell },
        ]);
        setCommand('');

        requestAnimationFrame(() => {
            inputRef.current?.focus();
        });

        try {
            const result = await RunCommandWithShell(next, currentCwd, shell) as CommandResult;

            if (result.cwd && result.cwd !== currentCwd) {
                setCurrentCwd(result.cwd);
            }

            const stdout = result.stdout || '';
            const stderr = result.stderr || '';

            if (stdout) {
                setLines(prev => [...prev, { type: 'output', text: stdout }]);
            }
            if (stderr) {
                setLines(prev => [...prev, { type: 'error', text: stderr }]);
            }
        } catch (err) {
            setLines(prev => [...prev, { type: 'error', text: String(err) + '\n' }]);
        } finally {
            setBusy(false);
            requestAnimationFrame(() => {
                inputRef.current?.focus();
            });
        }
    }

    function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
        if (e.ctrlKey && e.key.toLowerCase() === 'c') {
            if (busy) {
                e.preventDefault();
                void handleKill();
                return;
            }
        }

        if (e.key === 'Tab') {
            e.preventDefault();
            const current = command;

            if (tabSuggestions.length > 0 && tabIndex !== -1) {
                const nextIdx = (tabIndex + 1) % tabSuggestions.length;
                setTabIndex(nextIdx);
                const chosen = tabSuggestions[nextIdx];
                const needsQuote = chosen.includes(' ');
                const formatted = needsQuote ? `"${chosen}"` : chosen;
                setCommandWithCaret(tabCmdPrefix + formatted, needsQuote);
                return;
            }

            const trimmedStart = current.trimStart();
            const lowerStart = trimmedStart.toLowerCase();

            const isCd = lowerStart.startsWith('cd ') ||
                         lowerStart.startsWith('cd\t') ||
                         lowerStart.startsWith('chdir ') ||
                         lowerStart.startsWith('set-location ') ||
                         lowerStart.startsWith('sl ') ||
                         lowerStart.startsWith('cd/d ') ||
                         lowerStart.startsWith('cd\\') ||
                         lowerStart.startsWith('cd/') ||
                         lowerStart === 'cd' ||
                         lowerStart === 'chdir';

            const match = current.match(/^(\s*\S+\s+)(.*)$/);
            const isPathLike = isCd || match !== null || trimmedStart.startsWith('./') || trimmedStart.startsWith('.\\');

            if (isPathLike) {
                let cmdPrefix = '';
                let pathInput = '';

                if (match) {
                    cmdPrefix = match[1];
                    pathInput = match[2].trimStart();
                } else if (isCd && (lowerStart === 'cd' || lowerStart === 'chdir')) {
                    cmdPrefix = current + ' ';
                    pathInput = '';
                } else {
                    const lastSpaceIdx = current.lastIndexOf(' ');
                    if (lastSpaceIdx !== -1) {
                        cmdPrefix = current.slice(0, lastSpaceIdx + 1);
                        pathInput = current.slice(lastSpaceIdx + 1);
                    } else {
                        cmdPrefix = '';
                        pathInput = current;
                    }
                }

                const rawPathInput = pathInput.replace(/^["']/, '');

                GetPathCompletions(currentCwd, rawPathInput, isCd).then((entries: string[]) => {
                    if (!entries || entries.length === 0) return;

                    if (entries.length === 1) {
                        const needsQuote = entries[0].includes(' ');
                        const formatted = needsQuote ? `"${entries[0]}"` : entries[0];
                        setCommandWithCaret(cmdPrefix + formatted, needsQuote);
                        setTabSuggestions([]);
                        setTabIndex(-1);
                    } else {
                        setTabSuggestions(entries);
                        setTabCmdPrefix(cmdPrefix);
                        setTabIndex(0);
                        const needsQuote = entries[0].includes(' ');
                        const formatted = needsQuote ? `"${entries[0]}"` : entries[0];
                        setCommandWithCaret(cmdPrefix + formatted, needsQuote);
                    }
                }).catch(() => {});
            } else {
                const input = current.trim();
                if (!input) return;
                const cmds = COMMON_COMMANDS[shell] || [];
                const matches = cmds.filter(c => c.toLowerCase().startsWith(input.toLowerCase()));

                if (matches.length === 1) {
                    setCommand(matches[0] + ' ');
                    setTabSuggestions([]);
                    setTabIndex(-1);
                } else if (matches.length > 1) {
                    setTabSuggestions(matches);
                    setTabCmdPrefix('');
                    setTabIndex(0);
                    setCommand(matches[0] + ' ');
                }
            }
            return;
        }

        if (e.key !== 'Tab') {
            if (tabSuggestions.length > 0) {
                setTabSuggestions([]);
                setTabCmdPrefix('');
                setTabIndex(-1);
            }
        }

        if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (history.length === 0) return;

            if (historyIndex === -1) {
                setSavedInput(command);
                const lastIdx = history.length - 1;
                setHistoryIndex(lastIdx);
                setCommand(history[lastIdx]);
            } else if (historyIndex > 0) {
                const idx = historyIndex - 1;
                setHistoryIndex(idx);
                setCommand(history[idx]);
            }
            return;
        }

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (historyIndex === -1) return;

            if (historyIndex < history.length - 1) {
                const idx = historyIndex + 1;
                setHistoryIndex(idx);
                setCommand(history[idx]);
            } else {
                setHistoryIndex(-1);
                setCommand(savedInput);
            }
            return;
        }

        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'l') {
            e.preventDefault();
            clearTerminal();
            return;
        }
    }

    const promptText = formatPrompt(shell, currentCwd);

    return (
        <section className="terminal-panel" onClick={() => inputRef.current?.focus()}>
            <header className="terminal-header">
                <div className="terminal-header-left">
                    <TerminalIcon size={14} />
                    <span className="terminal-title">Terminal</span>
                    <div className="shell-selector" ref={shellMenuRef}>
                        <button
                            className="shell-selector-btn"
                            onClick={(e) => { e.stopPropagation(); setShowShellMenu(!showShellMenu); }}
                            title="Select Shell"
                        >
                            <span className={`shell-badge shell-${shell}`}>
                                {SHELL_ICONS[shell]}
                            </span>
                            <span className="shell-label">{SHELL_LABELS[shell]}</span>
                            <ChevronDown size={12} />
                        </button>
                        {showShellMenu && (
                            <div className="shell-dropdown">
                                {availableShells.map(s => (
                                    <button
                                        key={s}
                                        className={`shell-option ${s === shell ? 'active' : ''}`}
                                        onClick={(e) => { e.stopPropagation(); handleShellChange(s); }}
                                    >
                                        <span className={`shell-badge shell-${s}`}>
                                            {SHELL_ICONS[s]}
                                        </span>
                                        <span>{SHELL_LABELS[s]}</span>
                                        {s === shell && <span className="shell-check">✓</span>}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
                <div className="terminal-header-right">
                    {busy && (
                        <button
                            className="terminal-kill-btn"
                            onClick={(e) => { e.stopPropagation(); void handleKill(); }}
                            title="Stop Running Process (Ctrl+C)"
                        >
                            <Square size={11} fill="currentColor" />
                            <span>Stop</span>
                        </button>
                    )}
                    <button
                        className="terminal-native-btn"
                        onClick={(e) => { e.stopPropagation(); void handleOpenExternal(); }}
                        title={`Buka jendela ${SHELL_LABELS[shell]} eksternal di folder ini`}
                    >
                        <ExternalLink size={12} />
                        <span>Buka {SHELL_LABELS[shell]}</span>
                    </button>
                    <button
                        className="terminal-action-btn"
                        onClick={(e) => { e.stopPropagation(); clearTerminal(); }}
                        title="Clear Terminal (Ctrl+L)"
                    >
                        <Eraser size={14} />
                    </button>
                    <button
                        className="terminal-action-btn terminal-delete-btn"
                        onClick={(e) => { e.stopPropagation(); if (onClose) onClose(); }}
                        title="Delete Terminal"
                    >
                        <Trash2 size={14} />
                    </button>
                </div>
            </header>
            <div className="terminal-body" ref={logRef} onClick={() => inputRef.current?.focus()}>
                <div className="terminal-history">
                    {lines.map((line, idx) => {
                        if (line.type === 'prompt') {
                            return (
                                <span key={idx} className={`terminal-prompt-text prompt-${line.shell || shell}`}>
                                    {line.text}
                                </span>
                            );
                        }
                        if (line.type === 'command') {
                            return (
                                <span key={idx} className="terminal-command-text">
                                    {' '}{line.text}{'\n'}
                                </span>
                            );
                        }
                        if (line.type === 'error') {
                            return <span key={idx} className="terminal-error-text">{renderAnsi(line.text)}</span>;
                        }
                        return <span key={idx} className="terminal-output-text">{renderAnsi(line.text)}</span>;
                    })}
                </div>
                <form className="terminal-input-line" onSubmit={(e) => void run(e)}>
                    <span className={`terminal-prompt prompt-${shell}`}>
                        {promptText}
                    </span>
                    <input
                        ref={inputRef}
                        value={command}
                        onChange={(e) => setCommand(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={busy ? 'Running… (Ctrl+C to stop)' : ''}
                        readOnly={busy}
                        autoComplete="off"
                        spellCheck={false}
                        autoFocus
                    />
                </form>
                {tabSuggestions.length > 1 && (
                    <div className="tab-suggestions">
                        {tabSuggestions.map((s, i) => (
                            <span
                                key={s}
                                className={`tab-suggestion ${i === tabIndex ? 'active' : ''}`}
                                onClick={() => {
                                    setTabIndex(i);
                                    const needsQuote = s.includes(' ');
                                    const formatted = needsQuote ? `"${s}"` : s;
                                    setCommandWithCaret(tabCmdPrefix + formatted, needsQuote);
                                    inputRef.current?.focus();
                                }}
                            >
                                {s}
                            </span>
                        ))}
                    </div>
                )}
            </div>
        </section>
    );
}
