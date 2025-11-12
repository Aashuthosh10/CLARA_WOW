import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleGenAI, Modality, Blob, FunctionDeclaration, Type } from '@google/genai';
import { CallService } from './src/services/CallService';
import MapNavigator from './src/MapNavigator';
import LocationMatcher from './src/locationMatcher';
import { Location } from './src/locationsDatabase';
import WebRTCVideoCall from './src/components/WebRTCVideoCall';
import { useCallStore } from './src/stores/callStore';
import DevicePermissionPrompt from './src/components/DevicePermissionPrompt';
import CallRoom from './src/components/CallRoom';
import CallToast, { ToastType } from './src/components/CallToast';
import CallEndSummary from './src/components/CallEndSummary';
import './src/MapNavigator.css';

// --- Helper functions for Audio Encoding/Decoding ---

function encode(bytes) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function decode(base64) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(data, ctx, sampleRate, numChannels) {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

function createBlob(data) {
    const l = data.length;
    const int16 = new Int16Array(l);
    for (let i = 0; i < l; i++) {
      int16[i] = data[i] * 32768;
    }
    return {
      data: encode(new Uint8Array(int16.buffer)),
      mimeType: 'audio/pcm;rate=16000',
    };
}


// --- React Components & Icons ---

const MicOnIcon = ({size=24}) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="22"></line></svg>
);
const MicOffIcon = ({size=24}) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="1" y1="1" x2="23" y2="23"></line><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"></path><path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"></path><line x1="12" y1="19" x2="12" y2="22"></line></svg>
);
const CameraOnIcon = ({size=24}) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"></path></svg>
);
const CameraOffIcon = ({size=24}) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><path d="M21 6.5l-4 4V7h-6.18l2 2H16v.92l4 4V6.5zm-1.12 9.38L18.8 15.3l-4-4V7H8.8l-2-2H16c.55 0 1 .45 1 1v3.5l4 4zm-16-1.59l1.41-1.41 1.47 1.47-1.41 1.41-1.47-1.47zM4.41 6.41L3 4.99 4.41 3.58 3 2.17l1.41-1.41 18 18-1.41 1.41-2.92-2.92H4c-.55 0-1-.45-1-1V7c0-.55.45-1 1-1h.41l-1.59-1.59z"></path></svg>
);
const RobotIcon = ({size = 24}) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M20 12h-2V9c0-1.1-.9-2-2-2h-1c-.55 0-1 .45-1 1s.45 1 1 1h1v2H8V9h1c.55 0 1-.45 1-1s-.45-1-1-1H8c-1.1 0-2 .9-2 2v3H4c-1.1 0-2 .9-2 2v2c0 1.1.9 2 2 2h1v1c0 .55.45 1 1 1s1-.45 1-1v-1h10v1c0 .55.45 1 1 1s1-.45 1-1v-1h1c1.1 0 2-.9 2-2v-2c0-1.1-.9-2-2-2zm-4.5 3h-7c-.28 0-.5-.22-.5-.5s.22-.5.5-.5h7c.28 0 .5.22.5.5s-.22.5-.5.5zM15 11H9V9h6v2z"></path></svg>
);
const UserIcon = ({size = 24}) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"></path></svg>
);
const GraduationCapIcon = ({size=16}) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><path d="M12 3L1 9l11 6 9-4.91V17h2V9L12 3zm0 8.47L4.5 8 12 5l7.5 3L12 11.47zM10.5 13.5v3.45c0 1.15.39 2.18 1.05 2.94.66.77 1.63 1.21 2.7 1.21 1.76 0 3.25-1.49 3.25-3.32V13.5h-1.5v3.28c0 .99-.6 1.82-1.75 1.82-.92 0-1.75-.83-1.75-1.82V13.5h-2.5z"></path></svg>
);
const StaffLoginIcon = ({size=16}) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"></path></svg>
);
const VideoCallHeaderIcon = ({size=16}) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"></path></svg>
);
const SpeakerIcon = ({size=20}) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"></path></svg>
);
const PencilIcon = ({size=20}) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34a.9959.9959 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"></path></svg>
);
const MapIcon = ({size=16}) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><path d="M20.5 3l-.16.03L15 5.1 9 3 3.36 4.9c-.21.07-.36.25-.36.48V20.5c0 .28.22.5.5.5l.16-.03L9 18.9l6 2.1 5.64-1.9c.21-.07.36-.25.36-.48V3.5c0-.28-.22-.5-.5-.5zM15 19l-6-2.11V5l6 2.11V19z"></path></svg>
);

const LocationCard = ({ location }: { location: Location }) => {
    return (
        <div className="location-card">
            <div className="location-card-heading">
                <div className="location-card-heading-main">
                    <div className="location-card-title">{location.name}</div>
                    <div className="location-card-meta">
                        {location.room_number && (
                            <span className="location-card-tag room">Room {location.room_number}</span>
                        )}
                        <span className="location-card-tag floor">{location.floor_name}</span>
                    </div>
                </div>
                <div className="location-card-chip">
                    <MapIcon size={16} />
                    <span>{location.building}</span>
                </div>
            </div>
            <div className="location-card-start">
                <span className="location-card-label">Start from</span>
                <p>{location.startingPoint}</p>
            </div>
            <div className="location-card-steps-wrapper">
                <span className="location-card-label">Follow these steps</span>
                <ol className="location-card-steps">
                    {location.steps.map((step, index) => (
                        <li key={`${location.key}-step-${index}`}>
                            <div className="location-card-step-index">{index + 1}</div>
                            <p>{step}</p>
                        </li>
                    ))}
                </ol>
            </div>
            {location.citations.length > 0 && (
                <div className="location-card-citations">
                    <span className="location-card-label">Citations</span>
                    <div className="location-card-citation-pills">
                        {location.citations.map((cite) => (
                            <span key={`${location.key}-cite-${cite}`} className="location-card-citation-pill">
                                #{cite}
                            </span>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

const SVITLogo = () => {
    return (
        <svg className="svit-logo-image" viewBox="0 0 200 240" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <radialGradient id="sunGradient" cx="50%" cy="35%">
                    <stop offset="0%" style={{stopColor:"#ffeb3b", stopOpacity:1}} />
                    <stop offset="100%" style={{stopColor:"#ff9800", stopOpacity:1}} />
                </radialGradient>
                <linearGradient id="flameGradient" x1="50%" y1="0%" x2="50%" y2="100%">
                    <stop offset="0%" style={{stopColor:"#ff4444", stopOpacity:1}} />
                    <stop offset="50%" style={{stopColor:"#ff0000", stopOpacity:1}} />
                    <stop offset="100%" style={{stopColor:"#cc0000", stopOpacity:1}} />
                </linearGradient>
            </defs>
            
            {/* Outer circle borders */}
            <circle cx="100" cy="100" r="95" fill="none" stroke="#dc2626" strokeWidth="2"/>
            <circle cx="100" cy="100" r="88" fill="none" stroke="#ffffff" strokeWidth="3"/>
            <circle cx="100" cy="100" r="82" fill="none" stroke="#dc2626" strokeWidth="2"/>
            
            {/* Inner circle with gradient background */}
            <circle cx="100" cy="100" r="78" fill="url(#sunGradient)"/>
            
            {/* Sun rays */}
            {Array.from({length: 20}, (_, i) => {
                const angle = (i * 360 / 20) * Math.PI / 180;
                const x1 = 100 + Math.cos(angle) * 75;
                const y1 = 100 + Math.sin(angle) * 75;
                const x2 = 100 + Math.cos(angle) * 82;
                const y2 = 100 + Math.sin(angle) * 82;
                return (
                    <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#ff9800" strokeWidth="1.5" opacity="0.7"/>
                );
            })}
            
            {/* Book at bottom */}
            <rect x="75" y="140" width="50" height="38" fill="#2c2c2c" rx="3"/>
            <rect x="80" y="145" width="40" height="28" fill="#ffffff" rx="1"/>
            <line x1="100" y1="145" x2="100" y2="173" stroke="#2c2c2c" strokeWidth="1.5"/>
            <line x1="85" y1="152" x2="115" y2="152" stroke="#e0e0e0" strokeWidth="0.5"/>
            <line x1="85" y1="158" x2="115" y2="158" stroke="#e0e0e0" strokeWidth="0.5"/>
            <line x1="85" y1="164" x2="115" y2="164" stroke="#e0e0e0" strokeWidth="0.5"/>
            
            {/* Flame rising from book */}
            <path d="M 95 140 Q 90 115, 100 105 Q 110 115, 105 140 Z" fill="url(#flameGradient)" stroke="#ff6600" strokeWidth="1"/>
            <ellipse cx="100" cy="110" rx="4" ry="10" fill="#ffffff" opacity="0.6"/>
            
            {/* Text on circle ring - SAI VIDYA INSTITUTE */}
            <text x="100" y="25" textAnchor="middle" fontSize="9" fill="#333" fontFamily="Arial, sans-serif" fontWeight="bold">SAI VIDYA INSTITUTE</text>
            <text x="100" y="38" textAnchor="middle" fontSize="8" fill="#333" fontFamily="Arial, sans-serif">OF TECHNOLOGY</text>
        </svg>
    );
};

const WelcomeScreen = ({ onStartConversation }) => {
    return (
        <div className="welcome-screen">
            <div className="welcome-background">
                <div className="circuit-pattern"></div>
                <div className="wave-pattern"></div>
            </div>
            <div className="welcome-content">
                <div className="welcome-logo-section">
                    <div className="svit-logo">
                        <img 
                            src="/assets/svit-logo.png" 
                            alt="SVIT Logo" 
                            className="svit-logo-image"
                        />
                    </div>
                    <div className="institute-name">
                        <h2 className="sai-vidya">SAI VIDYA</h2>
                        <p className="institute">INSTITUTE OF TECHNOLOGY</p>
                    </div>
                </div>
                <div className="welcome-message-section">
                    <h1 className="welcome-title">WELCOME!!</h1>
                    <p className="welcome-subtitle">How can I help you??</p>
                </div>
                <button className="start-conversation-btn" onClick={onStartConversation}>
                    Start a conversation
                </button>
                <div className="powered-by">
                    <span>Powered by</span>
                    <span className="clara-name">CLARA - AI RECEPTIONIST</span>
                </div>
            </div>
        </div>
    );
};

const staffList = [
    { name: 'Prof. Lakshmi Durga N', shortName: 'LDN', route: '/ldn', email: 'lakshmidurgan@gmail.com' },
    { name: 'Prof. Anitha C S', shortName: 'ACS', route: '/acs', email: 'anithacs@gmail.com' },
    { name: 'Dr. G Dhivyasri', shortName: 'GD', route: '/gd', email: 'gdhivyasri@gmail.com' },
    { name: 'Prof. Nisha S K', shortName: 'NSK', route: '/nsk', email: 'nishask@gmail.com' },
    { name: 'Prof. Amarnath B Patil', shortName: 'ABP', route: '/abp', email: 'amarnathbpatil@gmail.com' },
    { name: 'Dr. Nagashree N', shortName: 'NN', route: '/nn', email: 'nagashreen@gmail.com' },
    { name: 'Prof. Anil Kumar K V', shortName: 'AKV', route: '/akv', email: 'anilkumarkv@gmail.com' },
    { name: 'Prof. Jyoti Kumari', shortName: 'JK', route: '/jk', email: 'jyotikumari@gmail.com' },
    { name: 'Prof. Vidyashree R', shortName: 'VR', route: '/vr', email: 'vidyashreer@gmail.com' },
    { name: 'Dr. Bhavana A', shortName: 'BA', route: '/ba', email: 'bhavanaa@gmail.com' },
    { name: 'Prof. Bhavya T N', shortName: 'BTN', route: '/btn', email: 'bhavyatn@gmail.com' },
];

const AVAILABILITY_KEYWORDS = [
    'availability',
    'available',
    'free time',
    'free slot',
    'free slots',
    'free period',
    'free periods',
    'free right now',
    'when can i meet',
    'when are they free',
];

const SUPPORTED_DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const SUPPORTED_DAY_SET = new Set(SUPPORTED_DAY_NAMES.map(day => day.toLowerCase()));
const DAY_SYNONYMS = [
    { value: 'Monday', patterns: ['monday', 'mon'] },
    { value: 'Tuesday', patterns: ['tuesday', 'tue', 'tues'] },
    { value: 'Wednesday', patterns: ['wednesday', 'wed'] },
    { value: 'Thursday', patterns: ['thursday', 'thu', 'thur', 'thurs'] },
    { value: 'Friday', patterns: ['friday', 'fri'] },
    { value: 'Saturday', patterns: ['saturday', 'sat'] },
];
const DAY_NAME_LOOKUP = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const initiateVideoCallFunction: FunctionDeclaration = {
    name: 'initiateVideoCall',
    description: 'Initiates a video call with a specific staff member.',
    parameters: {
        type: Type.OBJECT,
        properties: {
            staffShortName: {
                type: Type.STRING,
                description: 'The short name (e.g., "ACS", "LDN") of the staff member to call.',
            },
        },
        required: ['staffShortName'],
    },
};

const PreChatModal = ({ onStart }) => {
    const [details, setDetails] = useState({
        name: '',
        phone: '+91',
        purpose: '',
        staffShortName: '',
    });

    const handleChange = (e) => {
        const { name, value } = e.target;
        setDetails(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (details.name.trim() && details.purpose.trim() && details.staffShortName) {
            onStart(details);
        } else {
            if (!details.staffShortName) {
                alert('Please select a staff member to continue.');
        } else {
            alert('Please fill in your name and purpose.');
            }
        }
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content">
                <div className="modal-header">
                    <RobotIcon size={28} />
                    <h1>Start Conversation with Clara</h1>
                </div>
                <p>Please provide your details below to begin.</p>
                <form onSubmit={handleSubmit}>
                    <div className="form-field">
                        <label htmlFor="name">Name</label>
                        <input type="text" id="name" name="name" value={details.name} onChange={handleChange} required />
                    </div>
                    <div className="form-field">
                        <label htmlFor="phone">Phone Number</label>
                        <input type="tel" id="phone" name="phone" value={details.phone} onChange={handleChange} />
                    </div>
                    <div className="form-field">
                         <label htmlFor="purpose">Purpose</label>
                         <textarea id="purpose" name="purpose" value={details.purpose} onChange={handleChange} required />
                    </div>
                    <div className="form-field">
                        <label htmlFor="staff">Connect with <span className="required-asterisk">*</span></label>
                        <select id="staff" name="staffShortName" value={details.staffShortName} onChange={handleChange} required>
                            <option value="">Select a staff member...</option>
                            {staffList.map(staff => (
                                <option key={staff.shortName} value={staff.shortName}>
                                    {staff.name} ({staff.shortName})
                                </option>
                            ))}
                        </select>
                    </div>
                    <button type="submit">Start Chatting</button>
                </form>
            </div>
        </div>
    );
};

const VideoCallView = ({ staff, onEndCall, activeCall }) => {
    const userVideoRef = useRef(null);
    const staffVideoRef = useRef(null);
    const streamRef = useRef(null);
    const animationFrameRef = useRef(null);
    const audioContextRef = useRef(null);

    const [countdown, setCountdown] = useState(3);
    const [isConnected, setIsConnected] = useState(false);
    const [isUserSpeaking, setIsUserSpeaking] = useState(false);
    const [isStaffSpeaking, setIsStaffSpeaking] = useState(false);
    const [isMicOn, setIsMicOn] = useState(true);
    const [isCameraOn, setIsCameraOn] = useState(true);

    // Countdown effect
    useEffect(() => {
        if (countdown > 0) {
            const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
            return () => clearTimeout(timer);
        } else if (countdown === 0) {
            setIsConnected(true);
        }
    }, [countdown]);
    
    // Watch for remote stream and update staff video
    useEffect(() => {
        if (activeCall?.remoteStream && staffVideoRef.current) {
            staffVideoRef.current.srcObject = activeCall.remoteStream;
            setIsConnected(true);
        }
    }, [activeCall?.remoteStream]);

    // Simulated staff speaking effect (only if no remote stream)
    useEffect(() => {
        if (!isConnected || activeCall?.remoteStream) return;
        const interval = setInterval(() => {
            setIsStaffSpeaking(prev => Math.random() > 0.5 ? !prev : prev);
        }, 1200);
        return () => clearInterval(interval);
    }, [isConnected, activeCall?.remoteStream]);

    useEffect(() => {
        const startCameraAndAudio = async () => {
            try {
                // If pc and localStream are null, we're in "ringing" state - don't access camera yet
                if (!activeCall?.pc || !activeCall?.localStream) {
                    // Show "Ringing..." state
                    setIsConnected(false);
                    return;
                }
                
                // Use activeCall's local stream
                const stream = activeCall.localStream;
                streamRef.current = stream;
                
                if (userVideoRef.current) {
                    userVideoRef.current.srcObject = stream;
                }

                // Setup audio analysis for speaker detection
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

                // Remote stream handling is done in separate useEffect above

            } catch (err) {
                console.error("Error accessing camera/mic:", err);
                alert("Could not access your camera or microphone. Please check permissions and try again.");
                onEndCall();
            }
        };

        startCameraAndAudio();

        return () => {
            cancelAnimationFrame(animationFrameRef.current);
            // Don't stop tracks if they're from activeCall (will be cleaned up by CallService)
            if (streamRef.current && !activeCall?.localStream) {
                streamRef.current.getTracks().forEach(track => track.stop());
            }
            if (audioContextRef.current) {
                audioContextRef.current.close().catch(console.error);
            }
        };
    }, [onEndCall, activeCall]);

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

    // Watch isCameraOn state and update video element when camera is re-enabled
    useEffect(() => {
        if (isCameraOn && streamRef.current && userVideoRef.current) {
            // Re-attach stream to video element when camera is re-enabled
            const videoTrack = streamRef.current.getVideoTracks()[0];
            if (videoTrack && videoTrack.enabled) {
                // Ensure video element is properly connected
                if (userVideoRef.current.srcObject !== streamRef.current) {
                    userVideoRef.current.srcObject = streamRef.current;
                }
                // Force video to play
                userVideoRef.current.play().catch(err => console.error('Error playing video:', err));
            }
        }
    }, [isCameraOn]);

    return (
        <div className="video-call-container">
             {countdown > 0 && (
                <div className="countdown-overlay">
                    <div className="countdown-number">{countdown}</div>
                </div>
            )}
            <div className="staff-video-view">
                {activeCall?.remoteStream ? (
                    <video ref={staffVideoRef} autoPlay playsInline className="staff-video"></video>
                ) : activeCall?.pc && activeCall?.localStream ? (
                    <div className={`staff-avatar-placeholder ${isStaffSpeaking && isConnected ? 'speaking' : ''}`}>
                        <StaffLoginIcon size={80} />
                    </div>
                ) : (
                    <div className="staff-avatar-placeholder ringing">
                        <StaffLoginIcon size={80} />
                        <div className="ringing-indicator">
                            <div className="ringing-dot"></div>
                            <div className="ringing-dot"></div>
                            <div className="ringing-dot"></div>
                        </div>
                    </div>
                )}
                <h2>{staff.name}</h2>
                <p>
                    {activeCall?.remoteStream ? 'Connected' : 
                     activeCall?.pc && activeCall?.localStream ? 'Connecting...' : 
                     'Ringing...'}
                </p>
                 <div className="video-call-branding">
                    <RobotIcon size={20} /> Clara Video
                </div>
            </div>
            <div className={`user-video-view ${isUserSpeaking ? 'speaking' : ''}`}>
                 {isCameraOn ? (
                    <video ref={userVideoRef} autoPlay playsInline muted></video>
                ) : (
                    <div className="user-video-placeholder">
                        <UserIcon size={48} />
                    </div>
                )}
            </div>
            <div className="video-controls">
                <button className={`control-button ${!isMicOn ? 'off' : ''}`} onClick={toggleMic} aria-label={isMicOn ? 'Mute microphone' : 'Unmute microphone'}>
                    {isMicOn ? <MicOnIcon size={24}/> : <MicOffIcon size={24}/>}
                </button>
                <button className={`control-button ${!isCameraOn ? 'off' : ''}`} onClick={toggleCamera} aria-label={isCameraOn ? 'Turn off camera' : 'Turn on camera'}>
                     {isCameraOn ? <CameraOnIcon size={24}/> : <CameraOffIcon size={24}/>}
                </button>
                <button className="end-call-button" onClick={onEndCall}>
                    End Call
                </button>
            </div>
        </div>
    );
};


const App = () => {
    const [messages, setMessages] = useState([]);
    const [isRecording, setIsRecording] = useState(false);
    const [status, setStatus] = useState('Click the microphone to speak');
    const [showWelcomeScreen, setShowWelcomeScreen] = useState(true);
    const [showPreChatModal, setShowPreChatModal] = useState(false);
    const [preChatDetails, setPreChatDetails] = useState(null);
    const [isCollegeQueryActive, setIsCollegeQueryActive] = useState(false); // Track if current query is college-related
    const isCollegeQueryActiveRef = useRef(false); // Immediate ref for race condition prevention
    const [view, setView] = useState('chat'); // 'chat', 'video_call', 'map'
    const [videoCallTarget, setVideoCallTarget] = useState(null);
    const [unifiedCallService, setUnifiedCallService] = useState<CallService | null>(null);
    const [isUnifiedCalling, setIsUnifiedCalling] = useState(false);
    const [isDemoMode, setIsDemoMode] = useState(false);
    const [detectedLanguage, setDetectedLanguage] = useState<string>('en'); // Default to English
    const [activeCall, setActiveCall] = useState<{ 
        callId: string; 
        roomName: string;
        pc?: RTCPeerConnection;
        stream?: MediaStream;
        remoteStream?: MediaStream | null;
    } | null>(null);
    
    // New call store integration
    const callStore = useCallStore();
    const [showPermissionPrompt, setShowPermissionPrompt] = useState(false);
    const [pendingCallStaff, setPendingCallStaff] = useState<any>(null);
    const [toast, setToast] = useState<{ type: ToastType; message?: string } | null>(null);
    const [showEndSummary, setShowEndSummary] = useState(false);
    const detectedLanguageRef = useRef('en');
    const [audioDiagnostics, setAudioDiagnostics] = useState({
        mode: 'idle',
        queueSize: 0,
        nextStart: 0,
        lastChunkDuration: 0,
        lastChunkStart: 0,
        detectedLanguage: 'en',
        languageConfidence: 1,
    });
    const [showDiagnostics, setShowDiagnostics] = useState(false);
    const audioDiagnosticsRef = useRef(audioDiagnostics);
    
    const ensureAudioWorkletModule = useCallback(async (ctx: AudioContext) => {
        if (audioWorkletReadyRef.current) {
            return;
        }
        const moduleUrl = new URL('./src/worklets/pcm-processor.js', import.meta.url);
        await ctx.audioWorklet.addModule(moduleUrl.href);
        audioWorkletReadyRef.current = true;
        console.log('[Mic] AudioWorklet processor loaded');
    }, []);
    
    useEffect(() => {
        audioDiagnosticsRef.current = audioDiagnostics;
    }, [audioDiagnostics]);
    
    useEffect(() => {
        detectedLanguageRef.current = detectedLanguage;
        setAudioDiagnostics(prev => ({
            ...prev,
            detectedLanguage,
        }));
    }, [detectedLanguage]);
    
    useEffect(() => {
        const handleKeyToggle = (event: KeyboardEvent) => {
            if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.code === 'KeyD') {
                setShowDiagnostics(prev => !prev);
            }
        };
        window.addEventListener('keydown', handleKeyToggle);
        return () => window.removeEventListener('keydown', handleKeyToggle);
    }, []);
    
    // Sync callStore with activeCall for backward compatibility
    useEffect(() => {
        if (activeCall && callStore.state === 'idle') {
            callStore.setDialing(activeCall.callId);
        }
    }, [activeCall]);
    
    // Debug: Log view changes (moved after all state declarations)
    useEffect(() => {
        console.log('[Client] View changed to:', view);
        console.log('[Client] activeCall:', activeCall);
        console.log('[Client] videoCallTarget:', videoCallTarget);
    }, [view, activeCall, videoCallTarget]);
    // Map navigator states (from remote)
    const [showMap, setShowMap] = useState(false);
    const [currentLocation, setCurrentLocation] = useState<Location | null>(null);
    const [currentFloor, setCurrentFloor] = useState(0);
    const locationMatcher = useRef(new LocationMatcher()).current;
    
    const sessionPromiseRef = useRef(null);
    const inputAudioContextRef = useRef<AudioContext | null>(null);
    const outputAudioContextRef = useRef<AudioContext | null>(null);
    const outputNodeRef = useRef<GainNode | null>(null);
    const audioProcessorNodeRef = useRef<AudioWorkletNode | null>(null);
    const audioWorkletReadyRef = useRef(false);
    const analyserRef = useRef(null);
    const mediaStreamSourceRef = useRef(null);
    const streamRef = useRef(null);
    const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
    const nextStartTimeRef = useRef(0);
    const chatContainerRef = useRef(null);
    const silenceStartRef = useRef(null);
    const isRecordingRef = useRef(false);
    const lastEndedCallIdRef = useRef<string | null>(null);
    // Ref to store current preChatDetails for access in closures
    const preChatDetailsRef = useRef(null);
    // Accumulators for streaming transcriptions so full sentences are shown
    const inputAccumRef = useRef<string>('');
    const outputAccumRef = useRef<string>('');
    const availabilityQueryInFlightRef = useRef(false);
    const ttsVoicesRef = useRef<SpeechSynthesisVoice[]>([]);
    const voiceLoadPromiseRef = useRef<Promise<void> | null>(null);
    const lastTTSTextRef = useRef<string>('');
    const lastTTSSpokeAtRef = useRef<number>(0);
    const activeUtterancesRef = useRef<SpeechSynthesisUtterance[]>([]);
    const isTTSActiveRef = useRef<boolean>(false);
    const ttsQueueRef = useRef<Promise<void> | null>(null);

    // Merge incremental transcript chunks without duplicating words
    const appendDelta = (prev: string, next: string) => {
        if (!prev) return next || '';
        if (!next) return prev;
        if (next.startsWith(prev)) return next;
        const needsSpace = !(prev.endsWith(' ') || next.startsWith(' '));
        return prev + (needsSpace ? ' ' : '') + next;
    };

    useEffect(() => {
        // Clear sessionStorage on page load/refresh to force fresh start
        try {
            sessionStorage.removeItem('clara-prechat-details');
            sessionStorage.removeItem('clara-chat-history');
        } catch (error) {
            console.error("Failed to clear session storage", error);
        }
        
        // Load TTS voices
        if ('speechSynthesis' in window) {
            const refreshVoices = () => {
                const voices = window.speechSynthesis.getVoices();
                if (voices.length) {
                    ttsVoicesRef.current = voices;
                }
            };
            refreshVoices();
            if (window.speechSynthesis.onvoiceschanged !== undefined) {
                window.speechSynthesis.onvoiceschanged = refreshVoices;
            }
        }
        
        // ALWAYS initialize unified call service for WebRTC calls
        // This enables video calls via sockets regardless of AI mode
        const enableUnified = import.meta.env.VITE_ENABLE_UNIFIED_MODE === 'true' || true; // Force enable for presentation
        console.log('[App] Initializing unified call service, enableUnified:', enableUnified);
        
        if (enableUnified) {
            // Get or create token
            let token = localStorage.getItem('clara-jwt-token');
            const clientId = localStorage.getItem('clara-client-id') || 'client-' + Date.now();
            
            // Always refresh token on app load to ensure it's valid
            const apiBase = import.meta.env.VITE_API_BASE || 'http://localhost:8080';
            console.log('[App] Initializing/refreshing token...');
            console.log('[App] Using API base:', apiBase);
            
            fetch(`${apiBase}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: clientId,
                    role: 'client',
                }),
            })
                .then((res) => {
                    if (!res.ok) {
                        throw new Error(`Login failed: ${res.statusText}`);
                    }
                    return res.json();
                })
                .then((data) => {
                    token = data.token;
                    if (token) {
                        localStorage.setItem('clara-jwt-token', token);
                        localStorage.setItem('clara-client-id', clientId);
                        const service = new CallService({
                            token,
                            clientId,
                        });
                        setUnifiedCallService(service);
                        console.log('[App] CallService initialized with fresh token, clientId:', clientId);
                    } else {
                        console.error('[App] No token received from login');
                    }
                })
                .catch((error) => {
                    console.error('[App] Error during auto-login:', error);
                    // If we have an old token, try using it anyway
                    if (token) {
                        const service = new CallService({
                            token,
                            clientId,
                        });
                        setUnifiedCallService(service);
                        console.log('[App] CallService initialized with existing token (may be expired), clientId:', clientId);
                    }
                });
        } else {
            console.warn('[App] Unified mode is disabled - video calls will not work');
        }
        
        // Don't set messages here - let handleStartConversation set the greeting after login
        // Pre-chat modal will show because showPreChatModal defaults to true
    }, []);

    useEffect(() => {
        try {
            if (preChatDetails) {
                sessionStorage.setItem('clara-prechat-details', JSON.stringify(preChatDetails));
            }
            if (messages.length > 0) {
              sessionStorage.setItem('clara-chat-history', JSON.stringify(messages));
            }
        } catch (error) {
            console.error("Failed to save to session storage", error);
        }
    }, [preChatDetails, messages]);

    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [messages]);

    // Sync ref whenever preChatDetails state changes
    useEffect(() => {
        preChatDetailsRef.current = preChatDetails;
    }, [preChatDetails]);

    // Define stopRecording first since it's used by other callbacks
    const stopRecording = useCallback((closeSession = false) => {
        if (!isRecordingRef.current && !closeSession) return; // Prevent multiple stops (unless explicitly closing)
        
        isRecordingRef.current = false;
        setIsRecording(false);
        setStatus('Click the microphone to speak');

        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        if (audioProcessorNodeRef.current) {
            try {
                audioProcessorNodeRef.current.port.onmessage = null;
                audioProcessorNodeRef.current.disconnect();
            } catch (error) {
                console.debug('[Audio] Processor disconnect skipped:', error);
            }
            audioProcessorNodeRef.current = null;
        }
        if (analyserRef.current) {
            analyserRef.current.disconnect();
            analyserRef.current = null;
        }
        if (mediaStreamSourceRef.current) {
            mediaStreamSourceRef.current.disconnect();
            mediaStreamSourceRef.current = null;
        }
        if (inputAudioContextRef.current && inputAudioContextRef.current.state !== 'closed') {
            inputAudioContextRef.current.close().catch(console.error);
            inputAudioContextRef.current = null;
        }
        
        silenceStartRef.current = null;
        
        // Only close session if explicitly requested (e.g., on error or user logout)
        // Don't close session after normal recording stops - keep it alive for next interaction
        if (closeSession && sessionPromiseRef.current) {
            sessionPromiseRef.current.then(session => {
                if (session && typeof session.close === 'function') {
                    session.close().catch(console.error);
                }
            }).catch(console.error);
            sessionPromiseRef.current = null;
        }
        // Session stays alive for next interaction - no logging needed
    }, []);

    const finalizeCallSession = useCallback(
        (message: string, options: { notifyServer?: boolean; showSummary?: boolean } = {}) => {
            const { notifyServer = true, showSummary = true } = options;
            callStore.endCall();
            setToast({ type: 'ended', message });

            const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            setMessages(prev => [...prev, { sender: 'clara', text: message, isFinal: true, timestamp }]);

            if (activeCall && notifyServer) {
                lastEndedCallIdRef.current = activeCall.callId;
                if (unifiedCallService) {
                    unifiedCallService.endCall(activeCall.callId);
                } else {
                    if (activeCall.stream) {
                        activeCall.stream.getTracks().forEach(track => track.stop());
                    }
                    if (activeCall.remoteStream) {
                        activeCall.remoteStream.getTracks().forEach(track => track.stop());
                    }
                }
            } else {
                lastEndedCallIdRef.current = null;
            }

            setActiveCall(null);
            setView('chat');
            setVideoCallTarget(null);
            setShowEndSummary(showSummary);

            if (sessionPromiseRef.current) {
                setStatus('Clara is ready! Click the microphone to speak.');
            } else {
                setStatus('Click the microphone to speak');
            }
        },
        [activeCall, unifiedCallService, callStore]
    );

    // Actual call initiation function (called after confirmation)
    const startCallAfterConfirmation = useCallback(async (staffToCall: any) => {
        if (isRecordingRef.current) {
            stopRecording(false);
        }

        // Use DevicePermissionPrompt instead of inline permission request
        if (!callStore.canInitiate()) {
            console.warn('[Call] Cannot initiate call from current state:', callStore.state);
            return;
        }

        // Show permission prompt
        callStore.initiateCall('Voice-initiated video call');
        setPendingCallStaff(staffToCall);
        setShowPermissionPrompt(true);
    }, [callStore, stopRecording]);
    
    // Handle permission prompt result
    const handlePermissionGranted = useCallback(async (stream: MediaStream, audioOnly: boolean) => {
        setShowPermissionPrompt(false);
        const staffToCall = pendingCallStaff;
        if (!staffToCall) {
            callStore.reset();
            return;
        }

        callStore.setPreparing();
        setToast({ type: 'connecting', message: 'Connecting to staff...' });

        // Show confirmation message
        const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        setMessages(prev => [...prev, { sender: 'clara', text: `Initiating video call with ${staffToCall.name}...`, isFinal: true, timestamp }]);
        
        // Store stream in callStore
        callStore.setInCall({ localStream: stream });

        // ALWAYS use unifiedCallService for WebRTC calls via sockets
        if (unifiedCallService) {
            console.log('[Call] Using unifiedCallService to initiate WebRTC call');
            try {
                // Map shortName to email prefix (how server identifies staff)
                // The server uses email prefix (e.g., 'nagashreen' from 'nagashreen@gmail.com')
                // as the staffId for socket rooms, so we need to extract it from the email
                const emailPrefix = staffToCall.email.split('@')[0];
                
                callStore.setDialing(''); // Will be set when we get callId
                const result = await unifiedCallService.startCall({
                    targetStaffId: emailPrefix, // Use email prefix instead of shortName
                    purpose: 'Voice-initiated video call',
                    clientName: preChatDetailsRef.current?.name, // Send client name from prechat
                    onAccepted: (callId, roomName) => {
                        console.log('[Client] ===== CALL ACCEPTED =====');
                        console.log('[Client] Call ID:', callId, 'Room:', roomName);
                        console.log('[Client] Staff:', staffToCall);
                        
                        // Update callStore
                        callStore.onAccepted(callId, { id: staffToCall.email.split('@')[0], name: staffToCall.name });
                        callStore.setConnecting();
                        setToast({ type: 'accepted', message: 'Call accepted! Connecting...' });
                        
                        // Get peer connection from CallService
                        const callData = unifiedCallService.getActiveCall(callId);
                        console.log('[Client] Call data from service:', callData);
                        
                        if (callData) {
                            console.log('[Client] Setting activeCall with peer connection...');
                            setActiveCall({
                                callId,
                                roomName,
                                pc: callData.pc,
                                stream: callData.stream,
                                remoteStream: callData.remoteStream || null,
                            });
                            
                            // Update callStore with peer connection and streams
                            callStore.setInCall({
                                peerConnection: callData.pc,
                                localStream: callData.stream,
                                remoteStream: callData.remoteStream || null,
                            });
                            
                            // Watch for remote stream updates
                            const checkRemoteStream = () => {
                                const updatedCallData = unifiedCallService.getActiveCall(callId);
                                if (updatedCallData && updatedCallData.remoteStream) {
                                    console.log('[Client] Remote stream detected, updating activeCall...');
                                    setActiveCall(prev => prev ? {
                                        ...prev,
                                        remoteStream: updatedCallData.remoteStream,
                                    } : null);
                                    callStore.setInCall({ remoteStream: updatedCallData.remoteStream });
                                } else if (updatedCallData) {
                                    // Check again in a bit
                                    setTimeout(checkRemoteStream, 500);
                                }
                            };
                            setTimeout(checkRemoteStream, 500);
                        } else {
                            console.warn('[Client] No call data found, setting basic activeCall...');
                            setActiveCall({
                                callId,
                                roomName,
                            });
                        }
                        
                        setVideoCallTarget(staffToCall);
                        console.log('[Client] Switching to video_call view...');
                        setView('video_call');
                        
                        const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                        setMessages(prev => [...prev, { sender: 'clara', text: `Video call with ${staffToCall.name} connected!`, isFinal: true, timestamp }]);
                        
                        console.log('[Client] View should now be:', 'video_call');
                    },
                    onDeclined: (reason) => {
                        callStore.onDeclined(reason);
                        setToast({ type: 'declined', message: reason || 'Call declined by staff' });
                        const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                        setMessages(prev => [...prev, { sender: 'clara', text: `Call declined${reason ? ': ' + reason : ''}.`, isFinal: true, timestamp }]);
                        setView('chat');
                        setActiveCall(null);
                        setVideoCallTarget(null);
                    },
                    onEnded: ({ callId: endedCallId }) => {
                        if (endedCallId && lastEndedCallIdRef.current === endedCallId) {
                            lastEndedCallIdRef.current = null;
                            return;
                        }
                        lastEndedCallIdRef.current = null;
                        const staffName = staffToCall.name;
                        finalizeCallSession(`Video call with ${staffName} ended. How can I assist you further?`, {
                            notifyServer: false,
                            showSummary: true,
                        });
                    },
                    onAppointmentUpdate: ({ status, details }) => {
                        const staffName = details?.staffName || staffToCall.name;
                        const clientName = details?.clientName || preChatDetailsRef.current?.name || 'You';
                        const scheduleInfo =
                            details?.date && details?.time
                                ? `${details.date} at ${details.time}`
                                : 'soon';
                        const purposeText = details?.purpose ? ` Purpose: ${details.purpose}.` : '';
                        const message =
                            status === 'confirmed'
                                ? `Appointment confirmed with ${staffName} on ${scheduleInfo}.${purposeText}`
                                : `Appointment with ${staffName} was declined.${purposeText}`;
                        const timestamp = new Date().toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                        });
                        setMessages((prev) => [
                            ...prev,
                            {
                                sender: 'clara',
                                text: message,
                                isFinal: true,
                                timestamp,
                            },
                        ]);
                    },
                    onError: (error) => {
                        console.error('Call error:', error);
                        const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                        setMessages(prev => [...prev, { sender: 'clara', text: `Failed to start call: ${error.message}`, isFinal: true, timestamp }]);
                        setView('chat');
                        setActiveCall(null);
                        setVideoCallTarget(null);
                    }
                });

                if (result) {
                    callStore.setDialing(result.callId);
                    callStore.setRinging();
                    // Get peer connection from CallService
                    const callData = unifiedCallService.getActiveCall(result.callId);
                    if (callData) {
                        setActiveCall({
                            callId: result.callId,
                            roomName: result.roomName,
                            pc: callData.pc,
                            stream: callData.stream,
                            remoteStream: callData.remoteStream,
                        });
                        callStore.setInCall({
                            peerConnection: callData.pc,
                            localStream: callData.stream,
                            remoteStream: callData.remoteStream || null,
                        });
                    } else {
                        setActiveCall({
                            callId: result.callId,
                            roomName: result.roomName,
                        });
                    }
                    setVideoCallTarget(staffToCall);
                    
                    // Show ringing message
                    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    setMessages(prev => [...prev, { sender: 'clara', text: `Ringing ${staffToCall.name}...`, isFinal: true, timestamp }]);
                } else {
                    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    setMessages(prev => [...prev, { sender: 'clara', text: 'Failed to start call. Please try again.', isFinal: true, timestamp }]);
                }
            } catch (error) {
                console.error('Call initiation error:', error);
                const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                setMessages(prev => [...prev, { sender: 'clara', text: `Failed to start call: ${error.message}`, isFinal: true, timestamp }]);
            }
        } else {
            // If unifiedCallService is not available, try to initialize it
            console.warn('[Call] unifiedCallService not available, attempting to initialize...');
            // Always use backend server port (8080), not the client dev server port
            const apiBase = import.meta.env.VITE_API_BASE || 'http://localhost:8080';
            console.log('[Call] Using API base for retry:', apiBase);
            
            try {
                const response = await fetch(`${apiBase}/api/auth/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        username: 'client-' + Date.now(),
                        role: 'client',
                    }),
                });
                
                const data = await response.json();
                if (data.token) {
                    localStorage.setItem('clara-jwt-token', data.token);
                    const clientId = 'client-' + Date.now();
                    localStorage.setItem('clara-client-id', clientId);
                    const service = new CallService({
                        token: data.token,
                        clientId,
                    });
                    setUnifiedCallService(service);
                    
                    // Retry call initiation with newly created service
                    console.log('[Call] Retrying call with newly initialized service');
                    const retryResult = await service.startCall({
                        targetStaffId: staffToCall.email.split('@')[0],
                        purpose: 'Voice-initiated video call',
                        clientName: preChatDetailsRef.current?.name, // Send client name from prechat
                        onAccepted: (callId, roomName) => {
                            console.log('Call accepted:', callId, 'Room:', roomName);
                            setActiveCall({
                                callId,
                                roomName,
                            });
                            setVideoCallTarget(staffToCall);
                            setView('video_call');
                            const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                            setMessages(prev => [...prev, { sender: 'clara', text: `Video call with ${staffToCall.name} connected!`, isFinal: true, timestamp }]);
                        },
                        onDeclined: (reason) => {
                            const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                            setMessages(prev => [...prev, { sender: 'clara', text: `Call declined${reason ? ': ' + reason : ''}.`, isFinal: true, timestamp }]);
                            setView('chat');
                            setActiveCall(null);
                            setVideoCallTarget(null);
                        },
                        onEnded: ({ callId: endedCallId }) => {
                            if (endedCallId && lastEndedCallIdRef.current === endedCallId) {
                                lastEndedCallIdRef.current = null;
                                return;
                            }
                            lastEndedCallIdRef.current = null;
                            const staffName = staffToCall.name;
                            finalizeCallSession(`Video call with ${staffName} ended. How can I assist you further?`, {
                                notifyServer: false,
                                showSummary: true,
                            });
                        },
                        onError: (error) => {
                            console.error('Call error:', error);
                            const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                            setMessages(prev => [...prev, { sender: 'clara', text: `Failed to start call: ${error.message}`, isFinal: true, timestamp }]);
                            setView('chat');
                            setActiveCall(null);
                            setVideoCallTarget(null);
                        }
                    });
                    
                    if (retryResult) {
                        setActiveCall({
                            callId: retryResult.callId,
                            roomName: retryResult.roomName,
                        });
                        setVideoCallTarget(staffToCall);
                        const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                        setMessages(prev => [...prev, { sender: 'clara', text: `Ringing ${staffToCall.name}...`, isFinal: true, timestamp }]);
                    }
                } else {
                    throw new Error('Failed to get token');
                }
            } catch (error) {
                console.error('[Call] Failed to initialize service and start call:', error);
                const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                setMessages(prev => [...prev, { sender: 'clara', text: `Failed to start call. Please ensure the server is running and unified mode is enabled.`, isFinal: true, timestamp }]);
            }
        }
    }, [unifiedCallService, stopRecording, callStore, pendingCallStaff, setMessages, setToast]);

    // Handle manual call initiation - shows confirmation first
    const handleManualCallInitiation = useCallback(async (staffNameOrShortName?: string) => {
        // Check if in demo mode
        if (isDemoMode) {
            const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            setMessages(prev => [...prev, { sender: 'clara', text: 'Video calls are not available in demo mode. Please configure an API key to enable video calling.', isFinal: true, timestamp }]);
            return;
        }

        const selectedStaffShortName = preChatDetailsRef.current?.staffShortName;
        if (!selectedStaffShortName) {
            const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            setMessages(prev => [...prev, { sender: 'clara', text: 'Please select a staff member first to initiate a call.', isFinal: true, timestamp }]);
            return;
        }

        const staffToCall = staffList.find(s => s.shortName === selectedStaffShortName);
        if (!staffToCall) {
            const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            setMessages(prev => [...prev, { sender: 'clara', text: `Sorry, I couldn't find the selected staff member.`, isFinal: true, timestamp }]);
            return;
        }

        // Stop recording if active
        if (isRecordingRef.current) {
            stopRecording(false);
        }

        startCallAfterConfirmation(staffToCall);
    }, [stopRecording, isDemoMode, startCallAfterConfirmation]);

    // Helper function to detect if query is college-related
    const isCollegeQuery = (text: string): boolean => {
        const collegeKeywords = [
            'college', 'admission', 'fee', 'fees', 'department', 'departments',
            'faculty', 'placement', 'event', 'events', 'campus', 'course', 'courses',
            'branch', 'cse', 'mechanical', 'civil', 'ece', 'ise', 'engineering',
            'saividya', 'svit', 'sai vidya', 'institute', 'academic', 'semester',
            'timetable', 'schedule', 'hostel', 'transport', 'library', 'lab',
            'professor', 'prof', 'dr.', 'doctor', 'staff', 'teacher', 'lecturer'
        ];
        
        // Also check for staff member names (including common variations)
        const staffNames = [
            'lakshmi durga', 'anitha', 'dhivyasri', 'nisha', 'amarnath', 
            'nagashree', 'nagashri', 'nagash', // Handle "Nagashri" vs "Nagashree"
            'anil kumar', 'jyoti', 'vidyashree', 'bhavana', 'bhavya', 
            'ldn', 'acs', 'gd', 'nsk', 'abp', 'nn', 'akv', 'jk', 'vr', 'ba', 'btn'
        ];
        
        const lowerText = text.toLowerCase();
        const hasCollegeKeyword = collegeKeywords.some(keyword => lowerText.includes(keyword));
        const hasStaffName = staffNames.some(name => lowerText.includes(name));
        
        return hasCollegeKeyword || hasStaffName;
    };

    type LanguageAnalysis = {
        lang: string;
        confidence: number;
        counts: Record<string, number>;
        total: number;
        primaryLang: string;
        secondaryLang: string;
    };

    const analyzeLanguage = (text: string, fallbackLang: string = 'en', previousLang: string = fallbackLang): LanguageAnalysis => {
        const content = (text || '').trim();
        if (!content) {
            return {
                lang: fallbackLang,
                confidence: fallbackLang === 'en' ? 1 : 0.5,
                counts: { te: 0, hi: 0, ta: 0, kn: 0, ml: 0 },
                total: 0,
                primaryLang: fallbackLang,
                secondaryLang: 'en',
            };
        }
        
        const patterns = {
            te: /[\u0C00-\u0C7F]/g, // Telugu
            hi: /[\u0900-\u097F]/g, // Hindi / Devanagari
            ta: /[\u0B80-\u0BFF]/g, // Tamil
            kn: /[\u0C80-\u0CFF]/g, // Kannada
            ml: /[\u0D00-\u0D7F]/g, // Malayalam
        };
        
        const counts: Record<string, number> = {
            te: (content.match(patterns.te) || []).length,
            hi: (content.match(patterns.hi) || []).length,
            ta: (content.match(patterns.ta) || []).length,
            kn: (content.match(patterns.kn) || []).length,
            ml: (content.match(patterns.ml) || []).length,
        };
        
        const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
        const [primaryLang, primaryCount] = entries[0];
        const [secondaryLang, secondaryCount] = entries[1] ?? ['en', 0];
        const total = entries.reduce((sum, [, count]) => sum + count, 0);
        
        if (total === 0) {
            return {
                lang: fallbackLang,
                confidence: fallbackLang === 'en' ? 1 : 0.5,
                counts,
                total,
                primaryLang: fallbackLang,
                secondaryLang,
            };
        }
        
        let lang = primaryLang;
        const confidence = primaryCount / total;
        const isTie = secondaryCount > 0 && primaryCount - secondaryCount <= 2;
        
        if (isTie) {
            // Prefer previous language if it is one of the tied languages
            if (previousLang && previousLang !== 'en' && counts[previousLang] === primaryCount) {
                lang = previousLang;
            } else if (fallbackLang && fallbackLang !== 'en' && counts[fallbackLang] === primaryCount) {
                lang = fallbackLang;
            }
        }
        
        return { lang, confidence, counts, total, primaryLang, secondaryLang };
    };

    const detectLanguage = (text: string, fallbackLang: string = 'en', previousLang: string = fallbackLang): string => {
        return analyzeLanguage(text, fallbackLang, previousLang).lang;
    };

    const languageCodeMap: Record<string, string> = {
        en: 'en-US',
        hi: 'hi-IN',
        te: 'te-IN',
        ta: 'ta-IN',
        kn: 'kn-IN',
        ml: 'ml-IN',
    };

    const languageFriendlyNames: Record<string, string> = {
        en: 'English',
        hi: 'Hindi',
        te: 'Telugu',
        ta: 'Tamil',
        kn: 'Kannada',
        ml: 'Malayalam',
    };

    const languageVoiceProfiles: Record<string, { rate: number; pitch: number; volume: number }> = {
        default: { rate: 0.92, pitch: 1.02, volume: 1.0 },
        en: { rate: 0.92, pitch: 1.02, volume: 1.0 },
        hi: { rate: 0.88, pitch: 1.0, volume: 1.0 },
        te: { rate: 0.9, pitch: 1.04, volume: 1.0 },
        ta: { rate: 0.9, pitch: 1.03, volume: 1.0 },
        kn: { rate: 0.9, pitch: 1.04, volume: 1.0 },
        ml: { rate: 0.9, pitch: 1.0, volume: 1.0 },
    };

    const ensureVoicesReady = (): Promise<void> => {
        if (!('speechSynthesis' in window)) {
            return Promise.resolve();
        }
        if (ttsVoicesRef.current.length) {
            return Promise.resolve();
        }
        if (voiceLoadPromiseRef.current) {
            return voiceLoadPromiseRef.current;
        }
        const promise = new Promise<void>((resolve) => {
            let attempts = 0;
            const maxAttempts = 40;
            const tryLoad = () => {
                const voices = window.speechSynthesis.getVoices();
                if (voices.length) {
                    ttsVoicesRef.current = voices;
                    resolve();
                    return;
                }
                attempts += 1;
                if (attempts >= maxAttempts) {
                    resolve();
                    return;
                }
                setTimeout(tryLoad, 75);
            };
            tryLoad();
        });
        voiceLoadPromiseRef.current = promise;
        promise.finally(() => {
            voiceLoadPromiseRef.current = null;
        });
        return promise;
    };

    // Helper function to split text into sentences for TTS (handles long texts)
    const splitIntoSentences = (text: string, maxLength: number = 150): string[] => {
        if (!text || text.trim().length === 0) {
            return [];
        }
        
        const sentences: string[] = [];
        
        // First, split by sentence boundaries (periods, exclamation, question marks, and Indian language punctuation)
        // Regex matches sentence endings followed by whitespace or end of string
        const sentenceRegex = /([.!?।॥]+)(\s+|$)/g;
        const parts: string[] = [];
        let lastIndex = 0;
        let match;
        
        // Extract sentences with their punctuation
        while ((match = sentenceRegex.exec(text)) !== null) {
            const sentence = text.substring(lastIndex, match.index + match[1].length).trim();
            if (sentence) {
                parts.push(sentence);
            }
            lastIndex = match.index + match[0].length;
        }
        
        // Add remaining text
        if (lastIndex < text.length) {
            const remaining = text.substring(lastIndex).trim();
            if (remaining) {
                parts.push(remaining);
            }
        }
        
        // If no sentence boundaries found, use the whole text
        if (parts.length === 0) {
            parts.push(text.trim());
        }
        
        // Process each sentence - split if too long
        for (const part of parts) {
            if (part.length <= maxLength) {
                sentences.push(part);
            } else {
                // Split long sentences by commas first (preserve commas)
                // Use a regex that captures commas with following whitespace
                const commaSplit = part.split(/(,\s*)/);
                let currentChunk = '';
                
                for (let i = 0; i < commaSplit.length; i++) {
                    const segment = commaSplit[i];
                    const testChunk = currentChunk + segment;
                    
                    if (testChunk.length <= maxLength) {
                        currentChunk = testChunk;
                    } else {
                        // Current chunk is full, save it and start new one
                        if (currentChunk.trim()) {
                            sentences.push(currentChunk.trim());
                        }
                        currentChunk = segment.trim();
                    }
                }
                
                // Handle remaining chunk
                if (currentChunk.trim()) {
                    // If still too long, split by spaces or hyphens
                    if (currentChunk.length > maxLength) {
                        // Try splitting by spaces first
                        const words = currentChunk.split(/(\s+|-+)/);
                        let wordChunk = '';
                        
                        for (const word of words) {
                            const testChunk = wordChunk + word;
                            if (testChunk.length > maxLength && wordChunk.trim()) {
                                sentences.push(wordChunk.trim());
                                wordChunk = word;
                            } else {
                                wordChunk = testChunk;
                            }
                        }
                        
                        if (wordChunk.trim()) {
                            // If a single word is still too long, force split it
                            if (wordChunk.length > maxLength) {
                                // Split very long words into chunks
                                for (let j = 0; j < wordChunk.length; j += maxLength - 10) {
                                    const chunk = wordChunk.substring(j, j + maxLength - 10);
                                    if (chunk.trim()) {
                                        sentences.push(chunk.trim());
                                    }
                                }
                            } else {
                                sentences.push(wordChunk.trim());
                            }
                        }
                    } else {
                        sentences.push(currentChunk.trim());
                    }
                }
            }
        }
        
        // Filter out empty sentences and ensure minimum length
        // Also ensure no sentence exceeds maxLength significantly
        return sentences
            .filter(s => s && s.trim().length > 0)
            .map(s => {
                // Safety check: if somehow a sentence is still too long, truncate it
                if (s.length > maxLength * 1.5) {
                    console.warn(`[TTS] Truncating very long sentence: ${s.substring(0, 50)}...`);
                    return s.substring(0, maxLength).trim();
                }
                return s;
            });
    };

    // Helper function to ensure AudioContext is resumed
    const ensureAudioContextResumed = async (ctx: AudioContext): Promise<void> => {
        if (ctx.state === 'suspended') {
            try {
                await ctx.resume();
                console.log('[Audio] AudioContext resumed from suspended state');
            } catch (error) {
                console.error('[Audio] Failed to resume AudioContext:', error);
            }
        }
    };

    // Helper function to speak text using TTS (browser's speechSynthesis)
    const speakWithTTS = (text: string, language?: string) => {
        const speak = async () => {
            if (!('speechSynthesis' in window)) {
                console.warn('Speech synthesis not supported');
                return;
            }
    
            // Clean text - remove markdown formatting
            const cleanText = text
                .replace(/\*\*/g, '') // Remove bold markers
                .replace(/\*/g, '') // Remove italic markers
                .replace(/#{1,6}\s/g, '') // Remove headers
                .replace(/•/g, '') // Remove bullet points
                .replace(/\r?\n\s*[-•]\s*/g, ' ') // Remove list markers when present at line starts
                .replace(/\n+/g, ' ') // Replace newlines with spaces
                .replace(/\s{2,}/g, ' ') // Collapse repeated whitespace
                .trim();
    
            if (!cleanText) {
                return;
            }

            const now = Date.now();
            const isSameAsLast = cleanText === lastTTSTextRef.current;
            
            // Wait for any existing TTS to complete before starting new one
            if (isTTSActiveRef.current && ttsQueueRef.current) {
                console.log('[TTS] Waiting for current TTS to complete...');
                try {
                    await ttsQueueRef.current;
                } catch (error) {
                    console.error('[TTS] Error waiting for previous TTS:', error);
                }
            }

            // Check if still speaking after waiting
            const stillSpeaking = window.speechSynthesis.speaking || window.speechSynthesis.pending;
            const hasActiveAudioSources = sourcesRef.current.size > 0 || (nextStartTimeRef.current > 0 && outputAudioContextRef.current && nextStartTimeRef.current > outputAudioContextRef.current.currentTime);

            await ensureVoicesReady();

            // Wait for any active audio sources to finish before starting TTS
            if (hasActiveAudioSources) {
                console.log('[TTS] Waiting for active audio sources to finish...');
                let waitCount = 0;
                while (waitCount < 100) {
                    // Recheck condition each iteration
                    const stillActive = sourcesRef.current.size > 0 || (nextStartTimeRef.current > 0 && outputAudioContextRef.current && nextStartTimeRef.current > outputAudioContextRef.current.currentTime);
                    if (!stillActive) {
                        break;
                    }
                    await new Promise(resolve => setTimeout(resolve, 50));
                    waitCount++;
                }
                console.log('[TTS] Audio sources cleared, proceeding with TTS');
            }

            // Skip if same text was just spoken recently (unless explicitly requested)
            if (isSameAsLast && now - lastTTSSpokeAtRef.current < 1800 && !stillSpeaking) {
                console.log('[TTS] Skipping immediate repeat of identical text');
                return;
            }

            // Cancel any ongoing speech only if it's different text
            if (stillSpeaking && !isSameAsLast) {
                console.log('[TTS] Cancelling previous speech for new text');
                window.speechSynthesis.cancel();
                activeUtterancesRef.current = [];
                // Wait for cancellation to complete
                await new Promise((resolve) => {
                    let checkCount = 0;
                    const checkCancel = () => {
                        if (!window.speechSynthesis.speaking && !window.speechSynthesis.pending) {
                            resolve(undefined);
                        } else if (checkCount < 20) {
                            checkCount++;
                            setTimeout(checkCancel, 50);
                        } else {
                            // Timeout after 1 second
                            resolve(undefined);
                        }
                    };
                    checkCancel();
                });
            } else if (stillSpeaking && isSameAsLast) {
                console.log('[TTS] Same text already speaking, skipping');
                return;
            }

            const voices = ttsVoicesRef.current.length
                ? ttsVoicesRef.current
                : window.speechSynthesis.getVoices();
            const femaleVoiceNames = ['zira', 'hazel', 'susan', 'linda', 'karen', 'samantha', 'victoria', 'sarah', 'female', 'alloy', 'aria'];
            const matchesLanguage = (voice: SpeechSynthesisVoice) => {
                if (!language) {
                    return voice.lang?.toLowerCase().startsWith('en');
                }
                const lang = language.toLowerCase();
                return voice.lang?.toLowerCase().startsWith(lang);
            };
            const preferredVoice = voices.find(v => matchesLanguage(v) && femaleVoiceNames.some(name => v.name.toLowerCase().includes(name)))
                || voices.find(matchesLanguage)
                || voices.find(v => v.lang?.toLowerCase().startsWith('en'));

            // Split text into sentences/chunks for proper playback
            const baseLanguage = language ?? detectedLanguageRef.current ?? 'en';
            const sentences = splitIntoSentences(cleanText, 150);
            console.log(`[TTS] Split text into ${sentences.length} sentences for playback`);
            
            if (sentences.length === 0) {
                console.warn('[TTS] No sentences to speak');
                return;
            }
            
            // Mark TTS as active
            isTTSActiveRef.current = true;
            lastTTSTextRef.current = cleanText;
            lastTTSSpokeAtRef.current = Date.now();
            
            // Create a promise that tracks the entire TTS sequence
            const ttsPromise = (async () => {
                // Use a shared tracker object to ensure all handlers reference the same state
                const tracker = {
                    completedCount: 0,
                    hasStarted: false,
                    totalSentences: sentences.length,
                    resolveCompletion: null as (() => void) | null,
                    isResolved: false
                };
                
                try {
                    // Clear previous utterances
                    activeUtterancesRef.current = [];
                    
                    // Create all utterances first with proper event handlers
            const utterances: SpeechSynthesisUtterance[] = sentences.map((sentence, index) => {
                const sentenceAnalysis = analyzeLanguage(sentence, baseLanguage, detectedLanguageRef.current);
                const sentenceLang = sentenceAnalysis.lang || baseLanguage;
                const profile = languageVoiceProfiles[sentenceLang] ?? languageVoiceProfiles.default;
                const speechLangCode = languageCodeMap[sentenceLang] ?? languageCodeMap.en;
                const friendlyName = languageFriendlyNames[sentenceLang] ?? languageFriendlyNames.en;

                const sentenceVoice =
                    voices.find(v => v.lang?.toLowerCase() === speechLangCode.toLowerCase()) ??
                    voices.find(v => v.lang?.toLowerCase().startsWith(speechLangCode.split('-')[0].toLowerCase())) ??
                    preferredVoice ??
                    voices.find(v => v.lang?.toLowerCase().startsWith('en'));

                const utterance = new SpeechSynthesisUtterance(sentence);
                utterance.rate = profile.rate;
                utterance.pitch = profile.pitch;
                utterance.volume = profile.volume;
                utterance.lang = (sentenceVoice?.lang || speechLangCode).toLowerCase();

                if (sentenceVoice) {
                    utterance.voice = sentenceVoice;
                }

                // Track start - use tracker object
                utterance.onstart = () => {
                    if (!tracker.hasStarted) {
                        tracker.hasStarted = true;
                        setStatus(`Speaking in ${friendlyName}...`);
                        console.log(`[TTS] Started speaking (${tracker.totalSentences} sentences) in ${friendlyName} (confidence ${(sentenceAnalysis.confidence * 100).toFixed(1)}%)`);
                    }
                    activeUtterancesRef.current.push(utterance);
                    setAudioDiagnostics(prev => ({
                        ...prev,
                        mode: 'tts',
                        queueSize: tracker.totalSentences - index,
                        detectedLanguage: sentenceLang,
                        languageConfidence: sentenceAnalysis.confidence,
                        lastChunkDuration: sentence.length / 12,
                        lastChunkStart: performance.now() / 1000,
                    }));
                };

                // Track completion - use tracker object to ensure accurate counting
                utterance.onend = () => {
                    tracker.completedCount++;
                    console.log(`[TTS] Completed sentence ${tracker.completedCount}/${tracker.totalSentences}: "${sentence.substring(0, Math.min(50, sentence.length))}${sentence.length > 50 ? '...' : ''}"`);

                    // Remove from active
                    const idx = activeUtterancesRef.current.indexOf(utterance);
                    if (idx > -1) {
                        activeUtterancesRef.current.splice(idx, 1);
                    }

                    setAudioDiagnostics(prev => ({
                        ...prev,
                        mode: tracker.completedCount >= tracker.totalSentences ? 'idle' : 'tts',
                        queueSize: Math.max(tracker.totalSentences - tracker.completedCount, 0),
                    }));

                    if (tracker.completedCount >= tracker.totalSentences && !tracker.isResolved) {
                        tracker.isResolved = true;
                        console.log('[TTS] All sentences completed successfully');
                        if (tracker.resolveCompletion) {
                            tracker.resolveCompletion();
                        }
                    }
                };

                utterance.onerror = (event) => {
                    console.error(`[TTS] Error in sentence ${index + 1}/${tracker.totalSentences}:`, event);
                    tracker.completedCount++;

                    const idx = activeUtterancesRef.current.indexOf(utterance);
                    if (idx > -1) {
                        activeUtterancesRef.current.splice(idx, 1);
                    }

                    setAudioDiagnostics(prev => ({
                        ...prev,
                        mode: tracker.completedCount >= tracker.totalSentences ? 'idle' : 'tts',
                        queueSize: Math.max(tracker.totalSentences - tracker.completedCount, 0),
                    }));

                    if (tracker.completedCount >= tracker.totalSentences && !tracker.isResolved) {
                        tracker.isResolved = true;
                        console.log('[TTS] All sentences processed (some had errors)');
                        if (tracker.resolveCompletion) {
                            tracker.resolveCompletion();
                        }
                    }
                };

                return utterance;
            });
                    
                    // Queue all utterances - Web Speech API handles sequential playback automatically
                    console.log(`[TTS] Queuing ${utterances.length} utterances...`);
                    
                    // Queue all utterances - the API will handle sequential playback
                    // Use a small delay between queuing to ensure proper registration
                    for (let i = 0; i < utterances.length; i++) {
                        window.speechSynthesis.speak(utterances[i]);
                        console.log(`[TTS] Queued utterance ${i + 1}/${utterances.length}`);
                        // Tiny delay to ensure proper queuing (not needed but helps with timing)
                        if (i < utterances.length - 1) {
                            await new Promise(resolve => setTimeout(resolve, 10));
                        }
                    }
                    
                    // Wait for all utterances to complete
                    await new Promise<void>((resolve) => {
                        tracker.resolveCompletion = resolve;
                        
                        // Safety timeout - resolve after reasonable time
                        // Estimate: ~10-15 seconds per sentence for longer responses
                        const avgCharsPerSentence = cleanText.length / sentences.length;
                        const secondsPerSentence = Math.max(5, Math.min(15, avgCharsPerSentence / 10));
                        const estimatedTime = (sentences.length * secondsPerSentence * 1000);
                        const timeout = Math.max(estimatedTime, 30000); // At least 30 seconds
                        
                        setTimeout(() => {
                            if (!tracker.isResolved) {
                                tracker.isResolved = true;
                                console.warn(`[TTS] Timeout: ${tracker.completedCount}/${tracker.totalSentences} utterances completed`);
                                resolve();
                            }
                        }, timeout);
                        
                        // Also check periodically as backup (though onend should fire)
                        const checkInterval = setInterval(() => {
                            if (tracker.completedCount >= tracker.totalSentences && !tracker.isResolved) {
                                tracker.isResolved = true;
                                clearInterval(checkInterval);
                                console.log('[TTS] All utterances completed (verified by interval check)');
                                resolve();
                            }
                        }, 100);
                    });
                    
                } catch (error) {
                    console.error('[TTS] Error in TTS sequence:', error);
                } finally {
                    // Ensure cleanup
                    isTTSActiveRef.current = false;
                    activeUtterancesRef.current = [];
                    setStatus('Click the microphone to speak');
                    ttsQueueRef.current = null;
                    setAudioDiagnostics(prev => ({
                        ...prev,
                        mode: 'idle',
                        queueSize: 0,
                        nextStart: 0,
                        lastChunkDuration: 0,
                    }));
                    console.log('[TTS] TTS sequence finished, cleanup complete');
                }
            })();
            
            // Store the promise so other calls can wait for it
            ttsQueueRef.current = ttsPromise;
            
            // Execute the TTS sequence (don't await here, let it run)
            ttsPromise.catch(error => {
                console.error('[TTS] Unhandled error in TTS promise:', error);
                isTTSActiveRef.current = false;
                ttsQueueRef.current = null;
                setAudioDiagnostics(prev => ({
                    ...prev,
                    mode: 'idle',
                    queueSize: 0,
                    nextStart: 0,
                    lastChunkDuration: 0,
                }));
            });
        };

        void speak();
    };

    // Helper function to generate Zephyr voice audio using Gemini (optional, falls back to TTS)
    const speakWithZephyr = async (text: string, language?: string) => {
        try {
            // Stop any ongoing AI audio playback first
            if (outputAudioContextRef.current && sourcesRef.current.size > 0) {
                sourcesRef.current.forEach(source => {
                    try {
                        source.stop();
                    } catch (e) {
                        // Ignore errors if already stopped
                    }
                });
                sourcesRef.current.clear();
                nextStartTimeRef.current = 0;
            }
            
            // Clean text - remove markdown formatting
            const cleanText = text
                .replace(/\*\*/g, '') // Remove bold markers
                .replace(/\*/g, '') // Remove italic markers
                .replace(/#{1,6}\s/g, '') // Remove headers
                .replace(/•/g, '') // Remove bullet points
                .replace(/\n/g, ' ') // Replace newlines with spaces
                .trim();
            
            if (!cleanText) return;
            
            // Get API key
            const apiKey = process.env.API_KEY || 
                          import.meta.env.VITE_API_KEY || 
                          import.meta.env.VITE_GEMINI_API_KEY ||
                          'AIzaSyABTSkPg0qPKX3aH9pOMbXtX_BQo32O8Hg';
            
            // If no API key, use TTS instead
            if (!apiKey) {
                console.warn('No API key for Zephyr voice, falling back to TTS');
                speakWithTTS(cleanText, language);
                return;
            }
            
            // Ensure audio context is ready and resumed
            if (!outputAudioContextRef.current || outputAudioContextRef.current.state === 'closed') {
                outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
            }
            
            // Resume audio context if suspended (required for playback)
            await ensureAudioContextResumed(outputAudioContextRef.current);
            
            if (!outputNodeRef.current) {
                outputNodeRef.current = outputAudioContextRef.current.createGain();
                outputNodeRef.current.connect(outputAudioContextRef.current.destination);
                outputNodeRef.current.gain.value = 1.0;
            }
            
            // Use Gemini to generate audio with Zephyr voice
            const ai = new GoogleGenAI({ apiKey });
            setStatus('Speaking...');
            
            // Create a temporary session just for audio generation
            let sessionRef: any = null;
            let isSessionClosing = false;
            let hasReceivedAudio = false;
            let didFallbackToTTS = false;
            let isTurnComplete = false; // Track turn completion across all messages

            const closeSessionSafely = () => {
                if (!isSessionClosing && sessionRef) {
                    isSessionClosing = true;
                    try {
                        if (sessionRef && typeof sessionRef.close === 'function') {
                            sessionRef.close().catch(() => {}).finally(() => {
                                sessionRef = null;
                                isSessionClosing = false;
                            });
                        } else {
                            sessionRef = null;
                            isSessionClosing = false;
                        }
                    } catch (e) {
                        console.error('Error closing session:', e);
                        sessionRef = null;
                        isSessionClosing = false;
                    }
                }
            };

            const fallbackToTTS = (reason: string) => {
                if (didFallbackToTTS) {
                    return;
                }
                didFallbackToTTS = true;
                console.warn('[Zephyr] Falling back to browser TTS:', reason);
                closeSessionSafely();
                setTimeout(() => {
                    speakWithTTS(cleanText, language);
                }, 50);
            };
            
            const tempSessionPromise = ai.live.connect({
                model: 'gemini-2.5-flash-native-audio-preview-09-2025',
                callbacks: {
                    onopen: async () => {
                        // Session is ready, send text to generate audio
                        try {
                            const session = await tempSessionPromise;
                            if (session) {
                                sessionRef = session;
                                session.sendRealtimeInput({ text: cleanText });
                            }
                        } catch (error) {
                            console.error('Error in onopen:', error);
                            setStatus('Click the microphone to speak');
                        }
                    },
                    onmessage: async (message) => {
                        const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
                        if (base64Audio) {
                            try {
                                hasReceivedAudio = true;
                                
                                // Ensure audio context is resumed before processing
                                await ensureAudioContextResumed(outputAudioContextRef.current);
                                
                                const decodedAudio = decode(base64Audio);
                                const audioBuffer = await decodeAudioData(decodedAudio, outputAudioContextRef.current, 24000, 1);
                                
                                // Calculate proper start time for seamless queuing
                                const currentTime = outputAudioContextRef.current.currentTime;
                                const startTime = Math.max(nextStartTimeRef.current, currentTime + 0.01); // Small buffer to prevent clipping
                                
                                const source = outputAudioContextRef.current.createBufferSource();
                                source.buffer = audioBuffer;
                                source.connect(outputNodeRef.current);
                                
                                source.start(startTime);
                                
                                // Update next start time with exact duration for seamless playback
                                nextStartTimeRef.current = startTime + audioBuffer.duration;
                                sourcesRef.current.add(source);
                                
                                console.log(`[Zephyr] Queued audio chunk: duration=${audioBuffer.duration.toFixed(2)}s, start=${startTime.toFixed(2)}s, end=${nextStartTimeRef.current.toFixed(2)}s, turnComplete=${isTurnComplete}`);
                                setAudioDiagnostics(prev => ({
                                    ...prev,
                                    mode: 'ai-audio',
                                    queueSize: sourcesRef.current.size,
                                    nextStart: nextStartTimeRef.current,
                                    lastChunkDuration: audioBuffer.duration,
                                    lastChunkStart: startTime,
                                }));
                                
                                source.onended = () => {
                                    sourcesRef.current.delete(source);
                                    console.log(`[Zephyr] Audio chunk finished. Remaining: ${sourcesRef.current.size}, turnComplete=${isTurnComplete}`);
                                    
                                    // Only close session and reset when all audio chunks are done AND turn is complete
                                    if (sourcesRef.current.size === 0 && isTurnComplete) {
                                        nextStartTimeRef.current = 0;
                                        setStatus('Click the microphone to speak');
                                        setAudioDiagnostics(prev => ({
                                            ...prev,
                                            mode: 'idle',
                                            queueSize: 0,
                                            nextStart: 0,
                                        }));
                                        console.log('[Zephyr] All audio chunks completed, closing session');
                                        // Small delay to ensure all audio is processed
                                        setTimeout(() => {
                                            if (sourcesRef.current.size === 0) {
                                                closeSessionSafely();
                                            }
                                        }, 100);
                                    }
                                };
                                
                            } catch (error) {
                                console.error('Error processing Zephyr audio:', error);
                                setStatus('Click the microphone to speak');
                                closeSessionSafely();
                                fallbackToTTS('Zephyr audio decode failed');
                                setAudioDiagnostics(prev => ({
                                    ...prev,
                                    mode: 'idle',
                                    queueSize: 0,
                                    nextStart: 0,
                                }));
                            }
                        }
                        
                        // Check if turn is complete - track this for all sources
                        if (message.serverContent?.turnComplete) {
                            isTurnComplete = true;
                            console.log('[Zephyr] Turn complete signal received');
                            if (!hasReceivedAudio) {
                                // No audio chunks arrived, fallback quickly
                                setTimeout(() => {
                                    if (!hasReceivedAudio && sourcesRef.current.size === 0) {
                                        fallbackToTTS('Zephyr returned turnComplete without audio');
                                    }
                                }, 150);
                            } else if (sourcesRef.current.size === 0) {
                                // All audio already finished, close immediately
                                console.log('[Zephyr] Turn complete and all audio finished, closing session');
                                nextStartTimeRef.current = 0;
                                setStatus('Click the microphone to speak');
                                closeSessionSafely();
                            } else {
                                // Mark that turn is complete, but let audio finish playing
                                // The session will close when all audio sources finish (in onended handler)
                                console.log(`[Zephyr] Turn complete, waiting for ${sourcesRef.current.size} audio chunks to finish...`);
                            }
                        }
                    },
                    onerror: (e) => {
                        console.error('Zephyr audio generation error:', e);
                        setStatus('Click the microphone to speak');
                        closeSessionSafely();
                        fallbackToTTS('Zephyr onerror');
                    },
                    onclose: () => {
                        sessionRef = null;
                        isSessionClosing = false;
                        if (!hasReceivedAudio && !didFallbackToTTS) {
                            fallbackToTTS('Zephyr session closed without audio');
                        }
                    }
                },
                config: {
                    responseModalities: [Modality.AUDIO],
                    speechConfig: { 
                        voiceConfig: { 
                            prebuiltVoiceConfig: { 
                                voiceName: 'Zephyr'
                            } 
                        } 
                    },
                    systemInstruction: `You are Clara, a friendly AI receptionist. Speak naturally and clearly. ${language ? `Respond in ${language === 'te' ? 'Telugu' : language === 'hi' ? 'Hindi' : language === 'ta' ? 'Tamil' : language === 'kn' ? 'Kannada' : language === 'ml' ? 'Malayalam' : 'English'}.` : ''}`,
                },
            });
            
        } catch (error) {
            console.error('Error in Zephyr voice generation:', error);
            setStatus('Click the microphone to speak');
            speakWithTTS(text, language);
        }
    };

    // Helper function to call College AI API (silent, no error messages)
    const callCollegeAI = async (query: string, sessionId: string): Promise<string> => {
        try {
            const apiBase = import.meta.env.VITE_API_BASE || 'http://localhost:8080';
            const response = await fetch(`${apiBase}/api/college/ask`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: query,
                    sessionId: sessionId || 'client-' + Date.now(),
                    name: preChatDetailsRef.current?.name,
                    email: preChatDetailsRef.current?.phone // Using phone as contact
                })
            });
            
            if (!response.ok) {
                // Silently fallback - don't show error to user
                console.error('College AI API error:', response.statusText);
                return 'I don\'t have that information available right now. Could you please rephrase your question?';
            }
            
            const data = await response.json();
            return data.response || data.message || 'I don\'t have that information available right now. Could you please rephrase your question?';
        } catch (error: any) {
            // Silently handle errors - don't show technical error messages
            console.error('College AI API error:', error);
            return 'I don\'t have that information available right now. Could you please rephrase your question?';
        }
    };

    // Helper function to create message handler
    const createMessageHandler = () => {
        return async (message) => {
            // Early return if we're processing a college query - ignore all AI messages
            // Use ref for immediate check (state updates are async)
            if (isCollegeQueryActive || isCollegeQueryActiveRef.current) {
                return; // Don't process any AI messages while college query is active
            }
            
            // Handle tool calls first
            if (message.toolCall) {
                for (const fc of message.toolCall.functionCalls) {
                    if (fc.name === 'initiateVideoCall') {
                        // Check if in demo mode
                        if (isDemoMode) {
                            const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                            setMessages(prev => [...prev, { sender: 'clara', text: 'Video calls are not available in demo mode. Please configure an API key to enable video calling.', isFinal: true, timestamp }]);
                            return;
                        }
                        
                        // Always use the selected staff from preChatDetailsRef (mandatory selection)
                        // This ensures calls only go to the staff member selected in the dropdown
                        const selectedStaffShortName = preChatDetailsRef.current?.staffShortName;
                        if (!selectedStaffShortName) {
                            const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                            setMessages(prev => [...prev, { sender: 'clara', text: 'Please select a staff member first to initiate a call.', isFinal: true, timestamp }]);
                            return;
                        }
                        
                        // Use the manual call initiation function which handles all the routing and confirmation messages
                        stopRecording(true);
                        await handleManualCallInitiation();
                        
                        // Send tool response to Gemini
                        if (sessionPromiseRef.current) {
                            sessionPromiseRef.current.then((session) => {
                                if (session) {
                                    session.sendToolResponse({
                                        functionResponses: { id: fc.id, name: fc.name, response: { result: "Video call initiated successfully." } }
                                    });
                                }
                            }).catch((err) => {
                                console.error('Error sending tool response:', err);
                                // Silently handle - don't show error to user
                            });
                        }
                    }
                }
                return;
            }

            // Handle real-time transcription updates (user) – accumulate full text
            if (message.serverContent?.inputTranscription) {
                const newText = message.serverContent.inputTranscription.text || '';
                inputAccumRef.current = appendDelta(inputAccumRef.current, newText);
                
                // Detect language from user input and update state
                if (newText) {
                    const languageAnalysis = analyzeLanguage(inputAccumRef.current, detectedLanguageRef.current, detectedLanguageRef.current);
                    const detectedLang = languageAnalysis.lang;
                    if (detectedLang !== detectedLanguage) {
                        setDetectedLanguage(detectedLang);
                        console.log(`[Language] Detected language: ${detectedLang} (confidence ${(languageAnalysis.confidence * 100).toFixed(1)}%)`);
                    }
                    setAudioDiagnostics(prev => ({
                        ...prev,
                        detectedLanguage: detectedLang,
                        languageConfidence: languageAnalysis.confidence,
                    }));
                }
                // Update or create user message in real-time
                setMessages(prev => {
                    let lastUserMsgIndex = -1;
                    for (let i = prev.length - 1; i >= 0; i--) {
                        if (prev[i].sender === 'user' && !prev[i].isFinal) {
                            lastUserMsgIndex = i;
                            break;
                        }
                    }
                    if (lastUserMsgIndex >= 0) {
                        const updated = [...prev];
                        updated[lastUserMsgIndex] = {
                            ...updated[lastUserMsgIndex],
                            text: inputAccumRef.current,
                            isFinal: false,
                            timestamp: updated[lastUserMsgIndex].timestamp || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        };
                        return updated;
                    }
                    return [...prev, {
                        sender: 'user',
                        text: inputAccumRef.current,
                        isFinal: false,
                        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    }];
                });
            }

            // Handle output transcription (Clara) – accumulate full text
            // Skip if this is a college query (we'll use College AI instead)
            // Skip if college query is active
            if (message.serverContent?.outputTranscription && !isCollegeQueryActive && !isCollegeQueryActiveRef.current) {
                const newText = message.serverContent.outputTranscription.text || '';
                outputAccumRef.current = appendDelta(outputAccumRef.current, newText);
                setMessages(prev => {
                    let lastClaraMsgIndex = -1;
                    for (let i = prev.length - 1; i >= 0; i--) {
                        if (prev[i].sender === 'clara' && !prev[i].isFinal && !prev[i].isCollegeAI) {
                            lastClaraMsgIndex = i;
                            break;
                        }
                    }
                    if (lastClaraMsgIndex >= 0) {
                        const updated = [...prev];
                        updated[lastClaraMsgIndex] = {
                            ...updated[lastClaraMsgIndex],
                            text: outputAccumRef.current,
                            isFinal: false,
                            timestamp: updated[lastClaraMsgIndex].timestamp || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        };
                        return updated;
                    }
                    return [...prev, {
                        sender: 'clara',
                        text: outputAccumRef.current,
                        isFinal: false,
                        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    }];
                });
            }

            // Handle turn completion - finalize messages and flush accumulators
            if (message.serverContent?.turnComplete) {
                setMessages(prev => {
                    const updated = [...prev];
                    // Finalize last user message
                    let lastUserIndex = -1;
                    for (let i = updated.length - 1; i >= 0; i--) {
                        if (updated[i].sender === 'user' && !updated[i].isFinal) { lastUserIndex = i; break; }
                    }
                    if (lastUserIndex >= 0) {
                        const userText = inputAccumRef.current || updated[lastUserIndex].text;
                        updated[lastUserIndex] = { ...updated[lastUserIndex], text: userText, isFinal: true };
                        
                        // Detect and update language from user input
                        const languageAnalysis = analyzeLanguage(userText, detectedLanguageRef.current, detectedLanguageRef.current);
                        const detectedLang = languageAnalysis.lang;
                        if (detectedLang !== detectedLanguage) {
                            setDetectedLanguage(detectedLang);
                            console.log(`[Language] Detected language from final input: ${detectedLang} (confidence ${(languageAnalysis.confidence * 100).toFixed(1)}%)`);
                        }
                        setAudioDiagnostics(prev => ({
                            ...prev,
                            detectedLanguage: detectedLang,
                            languageConfidence: languageAnalysis.confidence,
                        }));
                        
                        // Check if this is a college-related query - if so, use College AI silently
                        if (isCollegeQuery(userText)) {
                            // Set flag immediately using ref (state updates are async)
                            isCollegeQueryActiveRef.current = true;
                            setIsCollegeQueryActive(true);
                            
                            // College query mode enabled
                            
                            // Stop any ongoing AI audio immediately (before response arrives)
                            if (outputAudioContextRef.current && sourcesRef.current.size > 0) {
                                sourcesRef.current.forEach(source => {
                                    try {
                                        source.stop();
                                    } catch (e) {
                                        // Ignore errors
                                    }
                                });
                                sourcesRef.current.clear();
                                nextStartTimeRef.current = 0;
                            }
                            
                            // Stop any ongoing AI session immediately
                            if (sessionPromiseRef.current) {
                                try {
                                    const currentSessionPromise = sessionPromiseRef.current;
                                    sessionPromiseRef.current = null; // Clear immediately to prevent new messages
                                    currentSessionPromise.then(session => {
                                        if (session && typeof session.close === 'function') {
                                            session.close().catch(() => {}); // Silently close
                                        }
                                    }).catch(() => {});
                                } catch (e) {
                                    // Ignore errors
                                }
                            }
                            
                            // Stop recording if active
                            if (isRecordingRef.current) {
                                stopRecording(false);
                            }
                            
                            const sessionId = localStorage.getItem('clara-client-id') || 'client-' + Date.now();
                            
                            // Call College AI API silently (no announcements)
                            callCollegeAI(userText, sessionId).then(collegeResponse => {
                                // Stop any ongoing AI audio immediately before TTS
                                if (outputAudioContextRef.current && sourcesRef.current.size > 0) {
                                    sourcesRef.current.forEach(source => {
                                        try {
                                            source.stop();
                                        } catch (e) {
                                            // Ignore errors
                                        }
                                    });
                                    sourcesRef.current.clear();
                                    nextStartTimeRef.current = 0;
                                }
                                
                                const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                                setMessages(prevMessages => {
                                    // Remove any incomplete Clara message and add College AI response
                                    const filtered = prevMessages.filter((msg, idx) => 
                                        !(idx === prevMessages.length - 1 && msg.sender === 'clara' && !msg.isFinal)
                                    );
                                    return [...filtered, {
                                        sender: 'clara',
                                        text: collegeResponse,
                                        isFinal: true,
                                        timestamp,
                                        isCollegeAI: true // Mark as College AI response
                                    }];
                                });
                                
                                // Use TTS to read the College AI response
                                // Detect language from AI response text (prioritize response language)
                                const responseAnalysis = analyzeLanguage(collegeResponse, detectedLanguageRef.current, detectedLanguageRef.current);
                                const userAnalysis = analyzeLanguage(userText, responseAnalysis.lang, detectedLanguageRef.current);
                                const finalLang = responseAnalysis.lang !== 'en'
                                    ? responseAnalysis.lang
                                    : (userAnalysis.lang !== 'en' ? userAnalysis.lang : (detectedLanguageRef.current || 'en'));
                                console.log(`[Language] College AI response language: ${finalLang} (response: ${responseAnalysis.lang} ${(responseAnalysis.confidence * 100).toFixed(1)}%, user: ${userAnalysis.lang})`);
                                setAudioDiagnostics(prev => ({
                                    ...prev,
                                    detectedLanguage: finalLang,
                                    languageConfidence: responseAnalysis.confidence,
                                }));
                                speakWithTTS(collegeResponse, finalLang);
                                
                                setStatus('Click the microphone to speak');
                                // Reset flags after response
                                isCollegeQueryActiveRef.current = false;
                                setIsCollegeQueryActive(false);
                            }).catch(error => {
                                // Silently handle errors - show a simple message
                                console.error('College AI error:', error);
                                const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                                setMessages(prevMessages => {
                                    const filtered = prevMessages.filter((msg, idx) => 
                                        !(idx === prevMessages.length - 1 && msg.sender === 'clara' && !msg.isFinal)
                                    );
                                    return [...filtered, {
                                        sender: 'clara',
                                        text: 'I don\'t have that information available right now. Could you please rephrase your question?',
                                        isFinal: true,
                                        timestamp
                                    }];
                                });
                                // Reset flags on error
                                isCollegeQueryActiveRef.current = false;
                                setIsCollegeQueryActive(false);
                            });
                            
                            // Clear accumulators
                            inputAccumRef.current = '';
                            outputAccumRef.current = '';
                            
                            // Don't process Gemini response for college queries
                            return updated;
                        } else {
                            // Not a college query - reset flags
                            isCollegeQueryActiveRef.current = false;
                            setIsCollegeQueryActive(false);
                        }
                        
                        // Check for location queries in user message
                        const locationResult = locationMatcher.extractLocationIntent(userText);
                        if (locationResult.location && locationResult.intent === 'navigate') {
                            const location = locationResult.location;
                            const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                            const responseText = `Here is how to reach the ${location.name} from the main entrance.`;
                            
                            setCurrentLocation(location);
                            setCurrentFloor(location.floor);
                            
                            updated.push({
                                sender: 'clara',
                                text: responseText,
                                isFinal: true,
                                timestamp,
                                locationData: location,
                                locationCard: { location }
                            });
                        }
                    }
                    // Finalize last Clara message (only if not a college query)
                    let lastClaraIndex = -1;
                    for (let i = updated.length - 1; i >= 0; i--) {
                        if (updated[i].sender === 'clara' && !updated[i].isFinal && !updated[i].isCollegeAI) { 
                            lastClaraIndex = i; 
                            break; 
                        }
                    }
                    if (lastClaraIndex >= 0) {
                        updated[lastClaraIndex] = { ...updated[lastClaraIndex], text: outputAccumRef.current || updated[lastClaraIndex].text, isFinal: true };
                    }
                    return updated;
                });
                // clear for next turn
                inputAccumRef.current = '';
                outputAccumRef.current = '';

                // Check when audio playback is done and reset status
                const checkPlaybackAndReset = () => {
                    const isPlaying = nextStartTimeRef.current > outputAudioContextRef.current.currentTime;
                    if (sourcesRef.current.size === 0 && !isPlaying) {
                        setStatus('Click the microphone to speak');
                    } else {
                        setTimeout(checkPlaybackAndReset, 100);
                    }
                };
                setTimeout(checkPlaybackAndReset, 50);
            }

            // Handle audio playback - process immediately without delay
            // PERMANENT FIX: Allow AI audio chunks to queue sequentially from the same response stream
            // Only skip if: College query (uses TTS) or TTS is actively speaking (different audio system)
            // DO NOT block AI audio chunks - they queue automatically via nextStartTimeRef scheduling
            const base64EncodedAudioString = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            const isTTSActive = window.speechSynthesis && (window.speechSynthesis.speaking || window.speechSynthesis.pending);
            
            // Play AI audio if available and not in demo mode
            // CRITICAL: Removed hasActiveAudio check - allows sequential queuing of chunks from same stream
            if (base64EncodedAudioString && !isDemoMode && !isCollegeQueryActive && !isCollegeQueryActiveRef.current && !isTTSActive) {
                setStatus('Responding...');
                
                try {
                    // Ensure audio context is resumed before processing
                    await ensureAudioContextResumed(outputAudioContextRef.current);
                    
                    const decodedAudio = decode(base64EncodedAudioString);
                    const audioBuffer = await decodeAudioData(decodedAudio, outputAudioContextRef.current, 24000, 1);

                    // Calculate proper start time for seamless sequential queuing
                    // nextStartTimeRef automatically schedules after previous chunks (if any)
                    const currentTime = outputAudioContextRef.current.currentTime;
                    const startTime = Math.max(nextStartTimeRef.current, currentTime + 0.01);
                    
                    const source = outputAudioContextRef.current.createBufferSource();
                    source.buffer = audioBuffer;
                    source.connect(outputNodeRef.current);
                    source.start(startTime);
                    
                    // Update next start time for next chunk in sequence
                    nextStartTimeRef.current = startTime + audioBuffer.duration;
                    
                    sourcesRef.current.add(source);
                    console.log(`[AI Audio] Queued chunk ${sourcesRef.current.size}: duration=${audioBuffer.duration.toFixed(2)}s, start=${startTime.toFixed(2)}s, end=${nextStartTimeRef.current.toFixed(2)}s`);
                    setAudioDiagnostics(prev => ({
                        ...prev,
                        mode: 'ai-audio',
                        queueSize: sourcesRef.current.size,
                        nextStart: nextStartTimeRef.current,
                        lastChunkDuration: audioBuffer.duration,
                        lastChunkStart: startTime,
                    }));
                    
                    source.onended = () => {
                        sourcesRef.current.delete(source);
                        console.log(`[AI Audio] Chunk finished. Remaining in queue: ${sourcesRef.current.size}`);
                        // Only reset when ALL chunks from this response are done
                        if (sourcesRef.current.size === 0) {
                            // Small delay to ensure all cleanup completes before reset
                            setTimeout(() => {
                                if (sourcesRef.current.size === 0) {
                                    nextStartTimeRef.current = 0;
                                    console.log('[AI Audio] All chunks completed, queue cleared');
                                    setAudioDiagnostics(prev => ({
                                        ...prev,
                                        mode: 'idle',
                                        queueSize: 0,
                                        nextStart: 0,
                                        lastChunkDuration: 0,
                                    }));
                                }
                            }, 50);
                        } else {
                            setAudioDiagnostics(prev => ({
                                ...prev,
                                queueSize: sourcesRef.current.size,
                                nextStart: nextStartTimeRef.current,
                            }));
                        }
                    };
                    
                } catch (error) {
                    console.error('Error processing audio chunk:', error);
                    setAudioDiagnostics(prev => ({
                        ...prev,
                        mode: 'idle',
                        queueSize: 0,
                        nextStart: 0,
                    }));
                }
            } else if (isCollegeQueryActive || isCollegeQueryActiveRef.current) {
                // College queries use TTS, not AI audio
                console.log('Skipping AI audio - College query (uses TTS)');
            } else if (isTTSActive) {
                // TTS is speaking - don't mix with AI audio (different audio system)
                console.log('Skipping AI audio - TTS is currently speaking');
                if (!isRecordingRef.current) {
                    setStatus('Click the microphone to speak');
                }
            } else if (message.serverContent?.turnComplete && outputAccumRef.current && !isCollegeQueryActive && !isCollegeQueryActiveRef.current) {
                // Turn complete but no AI audio received - use TTS fallback
                // Wait for any queued audio chunks to finish first
                const waitForAudioAndSpeak = async () => {
                    // Wait for all audio chunks to finish
                    let waitCount = 0;
                    while (sourcesRef.current.size > 0 && waitCount < 100) {
                        await new Promise(resolve => setTimeout(resolve, 100));
                        waitCount++;
                    }
                    
                    // Wait for TTS to finish (shouldn't be active, but safety check)
                    waitCount = 0;
                    while ((window.speechSynthesis.speaking || window.speechSynthesis.pending) && waitCount < 50) {
                        await new Promise(resolve => setTimeout(resolve, 100));
                        waitCount++;
                    }
                    
                    const responseText = outputAccumRef.current?.trim() || '';
                    if (responseText && !isCollegeQueryActive && !isCollegeQueryActiveRef.current) {
                        console.log('[TTS] Using TTS fallback (no AI audio received)');
                        const responseAnalysis = analyzeLanguage(responseText, detectedLanguageRef.current, detectedLanguageRef.current);
                        const finalLang = responseAnalysis.lang !== 'en' ? responseAnalysis.lang : (detectedLanguageRef.current || 'en');
                        console.log(`[Language] TTS language: ${finalLang} (response: ${responseAnalysis.lang} ${(responseAnalysis.confidence * 100).toFixed(1)}%, user: ${detectedLanguageRef.current})`);
                        setAudioDiagnostics(prev => ({
                            ...prev,
                            detectedLanguage: finalLang,
                            languageConfidence: responseAnalysis.confidence,
                        }));
                        speakWithTTS(responseText, finalLang);
                    }
                };
                
                void waitForAudioAndSpeak();
            }
        };
    };

    // Helper function to initialize session
    const initializeSession = async (shouldGreet = false) => {
        // Simple check - if session exists, reuse it
        if (sessionPromiseRef.current) {
            return;
        }

        // Try multiple ways to get the API key
        const apiKey = process.env.API_KEY || 
                      import.meta.env.VITE_API_KEY || 
                      import.meta.env.VITE_GEMINI_API_KEY ||
                      'AIzaSyABTSkPg0qPKX3aH9pOMbXtX_BQo32O8Hg';
        
        // Check if we're in demo mode (only if no API key at all, not if using fallback)
        const hasValidApiKey = apiKey && apiKey.trim() !== '' && apiKey !== 'undefined';
        if (!hasValidApiKey) {
            console.warn('API Key not found, entering demo mode');
            setIsDemoMode(true);
            // In demo mode, show a message but don't initialize session
            if (shouldGreet) {
                const greetingText = preChatDetailsRef.current?.name 
                    ? `Hi ${preChatDetailsRef.current.name}! I'm Clara, your friendly AI receptionist! I'm so excited to help you today! How can I assist you?`
                    : "Hi there! I'm Clara, your friendly AI receptionist! I'm so excited to help you today! How can I assist you?";
                setMessages([{ sender: 'clara', text: greetingText, isFinal: true, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }]);
                setStatus('Demo mode: Click the microphone to speak or use the demo call button.');
            }
            return;
        } else {
            setIsDemoMode(false);
        }
        
        console.log('Using API Key:', apiKey.substring(0, 10) + '...');
        const ai = new GoogleGenAI({ apiKey });
        
        if (!outputAudioContextRef.current || outputAudioContextRef.current.state === 'closed') {
            outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        }
        
        // Ensure audio context is resumed (required for playback)
        await ensureAudioContextResumed(outputAudioContextRef.current);
        
        if (!outputNodeRef.current) {
            outputNodeRef.current = outputAudioContextRef.current.createGain();
            outputNodeRef.current.connect(outputAudioContextRef.current.destination);
            outputNodeRef.current.gain.value = 1.0;
        }

        const { name, purpose, staffShortName } = preChatDetailsRef.current || {};
        const selectedStaff = staffList.find(s => s.shortName === staffShortName);
        const staffHint = selectedStaff ? `${selectedStaff.name} (${selectedStaff.shortName})` : 'Not specified';
        
        // Detect current language from recent user messages
        const recentUserMessages = messages.filter(m => m.sender === 'user').slice(-3);
        const allUserText = recentUserMessages.map(m => m.text).join(' ') || '';
        const languageSource = allUserText || inputAccumRef.current || '';
        const languageAnalysis = analyzeLanguage(languageSource, detectedLanguageRef.current, detectedLanguageRef.current);
        const currentLang = languageAnalysis.lang;
        if (currentLang !== detectedLanguage && currentLang !== 'en') {
            setDetectedLanguage(currentLang);
            setAudioDiagnostics(prev => ({
                ...prev,
                detectedLanguage: currentLang,
                languageConfidence: languageAnalysis.confidence,
            }));
        }
        
        const systemInstruction = `**PRIMARY DIRECTIVE: You MUST detect the user's language and respond ONLY in that same language. This is a strict requirement.**

You are CLARA, the official, friendly, and professional AI receptionist for Sai Vidya Institute of Technology (SVIT). Your goal is to assist users efficiently. Keep your spoken responses concise and to the point to ensure a fast, smooth conversation.

**LANGUAGE DETECTION:** Always respond in the same language the user uses. If the user speaks in Telugu, respond in Telugu. If they speak in Hindi, respond in Hindi. If they speak in English, respond in English. Match their language exactly.

**IMPORTANT: College Query Detection**
- If the user asks about college-related topics (admissions, fees, departments, faculty, placements, events, campus, courses, etc.), the system will automatically route to College AI for detailed information.
- For non-college queries, continue with normal AI assistance.

**Caller Information (Context):**
- Name: ${name || 'Unknown'}
- Stated Purpose: ${purpose || 'Not specified'}
- Staff to connect with: ${staffHint}

**Your Capabilities & Rules:**
1.  **Staff Knowledge:** You know the following staff members. Use this map to identify them if mentioned:
    - LDN: Prof. Lakshmi Durga N
    - ACS: Prof. Anitha C S
    - GD: Dr. G Dhivyasri
    - NSK: Prof. Nisha S K
    - ABP: Prof. Amarnath B Patil
    - NN: Dr. Nagashree N
    - AKV: Prof. Anil Kumar K V
    - JK: Prof. Jyoti Kumari
    - VR: Prof. Vidyashree R
    - BA: Dr. Bhavana A
    - BTN: Prof. Bhavya T N
2.  **College Information:** For detailed college information (admissions, fees, departments, etc.), the system will automatically switch to College AI to provide comprehensive answers.
3.  **Actions:**
    - If the user expresses a clear intent to start a video call or meet with a specific staff member (e.g., 'call Anitha', 'I want to see Prof. Lakshmi'), you MUST use the \`initiateVideoCall\` tool. Do not just confirm; use the tool directly.
    - If asked about schedules or availability, offer to check.
4.  **General Queries:** For topics outside of SVIT, act as a helpful general AI assistant.
5.  **Tone:** Always be polite, professional, and helpful.`;
        
        const messageHandler = createMessageHandler();
        
        sessionPromiseRef.current = ai.live.connect({
            model: 'gemini-2.5-flash-native-audio-preview-09-2025',
            callbacks: {
                onopen: async () => {
                    setStatus('Clara is ready!');
                    
                    // Send greeting if requested
                    if (shouldGreet) {
                        const greetingText = name 
                            ? `Hi ${name}! I'm Clara, your friendly AI receptionist! I'm so excited to help you today! How can I assist you?`
                            : "Hi there! I'm Clara, your friendly AI receptionist! I'm so excited to help you today! How can I assist you?";
                        
                        try {
                            if (sessionPromiseRef.current) {
                                const session = await sessionPromiseRef.current;
                                // Send as text input to trigger audio response
                                if (session) {
                                    session.sendRealtimeInput({ text: greetingText });
                                }
                            } else {
                                // Fallback to text message if session not ready
                                setMessages([{ sender: 'clara', text: greetingText, isFinal: true, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }]);
                            }
                        } catch (error) {
                            console.error('Error sending greeting:', error);
                            // Fallback to text message - silently handle error
                            setMessages([{ sender: 'clara', text: greetingText, isFinal: true, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }]);
                        }
                    }
                },
                onmessage: messageHandler,
                onerror: (e) => {
                    console.error('[Session] Error:', e);
                    // Don't close session on error - try to recover
                    setStatus(`Error: ${e.message}. Please try speaking again.`);
                    // Only close if it's a critical error
                    if (e.message?.includes('closed') || e.message?.includes('disconnected')) {
                        stopRecording(true);
                    } else {
                        // For other errors, keep session alive and let user retry
                        stopRecording(false);
                    }
                },
                onclose: () => {
                    // Session closed - clear reference so it can be recreated on next mic click
                    console.log('[Session] Session closed, will be recreated on next mic click');
                    sessionPromiseRef.current = null;
                    // Don't show error - user can click mic to reconnect
                    if (!isRecordingRef.current) {
                        setStatus('Click the microphone to speak');
                    }
                },
            },
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: { 
                    voiceConfig: { 
                        prebuiltVoiceConfig: { 
                            voiceName: 'Zephyr'
                        } 
                    } 
                },
                systemInstruction: systemInstruction,
                inputAudioTranscription: {},
                outputAudioTranscription: {},
                tools: [{ functionDeclarations: [initiateVideoCallFunction] }],
            },
        });
    };

    const handleStartConversation = async (details) => {
        setPreChatDetails(details);
        // Immediately update ref so it's available synchronously before initializeSession
        preChatDetailsRef.current = details;
        setShowPreChatModal(false);
        
        // Initialize session and send greeting
        try {
            await initializeSession(true); // true = send greeting
        } catch (error) {
            console.error('Error initializing greeting:', error);
            // Fallback to text greeting if audio fails
            const welcomeText = details.name 
                ? `Hi ${details.name}! I'm Clara, your friendly AI receptionist! I'm so excited to help you today! How can I assist you?` 
                : "Hi there! I'm Clara, your friendly AI receptionist! I'm so excited to help you today! How can I assist you?";
            setMessages([{ sender: 'clara', text: welcomeText, isFinal: true, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }]);
        }
    };

    const handleEndCall = () => {
        const staffName = videoCallTarget?.name || 'Staff';
        finalizeCallSession(`Video call with ${staffName} ended. How can I assist you further?`, { notifyServer: true, showSummary: true });
    };

    const handleMicClick = async () => {
        if (isRecordingRef.current) {
            stopRecording(false);
            setStatus('Processing...');
            return;
        }

        // Initialize session if it doesn't exist or verify it's still valid
        let sessionValid = false;
        if (sessionPromiseRef.current) {
            try {
                const session = await sessionPromiseRef.current;
                // Check if session is still open and functional
                if (session && typeof session.sendRealtimeInput === 'function') {
                    sessionValid = true;
                    console.log('[Mic] Using existing session for voice recognition');
                }
            } catch (error) {
                console.log('[Mic] Session check failed, will reinitialize:', error);
                sessionPromiseRef.current = null;
            }
        }

        if (!sessionValid) {
            try {
                console.log('[Mic] Initializing new session for voice recognition...');
                await initializeSession(false);
            } catch (error) {
                console.error('[Mic] Failed to initialize session:', error);
                setStatus('Failed to connect. Please try again.');
                return;
            }
        }
        
        isRecordingRef.current = true;
        setIsRecording(true);
        setStatus('Listening...');

        try {
            console.log('[Mic] Starting audio capture...');
            
            if (!inputAudioContextRef.current || inputAudioContextRef.current.state === 'closed') {
                inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
                console.log('[Mic] Created new audio context');
            }

            console.log('[Mic] Requesting microphone access...');
            streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
            console.log('[Mic] Microphone access granted, setting up audio processing...');
            mediaStreamSourceRef.current = inputAudioContextRef.current.createMediaStreamSource(streamRef.current);
            
            // Use AnalyserNode for silence detection (no deprecation warnings)
            analyserRef.current = inputAudioContextRef.current.createAnalyser();
            analyserRef.current.fftSize = 2048;
            analyserRef.current.smoothingTimeConstant = 0.8;
            mediaStreamSourceRef.current.connect(analyserRef.current);
            
            const bufferLength = analyserRef.current.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);
            
            const calculateRMS = () => {
                analyserRef.current.getByteTimeDomainData(dataArray);
                let sum = 0;
                for (let i = 0; i < dataArray.length; i++) {
                    const normalized = (dataArray[i] - 128) / 128;
                    sum += normalized * normalized;
                }
                return Math.sqrt(sum / dataArray.length);
            };
            
            silenceStartRef.current = null;
            
            await ensureAudioWorkletModule(inputAudioContextRef.current);
            audioProcessorNodeRef.current = new AudioWorkletNode(inputAudioContextRef.current, 'pcm-processor', {
                numberOfInputs: 1,
                numberOfOutputs: 0,
                channelCount: 1,
            });
            
            audioProcessorNodeRef.current.port.onmessage = (event: MessageEvent) => {
                if (!isRecordingRef.current) return;
                
                const inputData = event.data as Float32Array;
                const pcmBlob = createBlob(inputData);
                
                if (sessionPromiseRef.current) {
                    sessionPromiseRef.current
                        .then((session) => {
                            if (session && typeof session.sendRealtimeInput === 'function') {
                                try {
                                    session.sendRealtimeInput({ media: pcmBlob });
                                    if (Math.random() < 0.01) {
                                        console.log('[Audio] Successfully sending audio input to session');
                                    }
                                } catch (err) {
                                    if (err && err.message && !err.message.includes('closed')) {
                                        console.error('[Audio] Error sending audio input:', err);
                                    }
                                }
                            } else if (Math.random() < 0.1) {
                                console.warn('[Audio] Session is not available or sendRealtimeInput not available');
                            }
                        })
                        .catch(err => {
                            if (err && err.message && !err.message.includes('closed')) {
                                console.error('[Audio] Session promise error:', err);
                            }
                        });
                } else if (Math.random() < 0.1) {
                    console.warn('[Audio] No session available to send audio input - session may need to be reinitialized');
                }
            };
            
            mediaStreamSourceRef.current.connect(audioProcessorNodeRef.current);
            
            // Monitor silence using AnalyserNode (separate from audio capture to reduce warnings)
            const checkSilence = () => {
                if (!isRecordingRef.current) return;
                
                const volume = calculateRMS();
                const SILENCE_THRESHOLD = 0.01;
                const SPEECH_TIMEOUT = 2000; // Increased to 2 seconds to allow for natural pauses

                if (volume > SILENCE_THRESHOLD) {
                    // Speech detected - reset silence timer
                    if (silenceStartRef.current !== null) {
                        console.log('[Audio] Speech detected, resetting silence timer');
                    }
                    silenceStartRef.current = null;
                } else {
                    // Silence detected
                    if (silenceStartRef.current === null) {
                        silenceStartRef.current = Date.now();
                    } else {
                        const silenceDuration = Date.now() - silenceStartRef.current;
                        if (silenceDuration > SPEECH_TIMEOUT) {
                            console.log('[Audio] Silence timeout reached, stopping recording');
                            if (isRecordingRef.current) {
                                stopRecording(false);
                                return;
                            }
                        }
                    }
                }
                
                requestAnimationFrame(checkSilence);
            };
            
            checkSilence();

        } catch (error) {
            console.error('Error starting recording:', error);
            setStatus(`Error: ${error.message}`);
            isRecordingRef.current = false;
            setIsRecording(false);
        }
    };
    
    const handleWelcomeStart = () => {
        setShowWelcomeScreen(false);
        setShowPreChatModal(true);
    };

    const renderContent = () => {
        if (showWelcomeScreen) {
            return <WelcomeScreen onStartConversation={handleWelcomeStart} />;
        }
        if (showPreChatModal) {
            return <PreChatModal onStart={handleStartConversation} />;
        }
        if (view === 'video_call' && videoCallTarget && activeCall) {
            console.log('[Client] Rendering video call view');
            console.log('[Client] activeCall:', activeCall);
            console.log('[Client] unifiedCallService:', !!unifiedCallService);
            
            // Get latest call data from CallService
            const callData = unifiedCallService?.getActiveCall(activeCall.callId);
            console.log('[Client] callData from service:', callData);
            
            const webrtcCall = callData ? {
                pc: callData.pc,
                stream: callData.stream,
                remoteStream: callData.remoteStream,
            } : (activeCall.pc ? {
                pc: activeCall.pc,
                stream: activeCall.stream!,
                remoteStream: activeCall.remoteStream || null,
            } : null);
            
            console.log('[Client] webrtcCall:', webrtcCall);
            
            // Use new CallRoom component if callStore is in_call, otherwise use old WebRTCVideoCall for compatibility
            if (callStore.state === 'in_call' && callStore.callData.localStream) {
                console.log('[Client] Rendering new CallRoom component');
                return (
                    <>
                        <CallRoom onEndCall={handleEndCall} />
                        {toast && (
                            <CallToast
                                type={toast.type}
                                message={toast.message}
                                onDismiss={() => setToast(null)}
                                duration={3000}
                            />
                        )}
                    </>
                );
            } else if (webrtcCall && webrtcCall.pc) {
                console.log('[Client] Rendering WebRTCVideoCall component (legacy)');
                return (
                    <>
                        <WebRTCVideoCall
                            callId={activeCall.callId}
                            staffName={videoCallTarget.name}
                            onEndCall={handleEndCall}
                            activeCall={webrtcCall}
                            onRemoteStreamUpdate={(remoteStream) => {
                                console.log('[Client] Remote stream updated in WebRTCVideoCall');
                                // Update activeCall state when remote stream arrives
                                setActiveCall(prev => prev ? {
                                    ...prev,
                                    remoteStream,
                                } : null);
                                // Also update in CallService
                                if (unifiedCallService) {
                                    const callData = unifiedCallService.getActiveCall(activeCall.callId);
                                    if (callData) {
                                        callData.remoteStream = remoteStream;
                                    }
                                }
                                // Update callStore
                                callStore.setInCall({ remoteStream });
                            }}
                        />
                        {toast && (
                            <CallToast
                                type={toast.type}
                                message={toast.message}
                                onDismiss={() => setToast(null)}
                                duration={3000}
                            />
                        )}
                    </>
                );
            }
            // Fallback: show connecting message
            console.log('[Client] No webrtcCall yet, showing connecting message');
            return (
                <div className="fixed inset-0 bg-black z-50 flex items-center justify-center">
                    <div className="text-white text-xl">Connecting to {videoCallTarget.name}...</div>
                    <div className="text-white text-sm mt-4">Call ID: {activeCall.callId}</div>
                </div>
            );
        }
        return (
            <>
                {/* Device Permission Prompt */}
                <DevicePermissionPrompt
                    visible={showPermissionPrompt}
                    onPermissionsGranted={handlePermissionGranted}
                    onCancel={() => {
                        setShowPermissionPrompt(false);
                        callStore.reset();
                        setPendingCallStaff(null);
                    }}
                />
                {/* Call End Summary */}
                <CallEndSummary
                    visible={showEndSummary}
                    onClose={() => {
                        setShowEndSummary(false);
                        callStore.reset();
                    }}
                />
            <div className="app-container">
                <div className="header">
                     <div className="header-left">
                        <RobotIcon size={28} />
                        <span>Clara</span>
                    </div>
                    <div className="header-right">
                        <div className="header-button staff-login">
                            <StaffLoginIcon />
                            <span>Staff Login</span>
                        </div>
                        <div 
                            className="header-button map-button" 
                            onClick={() => {
                                setShowMap(!showMap);
                                if (!showMap && !currentLocation) {
                                    // If no location selected, show ground floor
                                    setCurrentFloor(0);
                                }
                            }}
                            style={{ cursor: 'pointer' }}
                        >
                            <MapIcon />
                            <span>{showMap ? 'Hide Map' : 'Show Map'}</span>
                        </div>
                        <div className="header-button video-call">
                            <VideoCallHeaderIcon />
                            <span>Video Call</span>
                        </div>
                        {import.meta.env.VITE_ENABLE_UNIFIED_MODE === 'true' && unifiedCallService && (
                            <div 
                                className="header-button unified-call" 
                                onClick={async () => {
                                    if (isUnifiedCalling) return;
                                    setIsUnifiedCalling(true);
                                    try {
                                        const result = await unifiedCallService.startCall({
                                            department: 'general',
                                            purpose: 'Client video call',
                                            clientName: preChatDetailsRef.current?.name, // Send client name from prechat
                                            onAccepted: (callId, roomName) => {
                                                console.log('Call accepted:', callId, roomName);
                                                // Handle accepted call - could show video UI
                                                setMessages(prev => [...prev, {
                                                    sender: 'clara',
                                                    text: 'Video call connected!',
                                                    isFinal: true,
                                                    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                                                }]);
                                            },
                                            onDeclined: (reason) => {
                                                setMessages(prev => [...prev, {
                                                    sender: 'clara',
                                                    text: reason || 'Call declined',
                                                    isFinal: true,
                                                    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                                                }]);
                                            },
                                            onEnded: ({ callId: endedCallId }) => {
                                                if (endedCallId && lastEndedCallIdRef.current === endedCallId) {
                                                    lastEndedCallIdRef.current = null;
                                                    return;
                                                }
                                                lastEndedCallIdRef.current = null;
                                                finalizeCallSession('Video call ended. Let me know if you need anything else.', {
                                                    notifyServer: false,
                                                    showSummary: true,
                                                });
                                            },
                                            onError: (error) => {
                                                console.error('Call error:', error);
                                                setMessages(prev => [...prev, {
                                                    sender: 'clara',
                                                    text: 'Failed to start call: ' + error.message,
                                                    isFinal: true,
                                                    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                                                }]);
                                            },
                                        });
                                        if (result) {
                                            setMessages(prev => [...prev, {
                                                sender: 'clara',
                                                text: 'Initiating video call...',
                                                isFinal: true,
                                                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                                            }]);
                                        }
                                    } catch (error) {
                                        console.error('Failed to start call:', error);
                                    } finally {
                                        setIsUnifiedCalling(false);
                                    }
                                }}
                                style={{ cursor: isUnifiedCalling ? 'not-allowed' : 'pointer', opacity: isUnifiedCalling ? 0.6 : 1 }}
                            >
                                <VideoCallHeaderIcon />
                                <span>{isUnifiedCalling ? 'Calling...' : 'Unified Call'}</span>
                            </div>
                        )}
                         <div className="status-indicator">
                            <div className="status-dot"></div>
                            <span>Ready to chat</span>
                        </div>
                    </div>
                </div>

                <div className="chat-container" ref={chatContainerRef}>
                    {messages.map((msg, index) => (
                        <div key={index} className={`message-wrapper ${msg.sender}`}>
                            <div className="message-avatar">
                                {msg.sender === 'user' ? <UserIcon size={20} /> : <RobotIcon size={20} />}
                            </div>
                            <div className="message-content">
                                <p>{msg.text}</p>
                                {msg.availabilityTable && (
                                    <div
                                        className="availability-table"
                                        style={{
                                            marginTop: '0.5rem',
                                            border: '1px solid rgba(99,102,241,0.2)',
                                            borderRadius: '12px',
                                            overflow: 'hidden',
                                            boxShadow: '0 6px 16px rgba(15, 23, 42, 0.08)',
                                        }}
                                    >
                                        <table
                                            style={{
                                                width: '100%',
                                                borderCollapse: 'collapse',
                                                backgroundColor: 'rgba(255,255,255,0.85)',
                                            }}
                                        >
                                            <thead style={{ backgroundColor: 'rgba(79, 70, 229, 0.08)' }}>
                                                <tr>
                                                    <th
                                                        style={{
                                                            textAlign: 'left',
                                                            padding: '10px 12px',
                                                            fontWeight: 600,
                                                            fontSize: '0.85rem',
                                                            color: '#3730a3',
                                                        }}
                                                    >
                                                        Day
                                                    </th>
                                                    <th
                                                        style={{
                                                            textAlign: 'left',
                                                            padding: '10px 12px',
                                                            fontWeight: 600,
                                                            fontSize: '0.85rem',
                                                            color: '#3730a3',
                                                        }}
                                                    >
                                                        Free Slots
                                                    </th>
                                                    <th
                                                        style={{
                                                            textAlign: 'left',
                                                            padding: '10px 12px',
                                                            fontWeight: 600,
                                                            fontSize: '0.85rem',
                                                            color: '#3730a3',
                                                        }}
                                                    >
                                                        Busy Classes
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {(msg.availabilityTable.rows || []).map((row: any, rowIdx: number) => {
                                                    const isHighlighted =
                                                        !!msg.availabilityTable?.requestedDay &&
                                                        msg.availabilityTable.requestedDay === row.day;
                                                    const busyText = Array.isArray(row.busySlots) && row.busySlots.length > 0
                                                        ? row.busySlots
                                                            .map((slot: any) => {
                                                                const parts: string[] = [];
                                                                if (slot.time) parts.push(slot.time);
                                                                if (slot.subject) parts.push(slot.subject);
                                                                if (slot.classType) parts.push(`(${slot.classType})`);
                                                                if (slot.batch) parts.push(slot.batch);
                                                                return parts.join(' ');
                                                            })
                                                            .join(' • ')
                                                        : '—';
                                                    return (
                                                        <tr
                                                            key={`${row.day}-${rowIdx}`}
                                                            style={{
                                                                backgroundColor: isHighlighted
                                                                    ? 'rgba(129, 140, 248, 0.12)'
                                                                    : rowIdx % 2 === 0
                                                                        ? 'rgba(255,255,255,0.95)'
                                                                        : 'rgba(249,250,251,0.9)',
                                                            }}
                                                        >
                                                            <td style={{ padding: '10px 12px', fontWeight: 500 }}>{row.day}</td>
                                                            <td style={{ padding: '10px 12px' }}>
                                                                {Array.isArray(row.freeSlots) && row.freeSlots.length > 0
                                                                    ? row.freeSlots.join(', ')
                                                                    : 'No free slots recorded'}
                                                            </td>
                                                            <td style={{ padding: '10px 12px', color: '#4b5563' }}>
                                                                {busyText}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                        <div
                                            style={{
                                                display: 'flex',
                                                flexWrap: 'wrap',
                                                gap: '8px',
                                                padding: '10px 12px',
                                                backgroundColor: 'rgba(248, 250, 252, 0.9)',
                                                fontSize: '0.75rem',
                                                color: '#475569',
                                            }}
                                        >
                                            <span style={{ fontWeight: 600 }}>
                                                {msg.availabilityTable.staffName}
                                            </span>
                                            {msg.availabilityTable.semester && (
                                                <span>• {msg.availabilityTable.semester}</span>
                                            )}
                                            {msg.availabilityTable.updatedAt && (
                                                <span>
                                                    • Updated{' '}
                                                    {new Date(msg.availabilityTable.updatedAt).toLocaleString([], {
                                                        hour: '2-digit',
                                                        minute: '2-digit',
                                                        day: 'numeric',
                                                        month: 'short',
                                                    })}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                )}
                                {msg.locationCard && (
                                    <LocationCard location={msg.locationCard.location} />
                                )}
                                {msg.hasMap && msg.locationData && !msg.locationCard && (
                                    <button 
                                        className="btn-show-map"
                                        onClick={() => {
                                            setCurrentLocation(msg.locationData);
                                            setCurrentFloor(msg.locationData.floor);
                                            setShowMap(true);
                                        }}
                                    >
                                        📍 Show on Map
                                    </button>
                                )}
                            </div>
                             <div className="timestamp">{msg.timestamp}</div>
                        </div>
                    ))}
                    
                    {/* Map Navigator (from remote) */}
                    {showMap && (
                        <div className="map-panel">
                            <MapNavigator
                                locationData={currentLocation}
                                destinationPoint={currentLocation?.coordinates || null}
                                currentFloor={currentFloor}
                                onFloorChange={setCurrentFloor}
                                onClose={() => setShowMap(false)}
                            />
                        </div>
                    )}
                    
                </div>

                <div className="footer">
                     <button 
                        className={`mic-button ${isRecording ? 'recording' : ''}`} 
                        onClick={handleMicClick}
                        aria-label={isRecording ? 'Stop recording' : 'Start recording'}
                    >
                        <MicOnIcon size={28} />
                    </button>
                    <div className="footer-status-text">
                        {status}
                    </div>
                    <div className="footer-options">
                        <div className="option-item">
                            <SpeakerIcon />
                            <span>Clara voice enabled</span>
                        </div>
                        <div className="option-item">
                            <PencilIcon />
                            <span>Text cleaning enabled</span>
                        </div>
                    </div>
                </div>
            </div>
            </>
                );
    };

        try {
            return <>{renderContent()}</>;
        } catch (error) {
            console.error('Error in renderContent:', error);
            return (
                <div style={{ padding: '20px', textAlign: 'center' }}>
                    <h2>Rendering Error</h2>
                    <p>{error.message}</p>
                </div>
            );
        }
};

// Error boundary wrapper
const ErrorBoundary = ({ children }) => {
    const [hasError, setHasError] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        const handleError = (event) => {
            console.error('Global error:', event.error);
            setError(event.error);
            setHasError(true);
        };
        window.addEventListener('error', handleError);
        return () => window.removeEventListener('error', handleError);
    }, []);

    if (hasError) {
        return (
            <div style={{ padding: '20px', textAlign: 'center' }}>
                <h2>Something went wrong</h2>
                <p>{error?.message || 'Unknown error'}</p>
                <button onClick={() => window.location.reload()}>Reload Page</button>
            </div>
        );
    }

    return children;
};

// Wait for DOM to be ready before rendering
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        initializeApp();
    });
} else {
    initializeApp();
}

function initializeApp() {
    try {
        const rootElement = document.getElementById('root');
        if (!rootElement) {
            throw new Error('Root element not found');
        }
        const root = createRoot(rootElement);
        root.render(
            <ErrorBoundary>
                <App />
            </ErrorBoundary>
        );
    } catch (error) {
        console.error('Failed to render app:', error);
        const rootElement = document.getElementById('root') || document.body;
        rootElement.innerHTML = `
            <div style="padding: 20px; text-align: center; font-family: Arial, sans-serif;">
                <h2>Failed to load application</h2>
                <p>${error.message}</p>
                <button onclick="window.location.reload()" style="padding: 10px 20px; margin-top: 10px; cursor: pointer;">Reload Page</button>
            </div>
        `;
    }
}
