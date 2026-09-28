export type DirEntry = {
    name: string;
    path: string;
    isDir: boolean;
};

export type CommandResult = {
    stdout: string;
    stderr: string;
    exitCode: number;
    cwd?: string;
};

export type AIStatus = {
    mode: string;
    localModel: string;
    cloudModel: string;
    hasGeminiKey: boolean;
    ollamaURL: string;
    ollamaUp: boolean;
};

export type ChatReply = {
    text: string;
    mode: string;
    model: string;
    actions?: ToolAction[];
};

export type ToolAction = {
    name: string;
    detail: string;
    ok: boolean;
    error?: string;
};
