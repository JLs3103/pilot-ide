import Editor from '@monaco-editor/react';
import {languageFromPath} from '../lib/language';
import './EditorPane.css';

type Props = {
    path: string | null;
    name: string | null;
    value: string;
    dirty: boolean;
    onChange: (value: string) => void;
    onSave: () => void;
};

export function EditorPane({path, name, value, dirty, onChange, onSave}: Props) {
    return (
        <section className="editor-pane">
            <header className="pane-header">
                <span>{name ? `${name}${dirty ? ' •' : ''}` : 'Editor'}</span>
                <button type="button" disabled={!path || !dirty} onClick={onSave}>Save</button>
            </header>
            {path ? (
                <div className="editor-host">
                    <Editor
                        height="100%"
                        theme="vs-dark"
                        path={path}
                        language={languageFromPath(path)}
                        value={value}
                        onChange={(next) => onChange(next ?? '')}
                        options={{
                            minimap: {enabled: true},
                            fontSize: 13,
                            automaticLayout: true,
                            wordWrap: 'on',
                        }}
                    />
                </div>
            ) : (
                <div className="editor-empty">Open a folder, then select a file to edit.</div>
            )}
        </section>
    );
}
