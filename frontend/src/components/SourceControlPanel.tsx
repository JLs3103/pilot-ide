import {useState, useCallback, useEffect} from 'react';
import {
    GitStatus, GitStage, GitUnstage, GitCommit,
    GitPush, GitPull, GitBranches, GitSwitchBranch,
    GitDiff, GitCurrentBranch, GitLog
} from '../../wailsjs/go/main/App';
import {
    GitBranch, Plus, Minus, Check, Upload, Download,
    RefreshCw, ChevronDown, ChevronRight, FileText,
    Diff, Clock
} from 'lucide-react';
import './SourceControlPanel.css';

export type GitEntry = { path: string; status: string; staged: boolean };
type BranchInfo = { name: string; current: boolean };
type LogEntry = { hash: string; author: string; date: string; message: string };

type Props = {
    entries: GitEntry[];
    branch: string;
    onRefresh: () => Promise<void>;
};

export function SourceControlPanel({entries, branch, onRefresh}: Props) {
    const [commitMsg, setCommitMsg] = useState('');
    const [branches, setBranches] = useState<BranchInfo[]>([]);
    const [showBranches, setShowBranches] = useState(false);
    const [logEntries, setLogEntries] = useState<LogEntry[]>([]);
    const [showLog, setShowLog] = useState(false);
    const [diffText, setDiffText] = useState('');
    const [diffFile, setDiffFile] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [stagedExpanded, setStagedExpanded] = useState(true);
    const [changesExpanded, setChangesExpanded] = useState(true);

    const staged = entries.filter(e => e.staged);
    const unstaged = entries.filter(e => !e.staged);

    const handleStage = useCallback(async (paths: string[]) => {
        try {
            await GitStage(paths);
            void onRefresh();
        } catch (e) {
            setError(String(e));
        }
    }, [onRefresh]);

    const handleUnstage = useCallback(async (paths: string[]) => {
        try {
            await GitUnstage(paths);
            void onRefresh();
        } catch (e) {
            setError(String(e));
        }
    }, [onRefresh]);

    const handleStageAll = useCallback(async () => {
        try {
            await GitStage([]);
            void onRefresh();
        } catch (e) {
            setError(String(e));
        }
    }, [onRefresh]);

    const handleUnstageAll = useCallback(async () => {
        try {
            await GitUnstage([]);
            void onRefresh();
        } catch (e) {
            setError(String(e));
        }
    }, [onRefresh]);

    const handleRefresh = useCallback(async () => {
        setLoading(true);
        try {
            await onRefresh();
            setError('');
        } catch (e) {
            setError(String(e));
        } finally {
            setLoading(false);
        }
    }, [onRefresh]);

    const handleCommit = useCallback(async () => {
        if (!commitMsg.trim()) return;
        setLoading(true);
        try {
            await GitCommit(commitMsg.trim());
            setCommitMsg('');
            void onRefresh();
        } catch (e) { setError(String(e)); }
        setLoading(false);
    }, [commitMsg, onRefresh]);

    const handlePush = useCallback(async () => {
        setLoading(true);
        try { await GitPush(); setError(''); } catch (e) { setError(String(e)); }
        setLoading(false);
    }, []);

    const handlePull = useCallback(async () => {
        setLoading(true);
        try { await GitPull(); void onRefresh(); } catch (e) { setError(String(e)); }
        setLoading(false);
    }, [onRefresh]);

    const handleShowBranches = useCallback(async () => {
        if (showBranches) { setShowBranches(false); return; }
        try {
            const br = await GitBranches();
            setBranches(br || []);
            setShowBranches(true);
        } catch (e) { setError(String(e)); }
    }, [showBranches]);

    const handleSwitchBranch = useCallback(async (name: string) => {
        try {
            await GitSwitchBranch(name);
            setShowBranches(false);
            void onRefresh();
        } catch (e) { setError(String(e)); }
    }, [onRefresh]);

    const handleShowDiff = useCallback(async (path: string) => {
        try {
            const d = await GitDiff(path);
            setDiffText(d || '(no diff)');
            setDiffFile(path);
        } catch (e) { setError(String(e)); }
    }, []);

    const handleShowLog = useCallback(async () => {
        if (showLog) { setShowLog(false); return; }
        try {
            const logs = await GitLog(20);
            setLogEntries(logs || []);
            setShowLog(true);
        } catch (e) { setError(String(e)); }
    }, [showLog]);

    const statusColor = (status: string) => {
        switch (status) {
            case 'modified': return '#e5c07b';
            case 'added': case 'untracked': return '#98c379';
            case 'deleted': return '#e06c75';
            case 'renamed': return '#61afef';
            default: return '#abb2bf';
        }
    };

    const statusLetter = (status: string) => {
        switch (status) {
            case 'modified': return 'M';
            case 'added': return 'A';
            case 'deleted': return 'D';
            case 'renamed': return 'R';
            case 'untracked': return 'U';
            default: return '?';
        }
    };

    return (
        <div className="scm-panel">
            <div className="scm-header">
                <span className="scm-title">SOURCE CONTROL</span>
                <div className="scm-header-actions">
                    <button className="scm-icon-btn" onClick={handleRefresh} title="Refresh"><RefreshCw size={14} /></button>
                </div>
            </div>

            {/* Branch & actions */}
            <div className="scm-branch-bar">
                <button className="scm-branch-btn" onClick={handleShowBranches} title="Switch Branch">
                    <GitBranch size={13} />
                    <span>{branch || '...'}</span>
                    <ChevronDown size={12} />
                </button>
                <div className="scm-actions">
                    <button className="scm-icon-btn" onClick={handlePull} title="Pull" disabled={loading}><Download size={14} /></button>
                    <button className="scm-icon-btn" onClick={handlePush} title="Push" disabled={loading}><Upload size={14} /></button>
                    <button className="scm-icon-btn" onClick={handleShowLog} title="History"><Clock size={14} /></button>
                </div>
            </div>

            {showBranches && (
                <div className="scm-branch-list">
                    {branches.map(b => (
                        <button
                            key={b.name}
                            className={`scm-branch-item ${b.current ? 'current' : ''}`}
                            onClick={() => !b.current && void handleSwitchBranch(b.name)}
                        >
                            {b.current && <Check size={12} />}
                            <span>{b.name}</span>
                        </button>
                    ))}
                </div>
            )}

            {error && <div className="scm-error">{error}</div>}

            {/* Commit input */}
            <div className="scm-commit-area">
                <textarea
                    className="scm-commit-input"
                    placeholder="Commit message"
                    value={commitMsg}
                    onChange={e => setCommitMsg(e.target.value)}
                    rows={2}
                    onKeyDown={e => {
                        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                            e.preventDefault();
                            void handleCommit();
                        }
                    }}
                />
                <button
                    className="scm-commit-btn"
                    disabled={!commitMsg.trim() || loading || staged.length === 0}
                    onClick={() => void handleCommit()}
                    title="Commit (Ctrl+Enter)"
                >
                    <Check size={14} /> Commit
                </button>
            </div>

            {/* Staged changes */}
            <div className="scm-section">
                <button className="scm-section-header" onClick={() => setStagedExpanded(!stagedExpanded)}>
                    {stagedExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                    <span>Staged Changes</span>
                    <span className="scm-section-count">{staged.length}</span>
                    {staged.length > 0 && (
                        <button className="scm-section-action" onClick={e => { e.stopPropagation(); handleUnstageAll(); }} title="Unstage All">
                            <Minus size={13} />
                        </button>
                    )}
                </button>
                {stagedExpanded && staged.map(entry => (
                    <div key={entry.path} className="scm-file-item">
                        <button className="scm-file-action" onClick={() => void handleUnstage([entry.path])} title="Unstage">
                            <Minus size={12} />
                        </button>
                        <FileText size={13} />
                        <span className="scm-file-name" title={entry.path}>
                            {entry.path.split(/[/\\]/).pop()}
                        </span>
                        <span className="scm-file-status" style={{color: statusColor(entry.status)}}>
                            {statusLetter(entry.status)}
                        </span>
                    </div>
                ))}
            </div>

            {/* Unstaged changes */}
            <div className="scm-section">
                <button className="scm-section-header" onClick={() => setChangesExpanded(!changesExpanded)}>
                    {changesExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                    <span>Changes</span>
                    <span className="scm-section-count">{unstaged.length}</span>
                    {unstaged.length > 0 && (
                        <button className="scm-section-action" onClick={e => { e.stopPropagation(); handleStageAll(); }} title="Stage All">
                            <Plus size={13} />
                        </button>
                    )}
                </button>
                {changesExpanded && unstaged.map(entry => (
                    <div key={entry.path} className="scm-file-item">
                        <button className="scm-file-action" onClick={() => void handleStage([entry.path])} title="Stage">
                            <Plus size={12} />
                        </button>
                        <button className="scm-file-action" onClick={() => void handleShowDiff(entry.path)} title="Show Diff">
                            <Diff size={12} />
                        </button>
                        <FileText size={13} />
                        <span className="scm-file-name" title={entry.path}>
                            {entry.path.split(/[/\\]/).pop()}
                        </span>
                        <span className="scm-file-status" style={{color: statusColor(entry.status)}}>
                            {statusLetter(entry.status)}
                        </span>
                    </div>
                ))}
            </div>

            {/* Diff viewer */}
            {diffText && (
                <div className="scm-diff-area">
                    <div className="scm-diff-header">
                        <span>Diff: {diffFile.split(/[/\\]/).pop()}</span>
                        <button className="scm-icon-btn" onClick={() => { setDiffText(''); setDiffFile(''); }}>✕</button>
                    </div>
                    <pre className="scm-diff-content">{diffText}</pre>
                </div>
            )}

            {/* Git log */}
            {showLog && (
                <div className="scm-log-area">
                    <div className="scm-diff-header">
                        <span>History</span>
                        <button className="scm-icon-btn" onClick={() => setShowLog(false)}>✕</button>
                    </div>
                    <div className="scm-log-list">
                        {logEntries.map(entry => (
                            <div key={entry.hash} className="scm-log-item">
                                <span className="scm-log-hash">{entry.hash}</span>
                                <span className="scm-log-msg">{entry.message}</span>
                                <span className="scm-log-meta">{entry.author} · {entry.date}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
