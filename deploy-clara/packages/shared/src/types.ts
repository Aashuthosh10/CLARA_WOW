export type Role = 'client' | 'staff';

export interface AuthPayload {
  userId: string;
  role: Role;
  staffId?: string;
  dept?: string;
  tenant?: string;
}

export interface CallSession {
  call_id: string;
  client_id: string;
  staff_id?: string;
  dept_code?: string;
  state: 'created' | 'ringing' | 'accepted' | 'declined' | 'ended';
  created_at: number;
  updated_at: number;
  sdp_offer?: any;
  sdp_answer?: any;
}

export interface InitiateCallRequest {
  clientId: string;
  targetStaffId?: string;
  department?: string;
  purpose?: string;
}

export interface AcceptDeclineRequest {
  callId: string;
  staffId: string;
  reason?: string;
}

export interface SDPRequest {
  callId: string;
  from: string;
  type: 'offer' | 'answer';
  sdp: any;
}

export interface ICERequest {
  callId: string;
  from: string;
  candidate: RTCIceCandidateInit;
}

