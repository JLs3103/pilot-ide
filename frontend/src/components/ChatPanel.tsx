import {FormEvent, useState} from 'react';
import './ChatPanel.css';

type Message = {
    role: 'system' | 'user';
    text: string;
};

const starter: Message[] = [{
    role: 'system',
    text: 'Dual-Brain (Gemini + Ollama) belum terhubung. Panel ini siap untuk Fase 2.',
}];

export function ChatPanel() {
    const [messages, setMessages] = useState<Message[]>(starter);
    const [draft, setDraft] = useState('');

    function send(event?: FormEvent) {
        event?.preventDefault();
        const text = draft.trim();
        if (!text) {
            return;
        }
        setMessages((prev) => [
            ...prev,
            {role: 'user', text},
            {role: 'system', text: 'AI routing belum aktif. Prompt tersimpan di UI saja.'},
        ]);
        setDraft('');
    }

    return (
        <aside className="chat-panel">
            <header className="pane-header">
                <span>Agent</span>
                <span className="chip">Offline UI</span>
            </header>
            <div className="chat-log">
                {messages.map((msg, i) => (
                    <div key={i} className={`chat-bubble ${msg.role}`}>{msg.text}</div>
                ))}
            </div>
            <form className="chat-input" onSubmit={send}>
                <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder="Ask the agent…"
                    rows={3}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            send(e);
                        }
                    }}
                />
                <button type="submit">Send</button>
            </form>
        </aside>
    );
}
