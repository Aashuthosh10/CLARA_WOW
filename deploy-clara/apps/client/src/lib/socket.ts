import { io, Socket } from 'socket.io-client';

export type SocketState = 'connected' | 'connecting' | 'reconnecting' | 'offline';

export type HeartbeatInfo = {
  lastPingAt: number | null;
  lastPongAt: number | null;
  rttMs: number | null;
};

type Listener = () => void;

class SocketStore {
  private listeners: Set<Listener> = new Set();
  state: SocketState = 'connecting';
  info: HeartbeatInfo = { lastPingAt: null, lastPongAt: null, rttMs: null };
  setState(next: SocketState) {
    if (this.state !== next) {
      this.state = next;
      this.emit();
    }
  }
  setInfo(info: Partial<HeartbeatInfo>) {
    this.info = { ...this.info, ...info };
    this.emit();
  }
  subscribe(fn: Listener) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  private emit() {
    this.listeners.forEach((fn) => fn());
  }
}

export const socketStore = new SocketStore();

let socket: Socket | null = null;
let heartbeatInterval: any;
let watchdogTimeout: any;

function log(tag: string, data?: any) {
  if (import.meta.env && (import.meta.env as any).MODE !== 'production') {
    if (data !== undefined) console.debug(`[${tag}]`, data);
    else console.debug(`[${tag}]`);
  }
}

export function getSocket(): Socket {
  if (socket) return socket;

  const SERVER_URL = (import.meta.env as any).VITE_API_BASE || `http://localhost:${(import.meta.env as any).VITE_SERVER_PORT || 8080}`;

  socket = io(SERVER_URL, {
    transports: ['websocket'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 500,
    reconnectionDelayMax: 8000,
    timeout: 10000,
    autoConnect: true,
  });

  socketStore.setState('connecting');

  const clearTimers = () => {
    if (heartbeatInterval) clearInterval(heartbeatInterval);
    if (watchdogTimeout) clearTimeout(watchdogTimeout);
    heartbeatInterval = null;
    watchdogTimeout = null;
  };

  const startHeartbeat = () => {
    clearTimers();
    heartbeatInterval = setInterval(() => {
      try {
        socketStore.setInfo({ lastPingAt: Date.now() });
        socket!.emit('client:ping');
        // watchdog: if no pong in 30s, force reconnect
        if (watchdogTimeout) clearTimeout(watchdogTimeout);
        watchdogTimeout = setTimeout(() => {
          log('SOCKET', { warn: 'pong timeout → reconnect' });
          try { socket!.disconnect(); } catch {}
          try { socket!.connect(); } catch {}
        }, 30000);
      } catch {}
    }, 15000);
  };

  socket.on('connect', () => {
    log('SOCKET', 'connect');
    socketStore.setState('connected');
    startHeartbeat();
  });

  socket.on('disconnect', (reason) => {
    log('SOCKET', { disconnect: reason });
    socketStore.setState(navigator.onLine ? 'reconnecting' : 'offline');
  });

  socket.io.on('reconnect_attempt', (attempt) => {
    log('SOCKET', { reconnect_attempt: attempt });
    socketStore.setState('reconnecting');
  });
  socket.io.on('reconnect', (attempt) => {
    log('SOCKET', { reconnect: attempt });
    socketStore.setState('connected');
  });
  socket.io.on('reconnect_error', (e) => {
    log('SOCKET', { reconnect_error: e?.message });
    socketStore.setState(navigator.onLine ? 'reconnecting' : 'offline');
  });
  socket.io.on('reconnect_failed', () => {
    log('SOCKET', 'reconnect_failed');
    socketStore.setState('offline');
  });
  socket.on('server:pong', () => {
    const now = Date.now();
    const lastPingAt = socketStore.info.lastPingAt || now;
    socketStore.setInfo({ lastPongAt: now, rttMs: now - lastPingAt });
  });
  socket.on('server:heartbeat', () => {
    // for visibility; could record timestamp
  });

  window.addEventListener('online', () => {
    if (socket && !socket.connected) {
      log('SOCKET', 'online → connect');
      socket.connect();
    }
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && socket && !socket.connected) {
      log('SOCKET', 'tab visible → connect');
      socket.connect();
    }
  });

  return socket;
}

export function disposeSocket() {
  if (!socket) return;
  try { socket.removeAllListeners(); } catch {}
  try { socket.disconnect(); } catch {}
  socket = null as any;
}




