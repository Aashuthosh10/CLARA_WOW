/**
 * Server Health Check Utility
 * Checks if the backend server is ready before making API calls
 */

interface HealthCheckOptions {
  maxRetries?: number;
  retryDelay?: number;
  timeout?: number;
}

const DEFAULT_OPTIONS: Required<HealthCheckOptions> = {
  maxRetries: 10,
  retryDelay: 1000,
  timeout: 5000,
};

/**
 * Get the API base URL
 */
export const getApiBaseUrl = (): string => {
  const apiBase = import.meta.env.VITE_API_BASE || 'http://localhost:8080';
  return apiBase.endsWith('/api') ? apiBase : `${apiBase}/api`;
};

/**
 * Get the server base URL (without /api)
 */
export const getServerBaseUrl = (): string => {
  const apiUrl = getApiBaseUrl();
  return apiUrl.replace('/api', '');
};

/**
 * Check if the server is healthy and ready
 */
export const checkServerHealth = async (
  options: HealthCheckOptions = {}
): Promise<boolean> => {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const serverBase = getServerBaseUrl();
  const healthUrl = `${serverBase}/healthz`;

  for (let attempt = 0; attempt < opts.maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), opts.timeout);

      const response = await fetch(healthUrl, {
        method: 'GET',
        signal: controller.signal,
        cache: 'no-cache',
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        if (data.status === 'ok') {
          console.log(`[ServerHealth] Server is ready after ${attempt + 1} attempt(s)`);
          return true;
        }
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log(`[ServerHealth] Health check timeout (attempt ${attempt + 1}/${opts.maxRetries})`);
      } else {
        console.log(`[ServerHealth] Server not ready (attempt ${attempt + 1}/${opts.maxRetries}):`, error.message);
      }
    }

    // Wait before retrying (exponential backoff)
    if (attempt < opts.maxRetries - 1) {
      const delay = opts.retryDelay * Math.pow(1.5, attempt);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  console.error(`[ServerHealth] Server health check failed after ${opts.maxRetries} attempts`);
  return false;
};

/**
 * Wait for server to be ready with progress callback
 */
export const waitForServer = async (
  onProgress?: (attempt: number, maxRetries: number) => void,
  options: HealthCheckOptions = {}
): Promise<boolean> => {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const serverBase = getServerBaseUrl();
  const healthUrl = `${serverBase}/healthz`;

  for (let attempt = 0; attempt < opts.maxRetries; attempt++) {
    if (onProgress) {
      onProgress(attempt + 1, opts.maxRetries);
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), opts.timeout);

      const response = await fetch(healthUrl, {
        method: 'GET',
        signal: controller.signal,
        cache: 'no-cache',
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        if (data.status === 'ok') {
          return true;
        }
      }
    } catch (error) {
      // Continue to next attempt
    }

    if (attempt < opts.maxRetries - 1) {
      const delay = opts.retryDelay * Math.pow(1.5, attempt);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  return false;
};

