import {useCallback, useEffect, useState, useRef, useMemo} from 'react';
import {ReadFile, WriteFile, OpenProject, SaveFileAs, QuitApp, SaveOpenTabs, GetOpenTabs, CreateFile} from '../wailsjs/go/main/App';
import {EventsOn} from '../wailsjs/runtime/runtime';
import {ChatPanel} from './components/ChatPanel';
import {EditorPane} from './components/EditorPane';
import type {TabInfo} from './components/EditorPane';
import {TerminalPanel} from './components/TerminalPanel';
import {MenuBar} from './components/MenuBar';
import {SideNavigation} from './components/SideNavigation';
import {ResizableLayout} from './components/ResizableLayout';
import {StatusBar} from './components/StatusBar';
import {CommandPalette, buildDefaultCommands} from './components/CommandPalette';
import './App.css';

const MAX_CLOSED_TABS = 20;

type ClosedTab = {
    path: string;
    name: string;
};

function App() {
    const [tabs, setTabs] = useState<TabInfo[]>([]);
    const [activeTabIndex, setActiveTabIndex] = useState(-1);
    const [closedTabs, setClosedTabs] = useState<ClosedTab[]>([]);
    const [sidebarVisible, setSidebarVisible] = useState(true);
    const [terminalVisible, setTerminalVisible] = useState(true);
    const [aiPanelVisible, setAiPanelVisible] = useState(true);
    const [projectRoot, setProjectRoot] = useState<string | null>(null);
    const [explorerKey, setExplorerKey] = useState(0);
    const [zoomLevel, setZoomLevel] = useState(100);
    const [tabsLoaded, setTabsLoaded] = useState(false);
    const [cursorLine, setCursorLine] = useState(1);
    const [cursorCol, setCursorCol] = useState(1);
    const [paletteOpen, setPaletteOpen] = useState(false);
    const [paletteMode, setPaletteMode] = useState<'command' | 'goto'>('command');

    const resizableLayoutRef = useRef<any>(null);
    const editorRef = useRef<any>(null);

    const activeTab = tabs[activeTabIndex] ?? null;
    const activePath = activeTab?.path ?? null;
    const activeName = activeTab?.name ?? null;
    const dirty = activeTab ? activeTab.value !== activeTab.saved : false;

    const persistTabs = useCallback(async (currentTabs: TabInfo[], currentActiveIndex: number) => {
        try {
            const data = {
                tabs: currentTabs.map(t => ({path: t.path, name: t.name})),
                activeIndex: currentActiveIndex,
            };
            await SaveOpenTabs(JSON.stringify(data));
        } catch (e) {
            console.error('Failed to save open tabs:', e);
        }
    }, []);

    useEffect(() => {
        void (async () => {
            try {
                const saved = await GetOpenTabs();
                if (saved) {
                    const data = JSON.parse(saved) as {
                        tabs: {path: string; name: string}[];
                        activeIndex: number;
                    };
                    if (data.tabs && data.tabs.length > 0) {
                        const restored: TabInfo[] = [];
                        for (const t of data.tabs) {
                            try {
                                const content = await ReadFile(t.path);
                                restored.push({path: t.path, name: t.name, value: content, saved: content});
                            } catch {
                            }
                        }
                        if (restored.length > 0) {
                            setTabs(restored);
                            const idx = Math.min(data.activeIndex, restored.length - 1);
                            setActiveTabIndex(idx >= 0 ? idx : 0);
                        }
                    }
                }
            } catch (e) {
                console.error('Failed to restore open tabs:', e);
            }
            setTabsLoaded(true);
        })();
    }, []);

    async function openFile(nextPath: string, nextName: string) {
        try {
            const existingIndex = tabs.findIndex(t => t.path === nextPath);
            if (existingIndex >= 0) {
                setActiveTabIndex(existingIndex);
                void persistTabs(tabs, existingIndex);
                return;
            }
            const content = await ReadFile(nextPath);
            const newTab: TabInfo = {path: nextPath, name: nextName, value: content, saved: content};
            setTabs(prev => {
                const next = [...prev, newTab];
                const nextIdx = next.length - 1;
                setActiveTabIndex(nextIdx);
                void persistTabs(next, nextIdx);
                return next;
            });
        } catch (err) {
            console.error(String(err));
        }
    }

    const closeTab = useCallback((index: number) => {
        setTabs(prev => {
            if (index < 0 || index >= prev.length) return prev;
            const closedTab = prev[index];
            setClosedTabs(ct => {
                const next = [{path: closedTab.path, name: closedTab.name}, ...ct];
                return next.slice(0, MAX_CLOSED_TABS);
            });
            const next = prev.filter((_, i) => i !== index);
            setActiveTabIndex(prevActive => {
                let newActive: number;
                if (next.length === 0) {
                    newActive = -1;
                } else if (prevActive >= next.length) {
                    newActive = next.length - 1;
                } else if (index < prevActive) {
                    newActive = prevActive - 1;
                } else if (index === prevActive) {
                    newActive = Math.min(index, next.length - 1);
                } else {
                    newActive = prevActive;
                }
                void persistTabs(next, newActive);
                return newActive;
            });
            return next;
        });
    }, [persistTabs]);

    const closeActiveTab = useCallback(() => {
        if (activeTabIndex >= 0) {
            closeTab(activeTabIndex);
        }
    }, [activeTabIndex, closeTab]);

    const closeAllTabs = useCallback(() => {
        setClosedTabs(ct => {
            const newClosed = tabs.map(t => ({path: t.path, name: t.name}));
            return [...newClosed, ...ct].slice(0, MAX_CLOSED_TABS);
        });
        setTabs([]);
        setActiveTabIndex(-1);
        void persistTabs([], -1);
    }, [tabs, persistTabs]);

    const reopenClosedTab = useCallback(() => {
        if (closedTabs.length === 0) return;
        const [last, ...rest] = closedTabs;
        setClosedTabs(rest);
        void openFile(last.path, last.name);
    }, [closedTabs, tabs]);

    const activateTab = useCallback((index: number) => {
        if (index >= 0 && index < tabs.length) {
            setActiveTabIndex(index);
            void persistTabs(tabs, index);
        }
    }, [tabs, persistTabs]);

    const updateTabContent = useCallback((index: number, value: string) => {
        setTabs(prev => {
            const next = [...prev];
            if (index >= 0 && index < next.length) {
                next[index] = {...next[index], value};
            }
            return next;
        });
    }, []);

    async function openProject() {
        try {
            const selected = await OpenProject();
            if (selected) {
                setProjectRoot(selected);
                setExplorerKey(prev => prev + 1);
                setTabs([]);
                setActiveTabIndex(-1);
                setClosedTabs([]);
                void persistTabs([], -1);
            }
        } catch (err) {
            console.error(String(err));
        }
    }

    const newFile = useCallback(() => {
        const name = window.prompt('Enter new file name:', 'untitled.txt');
        if (!name || !name.trim()) return;
        const tab: TabInfo = {
            path: `new:${Date.now()}_${name.trim()}`,
            name: name.trim(),
            value: '',
            saved: '',
        };
        setTabs(prev => {
            const next = [...prev, tab];
            const nextIdx = next.length - 1;
            setActiveTabIndex(nextIdx);
            return next;
        });
    }, []);

    useEffect(() => {
        const cancel = EventsOn('project:opened', (newRoot: string) => {
            setTabs([]);
            setActiveTabIndex(-1);
            setClosedTabs([]);
            void persistTabs([], -1);
            if (newRoot) {
                setProjectRoot(newRoot);
                setExplorerKey(prev => prev + 1);
            }
        });
        return () => {
            if (cancel) cancel();
        };
    }, [persistTabs]);

    const save = useCallback(async (index?: number) => {
        const idx = index ?? activeTabIndex;
        const tab = tabs[idx];
        if (!tab || tab.value === tab.saved) return;

        if (tab.path.startsWith('new:')) {
            void saveAs();
            return;
        }

        try {
            await WriteFile(tab.path, tab.value);
            setTabs(prev => {
                const next = [...prev];
                if (idx >= 0 && idx < next.length) {
                    next[idx] = {...next[idx], saved: next[idx].value};
                }
                return next;
            });
        } catch (err) {
            console.error(String(err));
        }
    }, [activeTabIndex, tabs]);

    const saveAs = useCallback(async () => {
        const tab = tabs[activeTabIndex];
        const defaultName = tab?.name || 'untitled.txt';
        const content = tab?.value || '';
        try {
            const savedPath = await SaveFileAs(defaultName, content);
            if (savedPath) {
                const parts = savedPath.replace(/\\/g, '/').split('/');
                const newName = parts[parts.length - 1];
                setTabs(prev => {
                    const next = [...prev];
                    if (activeTabIndex >= 0 && activeTabIndex < next.length) {
                        next[activeTabIndex] = {
                            ...next[activeTabIndex],
                            path: savedPath,
                            name: newName,
                            saved: content,
                        };
                    }
                    return next;
                });
            }
        } catch (err) {
            console.error(String(err));
        }
    }, [activeTabIndex, tabs]);

    const exitApp = useCallback(() => {
        QuitApp();
    }, []);

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
        setTerminalVisible(prev => !prev);
    }, []);

    const showTerminal = useCallback(() => {
        setTerminalVisible(true);
    }, []);

    const hideTerminal = useCallback(() => {
        setTerminalVisible(false);
    }, []);

    const toggleAiPanel = useCallback(() => {
        setAiPanelVisible(prev => !prev);
    }, []);

    const hideAiPanel = useCallback(() => {
        setAiPanelVisible(false);
    }, []);

    const showAiPanel = useCallback(() => {
        setAiPanelVisible(true);
    }, []);

    const zoomIn = useCallback(() => {
        setZoomLevel(prev => {
            const next = Math.min(prev + 10, 200);
            document.documentElement.style.zoom = `${next}%`;
            return next;
        });
    }, []);

    const zoomOut = useCallback(() => {
        setZoomLevel(prev => {
            const next = Math.max(prev - 10, 50);
            document.documentElement.style.zoom = `${next}%`;
            return next;
        });
    }, []);

    const triggerEditorAction = useCallback((actionId: string) => {
        const editor = editorRef.current;
        if (editor) {
            editor.focus();
            editor.trigger('menu', actionId, null);
        }
    }, []);

    const handleUndo = useCallback(() => triggerEditorAction('undo'), [triggerEditorAction]);
    const handleRedo = useCallback(() => triggerEditorAction('redo'), [triggerEditorAction]);
    const handleCut = useCallback(() => {
        const editor = editorRef.current;
        if (editor) {
            editor.focus();
            editor.trigger('menu', 'editor.action.clipboardCutAction', null);
        }
    }, []);
    const handleCopy = useCallback(() => {
        const editor = editorRef.current;
        if (editor) {
            editor.focus();
            editor.trigger('menu', 'editor.action.clipboardCopyAction', null);
        }
    }, []);
    const handlePaste = useCallback(() => {
        const editor = editorRef.current;
        if (editor) {
            editor.focus();
            editor.trigger('menu', 'editor.action.clipboardPasteAction', null);
        }
    }, []);
    const handleFind = useCallback(() => triggerEditorAction('actions.find'), [triggerEditorAction]);
    const handleReplace = useCallback(() => triggerEditorAction('editor.action.startFindReplaceAction'), [triggerEditorAction]);
    const handleSelectAll = useCallback(() => {
        const editor = editorRef.current;
        if (editor) {
            editor.focus();
            const model = editor.getModel();
            if (model) {
                const lastLine = model.getLineCount();
                const lastCol = model.getLineMaxColumn(lastLine);
                editor.setSelection({
                    startLineNumber: 1,
                    startColumn: 1,
                    endLineNumber: lastLine,
                    endColumn: lastCol,
                });
            }
        }
    }, []);

    const handleEditorMount = useCallback((editor: any) => {
        editorRef.current = editor;
    }, []);

    const handleCursorChange = useCallback((line: number, col: number) => {
        setCursorLine(line);
        setCursorCol(col);
    }, []);

    const openCommandPalette = useCallback(() => {
        setPaletteMode('command');
        setPaletteOpen(true);
    }, []);

    const openGoToLine = useCallback(() => {
        setPaletteMode('goto');
        setPaletteOpen(true);
    }, []);

    const handleGoToLine = useCallback((line: number) => {
        const editor = editorRef.current;
        if (editor) {
            editor.revealLineInCenter(line);
            editor.setPosition({lineNumber: line, column: 1});
            editor.focus();
        }
    }, []);

    const paletteCommands = useMemo(() => buildDefaultCommands({
        save: () => void save(),
        saveAs: () => void saveAs(),
        openProject: () => void openProject(),
        closeTab: closeActiveTab,
        newFile,
        toggleSidebar,
        toggleTerminal,
        toggleAiPanel,
        find: handleFind,
        replace: handleReplace,
        goToLine: openGoToLine,
        undo: handleUndo,
        redo: handleRedo,
        cut: handleCut,
        copy: handleCopy,
        paste: handlePaste,
        selectAll: handleSelectAll,
        zoomIn,
        zoomOut,
    }), [save, saveAs, closeActiveTab, newFile, toggleSidebar, toggleTerminal, toggleAiPanel, handleFind, handleReplace, openGoToLine, handleUndo, handleRedo, handleCut, handleCopy, handlePaste, handleSelectAll, zoomIn, zoomOut]);

    useEffect(() => {
        function onKey(event: KeyboardEvent) {
            const ctrl = event.ctrlKey || event.metaKey;

            if (ctrl && event.key.toLowerCase() === 's') {
                if (event.shiftKey) {
                    event.preventDefault();
                    void saveAs();
                } else {
                    event.preventDefault();
                    void save();
                }
            }
            if (ctrl && event.key.toLowerCase() === 'w') {
                event.preventDefault();
                closeActiveTab();
            }
            if (ctrl && event.key.toLowerCase() === 'n') {
                event.preventDefault();
                newFile();
            }
            if (ctrl && event.key.toLowerCase() === 'o') {
                event.preventDefault();
                void openProject();
            }
            if (ctrl && (event.key === 'b' || event.key === 'B')) {
                event.preventDefault();
                toggleSidebar();
            }
            if (ctrl && event.key === '`') {
                if (event.shiftKey) {
                    event.preventDefault();
                    showTerminal();
                } else {
                    event.preventDefault();
                    toggleTerminal();
                }
            }
            if (ctrl && event.shiftKey && (event.key === 'm' || event.key === 'M')) {
                event.preventDefault();
                toggleAiPanel();
            }
            if (ctrl && event.shiftKey && (event.key === 'p' || event.key === 'P')) {
                event.preventDefault();
                openCommandPalette();
            }
            if (ctrl && event.key.toLowerCase() === 'g') {
                event.preventDefault();
                openGoToLine();
            }
            if (ctrl && (event.key === '=' || event.key === '+')) {
                event.preventDefault();
                zoomIn();
            }
            if (ctrl && event.key === '-') {
                event.preventDefault();
                zoomOut();
            }
            if (ctrl && event.key === 'Tab') {
                event.preventDefault();
                if (tabs.length <= 1) return;
                if (event.shiftKey) {
                    const newIdx = activeTabIndex <= 0 ? tabs.length - 1 : activeTabIndex - 1;
                    activateTab(newIdx);
                } else {
                    const newIdx = activeTabIndex >= tabs.length - 1 ? 0 : activeTabIndex + 1;
                    activateTab(newIdx);
                }
            }
            if (ctrl && !event.shiftKey && !event.altKey) {
                const num = parseInt(event.key);
                if (num >= 1 && num <= 9) {
                    event.preventDefault();
                    const idx = num - 1;
                    if (idx < tabs.length) {
                        activateTab(idx);
                    }
                }
            }
            if (ctrl && event.shiftKey && (event.key === 't' || event.key === 'T')) {
                event.preventDefault();
                reopenClosedTab();
            }
        }
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [save, saveAs, closeActiveTab, newFile, toggleSidebar, toggleTerminal, showTerminal, toggleAiPanel, zoomIn, zoomOut, tabs, activeTabIndex, activateTab, reopenClosedTab, openCommandPalette, openGoToLine]);

    return (
        <div id="App" className="ide-shell">
            <MenuBar
                onSave={() => void save()}
                onSaveAs={() => void saveAs()}
                onCloseFile={closeActiveTab}
                onExit={exitApp}
                onOpenProject={() => void openProject()}
                onNewFile={newFile}
                onToggleSidebar={toggleSidebar}
                onToggleTerminal={toggleTerminal}
                onToggleAiPanel={toggleAiPanel}
                onNewTerminal={showTerminal}
                onSplitTerminal={showTerminal}
                onZoomIn={zoomIn}
                onZoomOut={zoomOut}
                onUndo={handleUndo}
                onRedo={handleRedo}
                onCut={handleCut}
                onCopy={handleCopy}
                onPaste={handlePaste}
                onFind={handleFind}
                onReplace={handleReplace}
                onSelectAll={handleSelectAll}
                onGoToLine={openGoToLine}
                onCommandPalette={openCommandPalette}
            />
            <ResizableLayout
                sidebarVisible={sidebarVisible}
                terminalVisible={terminalVisible}
                aiPanelVisible={aiPanelVisible}
                onSidebarAutoCollapse={collapseSidebar}
                onSidebarExpand={expandSidebar}
                onAiPanelAutoCollapse={hideAiPanel}
                onAiPanelExpand={showAiPanel}
                sidebar={
                    <SideNavigation
                        explorerKey={explorerKey}
                        onOpenFile={(p, n) => void openFile(p, n)}
                        activePath={activePath}
                        collapsed={!sidebarVisible}
                        onCollapsedChange={handleSidebarCollapsedChange}
                    />
                }
                main={
                    <div className="editor-container">
                        <EditorPane
                            tabs={tabs}
                            activeTabIndex={activeTabIndex}
                            onActivateTab={activateTab}
                            onCloseTab={closeTab}
                            onChangeContent={updateTabContent}
                            onSave={(idx) => void save(idx)}
                            onEditorMount={handleEditorMount}
                            onCursorChange={handleCursorChange}
                        />
                    </div>
                }
                rightPanel={<ChatPanel />}
                bottomPanel={<TerminalPanel projectRoot={projectRoot} onClose={hideTerminal} />}
            />
            <StatusBar
                filePath={activePath}
                fileName={activeName}
                cursorLine={cursorLine}
                cursorCol={cursorCol}
                encoding="UTF-8"
                aiMode="local"
                aiPanelVisible={aiPanelVisible}
                terminalVisible={terminalVisible}
                dirty={dirty}
                onToggleTerminal={toggleTerminal}
                onToggleAiPanel={toggleAiPanel}
                onGoToLine={openGoToLine}
            />
            <CommandPalette
                open={paletteOpen}
                onClose={() => setPaletteOpen(false)}
                commands={paletteCommands}
                mode={paletteMode}
                onGoToLine={handleGoToLine}
            />
        </div>
    );
}

export default App;
