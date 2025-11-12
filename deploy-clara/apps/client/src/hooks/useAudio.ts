import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type PlayItem = { type: 'url' | 'blob' | 'stream'; payload: any };

export function useAudio() {
  const [isReady, setIsReady] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const queueRef = useRef<PlayItem[]>([]);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const srcStreamRef = useRef<MediaStream | null>(null);
  const playingRef = useRef(false);

  const ensureUnlocked = useCallback(async () => {
    try {
      if (!ctxRef.current) ctxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      if (ctxRef.current.state === 'suspended') await ctxRef.current.resume();
      setIsReady(true);
      return true;
    } catch (e: any) {
      setLastError(e?.message || 'Failed to unlock audio');
      return false;
    }
  }, []);

  const getAudioEl = () => {
    if (!audioElRef.current) {
      const el = document.createElement('audio');
      el.id = 'clara-audio';
      el.preload = 'auto';
      el.playsInline = true as any;
      el.style.display = 'none';
      document.body.appendChild(el);
      audioElRef.current = el;
    }
    return audioElRef.current!;
  };

  const stop = useCallback(() => {
    try {
      const el = getAudioEl();
      el.pause();
      el.currentTime = 0;
      if (srcStreamRef.current) {
        el.srcObject = null;
        srcStreamRef.current.getTracks().forEach(t => t.stop());
        srcStreamRef.current = null;
      }
    } catch {}
  }, []);

  const playNext = useCallback(async () => {
    if (playingRef.current) return;
    const item = queueRef.current.shift();
    if (!item) return;
    playingRef.current = true;
    const el = getAudioEl();
    stop();
    try {
      if (item.type === 'blob') {
        const url = URL.createObjectURL(item.payload as Blob);
        el.src = url;
      } else if (item.type === 'url') {
        el.src = String(item.payload);
      } else if (item.type === 'stream') {
        el.srcObject = item.payload as MediaStream;
      }
      await ensureUnlocked();
      await el.play();
      el.onended = () => {
        playingRef.current = false;
        el.onended = null;
        playNext();
      };
    } catch (e: any) {
      setLastError(e?.message || 'Playback failed');
      playingRef.current = false;
    }
  }, [ensureUnlocked, stop]);

  const enqueue = useCallback((item: PlayItem) => {
    queueRef.current.push(item);
    void playNext();
  }, [playNext]);

  const playBlob = useCallback((blob: Blob) => enqueue({ type: 'blob', payload: blob }), [enqueue]);
  const playUrl = useCallback((url: string) => enqueue({ type: 'url', payload: url }), [enqueue]);
  const playStream = useCallback((stream: MediaStream) => enqueue({ type: 'stream', payload: stream }), [enqueue]);

  useEffect(() => {
    return () => {
      stop();
      const el = audioElRef.current;
      if (el) el.remove();
      audioElRef.current = null;
      if (ctxRef.current) {
        try { ctxRef.current.close(); } catch {}
      }
    };
  }, [stop]);

  return useMemo(() => ({ ensureUnlocked, playBlob, playUrl, playStream, stop, isReady, lastError }), [ensureUnlocked, playBlob, playUrl, playStream, stop, isReady, lastError]);
}




