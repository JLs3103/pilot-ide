import {useCallback, useEffect, useRef, useState} from 'react';
import {GetProjectRoot, ListDir, OpenProject} from '../../wailsjs/go/main/App';
import {EventsOn} from '../../wailsjs/runtime/runtime';
import type {DirEntry} from '../types';
import './FileExplorer.css';

type Props = {
    onOpenFile: (path: string, name: string) => void;
    activePath: string | null;
};

type NodeState = {
    entry: DirEntry;
    expanded?: boolean;
    children?: NodeState[];
};

function isDirectory(entry: DirEntry) {
    return Boolean(entry.isDir);
}

export function FileExplorer({onOpenFile, activePath}: Props) {
    const [root, setRoot] = useState('');
    const [nodes, setNodes] = useState<NodeState[]>([]);
    const [error, setError] = useState('');
    const nodesRef = useRef<NodeState[]>([]);
    const rootRef = useRef('');

    nodesRef.current = nodes;
    rootRef.current = root;

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
        }
    }

    return (
        <aside className="explorer">
            <header className="pane-header">
                <span>Explorer</span>
                <button type="button" onClick={() => void openFolder()}>Open Folder</button>
            </header>
            <div className="explorer-root" title={root}>
                {root || 'No project folder'}
            </div>
            {error ? <div className="pane-error">{error}</div> : null}
            <div className="explorer-tree">
                {nodes.map((node, i) => (
                    <TreeItem
                        key={node.entry.path}
                        node={node}
                        depth={0}
                        indexPath={[i]}
                        activePath={activePath}
                        onToggle={toggleDir}
                    />
                ))}
            </div>
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

function getNode(nodes: NodeState[], indexPath: number[]): NodeState | undefined {
    let current: NodeState | undefined = nodes[indexPath[0]];
    for (let i = 1; i < indexPath.length; i++) {
        current = current?.children?.[indexPath[i]];
    }
    return current;
}

function TreeItem({
    node,
    depth,
    indexPath,
    activePath,
    onToggle,
}: {
    node: NodeState;
    depth: number;
    indexPath: number[];
    activePath: string | null;
    onToggle: (indexPath: number[], node: NodeState) => void;
}) {
    const active = node.entry.path === activePath;
    return (
        <>
            <button
                type="button"
                className={`tree-item${active ? ' active' : ''}`}
                style={{paddingLeft: 8 + depth * 14}}
                onClick={() => onToggle(indexPath, node)}
            >
                <span className="tree-glyph">{isDirectory(node.entry) ? (node.expanded ? '▾' : '▸') : '·'}</span>
                {node.entry.name}
            </button>
            {node.expanded && node.children?.map((child, i) => (
                <TreeItem
                    key={child.entry.path}
                    node={child}
                    depth={depth + 1}
                    indexPath={[...indexPath, i]}
                    activePath={activePath}
                    onToggle={onToggle}
                />
            ))}
        </>
    );
}
