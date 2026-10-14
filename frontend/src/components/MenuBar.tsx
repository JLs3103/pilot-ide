import {useState} from 'react';
import {
    FileText,
    Edit3,
    Layers,
    Eye,
    ArrowRight,
    Play,
    Terminal,
    ChevronDown,
    Save,
    FolderOpen,
    X,
    Undo,
    Redo,
    Scissors,
    Copy,
    Clipboard,
    Search,
    Replace,
    CheckSquare,
    Minimize,
    Maximize,
    ZoomIn,
    ZoomOut,
    File,
    ArrowRight as ArrowRightIcon,
    Hash,
    Split,
    Plus,
    Command,
    ChevronRight
} from 'lucide-react';
import './MenuBar.css';

type MenuItem = {
    label: string;
    icon?: React.ReactNode;
    shortcut?: string;
    action?: () => void;
    separator?: boolean;
    submenu?: MenuItem[];
};

type MenuBarProps = {
    onSave?: () => void;
    onSaveAs?: () => void;
    onCloseFile?: () => void;
    onExit?: () => void;
    onOpenProject?: () => void;
    onNewFile?: () => void;
    onToggleSidebar?: () => void;
    onToggleTerminal?: () => void;
    onToggleAiPanel?: () => void;
    onNewTerminal?: () => void;
    onSplitTerminal?: () => void;
    onZoomIn?: () => void;
    onZoomOut?: () => void;
    onUndo?: () => void;
    onRedo?: () => void;
    onCut?: () => void;
    onCopy?: () => void;
    onPaste?: () => void;
    onFind?: () => void;
    onReplace?: () => void;
    onSelectAll?: () => void;
    onGoToLine?: () => void;
    onCommandPalette?: () => void;
    recentProjects?: Array<{path: string; name: string}>;
    onOpenRecentProject?: (path: string) => void;
    onClearRecentProjects?: () => void;
};

export function MenuBar({
    onSave, onSaveAs, onCloseFile, onExit, onOpenProject, onNewFile,
    onToggleSidebar, onToggleTerminal, onToggleAiPanel,
    onNewTerminal, onSplitTerminal,
    onZoomIn, onZoomOut,
    onUndo, onRedo, onCut, onCopy, onPaste, onFind, onReplace, onSelectAll,
    onGoToLine, onCommandPalette,
    recentProjects, onOpenRecentProject, onClearRecentProjects,
}: MenuBarProps) {
    const [activeMenu, setActiveMenu] = useState<string | null>(null);

    const menuItems: Record<string, { label: string; icon: React.ReactNode; items: MenuItem[] }> = {
        file: {
            label: 'File',
            icon: <FileText size={16} />,
            items: [
                { label: 'New File', icon: <Plus size={14} />, shortcut: 'Ctrl+N', action: onNewFile },
                { label: 'Open Project...', icon: <FolderOpen size={14} />, shortcut: 'Ctrl+O', action: onOpenProject },
                {
                    label: 'Open Recent',
                    icon: <Layers size={14} />,
                    submenu: recentProjects && recentProjects.length > 0 ? [
                        ...recentProjects.map(p => ({
                            label: p.name,
                            icon: <FolderOpen size={13} />,
                            shortcut: p.path.length > 30 ? '...' + p.path.slice(-27) : p.path,
                            action: () => onOpenRecentProject && onOpenRecentProject(p.path),
                        })),
                        { label: 'separator', separator: true },
                        {
                            label: 'Clear Recently Opened',
                            icon: <X size={13} />,
                            action: onClearRecentProjects,
                        },
                    ] : [
                        { label: 'No Recent Projects', action: () => {} },
                    ],
                },
                { label: 'separator', separator: true },
                { label: 'Save', icon: <Save size={14} />, shortcut: 'Ctrl+S', action: onSave },
                { label: 'Save As', icon: <Save size={14} />, shortcut: 'Ctrl+Shift+S', action: onSaveAs },
                { label: 'separator', separator: true },
                { label: 'Close', icon: <X size={14} />, shortcut: 'Ctrl+W', action: onCloseFile },
                { label: 'Exit', icon: <X size={14} />, shortcut: 'Alt+F4', action: onExit },
            ]
        },
        edit: {
            label: 'Edit',
            icon: <Edit3 size={16} />,
            items: [
                { label: 'Undo', icon: <Undo size={14} />, shortcut: 'Ctrl+Z', action: onUndo },
                { label: 'Redo', icon: <Redo size={14} />, shortcut: 'Ctrl+Y', action: onRedo },
                { label: 'separator', separator: true },
                { label: 'Cut', icon: <Scissors size={14} />, shortcut: 'Ctrl+X', action: onCut },
                { label: 'Copy', icon: <Copy size={14} />, shortcut: 'Ctrl+C', action: onCopy },
                { label: 'Paste', icon: <Clipboard size={14} />, shortcut: 'Ctrl+V', action: onPaste },
                { label: 'separator', separator: true },
                { label: 'Find', icon: <Search size={14} />, shortcut: 'Ctrl+F', action: onFind },
                { label: 'Replace', icon: <Replace size={14} />, shortcut: 'Ctrl+H', action: onReplace },
            ]
        },
        selection: {
            label: 'Selection',
            icon: <CheckSquare size={16} />,
            items: [
                { label: 'Select All', icon: <CheckSquare size={14} />, shortcut: 'Ctrl+A', action: onSelectAll },
            ]
        },
        view: {
            label: 'View',
            icon: <Eye size={16} />,
            items: [
                { label: 'Command Palette', icon: <Command size={14} />, shortcut: 'Ctrl+Shift+P', action: onCommandPalette },
                { label: 'separator', separator: true },
                { label: 'Toggle Sidebar', icon: <Layers size={14} />, shortcut: 'Ctrl+B', action: onToggleSidebar },
                { label: 'Toggle Terminal', icon: <Terminal size={14} />, shortcut: 'Ctrl+`', action: onToggleTerminal },
                { label: 'Toggle AI Panel', icon: <File size={14} />, shortcut: 'Ctrl+Shift+M', action: onToggleAiPanel },
                { label: 'separator', separator: true },
                { label: 'Zoom In', icon: <ZoomIn size={14} />, shortcut: 'Ctrl++', action: onZoomIn },
                { label: 'Zoom Out', icon: <ZoomOut size={14} />, shortcut: 'Ctrl+-', action: onZoomOut },
            ]
        },
        go: {
            label: 'Go',
            icon: <ArrowRight size={16} />,
            items: [
                { label: 'Go to Line', icon: <Hash size={14} />, shortcut: 'Ctrl+G', action: onGoToLine },
                { label: 'Go to File', icon: <File size={14} />, shortcut: 'Ctrl+P', action: onCommandPalette },
            ]
        },
        terminal: {
            label: 'Terminal',
            icon: <Terminal size={16} />,
            items: [
                { label: 'New Terminal', icon: <Plus size={14} />, shortcut: 'Ctrl+Shift+`', action: onNewTerminal },
                { label: 'Split Terminal', icon: <Split size={14} />, shortcut: 'Ctrl+Shift+5', action: onSplitTerminal },
            ]
        }
    };

    const handleMenuClick = (menuKey: string) => {
        setActiveMenu(activeMenu === menuKey ? null : menuKey);
    };

    const handleMenuItemClick = (item: MenuItem) => {
        if (item.separator) return;
        if (item.action) {
            item.action();
        }
        setActiveMenu(null);
    };

    const handleMenuMouseEnter = (menuKey: string) => {
        setActiveMenu(menuKey);
    };

    const handleMenuMouseLeave = () => {
        setTimeout(() => {
            setActiveMenu(null);
        }, 200);
    };

    const handleDropdownMouseEnter = () => {
        setActiveMenu(activeMenu);
    };

    const handleDropdownMouseLeave = () => {
        setActiveMenu(null);
    };

    return (
        <nav className="menu-bar">
            {Object.entries(menuItems).map(([key, menu]) => (
                <div
                    key={key}
                    className={`menu-item ${activeMenu === key ? 'active' : ''}`}
                    onMouseEnter={() => handleMenuMouseEnter(key)}
                    onMouseLeave={handleMenuMouseLeave}
                >
                    <button
                        className="menu-button"
                        onClick={() => handleMenuClick(key)}
                    >
                        <span className="menu-icon">{menu.icon}</span>
                        <span className="menu-label">{menu.label}</span>
                        <ChevronDown size={12} className="menu-arrow" />
                    </button>
                    {activeMenu === key && (
                        <div
                            className="menu-dropdown"
                            onMouseEnter={handleDropdownMouseEnter}
                            onMouseLeave={handleDropdownMouseLeave}
                        >
                            {menu.items.map((item, index) => {
                                if (item.separator) {
                                    return <div key={`sep-${index}`} className="menu-dropdown-separator" />;
                                }
                                if (item.submenu) {
                                    return (
                                        <div
                                            key={index}
                                            className="menu-dropdown-item has-submenu"
                                        >
                                            <span className="dropdown-icon">{item.icon}</span>
                                            <span className="dropdown-label">{item.label}</span>
                                            <ChevronRight size={12} className="dropdown-arrow" />
                                            <div className="menu-submenu">
                                                {item.submenu.map((sub, sIdx) => {
                                                    if (sub.separator) {
                                                        return <div key={`s-sep-${sIdx}`} className="menu-dropdown-separator" />;
                                                    }
                                                    return (
                                                        <div
                                                            key={`s-${sIdx}`}
                                                            className="menu-dropdown-item"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleMenuItemClick(sub);
                                                            }}
                                                            title={sub.shortcut ? sub.shortcut : undefined}
                                                        >
                                                            {sub.icon && <span className="dropdown-icon">{sub.icon}</span>}
                                                            <span className="dropdown-label">{sub.label}</span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                }
                                return (
                                    <div
                                        key={index}
                                        className="menu-dropdown-item"
                                        onClick={() => handleMenuItemClick(item)}
                                    >
                                        <span className="dropdown-icon">{item.icon}</span>
                                        <span className="dropdown-label">{item.label}</span>
                                        {item.shortcut && <span className="dropdown-shortcut">{item.shortcut}</span>}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            ))}
        </nav>
    );
}