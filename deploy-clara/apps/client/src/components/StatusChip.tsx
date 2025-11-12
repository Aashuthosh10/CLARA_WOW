import React from 'react';
import { socketStore, SocketState } from '../lib/socket';

export const StatusChip: React.FC = () => {
  const [, force] = React.useReducer((x) => x + 1, 0);
  React.useEffect(() => socketStore.subscribe(force), []);
  const state: SocketState = socketStore.state;
  const text = state === 'connected' ? 'Connected' : state === 'connecting' ? 'Connecting…' : state === 'reconnecting' ? 'Reconnecting…' : 'Offline';
  const color = state === 'connected' ? '#16a34a' : state === 'connecting' ? '#f59e0b' : state === 'reconnecting' ? '#ef4444' : '#6b7280';

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 999, background: '#eef2ff', color: '#111827', fontSize: 12 }}>
      <span style={{ width: 8, height: 8, borderRadius: 999, background: color }} />
      {text}
    </span>
  );
};




