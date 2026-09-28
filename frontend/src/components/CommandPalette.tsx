import {useState, useEffect, useRef, useCallback, useMemo} from 'react';
import {
    Save, FolderOpen, X, Search, Replace, Undo, Redo,
    Eye, Terminal, Bot, ZoomIn, ZoomOut, Plus, FileText,
    Scissors, Copy, Clipboard, CheckSquare, Hash, Layers
} from 'lucide-react';
import './CommandPalette.css';

export type PaletteCommand = {
    id: string;
    label: string;
    shortcut?: string;
    icon?: React.ReactNode;
    category?: string;
    action: () => void;
};

type Props = {
    open: boolean;
    onClose: () => void;
    commands: PaletteCommand[];
    mode?: 'command' | 'goto';
    onGoToLine?: (line: number) => void;
};

export function CommandPalette({open, onClose, commands, mode = 'command', onGoToLine}: Props) {
    const [query, setQuery] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (open) {
            setQuery('');
            setTimeout(() => inputRef.current?.focus(), 50);
        }
    }, [open]);

    useEffect(() => {
        if (!open) return;
        function handleEsc(e: KeyboardEvent) {
            if (e.key === 'Escape') {
                e.preventDefault();
                onClose();
            }
        }
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [open, onClose]);

    const filtered = useMemo(() => {
        if (!query.trim()) return commands;
        const q = query.toLowerCase();
        return commands.filter(c =>
            c.label.toLowerCase().includes(q) ||
            (c.category && c.category.toLowerCase().includes(q))
        );
    }, [query, commands]);

    const [selectedIndex, setSelectedIndex] = useState(0);

    useEffect(() => {
        setSelectedIndex(0);
    }, [filtered]);

    const executeCommand = useCallback((cmd: PaletteCommand) => {
        onClose();
        cmd.action();
    }, [onClose]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (mode === 'goto') {
            if (e.key === 'Enter') {
                e.preventDefault();
                const line = parseInt(query);
                if (!isNaN(line) && line > 0 && onGoToLine) {
                    onClose();
                    onGoToLine(line);
                }
            }
            return;
        }

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedIndex(prev => Math.min(prev + 1, filtered.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIndex(prev => Math.max(prev - 1, 0));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (filtered[selectedIndex]) {
                executeCommand(filtered[selectedIndex]);
            }
        }
    }, [filtered, selectedIndex, executeCommand, mode, query, onGoToLine, onClose]);

    if (!open) return null;

    return (
        <div className="palette-overlay" onClick={onClose}>
            <div className="palette-dialog" onClick={e => e.stopPropagation()}>
                <div className="palette-input-row">
                    {mode === 'command' && <span className="palette-prefix">&gt;</span>}
                    {mode === 'goto' && <span className="palette-prefix">:</span>}
                    <input
                        ref={inputRef}
                        className="palette-input"
                        type={mode === 'goto' ? 'number' : 'text'}
                        placeholder={mode === 'goto' ? 'Go to line number...' : 'Type a command...'}
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        onKeyDown={handleKeyDown}
                    />
                </div>
                {mode === 'command' && (
                    <div className="palette-list">
                        {filtered.length === 0 && (
                            <div className="palette-empty">No matching commands</div>
                        )}
                        {filtered.map((cmd, i) => (
                            <button
                                key={cmd.id}
                                type="button"
                                className={`palette-item ${i === selectedIndex ? 'selected' : ''}`}
                                onClick={() => executeCommand(cmd)}
                                onMouseEnter={() => setSelectedIndex(i)}
                            >
                                <span className="palette-item-icon">
                                    {cmd.icon || <FileText size={14} />}
                                </span>
                                <span className="palette-item-label">{cmd.label}</span>
                                {cmd.shortcut && (
                                    <span className="palette-item-shortcut">{cmd.shortcut}</span>
                                )}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

export function buildDefaultCommands(actions: {
    save?: () => void;
    saveAs?: () => void;
    openProject?: () => void;
    closeTab?: () => void;
    newFile?: () => void;
    toggleSidebar?: () => void;
    toggleTerminal?: () => void;
    toggleAiPanel?: () => void;
    find?: () => void;
    replace?: () => void;
    goToLine?: () => void;
    undo?: () => void;
    redo?: () => void;
    cut?: () => void;
    copy?: () => void;
    paste?: () => void;
    selectAll?: () => void;
    zoomIn?: () => void;
    zoomOut?: () => void;
}): PaletteCommand[] {
    const cmds: PaletteCommand[] = [];
    const add = (id: string, label: string, shortcut: string, icon: React.ReactNode, cat: string, action?: () => void) => {
        if (action) cmds.push({id, label, shortcut, icon, category: cat, action});
    };
    add('save', 'File: Save', 'Ctrl+S', <Save size={14} />, 'File', actions.save);
    add('saveAs', 'File: Save As', 'Ctrl+Shift+S', <Save size={14} />, 'File', actions.saveAs);
    add('openProject', 'File: Open Project', 'Ctrl+O', <FolderOpen size={14} />, 'File', actions.openProject);
    add('closeTab', 'File: Close Tab', 'Ctrl+W', <X size={14} />, 'File', actions.closeTab);
    add('newFile', 'File: New File', 'Ctrl+N', <Plus size={14} />, 'File', actions.newFile);
    add('find', 'Edit: Find', 'Ctrl+F', <Search size={14} />, 'Edit', actions.find);
    add('replace', 'Edit: Replace', 'Ctrl+H', <Replace size={14} />, 'Edit', actions.replace);
    add('goToLine', 'Go: Go to Line', 'Ctrl+G', <Hash size={14} />, 'Go', actions.goToLine);
    add('undo', 'Edit: Undo', 'Ctrl+Z', <Undo size={14} />, 'Edit', actions.undo);
    add('redo', 'Edit: Redo', 'Ctrl+Y', <Redo size={14} />, 'Edit', actions.redo);
    add('cut', 'Edit: Cut', 'Ctrl+X', <Scissors size={14} />, 'Edit', actions.cut);
    add('copy', 'Edit: Copy', 'Ctrl+C', <Copy size={14} />, 'Edit', actions.copy);
    add('paste', 'Edit: Paste', 'Ctrl+V', <Clipboard size={14} />, 'Edit', actions.paste);
    add('selectAll', 'Edit: Select All', 'Ctrl+A', <CheckSquare size={14} />, 'Selection', actions.selectAll);
    add('toggleSidebar', 'View: Toggle Sidebar', 'Ctrl+B', <Layers size={14} />, 'View', actions.toggleSidebar);
    add('toggleTerminal', 'View: Toggle Terminal', 'Ctrl+`', <Terminal size={14} />, 'View', actions.toggleTerminal);
    add('toggleAiPanel', 'View: Toggle AI Panel', 'Ctrl+Shift+M', <Bot size={14} />, 'View', actions.toggleAiPanel);
    add('zoomIn', 'View: Zoom In', 'Ctrl++', <ZoomIn size={14} />, 'View', actions.zoomIn);
    add('zoomOut', 'View: Zoom Out', 'Ctrl+-', <ZoomOut size={14} />, 'View', actions.zoomOut);
    return cmds;
}
