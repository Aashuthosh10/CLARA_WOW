/**
 * InCallControls Component for Staff
 * Mute/unmute, camera on/off, end call, switch device, connection quality
 */
import React, { useState, useEffect } from 'react';

interface InCallControlsProps {
  localStream?: MediaStream;
  onEndCall: () => void;
  variant?: 'client' | 'staff';
}

const InCallControls: React.FC<InCallControlsProps> = ({
  localStream,
  onEndCall,
  variant = 'staff',
}) => {
  const [isMicOn, setIsMicOn] = useState(true);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [connectionQuality, setConnectionQuality] = useState<'good' | 'fair' | 'poor'>('good');
  const [availableDevices, setAvailableDevices] = useState<MediaDeviceInfo[]>([]);
  const [showDeviceMenu, setShowDeviceMenu] = useState(false);

  useEffect(() => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      const videoTrack = localStream.getVideoTracks()[0];
      setIsMicOn(audioTrack?.enabled ?? true);
      setIsCameraOn(videoTrack?.enabled ?? true);
    }
  }, [localStream]);

  useEffect(() => {
    // Load available devices
    navigator.mediaDevices.enumerateDevices().then(devices => {
      setAvailableDevices(devices);
    });
  }, []);

  const toggleMic = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMicOn(audioTrack.enabled);
      }
    }
  };

  const toggleCamera = () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsCameraOn(videoTrack.enabled);
      }
    }
  };

  const switchDevice = async (deviceId: string, kind: 'audioinput' | 'videoinput') => {
    if (!localStream) return;

    try {
      if (kind === 'audioinput') {
        const audioTrack = localStream.getAudioTracks()[0];
        if (audioTrack) {
          await audioTrack.applyConstraints({ deviceId: { exact: deviceId } });
        }
      } else {
        const videoTrack = localStream.getVideoTracks()[0];
        if (videoTrack) {
          await videoTrack.applyConstraints({ deviceId: { exact: deviceId } });
        }
      }
      setShowDeviceMenu(false);
    } catch (error) {
      console.error('Error switching device:', error);
    }
  };

  const getQualityColor = () => {
    switch (connectionQuality) {
      case 'good':
        return 'text-green-400';
      case 'fair':
        return 'text-yellow-400';
      case 'poor':
        return 'text-red-400';
    }
  };

  const audioDevices = availableDevices.filter(d => d.kind === 'audioinput');
  const videoDevices = availableDevices.filter(d => d.kind === 'videoinput');

  return (
    <div className="bg-slate-900/90 backdrop-blur-lg border-t border-white/10 p-6 flex items-center justify-center space-x-4">
      {/* Microphone Toggle */}
      <button
        className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${
          !isMicOn ? 'bg-red-500 hover:bg-red-600' : 'bg-slate-700 hover:bg-slate-600'
        } text-white`}
        onClick={toggleMic}
        aria-label={isMicOn ? 'Mute microphone' : 'Unmute microphone'}
      >
        {isMicOn ? (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
            />
          </svg>
        ) : (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2"
            />
          </svg>
        )}
      </button>

      {/* Camera Toggle */}
      <button
        className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${
          !isCameraOn ? 'bg-red-500 hover:bg-red-600' : 'bg-slate-700 hover:bg-slate-600'
        } text-white`}
        onClick={toggleCamera}
        aria-label={isCameraOn ? 'Turn off camera' : 'Turn on camera'}
      >
        {isCameraOn ? (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
            />
          </svg>
        ) : (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
            />
          </svg>
        )}
      </button>

      {/* Switch Device (Dropdown) */}
      <div className="relative">
        <button
          className="w-14 h-14 rounded-full bg-slate-700 hover:bg-slate-600 text-white flex items-center justify-center transition-colors"
          onClick={() => setShowDeviceMenu(!showDeviceMenu)}
          aria-label="Switch device"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
        </button>

        {showDeviceMenu && (
          <div className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 bg-slate-800 rounded-lg shadow-xl border border-slate-700 min-w-[200px] p-2 z-10">
            {audioDevices.length > 0 && (
              <div className="mb-2">
                <p className="text-xs text-slate-400 px-2 py-1">Microphone</p>
                {audioDevices.map(device => (
                  <button
                    key={device.deviceId}
                    onClick={() => switchDevice(device.deviceId, 'audioinput')}
                    className="w-full text-left px-3 py-2 text-sm text-white hover:bg-slate-700 rounded"
                  >
                    {device.label || `Microphone ${device.deviceId.slice(0, 8)}`}
                  </button>
                ))}
              </div>
            )}
            {videoDevices.length > 0 && (
              <div>
                <p className="text-xs text-slate-400 px-2 py-1">Camera</p>
                {videoDevices.map(device => (
                  <button
                    key={device.deviceId}
                    onClick={() => switchDevice(device.deviceId, 'videoinput')}
                    className="w-full text-left px-3 py-2 text-sm text-white hover:bg-slate-700 rounded"
                  >
                    {device.label || `Camera ${device.deviceId.slice(0, 8)}`}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Connection Quality Indicator */}
      <div className={`flex items-center space-x-2 px-3 py-2 rounded-lg bg-slate-800/50 ${getQualityColor()}`}>
        <div className="w-2 h-2 rounded-full bg-current"></div>
        <span className="text-xs font-medium capitalize">{connectionQuality}</span>
      </div>

      {/* End Call */}
      <button
        className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center text-white transition-colors"
        onClick={onEndCall}
        aria-label="End call"
      >
        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M16 8l2 2m0 0l2 2m-2-2l-2 2m2-2l-2-2M3 12a9 9 0 1118 0 9 9 0 01-18 0z"
          />
        </svg>
      </button>
    </div>
  );
};

export default InCallControls;

