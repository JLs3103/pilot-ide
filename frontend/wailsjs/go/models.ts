export namespace agent {
	
	export class Action {
	    name: string;
	    detail: string;
	    ok: boolean;
	    error?: string;
	
	    static createFrom(source: any = {}) {
	        return new Action(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.detail = source["detail"];
	        this.ok = source["ok"];
	        this.error = source["error"];
	    }
	}

}

export namespace ai {
	
	export class Message {
	    role: string;
	    content: string;
	
	    static createFrom(source: any = {}) {
	        return new Message(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.role = source["role"];
	        this.content = source["content"];
	    }
	}
	export class Reply {
	    text: string;
	    mode: string;
	    model: string;
	    actions?: agent.Action[];
	
	    static createFrom(source: any = {}) {
	        return new Reply(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.text = source["text"];
	        this.mode = source["mode"];
	        this.model = source["model"];
	        this.actions = this.convertValues(source["actions"], agent.Action);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class Status {
	    mode: string;
	    localModel: string;
	    cloudModel: string;
	    hasGeminiKey: boolean;
	    ollamaURL: string;
	    ollamaUp: boolean;
	
	    static createFrom(source: any = {}) {
	        return new Status(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.mode = source["mode"];
	        this.localModel = source["localModel"];
	        this.cloudModel = source["cloudModel"];
	        this.hasGeminiKey = source["hasGeminiKey"];
	        this.ollamaURL = source["ollamaURL"];
	        this.ollamaUp = source["ollamaUp"];
	    }
	}

}

export namespace fsutil {
	
	export class DirEntry {
	    name: string;
	    path: string;
	    isDir: boolean;
	
	    static createFrom(source: any = {}) {
	        return new DirEntry(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.path = source["path"];
	        this.isDir = source["isDir"];
	    }
	}
	export class FormatResult {
	    formatted: string;
	    error?: string;
	
	    static createFrom(source: any = {}) {
	        return new FormatResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.formatted = source["formatted"];
	        this.error = source["error"];
	    }
	}
	export class ProjectSettings {
	    formatOnSave: boolean;
	    tabSize?: number;
	    theme?: string;
	    fontSize?: number;
	    lineHeight?: number;
	    wordWrap?: string;
	    minimap?: boolean;
	    formatters?: Record<string, string>;
	    excludeFiles?: string[];
	    snippets?: Record<string, any>;
	
	    static createFrom(source: any = {}) {
	        return new ProjectSettings(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.formatOnSave = source["formatOnSave"];
	        this.tabSize = source["tabSize"];
	        this.theme = source["theme"];
	        this.fontSize = source["fontSize"];
	        this.lineHeight = source["lineHeight"];
	        this.wordWrap = source["wordWrap"];
	        this.minimap = source["minimap"];
	        this.formatters = source["formatters"];
	        this.excludeFiles = source["excludeFiles"];
	        this.snippets = source["snippets"];
	    }
	}
	export class RecentProject {
	    path: string;
	    name: string;
	    openedAt: number;
	
	    static createFrom(source: any = {}) {
	        return new RecentProject(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.path = source["path"];
	        this.name = source["name"];
	        this.openedAt = source["openedAt"];
	    }
	}
	export class SearchMatch {
	    file: string;
	    line: number;
	    column: number;
	    text: string;
	    matchStart: number;
	    matchEnd: number;
	
	    static createFrom(source: any = {}) {
	        return new SearchMatch(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.file = source["file"];
	        this.line = source["line"];
	        this.column = source["column"];
	        this.text = source["text"];
	        this.matchStart = source["matchStart"];
	        this.matchEnd = source["matchEnd"];
	    }
	}
	export class SearchResult {
	    matches: SearchMatch[];
	    total: number;
	
	    static createFrom(source: any = {}) {
	        return new SearchResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.matches = this.convertValues(source["matches"], SearchMatch);
	        this.total = source["total"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class SnippetDef {
	    prefix: string;
	    body: string[];
	    description: string;
	    language: string;
	
	    static createFrom(source: any = {}) {
	        return new SnippetDef(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.prefix = source["prefix"];
	        this.body = source["body"];
	        this.description = source["description"];
	        this.language = source["language"];
	    }
	}
	export class TreeNode {
	    name: string;
	    path: string;
	    isDir: boolean;
	    children?: TreeNode[];
	
	    static createFrom(source: any = {}) {
	        return new TreeNode(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.path = source["path"];
	        this.isDir = source["isDir"];
	        this.children = this.convertValues(source["children"], TreeNode);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}

}

export namespace main {
	
	export class GitBranchInfo {
	    name: string;
	    current: boolean;
	
	    static createFrom(source: any = {}) {
	        return new GitBranchInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.current = source["current"];
	    }
	}
	export class GitLogEntry {
	    hash: string;
	    author: string;
	    date: string;
	    message: string;
	
	    static createFrom(source: any = {}) {
	        return new GitLogEntry(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.hash = source["hash"];
	        this.author = source["author"];
	        this.date = source["date"];
	        this.message = source["message"];
	    }
	}
	export class GitStatusEntry {
	    path: string;
	    status: string;
	    staged: boolean;
	
	    static createFrom(source: any = {}) {
	        return new GitStatusEntry(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.path = source["path"];
	        this.status = source["status"];
	        this.staged = source["staged"];
	    }
	}

}

export namespace terminal {
	
	export class Result {
	    stdout: string;
	    stderr: string;
	    exitCode: number;
	    cwd: string;
	
	    static createFrom(source: any = {}) {
	        return new Result(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.stdout = source["stdout"];
	        this.stderr = source["stderr"];
	        this.exitCode = source["exitCode"];
	        this.cwd = source["cwd"];
	    }
	}

}

