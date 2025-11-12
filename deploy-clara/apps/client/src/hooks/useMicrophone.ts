import { useCallback, useMemo, useRef, useState } from 'react';

export function useMicrophone() {
  const [active, setActive] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const safetyTimeoutRef = useRef<any>(null);

  const start = useCallback(async () => {
    if (active) return streamRef.current;
    setLastError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      streamRef.current = stream;
      setActive(true);
      if (safetyTimeoutRef.current) clearTimeout(safetyTimeoutRef.current);
      safetyTimeoutRef.current = setTimeout(() => stop(), 60_000);
      return stream;
    } catch (e: any) {
      if (e?.name === 'NotAllowedError') setLastError('Microphone permission denied');
      else if (e?.name === 'NotFoundError') setLastError('No microphone device found');
      else setLastError(e?.message || 'Failed to start microphone');
      throw e;
    }
  }, [active]);

  const stop = useCallback(() => {
    if (safetyTimeoutRef.current) clearTimeout(safetyTimeoutRef.current);
    safetyTimeoutRef.current = null;
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
    } finally {
      streamRef.current = null;
      setActive(false);
    }
  }, []);

  return useMemo(() => ({ start, stop, active, lastError, stream: streamRef }), [start, stop, active, lastError]);
}




