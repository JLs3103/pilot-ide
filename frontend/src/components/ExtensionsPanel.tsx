import {useState, useEffect, useCallback} from 'react';
import {GetCustomSnippets, InitProjectConfig, GetProjectSettings, SaveProjectSettings, GetProjectRoot} from '../../wailsjs/go/main/App';
import {Package, Puzzle, Code2, Palette, FileJson, Settings2, Check, Download, RefreshCw, ToggleLeft, ToggleRight} from 'lucide-react';
import './ExtensionsPanel.css';

type BuiltinExtension = {
    id: string;
    name: string;
    description: string;
    category: string;
    icon: React.ReactNode;
    enabled: boolean;
    builtin: true;
};

type ProjectSettings = {
    formatOnSave: boolean;
    tabSize?: number;
    theme?: string;
    fontSize?: number;
    lineHeight?: number;
    wordWrap?: string;
    minimap?: boolean;
    formatters?: Record<string, string>;
    excludeFiles?: string[];
};

const defaultExtensions: BuiltinExtension[] = [
    {
        id: 'code-intelligence',
        name: 'Code Intelligence',
        description: 'IntelliSense, auto-complete, parameter hints, hover info, and bracket matching for all supported languages.',
        category: 'Language',
        icon: <Code2 size={18} />,
        enabled: true,
        builtin: true,
    },
    {
        id: 'snippet-pack',
        name: 'Built-in Snippet Pack',
        description: 'Pre-configured code snippets for JavaScript, TypeScript, Go, Python, HTML, CSS, Rust, SQL, and more.',
        category: 'Snippets',
        icon: <Puzzle size={18} />,
        enabled: true,
        builtin: true,
    },
    {
        id: 'code-formatting',
        name: 'Code Formatter',
        description: 'Auto-format documents using external formatters like gofmt, Prettier, Black, or rustfmt.',
        category: 'Formatter',
        icon: <FileJson size={18} />,
        enabled: true,
        builtin: true,
    },
    {
        id: 'bracket-colorizer',
        name: 'Bracket Pair Colorizer',
        description: 'Colorize matching bracket pairs with distinct colors for better code readability.',
        category: 'Editor',
        icon: <Palette size={18} />,
        enabled: true,
        builtin: true,
    },
    {
        id: 'git-integration',
        name: 'Git Integration',
        description: 'Full Git source control: stage, commit, push, pull, diff, blame, branch switching, and status indicators.',
        category: 'Source Control',
        icon: <Package size={18} />,
        enabled: true,
        builtin: true,
    },
    {
        id: 'project-config',
        name: 'Project Configuration',
        description: 'Per-project settings via .pilot/settings.json for formatters, editor preferences, and workspace configuration.',
        category: 'Project',
        icon: <Settings2 size={18} />,
        enabled: true,
        builtin: true,
    },
];

type Props = {
    projectRoot: string | null;
};

export function ExtensionsPanel({projectRoot}: Props) {
    const [currentProjectRoot, setCurrentProjectRoot] = useState<string | null>(projectRoot);
    const [extensions, setExtensions] = useState<BuiltinExtension[]>(defaultExtensions);
    const [snippetCount, setSnippetCount] = useState(0);
    const [projectSettings, setProjectSettings] = useState<ProjectSettings | null>(null);
    const [activeTab, setActiveTab] = useState<'installed' | 'settings'>('installed');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (projectRoot) {
            setCurrentProjectRoot(projectRoot);
        } else {
            void GetProjectRoot().then(r => {
                if (r) setCurrentProjectRoot(r);
            }).catch(() => {});
        }
    }, [projectRoot]);

    const loadData = useCallback(async () => {
        try {
            const snippets = await GetCustomSnippets();
            setSnippetCount(snippets?.length ?? 0);
        } catch {
            setSnippetCount(0);
        }
        try {
            const settings = await GetProjectSettings();
            setProjectSettings(settings);
        } catch {
            setProjectSettings(null);
        }
    }, []);

    useEffect(() => {
        void loadData();
    }, [loadData, currentProjectRoot]);

    const toggleExtension = useCallback((id: string) => {
        setExtensions(prev => prev.map(ext =>
            ext.id === id ? {...ext, enabled: !ext.enabled} : ext
        ));
    }, []);

    const handleInitConfig = useCallback(async () => {
        setLoading(true);
        try {
            await InitProjectConfig();
            await loadData();
        } catch (err) {
            console.error('Failed to init config:', err);
        }
        setLoading(false);
    }, [loadData]);

    const updateProjectSetting = useCallback(async (key: keyof ProjectSettings, value: any) => {
        if (!projectSettings) return;
        const next = {...projectSettings, [key]: value};
        setProjectSettings(next);
        try {
            await SaveProjectSettings(JSON.stringify(next));
        } catch (err) {
            console.error('Failed to save project settings:', err);
        }
    }, [projectSettings]);

    return (
        <div className="extensions-panel">
            <div className="extensions-header">
                <Package size={14} />
                <span className="extensions-title">EXTENSIONS</span>
            </div>

            <div className="extensions-tabs">
                <button
                    className={`ext-tab ${activeTab === 'installed' ? 'active' : ''}`}
                    onClick={() => setActiveTab('installed')}
                >
                    <Puzzle size={13} />
                    Installed
                </button>
                <button
                    className={`ext-tab ${activeTab === 'settings' ? 'active' : ''}`}
                    onClick={() => setActiveTab('settings')}
                >
                    <Settings2 size={13} />
                    Project Config
                </button>
            </div>

            {activeTab === 'installed' && (
                <div className="extensions-list">
                    {extensions.map(ext => (
                        <div key={ext.id} className={`extension-card ${ext.enabled ? '' : 'disabled'}`}>
                            <div className="ext-card-icon">{ext.icon}</div>
                            <div className="ext-card-info">
                                <div className="ext-card-header">
                                    <span className="ext-card-name">{ext.name}</span>
                                    <span className="ext-card-badge">{ext.category}</span>
                                </div>
                                <p className="ext-card-desc">{ext.description}</p>
                                <div className="ext-card-footer">
                                    <span className="ext-card-tag">Built-in</span>
                                    <button
                                        className={`ext-toggle-btn ${ext.enabled ? 'on' : 'off'}`}
                                        onClick={() => toggleExtension(ext.id)}
                                        title={ext.enabled ? 'Disable' : 'Enable'}
                                    >
                                        {ext.enabled ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}

                    {snippetCount > 0 && (
                        <div className="extension-card">
                            <div className="ext-card-icon"><Code2 size={18} /></div>
                            <div className="ext-card-info">
                                <div className="ext-card-header">
                                    <span className="ext-card-name">Custom Snippets</span>
                                    <span className="ext-card-badge">Project</span>
                                </div>
                                <p className="ext-card-desc">{snippetCount} custom snippet{snippetCount > 1 ? 's' : ''} loaded from .pilot/snippets/</p>
                                <div className="ext-card-footer">
                                    <span className="ext-card-tag">Project</span>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="ext-summary">
                        <Check size={13} />
                        <span>{extensions.filter(e => e.enabled).length} extensions active</span>
                    </div>
                </div>
            )}

            {activeTab === 'settings' && (
                <div className="extensions-project-settings">
                    {!currentProjectRoot ? (
                        <div className="ext-no-project">
                            <p>Open a project to configure project-specific settings.</p>
                        </div>
                    ) : !projectSettings ? (
                        <div className="ext-settings-content">
                            <div className="ext-init-section">
                                <p className="ext-init-desc">Initialize a .pilot/settings.json config file for this project.</p>
                                <button
                                    className="ext-init-btn"
                                    onClick={handleInitConfig}
                                    disabled={loading}
                                >
                                    {loading ? <RefreshCw size={13} className="spinning" /> : <Download size={13} />}
                                    Initialize Config
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="ext-settings-content">
                            <div className="ext-setting-row">
                                <label>Format on Save</label>
                                <button
                                    className={`ext-toggle-btn ${projectSettings.formatOnSave ? 'on' : 'off'}`}
                                    onClick={() => void updateProjectSetting('formatOnSave', !projectSettings.formatOnSave)}
                                >
                                    {projectSettings.formatOnSave ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                                </button>
                            </div>

                            {projectSettings.excludeFiles && projectSettings.excludeFiles.length > 0 && (
                                <div className="ext-setting-row">
                                    <label>Excluded Patterns</label>
                                    <div className="ext-exclude-list">
                                        {projectSettings.excludeFiles.map((p, i) => (
                                            <span key={i} className="ext-exclude-tag">{p}</span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="ext-config-path">
                                <FileJson size={12} />
                                <span>.pilot/settings.json</span>
                            </div>

                            <button
                                className="ext-refresh-btn"
                                onClick={() => void loadData()}
                            >
                                <RefreshCw size={13} />
                                Reload Config
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
