import * as monaco from 'monaco-editor';

export type SnippetDef = {
    prefix: string;
    body: string[];
    description: string;
    language?: string;
};

const builtinSnippets: SnippetDef[] = [
    {prefix: 'clg', body: ['console.log($1);'], description: 'Console Log', language: 'javascript'},
    {prefix: 'clg', body: ['console.log($1);'], description: 'Console Log', language: 'typescript'},
    {prefix: 'fn', body: ['function ${1:name}(${2:params}) {', '\t$0', '}'], description: 'Function Declaration', language: 'javascript'},
    {prefix: 'fn', body: ['function ${1:name}(${2:params}): ${3:void} {', '\t$0', '}'], description: 'Function Declaration', language: 'typescript'},
    {prefix: 'afn', body: ['const ${1:name} = (${2:params}) => {', '\t$0', '};'], description: 'Arrow Function', language: 'javascript'},
    {prefix: 'afn', body: ['const ${1:name} = (${2:params}): ${3:void} => {', '\t$0', '};'], description: 'Arrow Function', language: 'typescript'},
    {prefix: 'iife', body: ['(function() {', '\t$0', '})();'], description: 'IIFE', language: 'javascript'},
    {prefix: 'forof', body: ['for (const ${1:item} of ${2:iterable}) {', '\t$0', '}'], description: 'For...of Loop', language: 'javascript'},
    {prefix: 'forin', body: ['for (const ${1:key} in ${2:object}) {', '\t$0', '}'], description: 'For...in Loop', language: 'javascript'},
    {prefix: 'trycatch', body: ['try {', '\t$1', '} catch (${2:error}) {', '\t$0', '}'], description: 'Try Catch', language: 'javascript'},
    {prefix: 'trycatch', body: ['try {', '\t$1', '} catch (${2:error}) {', '\t$0', '}'], description: 'Try Catch', language: 'typescript'},
    {prefix: 'prom', body: ['new Promise((resolve, reject) => {', '\t$0', '});'], description: 'Promise', language: 'javascript'},
    {prefix: 'imp', body: ["import ${1:module} from '${2:path}';"], description: 'Import', language: 'javascript'},
    {prefix: 'imp', body: ["import ${1:module} from '${2:path}';"], description: 'Import', language: 'typescript'},
    {prefix: 'imn', body: ["import '${1:path}';"], description: 'Import No Assign', language: 'javascript'},
    {prefix: 'imd', body: ["import { ${1:module} } from '${2:path}';"], description: 'Import Destructured', language: 'javascript'},
    {prefix: 'imd', body: ["import { ${1:module} } from '${2:path}';"], description: 'Import Destructured', language: 'typescript'},
    {prefix: 'exp', body: ['export ${1:default} ${2:name};'], description: 'Export', language: 'javascript'},
    {prefix: 'edf', body: ['export default function ${1:name}(${2:params}) {', '\t$0', '}'], description: 'Export Default Function', language: 'javascript'},
    {prefix: 'edf', body: ['export default function ${1:name}(${2:params}): ${3:void} {', '\t$0', '}'], description: 'Export Default Function', language: 'typescript'},
    {prefix: 'ust', body: ['const [${1:state}, set${1/(.*)/${1:/capitalize}/}] = useState(${2:initial});'], description: 'React useState', language: 'typescript'},
    {prefix: 'uef', body: ['useEffect(() => {', '\t$0', '}, [${1:deps}]);'], description: 'React useEffect', language: 'typescript'},
    {prefix: 'ucb', body: ['const ${1:fn} = useCallback((${2:params}) => {', '\t$0', '}, [${3:deps}]);'], description: 'React useCallback', language: 'typescript'},
    {prefix: 'urf', body: ['const ${1:ref} = useRef<${2:HTMLDivElement}>(${3:null});'], description: 'React useRef', language: 'typescript'},
    {prefix: 'rfc', body: ['export function ${1:Component}(${2:props}: ${3:Props}) {', '\treturn (', '\t\t<div>', '\t\t\t$0', '\t\t</div>', '\t);', '}'], description: 'React Function Component', language: 'typescript'},

    {prefix: 'func', body: ['func ${1:name}(${2:params}) ${3:error} {', '\t$0', '}'], description: 'Function', language: 'go'},
    {prefix: 'meth', body: ['func (${1:r} *${2:Receiver}) ${3:Name}(${4:params}) ${5:error} {', '\t$0', '}'], description: 'Method', language: 'go'},
    {prefix: 'iferr', body: ['if err != nil {', '\treturn ${1:err}', '}'], description: 'If Error', language: 'go'},
    {prefix: 'fori', body: ['for ${1:i} := 0; ${1:i} < ${2:n}; ${1:i}++ {', '\t$0', '}'], description: 'For Loop', language: 'go'},
    {prefix: 'forr', body: ['for ${1:k}, ${2:v} := range ${3:collection} {', '\t$0', '}'], description: 'For Range', language: 'go'},
    {prefix: 'main', body: ['package main', '', 'func main() {', '\t$0', '}'], description: 'Main Package', language: 'go'},
    {prefix: 'struct', body: ['type ${1:Name} struct {', '\t$0', '}'], description: 'Struct', language: 'go'},
    {prefix: 'inter', body: ['type ${1:Name} interface {', '\t$0', '}'], description: 'Interface', language: 'go'},
    {prefix: 'switch', body: ['switch ${1:v} {', 'case ${2:val}:', '\t$0', 'default:', '\t', '}'], description: 'Switch', language: 'go'},
    {prefix: 'goroutine', body: ['go func() {', '\t$0', '}()'], description: 'Goroutine', language: 'go'},
    {prefix: 'defer', body: ['defer func() {', '\t$0', '}()'], description: 'Defer', language: 'go'},
    {prefix: 'test', body: ['func Test${1:Name}(t *testing.T) {', '\t$0', '}'], description: 'Test Function', language: 'go'},

    {prefix: 'def', body: ['def ${1:name}(${2:params}):', '\t${3:pass}'], description: 'Function', language: 'python'},
    {prefix: 'class', body: ['class ${1:Name}:', '\tdef __init__(self${2:, params}):', '\t\t${3:pass}'], description: 'Class', language: 'python'},
    {prefix: 'ifmain', body: ["if __name__ == '__main__':", '\t${1:main()}'], description: 'If Main', language: 'python'},
    {prefix: 'fori', body: ['for ${1:i} in range(${2:n}):', '\t$0'], description: 'For Range', language: 'python'},
    {prefix: 'forin', body: ['for ${1:item} in ${2:iterable}:', '\t$0'], description: 'For In', language: 'python'},
    {prefix: 'tryex', body: ['try:', '\t$1', 'except ${2:Exception} as ${3:e}:', '\t$0'], description: 'Try Except', language: 'python'},
    {prefix: 'with', body: ['with ${1:open}(${2:file}) as ${3:f}:', '\t$0'], description: 'With', language: 'python'},
    {prefix: 'lcomp', body: ['[${1:expr} for ${2:item} in ${3:iterable}]'], description: 'List Comprehension', language: 'python'},

    {prefix: 'html5', body: ['<!DOCTYPE html>', '<html lang="en">', '<head>', '\t<meta charset="UTF-8">', '\t<meta name="viewport" content="width=device-width, initial-scale=1.0">', '\t<title>${1:Document}</title>', '</head>', '<body>', '\t$0', '</body>', '</html>'], description: 'HTML5 Boilerplate', language: 'html'},
    {prefix: 'div', body: ['<div class="${1:className}">', '\t$0', '</div>'], description: 'Div', language: 'html'},
    {prefix: 'a', body: ['<a href="${1:#}">${2:link}</a>'], description: 'Anchor', language: 'html'},
    {prefix: 'img', body: ['<img src="${1:src}" alt="${2:alt}" />'], description: 'Image', language: 'html'},
    {prefix: 'link', body: ['<link rel="stylesheet" href="${1:style.css}" />'], description: 'Link CSS', language: 'html'},
    {prefix: 'script', body: ['<script src="${1:script.js}"></script>'], description: 'Script', language: 'html'},

    {prefix: 'flex', body: ['display: flex;', 'align-items: ${1:center};', 'justify-content: ${2:center};'], description: 'Flexbox Center', language: 'css'},
    {prefix: 'grid', body: ['display: grid;', 'grid-template-columns: ${1:1fr 1fr};', 'gap: ${2:1rem};'], description: 'Grid', language: 'css'},
    {prefix: 'media', body: ['@media (max-width: ${1:768px}) {', '\t$0', '}'], description: 'Media Query', language: 'css'},
    {prefix: 'var', body: ['--${1:name}: ${2:value};'], description: 'CSS Variable', language: 'css'},
    {prefix: 'transition', body: ['transition: ${1:all} ${2:0.3s} ${3:ease};'], description: 'Transition', language: 'css'},

    {prefix: 'pkg', body: ['{', '\t"name": "${1:package-name}",', '\t"version": "${2:1.0.0}",', '\t"description": "${3:}",', '\t"main": "${4:index.js}",', '\t"scripts": {', '\t\t"test": "echo \\"Error: no test specified\\" && exit 1"', '\t},', '\t"keywords": [],', '\t"license": "${5:MIT}"', '}'], description: 'Package.json', language: 'json'},

    {prefix: 'fn', body: ['fn ${1:name}(${2:params}) -> ${3:Result<()>} {', '\t$0', '}'], description: 'Function', language: 'rust'},
    {prefix: 'struct', body: ['#[derive(Debug)]', 'struct ${1:Name} {', '\t$0', '}'], description: 'Struct', language: 'rust'},
    {prefix: 'impl', body: ['impl ${1:Name} {', '\t$0', '}'], description: 'Impl', language: 'rust'},
    {prefix: 'match', body: ['match ${1:value} {', '\t${2:pattern} => $0,', '}'], description: 'Match', language: 'rust'},
    {prefix: 'test', body: ['#[test]', 'fn ${1:test_name}() {', '\t$0', '}'], description: 'Test', language: 'rust'},

    {prefix: 'sel', body: ['SELECT ${1:*}', 'FROM ${2:table}', 'WHERE ${3:condition};'], description: 'Select', language: 'sql'},
    {prefix: 'ins', body: ['INSERT INTO ${1:table} (${2:columns})', 'VALUES (${3:values});'], description: 'Insert', language: 'sql'},
    {prefix: 'upd', body: ['UPDATE ${1:table}', 'SET ${2:column} = ${3:value}', 'WHERE ${4:condition};'], description: 'Update', language: 'sql'},
    {prefix: 'crt', body: ['CREATE TABLE ${1:table} (', '\t${2:id} INTEGER PRIMARY KEY,', '\t$0', ');'], description: 'Create Table', language: 'sql'},
];

const registeredLanguages = new Set<string>();

export function registerSnippets(
    monacoInstance: typeof monaco,
    language: string,
    customSnippets?: SnippetDef[]
): void {
    if (registeredLanguages.has(language)) return;
    registeredLanguages.add(language);

    const langSnippets = builtinSnippets.filter(s => s.language === language);
    const customs = (customSnippets ?? []).filter(s => !s.language || s.language === language);
    const all = [...langSnippets, ...customs];
    if (all.length === 0) return;

    monacoInstance.languages.registerCompletionItemProvider(language, {
        provideCompletionItems(model, position) {
            const word = model.getWordUntilPosition(position);
            const range = {
                startLineNumber: position.lineNumber,
                endLineNumber: position.lineNumber,
                startColumn: word.startColumn,
                endColumn: word.endColumn,
            };

            return {
                suggestions: all.map(s => ({
                    label: s.prefix,
                    kind: monacoInstance.languages.CompletionItemKind.Snippet,
                    insertText: s.body.join('\n'),
                    insertTextRules: monacoInstance.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                    documentation: s.description,
                    detail: `Snippet: ${s.description}`,
                    range,
                })),
            };
        },
    });
}

export function configureLanguageBrackets(monacoInstance: typeof monaco): void {
    const allLangs = [
        'typescript', 'javascript', 'go', 'python', 'rust', 'c', 'cpp',
        'csharp', 'java', 'kotlin', 'ruby', 'php', 'swift', 'dart', 'lua',
        'html', 'css', 'scss', 'less', 'json', 'yaml', 'xml', 'sql', 'shell', 'markdown'
    ];

    for (const lang of allLangs) {
        try {
            monacoInstance.languages.setLanguageConfiguration(lang, {
                brackets: [
                    ['{', '}'],
                    ['[', ']'],
                    ['(', ')'],
                ],
                autoClosingPairs: [
                    { open: '{', close: '}' },
                    { open: '[', close: ']' },
                    { open: '(', close: ')' },
                    { open: '"', close: '"', notIn: ['string'] },
                    { open: "'", close: "'", notIn: ['string', 'comment'] },
                    { open: '`', close: '`', notIn: ['string', 'comment'] },
                ],
                surroundingPairs: [
                    { open: '{', close: '}' },
                    { open: '[', close: ']' },
                    { open: '(', close: ')' },
                    { open: '"', close: '"' },
                    { open: "'", close: "'" },
                    { open: '`', close: '`' },
                ],
            });
        } catch {
        }
    }
}

export function registerAllSnippets(
    monacoInstance: typeof monaco,
    customSnippets?: SnippetDef[]
): void {
    configureLanguageBrackets(monacoInstance);
    const languages = new Set(builtinSnippets.map(s => s.language!));
    if (customSnippets) {
        customSnippets.forEach(s => {
            if (s.language) languages.add(s.language);
        });
    }
    languages.forEach(lang => registerSnippets(monacoInstance, lang, customSnippets));
}

export function clearSnippetRegistrations(): void {
    registeredLanguages.clear();
}
