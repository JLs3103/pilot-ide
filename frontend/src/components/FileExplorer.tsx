import {useCallback, useEffect, useRef, useState, useMemo} from 'react';
import {GetProjectRoot, ListDir, OpenProject, CreateFile, CreateFolder, RenameFile, DeleteFileOrDir} from '../../wailsjs/go/main/App';
import {EventsOn} from '../../wailsjs/runtime/runtime';
import {getFileIcon} from '../lib/fileIcons';
import {FilePlus, FolderPlus, Pencil, Trash2, RefreshCw, ChevronsDownUp} from 'lucide-react';
import {reportError} from '../lib/notifications';
import type {DirEntry} from '../types';
import type {GitEntry} from './SourceControlPanel';
import './FileExplorer.css';

type Props = {
    onOpenFile: (path: string, name: string, line?: number, col?: number) => void;
    activePath: string | null;
    gitEntries?: GitEntry[];
};

type NodeState = {
    entry: DirEntry;
    expanded?: boolean;
    children?: NodeState[];
};

type ContextMenuState = {
    x: number;
    y: number;
    node: NodeState | null;
    indexPath: number[];
} | null;

type InlineInputState = {
    type: 'new-file' | 'new-folder' | 'rename';
    parentPath: string;
    indexPath: number[];
    oldName?: string;
    oldPath?: string;
    isDir?: boolean;
} | null;

function isDirectory(entry: DirEntry) {
    return Boolean(entry.isDir);
}

function ChevronArrow({expanded}: {expanded: boolean}) {
    return (
        <svg
            className={`tree-chevron-svg${expanded ? ' expanded' : ''}`}
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="currentColor"
        >
            <path d="M6 4l4 4-4 4" />
        </svg>
    );
}

export function FileExplorer({onOpenFile, activePath, gitEntries}: Props) {
    const [root, setRoot] = useState('');
    const [nodes, setNodes] = useState<NodeState[]>([]);
    const [error, setError] = useState('');
    const [contextMenu, setContextMenu] = useState<ContextMenuState>(null);
    const [inlineInput, setInlineInput] = useState<InlineInputState>(null);
    const nodesRef = useRef<NodeState[]>([]);
    const rootRef = useRef('');

    nodesRef.current = nodes;
    rootRef.current = root;

    const gitStatusMap = useMemo(() => {
        const fileMap = new Map<string, GitEntry>();
        const modifiedFolders = new Set<string>();
        const untrackedFolders = new Set<string>();

        if (!gitEntries || gitEntries.length === 0) {
            return { fileMap, modifiedFolders, untrackedFolders };
        }

        for (const entry of gitEntries) {
            const normPath = entry.path.replace(/\\/g, '/').toLowerCase();
            fileMap.set(normPath, entry);

            const parts = normPath.split('/');
            let currentFolder = '';
            for (let i = 0; i < parts.length - 1; i++) {
                currentFolder = currentFolder ? `${currentFolder}/${parts[i]}` : parts[i];
                if (entry.status === 'modified' || entry.status === 'deleted' || entry.status === 'renamed' || entry.staged) {
                    modifiedFolders.add(currentFolder);
                } else if (entry.status === 'untracked' || entry.status === 'added') {
                    untrackedFolders.add(currentFolder);
                }
            }
        }

        return { fileMap, modifiedFolders, untrackedFolders };
    }, [gitEntries]);

    const loadRoot = useCallback(async (path: string, expandedPaths: string[] = []) => {
        setRoot(path);
        if (!path) {
            setNodes([]);
            return;
        }
        try {
            const entries = await ListDir('');
            const next = await hydrate(entries.map((entry) => ({entry})), expandedPaths);
            setNodes(next);
            setError('');
        } catch (err) {
            setError(String(err));
            reportError('Explorer failed to load folder', err);
        }
    }, []);

    useEffect(() => {
        GetProjectRoot().then((path) => {
            if (path) {
                void loadRoot(path);
            }
        });
    }, [loadRoot]);

    useEffect(() => {
        const off = EventsOn('fs:changed', () => {
            if (!rootRef.current) {
                return;
            }
            void loadRoot(rootRef.current, collectExpanded(nodesRef.current));
        });
        return () => off();
    }, [loadRoot]);

    useEffect(() => {
        function handleClickOutside() {
            setContextMenu(null);
        }
        window.addEventListener('click', handleClickOutside);
        return () => window.removeEventListener('click', handleClickOutside);
    }, []);

    async function openFolder() {
        const selected = await OpenProject();
        if (selected) {
            await loadRoot(selected);
        }
    }

    async function toggleDir(indexPath: number[], node: NodeState) {
        if (!isDirectory(node.entry)) {
            onOpenFile(node.entry.path, node.entry.name);
            return;
        }
        const next = structuredClone(nodes) as NodeState[];
        const target = getNode(next, indexPath);
        if (!target) {
            return;
        }
        if (target.expanded) {
            target.expanded = false;
            setNodes(next);
            return;
        }
        try {
            target.children = (await ListDir(target.entry.path)).map((entry) => ({entry}));
            target.expanded = true;
            setError('');
            setNodes(next);
        } catch (err) {
            setError(String(err));
            reportError('Explorer failed to open folder', err);
        }
    }

    function handleContextMenu(e: React.MouseEvent, node: NodeState, indexPath: number[]) {
        e.preventDefault();
        e.stopPropagation();
        setContextMenu({x: e.clientX, y: e.clientY, node, indexPath});
    }

    function handleRootContextMenu(e: React.MouseEvent) {
        e.preventDefault();
        if (!root) return;
        setContextMenu({x: e.clientX, y: e.clientY, node: null, indexPath: []});
    }

    function handleNewFile(parentPath: string, indexPath: number[]) {
        setContextMenu(null);
        setInlineInput({type: 'new-file', parentPath, indexPath});
    }

    function handleTreeDoubleClick(e: React.MouseEvent) {
        if (!root) return;
        if ((e.target as HTMLElement).closest('.inline-file-input')) return;
        if ((e.target as HTMLElement).closest('.explorer-header-icons')) return;
        if ((e.target as HTMLElement).closest('.open-folder-btn')) return;
        handleNewFile(root, []);
    }

    async function handleFolderDoubleClick(node: NodeState, indexPath: number[]) {
        const next = structuredClone(nodes) as NodeState[];
        const target = getNode(next, indexPath);
        if (target) {
            if (!target.children || target.children.length === 0) {
                try {
                    target.children = (await ListDir(target.entry.path)).map((entry) => ({entry}));
                } catch {
                }
            }
            target.expanded = true;
            setNodes(next);
        }
        handleNewFile(node.entry.path, indexPath);
    }

    function handleNewFolder(parentPath: string, indexPath: number[]) {
        setContextMenu(null);
        setInlineInput({type: 'new-folder', parentPath, indexPath});
    }

    function handleRename(node: NodeState, indexPath: number[]) {
        setContextMenu(null);
        setInlineInput({
            type: 'rename',
            parentPath: node.entry.path,
            indexPath,
            oldName: node.entry.name,
            oldPath: node.entry.path,
            isDir: isDirectory(node.entry),
        });
    }

    async function handleDelete(node: NodeState) {
        setContextMenu(null);
        const isDir = isDirectory(node.entry);
        const msg = isDir
            ? `Delete folder "${node.entry.name}" and all its contents?`
            : `Delete file "${node.entry.name}"?`;
        if (!window.confirm(msg)) return;
        try {
            await DeleteFileOrDir(node.entry.path);
        } catch (err) {
            setError(String(err));
            reportError('Explorer delete failed', err);
        }
    }

    async function handleInlineSubmit(name: string) {
        if (!inlineInput || !name.trim()) {
            setInlineInput(null);
            return;
        }
        try {
            const sep = inlineInput.parentPath.includes('/') ? '/' : '\\';
            if (inlineInput.type === 'new-file') {
                const newPath = inlineInput.parentPath + sep + name.trim();
                await CreateFile(newPath);
                onOpenFile(newPath, name.trim());
            } else if (inlineInput.type === 'new-folder') {
                const newPath = inlineInput.parentPath + sep + name.trim();
                await CreateFolder(newPath);
            } else if (inlineInput.type === 'rename' && inlineInput.oldPath) {
                const newPath = await RenameFile(inlineInput.oldPath, name.trim());
                if (newPath && !inlineInput.isDir) {
                    onOpenFile(newPath, name.trim());
                }
            }
        } catch (err) {
            setError(String(err));
            reportError('Explorer file operation failed', err);
        }
        setInlineInput(null);
    }

    function handleRefresh() {
        if (root) {
            void loadRoot(root, collectExpanded(nodesRef.current));
        }
    }

    function handleCollapseAll() {
        setNodes(prev => collapseAll(prev));
    }

    // Extract the project folder display name
    const projectName = root ? root.split(/[/\\]/).filter(Boolean).pop() ?? root : '';

    return (
        <aside className="explorer">
            {/* Header: project name with hover action icons */}
            <div className="explorer-header" onClick={() => { if (!root) void openFolder(); }}>
                {root ? (
                    <>
                        <div className="explorer-project-row" title={root}>
                            <span className="explorer-project-name">{projectName.toUpperCase()}</span>
                            <div className="explorer-header-icons">
                                <button
                                    type="button"
                                    className="explorer-icon-btn"
                                    title="New File"
                                    onClick={(e) => { e.stopPropagation(); handleNewFile(root, []); }}
                                >
                                    <FilePlus size={14} />
                                </button>
                                <button
                                    type="button"
                                    className="explorer-icon-btn"
                                    title="New Folder"
                                    onClick={(e) => { e.stopPropagation(); handleNewFolder(root, []); }}
                                >
                                    <FolderPlus size={14} />
                                </button>
                                <button
                                    type="button"
                                    className="explorer-icon-btn"
                                    title="Refresh Explorer"
                                    onClick={(e) => { e.stopPropagation(); handleRefresh(); }}
                                >
                                    <RefreshCw size={14} />
                                </button>
                                <button
                                    type="button"
                                    className="explorer-icon-btn"
                                    title="Collapse Folders in Explorer"
                                    onClick={(e) => { e.stopPropagation(); handleCollapseAll(); }}
                                >
                                    <ChevronsDownUp size={14} />
                                </button>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="explorer-empty">
                        <button type="button" className="open-folder-btn" onClick={() => void openFolder()}>
                            Open Folder
                        </button>
                    </div>
                )}
            </div>
            {error ? <div className="pane-error">{error}</div> : null}
            <div className="explorer-tree" onContextMenu={handleRootContextMenu} onDoubleClick={handleTreeDoubleClick}>
                {inlineInput && (inlineInput.type === 'new-file' || inlineInput.type === 'new-folder') && inlineInput.parentPath === root && (
                    <InlineFileInput
                        defaultValue=""
                        depth={0}
                        onSubmit={handleInlineSubmit}
                        onCancel={() => setInlineInput(null)}
                    />
                )}
                {nodes.map((node, i) => (
                    <TreeItem
                        key={node.entry.path}
                        node={node}
                        depth={0}
                        indexPath={[i]}
                        activePath={activePath}
                        root={root}
                        gitStatusMap={gitStatusMap}
                        onToggle={toggleDir}
                        onContextMenu={handleContextMenu}
                        inlineInput={inlineInput}
                        onInlineSubmit={handleInlineSubmit}
                        onInlineCancel={() => setInlineInput(null)}
                        onNewFile={handleNewFile}
                        onFolderDoubleClick={handleFolderDoubleClick}
                    />
                ))}
            </div>

            {contextMenu && (
                <div
                    className="explorer-context-menu"
                    style={{top: contextMenu.y, left: contextMenu.x}}
                    onClick={e => e.stopPropagation()}
                >
                    {contextMenu.node && isDirectory(contextMenu.node.entry) && (
                        <>
                            <button
                                type="button"
                                className="context-menu-item"
                                onClick={() => handleNewFile(contextMenu.node!.entry.path, contextMenu.indexPath)}
                            >
                                <FilePlus size={14} /> New File
                            </button>
                            <button
                                type="button"
                                className="context-menu-item"
                                onClick={() => handleNewFolder(contextMenu.node!.entry.path, contextMenu.indexPath)}
                            >
                                <FolderPlus size={14} /> New Folder
                            </button>
                        </>
                    )}
                    {!contextMenu.node && (
                        <>
                            <button
                                type="button"
                                className="context-menu-item"
                                onClick={() => handleNewFile(root, [])}
                            >
                                <FilePlus size={14} /> New File
                            </button>
                            <button
                                type="button"
                                className="context-menu-item"
                                onClick={() => handleNewFolder(root, [])}
                            >
                                <FolderPlus size={14} /> New Folder
                            </button>
                        </>
                    )}
                    {contextMenu.node && (
                        <>
                            <button
                                type="button"
                                className="context-menu-item"
                                onClick={() => handleRename(contextMenu.node!, contextMenu.indexPath)}
                            >
                                <Pencil size={14} /> Rename
                            </button>
                            <div className="context-menu-separator" />
                            <button
                                type="button"
                                className="context-menu-item context-menu-danger"
                                onClick={() => void handleDelete(contextMenu.node!)}
                            >
                                <Trash2 size={14} /> Delete
                            </button>
                        </>
                    )}
                </div>
            )}
        </aside>
    );
}

async function hydrate(nodes: NodeState[], expandedPaths: string[]): Promise<NodeState[]> {
    const wanted = new Set(expandedPaths);
    for (const node of nodes) {
        if (!isDirectory(node.entry) || !wanted.has(node.entry.path)) {
            continue;
        }
        try {
            node.children = (await ListDir(node.entry.path)).map((entry) => ({entry}));
            node.expanded = true;
            if (node.children.length) {
                node.children = await hydrate(node.children, expandedPaths);
            }
        } catch {
            node.expanded = false;
        }
    }
    return nodes;
}

function collectExpanded(nodes: NodeState[]): string[] {
    const out: string[] = [];
    for (const node of nodes) {
        if (node.expanded && isDirectory(node.entry)) {
            out.push(node.entry.path);
            if (node.children) {
                out.push(...collectExpanded(node.children));
            }
        }
    }
    return out;
}

function collapseAll(nodes: NodeState[]): NodeState[] {
    return nodes.map(n => ({
        ...n,
        expanded: false,
        children: n.children ? collapseAll(n.children) : undefined,
    }));
}

function getNode(nodes: NodeState[], indexPath: number[]): NodeState | undefined {
    let current: NodeState | undefined = nodes[indexPath[0]];
    for (let i = 1; i < indexPath.length; i++) {
        current = current?.children?.[indexPath[i]];
    }
    return current;
}

function InlineFileInput({
    defaultValue,
    depth,
    onSubmit,
    onCancel,
}: {
    defaultValue: string;
    depth: number;
    onSubmit: (name: string) => void;
    onCancel: () => void;
}) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [value, setValue] = useState(defaultValue);

    useEffect(() => {
        setTimeout(() => {
            inputRef.current?.focus();
            if (defaultValue) {
                const dotIdx = defaultValue.lastIndexOf('.');
                inputRef.current?.setSelectionRange(0, dotIdx > 0 ? dotIdx : defaultValue.length);
            }
        }, 50);
    }, []);

    return (
        <div className="inline-input-row" style={{paddingLeft: 20 + depth * 16}}>
            <input
                ref={inputRef}
                className="inline-input"
                value={value}
                onChange={e => setValue(e.target.value)}
                onKeyDown={e => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        onSubmit(value);
                    } else if (e.key === 'Escape') {
                        e.preventDefault();
                        onCancel();
                    }
                }}
                onBlur={() => {
                    if (value.trim()) {
                        onSubmit(value);
                    } else {
                        onCancel();
                    }
                }}
            />
        </div>
    );
}

type GitStatusMaps = {
    fileMap: Map<string, GitEntry>;
    modifiedFolders: Set<string>;
    untrackedFolders: Set<string>;
};

function getRelativePath(absPath: string, rootDir: string): string {
    const nRoot = rootDir.replace(/\\/g, '/').replace(/\/$/, '').toLowerCase();
    const nPath = absPath.replace(/\\/g, '/').toLowerCase();
    if (nPath.startsWith(nRoot + '/')) {
        return nPath.slice(nRoot.length + 1);
    }
    return nPath;
}

function TreeItem({
    node,
    depth,
    indexPath,
    activePath,
    root,
    gitStatusMap,
    onToggle,
    onContextMenu,
    inlineInput,
    onInlineSubmit,
    onInlineCancel,
    onNewFile,
    onFolderDoubleClick,
}: {
    node: NodeState;
    depth: number;
    indexPath: number[];
    activePath: string | null;
    root: string;
    gitStatusMap: GitStatusMaps;
    onToggle: (indexPath: number[], node: NodeState) => void;
    onContextMenu: (e: React.MouseEvent, node: NodeState, indexPath: number[]) => void;
    inlineInput: InlineInputState;
    onInlineSubmit: (name: string) => void;
    onInlineCancel: () => void;
    onNewFile?: (parentPath: string, indexPath: number[]) => void;
    onFolderDoubleClick?: (node: NodeState, indexPath: number[]) => void;
}) {
    const active = node.entry.path === activePath;
    const isDir = isDirectory(node.entry);
    const fileIcon = getFileIcon(node.entry.name, isDir, node.expanded ?? false);

    const isRenaming = inlineInput?.type === 'rename' && inlineInput.oldPath === node.entry.path;
    const showNewInput = inlineInput && (inlineInput.type === 'new-file' || inlineInput.type === 'new-folder') && inlineInput.parentPath === node.entry.path && node.expanded;

    const relPath = getRelativePath(node.entry.path, root);
    let gitStatusClass = '';
    let gitBadgeText = '';

    if (isDir) {
        if (gitStatusMap.modifiedFolders.has(relPath)) {
            gitStatusClass = 'git-folder-modified';
        } else if (gitStatusMap.untrackedFolders.has(relPath)) {
            gitStatusClass = 'git-folder-untracked';
        }
    } else {
        const gitEntry = gitStatusMap.fileMap.get(relPath);
        if (gitEntry) {
            switch (gitEntry.status) {
                case 'modified':
                    gitStatusClass = 'git-file-modified';
                    gitBadgeText = 'M';
                    break;
                case 'untracked':
                    gitStatusClass = 'git-file-untracked';
                    gitBadgeText = 'U';
                    break;
                case 'added':
                    gitStatusClass = 'git-file-added';
                    gitBadgeText = 'A';
                    break;
                case 'deleted':
                    gitStatusClass = 'git-file-deleted';
                    gitBadgeText = 'D';
                    break;
                case 'renamed':
                    gitStatusClass = 'git-file-renamed';
                    gitBadgeText = 'R';
                    break;
                default:
                    gitStatusClass = 'git-file-modified';
                    gitBadgeText = 'M';
            }
        }
    }

    if (isRenaming) {
        return (
            <InlineFileInput
                defaultValue={node.entry.name}
                depth={depth}
                onSubmit={onInlineSubmit}
                onCancel={onInlineCancel}
            />
        );
    }

    return (
        <>
            <button
                type="button"
                className={`tree-item${active ? ' active' : ''}`}
                style={{paddingLeft: 4 + depth * 16}}
                onClick={() => onToggle(indexPath, node)}
                onContextMenu={e => onContextMenu(e, node, indexPath)}
                onDoubleClick={(e) => {
                    e.stopPropagation();
                    if (isDir) {
                        onFolderDoubleClick?.(node, indexPath);
                    } else {
                        const parent = node.entry.path.substring(0, Math.max(node.entry.path.lastIndexOf('/'), node.entry.path.lastIndexOf('\\')));
                        onNewFile?.(parent || root, indexPath.slice(0, -1));
                    }
                }}
                title={node.entry.path}
            >
                {isDir ? (
                    <span className="tree-chevron">
                        <ChevronArrow expanded={node.expanded ?? false} />
                    </span>
                ) : (
                    <span className="tree-chevron-spacer" />
                )}
                <span className="tree-icon" style={{color: fileIcon.color}}>
                    {fileIcon.icon}
                </span>
                <span className={`tree-name ${gitStatusClass}`}>{node.entry.name}</span>
                {gitBadgeText && (
                    <span className={`tree-git-badge ${gitStatusClass}`}>{gitBadgeText}</span>
                )}
            </button>
            {showNewInput && (
                <InlineFileInput
                    defaultValue=""
                    depth={depth + 1}
                    onSubmit={onInlineSubmit}
                    onCancel={onInlineCancel}
                />
            )}
            {node.expanded && node.children?.map((child, i) => (
                <TreeItem
                    key={child.entry.path}
                    node={child}
                    depth={depth + 1}
                    indexPath={[...indexPath, i]}
                    activePath={activePath}
                    root={root}
                    gitStatusMap={gitStatusMap}
                    onToggle={onToggle}
                    onContextMenu={onContextMenu}
                    inlineInput={inlineInput}
                    onInlineSubmit={onInlineSubmit}
                    onInlineCancel={onInlineCancel}
                    onNewFile={onNewFile}
                    onFolderDoubleClick={onFolderDoubleClick}
                />
            ))}
        </>
    );
}
