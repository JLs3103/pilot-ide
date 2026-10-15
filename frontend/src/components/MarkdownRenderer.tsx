import React, {useState, useMemo} from 'react';
import {Copy, Check} from 'lucide-react';
import './MarkdownRenderer.css';

type Props = {
    content: string;
    className?: string;
};

type Block =
    | { type: 'code'; lang: string; code: string }
    | { type: 'heading'; level: number; text: string }
    | { type: 'blockquote'; text: string }
    | { type: 'ul'; items: string[] }
    | { type: 'ol'; items: string[] }
    | { type: 'hr' }
    | { type: 'paragraph'; text: string };

function parseBlocks(markdown: string): Block[] {
    const lines = markdown.split(/\r?\n/);
    const blocks: Block[] = [];
    let i = 0;

    while (i < lines.length) {
        const line = lines[i];

        if (line.trim().startsWith('```')) {
            const lang = line.trim().slice(3).trim();
            const codeLines: string[] = [];
            i++;
            while (i < lines.length && !lines[i].trim().startsWith('```')) {
                codeLines.push(lines[i]);
                i++;
            }
            blocks.push({
                type: 'code',
                lang: lang || 'text',
                code: codeLines.join('\n'),
            });
            i++;
            continue;
        }

        const hMatch = line.match(/^(#{1,6})\s+(.*)$/);
        if (hMatch) {
            blocks.push({
                type: 'heading',
                level: hMatch[1].length,
                text: hMatch[2],
            });
            i++;
            continue;
        }

        if (/^(\-{3,}|\*{3,}|_{3,})$/.test(line.trim())) {
            blocks.push({ type: 'hr' });
            i++;
            continue;
        }

        if (line.trim().startsWith('>')) {
            const quoteLines: string[] = [];
            while (i < lines.length && lines[i].trim().startsWith('>')) {
                quoteLines.push(lines[i].replace(/^>\s?/, ''));
                i++;
            }
            blocks.push({
                type: 'blockquote',
                text: quoteLines.join('\n'),
            });
            continue;
        }

        const ulMatch = line.match(/^(\*|-|\+)\s+(.*)$/);
        if (ulMatch) {
            const items: string[] = [];
            while (i < lines.length) {
                const m = lines[i].match(/^(\*|-|\+)\s+(.*)$/);
                if (!m) break;
                items.push(m[2]);
                i++;
            }
            blocks.push({ type: 'ul', items });
            continue;
        }

        const olMatch = line.match(/^(\d+)\.\s+(.*)$/);
        if (olMatch) {
            const items: string[] = [];
            while (i < lines.length) {
                const m = lines[i].match(/^(\d+)\.\s+(.*)$/);
                if (!m) break;
                items.push(m[2]);
                i++;
            }
            blocks.push({ type: 'ol', items });
            continue;
        }

        if (!line.trim()) {
            i++;
            continue;
        }

        const pLines: string[] = [];
        while (
            i < lines.length &&
            lines[i].trim() &&
            !lines[i].trim().startsWith('```') &&
            !lines[i].match(/^(#{1,6})\s+/) &&
            !lines[i].match(/^(\*|-|\+)\s+/) &&
            !lines[i].match(/^(\d+)\.\s+/) &&
            !lines[i].trim().startsWith('>') &&
            !/^(\-{3,}|\*{3,}|_{3,})$/.test(lines[i].trim())
        ) {
            pLines.push(lines[i]);
            i++;
        }
        blocks.push({
            type: 'paragraph',
            text: pLines.join('\n'),
        });
    }

    return blocks;
}

function renderInline(text: string): React.ReactNode[] {
    const tokenRegex = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*]+\*)|(__[^_]+__)|(_[^_]+_)|(@[a-zA-Z0-9_\-\./\\]+)|(\[[^\]]+\]\([^)]+\))/g;
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = tokenRegex.exec(text)) !== null) {
        if (match.index > lastIndex) {
            parts.push(text.slice(lastIndex, match.index));
        }

        const token = match[0];
        if (token.startsWith('`') && token.endsWith('`')) {
            parts.push(
                <code key={match.index} className="md-inline-code">
                    {token.slice(1, -1)}
                </code>
            );
        } else if (
            (token.startsWith('**') && token.endsWith('**')) ||
            (token.startsWith('__') && token.endsWith('__'))
        ) {
            parts.push(
                <strong key={match.index} className="md-strong">
                    {token.slice(2, -2)}
                </strong>
            );
        } else if (
            (token.startsWith('*') && token.endsWith('*')) ||
            (token.startsWith('_') && token.endsWith('_'))
        ) {
            parts.push(
                <em key={match.index} className="md-em">
                    {token.slice(1, -1)}
                </em>
            );
        } else if (token.startsWith('@')) {
            parts.push(
                <span key={match.index} className="md-mention-pill">
                    {token}
                </span>
            );
        } else if (token.startsWith('[') && token.includes('](') && token.endsWith(')')) {
            const linkMatch = token.match(/\[([^\]]+)\]\(([^)]+)\)/);
            if (linkMatch) {
                parts.push(
                    <a
                        key={match.index}
                        href={linkMatch[2]}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="md-link"
                    >
                        {linkMatch[1]}
                    </a>
                );
            } else {
                parts.push(token);
            }
        } else {
            parts.push(token);
        }

        lastIndex = match.index + token.length;
    }

    if (lastIndex < text.length) {
        parts.push(text.slice(lastIndex));
    }

    return parts;
}

function CodeBlock({ lang, code }: { lang: string; code: string }) {
    const [copied, setCopied] = useState(false);

    function copyCode() {
        void navigator.clipboard.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }

    return (
        <div className="md-code-block-wrapper">
            <div className="md-code-block-header">
                <span className="md-code-lang">{lang}</span>
                <button
                    type="button"
                    className="md-code-copy-btn"
                    onClick={copyCode}
                    title="Copy code"
                >
                    {copied ? (
                        <>
                            <Check size={12} className="md-copy-check" />
                            <span>Copied!</span>
                        </>
                    ) : (
                        <>
                            <Copy size={12} />
                            <span>Copy</span>
                        </>
                    )}
                </button>
            </div>
            <pre className="md-pre">
                <code>{code}</code>
            </pre>
        </div>
    );
}

export function MarkdownRenderer({ content, className }: Props) {
    const blocks = useMemo(() => parseBlocks(content), [content]);

    return (
        <div className={`markdown-body ${className || ''}`}>
            {blocks.map((block, idx) => {
                switch (block.type) {
                    case 'code':
                        return <CodeBlock key={idx} lang={block.lang} code={block.code} />;
                    case 'heading': {
                        if (block.level === 1) return <h1 key={idx} className="md-h1">{renderInline(block.text)}</h1>;
                        if (block.level === 2) return <h2 key={idx} className="md-h2">{renderInline(block.text)}</h2>;
                        if (block.level === 3) return <h3 key={idx} className="md-h3">{renderInline(block.text)}</h3>;
                        return <h4 key={idx} className="md-h4">{renderInline(block.text)}</h4>;
                    }
                    case 'hr':
                        return <hr key={idx} className="md-hr" />;
                    case 'blockquote':
                        return (
                            <blockquote key={idx} className="md-blockquote">
                                {renderInline(block.text)}
                            </blockquote>
                        );
                    case 'ul':
                        return (
                            <ul key={idx} className="md-ul">
                                {block.items.map((item, i) => (
                                    <li key={i} className="md-li">{renderInline(item)}</li>
                                ))}
                            </ul>
                        );
                    case 'ol':
                        return (
                            <ol key={idx} className="md-ol">
                                {block.items.map((item, i) => (
                                    <li key={i} className="md-li">{renderInline(item)}</li>
                                ))}
                            </ol>
                        );
                    case 'paragraph':
                    default:
                        return (
                            <p key={idx} className="md-p">
                                {renderInline(block.text)}
                            </p>
                        );
                }
            })}
        </div>
    );
}
