import {useCallback, useEffect, useState} from 'react';
import {ReadFile, WriteFile} from '../wailsjs/go/main/App';
import {ChatPanel} from './components/ChatPanel';
import {EditorPane} from './components/EditorPane';
import {FileExplorer} from './components/FileExplorer';
import {TerminalPanel} from './components/TerminalPanel';
import './App.css';

function App() {
    const [path, setPath] = useState<string | null>(null);
    const [name, setName] = useState<string | null>(null);
    const [value, setValue] = useState('');
    const [saved, setSaved] = useState('');
    const [status, setStatus] = useState('Open a project folder to start.');

    const dirty = path !== null && value !== saved;

    async function openFile(nextPath: string, nextName: string) {
        try {
            const content = await ReadFile(nextPath);
            setPath(nextPath);
            setName(nextName);
            setValue(content);
            setSaved(content);
            setStatus(nextPath);
        } catch (err) {
            setStatus(String(err));
        }
    }

    const save = useCallback(async () => {
        if (!path || value === saved) {
            return;
        }
        try {
            await WriteFile(path, value);
            setSaved(value);
            setStatus(`Saved ${name}`);
        } catch (err) {
            setStatus(String(err));
        }
    }, [path, value, saved, name]);

    useEffect(() => {
        function onKey(event: KeyboardEvent) {
            if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
                event.preventDefault();
                void save();
            }
        }
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [save]);

    return (
        <div id="App" className="ide-shell">
            <FileExplorer onOpenFile={(p, n) => void openFile(p, n)} activePath={path} />
            <div className="ide-main">
                <div className="ide-center">
                    <EditorPane
                        path={path}
                        name={name}
                        value={value}
                        dirty={dirty}
                        onChange={setValue}
                        onSave={() => void save()}
                    />
                    <TerminalPanel />
                </div>
                <ChatPanel />
            </div>
            <footer className="status-bar">{status}</footer>
        </div>
    );
}

export default App;
