/**
 * Staff Call Store with Finite State Machine
 * Manages incoming call state: idle → incoming → popup_visible → connecting → in_call → ending → ended
 */
import { create } from 'zustand';

export type StaffCallState = 
  | 'idle' 
  | 'incoming' 
  | 'popup_visible' 
  | 'connecting' 
  | 'in_call' 
  | 'ending' 
  | 'ended';

export interface IncomingCallData {
  callId: string;
  clientInfo: {
    id: string;
    name?: string;
    avatar?: string;
  };
  reason?: string;
  createdAt: number;
}

export interface StaffCallData {
  callId?: string;
  clientInfo?: {
    id: string;
    name?: string;
    avatar?: string;
  };
  reason?: string;
  startedAt?: number;
  endedAt?: number;
  error?: string;
  peerConnection?: RTCPeerConnection;
  localStream?: MediaStream;
  remoteStream?: MediaStream | null;
}

interface StaffCallStore {
  state: StaffCallState;
  callData: StaffCallData;
  incomingCall: IncomingCallData | null;
  
  // Actions
  onIncoming: (event: IncomingCallData) => void;
  showPopup: () => void;
  acceptCall: () => void;
  declineCall: (reason?: string) => void;
  setConnecting: () => void;
  setInCall: (data: Partial<StaffCallData>) => void;
  endCall: () => void;
  onCanceled: () => void;
  onAcceptedByOther: () => void;
  setError: (error: string) => void;
  reset: () => void;
  
  // State helpers
  hasIncomingCall: () => boolean;
  canAccept: () => boolean;
  canDecline: () => boolean;
  canEnd: () => boolean;
}

const initialState: StaffCallData = {};

export const useStaffCallStore = create<StaffCallStore>((set, get) => ({
  state: 'idle',
  callData: initialState,
  incomingCall: null,

  hasIncomingCall: () => {
    return get().incomingCall !== null;
  },

  canAccept: () => {
    const state = get().state;
    return state === 'incoming' || state === 'popup_visible';
  },

  canDecline: () => {
    const state = get().state;
    return state === 'incoming' || state === 'popup_visible';
  },

  canEnd: () => {
    const state = get().state;
    return state === 'in_call' || state === 'connecting';
  },

  onIncoming: (event: IncomingCallData) => {
    const currentState = get().state;
    if (currentState !== 'idle' && currentState !== 'ended') {
      console.warn('[StaffCallStore] Cannot receive incoming call from state:', currentState);
      return;
    }
    
    set({
      state: 'incoming',
      incomingCall: event,
      callData: {
        callId: event.callId,
        clientInfo: event.clientInfo,
        reason: event.reason,
      },
    });
  },

  showPopup: () => {
    const currentState = get().state;
    if (currentState !== 'incoming') {
      console.warn('[StaffCallStore] Cannot show popup from state:', currentState);
      return;
    }
    
    set({ state: 'popup_visible' });
  },

  acceptCall: () => {
    const currentState = get().state;
    if (!get().canAccept()) {
      console.warn('[StaffCallStore] Cannot accept call from state:', currentState);
      return;
    }
    
    const incomingCall = get().incomingCall;
    if (!incomingCall) {
      console.error('[StaffCallStore] No incoming call to accept');
      return;
    }
    
    set({
      state: 'connecting',
      callData: {
        ...get().callData,
        callId: incomingCall.callId,
        clientInfo: incomingCall.clientInfo,
        reason: incomingCall.reason,
        startedAt: Date.now(),
      },
      incomingCall: null,
    });
  },

  declineCall: (reason?: string) => {
    const currentState = get().state;
    if (!get().canDecline()) {
      console.warn('[StaffCallStore] Cannot decline call from state:', currentState);
      return;
    }
    
    set({
      state: 'ended',
      callData: {
        ...get().callData,
        endedAt: Date.now(),
        error: reason || 'Call declined',
      },
      incomingCall: null,
    });
  },

  setConnecting: () => {
    const currentState = get().state;
    if (currentState !== 'connecting') {
      console.warn('[StaffCallStore] Invalid transition to connecting from:', currentState);
      return;
    }
    
    set({ state: 'connecting' });
  },

  setInCall: (data: Partial<StaffCallData>) => {
    const currentState = get().state;
    if (currentState !== 'connecting' && currentState !== 'in_call') {
      console.warn('[StaffCallStore] Invalid transition to in_call from:', currentState);
      return;
    }
    
    set({
      state: 'in_call',
      callData: { ...get().callData, ...data },
    });
  },

  endCall: () => {
    const currentState = get().state;
    if (!get().canEnd()) {
      console.warn('[StaffCallStore] Cannot end call from state:', currentState);
      return;
    }
    
    set({ state: 'ending' });
    
    // Cleanup
    const { localStream, remoteStream, peerConnection } = get().callData;
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }
    if (remoteStream) {
      remoteStream.getTracks().forEach(track => track.stop());
    }
    if (peerConnection) {
      peerConnection.close();
    }
    
    set({
      state: 'ended',
      callData: {
        ...get().callData,
        endedAt: Date.now(),
        localStream: undefined,
        remoteStream: undefined,
        peerConnection: undefined,
      },
      incomingCall: null,
    });
  },

  onCanceled: () => {
    const currentState = get().state;
    if (currentState !== 'incoming' && currentState !== 'popup_visible') {
      console.warn('[StaffCallStore] Cannot cancel call from state:', currentState);
      return;
    }
    
    set({
      state: 'idle',
      incomingCall: null,
      callData: initialState,
    });
  },

  onAcceptedByOther: () => {
    const currentState = get().state;
    if (currentState !== 'incoming' && currentState !== 'popup_visible') {
      return; // Already handled or not relevant
    }
    
    // Auto-dismiss popup
    set({
      state: 'idle',
      incomingCall: null,
      callData: initialState,
    });
  },

  setError: (error: string) => {
    set({
      state: 'ended',
      callData: {
        ...get().callData,
        error,
        endedAt: Date.now(),
      },
      incomingCall: null,
    });
  },

  reset: () => {
    // Cleanup all resources
    const { localStream, remoteStream, peerConnection } = get().callData;
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }
    if (remoteStream) {
      remoteStream.getTracks().forEach(track => track.stop());
    }
    if (peerConnection) {
      peerConnection.close();
    }
    
    set({
      state: 'idle',
      callData: initialState,
      incomingCall: null,
    });
  },
}));

