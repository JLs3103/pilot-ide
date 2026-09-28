import React from 'react';

const ICON_SIZE = 16;

export type ThemeMode = 'dark' | 'light';

const colors = {
    javascript: '#f7df1e',
    typescript: '#3178c6',
    react: '#61dafb',
    python: '#3572a5',
    go: '#00add8',
    rust: '#dea584',
    java: '#e76f00',
    csharp: '#68217a',
    cpp: '#00599c',
    c: '#a8b9cc',
    ruby: '#cc342d',
    php: '#777bb3',
    swift: '#f05138',
    kotlin: '#7f52ff',
    dart: '#00b4ab',
    lua: '#5656ff',

    html: '#e44d26',
    css: '#42a5f5',
    scss: '#c6538c',
    vue: '#41b883',
    svelte: '#ff3e00',

    json: '#cbcb41',
    yaml: '#cb171e',
    toml: '#9c4221',
    xml: '#0060ac',
    sql: '#e38c00',
    graphql: '#e10098',

    markdown: '#519aba',
    text: '#8ea0b5',
    pdf: '#ff0000',

    git: '#f14e32',
    docker: '#2496ed',
    package: '#cb3837',
    shell: '#89e051',
    env: '#ecd53f',
    archive: '#d4a017',
    image: '#a074c4',
    video: '#fd971f',
    audio: '#1db954',
    binary: '#8ea0b5',

    folder: '#e5c07b',
    folderOpen: '#f0d38d',
    defaultFile: '#8ea0b5',
};

type IconDef = {
    icon: React.ReactNode;
    color: string;
};

function JavaScriptIcon() {
    return (
        <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 16 16" fill="none">
            <rect x="1" y="1" width="14" height="14" rx="2" fill="#f7df1e" />
            <path d="M5.5 11.5V6H7V10C7 10.8 6.7 11.5 5.5 11.5Z" fill="#323330" />
            <path d="M9 11.5C9.8 11.5 10.3 11 10.5 10.5L9.5 10C9.4 10.3 9.2 10.5 9 10.5C8.7 10.5 8.5 10.2 8.5 9.5V6H10V7.5H9.5V9.5C9.5 10.8 10.2 11.5 9 11.5Z" fill="#323330" />
        </svg>
    );
}

function TypeScriptIcon() {
    return (
        <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 16 16" fill="none">
            <rect x="1" y="1" width="14" height="14" rx="2" fill="#3178c6" />
            <path d="M5 7H10V8.2H8.2V13H6.8V8.2H5V7Z" fill="white" />
            <path d="M10 12.8V11.5C10.3 11.8 10.8 12 11.2 12C11.8 12 12 11.7 12 11.4C12 11.1 11.8 10.9 11.2 10.7C10.2 10.4 9.8 9.9 9.8 9.3C9.8 8.5 10.4 8 11.3 8C11.8 8 12.2 8.1 12.5 8.3V9.5C12.2 9.2 11.8 9 11.3 9C10.9 9 10.6 9.2 10.6 9.5C10.6 9.7 10.8 9.9 11.3 10.1C12.2 10.4 12.8 10.8 12.8 11.5C12.8 12.3 12.2 12.9 11.1 12.9C10.6 12.9 10.2 12.8 10 12.8Z" fill="white" />
        </svg>
    );
}

function ReactIcon() {
    return (
        <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 16 16" fill="none">
            <ellipse cx="8" cy="8" rx="6.5" ry="2.5" stroke="#61dafb" strokeWidth="1.2" transform="rotate(30 8 8)" />
            <ellipse cx="8" cy="8" rx="6.5" ry="2.5" stroke="#61dafb" strokeWidth="1.2" transform="rotate(90 8 8)" />
            <ellipse cx="8" cy="8" rx="6.5" ry="2.5" stroke="#61dafb" strokeWidth="1.2" transform="rotate(150 8 8)" />
            <circle cx="8" cy="8" r="1.3" fill="#61dafb" />
        </svg>
    );
}

function PythonIcon() {
    return (
        <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 16 16" fill="none">
            <path d="M7.8 1C5.5 1 5 2.1 5 3.3V4.5H8V5H3.5C2.3 5 1 5.8 1 8C1 10.2 2.3 11 3.5 11H5V9.5C5 8.3 5.8 7.5 7 7.5H10C11 7.5 11.5 7 11.5 6V3.3C11.5 2 10.5 1 7.8 1ZM6 3.5C6.4 3.5 6.7 3.2 6.7 2.8C6.7 2.4 6.4 2.1 6 2.1C5.6 2.1 5.3 2.4 5.3 2.8C5.3 3.2 5.6 3.5 6 3.5Z" fill="#3572a5" />
            <path d="M8.2 15C10.5 15 11 13.9 11 12.7V11.5H8V11H12.5C13.7 11 15 10.2 15 8C15 5.8 13.7 5 12.5 5H11V6.5C11 7.7 10.2 8.5 9 8.5H6C5 8.5 4.5 9 4.5 10V12.7C4.5 14 5.5 15 8.2 15ZM10 12.5C9.6 12.5 9.3 12.8 9.3 13.2C9.3 13.6 9.6 13.9 10 13.9C10.4 13.9 10.7 13.6 10.7 13.2C10.7 12.8 10.4 12.5 10 12.5Z" fill="#ffd43b" />
        </svg>
    );
}

function GoIcon() {
    return (
        <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 16 16" fill="none">
            <path d="M2 7.5C2 7.5 2.5 7 3.5 7C4.5 7 5 7.5 5 7.5" stroke="#00add8" strokeWidth="1.2" strokeLinecap="round" />
            <ellipse cx="8" cy="8.5" rx="3.5" ry="3" fill="#00add8" />
            <ellipse cx="8" cy="8.5" rx="2" ry="1.5" fill="#fff" />
            <circle cx="8.5" cy="8.2" r="0.7" fill="#00add8" />
            <path d="M11 7.5C11 7.5 11.5 7 12.5 7C13.5 7 14 7.5 14 7.5" stroke="#00add8" strokeWidth="1.2" strokeLinecap="round" />
            <path d="M1 5.5L3 5L5 5.5" stroke="#00add8" strokeWidth="0.8" strokeLinecap="round" />
        </svg>
    );
}

function RustIcon() {
    return (
        <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="6" stroke="#dea584" strokeWidth="1.3" />
            <path d="M5 10V6.5C5 6 5.5 5.5 6 5.5H7C7.5 5.5 8 6 8 6.5V7.5C8 7 8.5 7 9 7H10" stroke="#dea584" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M8 7.5V10" stroke="#dea584" strokeWidth="1.2" strokeLinecap="round" />
            <path d="M10 7L10 10" stroke="#dea584" strokeWidth="1.2" strokeLinecap="round" />
            <circle cx="8" cy="2.5" r="0.8" fill="#dea584" />
        </svg>
    );
}

function CIcon() {
    return (
        <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="6.5" fill="#a8b9cc" />
            <path d="M10.5 5.5C10 4.8 9.1 4.3 8 4.3C6 4.3 4.3 5.9 4.3 8C4.3 10.1 6 11.7 8 11.7C9.1 11.7 10 11.2 10.5 10.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
    );
}

function CppIcon() {
    return (
        <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="6.5" fill="#00599c" />
            <path d="M9 5C8.5 4.3 7.6 3.8 6.5 3.8C4.8 3.8 3.3 5.4 3.3 7.5C3.3 9.6 4.8 11.2 6.5 11.2C7.6 11.2 8.5 10.7 9 10" stroke="white" strokeWidth="1.3" strokeLinecap="round" />
            <path d="M10.5 7H12.5M11.5 6V8" stroke="white" strokeWidth="1" strokeLinecap="round" />
            <path d="M13 7H14.5M13.75 6V8" stroke="white" strokeWidth="1" strokeLinecap="round" />
        </svg>
    );
}

function CSharpIcon() {
    return (
        <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="6.5" fill="#68217a" />
            <path d="M9 5C8.5 4.3 7.6 3.8 6.5 3.8C4.8 3.8 3.3 5.4 3.3 7.5C3.3 9.6 4.8 11.2 6.5 11.2C7.6 11.2 8.5 10.7 9 10" stroke="white" strokeWidth="1.3" strokeLinecap="round" />
            <path d="M11 6V10M12.5 6V10" stroke="white" strokeWidth="0.9" strokeLinecap="round" />
            <path d="M10 7.5H13.5M10 8.5H13.5" stroke="white" strokeWidth="0.9" strokeLinecap="round" />
        </svg>
    );
}

function JavaIcon() {
    return (
        <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 16 16" fill="none">
            <path d="M5.5 3H7.5V9.5C7.5 11 6.5 12 5 12" stroke="#e76f00" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M9 3V7.5C9 7.5 9 9 10.5 9C12 9 12 7.5 12 7.5V3" stroke="#5382a1" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

function KotlinIcon() {
    return (
        <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 16 16" fill="none">
            <defs>
                <linearGradient id="kt" x1="1" y1="15" x2="15" y2="1">
                    <stop offset="0%" stopColor="#e44857" />
                    <stop offset="50%" stopColor="#c711e1" />
                    <stop offset="100%" stopColor="#7f52ff" />
                </linearGradient>
            </defs>
            <path d="M2 14V2H14L8 8L14 14H2Z" fill="url(#kt)" />
        </svg>
    );
}

function HtmlIcon() {
    return (
        <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 16 16" fill="none">
            <path d="M2.5 1.5L3.5 13.5L8 15L12.5 13.5L13.5 1.5H2.5Z" fill="#e44d26" />
            <path d="M8 14V2.5H12.5L12 12.5L8 14Z" fill="#f16529" />
            <path d="M4.5 5H11.5L11.2 7H7L7.2 9H11L10.5 12L8 12.5L5.5 12L5.3 10" stroke="white" strokeWidth="0.8" strokeLinejoin="round" />
        </svg>
    );
}

function CssIcon() {
    return (
        <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 16 16" fill="none">
            <path d="M2.5 1.5L3.5 13.5L8 15L12.5 13.5L13.5 1.5H2.5Z" fill="#1572b6" />
            <path d="M8 14V2.5H12.5L12 12.5L8 14Z" fill="#33a9dc" />
            <path d="M4.5 5H11.5L11.2 7H5.2L5.5 9H11L10.5 12L8 12.5L5.5 12L5.3 10" stroke="white" strokeWidth="0.8" strokeLinejoin="round" />
        </svg>
    );
}

function ScssIcon() {
    return (
        <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="6.5" fill="#c6538c" />
            <path d="M5.5 10C5.5 10 6 11 7.5 11C9 11 9.5 10 9.5 9.5C9.5 7.5 5.5 8 5.5 6C5.5 5 6.5 4 8 4C9.5 4 10.5 5 10.5 5" stroke="white" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
    );
}

function VueIcon() {
    return (
        <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 16 16" fill="none">
            <path d="M1 2L8 14L15 2H12L8 9L4 2H1Z" fill="#41b883" />
            <path d="M4 2L8 9L12 2H9.5L8 5L6.5 2H4Z" fill="#35495e" />
        </svg>
    );
}

function SvelteIcon() {
    return (
        <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 16 16" fill="none">
            <path d="M13 3.5C11.5 1.5 8.5 1 6.5 2.5L4 4.5C3 5.2 2.5 6.2 2.5 7.3C2.5 8 2.7 8.7 3 9.2C2.7 9.7 2.5 10.3 2.5 11C2.5 12 3 13 3.8 13.5C5 15 7.5 15.5 9.5 14L12 12C13 11.3 13.5 10.3 13.5 9.2C13.5 8.5 13.3 7.8 13 7.3C13.3 6.5 13.5 5.5 13 3.5Z" fill="#ff3e00" />
            <path d="M6.5 12.5C5.5 12.8 4.5 12 4.5 11C4.5 10.7 4.6 10.4 4.8 10.2L7.3 8.2C7.6 8 8 7.9 8.3 8L9.5 8.3" stroke="white" strokeWidth="0.8" strokeLinecap="round" />
        </svg>
    );
}

function RubyIcon() {
    return (
        <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 16 16" fill="none">
            <path d="M2 14L4 2H8L12.5 4L14 8L12 14H2Z" fill="#cc342d" />
            <path d="M4 12L6 4H8.5L11 5.5L12 8L10.5 12H4Z" fill="#ff6660" opacity="0.5" />
        </svg>
    );
}

function PhpIcon() {
    return (
        <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 16 16" fill="none">
            <ellipse cx="8" cy="8" rx="7" ry="5" fill="#777bb3" />
            <path d="M4.5 6.5H6C6.8 6.5 7 7 7 7.5C7 8 6.8 8.5 6 8.5H5L4.8 10" stroke="white" strokeWidth="0.9" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M8 6.5H9.5C10.3 6.5 10.5 7 10.5 7.5C10.5 8 10.3 8.5 9.5 8.5H8.5L8.3 10" stroke="white" strokeWidth="0.9" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

function SwiftIcon() {
    return (
        <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 16 16" fill="none">
            <rect x="1" y="1" width="14" height="14" rx="3" fill="#f05138" />
            <path d="M4 10C4 10 8 8 6 5C6 5 9 7.5 7.5 9.5C7.5 9.5 10.5 7 10 4C10 4 13 7 10 11C10 11 12 11.5 13 10.5" stroke="white" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

function DartIcon() {
    return (
        <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 16 16" fill="none">
            <path d="M4 2L2 4V12L4 14H12L14 12V6L12 2H4Z" fill="#00b4ab" />
            <path d="M4 2L8 8L4 14" stroke="white" strokeWidth="0.8" opacity="0.5" />
            <path d="M8 8L14 6" stroke="white" strokeWidth="0.8" opacity="0.5" />
        </svg>
    );
}

function LuaIcon() {
    return (
        <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="9" r="5.5" fill="#000080" stroke="#5656ff" strokeWidth="1" />
            <circle cx="11" cy="4" r="2" fill="#000080" stroke="#5656ff" strokeWidth="1" />
            <circle cx="6.5" cy="8.5" r="1.5" fill="white" />
        </svg>
    );
}

function MarkdownIcon() {
    return (
        <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 16 16" fill="none">
            <rect x="1" y="2.5" width="14" height="11" rx="2" stroke="#519aba" strokeWidth="1.3" />
            <path d="M3.5 10.5V5.5L5.5 8L7.5 5.5V10.5" stroke="#519aba" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M11 6V10M9.5 8.5L11 10.5L12.5 8.5" stroke="#519aba" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

function GitIcon() {
    return (
        <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 16 16" fill="none">
            <circle cx="4.5" cy="4" r="1.8" fill="#f14e32" />
            <circle cx="4.5" cy="12" r="1.8" fill="#f14e32" />
            <circle cx="11.5" cy="7" r="1.8" fill="#f14e32" />
            <path d="M4.5 5.8V10.2" stroke="#f14e32" strokeWidth="1.4" />
            <path d="M4.5 7.5C4.5 7.5 6 7 8 7C10 7 11.5 7 11.5 7" stroke="#f14e32" strokeWidth="1.4" />
        </svg>
    );
}

function JsonIcon() {
    return (
        <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 16 16" fill="none">
            <path d="M4 3C3 3 2.5 3.5 2.5 4.5V6.5C2.5 7.5 2 8 1 8C2 8 2.5 8.5 2.5 9.5V11.5C2.5 12.5 3 13 4 13" stroke="#cbcb41" strokeWidth="1.3" strokeLinecap="round" />
            <path d="M12 3C13 3 13.5 3.5 13.5 4.5V6.5C13.5 7.5 14 8 15 8C14 8 13.5 8.5 13.5 9.5V11.5C13.5 12.5 13 13 12 13" stroke="#cbcb41" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
    );
}

function YamlIcon() {
    return (
        <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 16 16" fill="none">
            <path d="M3 3L5.5 7V13" stroke="#cb171e" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M8 3L5.5 7" stroke="#cb171e" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M10 3V8L13 13" stroke="#cb171e" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M13 3L10 8" stroke="#cb171e" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

function XmlIcon() {
    return (
        <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 16 16" fill="none">
            <path d="M5 4L2 8L5 12" stroke="#0060ac" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M11 4L14 8L11 12" stroke="#0060ac" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M9 3L7 13" stroke="#0060ac" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
    );
}

function SqlIcon() {
    return (
        <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 16 16" fill="none">
            <ellipse cx="8" cy="4" rx="5.5" ry="2.5" fill="none" stroke="#e38c00" strokeWidth="1.2" />
            <path d="M2.5 4V12C2.5 13.4 5 14.5 8 14.5C11 14.5 13.5 13.4 13.5 12V4" stroke="#e38c00" strokeWidth="1.2" />
            <path d="M2.5 8C2.5 9.4 5 10.5 8 10.5C11 10.5 13.5 9.4 13.5 8" stroke="#e38c00" strokeWidth="1.2" />
        </svg>
    );
}

function GraphqlIcon() {
    return (
        <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 16 16" fill="none">
            <polygon points="8,1.5 14,4.5 14,11.5 8,14.5 2,11.5 2,4.5" fill="none" stroke="#e10098" strokeWidth="1.2" />
            <circle cx="8" cy="1.5" r="1" fill="#e10098" />
            <circle cx="14" cy="4.5" r="1" fill="#e10098" />
            <circle cx="14" cy="11.5" r="1" fill="#e10098" />
            <circle cx="8" cy="14.5" r="1" fill="#e10098" />
            <circle cx="2" cy="11.5" r="1" fill="#e10098" />
            <circle cx="2" cy="4.5" r="1" fill="#e10098" />
        </svg>
    );
}

function DockerIcon() {
    return (
        <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 16 16" fill="none">
            <path d="M1 7.5H3V5.5H5V3.5H7V5.5H9V3.5H11V5.5H13.5C13.5 5.5 14 6.5 14 7.5C14 8.5 13 10 11 11C9 12 6 12 4 11C2 10 1 8.5 1 7.5Z" fill="#2496ed" />
            <rect x="3.5" y="6" width="1.5" height="1.3" rx="0.2" fill="white" />
            <rect x="5.5" y="6" width="1.5" height="1.3" rx="0.2" fill="white" />
            <rect x="7.5" y="6" width="1.5" height="1.3" rx="0.2" fill="white" />
            <rect x="9.5" y="6" width="1.5" height="1.3" rx="0.2" fill="white" />
            <rect x="5.5" y="4" width="1.5" height="1.3" rx="0.2" fill="white" />
            <rect x="7.5" y="4" width="1.5" height="1.3" rx="0.2" fill="white" />
        </svg>
    );
}

function NpmIcon() {
    return (
        <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 16 16" fill="none">
            <rect x="1" y="3" width="14" height="10" fill="#cb3837" />
            <rect x="3" y="5" width="3" height="6" fill="white" />
            <rect x="4.5" y="5" width="1.5" height="4.5" fill="#cb3837" />
            <rect x="7" y="5" width="3" height="6" fill="white" />
            <rect x="8.5" y="5" width="1.5" height="4.5" fill="#cb3837" />
            <rect x="11" y="5" width="2" height="6" fill="white" />
        </svg>
    );
}

function EnvIcon() {
    return (
        <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 16 16" fill="none">
            <rect x="2" y="2" width="12" height="12" rx="2" fill="#2a2500" stroke="#ecd53f" strokeWidth="1" />
            <path d="M5 5H7.5" stroke="#ecd53f" strokeWidth="1.2" strokeLinecap="round" />
            <path d="M5 8H11" stroke="#ecd53f" strokeWidth="1.2" strokeLinecap="round" />
            <path d="M5 11H9" stroke="#ecd53f" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
    );
}

function ImageIcon() {
    return (
        <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 16 16" fill="none">
            <rect x="1.5" y="2" width="13" height="12" rx="2" stroke="#a074c4" strokeWidth="1.2" />
            <circle cx="5" cy="5.5" r="1.5" fill="#a074c4" />
            <path d="M1.5 11L5 8L8 10L11 7L14.5 10V12C14.5 13.1 13.6 14 12.5 14H3.5C2.4 14 1.5 13.1 1.5 12V11Z" fill="#a074c4" opacity="0.5" />
        </svg>
    );
}

function VideoIcon() {
    return (
        <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 16 16" fill="none">
            <rect x="1" y="3" width="10" height="10" rx="2" stroke="#fd971f" strokeWidth="1.2" />
            <path d="M11 7L15 5V11L11 9" fill="#fd971f" />
            <circle cx="6" cy="8" r="1.5" stroke="#fd971f" strokeWidth="1" />
        </svg>
    );
}

function AudioIcon() {
    return (
        <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 16 16" fill="none">
            <path d="M10 2V12" stroke="#1db954" strokeWidth="1.3" strokeLinecap="round" />
            <circle cx="7" cy="12" r="2.5" fill="none" stroke="#1db954" strokeWidth="1.3" />
            <path d="M10 2L14 3.5V5L10 4" stroke="#1db954" strokeWidth="1.2" strokeLinejoin="round" />
        </svg>
    );
}

function ArchiveIcon() {
    return (
        <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 16 16" fill="none">
            <rect x="2" y="1.5" width="12" height="4" rx="1" fill="#d4a017" />
            <rect x="3" y="5.5" width="10" height="9" rx="1" stroke="#d4a017" strokeWidth="1.2" />
            <rect x="6.5" y="7" width="3" height="2" rx="0.5" stroke="#d4a017" strokeWidth="1" />
        </svg>
    );
}

function BinaryIcon() {
    return (
        <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 16 16" fill="none">
            <path d="M3 4H5V6H3V4Z" fill="#8ea0b5" />
            <path d="M7 4H9V6H7V4Z" fill="#8ea0b5" />
            <path d="M11 4H13V6H11V4Z" fill="#8ea0b5" />
            <path d="M3 8H5V10H3V8Z" fill="#8ea0b5" />
            <path d="M7 8H9V10H7V8Z" fill="#8ea0b5" />
            <path d="M11 8H13V10H11V8Z" fill="#8ea0b5" />
            <path d="M5 11H7V13H5V11Z" fill="#8ea0b5" />
            <path d="M9 11H11V13H9V11Z" fill="#8ea0b5" />
        </svg>
    );
}

function TomlIcon() {
    return (
        <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 16 16" fill="none">
            <rect x="2" y="2" width="12" height="12" rx="2" fill="#3d1a08" />
            <path d="M4 5H12" stroke="#d09060" strokeWidth="1.2" strokeLinecap="round" />
            <path d="M4 8H10" stroke="#d09060" strokeWidth="1.2" strokeLinecap="round" />
            <path d="M4 11H8" stroke="#d09060" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
    );
}

function ConfigIcon() {
    return (
        <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="2.5" stroke="#8ea0b5" strokeWidth="1.3" />
            <path d="M8 1.5V3.5M8 12.5V14.5M1.5 8H3.5M12.5 8H14.5M3.4 3.4L4.8 4.8M11.2 11.2L12.6 12.6M3.4 12.6L4.8 11.2M11.2 4.8L12.6 3.4" stroke="#8ea0b5" strokeWidth="1" strokeLinecap="round" />
        </svg>
    );
}

function PdfIcon() {
    return (
        <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 16 16" fill="none">
            <path d="M3.5 1.5H9.5L13.5 5.5V14.5H3.5V1.5Z" fill="#ff0000" opacity="0.15" stroke="#ff0000" strokeWidth="1" strokeLinejoin="round" />
            <path d="M9.5 1.5V5.5H13.5" stroke="#ff0000" strokeWidth="1" strokeLinejoin="round" />
            <text x="8.5" y="12" textAnchor="middle" fontFamily="Segoe UI, sans-serif" fontWeight="700" fontSize="5.5" fill="#ff0000">PDF</text>
        </svg>
    );
}

function LockIcon() {
    return (
        <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 16 16" fill="none">
            <rect x="3.5" y="7" width="9" height="7" rx="1.5" stroke="#aaa" strokeWidth="1.2" />
            <path d="M5.5 7V5C5.5 3.3 6.6 2 8 2C9.4 2 10.5 3.3 10.5 5V7" stroke="#aaa" strokeWidth="1.2" strokeLinecap="round" />
            <circle cx="8" cy="10.5" r="1" fill="#aaa" />
        </svg>
    );
}

function LicenseIcon() {
    return (
        <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 16 16" fill="none">
            <path d="M3.5 1.5H9.5L13.5 5.5V14.5H3.5V1.5Z" stroke="#aaa" strokeWidth="1" strokeLinejoin="round" />
            <path d="M9.5 1.5V5.5H13.5" stroke="#aaa" strokeWidth="1" strokeLinejoin="round" />
            <path d="M5.5 8H10.5M5.5 10H9" stroke="#aaa" strokeWidth="1" strokeLinecap="round" />
        </svg>
    );
}

function ViteIcon() {
    return (
        <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 16 16" fill="none">
            <path d="M14 2L8 14.5L2 2L8 4L14 2Z" fill="url(#viteGrad)" />
            <path d="M10 1L8 4L12 3L10 1Z" fill="#ffbd2e" />
            <defs>
                <linearGradient id="viteGrad" x1="2" y1="2" x2="14" y2="14">
                    <stop offset="0%" stopColor="#41d1ff" />
                    <stop offset="100%" stopColor="#bd34fe" />
                </linearGradient>
            </defs>
        </svg>
    );
}

function ShellIcon() {
    return (
        <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 16 16" fill="none">
            <path d="M3 5L6.5 8L3 11" stroke="#89e051" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <line x1="8" y1="11" x2="13" y2="11" stroke="#89e051" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
    );
}

function DocumentIcon({ color = '#8ea0b5' }: { color?: string }) {
    return (
        <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 16 16" fill="none">
            <path d="M3.5 1.5H9.5L13.5 5.5V14.5H3.5V1.5Z" stroke={color} strokeWidth="1.2" strokeLinejoin="round" />
            <path d="M9.5 1.5V5.5H13.5" stroke={color} strokeWidth="1.2" strokeLinejoin="round" />
        </svg>
    );
}

function FolderClosedIcon() {
    return (
        <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 16 16" fill="none">
            <path d="M1.5 3C1.5 2.44772 1.94772 2 2.5 2H6.2C6.55 2 6.88 2.18 7.07 2.48L7.8 3.5H13.5C14.0523 3.5 14.5 3.94772 14.5 4.5V12.5C14.5 13.0523 14.0523 13.5 13.5 13.5H2.5C1.94772 13.5 1.5 13.0523 1.5 12.5V3Z" fill="#e5c07b" />
        </svg>
    );
}

function FolderOpenedIcon() {
    return (
        <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 16 16" fill="none">
            <path d="M1.5 3C1.5 2.44772 1.94772 2 2.5 2H6.2C6.55 2 6.88 2.18 7.07 2.48L7.8 3.5H13.5C14.0523 3.5 14.5 3.94772 14.5 4.5V6H3L1.5 13V3Z" fill="#c9a756" />
            <path d="M1.5 13L3.2 6.5H15L13.5 13H1.5Z" fill="#f0d38d" stroke="#c9a756" strokeWidth="0.8" />
        </svg>
    );
}

function getExtensionIcon(ext: string): IconDef | null {
    switch (ext) {
        case '.ts':
        case '.mts':
        case '.cts':
            return { icon: <TypeScriptIcon />, color: colors.typescript };
        case '.tsx':
            return { icon: <ReactIcon />, color: colors.react };

        case '.js':
        case '.mjs':
        case '.cjs':
            return { icon: <JavaScriptIcon />, color: colors.javascript };
        case '.jsx':
            return { icon: <ReactIcon />, color: colors.react };

        case '.go':
            return { icon: <GoIcon />, color: colors.go };

        case '.py':
        case '.pyw':
        case '.pyi':
            return { icon: <PythonIcon />, color: colors.python };

        case '.rs':
            return { icon: <RustIcon />, color: colors.rust };

        case '.c':
        case '.h':
            return { icon: <CIcon />, color: colors.c };
        case '.cpp':
        case '.cc':
        case '.cxx':
        case '.hpp':
            return { icon: <CppIcon />, color: colors.cpp };
        case '.cs':
            return { icon: <CSharpIcon />, color: colors.csharp };

        case '.java':
            return { icon: <JavaIcon />, color: colors.java };
        case '.kt':
        case '.kts':
            return { icon: <KotlinIcon />, color: colors.kotlin };

        case '.rb':
        case '.erb':
            return { icon: <RubyIcon />, color: colors.ruby };
        case '.php':
            return { icon: <PhpIcon />, color: colors.php };
        case '.swift':
            return { icon: <SwiftIcon />, color: colors.swift };
        case '.dart':
            return { icon: <DartIcon />, color: colors.dart };
        case '.lua':
            return { icon: <LuaIcon />, color: colors.lua };

        case '.html':
        case '.htm':
            return { icon: <HtmlIcon />, color: colors.html };
        case '.css':
            return { icon: <CssIcon />, color: colors.css };
        case '.scss':
        case '.sass':
            return { icon: <ScssIcon />, color: colors.scss };
        case '.vue':
            return { icon: <VueIcon />, color: colors.vue };
        case '.svelte':
            return { icon: <SvelteIcon />, color: colors.svelte };

        case '.json':
        case '.jsonc':
        case '.json5':
            return { icon: <JsonIcon />, color: colors.json };
        case '.yaml':
        case '.yml':
            return { icon: <YamlIcon />, color: colors.yaml };
        case '.toml':
            return { icon: <TomlIcon />, color: colors.toml };
        case '.xml':
            return { icon: <XmlIcon />, color: colors.xml };
        case '.sql':
            return { icon: <SqlIcon />, color: colors.sql };
        case '.graphql':
        case '.gql':
            return { icon: <GraphqlIcon />, color: colors.graphql };

        case '.md':
        case '.mdx':
            return { icon: <MarkdownIcon />, color: colors.markdown };
        case '.txt':
        case '.log':
            return { icon: <DocumentIcon color={colors.text} />, color: colors.text };
        case '.pdf':
            return { icon: <PdfIcon />, color: colors.pdf };

        case '.sh':
        case '.bash':
        case '.zsh':
        case '.fish':
        case '.ps1':
        case '.bat':
        case '.cmd':
            return { icon: <ShellIcon />, color: colors.shell };

        case '.env':
            return { icon: <EnvIcon />, color: colors.env };
        case '.ini':
        case '.cfg':
        case '.conf':
            return { icon: <ConfigIcon />, color: colors.text };

        case '.png':
        case '.jpg':
        case '.jpeg':
        case '.gif':
        case '.bmp':
        case '.svg':
        case '.ico':
        case '.webp':
            return { icon: <ImageIcon />, color: colors.image };

        case '.mp4':
        case '.mov':
        case '.avi':
        case '.mkv':
        case '.webm':
            return { icon: <VideoIcon />, color: colors.video };
        case '.mp3':
        case '.wav':
        case '.flac':
        case '.ogg':
            return { icon: <AudioIcon />, color: colors.audio };

        case '.zip':
        case '.tar':
        case '.gz':
        case '.7z':
        case '.rar':
            return { icon: <ArchiveIcon />, color: colors.archive };

        case '.exe':
        case '.dll':
        case '.so':
        case '.wasm':
            return { icon: <BinaryIcon />, color: colors.binary };

        default:
            return null;
    }
}

function getSpecialFileIcon(name: string): IconDef | null {
    const lower = name.toLowerCase();

    switch (lower) {
        case '.gitignore':
        case '.gitattributes':
        case '.gitmodules':
        case '.gitkeep':
            return { icon: <GitIcon />, color: colors.git };

        case 'dockerfile':
        case 'docker-compose.yml':
        case 'docker-compose.yaml':
        case '.dockerignore':
            return { icon: <DockerIcon />, color: colors.docker };

        case 'package.json':
            return { icon: <NpmIcon />, color: colors.package };
        case 'package-lock.json':
        case 'yarn.lock':
        case 'pnpm-lock.yaml':
        case 'bun.lockb':
            return { icon: <LockIcon />, color: '#aaa' };

        case 'go.mod':
        case 'go.sum':
            return { icon: <GoIcon />, color: colors.go };

        case 'cargo.toml':
        case 'cargo.lock':
            return { icon: <RustIcon />, color: colors.rust };

        case 'requirements.txt':
        case 'setup.py':
        case 'pyproject.toml':
            return { icon: <PythonIcon />, color: colors.python };

        case 'tsconfig.json':
        case 'jsconfig.json':
            return { icon: <TypeScriptIcon />, color: colors.typescript };
        case 'vite.config.ts':
        case 'vite.config.js':
            return { icon: <ViteIcon />, color: '#a855f7' };
        case 'wails.json':
            return { icon: <JsonIcon />, color: colors.json };

        case '.env':
        case '.env.local':
        case '.env.development':
        case '.env.production':
        case '.env.example':
            return { icon: <EnvIcon />, color: colors.env };

        case 'readme.md':
        case 'readme.txt':
        case 'readme':
            return { icon: <MarkdownIcon />, color: colors.markdown };
        case 'license':
        case 'license.md':
        case 'license.txt':
            return { icon: <LicenseIcon />, color: '#aaa' };

        default:
            return null;
    }
}

export function getFileIcon(
    name: string,
    isDir: boolean,
    isOpen: boolean = false
): { icon: React.ReactNode; color: string } {
    if (isDir) {
        if (name.toLowerCase() === '.git') {
            return {
                icon: <GitIcon />,
                color: colors.git,
            };
        }

        return {
            icon: isOpen ? <FolderOpenedIcon /> : <FolderClosedIcon />,
            color: isOpen ? colors.folderOpen : colors.folder,
        };
    }

    const specialFile = getSpecialFileIcon(name);
    if (specialFile) return specialFile;

    const dotIndex = name.lastIndexOf('.');
    if (dotIndex > 0) {
        const ext = name.substring(dotIndex).toLowerCase();
        const extIcon = getExtensionIcon(ext);
        if (extIcon) return extIcon;
    }

    return {
        icon: <DocumentIcon color={colors.defaultFile} />,
        color: colors.defaultFile,
    };
}
