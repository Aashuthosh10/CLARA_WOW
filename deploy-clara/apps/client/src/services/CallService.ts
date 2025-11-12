import { io, Socket } from 'socket.io-client';

interface CallUpdateEvent {
  callId?: string;
  state: 'created' | 'ringing' | 'accepted' | 'declined' | 'ended';
  staffId?: string;
  reason?: string;
}

interface CallSDPEvent {
  callId: string;
  type: 'offer' | 'answer';
  sdp: string;
}

interface CallICEEvent {
  callId: string;
  candidate: RTCIceCandidateInit;
}

interface AppointmentUpdateEvent {
  callId: string;
  status: 'confirmed' | 'rejected';
  details?: {
    staffId?: string;
    staffName?: string;
    clientName?: string;
    date?: string;
    time?: string;
    purpose?: string;
  };
}

// Always use backend server port (8080), not the client dev server port
const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8080';
const SOCKET_PATH = import.meta.env.VITE_SOCKET_PATH || '/socket';
// Always enable unified mode for WebRTC calls (required for presentation)
const ENABLE_UNIFIED = import.meta.env.VITE_ENABLE_UNIFIED_MODE === 'true' || true;

export interface CallServiceOptions {
  apiBase?: string;
  token: string;
  clientId: string;
}

export class CallService {
  private socket: Socket | null = null;
  private apiBase: string;
  private token: string;
  private clientId: string;
  private activeCalls: Map<string, { pc: RTCPeerConnection; stream: MediaStream; remoteStream: MediaStream | null }> = new Map();

  constructor({ apiBase = API_BASE, token, clientId }: CallServiceOptions) {
    this.apiBase = apiBase;
    this.token = token;
    this.clientId = clientId;
  }

  private getHeaders() {
    return {
      Authorization: `Bearer ${this.token}`,
      'Content-Type': 'application/json',
    };
  }

  private ensureSocket() {
    if (!this.socket) {
      const socketUrl = this.apiBase.replace(/\/api$/, '');
      this.socket = io(`${socketUrl}/rtc`, {
        path: SOCKET_PATH,
        auth: { token: this.token },
      });
    }
    return this.socket;
  }

  async startCall({
    targetStaffId,
    department,
    purpose,
    clientName,
    onAccepted,
    onDeclined,
    onEnded,
    onAppointmentUpdate,
    onError,
    onRemoteStream,
  }: {
    targetStaffId?: string;
    department?: string;
    purpose?: string;
    clientName?: string;
    onAccepted?: (callId: string, roomName: string) => void;
    onDeclined?: (reason?: string) => void;
    onEnded?: (info: { callId: string; reason?: string }) => void;
    onAppointmentUpdate?: (info: AppointmentUpdateEvent) => void;
    onError?: (error: Error) => void;
    onRemoteStream?: (info: { callId: string; stream: MediaStream }) => void;
  }): Promise<{ callId: string; roomName: string } | null> {
    if (!ENABLE_UNIFIED) {
      console.warn('Unified mode disabled');
      return null;
    }

    try {
      // Initiate call using new v1 API endpoint
      const requestBody: any = { clientId: this.clientId, targetStaffId, department, reason: purpose };
      if (clientName) {
        requestBody.clientName = clientName;
      }
      
      let res = await fetch(`${this.apiBase}/api/v1/calls`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(requestBody),
      });

      // If 401, refresh token and retry
      if (res.status === 401) {
        console.log('[CallService] Token expired, refreshing...');
        const refreshRes = await fetch(`${this.apiBase}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: this.clientId,
            role: 'client',
          }),
        });
        
        if (refreshRes.ok) {
          const data = await refreshRes.json();
          if (data.token) {
            this.token = data.token;
            localStorage.setItem('clara-jwt-token', data.token);
            console.log('[CallService] Token refreshed, retrying call...');
            
            // Retry with new token
            res = await fetch(`${this.apiBase}/api/calls/initiate`, {
              method: 'POST',
              headers: this.getHeaders(),
              body: JSON.stringify({ clientId: this.clientId, targetStaffId, department, purpose }),
            });
          }
        }
      }

      if (!res.ok) {
        throw new Error(`Failed to initiate call: ${res.statusText}`);
      }

      const { callId } = await res.json();

      // Join call room to listen for updates
      const socket = this.ensureSocket();
      socket.emit('join:call', { callId });
      console.log('[CallService] Joined call room:', callId);
      
      // Wait a bit for room join to complete before sending offer
      await new Promise(resolve => setTimeout(resolve, 100));

      // Create peer connection for WebRTC with TURN/STUN configuration
      const turnServerUrl = import.meta.env.VITE_TURN_SERVER_URL;
      const turnUsername = import.meta.env.VITE_TURN_USERNAME;
      const turnCredential = import.meta.env.VITE_TURN_CREDENTIAL;
      
      const iceServers: RTCIceServer[] = [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ];
      
      // Add TURN server if configured
      if (turnServerUrl) {
        iceServers.push({
          urls: turnServerUrl,
          username: turnUsername,
          credential: turnCredential,
        });
      }
      
      const pc = new RTCPeerConnection({
        iceServers,
        iceCandidatePoolSize: 10, // Pre-gather candidates for faster connection
      });

      // Get user media (permissions should already be granted from confirmation step)
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      let remoteStream: MediaStream | null = null;

      // Handle ICE candidates - only send after local description is set
      pc.onicecandidate = (e) => {
        if (e.candidate && pc.localDescription) {
          console.log('[CallService] Sending ICE candidate');
          fetch(`${this.apiBase}/api/calls/ice`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify({ callId, from: this.clientId, candidate: e.candidate }),
          }).catch(err => console.error('[CallService] Error sending ICE candidate:', err));
        } else if (e.candidate) {
          console.log('[CallService] ICE candidate generated but local description not set yet, will send later');
        }
      };

      // Handle remote stream
      pc.ontrack = (e) => {
        console.log('Client received remote stream:', e.streams[0]);
        if (e.streams && e.streams.length > 0) {
          remoteStream = e.streams[0];
          const callData = this.activeCalls.get(callId);
          if (callData) {
            callData.remoteStream = remoteStream;
            // Trigger update by re-setting the call data
            this.activeCalls.set(callId, { ...callData, remoteStream });
          }
          if (onRemoteStream) {
            onRemoteStream({ callId, stream: remoteStream });
          }
        }
      };

      // Handle connection state changes
      pc.onconnectionstatechange = () => {
        console.log('Client peer connection state:', pc.connectionState);
        if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
          console.warn('Client peer connection issue:', pc.connectionState);
        }
      };

      // Create and send offer
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      });
      await pc.setLocalDescription(offer);
      console.log('[CallService] Created and set local description (offer)');

      // Send offer to server
      const offerResponse = await fetch(`${this.apiBase}/api/calls/sdp`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ callId, from: this.clientId, type: 'offer', sdp: offer.sdp }),
      });
      if (offerResponse.ok) {
        console.log('[CallService] Offer sent successfully');
      } else {
        console.error('[CallService] Failed to send offer:', offerResponse.statusText);
      }

      // Store call state
      const callState = {
        callId,
        targetStaffId,
        purpose,
        onAccepted,
        onDeclined,
        onEnded,
        onAppointmentUpdate,
        onError,
        pc,
        stream,
        remoteStream,
      };

      // Listen for answer
      const sdpHandler = async ({ type, sdp, callId: eventCallId }: CallSDPEvent & { callId?: string }) => {
        // Only process if it's for this call
        if (type === 'answer' && (!eventCallId || eventCallId === callId)) {
          try {
            console.log('[CallService] Received answer SDP, setting remote description...');
            await pc.setRemoteDescription({ type: 'answer', sdp });
            console.log('[CallService] ✅ Client set remote description (answer)');
            remoteDescriptionSet = true;
            // Process any queued ICE candidates
            await processQueuedCandidates();
            console.log('[CallService] Processed queued ICE candidates');
          } catch (error) {
            console.error('[CallService] Error handling answer:', error);
          }
        } else if (type === 'offer') {
          console.log('[CallService] Received offer (unexpected for client), ignoring');
        }
      };

      socket.on('call:sdp', sdpHandler);

      // Queue for ICE candidates until remote description is set
      const iceCandidateQueue: RTCIceCandidateInit[] = [];
      let remoteDescriptionSet = false;

      // Listen for ICE candidates
      const iceHandler = async ({ candidate }: CallICEEvent) => {
        if (!candidate || pc.signalingState === 'closed') return;
        
        // If remote description is not set yet, queue the candidate
        if (!remoteDescriptionSet || pc.remoteDescription === null) {
          console.log('[CallService] Queueing ICE candidate (remote description not set yet)');
          iceCandidateQueue.push(candidate);
          return;
        }

        // Remote description is set, add the candidate
        try {
          await pc.addIceCandidate(candidate);
          console.log('[CallService] Added ICE candidate');
        } catch (error) {
          console.error('[CallService] Error adding ICE candidate:', error);
        }
      };

      socket.on('call:ice', iceHandler);

      // Process queued ICE candidates after remote description is set
      const processQueuedCandidates = async () => {
        if (remoteDescriptionSet && iceCandidateQueue.length > 0) {
          console.log(`[CallService] Processing ${iceCandidateQueue.length} queued ICE candidates`);
          for (const candidate of iceCandidateQueue) {
            try {
              await pc.addIceCandidate(candidate);
            } catch (error) {
              console.error('[CallService] Error adding queued ICE candidate:', error);
            }
          }
          iceCandidateQueue.length = 0; // Clear the queue
        }
      };

      const cleanup = () => {
        socket.off('call:update', updateHandler);
        socket.off('call:sdp', sdpHandler);
        socket.off('call:ice', iceHandler);
        socket.off('call.ended', endedHandler);
        socket.off('call.appointment', appointmentHandler);
        stream.getTracks().forEach((track) => track.stop());
        pc.close();
        this.activeCalls.delete(callId);
      };

      // Listen for call updates
      const updateHandler = async ({ state, reason }: CallUpdateEvent) => {
        console.log('[CallService] Received call:update event:', { state, reason, callId });
        if (state === 'declined') {
          console.log('[CallService] Call declined, cleaning up...');
          cleanup();
          if (callState.onDeclined) callState.onDeclined(reason);
        } else if (state === 'accepted') {
          console.log('[CallService] Call accepted! Notifying client...');
          // Staff accepted - notify with peer connection
          // Update call data with current state
          const currentCallData = this.activeCalls.get(callId);
          if (currentCallData) {
            this.activeCalls.set(callId, { ...currentCallData, remoteStream: currentCallData.remoteStream || null });
          }
          if (callState.onAccepted) {
            console.log('[CallService] Calling onAccepted callback...');
            callState.onAccepted(callId, callId); // Use callId as roomName for WebRTC
          } else {
            console.warn('[CallService] No onAccepted callback registered!');
          }
          // Don't remove the handler yet - we might need it for other updates
        } else if (state === 'ringing') {
          console.log('[CallService] Call is ringing...');
        } else if (state === 'ended') {
          console.log('[CallService] Call ended, cleaning up...');
          cleanup();
          if (callState.onEnded) callState.onEnded({ callId, reason });
        }
      };

      socket.on('call:update', updateHandler);
      const endedHandler = () => {
        console.log('[CallService] Received call.ended event');
        cleanup();
        if (callState.onEnded) callState.onEnded({ callId });
      };
      socket.on('call.ended', endedHandler);
      const appointmentHandler = (event: AppointmentUpdateEvent) => {
        if (event.callId && event.callId !== callId) {
          return;
        }
        if (callState.onAppointmentUpdate) {
          callState.onAppointmentUpdate(event);
        }
      };
      socket.on('call.appointment', appointmentHandler);

      // Store call data
      this.activeCalls.set(callId, { pc, stream, remoteStream: remoteStream || null });

      // Return callId and peer connection info
      return { callId, roomName: callId };
    } catch (error) {
      console.error('CallService.startCall error:', error);
      if (onError) onError(error as Error);
      return null;
    }
  }

  async endCall(callId: string) {
    const callData = this.activeCalls.get(callId);
    if (callData) {
      callData.stream.getTracks().forEach((track) => track.stop());
      if (callData.remoteStream) {
        callData.remoteStream.getTracks().forEach((track) => track.stop());
      }
      callData.pc.close();
    }
    this.activeCalls.delete(callId);

    try {
      await fetch(`${this.apiBase}/api/v1/calls/${callId}/end`, {
        method: 'POST',
        headers: this.getHeaders(),
      });
    } catch (error) {
      console.error('[CallService] Failed to end call via API:', error);
    }
  }

  getActiveCall(callId: string): { pc: RTCPeerConnection; stream: MediaStream; remoteStream: MediaStream | null } | null {
    return this.activeCalls.get(callId) || null;
  }

  disconnect() {
    this.activeCalls.clear();
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }
}

