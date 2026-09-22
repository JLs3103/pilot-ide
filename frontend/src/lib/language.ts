export function languageFromPath(path: string) {
    const ext = path.split('.').pop()?.toLowerCase() ?? '';
    const map: Record<string, string> = {
        ts: 'typescript',
        tsx: 'typescript',
        js: 'javascript',
        jsx: 'javascript',
        json: 'json',
        css: 'css',
        html: 'html',
        md: 'markdown',
        go: 'go',
        py: 'python',
        rs: 'rust',
        sh: 'shell',
        bash: 'shell',
        yml: 'yaml',
        yaml: 'yaml',
        toml: 'ini',
        xml: 'xml',
        sql: 'sql',
        txt: 'plaintext',
    };
    return map[ext] ?? 'plaintext';
}
