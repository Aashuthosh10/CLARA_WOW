import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNotification } from './NotificationProvider';

const iconMap = {
    message: 'fa-solid fa-comment-dots',
    meeting: 'fa-solid fa-calendar-check',
    system: 'fa-solid fa-info-circle',
    call: 'fa-solid fa-phone',
};

const NotificationCard: React.FC<{ notification: any, onDismiss: (id: number) => void }> = ({ notification, onDismiss }) => {
    return (
        <motion.div
            layout
            initial={{ opacity: 0, x: 300, scale: 0.8 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 300, scale: 0.8, transition: { duration: 0.2 } }}
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
            className="w-full max-w-sm bg-slate-800/40 backdrop-blur-xl border border-white/30 rounded-2xl shadow-2xl p-5 text-white overflow-hidden relative"
            style={{
                background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.4) 0%, rgba(51, 65, 85, 0.3) 100%)',
                backdropFilter: 'blur(20px) saturate(180%)',
                WebkitBackdropFilter: 'blur(20px) saturate(180%)',
                boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.37)'
            }}
        >
            {/* Glassmorphism glow effect */}
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-blue-500/10 rounded-2xl pointer-events-none"></div>
            <div className="flex items-start relative z-10">
                <div className="flex-shrink-0 pt-0.5">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500/30 to-blue-500/30 backdrop-blur-sm flex items-center justify-center border border-white/20">
                        <i className={`${iconMap[notification.type] || 'fa-solid fa-bell'} text-purple-300 text-lg`}></i>
                    </div>
                </div>
                <div className="ml-3 flex-1">
                    <p className="text-sm font-semibold text-white drop-shadow-lg">{notification.title}</p>
                    <p className="mt-1 text-sm text-slate-200">{notification.message}</p>
                </div>
                <div className="ml-4 flex-shrink-0 flex">
                    <button
                        onClick={() => onDismiss(notification.id)}
                        className="inline-flex text-slate-300 rounded-full hover:text-white hover:bg-white/10 p-1.5 transition-all focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                    >
                        <span className="sr-only">Close</span>
                        <i className="fa-solid fa-times text-sm"></i>
                    </button>
                </div>
            </div>
        </motion.div>
    );
}

const NotificationContainer: React.FC = () => {
    const { notifications, removeNotification } = useNotification();

    if (notifications.length === 0) {
        return null;
    }

    return (
        <div className="fixed top-4 right-4 lg:top-6 lg:right-6 z-[9999] w-full max-w-sm space-y-3 pointer-events-none px-2 lg:px-4">
            <AnimatePresence mode="popLayout">
                {notifications.map((n) => (
                    <div key={n.id} className="pointer-events-auto">
                        <NotificationCard notification={n} onDismiss={removeNotification} />
                    </div>
                ))}
            </AnimatePresence>
        </div>
    );
};

export default NotificationContainer;
