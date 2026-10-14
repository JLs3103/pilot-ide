import {useState, useCallback, useRef, useEffect} from 'react';
import {SearchInProject, ReplaceInFile, ReplaceInProject} from '../../wailsjs/go/main/App';
import {Search, Replace, ChevronDown, ChevronRight, FileText, CaseSensitive, Regex, Filter} from 'lucide-react';
import {reportError} from '../lib/notifications';
import './SearchPanel.css';

type SearchMatch = {
    file: string;
    line: number;
    column: number;
    text: string;
    matchStart: number;
    matchEnd: number;
};

type Props = {
    onOpenFile: (path: string, name: string, line?: number, col?: number) => void;
};

type GroupedResult = {
    file: string;
    fileName: string;
    matches: SearchMatch[];
    expanded: boolean;
};

export function SearchPanel({onOpenFile}: Props) {
    const [query, setQuery] = useState('');
    const [replaceText, setReplaceText] = useState('');
    const [isRegex, setIsRegex] = useState(false);
    const [caseSensitive, setCaseSensitive] = useState(false);
    const [includePattern, setIncludePattern] = useState('');
    const [showReplace, setShowReplace] = useState(false);
    const [showFilters, setShowFilters] = useState(false);
    const [results, setResults] = useState<GroupedResult[]>([]);
    const [totalCount, setTotalCount] = useState(0);
    const [searching, setSearching] = useState(false);
    const [error, setError] = useState('');
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const searchRequestRef = useRef(0);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    const doSearch = useCallback(async (q: string) => {
        const requestId = ++searchRequestRef.current;
        if (!q.trim()) {
            setResults([]);
            setTotalCount(0);
            return;
        }
        setSearching(true);
        setError('');
        try {
            const result = await SearchInProject(q, isRegex, caseSensitive, includePattern);
            if (requestId !== searchRequestRef.current) return;
            const grouped = groupByFile(result.matches || []);
            setResults(grouped);
            setTotalCount(result.total || 0);
        } catch (err) {
            if (requestId === searchRequestRef.current) {
                setError(String(err));
                reportError('Search failed', err);
            }
        } finally {
            setSearching(false);
        }
    }, [isRegex, caseSensitive, includePattern]);

    const handleQueryChange = useCallback((value: string) => {
        setQuery(value);
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => void doSearch(value), 300);
    }, [doSearch]);

    useEffect(() => () => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        searchRequestRef.current += 1;
    }, []);

    const handleSearch = useCallback(() => {
        void doSearch(query);
    }, [query, doSearch]);

    const toggleFileExpand = useCallback((index: number) => {
        setResults(prev => {
            const next = [...prev];
            next[index] = {...next[index], expanded: !next[index].expanded};
            return next;
        });
    }, []);

    const handleReplaceInFile = useCallback(async (filePath: string) => {
        if (!query || replaceText === undefined) return;
        try {
            await ReplaceInFile(filePath, query, replaceText, isRegex, caseSensitive);
            void doSearch(query);
        } catch (err) {
            setError(String(err));
        }
    }, [query, replaceText, isRegex, caseSensitive, doSearch]);

    const handleReplaceAll = useCallback(async () => {
        if (!query || replaceText === undefined) return;
        if (!window.confirm(`Replace all occurrences of "${query}" with "${replaceText}" across all files?`)) return;
        try {
            await ReplaceInProject(query, replaceText, isRegex, caseSensitive, includePattern);
            void doSearch(query);
        } catch (err) {
            setError(String(err));
        }
    }, [query, replaceText, isRegex, caseSensitive, includePattern, doSearch]);

    const handleMatchClick = useCallback((match: SearchMatch) => {
        const parts = match.file.replace(/\\/g, '/').split('/');
        const name = parts[parts.length - 1];
        onOpenFile(match.file, name, match.line, match.column);
    }, [onOpenFile]);

    return (
        <div className="search-panel">
            <div className="search-panel-header">
                <span className="search-panel-title">SEARCH</span>
            </div>
            <div className="search-inputs">
                <div className="search-input-row">
                    <button
                        className="search-toggle-replace"
                        onClick={() => setShowReplace(!showReplace)}
                        title={showReplace ? 'Hide Replace' : 'Show Replace'}
                    >
                        {showReplace ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </button>
                    <div className="search-input-wrapper">
                        <input
                            ref={inputRef}
                            className="search-input"
                            placeholder="Search"
                            value={query}
                            onChange={e => handleQueryChange(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') handleSearch(); }}
                        />
                        <div className="search-input-actions">
                            <button
                                className={`search-option-btn ${caseSensitive ? 'active' : ''}`}
                                onClick={() => { setCaseSensitive(!caseSensitive); setTimeout(() => void doSearch(query), 50); }}
                                title="Match Case"
                            >
                                <CaseSensitive size={14} />
                            </button>
                            <button
                                className={`search-option-btn ${isRegex ? 'active' : ''}`}
                                onClick={() => { setIsRegex(!isRegex); setTimeout(() => void doSearch(query), 50); }}
                                title="Use Regular Expression"
                            >
                                <Regex size={14} />
                            </button>
                        </div>
                    </div>
                </div>
                {showReplace && (
                    <div className="search-input-row replace-row">
                        <div className="search-toggle-replace" style={{visibility: 'hidden'}}>
                            <ChevronRight size={14} />
                        </div>
                        <div className="search-input-wrapper">
                            <input
                                className="search-input"
                                placeholder="Replace"
                                value={replaceText}
                                onChange={e => setReplaceText(e.target.value)}
                            />
                            <div className="search-input-actions">
                                <button
                                    className="search-option-btn"
                                    onClick={handleReplaceAll}
                                    title="Replace All"
                                >
                                    <Replace size={14} />
                                </button>
                            </div>
                        </div>
                    </div>
                )}
                <div className="search-filters-toggle">
                    <button
                        className={`search-option-btn ${showFilters ? 'active' : ''}`}
                        onClick={() => setShowFilters(!showFilters)}
                        title="Toggle Search Filters"
                    >
                        <Filter size={12} /> <span>files to include</span>
                    </button>
                </div>
                {showFilters && (
                    <div className="search-filter-row">
                        <input
                            className="search-input"
                            placeholder="e.g. *.ts, *.go"
                            value={includePattern}
                            onChange={e => setIncludePattern(e.target.value)}
                        />
                    </div>
                )}
            </div>

            {error && <div className="search-error">{error}</div>}

            <div className="search-results-info">
                {searching ? (
                    <span>Searching...</span>
                ) : totalCount > 0 ? (
                    <span>{totalCount} result{totalCount !== 1 ? 's' : ''} in {results.length} file{results.length !== 1 ? 's' : ''}</span>
                ) : query ? (
                    <span>No results found</span>
                ) : null}
            </div>

            <div className="search-results">
                {results.map((group, gi) => (
                    <div key={group.file} className="search-result-group">
                        <button
                            className="search-result-file"
                            onClick={() => toggleFileExpand(gi)}
                        >
                            {group.expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                            <FileText size={13} />
                            <span className="search-result-filename">{group.fileName}</span>
                            <span className="search-result-count">{group.matches.length}</span>
                            {showReplace && (
                                <button
                                    className="search-replace-file-btn"
                                    onClick={e => { e.stopPropagation(); void handleReplaceInFile(group.file); }}
                                    title="Replace in this file"
                                >
                                    <Replace size={12} />
                                </button>
                            )}
                        </button>
                        {group.expanded && group.matches.map((match, mi) => (
                            <button
                                key={`${match.line}-${match.column}-${mi}`}
                                className="search-result-match"
                                onClick={() => handleMatchClick(match)}
                                title={`Line ${match.line}, Column ${match.column}`}
                            >
                                <span className="search-match-line">:{match.line}</span>
                                <span className="search-match-text">
                                    {match.text.substring(0, match.matchStart)}
                                    <mark>{match.text.substring(match.matchStart, match.matchEnd)}</mark>
                                    {match.text.substring(match.matchEnd)}
                                </span>
                            </button>
                        ))}
                    </div>
                ))}
            </div>
        </div>
    );
}

function groupByFile(matches: SearchMatch[]): GroupedResult[] {
    const map = new Map<string, SearchMatch[]>();
    for (const m of matches) {
        if (!map.has(m.file)) map.set(m.file, []);
        map.get(m.file)!.push(m);
    }
    const groups: GroupedResult[] = [];
    for (const [file, fileMatches] of map) {
        const parts = file.replace(/\\/g, '/').split('/');
        groups.push({
            file,
            fileName: parts[parts.length - 1],
            matches: fileMatches,
            expanded: true,
        });
    }
    return groups;
}
