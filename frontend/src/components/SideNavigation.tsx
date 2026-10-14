import {useState, useEffect, useCallback} from 'react';
import {Files, Search, GitBranch, Settings, Package, ChevronLeft, ChevronRight} from 'lucide-react';
import {FileExplorer} from './FileExplorer';
import {SearchPanel} from './SearchPanel';
import {SourceControlPanel, type GitEntry} from './SourceControlPanel';
import {SettingsPanel} from './SettingsPanel';
import {ExtensionsPanel} from './ExtensionsPanel';
import type {EditorSettings} from './SettingsPanel';
import {GitStatus, GitCurrentBranch} from '../../wailsjs/go/main/App';
import {EventsOn} from '../../wailsjs/runtime/runtime';
import './SideNavigation.css';

type TabType = 'explorer' | 'search' | 'source-control' | 'extensions' | 'settings';

type Tab = {
    id: TabType;
    label: string;
    icon: React.ReactNode;
};

const tabs: Tab[] = [
    { id: 'explorer', label: 'Explorer', icon: <Files size={18} /> },
    { id: 'search', label: 'Search', icon: <Search size={18} /> },
    { id: 'source-control', label: 'Source Control', icon: <GitBranch size={18} /> },
    { id: 'extensions', label: 'Extensions', icon: <Package size={18} /> },
    { id: 'settings', label: 'Settings', icon: <Settings size={18} /> },
];

type Props = {
    onOpenFile: (path: string, name: string, line?: number, col?: number) => void;
    activePath: string | null;
    explorerKey?: number;
    collapsed?: boolean;
    onCollapsedChange?: (collapsed: boolean) => void;
    editorSettings: EditorSettings;
    onEditorSettingsChange: (settings: EditorSettings) => void;
    projectRoot?: string | null;
};

export function SideNavigation({
    onOpenFile,
    activePath,
    explorerKey = 0,
    collapsed,
    onCollapsedChange,
    editorSettings,
    onEditorSettingsChange,
    projectRoot,
}: Props) {
    const [activeTab, setActiveTab] = useState<TabType>('explorer');
    const [internalCollapsed, setInternalCollapsed] = useState(false);
    const [gitEntries, setGitEntries] = useState<GitEntry[]>([]);
    const [gitBranch, setGitBranch] = useState<string>('');

    const isCollapsed = collapsed !== undefined ? collapsed : internalCollapsed;

    const refreshGit = useCallback(async () => {
        try {
            const [status, br] = await Promise.all([GitStatus(), GitCurrentBranch()]);
            setGitEntries(status || []);
            setGitBranch(br || '');
        } catch {
        }
    }, []);

    useEffect(() => {
        void refreshGit();
    }, [refreshGit, explorerKey]);

    useEffect(() => {
        const off = EventsOn('fs:changed', () => {
            void refreshGit();
        });
        const interval = setInterval(() => {
            void refreshGit();
        }, 3000);
        return () => {
            off();
            clearInterval(interval);
        };
    }, [refreshGit]);

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
                        {tab.id === 'source-control' && gitEntries.length > 0 && (
                            <span className="side-nav-badge">
                                {gitEntries.length > 99 ? '99+' : gitEntries.length}
                            </span>
                        )}
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
                            gitEntries={gitEntries}
                        />
                    )}
                    {activeTab === 'search' && (
                        <SearchPanel onOpenFile={onOpenFile} />
                    )}
                    {activeTab === 'source-control' && (
                        <SourceControlPanel
                            entries={gitEntries}
                            branch={gitBranch}
                            onRefresh={refreshGit}
                        />
                    )}
                    {activeTab === 'extensions' && (
                        <ExtensionsPanel projectRoot={projectRoot ?? null} />
                    )}
                    {activeTab === 'settings' && (
                        <SettingsPanel
                            settings={editorSettings}
                            onSettingsChange={onEditorSettingsChange}
                        />
                    )}
                </div>
            )}
        </aside>
    );
}