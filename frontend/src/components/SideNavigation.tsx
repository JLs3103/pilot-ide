import {useState} from 'react';
import {Files, Search, GitBranch, ChevronLeft, ChevronRight} from 'lucide-react';
import {FileExplorer} from './FileExplorer';
import './SideNavigation.css';

type TabType = 'explorer' | 'search' | 'source-control';

type Tab = {
    id: TabType;
    label: string;
    icon: React.ReactNode;
};

const tabs: Tab[] = [
    { id: 'explorer', label: 'Explorer', icon: <Files size={18} /> },
    { id: 'search', label: 'Search', icon: <Search size={18} /> },
    { id: 'source-control', label: 'Source Control', icon: <GitBranch size={18} /> },
];

type Props = {
    onOpenFile: (path: string, name: string) => void;
    activePath: string | null;
    explorerKey?: number;
    collapsed?: boolean;
    onCollapsedChange?: (collapsed: boolean) => void;
};

export function SideNavigation({onOpenFile, activePath, explorerKey = 0, collapsed, onCollapsedChange}: Props) {
    const [activeTab, setActiveTab] = useState<TabType>('explorer');
    const [internalCollapsed, setInternalCollapsed] = useState(false);

    const isCollapsed = collapsed !== undefined ? collapsed : internalCollapsed;

    const handleTabClick = (tabId: TabType) => {
        if (isCollapsed) {
            setActiveTab(tabId);
            setInternalCollapsed(false);
            onCollapsedChange?.(false);
        } else if (activeTab === tabId) {
            setInternalCollapsed(true);
            onCollapsedChange?.(true);
        } else {
            setActiveTab(tabId);
        }
    };

    const handleCollapse = () => {
        const next = !isCollapsed;
        setInternalCollapsed(next);
        onCollapsedChange?.(next);
    };

    return (
        <aside className={`side-navigation ${isCollapsed ? 'collapsed' : ''}`}>
            <div className="side-nav-tabs">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        className={`side-nav-tab ${activeTab === tab.id && !isCollapsed ? 'active' : ''}`}
                        onClick={() => handleTabClick(tab.id)}
                        title={tab.label}
                    >
                        {tab.icon}
                    </button>
                ))}
                <button
                    className="side-nav-collapse"
                    onClick={handleCollapse}
                    title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
                >
                    {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
                </button>
            </div>
            {!isCollapsed && (
                <div className="side-nav-content">
                    {activeTab === 'explorer' && (
                        <FileExplorer
                            key={explorerKey}
                            onOpenFile={onOpenFile}
                            activePath={activePath}
                        />
                    )}
                    {activeTab === 'search' && (
                        <div className="placeholder-content">
                            <Search size={24} />
                            <p>Search & Replace</p>
                            <small>Global search across project files</small>
                        </div>
                    )}
                    {activeTab === 'source-control' && (
                        <div className="placeholder-content">
                            <GitBranch size={24} />
                            <p>Source Control</p>
                            <small>Git status and operations</small>
                        </div>
                    )}
                </div>
            )}
        </aside>
    );
}