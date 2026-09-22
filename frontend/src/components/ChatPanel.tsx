import {FormEvent, useEffect, useRef, useState} from 'react';
import {Chat, ClearChat, GetAIStatus, GetChatHistory, SetAIMode, SetGeminiAPIKey} from '../../wailsjs/go/main/App';
import {EventsOn} from '../../wailsjs/runtime/runtime';
import type {AIStatus, ToolAction} from '../types';
import './ChatPanel.css';

type Message = {
    role: 'system' | 'user' | 'assistant' | 'error' | 'tool';
    text: string;
};

function formatAction(action: ToolAction) {
    const status = action.ok ? 'ok' : 'fail';
    const extra = action.error ? ` — ${action.error}` : '';
    return `${action.name} ${action.detail} [${status}]${extra}`;
}

export function ChatPanel() {
    const [status, setStatus] = useState<AIStatus | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [draft, setDraft] = useState('');
    const [keyDraft, setKeyDraft] = useState('');
    const [busy, setBusy] = useState(false);
    const [busyLabel, setBusyLabel] = useState('Thinking…');
    const [keySaved, setKeySaved] = useState(false);
    const logRef = useRef<HTMLDivElement>(null);
    const toolCountRef = useRef(0);

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
            const next = await refreshStatus();
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
        })();
    }, []);

    useEffect(() => {
        const off = EventsOn('agent:tool', (...data: unknown[]) => {
            const raw = data[0] as ToolAction | undefined;
            if (!raw?.name) {
                return;
            }
            setBusyLabel(`${raw.name} ${raw.detail || ''}`.trim());
            toolCountRef.current += 1;
            setMessages((prev) => [...prev, {role: 'tool', text: formatAction(raw)}]);
        });
        return () => off();
    }, []);

    useEffect(() => {
        const el = logRef.current;
        if (el) {
            el.scrollTop = el.scrollHeight;
        }
    }, [messages, busy, busyLabel]);

    async function changeMode(mode: string) {
        const applied = await SetAIMode(mode);
        const next = await refreshStatus();
        setMessages((prev) => [
            ...prev,
            {
                role: 'system',
                text: applied === 'cloud'
                    ? `Mode Cloud: ${next.cloudModel}. ${next.hasGeminiKey ? 'API key tersimpan di perangkat ini.' : 'Masukkan API key lalu Save.'}`
                    : `Mode Local: ${next.localModel}. Ollama ${next.ollamaUp ? 'terhubung' : 'tidak terdeteksi'}.`,
            },
        ]);
    }

    async function saveKey() {
        const key = keyDraft.trim();
        if (!key) {
            return;
        }
        await SetGeminiAPIKey(key);
        setKeyDraft('');
        setKeySaved(true);
        await refreshStatus();
    }

    async function send(event?: FormEvent) {
        event?.preventDefault();
        const text = draft.trim();
        if (!text || busy) {
            return;
        }
        setDraft('');
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
            setMessages((prev) => [...prev, {role: 'error', text: String(err)}]);
        } finally {
            setBusy(false);
            setBusyLabel('Thinking…');
        }
    }

    async function resetChat() {
        await ClearChat();
        setMessages([{role: 'system', text: 'Riwayat percakapan direset.'}]);
    }

    const mode = status?.mode ?? 'local';
    const chip = mode === 'cloud'
        ? (status?.hasGeminiKey ? 'Cloud' : 'Cloud · no key')
        : (status?.ollamaUp ? 'Local' : 'Local · offline');

    return (
        <aside className="chat-panel">
            <header className="pane-header">
                <span>Agent</span>
                <span className="chip">{chip}</span>
            </header>
            <div className="agent-toolbar">
                <select
                    value={mode}
                    onChange={(e) => void changeMode(e.target.value)}
                    disabled={busy}
                >
                    <option value="local">Local · Ollama</option>
                    <option value="cloud">Cloud · Gemini</option>
                </select>
                <button type="button" onClick={() => void resetChat()} disabled={busy}>Clear</button>
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
            <div className="chat-log" ref={logRef}>
                {messages.map((msg, i) => (
                    <div key={i} className={`chat-bubble ${msg.role}`}>{msg.text}</div>
                ))}
                {busy ? <div className="chat-bubble system">{busyLabel}</div> : null}
            </div>
            <form className="chat-input" onSubmit={(e) => void send(e)}>
                <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder={mode === 'cloud' ? 'Ask Gemini…' : 'Ask Qwen (Ollama)…'}
                    rows={3}
                    disabled={busy}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            void send();
                        }
                    }}
                />
                <button type="submit" disabled={busy || !draft.trim()}>Send</button>
            </form>
        </aside>
    );
}
