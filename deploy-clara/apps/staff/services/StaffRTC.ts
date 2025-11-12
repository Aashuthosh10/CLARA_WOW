import { io, Socket } from 'socket.io-client';

// Always use backend server port (8080), not the staff dev server port
const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8080';
const SOCKET_PATH = import.meta.env.VITE_SOCKET_PATH || '/socket';
// Always enable unified mode for WebRTC calls (required for presentation)
const ENABLE_UNIFIED = import.meta.env.VITE_ENABLE_UNIFIED_MODE === 'true' || true;

export interface CallIncomingEvent {
  callId: string;
  clientInfo: {
    clientId: string;
    name?: string;
    phone?: string;
    avatar?: string;
  };
  purpose?: string;
  ts: number;
}

export interface CallUpdateEvent {
  callId?: string;
  state: 'created' | 'ringing' | 'accepted' | 'declined' | 'ended';
  staffId?: string;
  reason?: string;
}

export interface CallSDPEvent {
  callId: string;
  type: 'offer' | 'answer';
  sdp: string;
}

export interface CallICEEvent {
  callId: string;
  candidate: RTCIceCandidateInit;
}

export class StaffRTC {
  private socket: Socket | null = null;
  private apiBase: string;
  private token: string;
  private staffId: string;
  private activeCalls: Map<string, { pc: RTCPeerConnection; stream: MediaStream }> = new Map();

  constructor({ apiBase = API_BASE, token, staffId }: { apiBase?: string; token: string; staffId: string }) {
    this.apiBase = apiBase;
    this.token = token;
    this.staffId = staffId;
  }

  private getHeaders() {
    const storedToken =
      localStorage.getItem('token') ||
      localStorage.getItem('clara-jwt-token') ||
      this.token;

    if (storedToken && storedToken !== this.token) {
      this.token = storedToken;
    }

    return {
      Authorization: `Bearer ${this.token}`,
      'Content-Type': 'application/json',
    };
  }

  private ensureSocket() {
    if (!this.socket) {
      const socketUrl = this.apiBase.replace(/\/api$/, '');
      // Connect to /rtc namespace (same as client CallService)
      this.socket = io(`${socketUrl}/rtc`, {
        path: SOCKET_PATH,
        auth: { token: this.token },
      });

      // Join staff room
      this.socket.on('connect', () => {
        console.log('[StaffRTC] ===== SOCKET CONNECTED =====');
        console.log('[StaffRTC] Staff socket connected to /rtc namespace');
        console.log('[StaffRTC] Staff ID:', this.staffId);
        console.log('[StaffRTC] Socket ID:', this.socket.id);
        console.log('[StaffRTC] Socket connected:', this.socket.connected);
        
        // Wait a bit to ensure socket is fully ready
        setTimeout(() => {
          // Explicitly join the staff room (server should also do this, but this ensures it)
          console.log('[StaffRTC] Emitting join:staff event for staffId:', this.staffId);
          this.socket.emit('join:staff', { staffId: this.staffId });
          console.log('[StaffRTC] ✅ join:staff event emitted');
        }, 100);
      });

      this.socket.on('connect_error', (error) => {
        console.error('Staff socket connection error:', error);
      });
    }
    return this.socket;
  }

  attachHandlers({
    onIncoming,
    onUpdate,
  }: {
    onIncoming: (event: CallIncomingEvent) => void;
    onUpdate: (event: CallUpdateEvent) => void;
  }) {
    if (!ENABLE_UNIFIED) {
      console.warn('[StaffRTC] Unified mode is disabled, handlers not attached');
      return;
    }

    const socket = this.ensureSocket();

    // Remove any existing listeners to avoid duplicates
    socket.off('call:incoming');
    socket.off('call.initiated'); // New event name
    socket.off('call:update');
    socket.off('call.accepted'); // New event names
    socket.off('call.declined');
    socket.off('call.canceled');
    socket.off('call.missed');

    // Attach event handlers - support both old and new event names
    const handleIncoming = (event: any) => {
      console.log('[StaffRTC] ===== RECEIVED INCOMING CALL EVENT =====');
      console.log('[StaffRTC] Raw event:', JSON.stringify(event, null, 2));
      
      // Map server event format to expected CallIncomingEvent format
      // Server sends: { callId, client: { id, name, avatar }, reason, createdAt }
      // Expected: { callId, clientInfo: { clientId, name, phone }, purpose, ts }
      const mappedEvent: CallIncomingEvent = {
        callId: event.callId,
        clientInfo: {
          clientId: event.client?.id || event.clientInfo?.clientId || event.clientInfo?.id || '',
          name: event.client?.name || event.clientInfo?.name,
          phone: event.client?.phone || event.clientInfo?.phone,
          avatar: event.client?.avatar || event.clientInfo?.avatar,
        },
        purpose: event.reason || event.purpose,
        ts: event.createdAt || event.ts || Date.now(),
      };
      
      console.log('[StaffRTC] Mapped event:', JSON.stringify(mappedEvent, null, 2));
      console.log('[StaffRTC] Call ID:', mappedEvent.callId);
      console.log('[StaffRTC] Client Info:', mappedEvent.clientInfo);
      console.log('[StaffRTC] Calling onIncoming handler...');
      onIncoming(mappedEvent);
      console.log('[StaffRTC] ✅ onIncoming handler called');
    };

    socket.on('call:incoming', handleIncoming); // Old event name
    socket.on('call.initiated', handleIncoming); // New event name
    
    // Test socket connection by listening for any events
    socket.on('connect', () => {
      console.log('[StaffRTC] Socket reconnected in attachHandlers');
    });
    
    socket.on('disconnect', () => {
      console.warn('[StaffRTC] Socket disconnected!');
    });
    
    socket.on('error', (error) => {
      console.error('[StaffRTC] Socket error:', error);
    });

    // Handle call updates - support both old and new event names
    const handleUpdate = (event: CallUpdateEvent) => {
      console.log('[StaffRTC] Received call update event:', event);
      onUpdate(event);
    };

    socket.on('call:update', handleUpdate); // Old/new event payload contains callId now
    socket.on('call.accepted', (event: any) => {
        handleUpdate({ callId: event.callId, state: 'accepted', staffId: event.staff?.id });
    });
    socket.on('call.declined', (event: any) => {
        handleUpdate({ callId: event.callId, state: 'declined', reason: event.reason });
    });
    socket.on('call.canceled', (event: any = {}) => {
        handleUpdate({ callId: event.callId, state: 'ended', reason: 'Call canceled by client' });
    });
    socket.on('call.missed', (event: any) => {
        handleUpdate({ callId: event.callId, state: 'ended', reason: event.reason || 'Call missed' });
    });
    socket.on('call.ended', (event: any) => {
        handleUpdate({ callId: event.callId, state: 'ended' });
        if (event.callId) {
          this.endCall(event.callId);
        }
    });

    // If socket is already connected, ensure room is joined immediately
    if (socket.connected) {
      console.log('[StaffRTC] Socket already connected, joining staff room immediately...');
      socket.emit('join:staff', { staffId: this.staffId });
    } else {
      // Also listen for connection to ensure room is joined when it connects
      socket.on('connect', () => {
        console.log('[StaffRTC] Socket connected in attachHandlers, ensuring staff room join...');
        // Re-emit join:staff to ensure we're in the room
        socket.emit('join:staff', { staffId: this.staffId });
      });
    }

    console.log('[StaffRTC] Event handlers attached for staffId:', this.staffId);
  }

  async accept(
    callId: string,
    options?: MediaStream | { existingStream?: MediaStream; onRemoteStream?: (stream: MediaStream) => void }
  ): Promise<{ pc: RTCPeerConnection; stream: MediaStream; remoteStream: MediaStream | null } | null> {
    if (!ENABLE_UNIFIED) return null;

    try {
      let existingStream: MediaStream | undefined;
      let onRemoteStream: ((stream: MediaStream) => void) | undefined;

      if (options) {
        if (typeof (options as MediaStream).getTracks === 'function') {
          existingStream = options as MediaStream;
        } else {
          const opts = options as { existingStream?: MediaStream; onRemoteStream?: (stream: MediaStream) => void };
          existingStream = opts.existingStream;
          onRemoteStream = opts.onRemoteStream;
        }
      }

      // Refresh token if needed before accepting
      let res = await fetch(`${this.apiBase}/api/v1/calls/${callId}/accept`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ callId, staffId: this.staffId }),
      });

      // If 401, refresh token and retry
      if (res.status === 401) {
        console.log('[StaffRTC] Token expired, refreshing...');
        // Try to get user email from localStorage, or reconstruct from staffId
        const userStr = localStorage.getItem('user');
        let userEmail = this.staffId + '@gmail.com'; // Default reconstruction
        if (userStr) {
          try {
            const user = JSON.parse(userStr);
            userEmail = user.email || userEmail;
          } catch (e) {
            console.warn('[StaffRTC] Could not parse user from localStorage');
          }
        }
        
        // Try unified format first
        let refreshRes = await fetch(`${this.apiBase}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: userEmail,
            role: 'staff',
            staffId: this.staffId,
          }),
        });
        
        // If unified format fails, try email/password format
        if (!refreshRes.ok) {
          console.log('[StaffRTC] Unified login failed, trying email/password format...');
          refreshRes = await fetch(`${this.apiBase}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: userEmail,
              password: 'Password123!', // Default password for demo
            }),
          });
        }
        
        if (refreshRes.ok) {
          const data = await refreshRes.json();
          if (data.token) {
            this.token = data.token;
            localStorage.setItem('clara-jwt-token', data.token);
            console.log('[StaffRTC] Token refreshed, retrying accept...');
            
            // Retry with new token
            res = await fetch(`${this.apiBase}/api/calls/accept`, {
              method: 'POST',
              headers: this.getHeaders(),
              body: JSON.stringify({ callId, staffId: this.staffId }),
            });
          }
        } else {
          console.error('[StaffRTC] Token refresh failed:', refreshRes.status, await refreshRes.text());
        }
      }

      if (!res.ok) {
        const errorText = await res.text();
        // If conflict, the call might already be accepted - try to continue anyway
        if (res.status === 409) {
          console.warn('[StaffRTC] Call already accepted (409), continuing with WebRTC setup...');
        } else {
          throw new Error(`Failed to accept call: ${res.statusText} - ${errorText}`);
        }
      }

      // Join call room
      const socket = this.ensureSocket();
      socket.emit('join:call', { callId });

      // Create peer connection with TURN/STUN configuration
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

      // Get user media (use existing stream if provided, otherwise request new)
      let stream: MediaStream;
      if (existingStream) {
        stream = existingStream;
      } else {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      }
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      let remoteStream: MediaStream | null = null;

      // Handle ICE candidates
      pc.onicecandidate = (e) => {
        if (e.candidate) {
          fetch(`${this.apiBase}/api/calls/ice`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify({ callId, from: this.staffId, candidate: e.candidate }),
          }).catch(console.error);
        }
      };

      // Handle remote stream
      pc.ontrack = (e) => {
        console.log('Staff received remote stream:', e.streams[0]);
        if (e.streams && e.streams.length > 0) {
          remoteStream = e.streams[0];
          // Update stored call data
          const callData = this.activeCalls.get(callId);
          if (callData) {
            (callData as any).remoteStream = remoteStream;
          }
          if (onRemoteStream) {
            onRemoteStream(remoteStream);
          }
        }
      };

      // Handle connection state changes
      pc.onconnectionstatechange = () => {
        console.log('Staff peer connection state:', pc.connectionState);
        if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
          console.warn('Staff peer connection issue:', pc.connectionState);
        }
      };

      // Queue for ICE candidates until remote description is set
      const iceCandidateQueue: RTCIceCandidateInit[] = [];
      let remoteDescriptionSet = false;

      // Process queued ICE candidates after remote description is set
      const processQueuedCandidates = async () => {
        if (remoteDescriptionSet && iceCandidateQueue.length > 0) {
          console.log(`[StaffRTC] Processing ${iceCandidateQueue.length} queued ICE candidates`);
          for (const candidate of iceCandidateQueue) {
            try {
              await pc.addIceCandidate(candidate);
            } catch (error) {
              console.error('[StaffRTC] Error adding queued ICE candidate:', error);
            }
          }
          iceCandidateQueue.length = 0; // Clear the queue
        }
      };

      // Listen for offer from client
      const sdpHandler = async ({ type, sdp }: CallSDPEvent) => {
        if (type === 'offer') {
          try {
            await pc.setRemoteDescription({ type: 'offer', sdp });
            console.log('[StaffRTC] Staff set remote description (offer)');
            remoteDescriptionSet = true;
            
            const answer = await pc.createAnswer({
              offerToReceiveAudio: true,
              offerToReceiveVideo: true,
            });
            await pc.setLocalDescription(answer);

            await fetch(`${this.apiBase}/api/calls/sdp`, {
              method: 'POST',
              headers: this.getHeaders(),
              body: JSON.stringify({ callId, from: this.staffId, type: 'answer', sdp: answer.sdp }),
            });
            console.log('[StaffRTC] Staff answer created and sent');
            
            // Process any queued ICE candidates
            await processQueuedCandidates();
          } catch (error) {
            console.error('[StaffRTC] Error handling offer:', error);
          }
        }
      };

      socket.on('call:sdp', sdpHandler);

      // Listen for ICE candidates
      const iceHandler = async ({ candidate }: CallICEEvent) => {
        if (!candidate || pc.signalingState === 'closed') return;
        
        // If remote description is not set yet, queue the candidate
        if (!remoteDescriptionSet || pc.remoteDescription === null) {
          console.log('[StaffRTC] Queueing ICE candidate (remote description not set yet)');
          iceCandidateQueue.push(candidate);
          return;
        }

        // Remote description is set, add the candidate
        try {
          await pc.addIceCandidate(candidate);
          console.log('[StaffRTC] Added ICE candidate');
        } catch (error) {
          console.error('[StaffRTC] Error adding ICE candidate:', error);
        }
      };

      socket.on('call:ice', iceHandler);

      // Store call data
      const callData = { pc, stream, remoteStream: remoteStream || null };
      this.activeCalls.set(callId, callData);

      return { pc, stream, remoteStream: remoteStream || null };
    } catch (error) {
      console.error('StaffRTC.accept error:', error);
      return null;
    }
  }

  async decline(callId: string, reason?: string): Promise<void> {
    if (!ENABLE_UNIFIED) return;

    try {
      await fetch(`${this.apiBase}/api/v1/calls/${callId}/decline`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ callId, staffId: this.staffId, reason }),
      });
    } catch (error) {
      console.error('Failed to decline call:', error);
    }
  }

  notifyAppointmentDecision(
    callId: string,
    status: 'confirmed' | 'rejected',
    details: {
      staffId: string;
      staffName: string;
      clientName: string;
      date: string;
      time: string;
      purpose?: string;
    }
  ) {
    if (!ENABLE_UNIFIED) return;
    const socket = this.ensureSocket();
    socket.emit('call:appointment', {
      callId,
      status,
      details,
    });
  }

  async endCall(callId: string) {
    const call = this.activeCalls.get(callId);
    if (call) {
      call.stream.getTracks().forEach((t) => t.stop());
      call.pc.close();
      this.activeCalls.delete(callId);
    }

    try {
      await fetch(`${this.apiBase}/api/v1/calls/${callId}/end`, {
        method: 'POST',
        headers: this.getHeaders(),
      });
    } catch (error) {
      console.error('Failed to end call:', error);
    }
  }

  disconnect() {
    this.activeCalls.forEach((call) => {
      call.stream.getTracks().forEach((t) => t.stop());
      call.pc.close();
    });
    this.activeCalls.clear();
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }
}

