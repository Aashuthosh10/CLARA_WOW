import React, { useRef, useEffect, useState } from 'react';

interface VideoCallViewProps {
  clientName: string;
  callId: string;
  onEndCall: () => void;
  activeCall: {
    pc: RTCPeerConnection;
    stream: MediaStream;
    remoteStream: MediaStream | null;
  } | null;
}

const VideoCallView: React.FC<VideoCallViewProps> = ({ clientName, callId, onEndCall, activeCall }) => {
  const userVideoRef = useRef<HTMLVideoElement>(null);
  const clientVideoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  const [countdown, setCountdown] = useState(3);
  const [isConnected, setIsConnected] = useState(false);
  const [isUserSpeaking, setIsUserSpeaking] = useState(false);
  const [isClientSpeaking, setIsClientSpeaking] = useState(false);
  const [isMicOn, setIsMicOn] = useState(true);
  const [isCameraOn, setIsCameraOn] = useState(true);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else if (countdown === 0) {
      setIsConnected(true);
    }
  }, [countdown]);

  useEffect(() => {
    if (activeCall?.remoteStream && clientVideoRef.current) {
      clientVideoRef.current.srcObject = activeCall.remoteStream;
      clientVideoRef.current.play().catch(err => console.error('Error playing remote video:', err));
      setIsConnected(true);
      
      if (activeCall.remoteStream.getAudioTracks().length > 0) {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        audioContextRef.current = audioContext;
        const source = audioContext.createMediaStreamSource(activeCall.remoteStream);
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
          setIsClientSpeaking(volume > SPEAKING_THRESHOLD);
          animationFrameRef.current = requestAnimationFrame(checkSpeaking);
        };
        checkSpeaking();
      }
    } else if (activeCall?.pc && !activeCall.remoteStream) {
      const pc = activeCall.pc;
      const receivers = pc.getReceivers();
      if (receivers.length > 0) {
        const tracks = receivers.map(r => r.track).filter(Boolean) as MediaStreamTrack[];
        if (tracks.length > 0) {
          const newRemoteStream = new MediaStream(tracks);
          if (clientVideoRef.current) {
            clientVideoRef.current.srcObject = newRemoteStream;
            clientVideoRef.current.play().catch(err => console.error('Error playing remote video:', err));
          }
          setIsConnected(true);
        }
      }
    }
  }, [activeCall?.remoteStream, activeCall?.pc]);

  useEffect(() => {
    const startCameraAndAudio = async () => {
      try {
        let stream: MediaStream;
        if (activeCall?.stream) {
          stream = activeCall.stream;
          streamRef.current = stream;
        } else {
          stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
          streamRef.current = stream;
        }

        if (userVideoRef.current) {
          userVideoRef.current.srcObject = stream;
        }

        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        audioContextRef.current = audioContext;
        const source = audioContext.createMediaStreamSource(stream);
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

          const audioTrack = streamRef.current?.getAudioTracks()[0];
          if (audioTrack?.enabled) {
            setIsUserSpeaking(volume > SPEAKING_THRESHOLD);
          } else {
            setIsUserSpeaking(false);
          }
          animationFrameRef.current = requestAnimationFrame(checkSpeaking);
        };
        checkSpeaking();

      } catch (err) {
        console.error("Error accessing camera/mic:", err);
        alert("Could not access your camera or microphone. Please check permissions and try again.");
        onEndCall();
      }
    };

    if (activeCall) {
      startCameraAndAudio();
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (streamRef.current && !activeCall?.stream) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(console.error);
      }
    };
  }, [activeCall, onEndCall]);

  useEffect(() => {
    if (isCameraOn && streamRef.current && userVideoRef.current) {
      const videoTrack = streamRef.current.getVideoTracks()[0];
      if (videoTrack && videoTrack.enabled) {
        if (userVideoRef.current.srcObject !== streamRef.current) {
          userVideoRef.current.srcObject = streamRef.current;
        }
        userVideoRef.current.play().catch(err => console.error('Error playing video:', err));
      }
    }
  }, [isCameraOn]);

  const toggleMic = () => {
    if (streamRef.current) {
      const audioTrack = streamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMicOn(audioTrack.enabled);
      }
    }
  };

  const toggleCamera = () => {
    if (streamRef.current) {
      const videoTrack = streamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsCameraOn(videoTrack.enabled);
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      {countdown > 0 && (
        <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-10">
          <div className="text-6xl font-bold text-white">{countdown}</div>
        </div>
      )}
      
      <div className="flex-1 relative">
        <div className="absolute inset-0 bg-slate-900 flex items-center justify-center">
          {activeCall?.remoteStream ? (
            <video 
              ref={clientVideoRef} 
              autoPlay 
              playsInline 
              className={`w-full h-full object-cover ${isClientSpeaking ? 'ring-4 ring-green-500' : ''}`}
            />
          ) : (
            <div className={`text-center ${isClientSpeaking ? 'scale-110' : ''} transition-transform`}>
              <div className="w-32 h-32 mx-auto mb-4 bg-blue-500/20 rounded-full flex items-center justify-center">
                <i className="fa-solid fa-user text-6xl text-blue-400"></i>
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">{clientName}</h2>
              <p className="text-slate-400">{isConnected ? 'Connected' : 'Connecting...'}</p>
            </div>
          )}
          <div className="absolute top-4 left-4 bg-slate-900/80 backdrop-blur-sm px-4 py-2 rounded-lg">
            <p className="text-white font-semibold">{clientName}</p>
          </div>
        </div>

        <div className={`absolute bottom-24 right-4 w-64 h-48 bg-slate-800 rounded-lg overflow-hidden shadow-2xl border-2 border-slate-700 ${isUserSpeaking ? 'ring-4 ring-green-500' : ''}`}>
          {isCameraOn ? (
            <video 
              ref={userVideoRef} 
              autoPlay 
              playsInline 
              muted 
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-slate-700">
              <i className="fa-solid fa-user text-4xl text-slate-400"></i>
            </div>
          )}
          <div className="absolute top-2 left-2 bg-slate-900/80 backdrop-blur-sm px-3 py-1 rounded-lg">
            <p className="text-white text-sm font-semibold">You</p>
          </div>
        </div>
      </div>

      <div className="bg-slate-900/90 backdrop-blur-lg border-t border-white/10 p-6 flex items-center justify-center space-x-4">
        <button
          className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${
            !isMicOn ? 'bg-red-500 hover:bg-red-600' : 'bg-slate-700 hover:bg-slate-600'
          } text-white`}
          onClick={toggleMic}
          aria-label={isMicOn ? 'Mute microphone' : 'Unmute microphone'}
        >
          {isMicOn ? (
            <i className="fa-solid fa-microphone text-xl"></i>
          ) : (
            <i className="fa-solid fa-microphone-slash text-xl"></i>
          )}
        </button>
        <button
          className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${
            !isCameraOn ? 'bg-red-500 hover:bg-red-600' : 'bg-slate-700 hover:bg-slate-600'
          } text-white`}
          onClick={toggleCamera}
          aria-label={isCameraOn ? 'Turn off camera' : 'Turn on camera'}
        >
          {isCameraOn ? (
            <i className="fa-solid fa-video text-xl"></i>
          ) : (
            <i className="fa-solid fa-video-slash text-xl"></i>
          )}
        </button>
        <button
          className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center text-white transition-colors"
          onClick={onEndCall}
          aria-label="End call"
        >
          <i className="fa-solid fa-phone text-xl rotate-[135deg]"></i>
        </button>
      </div>
    </div>
  );
};

export default VideoCallView;

