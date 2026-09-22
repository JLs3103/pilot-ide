import {FormEvent, useState} from 'react';
import {RunCommand} from '../../wailsjs/go/main/App';
import type {CommandResult} from '../types';
import './TerminalPanel.css';

export function TerminalPanel() {
    const [command, setCommand] = useState('');
    const [log, setLog] = useState('Ready. Commands run in the opened project folder.\n');
    const [busy, setBusy] = useState(false);

    async function run(event: FormEvent) {
        event.preventDefault();
        const next = command.trim();
        if (!next || busy) {
            return;
        }
        setBusy(true);
        setLog((prev) => prev + `> ${next}\n`);
        setCommand('');
        try {
            const result = await RunCommand(next, '') as CommandResult;
            const stdout = result.stdout || '';
            const stderr = result.stderr || '';
            const chunk = `${stdout}${stderr}${stdout || stderr ? '' : `(exit ${result.exitCode})`}\n`;
            setLog((prev) => prev + chunk);
        } catch (err) {
            setLog((prev) => prev + String(err) + '\n');
        } finally {
            setBusy(false);
        }
    }

    return (
        <section className="terminal-panel">
            <header className="pane-header">
                <span>Terminal</span>
            </header>
            <pre className="terminal-log">{log}</pre>
            <form className="terminal-input" onSubmit={(e) => void run(e)}>
                <span>$</span>
                <input
                    value={command}
                    onChange={(e) => setCommand(e.target.value)}
                    placeholder={busy ? 'Running…' : 'dir  |  ls'}
                    disabled={busy}
                    autoComplete="off"
                    spellCheck={false}
                />
            </form>
        </section>
    );
}
