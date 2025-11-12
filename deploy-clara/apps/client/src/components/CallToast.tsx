/**
 * CallToast Component for Client
 * Toast notifications for call events with auto-dismiss and action buttons
 */
import React, { useEffect, useState } from 'react';

export type ToastType = 'connecting' | 'accepted' | 'declined' | 'missed' | 'ended' | 'error';

interface CallToastProps {
  type: ToastType;
  message?: string;
  duration?: number;
  onDismiss: () => void;
  onAction?: () => void;
  actionLabel?: string;
}

const CallToast: React.FC<CallToastProps> = ({
  type,
  message,
  duration = 5000,
  onDismiss,
  onAction,
  actionLabel,
}) => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        setIsVisible(false);
        setTimeout(onDismiss, 300); // Wait for fade-out animation
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [duration, onDismiss]);

  const getToastConfig = () => {
    switch (type) {
      case 'connecting':
        return {
          bg: 'bg-blue-500/90',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ),
          defaultMessage: 'Connecting to staff...',
        };
      case 'accepted':
        return {
          bg: 'bg-green-500/90',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          ),
          defaultMessage: 'Call accepted! Connecting...',
        };
      case 'declined':
        return {
          bg: 'bg-yellow-500/90',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ),
          defaultMessage: 'Call declined by staff',
        };
      case 'missed':
        return {
          bg: 'bg-orange-500/90',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
          ),
          defaultMessage: 'Call missed - no staff available',
        };
      case 'ended':
        return {
          bg: 'bg-slate-500/90',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M16 8l2 2m0 0l2 2m-2-2l-2 2m2-2l-2-2M3 12a9 9 0 1118 0 9 9 0 01-18 0z" />
            </svg>
          ),
          defaultMessage: 'Call ended',
        };
      case 'error':
        return {
          bg: 'bg-red-500/90',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ),
          defaultMessage: 'An error occurred',
        };
    }
  };

  const config = getToastConfig();

  if (!isVisible) return null;

  return (
    <div
      className={`fixed top-4 right-4 ${config.bg} backdrop-blur-sm text-white px-6 py-4 rounded-lg shadow-2xl flex items-center space-x-4 min-w-[300px] max-w-md z-50 transition-all ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
      }`}
    >
      <div className="flex-shrink-0">{config.icon}</div>
      <div className="flex-1">
        <p className="font-semibold">{message || config.defaultMessage}</p>
        {onAction && actionLabel && (
          <button
            onClick={() => {
              onAction();
              setIsVisible(false);
              setTimeout(onDismiss, 300);
            }}
            className="mt-2 text-sm underline hover:no-underline"
          >
            {actionLabel}
          </button>
        )}
      </div>
      <button
        onClick={() => {
          setIsVisible(false);
          setTimeout(onDismiss, 300);
        }}
        className="flex-shrink-0 hover:bg-white/20 rounded p-1 transition-colors"
        aria-label="Dismiss"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
};

export default CallToast;

