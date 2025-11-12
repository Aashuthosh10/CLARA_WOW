import { GoogleGenAI, LiveSession, LiveServerMessage, Modality, Blob as GenAI_Blob, Type } from "@google/genai";

const apiKey = process.env.API_KEY || (typeof window !== 'undefined' ? (window as any).__VITE_API_KEY__ : '') || '';
if (!apiKey) {
    console.warn("API_KEY environment variable not set. Please set GEMINI_API_KEY in .env file.");
}

const ai = new GoogleGenAI({ apiKey: apiKey || 'dummy' });

export const createLiveSession = (callbacks: {
    onopen: () => void;
    onmessage: (message: LiveServerMessage) => void;
    onerror: (e: ErrorEvent) => void;
    onclose: (e: CloseEvent) => void;
    onTimetableUpdateRequest?: (command: { day: string; timeSlot: string; action: 'mark_busy' | 'mark_free' }) => void;
}): Promise<LiveSession> => {
    return ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        callbacks: callbacks,
        config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
                voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
            },
            systemInstruction: `You are a friendly and helpful AI assistant for the staff of Sai Vidya Institute of Technology. 

IMPORTANT: Only respond to clear, meaningful questions or commands. Do NOT respond to:
- Background noise
- Single characters or punctuation (like ".", "!", etc.)
- Filler words like "um", "uh", "ok", "ठीक" when said alone
- Ambiguous sounds or unclear speech
- Very short inputs (less than 3-4 words)

You have the ability to update the staff member's timetable. When a staff member mentions being busy or free at a specific time, you should:
1. Acknowledge their request
2. Confirm the day and time slot
3. Inform them that you will update their timetable

Common phrases to recognize:
- "I am busy at 2pm today" -> mark busy for today at 2pm slot
- "I'm free tomorrow at 10am" -> mark free for tomorrow at 10am slot
- "Mark me busy on Monday at 3pm" -> mark busy for Monday at 3pm slot

Always confirm before making changes. Keep your responses concise and professional. Only speak when the user has asked a clear question or given a clear command.`,
            outputAudioTranscription: {},
            inputAudioTranscription: {},
        },
    });
};

// Audio encoding function
export function encode(bytes: Uint8Array): string {
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

// Audio decoding function
export function decode(base64: string): Uint8Array {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
}

export async function decodeAudioData(
    data: Uint8Array,
    ctx: AudioContext,
    sampleRate: number,
    numChannels: number,
): Promise<AudioBuffer> {
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


export function createBlob(data: Float32Array): GenAI_Blob {
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

export const suggestTaskPriority = async (task: { title: string; description: string; dueDate: string }): Promise<{ priority: 'High' | 'Medium' | 'Low'; justification: string }> => {
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: `Analyze the following task and suggest a priority level (Low, Medium, or High). Provide a brief justification.
            Task Title: ${task.title}
            Description: ${task.description}
            Due Date: ${task.dueDate}`,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        priority: {
                            type: Type.STRING,
                            description: "The suggested priority: Low, Medium, or High.",
                        },
                        justification: {
                            type: Type.STRING,
                            description: "A brief justification for the suggested priority."
                        }
                    },
                    required: ["priority", "justification"]
                },
            },
        });

        const jsonStr = response.text.trim();
        return JSON.parse(jsonStr);
    } catch (error) {
        console.error("Error suggesting task priority:", error);
        throw new Error("Failed to get AI suggestion.");
    }
};

export const summarizeText = async (text: string): Promise<string> => {
     try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Summarize the following meeting notes. Extract the key discussion points, decisions made, and any action items. Format the output clearly with Markdown headings (e.g., ### Key Points).
            
            ---
            MEETING NOTES:
            ${text}
            ---
            
            SUMMARY:`,
        });
        return response.text;
    } catch (error) {
        console.error("Error summarizing text:", error);
        throw new Error("Failed to generate summary.");
    }
};
