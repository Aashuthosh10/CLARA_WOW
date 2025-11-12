import { useState, useEffect } from 'react';
import { waitForServer } from '../utils/serverHealth';

interface UseServerReadyOptions {
  maxRetries?: number;
  retryDelay?: number;
  onReady?: () => void;
  onError?: () => void;
}

export const useServerReady = (options: UseServerReadyOptions = {}) => {
  const [isReady, setIsReady] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState({ attempt: 0, maxRetries: 10 });
  const [allowProceed, setAllowProceed] = useState(false);

  useEffect(() => {
    let mounted = true;
    let timeoutId: NodeJS.Timeout;

    const checkServer = async () => {
      setIsChecking(true);
      setError(null);

      // After 5 seconds, allow user to proceed anyway (server might be slow or CORS issue)
      timeoutId = setTimeout(() => {
        if (mounted) {
          console.log('[useServerReady] Allowing proceed after timeout');
          setAllowProceed(true);
          setIsChecking(false);
        }
      }, 5000);

      const ready = await waitForServer(
        (attempt, maxRetries) => {
          if (mounted) {
            setProgress({ attempt, maxRetries });
            console.log(`[useServerReady] Attempt ${attempt}/${maxRetries}`);
          }
        },
        {
          maxRetries: options.maxRetries || 10,
          retryDelay: options.retryDelay || 500,
          timeout: 2000, // Shorter timeout for faster feedback
        }
      );

      clearTimeout(timeoutId);

      if (mounted) {
        setIsReady(ready);
        setIsChecking(false);
        
        if (ready) {
          setAllowProceed(true);
          options.onReady?.();
        } else {
          // Even if health check fails, allow proceed after timeout
          // Server might be running but CORS or network issue
          console.warn('[useServerReady] Health check failed, but allowing proceed');
          setAllowProceed(true);
          setError('Server health check failed, but you can try to proceed. If login fails, ensure the backend is running on http://localhost:8080');
          options.onError?.();
        }
      }
    };

    checkServer();

    return () => {
      mounted = false;
      clearTimeout(timeoutId);
    };
  }, []);

  return { isReady: isReady || allowProceed, isChecking, error, progress };
};

