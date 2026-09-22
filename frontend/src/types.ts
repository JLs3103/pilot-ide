export type DirEntry = {
    name: string;
    path: string;
    isDir: boolean;
};

export type CommandResult = {
    stdout: string;
    stderr: string;
    exitCode: number;
};
