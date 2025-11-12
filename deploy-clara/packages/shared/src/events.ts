 export const NAMESPACE = '/rtc';

export const rooms = {
  staff: (id: string) => `staff:${id}`,
  dept: (code: string) => `dept:${code}`,
  client: (id: string) => `client:${id}`,
  call: (id: string) => `call:${id}`,
} as const;

export type CallState = 'created' | 'ringing' | 'accepted' | 'declined' | 'ended';

export interface CallIncomingEvent {
  callId: string;
  clientInfo: {
    clientId: string;
    name?: string;
    phone?: string;
  };
  purpose?: string;
  ts: number;
}

export interface CallUpdateEvent {
  state: CallState;
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

