import {GitBranch, Bot, Terminal as TerminalIcon, FileText} from 'lucide-react';
import './StatusBar.css';

type Props = {
    filePath: string | null;
    fileName: string | null;
    cursorLine: number;
    cursorCol: number;
    encoding: string;
    aiMode: string;
    aiPanelVisible: boolean;
    terminalVisible: boolean;
    dirty: boolean;
    saveStatus: 'saved' | 'saving' | 'recovery' | 'error';
    onToggleTerminal: () => void;
    onToggleAiPanel: () => void;
    onGoToLine: () => void;
};

export function StatusBar({
    filePath,
    fileName,
    cursorLine,
    cursorCol,
    encoding,
    aiMode,
    aiPanelVisible,
    terminalVisible,
    dirty,
    saveStatus,
    onToggleTerminal,
    onToggleAiPanel,
    onGoToLine,
}: Props) {
    return (
        <footer className="status-bar">
            <div className="status-bar-left">
                <button
                    type="button"
                    className="status-item clickable"
                    onClick={onToggleTerminal}
                    title="Toggle Terminal (Ctrl+`)"
                >
                    <TerminalIcon size={12} />
                    <span>{terminalVisible ? 'Terminal' : 'Terminal (Hidden)'}</span>
                </button>
                {filePath && (
                    <span className="status-item status-filepath" title={filePath}>
                        <FileText size={12} />
                        <span>{filePath}</span>
                        {dirty && <span className="status-dirty">●</span>}
                    </span>
                )}
                <span className={`status-item status-save status-save-${saveStatus}`} title="Autosave status">
                    {saveStatus === 'saving' ? 'Saving…' : saveStatus === 'recovery' ? 'Recovery available' : saveStatus === 'error' ? 'Save failed' : 'Saved'}
                </span>
            </div>
            <div className="status-bar-right">
                {fileName && (
                    <button
                        type="button"
                        className="status-item clickable"
                        onClick={onGoToLine}
                        title="Go to Line (Ctrl+G)"
                    >
                        Ln {cursorLine}, Col {cursorCol}
                    </button>
                )}
                <span className="status-item" title="File Encoding">
                    {encoding}
                </span>
                <button
                    type="button"
                    className={`status-item clickable status-ai ${aiPanelVisible ? 'active' : ''}`}
                    onClick={onToggleAiPanel}
                    title="Toggle AI Panel (Ctrl+Shift+M)"
                >
                    <Bot size={12} />
                    <span>{aiMode === 'cloud' ? 'Cloud' : 'Local'}</span>
                </button>
            </div>
        </footer>
    );
}
