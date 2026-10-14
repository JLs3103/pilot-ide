import {useState, useEffect, useCallback} from 'react';
import {SaveEditorSettings, GetEditorSettings} from '../../wailsjs/go/main/App';
import {Settings, Monitor, Sun, Moon, Type, Minus, Plus} from 'lucide-react';
import './SettingsPanel.css';

export type EditorSettings = {
    theme: 'vs-dark' | 'vs-light' | 'hc-black';
    fontSize: number;
    tabSize: number;
    lineHeight: number;
    wordWrap: 'on' | 'off';
    minimap: boolean;
    formatOnSave: boolean;
};

const defaultSettings: EditorSettings = {
    theme: 'vs-dark',
    fontSize: 13,
    tabSize: 4,
    lineHeight: 1.6,
    wordWrap: 'on',
    minimap: true,
    formatOnSave: false,
};

type Props = {
    settings: EditorSettings;
    onSettingsChange: (settings: EditorSettings) => void;
};

const themes: {id: EditorSettings['theme']; label: string; icon: React.ReactNode}[] = [
    {id: 'vs-dark', label: 'Dark', icon: <Moon size={16} />},
    {id: 'vs-light', label: 'Light', icon: <Sun size={16} />},
    {id: 'hc-black', label: 'High Contrast', icon: <Monitor size={16} />},
];

export function SettingsPanel({settings, onSettingsChange}: Props) {
    const update = useCallback((partial: Partial<EditorSettings>) => {
        const next = {...settings, ...partial};
        onSettingsChange(next);
        void SaveEditorSettings(JSON.stringify(next));
    }, [settings, onSettingsChange]);

    return (
        <div className="settings-panel">
            <div className="settings-header">
                <Settings size={14} />
                <span className="settings-title">SETTINGS</span>
            </div>

            {/* Theme */}
            <div className="settings-section">
                <div className="settings-section-title">Theme</div>
                <div className="settings-theme-grid">
                    {themes.map(t => (
                        <button
                            key={t.id}
                            className={`settings-theme-btn ${settings.theme === t.id ? 'active' : ''}`}
                            onClick={() => update({theme: t.id})}
                        >
                            {t.icon}
                            <span>{t.label}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Font Size */}
            <div className="settings-section">
                <div className="settings-section-title">
                    <Type size={13} /> Font Size
                </div>
                <div className="settings-number-control">
                    <button
                        className="settings-num-btn"
                        onClick={() => update({fontSize: Math.max(8, settings.fontSize - 1)})}
                    >
                        <Minus size={14} />
                    </button>
                    <span className="settings-num-value">{settings.fontSize}px</span>
                    <button
                        className="settings-num-btn"
                        onClick={() => update({fontSize: Math.min(32, settings.fontSize + 1)})}
                    >
                        <Plus size={14} />
                    </button>
                </div>
            </div>

            {/* Tab Size */}
            <div className="settings-section">
                <div className="settings-section-title">Tab Size</div>
                <div className="settings-tab-sizes">
                    {[2, 4, 8].map(s => (
                        <button
                            key={s}
                            className={`settings-tab-btn ${settings.tabSize === s ? 'active' : ''}`}
                            onClick={() => update({tabSize: s})}
                        >
                            {s}
                        </button>
                    ))}
                </div>
            </div>

            {/* Line Height */}
            <div className="settings-section">
                <div className="settings-section-title">Line Height</div>
                <div className="settings-number-control">
                    <button
                        className="settings-num-btn"
                        onClick={() => update({lineHeight: Math.max(1.0, parseFloat((settings.lineHeight - 0.1).toFixed(1)))})}
                    >
                        <Minus size={14} />
                    </button>
                    <span className="settings-num-value">{settings.lineHeight.toFixed(1)}</span>
                    <button
                        className="settings-num-btn"
                        onClick={() => update({lineHeight: Math.min(3.0, parseFloat((settings.lineHeight + 0.1).toFixed(1)))})}
                    >
                        <Plus size={14} />
                    </button>
                </div>
            </div>

            {/* Word Wrap */}
            <div className="settings-section">
                <div className="settings-section-title">Word Wrap</div>
                <div className="settings-toggle-row">
                    <button
                        className={`settings-toggle-btn ${settings.wordWrap === 'on' ? 'active' : ''}`}
                        onClick={() => update({wordWrap: settings.wordWrap === 'on' ? 'off' : 'on'})}
                    >
                        {settings.wordWrap === 'on' ? 'On' : 'Off'}
                    </button>
                </div>
            </div>

            {/* Minimap */}
            <div className="settings-section">
                <div className="settings-section-title">Minimap</div>
                <div className="settings-toggle-row">
                    <button
                        className={`settings-toggle-btn ${settings.minimap ? 'active' : ''}`}
                        onClick={() => update({minimap: !settings.minimap})}
                    >
                        {settings.minimap ? 'Visible' : 'Hidden'}
                    </button>
                </div>
            </div>

            {/* Format on Save */}
            <div className="settings-section">
                <div className="settings-section-title">Format on Save</div>
                <div className="settings-toggle-row">
                    <button
                        className={`settings-toggle-btn ${settings.formatOnSave ? 'active' : ''}`}
                        onClick={() => update({formatOnSave: !settings.formatOnSave})}
                    >
                        {settings.formatOnSave ? 'Enabled' : 'Disabled'}
                    </button>
                </div>
            </div>

            {/* Reset */}
            <div className="settings-section settings-reset">
                <button
                    className="settings-reset-btn"
                    onClick={() => update(defaultSettings)}
                >
                    Reset to Defaults
                </button>
            </div>
        </div>
    );
}

export {defaultSettings};

export async function loadEditorSettings(): Promise<EditorSettings> {
    try {
        const raw = await GetEditorSettings();
        if (raw) {
            return {...defaultSettings, ...JSON.parse(raw)};
        }
    } catch {}
    return defaultSettings;
}
