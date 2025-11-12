/**
 * Production-grade Call API endpoints
 * Implements: routing, CAS accept, timeout handling, proper state management
 */
import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { v4 as uuid } from 'uuid';
import { CallRepository } from '../repositories/CallRepository.js';
import { StaffAvailabilityRepository } from '../repositories/StaffAvailabilityRepository.js';
import { Call, CallParticipant, CallStatus } from '../models/Call.js';
import { Server as IOServer } from 'socket.io';
import { queuePendingCallNotification, clearPendingCallNotification } from '../utils/pendingNotifications.js';

const NAMESPACE = '/rtc';
const RING_TIMEOUT_MS = 45000; // 45 seconds

const rooms = {
  staff: (id: string) => `staff:${id}`,
  dept: (code: string) => `dept:${code}`,
  client: (id: string) => `client:${id}`,
  call: (id: string) => `call:${id}`,
  org: (id: string) => `org:${id}`,
};

// Map staff short codes (e.g., "acs", "ldn") to email prefixes (e.g., "anithacs", "lakshmidurgan")
// This matches the client's staffList mapping
const STAFF_CODE_TO_EMAIL_PREFIX: Record<string, string> = {
  'ldn': 'lakshmidurgan',
  'acs': 'anithacs',
  'gd': 'gdhivyasri',
  'nsk': 'nishask',
  'abp': 'amarnathbpatil',
  'nn': 'nagashreen',
  'akv': 'anilkumarkv',
  'jk': 'jyotikumari',
  'vr': 'vidyashreer',
  'ba': 'bhavanaa',
  'btn': 'bhavyatn',
};

// Helper function to normalize staffId - converts short codes to email prefixes
function normalizeStaffId(staffId: string): string {
  const lowerStaffId = staffId.toLowerCase();
  // If it's a known short code, return the email prefix
  if (STAFF_CODE_TO_EMAIL_PREFIX[lowerStaffId]) {
    return STAFF_CODE_TO_EMAIL_PREFIX[lowerStaffId];
  }
  // Otherwise, assume it's already an email prefix
  return staffId;
}

type AuthPayload = {
  userId: string;
  role: 'client' | 'staff';
  staffId?: string;
  dept?: string;
  tenant?: string;
  orgId?: string;
};

type AuthenticatedRequest = Request & { user?: AuthPayload };

export function createCallRoutes(
  callRepo: CallRepository,
  availabilityRepo: StaffAvailabilityRepository,
  io: IOServer
): Router {
  const router = Router();

  // POST /v1/calls - Initiate a call
  const initiateSchema = z.object({
    orgId: z.string().optional(),
    clientId: z.string(),
    clientName: z.string().optional(), // Client name from prechat form
    reason: z.string().optional(),
    targetStaffId: z.string().optional(),
    department: z.string().optional(),
  });

  router.post('/v1/calls', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const parsed = initiateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.message });
      }

      const { orgId, clientId, clientName, reason, targetStaffId, department } = parsed.data;
      const user = req.user!;
      const effectiveOrgId = orgId || user.orgId || 'default';

      // Create call record
      const callId = uuid();
      const now = Date.now();
      const call: Call = {
        id: callId,
        orgId: effectiveOrgId,
        status: 'initiated',
        createdByUserId: clientId,
        createdAt: now,
        updatedAt: now,
        reason,
        ringExpiresAt: now + RING_TIMEOUT_MS,
      };

      // Create participants
      const participants: CallParticipant[] = [
        {
          id: uuid(),
          callId,
          userId: clientId,
          role: 'client',
          state: 'invited',
        },
      ];

      // Call routing logic: find available staff
      let availableStaff: { userId: string; staffId?: string }[] = [];
      
      if (targetStaffId) {
        // Normalize targetStaffId - convert short code (e.g., "acs") to email prefix (e.g., "anithacs")
        const normalizedStaffId = normalizeStaffId(targetStaffId);
        console.log(`[Calls API] Normalized target staffId: ${targetStaffId} -> ${normalizedStaffId}`);

        const targetLower = targetStaffId.toLowerCase();
        const normalizedLower = normalizedStaffId.toLowerCase();

        // Pull current availability list once and match by either full id or prefix
        const staffList = await availabilityRepo.findAvailableStaff(effectiveOrgId);
        const matchedStaff = staffList.find((record) => {
          const userLower = record.userId.toLowerCase();
          const prefixLower = userLower.includes('@') ? userLower.split('@')[0] : userLower;
          return (
            record.status === 'available' &&
            (userLower === targetLower ||
              userLower === normalizedLower ||
              prefixLower === targetLower ||
              prefixLower === normalizedLower)
          );
        });

        if (matchedStaff) {
          const matchedStaffId = matchedStaff.userId.includes('@')
            ? matchedStaff.userId.split('@')[0]
            : matchedStaff.userId;
          availableStaff = [{ userId: matchedStaff.userId, staffId: normalizeStaffId(matchedStaffId) }];
        }
      } else {
        // Find available staff in org/department
        const staffList = await availabilityRepo.findAvailableStaff(
          effectiveOrgId,
          department ? [department] : undefined
        );
        availableStaff = staffList.map(s => ({
          userId: s.userId,
          staffId: normalizeStaffId(s.userId.includes('@') ? s.userId.split('@')[0] : s.userId),
        }));
      }

      console.log('[Calls API] Available staff for routing:', availableStaff.map(s => ({ userId: s.userId, staffId: s.staffId })));
      for (const staff of availableStaff) {
        participants.push({
          id: uuid(),
          callId,
          userId: staff.userId,
          role: 'staff',
          state: 'invited',
        });
      }

      if (availableStaff.length === 0) {
        // No available staff - mark as missed immediately
        call.status = 'missed';
        call.endedAt = now;
        call.reason = 'No available staff';
        await callRepo.create(call, participants);
        return res.status(503).json({
          error: 'No available staff',
          callId,
          status: 'missed',
        });
      }

      // Add staff participants
      for (const staff of availableStaff) {
        participants.push({
          id: uuid(),
          callId,
          userId: staff.userId,
          role: 'staff',
          state: 'invited',
        });
      }

      // Update call to ringing
      call.status = 'ringing';
      await callRepo.create(call, participants);

      // Emit call.initiated to all available staff
      const nsp = io.of(NAMESPACE);
      // Use clientName from request if provided, otherwise fallback to user.userId
      const displayName = clientName || user.userId;
      const clientInfo = {
        id: clientId,
        name: displayName,
        avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=6366f1&color=fff`,
      };

      for (const staff of availableStaff) {
        const staffIdForRoom = staff.staffId || staff.userId;
        const normalizedStaffId = normalizeStaffId(staffIdForRoom);
        const staffRoom = rooms.staff(normalizedStaffId);
        console.log(`[Calls API] Emitting to staff room: ${staffRoom} (staffId: ${normalizedStaffId})`);

        const payload = {
          callId,
          client: clientInfo,
          reason,
          createdAt: now,
        };

        const socketsInRoom = await nsp.in(staffRoom).fetchSockets();
        console.log(`[Calls API] Room ${staffRoom} currently has ${socketsInRoom.length} socket(s)`);
        if (socketsInRoom.length > 0) {
          nsp.to(staffRoom).emit('call.initiated', payload);
          socketsInRoom.forEach((socketInstance) => {
            try {
              socketInstance.emit('call.initiated', payload);
            } catch (socketError) {
              console.error(`[Calls API] Failed direct emit to socket ${socketInstance.id}:`, socketError);
            }
          });
          clearPendingCallNotification(normalizedStaffId, callId);
        } else {
          const namespaceSockets = await nsp.fetchSockets();
          const directSockets = namespaceSockets.filter((socketInstance) => {
            const socketUser = (socketInstance as any).user as AuthPayload | undefined;
            if (!socketUser || socketUser.role !== 'staff') {
              return false;
            }
            const socketStaffId = socketUser.staffId || (socketUser.userId.includes('@') ? socketUser.userId.split('@')[0] : socketUser.userId);
            return socketStaffId?.toLowerCase() === normalizedStaffId.toLowerCase();
          });

          if (directSockets.length > 0) {
            console.log(`[Calls API] Directly emitting call.initiated to ${directSockets.length} matched socket(s) for staff ${normalizedStaffId}`);
            directSockets.forEach((socketInstance) => {
              socketInstance.emit('call.initiated', payload);
            });
            clearPendingCallNotification(normalizedStaffId, callId);
          } else {
            console.log(`[Calls API] No active sockets in ${staffRoom}. Queueing notification.`);
            queuePendingCallNotification(normalizedStaffId, {
              callId,
              payload,
              queuedAt: Date.now(),
            });
          }
        }

        if (targetStaffId) {
          nsp.to(rooms.org(effectiveOrgId)).emit('call.initiated', {
            ...payload,
            targetStaffId: normalizedStaffId,
          });
        }
      }

      // Only broadcast to the entire organisation when no specific staff target was provided
      if (!targetStaffId) {
        nsp.to(rooms.org(effectiveOrgId)).emit('call.initiated', {
          callId,
          client: clientInfo,
          reason,
          createdAt: now,
        });
      }

      res.json({ callId, status: call.status });
    } catch (error: any) {
      console.error('[Calls API] Error initiating call:', error);
      res.status(500).json({ error: 'Failed to initiate call' });
    }
  });

  // POST /v1/calls/:callId/accept - Accept call (CAS-protected)
  router.post('/v1/calls/:callId/accept', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { callId } = req.params;
      const user = req.user!;

      if (user.role !== 'staff') {
        return res.status(403).json({ error: 'Only staff can accept calls' });
      }

      const call = await callRepo.get(callId);
      if (!call) {
        return res.status(404).json({ error: 'Call not found' });
      }

      // CAS operation: only accept if ringing and not already accepted
      const staffId = user.staffId || user.userId;
      const accepted = await callRepo.acceptCallCAS(callId, staffId);

      if (!accepted) {
        return res.status(409).json({
          error: 'Call already accepted or not in ringing state',
          callId,
        });
      }

      // Update participant state
      const participants = await callRepo.getParticipants(callId);
      const staffParticipant = participants.find(p => p.userId === staffId && p.role === 'staff');
      if (staffParticipant) {
        // TODO: Update participant state to 'joined'
      }

      // Clear queued notifications for all staff on this call
      for (const participant of participants.filter(p => p.role === 'staff')) {
        const participantStaffId = normalizeStaffId(participant.userId);
        clearPendingCallNotification(participantStaffId, callId);
      }

      // Emit call.accepted to all parties
      const nsp = io.of(NAMESPACE);
      const staffInfo = {
        id: staffId,
        name: user.userId,
      };

      // Notify client
      nsp.to(rooms.client(call.createdByUserId)).emit('call.accepted', {
        callId,
        staff: staffInfo,
      });

      // Notify all staff (others' popups should auto-dismiss)
      nsp.to(rooms.org(call.orgId)).emit('call.accepted', {
        callId,
        staff: staffInfo,
      });

      // Also emit to call room
      nsp.to(rooms.call(callId)).emit('call:update', {
        callId,
        state: 'accepted',
        staffId,
      });

      res.json({ callId, status: 'accepted', staffId });
    } catch (error: any) {
      console.error('[Calls API] Error accepting call:', error);
      res.status(500).json({ error: 'Failed to accept call' });
    }
  });

  // POST /v1/calls/:callId/decline
  router.post('/v1/calls/:callId/decline', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { callId } = req.params;
      const { reason } = req.body;
      const user = req.user!;

      const call = await callRepo.get(callId);
      if (!call) {
        return res.status(404).json({ error: 'Call not found' });
      }

      // Only staff can decline
      if (user.role !== 'staff') {
        return res.status(403).json({ error: 'Only staff can decline calls' });
      }

      // Update status
      await callRepo.updateStatus(callId, 'declined', { reason });

      // Emit decline notifications
      const nsp = io.of(NAMESPACE);
      const declinePayload = {
        callId,
        reason: reason || 'Call declined by staff',
      };

      nsp.to(rooms.client(call.createdByUserId)).emit('call.declined', declinePayload);
      nsp.to(rooms.call(callId)).emit('call.declined', declinePayload);
      nsp.to(rooms.org(call.orgId)).emit('call.declined', {
        ...declinePayload,
        staffId: user.staffId || user.userId,
      });

      const staffId = user.staffId || user.userId;
      clearPendingCallNotification(normalizeStaffId(staffId), callId);

      nsp.to(rooms.call(callId)).emit('call:update', {
        callId,
        state: 'declined',
        reason,
      });

      res.json({ callId, status: 'declined' });
    } catch (error: any) {
      console.error('[Calls API] Error declining call:', error);
      res.status(500).json({ error: 'Failed to decline call' });
    }
  });

  // POST /v1/calls/:callId/cancel
  router.post('/v1/calls/:callId/cancel', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { callId } = req.params;
      const user = req.user!;

      const call = await callRepo.get(callId);
      if (!call) {
        return res.status(404).json({ error: 'Call not found' });
      }

      // Only client can cancel
      if (call.createdByUserId !== user.userId) {
        return res.status(403).json({ error: 'Only call creator can cancel' });
      }

      if (call.status !== 'ringing' && call.status !== 'initiated') {
        return res.status(400).json({ error: 'Call cannot be canceled in current state' });
      }

      await callRepo.updateStatus(callId, 'canceled', { endedAt: Date.now() });

      // Emit to all staff
      const nsp = io.of(NAMESPACE);
      nsp.to(rooms.org(call.orgId)).emit('call.canceled', { callId });
      nsp.to(rooms.call(callId)).emit('call:update', { callId, state: 'canceled' });

      const participants = await callRepo.getParticipants(callId);
      for (const participant of participants.filter(p => p.role === 'staff')) {
        clearPendingCallNotification(normalizeStaffId(participant.userId), callId);
      }

      res.json({ callId, status: 'canceled' });
    } catch (error: any) {
      console.error('[Calls API] Error canceling call:', error);
      res.status(500).json({ error: 'Failed to cancel call' });
    }
  });

  // POST /v1/calls/:callId/end
  router.post('/v1/calls/:callId/end', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { callId } = req.params;
      const user = req.user!;

      const call = await callRepo.get(callId);
      if (!call) {
        return res.status(404).json({ error: 'Call not found' });
      }

      // Either party can end - handle userId format mismatches
      // Extract staffId from user (could be email prefix or direct staffId)
      const userStaffId = user.staffId || (user.userId.includes('@') ? user.userId.split('@')[0] : user.userId);
      const normalizedUserStaffId = userStaffId.toLowerCase();
      
      // Check if user is the creator
      const isCreator = call.createdByUserId === user.userId || call.createdByUserId === userStaffId;
      
      // Check if user is the accepter (handle both email and staffId formats)
      const acceptedByStaffId = call.acceptedByUserId ? 
        (call.acceptedByUserId.includes('@') ? call.acceptedByUserId.split('@')[0] : call.acceptedByUserId).toLowerCase() : 
        null;
      const isAccepter = call.acceptedByUserId === user.userId || 
                         call.acceptedByUserId === userStaffId ||
                         (acceptedByStaffId && acceptedByStaffId === normalizedUserStaffId);
      
      const isParticipant = isCreator || isAccepter;
      
      if (!isParticipant) {
        return res.status(403).json({ error: 'Not a participant in this call' });
      }

      await callRepo.updateStatus(callId, 'ended', { endedAt: Date.now(), endedBy: user.userId });

      const nsp = io.of(NAMESPACE);
      nsp.to(rooms.org(call.orgId)).emit('call.ended', { callId, endedBy: user.userId });
      nsp.to(rooms.call(callId)).emit('call:update', { callId, state: 'ended' });

      const participants = await callRepo.getParticipants(callId);
      for (const participant of participants.filter(p => p.role === 'staff')) {
        clearPendingCallNotification(normalizeStaffId(participant.userId), callId);
      }

      res.json({ callId, status: 'ended' });
    } catch (error: any) {
      console.error('[Calls API] Error ending call:', error);
      res.status(500).json({ error: 'Failed to end call' });
    }
  });

  // GET /v1/calls/:callId
  router.get('/v1/calls/:callId', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { callId } = req.params;
      const call = await callRepo.get(callId);
      
      if (!call) {
        return res.status(404).json({ error: 'Call not found' });
      }

      const participants = await callRepo.getParticipants(callId);
      res.json({ ...call, participants });
    } catch (error: any) {
      console.error('[Calls API] Error getting call:', error);
      res.status(500).json({ error: 'Failed to get call' });
    }
  });

  return router;
}

