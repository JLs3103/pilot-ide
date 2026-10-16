import {FormEvent, useEffect, useRef, useState, useCallback, useMemo} from 'react';
import {
    Chat,
    ClearChat,
    GetAIStatus,
    GetChatHistory,
    SetAIMode,
    SetGeminiAPIKey,
    CancelChat,
    AcceptAllFileChanges,
    RejectAllFileChanges,
    AcceptFileChange,
    RejectFileChange,
    MapProjectTree,
} from '../../wailsjs/go/main/App';
import {EventsOn} from '../../wailsjs/runtime/runtime';
import type {AIStatus, ToolAction, FileChangesEvent, FileChange} from '../types';
import {formatError, reportError} from '../lib/notifications';
import {
    Send,
    Square,
    Trash2,
    Download,
    Settings,
    Loader2,
    Check,
    X,
    Folder,
    File,
    Terminal,
    Sparkles,
    BookOpen,
    MessageSquare,
    Cpu,
    ChevronRight,
    FileText,
} from 'lucide-react';
import {MarkdownRenderer} from './MarkdownRenderer';
import './ChatPanel.css';

type Message = {
    role: 'system' | 'user' | 'assistant' | 'error' | 'tool';
    text: string;
};

type PendingReview = {
    turnID: string;
    changes: FileChange[];
    resolved: boolean;
};

type MentionItem = {
    id: string;
    label: string;
    detail?: string;
    type: 'category' | 'file' | 'dir';
    category?: 'files' | 'dirs' | 'other';
    path?: string;
    disabled?: boolean;
};

function formatAction(action: ToolAction) {
    const status = action.ok ? 'ok' : 'fail';
    const extra = action.error ? ` — ${action.error}` : '';
    return `${action.name} ${action.detail} [${status}]${extra}`;
}

function getFileDisplay(path: string) {
    if (!path) return { filename: 'untitled', dir: '' };
    const clean = path.replace(/\\/g, '/').replace(/\/+$/, '');
    const parts = clean.split('/');
    const filename = parts[parts.length - 1] || path;
    const dir = parts.length > 1 ? parts.slice(0, -1).join('/') : '';
    return { filename, dir };
}

function computeLineDiff(originalContent?: string, newContent?: string, action?: string): { added: number; deleted: number } {
    if (action === 'created') {
        const lines = (newContent || '').split('\n').filter(Boolean).length || 1;
        return { added: lines, deleted: 0 };
    }
    if (action === 'deleted') {
        const lines = (originalContent || '').split('\n').filter(Boolean).length || 1;
        return { added: 0, deleted: lines };
    }
    const origLines = (originalContent || '').split('\n');
    const newLines = (newContent || '').split('\n');
    let added = 0;
    let deleted = 0;
    if (newLines.length > origLines.length) {
        added = newLines.length - origLines.length;
    } else if (origLines.length > newLines.length) {
        deleted = origLines.length - newLines.length;
    } else {
        added = 1;
        deleted = 0;
    }
    return { added: Math.max(added, 1), deleted };
}

function extractFilesAndDirs(node: any): { files: string[]; dirs: string[] } {
    const files: string[] = [];
    const dirs: string[] = [];
    if (!node) return { files, dirs };
    const rootPath = (node.path || '').replace(/\\/g, '/');

    function walk(n: any) {
        if (!n) return;
        const abs = (n.path || '').replace(/\\/g, '/');
        let rel = abs;
        if (rootPath && abs.startsWith(rootPath)) {
            rel = abs.slice(rootPath.length).replace(/^\/+/, '');
        }
        if (rel) {
            if (n.isDir) {
                dirs.push(rel.endsWith('/') ? rel : `${rel}/`);
            } else {
                files.push(rel);
            }
        }
        if (n.children && Array.isArray(n.children)) {
            for (const child of n.children) {
                walk(child);
            }
        }
    }
    walk(node);
    return { files, dirs };
}

function getRichInputText(el: HTMLElement): string {
    let result = '';
    const walk = (node: Node) => {
        if (node.nodeType === Node.TEXT_NODE) {
            result += (node.textContent || '').replace(/\u00A0/g, ' ');
        } else if (node.nodeType === Node.ELEMENT_NODE) {
            const elem = node as HTMLElement;
            if (elem.classList.contains('input-code-pill')) {
                const code = elem.getAttribute('data-code') || elem.textContent || '';
                result += `\`${code}\``;
            } else if (elem.classList.contains('input-mention-pill')) {
                const mention = elem.getAttribute('data-mention') || elem.textContent || '';
                result += mention;
            } else if (elem.tagName === 'BR') {
                result += '\n';
            } else {
                for (const child of Array.from(elem.childNodes)) {
                    walk(child);
                }
                if (elem.tagName === 'DIV' || elem.tagName === 'P') {
                    if (!result.endsWith('\n')) {
                        result += '\n';
                    }
                }
            }
        }
    };
    for (const child of Array.from(el.childNodes)) {
        walk(child);
    }
    return result;
}

export function ChatPanel() {
    const [status, setStatus] = useState<AIStatus | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [hasDraft, setHasDraft] = useState(false);
    const [keyDraft, setKeyDraft] = useState('');
    const [busy, setBusy] = useState(false);
    const [busyLabel, setBusyLabel] = useState('Thinking…');
    const [keySaved, setKeySaved] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [pendingReviews, setPendingReviews] = useState<PendingReview[]>([]);

    const [showMentions, setShowMentions] = useState(false);
    const [mentionQuery, setMentionQuery] = useState('');
    const [mentionCategory, setMentionCategory] = useState<'all' | 'files' | 'dirs'>('all');
    const [mentionSelectedIndex, setMentionSelectedIndex] = useState(0);
    const [cachedFiles, setCachedFiles] = useState<string[]>([]);
    const [cachedDirs, setCachedDirs] = useState<string[]>([]);

    const logRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLDivElement>(null);
    const toolCountRef = useRef(0);

    const loadProjectTree = useCallback(async () => {
        try {
            const tree = await MapProjectTree(6);
            if (tree) {
                const { files, dirs } = extractFilesAndDirs(tree);
                setCachedFiles(files);
                setCachedDirs(dirs);
            }
        } catch {
        }
    }, []);

    async function refreshStatus() {
        const next = await GetAIStatus() as AIStatus;
        setStatus(next);
        if (next.hasGeminiKey) {
            setKeySaved(true);
        }
        return next;
    }

    useEffect(() => {
        void (async () => {
            try {
                const next = await refreshStatus();
                void loadProjectTree();
                const history = await GetChatHistory();
                const restored = (history ?? [])
                    .filter((m) => m.role === 'user' || m.role === 'assistant')
                    .map((m) => ({role: m.role as 'user' | 'assistant', text: m.content}));
                const intro: Message = {
                    role: 'system',
                    text: restored.length
                        ? `Pengaturan dipulihkan dari SQLite. Mode: ${next.mode}. ${next.hasGeminiKey ? 'API key tersimpan di perangkat ini.' : 'API key Gemini belum tersimpan.'}`
                        : (next.ollamaUp
                            ? `Dual-Brain siap. Mode: ${next.mode} (${next.mode === 'cloud' ? next.cloudModel : next.localModel}).`
                            : `Mode Local membutuhkan Ollama di ${next.ollamaURL}. Cloud memakai Gemini ${next.cloudModel} + API key.`),
                };
                setMessages([intro, ...restored]);
            } catch (error) {
                reportError('AI panel initialization failed', error);
                setMessages([{role: 'error', text: `AI panel unavailable: ${formatError(error)}. You can continue editing files.`}]);
            }
        })();
    }, [loadProjectTree]);

    useEffect(() => {
        const offTool = EventsOn('agent:tool', (...data: unknown[]) => {
            const raw = data[0] as ToolAction | undefined;
            if (!raw?.name) {
                return;
            }
            setBusyLabel(`${raw.name} ${raw.detail || ''}`.trim());
            toolCountRef.current += 1;
            setMessages((prev) => [...prev, {role: 'tool', text: formatAction(raw)}]);
        });

        const offChanges = EventsOn('agent:file-changes', (...data: unknown[]) => {
            const event = data[0] as FileChangesEvent | undefined;
            if (!event?.turnID || !event.changes?.length) return;
            setPendingReviews(prev => [
                ...prev,
                {turnID: event.turnID, changes: event.changes, resolved: false},
            ]);
            void loadProjectTree();
        });

        const offFS = EventsOn('fs:changed', () => {
            void loadProjectTree();
        });

        return () => {
            offTool();
            offChanges();
            offFS();
        };
    }, [loadProjectTree]);

    useEffect(() => {
        const el = logRef.current;
        if (el) {
            el.scrollTop = el.scrollHeight;
        }
    }, [messages, busy, busyLabel]);

    async function changeMode(mode: string) {
        try {
            const applied = await SetAIMode(mode);
            const next = await refreshStatus();
            setMessages((prev) => [...prev, {role: 'system', text: applied === 'cloud'
                ? `Mode Cloud: ${next.cloudModel}. ${next.hasGeminiKey ? 'API key tersimpan di perangkat ini.' : 'Masukkan API key lalu Save.'}`
                : `Mode Local: ${next.localModel}. Ollama ${next.ollamaUp ? 'terhubung' : 'tidak terdeteksi'}.`}]);
        } catch (error) {
            reportError('AI mode change failed', error);
            setMessages((prev) => [...prev, {role: 'error', text: `Mode change failed: ${formatError(error)}`}]);
        }
    }

    async function saveKey() {
        const key = keyDraft.trim();
        if (!key) {
            return;
        }
        try {
            await SetGeminiAPIKey(key);
            setKeyDraft('');
            setKeySaved(true);
            await refreshStatus();
        } catch (error) {
            reportError('Gemini API key could not be saved', error);
        }
    }

    async function send(event?: FormEvent) {
        event?.preventDefault();
        const text = inputRef.current ? getRichInputText(inputRef.current).trim() : '';
        if (!text || busy) {
            return;
        }
        setShowMentions(false);
        if (inputRef.current) {
            inputRef.current.innerHTML = '';
        }
        setHasDraft(false);
        setBusy(true);
        setBusyLabel('Thinking…');
        toolCountRef.current = 0;
        setMessages((prev) => [...prev, {role: 'user', text}]);
        try {
            const reply = await Chat(text);
            const extras = toolCountRef.current === 0
                ? (reply.actions ?? []).map((action) => ({role: 'tool' as const, text: formatAction(action)}))
                : [];
            setMessages((prev) => [
                ...prev,
                ...extras,
                {role: 'assistant', text: reply.text || '(empty)'},
            ]);
        } catch (err) {
            const errorMsg = formatError(err);
            const lower = errorMsg.toLowerCase();
            if (lower.includes('cancel')) {
                setMessages((prev) => [...prev, {role: 'system', text: 'Request dibatalkan oleh user.'}]);
            } else {
                reportError('AI request failed', err);
                setMessages((prev) => [...prev, {role: 'error', text: `AI unavailable: ${errorMsg}. Your editor remains available.`}]);
            }
        } finally {
            setBusy(false);
            setBusyLabel('Thinking…');
        }
    }

    async function stopChat() {
        try {
            await CancelChat();
        } catch {
        }
    }

    async function resetChat() {
        try {
            await ClearChat();
            setPendingReviews([]);
            setMessages([{role: 'system', text: 'Riwayat percakapan direset.'}]);
        } catch (error) {
            reportError('Chat reset failed', error);
        }
    }

    async function handleAcceptAll(turnID: string) {
        try {
            await AcceptAllFileChanges(turnID);
            setPendingReviews(prev =>
                prev.map(r => r.turnID === turnID ? {...r, resolved: true} : r)
            );
            setMessages(prev => [...prev, {role: 'system', text: '✓ Semua perubahan file diterima.'}]);
        } catch (error) {
            reportError('Failed to accept changes', error);
        }
    }

    async function handleRejectAll(turnID: string) {
        try {
            await RejectAllFileChanges(turnID);
            setPendingReviews(prev =>
                prev.map(r => r.turnID === turnID ? {...r, resolved: true} : r)
            );
            setMessages(prev => [...prev, {role: 'system', text: '✗ Semua perubahan file di-rollback ke kondisi semula.'}]);
        } catch (error) {
            reportError('Failed to reject changes', error);
        }
    }

    async function handleAcceptFile(turnID: string, filePath: string) {
        try {
            await AcceptFileChange(turnID, filePath);
            setPendingReviews(prev =>
                prev.map(r => {
                    if (r.turnID !== turnID) return r;
                    const remaining = r.changes.filter(c => c.path !== filePath);
                    return {
                        ...r,
                        changes: remaining,
                        resolved: remaining.length === 0,
                    };
                })
            );
            const { filename } = getFileDisplay(filePath);
            setMessages(prev => [...prev, {role: 'system', text: `✓ Perubahan ${filename} diterima.`}]);
        } catch (error) {
            reportError('Failed to accept file change', error);
        }
    }

    async function handleRejectFile(turnID: string, filePath: string) {
        try {
            await RejectFileChange(turnID, filePath);
            setPendingReviews(prev =>
                prev.map(r => {
                    if (r.turnID !== turnID) return r;
                    const remaining = r.changes.filter(c => c.path !== filePath);
                    return {
                        ...r,
                        changes: remaining,
                        resolved: remaining.length === 0,
                    };
                })
            );
            const { filename } = getFileDisplay(filePath);
            setMessages(prev => [...prev, {role: 'system', text: `✗ Perubahan ${filename} di-rollback.`}]);
        } catch (error) {
            reportError('Failed to reject file change', error);
        }
    }

    function exportChat() {
        const text = messages
            .map((m) => `[${m.role.toUpperCase()}] ${m.text}`)
            .join('\n\n');
        const blob = new Blob([text], {type: 'text/plain'});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `pilot-chat-${Date.now()}.txt`;
        a.click();
        URL.revokeObjectURL(url);
    }

    const mentionItems = useMemo<MentionItem[]>(() => {
        const q = mentionQuery.toLowerCase().trim();

        if (mentionCategory === 'files') {
            return cachedFiles
                .filter(f => !q || f.toLowerCase().includes(q))
                .slice(0, 30)
                .map(f => {
                    const { filename } = getFileDisplay(f);
                    return {
                        id: `file:${f}`,
                        label: filename,
                        detail: f,
                        type: 'file',
                        path: f,
                    };
                });
        }

        if (mentionCategory === 'dirs') {
            return cachedDirs
                .filter(d => !q || d.toLowerCase().includes(q))
                .slice(0, 30)
                .map(d => ({
                    id: `dir:${d}`,
                    label: d,
                    type: 'dir',
                    path: d,
                }));
        }

        if (q) {
            const matchedFiles: MentionItem[] = cachedFiles
                .filter(f => f.toLowerCase().includes(q))
                .slice(0, 15)
                .map(f => {
                    const { filename } = getFileDisplay(f);
                    return {
                        id: `file:${f}`,
                        label: filename,
                        detail: f,
                        type: 'file',
                        path: f,
                    };
                });

            const matchedDirs: MentionItem[] = cachedDirs
                .filter(d => d.toLowerCase().includes(q))
                .slice(0, 10)
                .map(d => ({
                    id: `dir:${d}`,
                    label: d,
                    type: 'dir',
                    path: d,
                }));

            return [...matchedFiles, ...matchedDirs];
        }

        return [
            {
                id: 'cat:files',
                label: 'Files',
                detail: 'Search and reference files in project',
                type: 'category',
                category: 'files',
            },
            {
                id: 'cat:dirs',
                label: 'Directories',
                detail: 'Reference folders in workspace',
                type: 'category',
                category: 'dirs',
            },
            {
                id: 'cat:terminal',
                label: 'Terminal',
                detail: 'Active terminal output context',
                type: 'category',
                disabled: true,
            },
            {
                id: 'cat:context',
                label: 'Code Context Items',
                detail: 'Active editor selections',
                type: 'category',
                disabled: true,
            },
            {
                id: 'cat:rules',
                label: 'Rules',
                detail: 'Workspace rules & instructions',
                type: 'category',
                disabled: true,
            },
            {
                id: 'cat:conversation',
                label: 'Conversation',
                detail: 'Prior conversation history',
                type: 'category',
                disabled: true,
            },
            {
                id: 'cat:mcp',
                label: 'MCP Servers',
                detail: 'Model Context Protocol tools',
                type: 'category',
                disabled: true,
            },
        ];
    }, [mentionCategory, mentionQuery, cachedFiles, cachedDirs]);

    function handleInput() {
        const el = inputRef.current;
        if (!el) return;

        if (!el.textContent?.trim() && !el.querySelector('.input-code-pill, .input-mention-pill')) {
            el.innerHTML = '';
        }

        const sel = window.getSelection();
        if (sel && sel.isCollapsed && sel.anchorNode) {
            const node = sel.anchorNode;
            if (node.nodeType === Node.TEXT_NODE) {
                const text = node.textContent || '';
                const offset = sel.anchorOffset;
                const textBefore = text.slice(0, offset);

                const codeMatch = textBefore.match(/`([^`\n\r]+)`$/);
                if (codeMatch && node.parentNode) {
                    const codeText = codeMatch[1];
                    const matchStart = offset - codeMatch[0].length;
                    const beforeMatch = text.slice(0, matchStart);
                    const afterMatch = text.slice(offset);

                    const pill = document.createElement('span');
                    pill.className = 'input-code-pill';
                    pill.contentEditable = 'false';
                    pill.setAttribute('data-code', codeText);
                    pill.textContent = codeText;

                    const spaceNode = document.createTextNode('\u00A0');
                    const parent = node.parentNode;

                    const frag = document.createDocumentFragment();
                    if (beforeMatch) frag.appendChild(document.createTextNode(beforeMatch));
                    frag.appendChild(pill);
                    frag.appendChild(spaceNode);
                    if (afterMatch) frag.appendChild(document.createTextNode(afterMatch));

                    parent.replaceChild(frag, node);

                    const range = document.createRange();
                    range.setStartAfter(spaceNode);
                    range.collapse(true);
                    sel.removeAllRanges();
                    sel.addRange(range);
                } else {
                    const atMatch = textBefore.match(/@([a-zA-Z0-9_\-\./\\]*)$/);
                    if (atMatch) {
                        setMentionQuery(atMatch[1]);
                        setShowMentions(true);
                        setMentionSelectedIndex(0);
                        if (cachedFiles.length === 0) {
                            void loadProjectTree();
                        }
                    } else {
                        setShowMentions(false);
                        setMentionCategory('all');
                    }
                }
            } else {
                setShowMentions(false);
                setMentionCategory('all');
            }
        } else {
            setShowMentions(false);
            setMentionCategory('all');
        }

        const fullText = getRichInputText(el).trim();
        setHasDraft(fullText.length > 0);
    }

    function insertMention(targetPath: string) {
        const sel = window.getSelection();
        let textNode: Node | null = null;
        let offset = 0;

        if (sel && sel.rangeCount > 0) {
            const range = sel.getRangeAt(0);
            const n: Node | null = range.startContainer;
            if (n && n.nodeType === Node.TEXT_NODE) {
                textNode = n;
                offset = range.startOffset;
            }
        }

        if (!textNode && inputRef.current) {
            const walker = document.createTreeWalker(inputRef.current, NodeFilter.SHOW_TEXT);
            let current: Node | null = null;
            while ((current = walker.nextNode())) {
                textNode = current;
            }
            if (textNode) {
                offset = textNode.textContent?.length || 0;
            }
        }

        if (textNode && textNode.parentNode) {
            const text = textNode.textContent || '';
            const textBefore = text.slice(0, offset);
            const atIndex = textBefore.lastIndexOf('@');
            if (atIndex !== -1) {
                const beforeMatch = textBefore.slice(0, atIndex);
                const afterMatch = text.slice(offset);

                const pill = document.createElement('span');
                pill.className = 'input-mention-pill';
                pill.contentEditable = 'false';
                pill.setAttribute('data-mention', `@${targetPath}`);
                pill.textContent = `@${targetPath}`;

                const spaceNode = document.createTextNode('\u00A0');
                const parent = textNode.parentNode;

                const frag = document.createDocumentFragment();
                if (beforeMatch) frag.appendChild(document.createTextNode(beforeMatch));
                frag.appendChild(pill);
                frag.appendChild(spaceNode);
                if (afterMatch) frag.appendChild(document.createTextNode(afterMatch));

                parent.replaceChild(frag, textNode);

                if (sel) {
                    const range = document.createRange();
                    range.setStartAfter(spaceNode);
                    range.collapse(true);
                    sel.removeAllRanges();
                    sel.addRange(range);
                }
            }
        } else if (inputRef.current) {
            const pill = document.createElement('span');
            pill.className = 'input-mention-pill';
            pill.contentEditable = 'false';
            pill.setAttribute('data-mention', `@${targetPath}`);
            pill.textContent = `@${targetPath}`;

            const spaceNode = document.createTextNode('\u00A0');
            inputRef.current.appendChild(pill);
            inputRef.current.appendChild(spaceNode);

            if (sel) {
                const range = document.createRange();
                range.setStartAfter(spaceNode);
                range.collapse(true);
                sel.removeAllRanges();
                sel.addRange(range);
            }
        }

        setShowMentions(false);
        setMentionCategory('all');
        setMentionQuery('');
        if (inputRef.current) {
            inputRef.current.focus();
            const fullText = getRichInputText(inputRef.current).trim();
            setHasDraft(fullText.length > 0);
        }
    }

    function handleSelectMention(item: MentionItem) {
        if (item.disabled) return;
        if (item.type === 'category') {
            if (item.category === 'files' || item.category === 'dirs') {
                setMentionCategory(item.category);
                setMentionSelectedIndex(0);
                setMentionQuery('');
                if (inputRef.current) {
                    inputRef.current.focus();
                }
            }
            return;
        }
        if (item.path) {
            insertMention(item.path);
        }
    }

    function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
        if (showMentions && mentionItems.length > 0) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setMentionSelectedIndex(prev => (prev + 1) % mentionItems.length);
                return;
            }
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                setMentionSelectedIndex(prev => (prev - 1 + mentionItems.length) % mentionItems.length);
                return;
            }
            if (e.key === 'Enter' || e.key === 'Tab') {
                const selected = mentionItems[mentionSelectedIndex];
                if (selected && !selected.disabled) {
                    e.preventDefault();
                    handleSelectMention(selected);
                    return;
                }
            }
            if (e.key === 'Escape') {
                e.preventDefault();
                setShowMentions(false);
                setMentionCategory('all');
                return;
            }
            if (e.key === 'Backspace' && mentionCategory !== 'all' && !mentionQuery) {
                e.preventDefault();
                setMentionCategory('all');
                return;
            }
        }

        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            void send();
            return;
        }
    }

    function handlePaste(e: React.ClipboardEvent<HTMLDivElement>) {
        e.preventDefault();
        const text = e.clipboardData.getData('text/plain');
        document.execCommand('insertText', false, text);
        handleInput();
    }

    function renderItemIcon(item: MentionItem) {
        if (item.type === 'file') return <File size={14} className="mention-icon-file" />;
        if (item.type === 'dir') return <Folder size={14} className="mention-icon-dir" />;
        switch (item.id) {
            case 'cat:files': return <FileText size={14} className="mention-icon-file" />;
            case 'cat:dirs': return <Folder size={14} className="mention-icon-dir" />;
            case 'cat:terminal': return <Terminal size={14} className="mention-icon-terminal" />;
            case 'cat:context': return <Sparkles size={14} className="mention-icon-context" />;
            case 'cat:rules': return <BookOpen size={14} className="mention-icon-rules" />;
            case 'cat:conversation': return <MessageSquare size={14} className="mention-icon-conv" />;
            case 'cat:mcp': return <Cpu size={14} className="mention-icon-mcp" />;
            default: return <File size={14} />;
        }
    }

    const mode = status?.mode ?? 'local';
    const chip = mode === 'cloud'
        ? (status?.hasGeminiKey ? 'Cloud' : 'Cloud · no key')
        : (status?.ollamaUp
            ? (status?.ollamaAutoStart ? 'Local · auto-started' : 'Local')
            : 'Local · offline');

    const unresolvedReviews = pendingReviews.filter(r => !r.resolved);

    return (
        <aside className="chat-panel">
            <header className="pane-header">
                <span>Agent</span>
                <span className="chip">{chip}</span>
            </header>

            <div className="chat-quick-actions">
                <button
                    type="button"
                    className="chat-action-btn"
                    onClick={() => void resetChat()}
                    disabled={busy}
                    title="Clear Chat"
                >
                    <Trash2 size={14} />
                    <span>Clear</span>
                </button>
                <button
                    type="button"
                    className="chat-action-btn"
                    onClick={exportChat}
                    disabled={messages.length === 0}
                    title="Export Chat"
                >
                    <Download size={14} />
                    <span>Export</span>
                </button>
                <button
                    type="button"
                    className={`chat-action-btn ${showSettings ? 'active' : ''}`}
                    onClick={() => setShowSettings(!showSettings)}
                    title="Settings"
                >
                    <Settings size={14} />
                    <span>Settings</span>
                </button>
            </div>

            {showSettings && (
                <div className="chat-settings-panel">
                    <div className="agent-toolbar">
                        <select
                            value={mode}
                            onChange={(e) => void changeMode(e.target.value)}
                            disabled={busy}
                        >
                            <option value="local">Local · Ollama</option>
                            <option value="cloud">Cloud · Gemini</option>
                        </select>
                    </div>
                    {mode === 'cloud' ? (
                        <div className="agent-key">
                            <input
                                type="password"
                                value={keyDraft}
                                onChange={(e) => {
                                    setKeyDraft(e.target.value);
                                    setKeySaved(false);
                                }}
                                placeholder={status?.hasGeminiKey ? 'Key saved on this device' : 'Gemini API key'}
                                autoComplete="off"
                                spellCheck={false}
                            />
                            <button type="button" onClick={() => void saveKey()} disabled={!keyDraft.trim()}>Save</button>
                        </div>
                    ) : null}
                    {keySaved && mode === 'cloud' ? <div className="agent-hint">API key dienkripsi di SQLite lokal (bukan hanya sesi).</div> : null}
                </div>
            )}

            <div className="chat-log" ref={logRef}>
                {messages.map((msg, i) => {
                    if (msg.role === 'user') {
                        return (
                            <div key={i} className="chat-bubble user">
                                <MarkdownRenderer content={msg.text} />
                            </div>
                        );
                    }
                    if (msg.role === 'assistant') {
                        return (
                            <div key={i} className="chat-message assistant">
                                <MarkdownRenderer content={msg.text} />
                            </div>
                        );
                    }
                    if (msg.role === 'tool') {
                        return (
                            <div key={i} className="chat-message tool">
                                {msg.text}
                            </div>
                        );
                    }
                    if (msg.role === 'system') {
                        return (
                            <div key={i} className="chat-message system">
                                {msg.text}
                            </div>
                        );
                    }
                    return (
                        <div key={i} className="chat-message error">
                            {msg.text}
                        </div>
                    );
                })}

                {busy ? (
                    <div className="chat-thinking">
                        <Loader2 size={14} className="chat-spinner" />
                        <span>{busyLabel}</span>
                    </div>
                ) : null}
            </div>

            {unresolvedReviews.length > 0 && (
                <div className="chat-review-dock">
                    {unresolvedReviews.map((review) => (
                        <div key={review.turnID} className="file-review-banner">
                            <div className="file-review-header">
                                <span className="file-review-title">
                                    Agent mengubah {review.changes.length} file
                                </span>
                            </div>
                            <div className="file-review-list">
                                {review.changes.map((change, idx) => {
                                    const { filename, dir } = getFileDisplay(change.path);
                                    const diff = computeLineDiff(change.originalContent, change.newContent, change.action);
                                    const dotClass = change.action === 'created' ? 'dot-created' : change.action === 'deleted' ? 'dot-deleted' : 'dot-modified';

                                    return (
                                        <div key={idx} className={`file-review-item ${change.action}`}>
                                            <div className="file-review-item-header">
                                                <div className="file-review-item-identity">
                                                    <span className={`file-review-dot ${dotClass}`} title={change.action} />
                                                    <span className="file-review-filename" title={change.path}>{filename}</span>
                                                    <div className="file-review-diff">
                                                        <span className="diff-add">+{diff.added}</span>
                                                        <span className="diff-del">-{diff.deleted}</span>
                                                    </div>
                                                </div>
                                                <div className="file-review-item-actions">
                                                    <button
                                                        type="button"
                                                        className="file-review-item-btn accept"
                                                        onClick={() => void handleAcceptFile(review.turnID, change.path)}
                                                        title="Accept perubahan file ini"
                                                    >
                                                        <Check size={11} />
                                                        <span>Accept</span>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="file-review-item-btn reject"
                                                        onClick={() => void handleRejectFile(review.turnID, change.path)}
                                                        title="Reject perubahan file ini"
                                                    >
                                                        <X size={11} />
                                                        <span>Reject</span>
                                                    </button>
                                                </div>
                                            </div>
                                            {dir && (
                                                <div className="file-review-dirname" title={change.path}>
                                                    {dir}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                            <div className="file-review-actions">
                                <button
                                    type="button"
                                    className="file-review-btn accept"
                                    onClick={() => void handleAcceptAll(review.turnID)}
                                >
                                    <Check size={14} />
                                    <span>Accept All</span>
                                </button>
                                <button
                                    type="button"
                                    className="file-review-btn reject"
                                    onClick={() => void handleRejectAll(review.turnID)}
                                >
                                    <X size={14} />
                                    <span>Reject All</span>
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <div className="chat-input-wrapper">
                {showMentions && (
                    <div className="chat-mention-popup">
                        <div className="chat-mention-header">
                            <span>
                                {mentionCategory === 'all'
                                    ? 'Mention Context (@)'
                                    : mentionCategory === 'files'
                                    ? 'Select File (@file)'
                                    : 'Select Directory (@folder)'}
                            </span>
                            {mentionCategory !== 'all' && (
                                <button
                                    type="button"
                                    className="chat-mention-back-btn"
                                    onClick={() => {
                                        setMentionCategory('all');
                                        setMentionSelectedIndex(0);
                                    }}
                                >
                                    ← Back
                                </button>
                            )}
                        </div>
                        <div className="chat-mention-list">
                            {mentionItems.length === 0 ? (
                                <div className="chat-mention-empty">No matching files or folders</div>
                            ) : (
                                mentionItems.map((item, idx) => (
                                    <div
                                        key={item.id}
                                        className={`chat-mention-item ${idx === mentionSelectedIndex ? 'selected' : ''} ${item.disabled ? 'disabled' : ''}`}
                                        onClick={() => {
                                            if (!item.disabled) handleSelectMention(item);
                                        }}
                                        onMouseEnter={() => setMentionSelectedIndex(idx)}
                                    >
                                        <div className="chat-mention-icon">
                                            {renderItemIcon(item)}
                                        </div>
                                        <div className="chat-mention-info">
                                            <div className="chat-mention-label">{item.label}</div>
                                            {item.detail && <div className="chat-mention-detail">{item.detail}</div>}
                                        </div>
                                        {item.disabled ? (
                                            <span className="chat-mention-tag">Soon</span>
                                        ) : item.type === 'category' ? (
                                            <ChevronRight size={13} className="chat-mention-arrow" />
                                        ) : null}
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}

                <form className="chat-input" onSubmit={(e) => void send(e)}>
                    <div
                        ref={inputRef}
                        className="chat-rich-input"
                        contentEditable={!busy}
                        role="textbox"
                        aria-multiline="true"
                        data-placeholder={mode === 'cloud' ? 'Type @ to mention, Ask Gemini…' : 'Type @ to mention, Ask Qwen…'}
                        onInput={handleInput}
                        onKeyDown={handleKeyDown}
                        onPaste={handlePaste}
                        spellCheck={false}
                    />
                    <button
                        type={busy ? 'button' : 'submit'}
                        className={`chat-submit-btn ${busy ? 'chat-stop-btn' : ''}`}
                        disabled={!busy && !hasDraft}
                        title={busy ? 'Stop (Cancel AI request)' : 'Send (Enter)'}
                        onClick={busy ? (e) => {
                            e.preventDefault();
                            void stopChat();
                        } : undefined}
                    >
                        {busy ? (
                            <Square size={16} className="chat-stop-icon" />
                        ) : (
                            <Send size={16} />
                        )}
                    </button>
                </form>
            </div>
        </aside>
    );
}
