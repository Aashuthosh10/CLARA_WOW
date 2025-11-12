export function validateSDP(sdp: any): boolean {
  if (!sdp || typeof sdp !== 'string') return false;
  return sdp.includes('v=') && sdp.includes('m=');
}

export function validateIceCandidate(candidate: any): boolean {
  if (!candidate) return false;
  return typeof candidate.candidate === 'string' && candidate.candidate.length > 0;
}

