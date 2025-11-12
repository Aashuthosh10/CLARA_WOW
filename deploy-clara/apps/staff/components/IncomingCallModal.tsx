import React, { useEffect, useRef, useState } from 'react';
import type { CallIncomingEvent } from '../services/StaffRTC';

interface IncomingCallModalProps {
  visible: boolean;
  call: CallIncomingEvent | null;
  onAccept: () => void;
  onDecline: () => void;
  onAutoDismiss?: () => void;
}

const IncomingCallModal: React.FC<IncomingCallModalProps> = ({
  visible,
  call,
  onAccept,
  onDecline,
  onAutoDismiss,
}) => {
  const [isRinging, setIsRinging] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);

  // Generate ringtone using Web Audio API (no external file needed)
  useEffect(() => {
    if (!visible || !call || isMuted) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      setIsRinging(false);
      return;
    }

    // Create ringtone using Web Audio API
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    let oscillator: OscillatorNode | null = null;
    let gainNode: GainNode | null = null;

    const playRingtone = () => {
      try {
        oscillator = audioContext.createOscillator();
        gainNode = audioContext.createGain();

        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        // Create ring pattern: 0.4s on, 0.2s off, 0.4s on, 1.4s off (repeat)
        const playTone = (startTime: number) => {
          gainNode!.gain.setValueAtTime(0, startTime);
          gainNode!.gain.linearRampToValueAtTime(0.3, startTime + 0.01);
          gainNode!.gain.linearRampToValueAtTime(0, startTime + 0.4);
          gainNode!.gain.setValueAtTime(0, startTime + 0.6);
          gainNode!.gain.linearRampToValueAtTime(0.3, startTime + 0.61);
          gainNode!.gain.linearRampToValueAtTime(0, startTime + 1.0);
        };

        oscillator.start();
        setIsRinging(true);

        // Play ring pattern repeatedly
        let currentTime = audioContext.currentTime;
        const ringInterval = setInterval(() => {
          playTone(currentTime);
          currentTime += 2.0; // Total pattern duration
        }, 2000);

        // Store cleanup
        (audioRef as any).current = {
          stop: () => {
            clearInterval(ringInterval);
            if (oscillator) {
              oscillator.stop();
              oscillator.disconnect();
            }
            if (gainNode) {
              gainNode.disconnect();
            }
            audioContext.close();
            setIsRinging(false);
          },
        };

        // Auto-dismiss after 45 seconds (timeout)
        const timeout = setTimeout(() => {
          if (onAutoDismiss) {
            onAutoDismiss();
          }
        }, 45000);

        return () => {
          clearInterval(ringInterval);
          clearTimeout(timeout);
          if (oscillator) {
            oscillator.stop();
            oscillator.disconnect();
          }
          if (gainNode) {
            gainNode.disconnect();
          }
          audioContext.close();
        };
      } catch (error) {
        console.error('Error playing ringtone:', error);
      }
    };

    const cleanup = playRingtone();
    return cleanup;
  }, [visible, call, isMuted, onAutoDismiss]);

  // Countdown timer (optional visual countdown)
  useEffect(() => {
    if (!visible || !call) {
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
      }
      setCountdown(null);
      return;
    }

    // Optional: Show countdown from 45s
    // setCountdown(45);
    // countdownRef.current = setInterval(() => {
    //   setCountdown(prev => {
    //     if (prev === null || prev <= 1) {
    //       if (countdownRef.current) clearInterval(countdownRef.current);
    //       return null;
    //     }
    //     return prev - 1;
    //   });
    // }, 1000);
  }, [visible, call]);

  const toggleMute = () => {
    setIsMuted(!isMuted);
  };

  const handleAccept = () => {
    if (audioRef.current) {
      (audioRef.current as any).stop();
      audioRef.current = null;
    }
    onAccept();
  };

  const handleDecline = () => {
    if (audioRef.current) {
      (audioRef.current as any).stop();
      audioRef.current = null;
    }
    onDecline();
  };

  if (!visible || !call) return null;

  const clientName = call.clientInfo.name || call.clientInfo.clientId;
  const clientAvatar = call.clientInfo.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(clientName)}&background=6366f1&color=fff&size=128`;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center animate-fade-in">
      <div className="bg-slate-900/95 backdrop-blur-lg border border-white/20 rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl animate-scale-in">
        <div className="text-center mb-6">
          {/* Caller Avatar */}
          <div className="w-24 h-24 mx-auto mb-4 relative">
            <img
              src={clientAvatar}
              alt={clientName}
              className="w-full h-full rounded-full object-cover border-4 border-blue-500/50"
            />
            {isRinging && (
              <div className="absolute inset-0 rounded-full border-4 border-blue-400 animate-ping opacity-75"></div>
            )}
          </div>

          {/* Phone Icon with Animation */}
          <div className="w-20 h-20 mx-auto mb-4 bg-blue-500/20 rounded-full flex items-center justify-center">
            <svg
              className={`w-10 h-10 text-blue-400 ${isRinging ? 'animate-pulse' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
              />
            </svg>
          </div>

          <h2 className="text-2xl font-bold text-white mb-2">Incoming Call</h2>
          <p className="text-slate-300 mb-1 font-semibold text-lg">{clientName}</p>
          {call.purpose && (
            <p className="text-slate-400 text-sm mt-2">Purpose: {call.purpose}</p>
          )}
          {countdown !== null && (
            <p className="text-slate-400 text-xs mt-1">Auto-dismiss in {countdown}s</p>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex space-x-4">
          <button
            onClick={handleDecline}
            className="flex-1 bg-red-500/80 hover:bg-red-600 text-white px-6 py-3 rounded-lg font-semibold transition-colors flex items-center justify-center space-x-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            <span>Decline</span>
          </button>
          <button
            onClick={toggleMute}
            className="w-14 h-14 rounded-full bg-slate-700 hover:bg-slate-600 text-white flex items-center justify-center transition-colors"
            aria-label={isMuted ? 'Unmute ringtone' : 'Mute ringtone'}
          >
            {isMuted ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 14.142M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
              </svg>
            )}
          </button>
          <button
            onClick={handleAccept}
            className="flex-1 bg-green-500/80 hover:bg-green-600 text-white px-6 py-3 rounded-lg font-semibold transition-colors flex items-center justify-center space-x-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
              />
            </svg>
            <span>Accept</span>
          </button>
        </div>
      </div>

      {/* Add CSS animations */}
      <style>{`
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes scale-in {
          from { transform: scale(0.9); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        .animate-fade-in {
          animation: fade-in 0.3s ease-out;
        }
        .animate-scale-in {
          animation: scale-in 0.3s ease-out;
        }
      `}</style>
    </div>
  );
};

export default IncomingCallModal;

