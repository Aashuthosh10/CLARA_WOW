import React from 'react';
import { getSocket, socketStore } from '../../src/lib/socket';
import { useAudio } from '../../src/hooks/useAudio';
import { useMicrophone } from '../../src/hooks/useMicrophone';

export default function DiagnosticsPage() {
  const [, force] = React.useReducer((x) => x + 1, 0);
  React.useEffect(() => socketStore.subscribe(force), []);
  const socket = React.useMemo(() => getSocket(), []);
  const { ensureUnlocked, playUrl, stop, lastError: audioErr } = useAudio();
  const { start, stop: stopMic, active, lastError: micErr } = useMicrophone();
  const [lastPing, setLastPing] = React.useState<number | null>(null);
  const [lastRTT, setLastRTT] = React.useState<number | null>(null);

  React.useEffect(() => {
    const onPong = () => {
      if (lastPing) setLastRTT(Date.now() - lastPing);
    };
    socket.on('server:pong', onPong);
    return () => { socket.off('server:pong', onPong); };
  }, [socket, lastPing]);

  return (
    <div style={{ padding: 16 }}>
      <h2>Diagnostics: Audio + Network</h2>
      <section style={{ marginTop: 12 }}>
        <h3>Network</h3>
        <div>Server URL: {(import.meta as any).env?.VITE_API_BASE || 'default'}</div>
        <div>Status: {socketStore.state}</div>
        <div>Last RTT: {lastRTT ?? '-'} ms</div>
        <button onClick={() => { setLastPing(Date.now()); socket.emit('client:ping'); }}>Ping</button>
        <button onClick={() => socket.connect()}>Reconnect</button>
      </section>

      <section style={{ marginTop: 12 }}>
        <h3>Audio Output</h3>
        <button onClick={() => ensureUnlocked()}>Enable Audio</button>
        <button onClick={() => playUrl('https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3')}>Play Test URL</button>
        <button onClick={() => stop()}>Stop</button>
        {audioErr && <div style={{ color: '#ef4444' }}>{audioErr}</div>}
      </section>

      <section style={{ marginTop: 12 }}>
        <h3>Microphone</h3>
        <button onClick={() => start()} disabled={active}>Start</button>
        <button onClick={() => stopMic()} disabled={!active}>Stop</button>
        {micErr && <div style={{ color: '#ef4444' }}>{micErr}</div>}
      </section>
    </div>
  );
}




