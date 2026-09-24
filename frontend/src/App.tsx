import {useCallback, useEffect, useState, useRef} from 'react';
import {ReadFile, WriteFile, OpenProject} from '../wailsjs/go/main/App';
import {ChatPanel} from './components/ChatPanel';
import {EditorPane} from './components/EditorPane';
import {TerminalPanel} from './components/TerminalPanel';
import {MenuBar} from './components/MenuBar';
import {SideNavigation} from './components/SideNavigation';
import {ResizableLayout} from './components/ResizableLayout';
import './App.css';

function App() {
    const [path, setPath] = useState<string | null>(null);
    const [name, setName] = useState<string | null>(null);
    const [value, setValue] = useState('');
    const [saved, setSaved] = useState('');
    const [status, setStatus] = useState('Open a project folder to start.');
    const [sidebarVisible, setSidebarVisible] = useState(true);
    const [terminalVisible, setTerminalVisible] = useState(true);
    const [aiPanelVisible, setAiPanelVisible] = useState(true);
    const [projectRoot, setProjectRoot] = useState<string | null>(null);
    const [explorerKey, setExplorerKey] = useState(0);

    const resizableLayoutRef = useRef<any>(null);

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

    async function openProject() {
        try {
            const selected = await OpenProject();
            if (selected) {
                setProjectRoot(selected);
                setExplorerKey(prev => prev + 1);
                setStatus(`Project opened: ${selected}`);
                // Reset current file
                setPath(null);
                setName(null);
                setValue('');
                setSaved('');
            }
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

    const collapseSidebar = useCallback(() => {
        setSidebarVisible(false);
    }, []);

    const expandSidebar = useCallback(() => {
        setSidebarVisible(true);
    }, []);

    const toggleSidebar = useCallback(() => {
        setSidebarVisible(prev => !prev);
    }, []);

    const handleSidebarCollapsedChange = useCallback((collapsed: boolean) => {
        setSidebarVisible(!collapsed);
    }, []);

    const toggleTerminal = useCallback(() => {
        setTerminalVisible(!terminalVisible);
    }, [terminalVisible]);

    const toggleAiPanel = useCallback(() => {
        setAiPanelVisible(!aiPanelVisible);
    }, [aiPanelVisible]);

    const shouldExpandEditor = !terminalVisible || !aiPanelVisible;

    useEffect(() => {
        function onKey(event: KeyboardEvent) {
            // Ctrl+S - Save
            if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
                event.preventDefault();
                void save();
            }
            // Ctrl+B - Toggle Sidebar
            if ((event.ctrlKey || event.metaKey) && (event.key === 'b' || event.key === 'B')) {
                event.preventDefault();
                toggleSidebar();
            }
            // Ctrl+` - Toggle Terminal
            if ((event.ctrlKey || event.metaKey) && event.key === '`') {
                event.preventDefault();
                toggleTerminal();
            }
            // Ctrl+Shift+M - Toggle AI Panel
            if ((event.ctrlKey || event.metaKey) && event.shiftKey && (event.key === 'm' || event.key === 'M')) {
                event.preventDefault();
                toggleAiPanel();
            }
        }
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [save, toggleSidebar, toggleTerminal, toggleAiPanel]);

    return (
        <div id="App" className="ide-shell">
            <MenuBar
                onSave={() => void save()}
                onOpenProject={() => void openProject()}
                onToggleSidebar={toggleSidebar}
                onToggleTerminal={toggleTerminal}
                onToggleAiPanel={toggleAiPanel}
            />
            <ResizableLayout
                sidebarVisible={sidebarVisible}
                terminalVisible={terminalVisible}
                aiPanelVisible={aiPanelVisible}
                onSidebarAutoCollapse={collapseSidebar}
                onSidebarExpand={expandSidebar}
                sidebar={
                    <SideNavigation
                        explorerKey={explorerKey}
                        onOpenFile={(p, n) => void openFile(p, n)}
                        activePath={path}
                        collapsed={!sidebarVisible}
                        onCollapsedChange={handleSidebarCollapsedChange}
                    />
                }
                main={
                    <div className="editor-container">
                        <EditorPane
                            path={path}
                            name={name}
                            value={value}
                            dirty={dirty}
                            onChange={setValue}
                            onSave={() => void save()}
                        />
                    </div>
                }
                rightPanel={<ChatPanel />}
                bottomPanel={<TerminalPanel />}
            />
            <footer className="status-bar">{status}</footer>
        </div>
    );
}

export default App;
