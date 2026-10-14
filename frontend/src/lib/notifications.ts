export type NotificationLevel = 'error' | 'warning' | 'info';

export type AppNotification = {
    id: number;
    level: NotificationLevel;
    message: string;
};

let nextId = 1;

export function formatError(error: unknown): string {
    if (error instanceof Error) {
        return error.message || error.name;
    }
    return String(error);
}

export function reportError(context: string, error: unknown): string {
    const message = `${context}: ${formatError(error)}`;
    console.error(message, error);
    notify(message, 'error');
    return message;
}

export function notify(message: string, level: NotificationLevel = 'info') {
    window.dispatchEvent(new CustomEvent<AppNotification>('pilot:notification', {
        detail: {id: nextId++, level, message},
    }));
}
