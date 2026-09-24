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
    FilePlus,
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
    Plus
} from 'lucide-react';
import './MenuBar.css';

type MenuItem = {
    label: string;
    icon?: React.ReactNode;
    shortcut?: string;
    action?: () => void;
    submenu?: MenuItem[];
};

type MenuBarProps = {
    onSave?: () => void;
    onOpenProject?: () => void;
    onToggleSidebar?: () => void;
    onToggleTerminal?: () => void;
    onToggleAiPanel?: () => void;
};

export function MenuBar({onSave, onOpenProject, onToggleSidebar, onToggleTerminal, onToggleAiPanel}: MenuBarProps) {
    const [activeMenu, setActiveMenu] = useState<string | null>(null);

    const menuItems: Record<string, { label: string; icon: React.ReactNode; items: MenuItem[] }> = {
        file: {
            label: 'File',
            icon: <FileText size={16} />,
            items: [
                { label: 'New', icon: <FilePlus size={14} />, shortcut: 'Ctrl+N', action: () => console.log('New file') },
                { label: 'Open Project', icon: <FolderOpen size={14} />, shortcut: 'Ctrl+O', action: onOpenProject },
                { label: 'Save', icon: <Save size={14} />, shortcut: 'Ctrl+S', action: onSave },
                { label: 'Save As', icon: <Save size={14} />, shortcut: 'Ctrl+Shift+S', action: () => console.log('Save as') },
                { label: 'Close', icon: <X size={14} />, shortcut: 'Ctrl+W', action: () => console.log('Close file') },
                { label: 'Exit', icon: <X size={14} />, shortcut: 'Alt+F4', action: () => console.log('Exit') },
            ]
        },
        edit: {
            label: 'Edit',
            icon: <Edit3 size={16} />,
            items: [
                { label: 'Undo', icon: <Undo size={14} />, shortcut: 'Ctrl+Z', action: () => console.log('Undo') },
                { label: 'Redo', icon: <Redo size={14} />, shortcut: 'Ctrl+Y', action: () => console.log('Redo') },
                { label: 'Cut', icon: <Scissors size={14} />, shortcut: 'Ctrl+X', action: () => console.log('Cut') },
                { label: 'Copy', icon: <Copy size={14} />, shortcut: 'Ctrl+C', action: () => console.log('Copy') },
                { label: 'Paste', icon: <Clipboard size={14} />, shortcut: 'Ctrl+V', action: () => console.log('Paste') },
                { label: 'Find', icon: <Search size={14} />, shortcut: 'Ctrl+F', action: () => console.log('Find') },
                { label: 'Replace', icon: <Replace size={14} />, shortcut: 'Ctrl+H', action: () => console.log('Replace') },
            ]
        },
        selection: {
            label: 'Selection',
            icon: <CheckSquare size={16} />,
            items: [
                { label: 'Select All', icon: <CheckSquare size={14} />, shortcut: 'Ctrl+A', action: () => console.log('Select all') },
                { label: 'Expand Selection', icon: <Maximize size={14} />, shortcut: 'Ctrl+Shift+→', action: () => console.log('Expand selection') },
                { label: 'Shrink Selection', icon: <Minimize size={14} />, shortcut: 'Ctrl+Shift+←', action: () => console.log('Shrink selection') },
            ]
        },
        view: {
            label: 'View',
            icon: <Eye size={16} />,
            items: [
                { label: 'Toggle Sidebar', icon: <Layers size={14} />, shortcut: 'Ctrl+B', action: onToggleSidebar },
                { label: 'Toggle Terminal', icon: <Terminal size={14} />, shortcut: 'Ctrl+`', action: onToggleTerminal },
                { label: 'Toggle AI Panel', icon: <File size={14} />, shortcut: 'Ctrl+Shift+M', action: onToggleAiPanel },
                { label: 'Zoom In', icon: <ZoomIn size={14} />, shortcut: 'Ctrl++', action: () => console.log('Zoom in') },
                { label: 'Zoom Out', icon: <ZoomOut size={14} />, shortcut: 'Ctrl+-', action: () => console.log('Zoom out') },
            ]
        },
        go: {
            label: 'Go',
            icon: <ArrowRight size={16} />,
            items: [
                { label: 'Go to File', icon: <File size={14} />, shortcut: 'Ctrl+P', action: () => console.log('Go to file') },
                { label: 'Go to Line', icon: <Hash size={14} />, shortcut: 'Ctrl+G', action: () => console.log('Go to line') },
                { label: 'Go to Symbol', icon: <ArrowRightIcon size={14} />, shortcut: 'Ctrl+Shift+O', action: () => console.log('Go to symbol') },
            ]
        },
        run: {
            label: 'Run',
            icon: <Play size={16} />,
            items: [
                { label: 'Run Current File', icon: <Play size={14} />, shortcut: 'F5', action: () => console.log('Run current file') },
                { label: 'Run Project', icon: <Play size={14} />, shortcut: 'Ctrl+F5', action: () => console.log('Run project') },
            ]
        },
        terminal: {
            label: 'Terminal',
            icon: <Terminal size={16} />,
            items: [
                { label: 'New Terminal', icon: <Plus size={14} />, shortcut: 'Ctrl+Shift+`', action: () => console.log('New terminal') },
                { label: 'Split Terminal', icon: <Split size={14} />, shortcut: 'Ctrl+Shift+5', action: () => console.log('Split terminal') },
            ]
        }
    };

    const handleMenuClick = (menuKey: string) => {
        setActiveMenu(activeMenu === menuKey ? null : menuKey);
    };

    const handleMenuItemClick = (item: MenuItem) => {
        if (item.action) {
            item.action();
        }
        setActiveMenu(null);
    };

    const handleMenuMouseEnter = (menuKey: string) => {
        setActiveMenu(menuKey);
    };

    const handleMenuMouseLeave = () => {
        // Delay closing to allow user to move to dropdown
        setTimeout(() => {
            setActiveMenu(null);
        }, 200);
    };

    const handleDropdownMouseEnter = () => {
        // Keep menu open when hovering over dropdown
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
                            {menu.items.map((item, index) => (
                                <div
                                    key={index}
                                    className="menu-dropdown-item"
                                    onClick={() => handleMenuItemClick(item)}
                                >
                                    <span className="dropdown-icon">{item.icon}</span>
                                    <span className="dropdown-label">{item.label}</span>
                                    {item.shortcut && <span className="dropdown-shortcut">{item.shortcut}</span>}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            ))}
        </nav>
    );
}