/**
 * Production-grade Call model following the spec
 * Supports: org scoping, race-condition safe accepts, timeouts, analytics
 */

export type CallStatus = 
  | 'initiated' 
  | 'ringing' 
  | 'accepted' 
  | 'declined' 
  | 'canceled' 
  | 'missed' 
  | 'ended';

export interface Call {
  id: string;
  orgId: string;
  status: CallStatus;
  createdByUserId: string;
  acceptedByUserId?: string;
  startedAt?: number;
  endedAt?: number;
  endedBy?: string;
  reason?: string;
  metadata?: Record<string, any>;
  ringExpiresAt?: number; // For timeout handling
  createdAt: number;
  updatedAt: number;
}

export interface CallParticipant {
  id: string;
  callId: string;
  userId: string;
  role: 'client' | 'staff';
  state: 'invited' | 'joined' | 'left';
  joinedAt?: number;
  leftAt?: number;
  stats?: {
    bitrate?: number;
    packetLoss?: number;
    jitter?: number;
    timestamp: number;
  }[];
}

export interface Device {
  id: string;
  userId: string;
  wsSessionId?: string;
  pushToken?: string;
  capabilities: {
    camera: boolean;
    mic: boolean;
  };
  availability: 'available' | 'busy' | 'offline';
  lastSeenAt: number;
}

export interface StaffAvailability {
  userId: string;
  orgId: string;
  status: 'available' | 'busy' | 'away' | 'offline';
  updatedAt: number;
  skills?: string[]; // For routing logic
}

