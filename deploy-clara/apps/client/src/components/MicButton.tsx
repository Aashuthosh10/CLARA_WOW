import React from 'react';
import { useMicrophone } from '../hooks/useMicrophone';
import { socketStore } from '../lib/socket';

export const MicButton: React.FC = () => {
  const { start, stop, active, lastError } = useMicrophone();
  const [, force] = React.useReducer((x) => x + 1, 0);
  React.useEffect(() => socketStore.subscribe(force), []);
  const disabled = socketStore.state !== 'connected';

  const onClick = async () => {
    if (disabled) return;
    if (active) stop();
    else {
      try { await start(); } catch {}
    }
  };

  return (
    <div>
      <button onClick={onClick} disabled={disabled} style={{ width: 56, height: 56, borderRadius: 999, background: active ? '#f59e0b' : '#facc15', cursor: disabled ? 'not-allowed' : 'pointer', border: 'none' }}>
        🎙️
      </button>
      {lastError && <div style={{ fontSize: 12, color: '#ef4444' }}>{lastError}</div>}
    </div>
  );
};




