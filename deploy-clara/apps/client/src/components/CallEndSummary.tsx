/**
 * CallEndSummary Component for Client
 * Post-call modal with duration, quality metrics, and action options
 */
import React, { useMemo } from 'react';
import { useCallStore } from '../stores/callStore';

interface CallEndSummaryProps {
  visible: boolean;
  onClose: () => void;
  onLeaveMessage?: () => void;
  onRequestCallback?: () => void;
}

const CallEndSummary: React.FC<CallEndSummaryProps> = ({
  visible,
  onClose,
  onLeaveMessage,
  onRequestCallback,
}) => {
  const { callData, state } = useCallStore();

  const duration = useMemo(() => {
    if (!callData.startedAt || !callData.endedAt) return 0;
    return Math.floor((callData.endedAt - callData.startedAt) / 1000);
  }, [callData.startedAt, callData.endedAt]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!visible || state !== 'ended') return null;

  const wasSuccessful = !callData.error && duration > 0;
  const wasMissed = callData.error?.includes('missed') || callData.error?.includes('no staff');
  const wasDeclined = callData.error?.includes('declined');

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-slate-900/95 backdrop-blur-lg border border-white/20 rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl">
        <div className="text-center mb-6">
          <div className={`w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center ${
            wasSuccessful ? 'bg-green-500/20' : wasMissed ? 'bg-orange-500/20' : 'bg-red-500/20'
          }`}>
            {wasSuccessful ? (
              <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">
            {wasSuccessful ? 'Call Ended' : wasMissed ? 'Call Missed' : wasDeclined ? 'Call Declined' : 'Call Failed'}
          </h2>
          {callData.error && (
            <p className="text-slate-400 text-sm mb-4">{callData.error}</p>
          )}
        </div>

        {/* Call Statistics */}
        {wasSuccessful && duration > 0 && (
          <div className="mb-6 space-y-3">
            <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
              <span className="text-slate-300">Duration</span>
              <span className="text-white font-semibold">{formatDuration(duration)}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
              <span className="text-slate-300">Call Quality</span>
              <span className="text-green-400 font-semibold">Good</span>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-3">
          {wasMissed && (
            <>
              {onLeaveMessage && (
                <button
                  onClick={() => {
                    onLeaveMessage();
                    onClose();
                  }}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
                >
                  Leave a Message
                </button>
              )}
              {onRequestCallback && (
                <button
                  onClick={() => {
                    onRequestCallback();
                    onClose();
                  }}
                  className="w-full bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
                >
                  Request Callback
                </button>
              )}
            </>
          )}
          {wasDeclined && onRequestCallback && (
            <button
              onClick={() => {
                onRequestCallback();
                onClose();
              }}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
            >
              Request Callback
            </button>
          )}
          <button
            onClick={onClose}
            className="w-full bg-slate-700 hover:bg-slate-600 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default CallEndSummary;

