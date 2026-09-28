import {useRef, useCallback, useEffect, useState} from 'react';
import Editor, {OnMount} from '@monaco-editor/react';
import {languageFromPath} from '../lib/language';
import {getFileIcon} from '../lib/fileIcons';
import {X, ChevronLeft, ChevronRight} from 'lucide-react';
import './EditorPane.css';

export type TabInfo = {
    path: string;
    name: string;
    value: string;
    saved: string;
};

type Props = {
    tabs: TabInfo[];
    activeTabIndex: number;
    onActivateTab: (index: number) => void;
    onCloseTab: (index: number) => void;
    onChangeContent: (index: number, value: string) => void;
    onSave: (index: number) => void;
    onEditorMount?: (editor: any) => void;
    onCursorChange?: (line: number, col: number) => void;
};

export function EditorPane({
    tabs,
    activeTabIndex,
    onActivateTab,
    onCloseTab,
    onChangeContent,
    onSave,
    onEditorMount,
    onCursorChange,
}: Props) {
    const tabBarRef = useRef<HTMLDivElement>(null);
    const editorInstanceRef = useRef<any>(null);
    const [showScrollLeft, setShowScrollLeft] = useState(false);
    const [showScrollRight, setShowScrollRight] = useState(false);

    const activeTab = tabs[activeTabIndex] ?? null;

    const checkScrollButtons = useCallback(() => {
        const el = tabBarRef.current;
        if (!el) {
            setShowScrollLeft(false);
            setShowScrollRight(false);
            return;
        }
        setShowScrollLeft(el.scrollLeft > 0);
        setShowScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
    }, []);

    useEffect(() => {
        checkScrollButtons();
    }, [tabs, activeTabIndex, checkScrollButtons]);

    useEffect(() => {
        const el = tabBarRef.current;
        if (!el) return;
        el.addEventListener('scroll', checkScrollButtons);
        const ro = new ResizeObserver(checkScrollButtons);
        ro.observe(el);
        return () => {
            el.removeEventListener('scroll', checkScrollButtons);
            ro.disconnect();
        };
    }, [checkScrollButtons]);

    useEffect(() => {
        const el = tabBarRef.current;
        if (!el) return;
        const activeEl = el.querySelector('.editor-tab.active') as HTMLElement | null;
        if (activeEl) {
            activeEl.scrollIntoView({behavior: 'smooth', block: 'nearest', inline: 'nearest'});
        }
    }, [activeTabIndex]);

    const scrollTabBar = useCallback((direction: 'left' | 'right') => {
        const el = tabBarRef.current;
        if (!el) return;
        const amount = 150;
        el.scrollBy({left: direction === 'left' ? -amount : amount, behavior: 'smooth'});
    }, []);

    const handleMount: OnMount = (editor, _monaco) => {
        editorInstanceRef.current = editor;
        if (onEditorMount) {
            onEditorMount(editor);
        }
        editor.onDidChangeCursorPosition((e: any) => {
            if (onCursorChange) {
                onCursorChange(e.position.lineNumber, e.position.column);
            }
        });
        const pos = editor.getPosition();
        if (pos && onCursorChange) {
            onCursorChange(pos.lineNumber, pos.column);
        }
    };

    const handleTabWheel = useCallback((e: React.WheelEvent) => {
        const el = tabBarRef.current;
        if (!el) return;
        e.preventDefault();
        el.scrollLeft += e.deltaY > 0 ? 60 : -60;
    }, []);

    const handleMiddleClick = useCallback((e: React.MouseEvent, index: number) => {
        if (e.button === 1) {
            e.preventDefault();
            onCloseTab(index);
        }
    }, [onCloseTab]);

    if (tabs.length === 0) {
        return (
            <section className="editor-pane">
                <header className="pane-header editor-header">
                    <span className="editor-title">Editor</span>
                </header>
                <div className="editor-empty">
                    <div className="editor-empty-content">
                        <div className="editor-empty-icon">
                            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
                                <polyline points="14 2 14 8 20 8"/>
                            </svg>
                        </div>
                        <p>Open a folder, then select a file to edit.</p>
                        <span className="editor-empty-hint">Ctrl+O to open project • Click file in explorer</span>
                    </div>
                </div>
            </section>
        );
    }

    return (
        <section className="editor-pane">
            <header className="pane-header editor-header">
                <div className="editor-tab-bar-wrapper">
                    {showScrollLeft && (
                        <button
                            type="button"
                            className="tab-scroll-btn tab-scroll-left"
                            onClick={() => scrollTabBar('left')}
                            title="Scroll tabs left"
                        >
                            <ChevronLeft size={14} />
                        </button>
                    )}
                    <div
                        className="editor-tab-bar"
                        ref={tabBarRef}
                        onWheel={handleTabWheel}
                    >
                        {tabs.map((tab, index) => {
                            const isDirty = tab.value !== tab.saved;
                            const isActive = index === activeTabIndex;
                            const fileIcon = getFileIcon(tab.name, false);
                            return (
                                <div
                                    key={tab.path}
                                    className={`editor-tab ${isActive ? 'active' : ''} ${isDirty ? 'dirty' : ''}`}
                                    onClick={() => onActivateTab(index)}
                                    onMouseDown={(e) => handleMiddleClick(e, index)}
                                    title={tab.path}
                                >
                                    {fileIcon && (
                                        <span className="editor-tab-icon" style={{color: fileIcon.color}}>
                                            {fileIcon.icon}
                                        </span>
                                    )}
                                    <span className="editor-tab-name">
                                        {tab.name}
                                    </span>
                                    <button
                                        type="button"
                                        className="editor-tab-close"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onCloseTab(index);
                                        }}
                                        title="Close (Ctrl+W)"
                                    >
                                        {isDirty ? (
                                            <span className="editor-tab-dirty-dot" />
                                        ) : (
                                            <X size={13} />
                                        )}
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                    {showScrollRight && (
                        <button
                            type="button"
                            className="tab-scroll-btn tab-scroll-right"
                            onClick={() => scrollTabBar('right')}
                            title="Scroll tabs right"
                        >
                            <ChevronRight size={14} />
                        </button>
                    )}
                </div>
                <div className="editor-header-actions">
                    {activeTab && (
                        <button
                            type="button"
                            className="editor-save-btn"
                            disabled={activeTab.value === activeTab.saved}
                            onClick={() => onSave(activeTabIndex)}
                            title="Save File (Ctrl+S)"
                        >
                            Save
                        </button>
                    )}
                </div>
            </header>
            {activeTab && (
                <div className="editor-host">
                    <Editor
                        height="100%"
                        theme="vs-dark"
                        path={activeTab.path}
                        language={languageFromPath(activeTab.path)}
                        value={activeTab.value}
                        onChange={(next) => onChangeContent(activeTabIndex, next ?? '')}
                        onMount={handleMount}
                        options={{
                            minimap: {enabled: true},
                            fontSize: 13,
                            automaticLayout: true,
                            wordWrap: 'on',
                        }}
                    />
                </div>
            )}
        </section>
    );
}
