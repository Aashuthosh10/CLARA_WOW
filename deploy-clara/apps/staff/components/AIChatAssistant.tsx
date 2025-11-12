
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { LiveServerMessage, LiveSession } from "@google/genai";
import { createLiveSession, decode, decodeAudioData, createBlob } from '../services/geminiService';
import { parseTimetableCommand, getFacultyId, TimetableUpdateCommand } from '../services/timetableCommandParser';
import { timetableApi } from '../services/timetableApi';
import { StaffProfile } from '../types';

const MicIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
        <path d="M8.25 4.5a3.75 3.75 0 1 1 7.5 0v8.25a3.75 3.75 0 1 1-7.5 0V4.5Z" />
        <path d="M6 10.5a.75.75 0 0 1 .75.75v1.5a5.25 5.25 0 1 0 10.5 0v-1.5a.75.75 0 0 1 1.5 0v1.5a6.75 6.75 0 1 1-13.5 0v-1.5A.75.75 0 0 1 6 10.5Z" />
    </svg>
);

const StopIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
        <path fillRule="evenodd" d="M4.5 7.5a3 3 0 0 1 3-3h9a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3h-9a3 3 0 0 1-3-3v-9Z" clipRule="evenodd" />
    </svg>
);

interface Transcription {
    id: number;
    user: string;
    assistant: string;
}

const AIChatAssistant: React.FC = () => {
    const [isListening, setIsListening] = useState(false);
    const [status, setStatus] = useState('Idle. Press start to talk.');
    const [transcriptions, setTranscriptions] = useState<Transcription[]>([]);
    const [user, setUser] = useState<StaffProfile | null>(null);
    const [selectedSemester, setSelectedSemester] = useState<string>("5th Semester");
    
    const sessionPromiseRef = useRef<Promise<LiveSession> | null>(null);
    const inputAudioContextRef = useRef<AudioContext | null>(null);
    const outputAudioContextRef = useRef<AudioContext | null>(null);
    const mediaStreamRef = useRef<MediaStream | null>(null);
    const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
    const isListeningRef = useRef(false); // Use ref to track listening state for callbacks
    const shouldSuppressAudioRef = useRef(false); // Flag to suppress audio for invalid/noise inputs

    const sources = useRef(new Set<AudioBufferSourceNode>());
    const nextStartTime = useRef(0);

    const currentUserTranscription = useRef("");
    const currentAssistantTranscription = useRef("");
    
    // Load user from localStorage and sync semester from dashboard
    useEffect(() => {
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
            try {
                const userData = JSON.parse(storedUser);
                setUser(userData);
            } catch (e) {
                console.error('Error parsing user data:', e);
            }
        }
        
        // Sync selected semester from localStorage (set by Dashboard)
        const storedSemester = localStorage.getItem('selectedSemester');
        if (storedSemester) {
            setSelectedSemester(storedSemester);
        }
        
        // Listen for semester changes
        const handleSemesterChange = (e: StorageEvent) => {
            if (e.key === 'selectedSemester' && e.newValue) {
                setSelectedSemester(e.newValue);
            }
        };
        
        window.addEventListener('storage', handleSemesterChange);
        
        // Also listen for custom events (same-tab updates)
        const handleCustomSemesterChange = (e: Event) => {
            const customEvent = e as CustomEvent;
            if (customEvent.detail && customEvent.detail.semester) {
                setSelectedSemester(customEvent.detail.semester);
            }
        };
        
        window.addEventListener('semester:changed', handleCustomSemesterChange);
        
        return () => {
            window.removeEventListener('storage', handleSemesterChange);
            window.removeEventListener('semester:changed', handleCustomSemesterChange);
        };
    }, []);

    // Handle timetable updates
    const handleTimetableUpdate = useCallback(async (command: TimetableUpdateCommand, userProfile: StaffProfile, semester: string) => {
        console.log('handleTimetableUpdate called with:', { command, semester, userProfile: userProfile.name });
        
        if (!command.day || !command.timeSlot || command.error) {
            console.error('Invalid command:', { day: command.day, timeSlot: command.timeSlot, error: command.error });
            return;
        }
        
        try {
            const facultyId = getFacultyId(userProfile);
            const normalizedFacultyId = facultyId.includes('@') ? facultyId.split('@')[0] : facultyId;
            console.log('Faculty ID:', normalizedFacultyId);
            
            // Get current timetable
            let currentTimetable;
            try {
                console.log('Fetching timetable from API...');
                currentTimetable = await timetableApi.getTimetable(normalizedFacultyId, semester);
                console.log('Fetched timetable:', currentTimetable);
            } catch (e) {
                console.warn('Timetable not found, creating new one:', e);
                // If timetable doesn't exist, create a basic structure
                currentTimetable = {
                    facultyId: normalizedFacultyId,
                    faculty: userProfile.name || 'Unknown',
                    designation: userProfile.department || '',
                    semester: semester,
                    schedule: {
                        Monday: [],
                        Tuesday: [],
                        Wednesday: [],
                        Thursday: [],
                        Friday: [],
                        Saturday: [],
                    },
                    updatedAt: new Date().toISOString(),
                };
            }
            
            // Find and update the specific time slot
            const day = command.day as keyof typeof currentTimetable.schedule;
            console.log('Updating day:', day, 'at time slot:', command.timeSlot);
            
            if (!currentTimetable.schedule[day]) {
                currentTimetable.schedule[day] = [];
            }
            
            const daySchedule = currentTimetable.schedule[day] || [];
            console.log('Current day schedule:', daySchedule);
            
            // Find existing entry for this time slot
            const existingIndex = daySchedule.findIndex(entry => entry.time === command.timeSlot);
            console.log('Existing entry index:', existingIndex);
            
            if (command.action === 'mark_busy') {
                // Mark as busy - replace existing class or add busy marker
                const busyEntry = {
                    time: command.timeSlot,
                    subject: 'Busy',
                    subjectCode: 'BUSY',
                    courseName: 'Not Available - Busy',
                    classType: 'Busy' as const, // Use 'Busy' classType
                    batch: '',
                    coordinator: userProfile.name || 'Self',
                    room: '',
                };
                
                if (existingIndex >= 0) {
                    // Replace existing class with busy marker
                    console.log('Replacing existing entry at index', existingIndex);
                    daySchedule[existingIndex] = busyEntry;
                } else {
                    // Add busy marker for this time slot
                    console.log('Adding new busy entry');
                    daySchedule.push(busyEntry);
                }
            } else if (command.action === 'mark_free') {
                // Remove the entry (makes the slot free/available)
                if (existingIndex >= 0) {
                    console.log('Removing entry at index', existingIndex);
                    daySchedule.splice(existingIndex, 1);
                }
            }
            
            // Sort by time
            daySchedule.sort((a, b) => {
                const [aStart] = a.time.split('-');
                const [bStart] = b.time.split('-');
                return aStart.localeCompare(bStart);
            });
            
            currentTimetable.schedule[day] = daySchedule;
            console.log('Updated day schedule:', daySchedule);
            
            // Update timetable via API
            const updateRequest = {
                faculty: currentTimetable.faculty,
                designation: currentTimetable.designation,
                semester: currentTimetable.semester,
                schedule: currentTimetable.schedule,
            };
            
            // Verify we have authentication token
            const token = localStorage.getItem('token') || localStorage.getItem('clara-jwt-token');
            if (!token) {
                console.error('❌ No authentication token found! Cannot update timetable.');
                // Try to refresh token or redirect to login
                throw new Error('Authentication required. Please log in again.');
            }
            console.log('✅ Authentication token found');
            
            console.log('Sending update request to API...');
            console.log('Update request:', JSON.stringify(updateRequest, null, 2));
            console.log('Faculty ID for update:', normalizedFacultyId);
            
            const updateResult = await timetableApi.updateTimetable(normalizedFacultyId, updateRequest);
            console.log('✅ API update result:', updateResult);
            
            // Get the updated schedule from API response or use current schedule
            const updatedSchedule = updateResult.timetable?.schedule || currentTimetable.schedule;
            console.log('📋 Updated schedule:', updatedSchedule);
            
            // Save to localStorage
            const localStorageKey = `timetable_${normalizedFacultyId.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${semester.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
            const timetableData = {
                faculty: currentTimetable.faculty,
                designation: currentTimetable.designation,
                semester: currentTimetable.semester,
                schedule: updatedSchedule, // Use updated schedule
            };
            localStorage.setItem(localStorageKey, JSON.stringify(timetableData));
            console.log('💾 Saved to localStorage with key:', localStorageKey);
            console.log('💾 Saved timetable data:', timetableData);
            
            // Dispatch multiple events to ensure all components get the update
            // Event 1: Standard timetable:updated event
            const updateEvent = new CustomEvent('timetable:updated', {
                detail: {
                    semester: semester,
                    timetable: updateResult.timetable || { ...currentTimetable, schedule: updatedSchedule },
                    facultyId: normalizedFacultyId,
                    schedule: updatedSchedule, // Include schedule for immediate update
                }
            });
            window.dispatchEvent(updateEvent);
            console.log('📢 Event 1: Dispatched timetable:updated event');
            
            // Event 2: Force update event with schedule (most reliable)
            const forceUpdateEvent = new CustomEvent('timetable:force-update', {
                detail: {
                    facultyId: normalizedFacultyId,
                    semester: semester,
                    schedule: updatedSchedule, // Direct schedule update
                }
            });
            window.dispatchEvent(forceUpdateEvent);
            console.log('📢 Event 2: Dispatched force-update event with schedule');
            
            // Event 3: Custom storage event (for same-tab listeners)
            const storageUpdateEvent = new CustomEvent('storage', {
                detail: {
                    key: localStorageKey,
                    newValue: JSON.stringify(timetableData),
                    storageArea: 'localStorage',
                }
            });
            window.dispatchEvent(storageUpdateEvent);
            console.log('📢 Event 3: Dispatched storage update event');
            
            // Small delay then dispatch again to ensure update propagates
            setTimeout(() => {
                window.dispatchEvent(new CustomEvent('timetable:force-update', {
                    detail: {
                        facultyId: normalizedFacultyId,
                        semester: semester,
                        schedule: updatedSchedule,
                    }
                }));
                console.log('📢 Event 4: Re-dispatched force-update event (retry)');
            }, 100);
            
            console.log(`✅ Timetable updated successfully: ${command.action} for ${command.day} at ${command.timeSlot}`);
            
            // Show success feedback in the UI (you can add a toast notification here)
            setStatus(`Timetable updated: Marked ${command.action === 'mark_busy' ? 'busy' : 'free'} for ${command.day} at ${command.timeSlot}`);
            
        } catch (error) {
            console.error('❌ Error updating timetable:', error);
            if (error instanceof Error) {
                console.error('Error message:', error.message);
                console.error('Error stack:', error.stack);
                
                // Show error feedback in the UI
                setStatus(`Error: ${error.message}. Please try again.`);
            }
        }
    }, [selectedSemester]);
    
    const stopConversation = useCallback(() => {
        if (isListening || isListeningRef.current) {
            setIsListening(false);
            isListeningRef.current = false; // Update ref immediately
            setStatus('Stopping...');

            // Stop all audio output immediately
            sources.current.forEach(source => {
                try {
                    source.stop();
                    source.disconnect();
                } catch (e) {
                    // Source might already be stopped
                }
            });
            sources.current.clear();
            nextStartTime.current = 0;

            // Close session and stop sending audio
            sessionPromiseRef.current?.then(session => {
                try {
                    session.close();
                } catch (e) {
                    console.error('Error closing session:', e);
                }
            });
            sessionPromiseRef.current = null;
            
            // Stop microphone input
            if (mediaStreamRef.current) {
                mediaStreamRef.current.getTracks().forEach(track => {
                    track.stop();
                    track.enabled = false;
                });
                mediaStreamRef.current = null;
            }
            
            // Disconnect and clean up audio processors
            if (scriptProcessorRef.current) {
                try {
                    scriptProcessorRef.current.disconnect();
                    scriptProcessorRef.current.onaudioprocess = null;
                } catch (e) {
                    // Already disconnected
                }
                scriptProcessorRef.current = null;
            }
            
            // Close audio contexts
            if (inputAudioContextRef.current && inputAudioContextRef.current.state !== 'closed') {
                inputAudioContextRef.current.close().catch(e => console.error('Error closing input audio context:', e));
                inputAudioContextRef.current = null;
            }
            if (outputAudioContextRef.current && outputAudioContextRef.current.state !== 'closed') {
                outputAudioContextRef.current.close().catch(e => console.error('Error closing output audio context:', e));
                outputAudioContextRef.current = null;
            }

            // Clear transcriptions
            currentUserTranscription.current = "";
            currentAssistantTranscription.current = "";
            
            setStatus('Idle. Press start to talk.');
        }
    }, [isListening]);

    const startConversation = useCallback(async () => {
        // Prevent starting if already listening
        if (isListening || isListeningRef.current) {
            console.log('Already listening, ignoring start request');
            return;
        }
        
        // Stop any existing session first (in case something is still running)
        if (sessionPromiseRef.current || mediaStreamRef.current) {
            await stopConversation();
            // Small delay to ensure cleanup is complete
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        setIsListening(true);
        isListeningRef.current = true; // Update ref immediately (before async operations)
        shouldSuppressAudioRef.current = false; // Reset suppression flag when starting
        setStatus('Initializing...');
        setTranscriptions([]);
        currentUserTranscription.current = "";
        currentAssistantTranscription.current = "";

        try {
            inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
            outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
            
            // Ensure audio contexts are resumed (required for playback)
            if (inputAudioContextRef.current.state === 'suspended') {
                await inputAudioContextRef.current.resume();
            }
            if (outputAudioContextRef.current.state === 'suspended') {
                await outputAudioContextRef.current.resume();
            }

            mediaStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });

            sessionPromiseRef.current = createLiveSession({
                onopen: () => {
                    setStatus('Connected. You can start speaking now.');
                    const source = inputAudioContextRef.current!.createMediaStreamSource(mediaStreamRef.current!);
                    
                    // Use ScriptProcessorNode for audio processing
                    // Note: ScriptProcessorNode is deprecated but functional
                    // AudioWorkletNode would require module setup via audioWorklet.addModule()
                    scriptProcessorRef.current = inputAudioContextRef.current!.createScriptProcessor(4096, 1, 1);

                    scriptProcessorRef.current.onaudioprocess = (audioProcessingEvent) => {
                        // Only process audio if we're still listening (check ref for current state)
                        if (!isListeningRef.current) {
                            return;
                        }
                        try {
                            const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
                            const pcmBlob = createBlob(inputData);
                            sessionPromiseRef.current?.then((session) => {
                                // Double-check we're still listening before sending
                                if (isListeningRef.current) {
                                    session.sendRealtimeInput({ media: pcmBlob });
                                }
                            }).catch((err) => {
                                console.error('Error sending audio input:', err);
                            });
                        } catch (err) {
                            console.error('Error processing audio:', err);
                        }
                    };

                    source.connect(scriptProcessorRef.current);
                    scriptProcessorRef.current.connect(inputAudioContextRef.current!.destination);
                },
                onmessage: async (message: LiveServerMessage) => {
                    // Ignore all messages if we're not listening (check ref for current state)
                    if (!isListeningRef.current) {
                        return;
                    }
                    
                    if (message.serverContent?.outputTranscription) {
                        currentAssistantTranscription.current += message.serverContent.outputTranscription.text;
                    }
                    if (message.serverContent?.inputTranscription) {
                        currentUserTranscription.current += message.serverContent.inputTranscription.text;
                    }
                    if (message.serverContent?.turnComplete) {
                        // Double-check we're still listening before processing
                        if (!isListeningRef.current) {
                            return;
                        }
                        
                        const fullUserInput = currentUserTranscription.current.trim();
                        const fullAssistantOutput = currentAssistantTranscription.current.trim();
                        
                        // Filter out noise and meaningless inputs
                        const isValidInput = (input: string): boolean => {
                            if (!input || input.length < 3) return false; // Too short
                            if (input === '<noise>' || input.toLowerCase().includes('<noise>')) return false; // Noise marker
                            if (/^[\.\,\!\?\;\:\s]+$/.test(input)) return false; // Only punctuation/whitespace
                            if (input.length === 1 && /[\.\,\!\?\;\:]/.test(input)) return false; // Single punctuation
                            // Filter out common filler sounds that are too short
                            const fillerPatterns = /^(ठीक|ok|okay|um|uh|ah|er|mm|hmm|yeah|yes|no|na|हाँ|ना)$/i;
                            if (fillerPatterns.test(input) && input.length < 5) return false; // Very short filler words
                            return true;
                        };
                        
                        // Only process meaningful inputs
                        if (fullUserInput && isValidInput(fullUserInput) && user) {
                            console.log('Processing user input for timetable update:', fullUserInput);
                            const command = parseTimetableCommand(fullUserInput);
                            console.log('Parsed command:', command);
                            
                            // Only update timetable if command is valid and actionable
                            if (command.action !== 'query') {
                                if (command.error) {
                                    console.error('❌ Command parsing error:', command.error);
                                    setStatus(`Error: ${command.error}. Please specify day and time clearly (e.g., "mark me busy at 3pm today").`);
                                    // Don't add to transcriptions if there's an error
                                } else if (command.day && command.timeSlot) {
                                    console.log('✅ Valid command detected, updating timetable:', command);
                                    // Update timetable (use current selectedSemester state)
                                    try {
                                        await handleTimetableUpdate(command, user, selectedSemester);
                                        console.log('✅ Timetable update completed successfully');
                                        // Only add to transcriptions if it was a valid command
                                        if (fullAssistantOutput || fullUserInput) {
                                            setTranscriptions(prev => [...prev, {id: Date.now(), user: fullUserInput, assistant: fullAssistantOutput}]);
                                        }
                                    } catch (updateError) {
                                        console.error('❌ Error during timetable update:', updateError);
                                        setStatus(`Error updating timetable: ${updateError instanceof Error ? updateError.message : 'Unknown error'}`);
                                    }
                                } else {
                                    console.warn('⚠️ Command missing required fields:', { 
                                        action: command.action,
                                        day: command.day, 
                                        timeSlot: command.timeSlot,
                                        error: command.error 
                                    });
                                    setStatus(`Could not parse command. Missing: ${!command.day ? 'day' : ''} ${!command.timeSlot ? 'time' : ''}. Please try: "mark me busy at 3pm today"`);
                                    // Don't add to transcriptions if command is incomplete
                                }
                            } else {
                                // For queries, only add to transcriptions if there's meaningful content
                                if (fullUserInput.length >= 5 && (fullAssistantOutput || fullUserInput)) {
                                    setTranscriptions(prev => [...prev, {id: Date.now(), user: fullUserInput, assistant: fullAssistantOutput}]);
                                }
                            }
                        } else if (fullUserInput && !isValidInput(fullUserInput)) {
                            // Log filtered inputs for debugging but don't process them
                            console.debug('Filtered out noise/invalid input:', fullUserInput);
                            // Set flag to suppress audio response for this turn
                            shouldSuppressAudioRef.current = true;
                            // Don't add to transcriptions and don't let AI respond
                            currentUserTranscription.current = "";
                            currentAssistantTranscription.current = "";
                            return; // Exit early to prevent AI from responding
                        } else {
                            // Valid input, allow audio responses
                            shouldSuppressAudioRef.current = false;
                        }
                        
                        // Clear transcriptions for next turn
                        currentUserTranscription.current = "";
                        currentAssistantTranscription.current = "";
                    }

                    // Only play audio if we're still listening (check ref for current state)
                    if (!isListeningRef.current) {
                        return;
                    }
                    
                    // Don't play audio if we've flagged this turn as invalid/noise
                    if (shouldSuppressAudioRef.current) {
                        console.debug('Suppressing audio response due to invalid/noise input');
                        // Reset flag after checking (will be set again if needed on next invalid input)
                        if (message.serverContent?.turnComplete) {
                            shouldSuppressAudioRef.current = false;
                        }
                        return;
                    }
                    
                    // Safely extract audio data with proper null checks
                    try {
                        const modelTurn = message.serverContent?.modelTurn;
                        const parts = modelTurn?.parts;
                        const firstPart = parts && parts.length > 0 ? parts[0] : null;
                        const inlineData = firstPart?.inlineData;
                        const base64Audio = inlineData?.data;
                        
                        if (base64Audio && outputAudioContextRef.current && isListeningRef.current) {
                            // Ensure audio context is resumed before playback
                            if (outputAudioContextRef.current.state === 'suspended') {
                                await outputAudioContextRef.current.resume();
                            }
                            
                            // Calculate proper start time for seamless queuing
                            const currentTime = outputAudioContextRef.current.currentTime;
                            const startTime = Math.max(nextStartTime.current, currentTime + 0.01); // Small buffer to prevent clipping
                            
                            const audioBuffer = await decodeAudioData(decode(base64Audio), outputAudioContextRef.current, 24000, 1);
                            const source = outputAudioContextRef.current.createBufferSource();
                            source.buffer = audioBuffer;
                            source.connect(outputAudioContextRef.current.destination);
                            
                            source.start(startTime);
                            
                            // Update next start time with exact duration for seamless playback
                            nextStartTime.current = startTime + audioBuffer.duration;
                            sources.current.add(source);
                            
                            console.log(`[Staff Audio] Queued audio chunk: duration=${audioBuffer.duration.toFixed(2)}s, start=${startTime.toFixed(2)}s`);
                            
                            source.addEventListener('ended', () => {
                                sources.current.delete(source);
                                console.log(`[Staff Audio] Audio chunk finished. Remaining: ${sources.current.size}`);
                            });
                            
                            source.addEventListener('error', (error) => {
                                console.error('[Staff Audio] Audio source error:', error);
                                sources.current.delete(source);
                            });
                        }
                    } catch (audioError) {
                        // Silently handle audio processing errors (some messages don't have audio)
                        console.debug('Audio processing skipped:', audioError);
                    }

                    if (message.serverContent?.interrupted) {
                         sources.current.forEach(source => source.stop());
                         sources.current.clear();
                         nextStartTime.current = 0;
                    }
                },
                onerror: (e) => {
                    console.error('Session error:', e);
                    setStatus(`Error: ${e.type}. Please try again.`);
                    stopConversation();
                },
                onclose: () => {
                    setStatus('Session closed.');
                    // Always clean up when session closes
                    setIsListening(false);
                    isListeningRef.current = false; // Update ref
                    if (mediaStreamRef.current) {
                        mediaStreamRef.current.getTracks().forEach(track => track.stop());
                        mediaStreamRef.current = null;
                    }
                    sources.current.forEach(source => {
                        try {
                            source.stop();
                            source.disconnect();
                        } catch (e) {
                            // Source might already be stopped
                        }
                    });
                    sources.current.clear();
                },
            });
        } catch (error) {
            console.error('Failed to start conversation:', error);
            setStatus('Error: Could not access microphone.');
            setIsListening(false);
            isListeningRef.current = false; // Update ref
        }
    }, [isListening, stopConversation, user, selectedSemester, handleTimetableUpdate]);

    useEffect(() => {
        return () => {
            stopConversation();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <div className="h-full flex flex-col p-4 md:p-6 bg-slate-900/50 backdrop-blur-lg rounded-2xl border border-white/10 text-white">
            <h2 className="text-xl font-bold mb-4">AI Voice Assistant</h2>
            <div className="flex-grow overflow-y-auto mb-4 pr-2 space-y-4">
                {transcriptions.length === 0 && <p className="text-slate-400">Conversation will appear here...</p>}
                {transcriptions.map((t) => (
                    <div key={t.id} className="space-y-2">
                        {t.user && (
                             <div className="flex justify-end">
                                <p className="bg-blue-600/50 rounded-lg p-3 max-w-lg">{t.user}</p>
                            </div>
                        )}
                        {t.assistant && (
                            <div className="flex justify-start">
                                <p className="bg-slate-700/50 rounded-lg p-3 max-w-lg">{t.assistant}</p>
                            </div>
                        )}
                    </div>
                ))}
            </div>
            <div className="flex-shrink-0 flex flex-col items-center space-y-4">
                <p className="text-sm text-slate-400 h-5">{status}</p>
                <button
                    onClick={isListening ? stopConversation : startConversation}
                    className={`w-20 h-20 rounded-full flex items-center justify-center text-white transition-all duration-300 ease-in-out focus:outline-none focus:ring-4 focus:ring-offset-2 focus:ring-offset-slate-900 ${isListening ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500' : 'bg-green-600 hover:bg-green-700 focus:ring-green-500'}`}
                >
                    {isListening ? <StopIcon /> : <MicIcon />}
                </button>
            </div>
        </div>
    );
};

export default AIChatAssistant;
