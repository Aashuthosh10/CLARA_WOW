import React, { useEffect, useRef, useState } from 'react';
import type { CallIncomingEvent } from '../services/StaffRTC';

interface FloatingCallNotificationProps {
  visible: boolean;
  call: CallIncomingEvent | null;
  onAccept: () => void;
  onDecline: () => void;
  timeoutMs?: number;
}

const RINGTONE_SRC = '/audio/xiaomi-poco-ringtone.mp3';

const FloatingCallNotification: React.FC<FloatingCallNotificationProps> = ({
  visible,
  call,
  onAccept,
  onDecline,
  timeoutMs = 15000,
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timeoutRef = useRef<number | null>(null);
  const [hasAudioError, setHasAudioError] = useState(false);

  useEffect(() => {
    if (!visible || !call) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        audioRef.current = null;
      }
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      setHasAudioError(false);
      return;
    }

    const audio = new Audio(RINGTONE_SRC);
    audio.loop = true;
    audioRef.current = audio;

    audio
      .play()
      .then(() => setHasAudioError(false))
      .catch((error) => {
        console.warn('[FloatingCallNotification] Failed to autoplay ringtone:', error);
        setHasAudioError(true);
      });

    timeoutRef.current = window.setTimeout(() => {
      onDecline();
    }, timeoutMs);

    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        audioRef.current = null;
      }
    };
  }, [visible, call, onDecline, timeoutMs]);

  const handleAccept = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    onAccept();
  };

  const handleDecline = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    onDecline();
  };

  if (!visible || !call) {
    return null;
  }

  const clientName = call.clientInfo.name || call.clientInfo.clientId || 'Client';
  const avatarUrl =
    call.clientInfo.avatar ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(clientName)}&background=6366f1&color=fff&size=128`;

  return (
    <div className="fixed top-6 right-6 z-50 w-80 max-w-[90vw] transition-all duration-200 ease-out">
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-slate-900/90 backdrop-blur-lg shadow-xl">
        <div className="flex items-start gap-4 p-4">
          <div className="relative">
            <img
              src={avatarUrl}
              alt={clientName}
              className="h-16 w-16 rounded-xl border border-white/10 object-cover"
            />
            <span className="absolute -right-1 -bottom-1 flex h-5 w-5 items-center justify-center rounded-full bg-green-500 text-xs text-white shadow-lg">
              <i className="fa-solid fa-phone" />
            </span>
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-slate-300">Incoming video call</p>
            <h3 className="text-lg font-semibold text-white">{clientName}</h3>
            {call.purpose && <p className="mt-1 text-xs text-slate-400 line-clamp-2">{call.purpose}</p>}
            {hasAudioError && (
              <p className="mt-2 text-xs text-amber-400">
                Tap accept/decline to control ringtone (autoplay blocked by browser).
              </p>
            )}
          </div>
        </div>
        <div className="flex gap-2 border-t border-white/5 bg-slate-900/80 p-4">
          <button
            onClick={handleDecline}
            className="flex-1 rounded-xl bg-red-500/20 py-2 text-sm font-semibold text-red-300 transition hover:bg-red-500/30"
          >
            Decline
          </button>
          <button
            onClick={handleAccept}
            className="flex-1 rounded-xl bg-emerald-500/20 py-2 text-sm font-semibold text-emerald-300 transition hover:bg-emerald-500/30"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
};

export default FloatingCallNotification;


