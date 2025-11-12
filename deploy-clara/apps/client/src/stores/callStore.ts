/**
 * Client Call Store with Finite State Machine
 * Manages call state transitions: idle → preparing → dialing → ringing → connecting → in_call → ending → ended
 */
import { create } from 'zustand';

export type CallState = 
  | 'idle' 
  | 'preparing' 
  | 'dialing' 
  | 'ringing' 
  | 'connecting' 
  | 'in_call' 
  | 'ending' 
  | 'ended';

export interface CallData {
  callId?: string;
  staffId?: string;
  staffName?: string;
  reason?: string;
  startedAt?: number;
  endedAt?: number;
  error?: string;
  peerConnection?: RTCPeerConnection;
  localStream?: MediaStream;
  remoteStream?: MediaStream | null;
}

interface CallStore {
  state: CallState;
  callData: CallData;
  
  // Actions
  initiateCall: (reason?: string) => void;
  setPreparing: () => void;
  setDialing: (callId: string) => void;
  setRinging: () => void;
  setConnecting: () => void;
  setLocalStream: (stream?: MediaStream | null) => void;
  updateCallData: (data: Partial<CallData>) => void;
  setInCall: (data: Partial<CallData>) => void;
  cancelCall: () => void;
  onAccepted: (callId: string, staffInfo?: { id: string; name: string }) => void;
  onDeclined: (reason?: string) => void;
  onMissed: (reason?: string) => void;
  endCall: () => void;
  setError: (error: string) => void;
  reset: () => void;
  
  // State helpers
  canInitiate: () => boolean;
  canCancel: () => boolean;
  canEnd: () => boolean;
}

const initialState: CallData = {};

export const useCallStore = create<CallStore>((set, get) => ({
  state: 'idle',
  callData: initialState,

  canInitiate: () => {
    const state = get().state;
    return state === 'idle' || state === 'ended';
  },

  canCancel: () => {
    const state = get().state;
    return state === 'preparing' || state === 'dialing' || state === 'ringing';
  },

  canEnd: () => {
    const state = get().state;
    return state === 'in_call' || state === 'connecting';
  },

  initiateCall: (reason?: string) => {
    const currentState = get().state;
    if (currentState !== 'idle' && currentState !== 'ended') {
      console.warn('[CallStore] Cannot initiate call from state:', currentState);
      return;
    }
    
    set({
      state: 'preparing',
      callData: { reason },
    });
  },

  setPreparing: () => {
    const currentState = get().state;
    if (currentState !== 'idle' && currentState !== 'preparing') {
      console.warn('[CallStore] Invalid transition to preparing from:', currentState);
      return;
    }
    
    set({ state: 'preparing' });
  },

  setDialing: (callId: string) => {
    const currentState = get().state;
    if (currentState !== 'preparing' && currentState !== 'dialing') {
      console.warn('[CallStore] Invalid transition to dialing from:', currentState);
      return;
    }
    
    set({
      state: 'dialing',
      callData: { ...get().callData, callId, startedAt: Date.now() },
    });
  },

  setRinging: () => {
    const currentState = get().state;
    if (currentState !== 'dialing' && currentState !== 'ringing') {
      console.warn('[CallStore] Invalid transition to ringing from:', currentState);
      return;
    }
    
    set({ state: 'ringing' });
  },

  setConnecting: () => {
    const currentState = get().state;
    if (currentState !== 'ringing' && currentState !== 'connecting') {
      console.warn('[CallStore] Invalid transition to connecting from:', currentState);
      return;
    }
    
    set({ state: 'connecting' });
  },

  setLocalStream: (stream?: MediaStream | null) => {
    set({
      callData: {
        ...get().callData,
        localStream: stream ?? undefined,
      },
    });
  },

  updateCallData: (data: Partial<CallData>) => {
    set({
      callData: {
        ...get().callData,
        ...data,
      },
    });
  },

  setInCall: (data: Partial<CallData>) => {
    const currentState = get().state;
    if (currentState !== 'connecting' && currentState !== 'in_call') {
      console.warn('[CallStore] Invalid transition to in_call from:', currentState);
      return;
    }
    
    set({
      state: 'in_call',
      callData: { ...get().callData, ...data },
    });
  },

  cancelCall: () => {
    const currentState = get().state;
    if (!get().canCancel()) {
      console.warn('[CallStore] Cannot cancel call from state:', currentState);
      return;
    }
    
    // Cleanup media streams
    const { localStream, peerConnection } = get().callData;
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }
    if (peerConnection) {
      peerConnection.close();
    }
    
    set({
      state: 'ended',
      callData: { ...get().callData, endedAt: Date.now(), error: 'Call canceled' },
    });
  },

  onAccepted: (callId: string, staffInfo?: { id: string; name: string }) => {
    const currentState = get().state;
    if (currentState !== 'ringing' && currentState !== 'connecting') {
      console.warn('[CallStore] Cannot accept call from state:', currentState);
      return;
    }
    
    set({
      state: 'connecting',
      callData: {
        ...get().callData,
        callId,
        staffId: staffInfo?.id,
        staffName: staffInfo?.name,
      },
    });
  },

  onDeclined: (reason?: string) => {
    const currentState = get().state;
    if (currentState !== 'ringing' && currentState !== 'dialing') {
      console.warn('[CallStore] Cannot decline call from state:', currentState);
      return;
    }
    
    // Cleanup
    const { localStream, peerConnection } = get().callData;
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }
    if (peerConnection) {
      peerConnection.close();
    }
    
    set({
      state: 'ended',
      callData: {
        ...get().callData,
        endedAt: Date.now(),
        error: reason || 'Call declined by staff',
      },
    });
  },

  onMissed: (reason?: string) => {
    const currentState = get().state;
    if (currentState !== 'ringing' && currentState !== 'dialing') {
      console.warn('[CallStore] Cannot mark as missed from state:', currentState);
      return;
    }
    
    // Cleanup
    const { localStream, peerConnection } = get().callData;
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }
    if (peerConnection) {
      peerConnection.close();
    }
    
    set({
      state: 'ended',
      callData: {
        ...get().callData,
        endedAt: Date.now(),
        error: reason || 'Call missed - no staff available',
      },
    });
  },

  endCall: () => {
    const currentState = get().state;
    if (!get().canEnd()) {
      console.warn('[CallStore] Cannot end call from state:', currentState);
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
    });
  },
}));

