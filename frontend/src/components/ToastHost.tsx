import {useEffect, useState} from 'react';
import {X, AlertCircle, AlertTriangle, Info} from 'lucide-react';
import type {AppNotification} from '../lib/notifications';
import './ToastHost.css';

type Toast = AppNotification & {timer: number};

export function ToastHost() {
    const [toasts, setToasts] = useState<Toast[]>([]);

    useEffect(() => {
        const handleNotification = (event: Event) => {
            const notification = (event as CustomEvent<AppNotification>).detail;
            const timer = window.setTimeout(() => {
                setToasts(prev => prev.filter(toast => toast.id !== notification.id));
            }, 6500);
            setToasts(prev => [...prev, {...notification, timer}].slice(-4));
        };
        window.addEventListener('pilot:notification', handleNotification);
        return () => window.removeEventListener('pilot:notification', handleNotification);
    }, []);

    function dismiss(toast: Toast) {
        window.clearTimeout(toast.timer);
        setToasts(prev => prev.filter(item => item.id !== toast.id));
    }

    return (
        <div className="toast-host" aria-live="polite" aria-atomic="false">
            {toasts.map(toast => {
                const Icon = toast.level === 'error' ? AlertCircle : toast.level === 'warning' ? AlertTriangle : Info;
                return (
                    <div key={toast.id} className={`toast toast-${toast.level}`} role={toast.level === 'error' ? 'alert' : 'status'}>
                        <Icon size={16} />
                        <span>{toast.message}</span>
                        <button type="button" onClick={() => dismiss(toast)} title="Dismiss notification" aria-label="Dismiss notification">
                            <X size={14} />
                        </button>
                    </div>
                );
            })}
        </div>
    );
}
