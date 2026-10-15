import {useCallback, useEffect, useState, useRef, useMemo} from 'react';
import {ReadFile, WriteFile, OpenProject, OpenProjectPath, SaveFileAs, QuitApp, SaveOpenTabs, GetOpenTabs, CreateFile, FormatDocument, GetProjectSettings, GetRecentProjects, ClearRecentProjects, GetProjectRoot, SaveEditorSettings} from '../wailsjs/go/main/App';
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
import {ToastHost} from './components/ToastHost';
import type {EditorSettings} from './components/SettingsPanel';
import {defaultSettings, loadEditorSettings} from './components/SettingsPanel';
import {formatError, notify, reportError} from './lib/notifications';
import {registerAllSnippets} from './lib/snippets';
import './App.css';

const MAX_CLOSED_TABS = 20;
const RECOVERY_STORAGE_KEY = 'pilot-ide-recovery-v1';
const AUTOSAVE_INTERVAL_MS = 10000;

type ClosedTab = {
    path: string;
    name: string;
};

type RecoverySnapshot = {
    path: string;
    name: string;
    value: string;
    savedAt: number;
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
    const [editorSettings, setEditorSettings] = useState<EditorSettings>(defaultSettings);
    const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'recovery' | 'error'>('saved');
    const [formatOnSave, setFormatOnSave] = useState(false);
    const [recentProjects, setRecentProjects] = useState<Array<{path: string; name: string}>>([]);
    const snippetsRegistered = useRef(false);

    const resizableLayoutRef = useRef<any>(null);
    const editorRef = useRef<any>(null);

    const activeTab = tabs[activeTabIndex] ?? null;
    const activePath = activeTab?.path ?? null;
    const activeName = activeTab?.name ?? null;
    const dirty = activeTab ? activeTab.value !== activeTab.saved : false;

    const loadRecentProjects = useCallback(async () => {
        try {
            const list = await GetRecentProjects();
            setRecentProjects(list ?? []);
        } catch {}
    }, []);

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
        const handleWindowError = (event: ErrorEvent) => {
            reportError('Unexpected UI error', event.error ?? event.message);
        };
        const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
            reportError('Unexpected async error', event.reason);
        };
        window.addEventListener('error', handleWindowError);
        window.addEventListener('unhandledrejection', handleUnhandledRejection);
        return () => {
            window.removeEventListener('error', handleWindowError);
            window.removeEventListener('unhandledrejection', handleUnhandledRejection);
        };
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
                                const recovery = readRecoverySnapshot(t.path);
                                const value = recovery && recovery.value !== content && window.confirm(`Recover unsaved changes for ${t.name}?`)
                                    ? recovery.value
                                    : content;
                                restored.push({path: t.path, name: t.name, value, saved: content});
                                if (value !== content) {
                                    setSaveStatus('recovery');
                                }
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
                reportError('Failed to restore open tabs', e);
            }
            setTabsLoaded(true);
        })();
        void loadEditorSettings().then(s => {
            setEditorSettings(s);
            setFormatOnSave(s.formatOnSave ?? false);
        });
        void loadRecentProjects();
        void GetProjectRoot().then(r => {
            if (r) setProjectRoot(r);
        }).catch(() => {});
    }, [loadRecentProjects]);

    const pendingJumpRef = useRef<{line: number; col: number} | null>(null);

    const jumpToLineCol = useCallback((line: number, col: number) => {
        const editor = editorRef.current;
        if (editor) {
            editor.revealPositionInCenter({lineNumber: line, column: col});
            editor.setPosition({lineNumber: line, column: col});
            editor.focus();
        }
    }, []);

    useEffect(() => {
        if (pendingJumpRef.current && activeTabIndex >= 0) {
            const {line, col} = pendingJumpRef.current;
            const timer = setTimeout(() => {
                jumpToLineCol(line, col);
                pendingJumpRef.current = null;
            }, 70);
            return () => clearTimeout(timer);
        }
    }, [activeTabIndex, jumpToLineCol]);

    async function openFile(nextPath: string, nextName: string, line?: number, col?: number) {
        if (line !== undefined) {
            pendingJumpRef.current = {line, col: col ?? 1};
        }
        try {
            const existingIndex = tabs.findIndex(t => t.path === nextPath);
            if (existingIndex >= 0) {
                setActiveTabIndex(existingIndex);
                void persistTabs(tabs, existingIndex);
                if (line !== undefined) {
                    setTimeout(() => {
                        jumpToLineCol(line, col ?? 1);
                        pendingJumpRef.current = null;
                    }, 50);
                }
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
            if (line !== undefined) {
                setTimeout(() => {
                    jumpToLineCol(line, col ?? 1);
                    pendingJumpRef.current = null;
                }, 100);
            }
        } catch (err) {
            reportError(`Unable to open ${nextName}`, err);
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

    useEffect(() => {
        if (!tabsLoaded) return;
        const snapshots: RecoverySnapshot[] = tabs
            .filter(tab => tab.value !== tab.saved && !tab.path.startsWith('new:'))
            .map(tab => ({path: tab.path, name: tab.name, value: tab.value, savedAt: Date.now()}));
        if (snapshots.length > 0) {
            localStorage.setItem(RECOVERY_STORAGE_KEY, JSON.stringify(snapshots));
        } else {
            localStorage.removeItem(RECOVERY_STORAGE_KEY);
            setSaveStatus('saved');
        }
    }, [tabs, tabsLoaded]);

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
            reportError('Unable to open project', err);
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
            void loadRecentProjects();
        });
        return () => {
            if (cancel) cancel();
        };
    }, [persistTabs, loadRecentProjects]);

    useEffect(() => {
        const cancel = EventsOn('editor:reload', () => {
            setTabs(prev => {
                const reloadPromises = prev.map(async (tab) => {
                    if (tab.path.startsWith('new:')) return tab;
                    try {
                        const freshContent = await ReadFile(tab.path);
                        if (freshContent !== tab.saved) {
                            const isDirty = tab.value !== tab.saved;
                            return {
                                ...tab,
                                saved: freshContent,
                                value: isDirty ? tab.value : freshContent,
                            };
                        }
                    } catch {
                    }
                    return tab;
                });
                void Promise.all(reloadPromises).then(updated => {
                    setTabs(updated.filter(t => t !== null));
                });
                return prev;
            });
        });
        return () => {
            if (cancel) cancel();
        };
    }, []);

    const openRecentProject = useCallback(async (dir: string) => {
        try {
            await OpenProjectPath(dir);
        } catch (err) {
            reportError('Failed to open recent project', err);
        }
    }, []);

    const clearRecent = useCallback(async () => {
        try {
            await ClearRecentProjects();
            setRecentProjects([]);
            notify('Recent projects cleared', 'info');
        } catch (err) {
            reportError('Failed to clear recent projects', err);
        }
    }, []);

    const save = useCallback(async (index?: number, forceFormat?: boolean) => {
        const idx = index ?? activeTabIndex;
        const tab = tabs[idx];
        if (!tab) return;

        const isDirty = tab.value !== tab.saved;
        const shouldFormat = (formatOnSave || forceFormat) && !tab.path.startsWith('new:');

        if (!isDirty && !shouldFormat) return;

        if (tab.path.startsWith('new:')) {
            void saveAs();
            return;
        }

        try {
            setSaveStatus('saving');

            let contentToSave = tab.value;
            if (shouldFormat) {
                try {
                    const result = await FormatDocument(tab.path, tab.value);
                    if (result?.formatted && !result.error) {
                        contentToSave = result.formatted;
                        setTabs(prev => {
                            const next = [...prev];
                            if (idx >= 0 && idx < next.length) {
                                next[idx] = {...next[idx], value: contentToSave};
                            }
                            return next;
                        });
                    }
                } catch {
                }
            }

            if (!isDirty && contentToSave === tab.saved) {
                setSaveStatus('saved');
                return;
            }

            await WriteFile(tab.path, contentToSave);
            setTabs(prev => {
                const next = [...prev];
                if (idx >= 0 && idx < next.length) {
                    next[idx] = {...next[idx], saved: contentToSave, value: contentToSave};
                }
                return next;
            });
            removeRecoverySnapshot(tab.path);
            setSaveStatus('saved');
        } catch (err) {
            reportError(`Failed to save ${tab.name}`, err);
            setSaveStatus('error');
        }
    }, [activeTabIndex, tabs, formatOnSave]);

    useEffect(() => {
        if (!tabsLoaded) return;
        const timer = window.setInterval(() => {
            const dirtyIndexes = tabs.reduce<number[]>((indexes, tab, index) => {
                if (tab.value !== tab.saved) indexes.push(index);
                return indexes;
            }, []);
            if (dirtyIndexes.length > 0) {
                setSaveStatus('saving');
                void Promise.all(dirtyIndexes.map(index => save(index)));
            }
        }, AUTOSAVE_INTERVAL_MS);
        return () => window.clearInterval(timer);
    }, [save, tabs, tabsLoaded]);

    useEffect(() => {
        const handleBeforeUnload = () => {
            const snapshots = tabs
                .filter(tab => tab.value !== tab.saved && !tab.path.startsWith('new:'))
                .map(tab => ({path: tab.path, name: tab.name, value: tab.value, savedAt: Date.now()}));
            if (snapshots.length > 0) {
                localStorage.setItem(RECOVERY_STORAGE_KEY, JSON.stringify(snapshots));
            }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [tabs]);

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
            reportError(`Failed to save ${tab?.name ?? 'file'}`, err);
            setSaveStatus('error');
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
        if (pendingJumpRef.current) {
            const {line, col} = pendingJumpRef.current;
            jumpToLineCol(line, col);
            pendingJumpRef.current = null;
        }
        if (!snippetsRegistered.current) {
            snippetsRegistered.current = true;
            try {
                const monacoModule = (window as any).monaco ?? editor._standaloneCodeEditor?._modelData?.model?._languageService;
                import('monaco-editor').then(m => {
                    registerAllSnippets(m);
                }).catch(() => {});
            } catch {}
        }
    }, [jumpToLineCol]);

    const handleCursorChange = useCallback((line: number, col: number) => {
        setCursorLine(line);
        setCursorCol(col);
    }, []);

    useEffect(() => {
        setFormatOnSave(editorSettings.formatOnSave ?? false);
    }, [editorSettings.formatOnSave]);

    const formatDocument = useCallback(async () => {
        const tab = tabs[activeTabIndex];
        if (!tab || tab.path.startsWith('new:')) {
            notify('No file to format', 'warning');
            return;
        }
        try {
            const result = await FormatDocument(tab.path, tab.value);
            if (result?.formatted && !result.error) {
                setTabs(prev => {
                    const next = [...prev];
                    next[activeTabIndex] = {...next[activeTabIndex], value: result.formatted};
                    return next;
                });
                notify('Document formatted', 'info');
            } else if (result?.error) {
                notify(`Format: ${result.error}`, 'warning');
            }
        } catch (err) {
            reportError('Format failed', err);
        }
    }, [activeTabIndex, tabs]);

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
        formatDocument,
        toggleFormatOnSave: () => {
            const next = !editorSettings.formatOnSave;
            setEditorSettings(prev => {
                const updated = {...prev, formatOnSave: next};
                void SaveEditorSettings(JSON.stringify(updated));
                return updated;
            });
            setFormatOnSave(next);
            notify(`Format on Save: ${next ? 'Enabled' : 'Disabled'}`, 'info');
        },
        openRecentProject,
        clearRecentProjects: clearRecent,
        recentProjects,
    }), [save, saveAs, closeActiveTab, newFile, toggleSidebar, toggleTerminal, toggleAiPanel, handleFind, handleReplace, openGoToLine, handleUndo, handleRedo, handleCut, handleCopy, handlePaste, handleSelectAll, zoomIn, zoomOut, formatDocument, editorSettings.formatOnSave, openRecentProject, clearRecent, recentProjects]);

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
            if (event.shiftKey && event.altKey && (event.key === 'f' || event.key === 'F') && !ctrl) {
                event.preventDefault();
                void formatDocument();
            }
        }
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [save, saveAs, closeActiveTab, newFile, toggleSidebar, toggleTerminal, showTerminal, toggleAiPanel, zoomIn, zoomOut, tabs, activeTabIndex, activateTab, reopenClosedTab, openCommandPalette, openGoToLine, formatDocument]);

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
                recentProjects={recentProjects}
                onOpenRecentProject={(p) => void openRecentProject(p)}
                onClearRecentProjects={() => void clearRecent()}
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
                        onOpenFile={(p, n, l, c) => void openFile(p, n, l, c)}
                        activePath={activePath}
                        collapsed={!sidebarVisible}
                        onCollapsedChange={handleSidebarCollapsedChange}
                        editorSettings={editorSettings}
                        onEditorSettingsChange={setEditorSettings}
                        projectRoot={projectRoot}
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
                            editorSettings={editorSettings}
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
                saveStatus={saveStatus}
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
            <ToastHost />
        </div>
    );
}

function readRecoverySnapshot(path: string): RecoverySnapshot | undefined {
    try {
        const raw = localStorage.getItem(RECOVERY_STORAGE_KEY);
        const snapshots = raw ? JSON.parse(raw) as RecoverySnapshot[] : [];
        return snapshots.find(snapshot => snapshot.path === path);
    } catch (error) {
        console.warn('Unable to read recovery snapshots:', formatError(error));
        notify('Recovery snapshot could not be read', 'warning');
        return undefined;
    }
}

function removeRecoverySnapshot(path: string) {
    try {
        const raw = localStorage.getItem(RECOVERY_STORAGE_KEY);
        const snapshots = raw ? JSON.parse(raw) as RecoverySnapshot[] : [];
        const remaining = snapshots.filter(snapshot => snapshot.path !== path);
        if (remaining.length > 0) localStorage.setItem(RECOVERY_STORAGE_KEY, JSON.stringify(remaining));
        else localStorage.removeItem(RECOVERY_STORAGE_KEY);
    } catch (error) {
        console.warn('Unable to clear recovery snapshot:', formatError(error));
    }
}

export default App;
