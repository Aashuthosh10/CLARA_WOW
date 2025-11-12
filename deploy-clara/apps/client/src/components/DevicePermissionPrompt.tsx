/**
 * DevicePermissionPrompt Component
 * Pre-flight permission request for camera and microphone before call initiation
 * Handles permission states and fallback to audio-only if camera denied
 */
import React, { useState, useEffect } from 'react';

export interface DevicePermissionState {
  camera: 'prompt' | 'granted' | 'denied' | 'checking';
  microphone: 'prompt' | 'granted' | 'denied' | 'checking';
}

interface DevicePermissionPromptProps {
  onPermissionsGranted: (stream: MediaStream, audioOnly: boolean) => void;
  onCancel: () => void;
  visible: boolean;
}

const DevicePermissionPrompt: React.FC<DevicePermissionPromptProps> = ({
  onPermissionsGranted,
  onCancel,
  visible,
}) => {
  const [permissions, setPermissions] = useState<DevicePermissionState>({
    camera: 'checking',
    microphone: 'checking',
  });
  const [error, setError] = useState<string>('');
  const [isRequesting, setIsRequesting] = useState(false);

  useEffect(() => {
    if (visible) {
      checkPermissions();
    }
  }, [visible]);

  const checkPermissions = async () => {
    try {
      // Check current permission states
      const cameraPermission = await navigator.permissions.query({ name: 'camera' as PermissionName });
      const micPermission = await navigator.permissions.query({ name: 'microphone' as PermissionName });

      setPermissions({
        camera: cameraPermission.state === 'granted' ? 'granted' : 
               cameraPermission.state === 'denied' ? 'denied' : 'prompt',
        microphone: micPermission.state === 'granted' ? 'granted' : 
                   micPermission.state === 'denied' ? 'denied' : 'prompt',
      });
    } catch (e) {
      // Permissions API not supported, will request on getUserMedia
      setPermissions({
        camera: 'prompt',
        microphone: 'prompt',
      });
    }
  };

  const requestPermissions = async () => {
    setIsRequesting(true);
    setError('');

    try {
      // Try to get both camera and microphone
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      const videoTrack = stream.getVideoTracks()[0];
      const audioTrack = stream.getAudioTracks()[0];

      if (videoTrack && audioTrack) {
        // Both granted
        setPermissions({ camera: 'granted', microphone: 'granted' });
        onPermissionsGranted(stream, false);
      } else if (audioTrack) {
        // Only audio granted - fallback to audio-only
        if (videoTrack) videoTrack.stop();
        setPermissions({ camera: 'denied', microphone: 'granted' });
        onPermissionsGranted(stream, true);
      } else {
        // No permissions
        stream.getTracks().forEach(track => track.stop());
        setError('Camera and microphone permissions are required for video calls.');
        setPermissions({ camera: 'denied', microphone: 'denied' });
      }
    } catch (err: any) {
      console.error('Permission error:', err);
      
      // Handle specific error cases
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setError('Permission denied. Please allow camera and microphone access in your browser settings.');
        setPermissions({ camera: 'denied', microphone: 'denied' });
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setError('No camera or microphone found. Please connect a device and try again.');
        setPermissions({ camera: 'denied', microphone: 'denied' });
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        setError('Camera or microphone is already in use by another application.');
        setPermissions({ camera: 'denied', microphone: 'denied' });
      } else {
        setError('Failed to access camera and microphone. Please check your device settings.');
        setPermissions({ camera: 'denied', microphone: 'denied' });
      }
    } finally {
      setIsRequesting(false);
    }
  };

  if (!visible) return null;

  const hasError = permissions.camera === 'denied' && permissions.microphone === 'denied';
  const canProceed = permissions.camera === 'granted' || permissions.microphone === 'granted';
  const audioOnly = permissions.camera === 'denied' && permissions.microphone === 'granted';

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-slate-900/95 backdrop-blur-lg border border-white/20 rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl">
        <div className="text-center mb-6">
          <div className="w-16 h-16 mx-auto mb-4 bg-blue-500/20 rounded-full flex items-center justify-center">
            <svg
              className="w-8 h-8 text-blue-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
              />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Device Permissions</h2>
          <p className="text-slate-400 text-sm">
            We need access to your camera and microphone for video calls
          </p>
        </div>

        {/* Permission Status Indicators */}
        <div className="space-y-3 mb-6">
          <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
            <div className="flex items-center space-x-3">
              <svg
                className={`w-5 h-5 ${
                  permissions.camera === 'granted'
                    ? 'text-green-400'
                    : permissions.camera === 'denied'
                    ? 'text-red-400'
                    : 'text-slate-400'
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
              <span className="text-white font-medium">Camera</span>
            </div>
            <span
              className={`text-sm font-semibold ${
                permissions.camera === 'granted'
                  ? 'text-green-400'
                  : permissions.camera === 'denied'
                  ? 'text-red-400'
                  : 'text-slate-400'
              }`}
            >
              {permissions.camera === 'granted'
                ? 'Granted'
                : permissions.camera === 'denied'
                ? 'Denied'
                : 'Pending'}
            </span>
          </div>

          <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
            <div className="flex items-center space-x-3">
              <svg
                className={`w-5 h-5 ${
                  permissions.microphone === 'granted'
                    ? 'text-green-400'
                    : permissions.microphone === 'denied'
                    ? 'text-red-400'
                    : 'text-slate-400'
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                />
              </svg>
              <span className="text-white font-medium">Microphone</span>
            </div>
            <span
              className={`text-sm font-semibold ${
                permissions.microphone === 'granted'
                  ? 'text-green-400'
                  : permissions.microphone === 'denied'
                  ? 'text-red-400'
                  : 'text-slate-400'
              }`}
            >
              {permissions.microphone === 'granted'
                ? 'Granted'
                : permissions.microphone === 'denied'
                ? 'Denied'
                : 'Pending'}
            </span>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-lg">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        {/* Audio-only warning */}
        {audioOnly && (
          <div className="mb-6 p-4 bg-yellow-500/20 border border-yellow-500/50 rounded-lg">
            <p className="text-yellow-400 text-sm">
              Camera access denied. Call will proceed with audio only.
            </p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex space-x-4">
          <button
            onClick={onCancel}
            className="flex-1 bg-slate-700 hover:bg-slate-600 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
          >
            Cancel
          </button>
          {!canProceed && !hasError && (
            <button
              onClick={requestPermissions}
              disabled={isRequesting}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isRequesting ? 'Requesting...' : 'Allow Access'}
            </button>
          )}
          {canProceed && (
            <button
              onClick={() => {
                // Permissions already granted, request stream again to pass to callback
                requestPermissions();
              }}
              disabled={isRequesting}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isRequesting ? 'Starting...' : 'Continue'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default DevicePermissionPrompt;

