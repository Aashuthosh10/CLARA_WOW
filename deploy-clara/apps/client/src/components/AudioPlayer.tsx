import React from 'react';
import { useAudio } from '../hooks/useAudio';

export const AudioPlayer: React.FC = () => {
  const { ensureUnlocked, playUrl, stop, isReady, lastError } = useAudio();
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <button onClick={() => ensureUnlocked()} style={{ padding: '6px 10px' }}>{isReady ? 'Audio Ready' : 'Enable Audio'}</button>
      <button onClick={() => playUrl('https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3')} style={{ padding: '6px 10px' }}>Test URL</button>
      <button onClick={() => stop()} style={{ padding: '6px 10px' }}>Stop</button>
      {lastError && <span style={{ color: '#ef4444', fontSize: 12 }}>{lastError}</span>}
    </div>
  );
};




