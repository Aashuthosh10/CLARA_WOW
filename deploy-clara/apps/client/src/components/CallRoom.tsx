/**
 * Enhanced CallRoom Component for Client
 * Full-screen video call interface with remote and local streams
 * Integrates with callStore and InCallControls
 */
import React, { useRef, useEffect, useState } from 'react';
import { useCallStore } from '../stores/callStore';
import InCallControls from './InCallControls';

interface CallRoomProps {
  onEndCall: () => void;
}

const CallRoom: React.FC<CallRoomProps> = ({ onEndCall }) => {
  const { callData, state } = useCallStore();
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isUserSpeaking, setIsUserSpeaking] = useState(false);
  const [isRemoteSpeaking, setIsRemoteSpeaking] = useState(false);
  const animationFrameRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  // Setup local video stream
  useEffect(() => {
    if (!callData.localStream || !localVideoRef.current) return;

    localVideoRef.current.srcObject = callData.localStream;
    localVideoRef.current.play().catch(console.error);

    // Setup audio analysis for speaking detection
    if (callData.localStream.getAudioTracks().length > 0) {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = audioContext;
      const source = audioContext.createMediaStreamSource(callData.localStream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const checkSpeaking = () => {
        analyser.getByteTimeDomainData(dataArray);
        let sum = 0;
        for (const amplitude of dataArray) {
          sum += Math.pow(amplitude / 128 - 1, 2);
        }
        const volume = Math.sqrt(sum / dataArray.length);
        const SPEAKING_THRESHOLD = 0.02;

        const audioTrack = callData.localStream?.getAudioTracks()[0];
        if (audioTrack?.enabled) {
          setIsUserSpeaking(volume > SPEAKING_THRESHOLD);
        } else {
          setIsUserSpeaking(false);
        }
        animationFrameRef.current = requestAnimationFrame(checkSpeaking);
      };
      checkSpeaking();
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(console.error);
      }
    };
  }, [callData.localStream]);

  // Setup remote video stream
  useEffect(() => {
    if (!callData.remoteStream || !remoteVideoRef.current) return;

    remoteVideoRef.current.srcObject = callData.remoteStream;
    remoteVideoRef.current.play().catch(console.error);
    setIsConnected(true);

    // Setup audio analysis for remote speaking detection
    if (callData.remoteStream.getAudioTracks().length > 0) {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const source = audioContext.createMediaStreamSource(callData.remoteStream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const checkSpeaking = () => {
        analyser.getByteTimeDomainData(dataArray);
        let sum = 0;
        for (const amplitude of dataArray) {
          sum += Math.pow(amplitude / 128 - 1, 2);
        }
        const volume = Math.sqrt(sum / dataArray.length);
        const SPEAKING_THRESHOLD = 0.02;
        setIsRemoteSpeaking(volume > SPEAKING_THRESHOLD);
        animationFrameRef.current = requestAnimationFrame(checkSpeaking);
      };
      checkSpeaking();
    }
  }, [callData.remoteStream]);

  // Monitor peer connection state
  useEffect(() => {
    if (!callData.peerConnection) return;

    const pc = callData.peerConnection;
    const handleConnectionChange = () => {
      setIsConnected(pc.connectionState === 'connected');
      if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        console.warn('[CallRoom] Connection issue:', pc.connectionState);
      }
    };

    pc.addEventListener('connectionstatechange', handleConnectionChange);
    handleConnectionChange(); // Check initial state

    return () => {
      pc.removeEventListener('connectionstatechange', handleConnectionChange);
    };
  }, [callData.peerConnection]);

  if (state !== 'in_call' && state !== 'connecting') {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      <div className="flex-1 relative">
        {/* Remote Video (Staff) - Full Screen */}
        <div className="absolute inset-0 bg-slate-900 flex items-center justify-center">
          {callData.remoteStream ? (
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className={`w-full h-full object-cover ${isRemoteSpeaking ? 'ring-4 ring-green-500' : ''} transition-all`}
            />
          ) : (
            <div className={`text-center ${isRemoteSpeaking ? 'scale-110' : ''} transition-transform`}>
              <div className="w-32 h-32 mx-auto mb-4 bg-blue-500/20 rounded-full flex items-center justify-center">
                <svg
                  className="w-16 h-16 text-blue-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">
                {callData.staffName || 'Staff Member'}
              </h2>
              <p className="text-slate-400">
                {isConnected ? 'Connected' : state === 'connecting' ? 'Connecting...' : 'Waiting for connection'}
              </p>
            </div>
          )}
          <div className="absolute top-4 left-4 bg-slate-900/80 backdrop-blur-sm px-4 py-2 rounded-lg">
            <p className="text-white font-semibold">{callData.staffName || 'Staff'}</p>
            {!isConnected && (
              <p className="text-slate-400 text-xs">Connecting...</p>
            )}
          </div>
        </div>

        {/* Local Video (User) - Picture in Picture (Bottom Right) */}
        <div className={`absolute bottom-24 right-4 w-64 h-48 bg-slate-800 rounded-lg overflow-hidden shadow-2xl border-2 border-slate-700 ${isUserSpeaking ? 'ring-4 ring-green-500' : ''} transition-all`}>
          {callData.localStream && callData.localStream.getVideoTracks().some(t => t.enabled) ? (
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-slate-700">
              <svg
                className="w-12 h-12 text-slate-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
            </div>
          )}
          <div className="absolute top-2 left-2 bg-slate-900/80 backdrop-blur-sm px-3 py-1 rounded-lg">
            <p className="text-white text-sm font-semibold">You</p>
          </div>
        </div>
      </div>

      {/* In-Call Controls */}
      <InCallControls
        localStream={callData.localStream}
        onEndCall={onEndCall}
        variant="client"
      />
    </div>
  );
};

export default CallRoom;

