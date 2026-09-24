import {useState, useEffect, useCallback, useRef} from 'react';
import {SavePanelSizes, GetPanelSizes} from '../../wailsjs/go/main/App';
import './ResizableLayout.css';

type Props = {
    sidebar: React.ReactNode;
    main: React.ReactNode;
    rightPanel: React.ReactNode;
    bottomPanel: React.ReactNode;
    sidebarVisible?: boolean;
    terminalVisible?: boolean;
    aiPanelVisible?: boolean;
    onSidebarAutoCollapse?: () => void;
    onSidebarExpand?: () => void;
};

type PanelSizes = {
    sidebar: number;
    rightPanel: number;
    bottomPanel: number;
};

const DEFAULT_SIZES: PanelSizes = {
    sidebar: 20,
    rightPanel: 25,
    bottomPanel: 30
};

const MIN_SIZES = {
    sidebar: 10,
    rightPanel: 15,
    bottomPanel: 15
};

export function ResizableLayout({
    sidebar,
    main,
    rightPanel,
    bottomPanel,
    sidebarVisible = true,
    terminalVisible = true,
    aiPanelVisible = true,
    onSidebarAutoCollapse,
    onSidebarExpand
}: Props) {
    const [sidebarSize, setSidebarSize] = useState<number>(DEFAULT_SIZES.sidebar);
    const [rightPanelSize, setRightPanelSize] = useState<number>(DEFAULT_SIZES.rightPanel);
    const [bottomPanelSize, setBottomPanelSize] = useState<number>(DEFAULT_SIZES.bottomPanel);
    const [isResizing, setIsResizing] = useState<'horizontal-left' | 'horizontal-right' | 'vertical' | null>(null);

    const containerRef = useRef<HTMLDivElement>(null);
    const lastValidSidebarSize = useRef<number>(DEFAULT_SIZES.sidebar);
    const sidebarVisibleRef = useRef<boolean>(sidebarVisible);
    sidebarVisibleRef.current = sidebarVisible;

    // Load saved sizes from SQLite
    useEffect(() => {
        const loadSizes = async () => {
            try {
                const savedSizes = await GetPanelSizes();
                if (savedSizes) {
                    const parsed = JSON.parse(savedSizes) as PanelSizes;
                    if (parsed.sidebar) {
                        const valid = Math.min(50, Math.max(MIN_SIZES.sidebar, parsed.sidebar));
                        setSidebarSize(valid);
                        lastValidSidebarSize.current = valid;
                    }
                    if (parsed.rightPanel) {
                        const valid = Math.min(50, Math.max(MIN_SIZES.rightPanel, parsed.rightPanel));
                        setRightPanelSize(valid);
                    }
                    if (parsed.bottomPanel) {
                        const valid = Math.min(60, Math.max(MIN_SIZES.bottomPanel, parsed.bottomPanel));
                        setBottomPanelSize(valid);
                    }
                }
            } catch (e) {
                console.error('Failed to load saved panel sizes:', e);
            }
        };
        void loadSizes();
    }, []);

    // Save sizes to SQLite
    const saveSizes = useCallback(async (sizes: PanelSizes) => {
        try {
            await SavePanelSizes(JSON.stringify(sizes));
        } catch (e) {
            console.error('Failed to save panel sizes:', e);
        }
    }, []);

    const handleMouseDown = useCallback((e: React.MouseEvent, direction: 'horizontal-left' | 'horizontal-right' | 'vertical') => {
        e.preventDefault();
        setIsResizing(direction);
    }, []);

    const handleMouseMove = useCallback((e: globalThis.MouseEvent) => {
        if (!isResizing || !containerRef.current) return;

        const containerRect = containerRef.current.getBoundingClientRect();
        const totalWidth = containerRect.width;
        const totalHeight = containerRect.height;
        if (totalWidth <= 0 || totalHeight <= 0) return;

        if (isResizing === 'horizontal-left') {
            const currentMouseX = e.clientX - containerRect.left;
            // Navigation Rail is 48px.
            // Collapse when pushed to the rail (<= 56px).
            // Expand when pulled away from the rail (>= 62px).
            const collapseThreshold = 56;
            const expandThreshold = 62;

            if (currentMouseX <= collapseThreshold) {
                if (sidebarVisibleRef.current && onSidebarAutoCollapse) {
                    sidebarVisibleRef.current = false;
                    onSidebarAutoCollapse();
                }
                // Do not kill isResizing! The user can smoothly drag back to the right anytime.
            } else if (currentMouseX >= expandThreshold) {
                if (!sidebarVisibleRef.current && onSidebarExpand) {
                    sidebarVisibleRef.current = true;
                    onSidebarExpand();
                }

                const newPercent = (currentMouseX / totalWidth) * 100;
                const clamped = Math.min(50, Math.max(5, newPercent));
                if (clamped >= 12) {
                    lastValidSidebarSize.current = clamped;
                }
                setSidebarSize(clamped);
            }
        } else if (isResizing === 'horizontal-right') {
            const currentMouseRight = containerRect.right - e.clientX;
            const newPercent = (currentMouseRight / totalWidth) * 100;
            const clamped = Math.min(50, Math.max(MIN_SIZES.rightPanel, newPercent));
            setRightPanelSize(clamped);
        } else if (isResizing === 'vertical') {
            const currentMouseBottom = containerRect.bottom - e.clientY;
            const newPercent = (currentMouseBottom / totalHeight) * 100;
            const clamped = Math.min(60, Math.max(MIN_SIZES.bottomPanel, newPercent));
            setBottomPanelSize(clamped);
        }
    }, [isResizing, rightPanelSize, bottomPanelSize, onSidebarAutoCollapse, onSidebarExpand]);

    const handleMouseUp = useCallback(() => {
        if (isResizing) {
            setIsResizing(null);
            void saveSizes({
                sidebar: lastValidSidebarSize.current,
                rightPanel: rightPanelSize,
                bottomPanel: bottomPanelSize
            });
        }
    }, [isResizing, rightPanelSize, bottomPanelSize, saveSizes]);

    useEffect(() => {
        if (isResizing) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
            return () => {
                window.removeEventListener('mousemove', handleMouseMove);
                window.removeEventListener('mouseup', handleMouseUp);
            };
        }
    }, [isResizing, handleMouseMove, handleMouseUp]);

    const editorHeight = terminalVisible ? (100 - bottomPanelSize) : 100;

    return (
        <div
            className={`resizable-layout ${isResizing ? `resizing ${isResizing === 'vertical' ? 'resizing-row' : 'resizing-col'}` : ''}`}
            ref={containerRef}
            style={{flex: 1, minHeight: 0, width: '100%', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden'}}
        >
            <div
                className="main-panel-group"
                style={{
                    display: 'flex',
                    flexDirection: 'row',
                    flex: 1,
                    minHeight: 0,
                    height: '100%',
                    width: '100%',
                    overflow: 'hidden'
                }}
            >
                <div
                    className="sidebar-panel"
                    style={{
                        width: sidebarVisible ? `${sidebarSize}%` : '48px',
                        minWidth: '48px',
                        height: '100%',
                        flexShrink: 0,
                        display: 'flex',
                        flexDirection: 'column',
                        overflow: 'hidden',
                        transition: isResizing ? 'none' : 'width 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                    }}
                >
                    {sidebar}
                </div>
                <div
                    className={`resize-handle horizontal ${isResizing === 'horizontal-left' ? 'active' : ''}`}
                    onMouseDown={(e) => handleMouseDown(e, 'horizontal-left')}
                />
                <div
                    className="center-panel"
                    style={{
                        flex: 1,
                        minWidth: 0,
                        height: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        overflow: 'hidden'
                    }}
                >
                    <div
                        className="editor-panel"
                        style={{
                            height: `${editorHeight}%`,
                            minHeight: '20%',
                            flex: 1,
                            display: 'flex',
                            flexDirection: 'column',
                            overflow: 'hidden'
                        }}
                    >
                        {main}
                    </div>
                    {terminalVisible && (
                        <>
                            <div
                                className={`resize-handle vertical ${isResizing === 'vertical' ? 'active' : ''}`}
                                onMouseDown={(e) => handleMouseDown(e, 'vertical')}
                            />
                            <div
                                className="bottom-panel"
                                style={{
                                    height: `${bottomPanelSize}%`,
                                    minHeight: `${MIN_SIZES.bottomPanel}%`,
                                    flexShrink: 0,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    overflow: 'hidden'
                                }}
                            >
                                {bottomPanel}
                            </div>
                        </>
                    )}
                </div>
                {aiPanelVisible && (
                    <>
                        <div
                            className={`resize-handle horizontal ${isResizing === 'horizontal-right' ? 'active' : ''}`}
                            onMouseDown={(e) => handleMouseDown(e, 'horizontal-right')}
                        />
                        <div
                            className="right-panel"
                            style={{
                                width: `${rightPanelSize}%`,
                                minWidth: `${MIN_SIZES.rightPanel}%`,
                                height: '100%',
                                flexShrink: 0,
                                display: 'flex',
                                flexDirection: 'column',
                                overflow: 'hidden'
                            }}
                        >
                            {rightPanel}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}