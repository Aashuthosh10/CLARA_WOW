import { Namespace } from 'socket.io';
import { CallRepository as OldCallRepository } from './repository.js';
import { CallRepository } from './repositories/CallRepository.js';
import { consumePendingCallNotifications, clearPendingCallNotification } from './utils/pendingNotifications.js';

type AppointmentRepository = {
  findByStaff: (staffId: string, filter?: { status?: string }) => Promise<any[]>;
  get: (appointmentId: string) => Promise<any | undefined>;
  update: (appointment: any) => Promise<void>;
};

type SessionRepository = unknown;

type AuthPayload = {
  userId: string;
  role: 'client' | 'staff';
  staffId?: string;
  dept?: string;
  tenant?: string;
};

const rooms = {
  staff: (id: string) => `staff:${id}`,
  dept: (code: string) => `dept:${code}`,
  client: (id: string) => `client:${id}`,
  call: (id: string) => `call:${id}`,
  org: (id: string) => `org:${id}`,
};

export function setupSocketHandlers(
  nsp: Namespace, 
  oldCallRepo: OldCallRepository,
  sessionRepo?: SessionRepository,
  appointmentRepo?: AppointmentRepository,
  newCallRepo?: CallRepository
) {
  nsp.on('connection', async (socket) => {
    const user: AuthPayload = (socket as any).user;
    
    console.log(`[Socket] ===== NEW CONNECTION =====`);
    console.log(`[Socket] Socket ID: ${socket.id}`);
    console.log(`[Socket] User: ${user.userId}, Role: ${user.role}, StaffId: ${user.staffId}`);
    console.log(`[Socket] Full user payload:`, JSON.stringify(user, null, 2));
    
    // Join role-based rooms
    if (user.role === 'staff') {
      // Extract staffId from email prefix if staffId is not set, or use staffId directly
      // This handles both email-based (e.g., "anithacs") and short code (e.g., "acs") formats
      const staffId = user.staffId || (user.userId.includes('@') ? user.userId.split('@')[0] : user.userId);
      const staffRoom = rooms.staff(staffId);
      socket.join(staffRoom);
      console.log(`[Socket] ✅ Staff ${staffId} (userId: ${user.userId}) joined room: ${staffRoom}`);
      
      // Verify room membership immediately
      const roomSockets = await nsp.in(staffRoom).fetchSockets();
      console.log(`[Socket] ✅ Room ${staffRoom} now has ${roomSockets.length} socket(s)`);
      roomSockets.forEach(s => {
        const sUser = (s as any).user;
        console.log(`[Socket]   - Socket ${s.id}: userId=${sUser?.userId}, staffId=${sUser?.staffId}`);
      });

      const queuedNotifications = consumePendingCallNotifications(staffId);
      for (const notification of queuedNotifications) {
        let shouldEmit = true;
        if (newCallRepo) {
          try {
            const call = await newCallRepo.get(notification.callId);
            if (call && call.status && call.status !== 'ringing' && call.status !== 'initiated') {
              shouldEmit = false;
              clearPendingCallNotification(staffId, notification.callId);
            }
          } catch (error) {
            console.error(`[Socket] Failed to validate queued call ${notification.callId}:`, error);
          }
        }

        if (shouldEmit) {
          console.log(`[Socket] Delivering queued call.initiated for call ${notification.callId} to staff ${staffId}`);
          socket.emit('call.initiated', notification.payload);
        }
      }
      
      if (user.dept) {
        const deptRoom = rooms.dept(user.dept);
        socket.join(deptRoom);
        console.log(`[Socket] Staff ${user.staffId} joined dept room: ${deptRoom}`);
      }

      // Join org room if orgId is available
      const orgId = (user as any).orgId || 'default';
      const orgRoom = rooms.org(orgId);
      socket.join(orgRoom);
      console.log(`[Socket] Staff ${user.staffId} joined org room: ${orgRoom}`);

      // Send pending notifications to staff on connect
      if (appointmentRepo && staffId) {
        try {
          const pendingAppointments = await appointmentRepo.findByStaff(staffId, { status: 'Pending' });
          if (pendingAppointments.length > 0) {
            socket.emit('notifications:appointments', {
              type: 'pending_appointments',
              count: pendingAppointments.length,
              appointments: pendingAppointments.slice(0, 5) // Send top 5
            });
          }
        } catch (error) {
          console.error('Error fetching pending appointments:', error);
        }
      }
    }
    if (user.role === 'client') {
      const clientRoom = rooms.client(user.userId);
      socket.join(clientRoom);
      console.log(`[Socket] Client ${user.userId} joined room: ${clientRoom}`);
      
      // Join org room if orgId is available
      const orgId = (user as any).orgId || 'default';
      const orgRoom = rooms.org(orgId);
      socket.join(orgRoom);
      console.log(`[Socket] Client ${user.userId} joined org room: ${orgRoom}`);
    }

    // Join staff room explicitly (in case it wasn't joined on connect)
    socket.on('join:staff', ({ staffId }: { staffId: string }) => {
      console.log(`[Socket] ===== RECEIVED join:staff REQUEST =====`);
      console.log(`[Socket] Requested staffId: ${staffId}`);
      console.log(`[Socket] User role: ${user.role}`);
      console.log(`[Socket] User staffId: ${user.staffId}`);
      console.log(`[Socket] User userId: ${user.userId}`);
      console.log(`[Socket] Socket ID: ${socket.id}`);
      
      if (user.role === 'staff') {
        // Extract staffId from user (email prefix or staffId)
        const userStaffId = user.staffId || (user.userId.includes('@') ? user.userId.split('@')[0] : user.userId);
        
        // Allow joining if staffId matches (direct match) or if userId matches (email prefix match)
        // Also handle short code matching (e.g., "acs" should match "anithacs")
        if (userStaffId === staffId || user.userId === staffId || user.userId.startsWith(staffId + '@')) {
          const staffRoom = rooms.staff(staffId);
          socket.join(staffRoom);
          console.log(`[Socket] ✅ Staff ${staffId} (userId: ${user.userId}) successfully joined room: ${staffRoom}`);
        
        // Verify room membership immediately
        nsp.in(staffRoom).fetchSockets().then(sockets => {
          console.log(`[Socket] ✅ Room ${staffRoom} verification: ${sockets.length} socket(s) present`);
          sockets.forEach(s => {
            const sUser = (s as any).user;
            console.log(`[Socket]   - Socket ${s.id}: userId=${sUser?.userId}, staffId=${sUser?.staffId}`);
          });
        });

        const queuedNotifications = consumePendingCallNotifications(staffId);
        if (queuedNotifications.length > 0) {
          (async () => {
            for (const notification of queuedNotifications) {
              let shouldEmit = true;
              if (newCallRepo) {
                try {
                  const call = await newCallRepo.get(notification.callId);
                  if (call && call.status && call.status !== 'ringing' && call.status !== 'initiated') {
                    shouldEmit = false;
                    clearPendingCallNotification(staffId, notification.callId);
                  }
                } catch (error) {
                  console.error(`[Socket] Failed to validate queued call ${notification.callId}:`, error);
                }
              }

              if (shouldEmit) {
                console.log(`[Socket] Delivering queued call.initiated for call ${notification.callId} to staff ${staffId}`);
                socket.emit('call.initiated', notification.payload);
              }
            }
          })();
        }
        } else {
          console.error(`[Socket] ❌ join:staff REJECTED - staffId mismatch`);
          console.error(`[Socket] Expected: staffId=${staffId}`);
          console.error(`[Socket] Got: userStaffId=${userStaffId}, userId=${user.userId}`);
        }
      } else {
        console.error(`[Socket] ❌ join:staff REJECTED - not a staff user`);
        console.error(`[Socket] User role: ${user.role}`);
      }
    });

    // Join a specific call room
    socket.on('join:call', async ({ callId }: { callId: string }) => {
      const callRoom = rooms.call(callId);
      socket.join(callRoom);
      console.log(`[Socket] Socket ${socket.id} joined call room: ${callRoom}`);
      
      // Try new repository first, fallback to old
      let call = null;
      if (newCallRepo) {
        call = await newCallRepo.get(callId);
      }
      if (!call) {
        const sess = await oldCallRepo.get(callId);
        if (sess) {
          // Convert old format to new format for compatibility
          socket.emit('call:update', { callId, state: sess.state });
          if (sess.sdp_answer) {
            console.log(`[Socket] Sending stored answer to newly joined socket for call ${callId}`);
            socket.emit('call:sdp', { callId, type: 'answer', sdp: sess.sdp_answer });
            socket.emit('webrtc.answer', { callId, sdp: sess.sdp_answer });
          }
          if (sess.sdp_offer && user.role === 'staff') {
            console.log(`[Socket] Sending stored offer to newly joined staff socket for call ${callId}`);
            socket.emit('call:sdp', { callId, type: 'offer', sdp: sess.sdp_offer });
            socket.emit('webrtc.offer', { callId, sdp: sess.sdp_offer });
          }
        }
      } else {
        // New repository format - send stored SDP from metadata
        socket.emit('call:update', { callId, state: call.status });
        if (call.metadata) {
          if (call.metadata.sdp_offer && user.role === 'staff') {
            console.log(`[Socket] Sending stored offer from metadata to newly joined staff socket for call ${callId}`);
            socket.emit('call:sdp', { callId, type: 'offer', sdp: call.metadata.sdp_offer });
            socket.emit('webrtc.offer', { callId, sdp: call.metadata.sdp_offer });
          }
          if (call.metadata.sdp_answer) {
            console.log(`[Socket] Sending stored answer from metadata to newly joined socket for call ${callId}`);
            socket.emit('call:sdp', { callId, type: 'answer', sdp: call.metadata.sdp_answer });
            socket.emit('webrtc.answer', { callId, sdp: call.metadata.sdp_answer });
          }
        }
      }
    });

    // Staff accepts call - use CAS if new repository available
    socket.on('call:accept', async ({ callId }: { callId: string }) => {
      if (newCallRepo && user.staffId) {
        // Use CAS for race-condition safe accept
        const accepted = await newCallRepo.acceptCallCAS(callId, user.staffId);
        if (accepted) {
          const call = await newCallRepo.get(callId);
          if (call) {
            const orgId = call.orgId || 'default';
            // Emit new event names
            nsp.to(rooms.client(call.createdByUserId)).emit('call.accepted', {
              callId,
              staff: { id: user.staffId, name: user.userId },
            });
            nsp.to(rooms.org(orgId)).emit('call.accepted', {
              callId,
              staff: { id: user.staffId, name: user.userId },
            });
            nsp.to(rooms.call(callId)).emit('call:update', { callId, state: 'accepted', staffId: user.staffId });
          }
          return;
        } else {
          // CAS failed - call already accepted
          socket.emit('call:update', { callId, state: 'accepted', error: 'Call already accepted by another staff' });
          return;
        }
      }
      
      // Fallback to old repository
      const sess = await oldCallRepo.get(callId);
      if (!sess) return;
      
      sess.state = 'accepted';
      sess.staff_id = user.staffId;
      sess.updated_at = Date.now();
      
      await oldCallRepo.update(sess);
      nsp.to(rooms.call(callId)).emit('call:update', { callId, state: 'accepted', staffId: user.staffId });
    });

    // Staff declines call
    socket.on('call:decline', async ({ callId, reason }: { callId: string; reason?: string }) => {
      if (newCallRepo) {
        const call = await newCallRepo.get(callId);
        if (call) {
          await newCallRepo.updateStatus(callId, 'declined', { reason });
          // Emit new event names
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
          nsp.to(rooms.call(callId)).emit('call:update', { callId, state: 'declined', reason });
          return;
        }
      }
      
      // Fallback to old repository
      const sess = await oldCallRepo.get(callId);
      if (!sess) return;
      
      sess.state = 'declined';
      sess.staff_id = user.staffId;
      sess.updated_at = Date.now();
      
      await oldCallRepo.update(sess);
      const declinePayload = {
        callId,
        reason: reason || 'Call declined by staff',
      };
      const legacyClientId = (sess as any).client_id || (sess as any).clientId || callId;
      nsp.to(rooms.client(legacyClientId)).emit('call.declined', declinePayload);
      nsp.to(rooms.call(callId)).emit('call.declined', declinePayload);
      nsp.to(rooms.call(callId)).emit('call:update', { callId, state: 'declined', reason });
    });

    // SDP exchange - also emit as webrtc.offer/webrtc.answer for new spec
    socket.on('call:sdp', async ({ callId, type, sdp }: { callId: string; type: 'offer' | 'answer'; sdp: any }) => {
      let callExists = false;
      
      // Try new repository first
      if (newCallRepo) {
        const call = await newCallRepo.get(callId);
        if (call) {
          callExists = true;
          // Update call metadata with SDP (new repo doesn't store SDP directly, but we can in metadata)
          try {
            await newCallRepo.updateStatus(callId, call.status, {
              metadata: { ...(call.metadata || {}), [`sdp_${type}`]: sdp },
            });
          } catch (e) {
            console.error(`[Socket] Failed to update call metadata with SDP: ${e}`);
          }
        }
      }
      
      // Fallback to old repository if new one doesn't have the call
      if (!callExists) {
        const sess = await oldCallRepo.get(callId);
        if (sess) {
          callExists = true;
          if (type === 'offer') sess.sdp_offer = sdp;
          else sess.sdp_answer = sdp;
          sess.updated_at = Date.now();
          
          try {
            await oldCallRepo.update(sess);
          } catch (e) {
            console.error(`[Socket] Failed to update old call repo with SDP: ${e}`);
          }
        }
      }
      
      if (!callExists) {
        console.error(`[Socket] Call ${callId} not found in any repository for SDP exchange - will still attempt to broadcast`);
        // Don't return - still try to broadcast in case sockets are in the room
      }
      
      console.log(`[Socket] Broadcasting ${type} for call ${callId} to room ${rooms.call(callId)}`);
      
      // Get all sockets in the call room
      const roomSockets = await nsp.in(rooms.call(callId)).fetchSockets();
      console.log(`[Socket] Room ${rooms.call(callId)} has ${roomSockets.length} socket(s)`);
      
      // Emit both old and new event names for compatibility
      // Use nsp.to() to broadcast to room (excludes sender)
      nsp.to(rooms.call(callId)).emit('call:sdp', { callId, type, sdp });
      nsp.to(rooms.call(callId)).emit(`webrtc.${type}`, { callId, sdp });
      
      // Also send directly to each socket in the room (excluding sender) for immediate delivery
      roomSockets.forEach(s => {
        if (s.id !== socket.id) {
          console.log(`[Socket] Sending ${type} directly to socket ${s.id}`);
          s.emit('call:sdp', { callId, type, sdp });
          s.emit(`webrtc.${type}`, { callId, sdp });
        }
      });
      
      // If no one is in the room yet, the SDP is stored in metadata and will be sent when they join
    });

    // ICE candidate exchange - also emit as webrtc.ice for new spec
    socket.on('call:ice', async ({ callId, candidate }: { callId: string; candidate: any }) => {
      // Verify call exists (but don't block if it doesn't - ICE can be sent before call is fully established)
      let callExists = false;
      if (newCallRepo) {
        const call = await newCallRepo.get(callId);
        callExists = !!call;
      }
      if (!callExists) {
        const sess = await oldCallRepo.get(callId);
        callExists = !!sess;
      }
      
      if (!callExists) {
        console.warn(`[Socket] Call ${callId} not found for ICE candidate exchange - will still attempt to broadcast`);
        // Don't return - still try to broadcast in case sockets are in the room
      }
      
      console.log(`[Socket] Broadcasting ICE candidate for call ${callId} to room ${rooms.call(callId)}`);
      
      // Get all sockets in the call room
      const roomSockets = await nsp.in(rooms.call(callId)).fetchSockets();
      console.log(`[Socket] Room ${rooms.call(callId)} has ${roomSockets.length} socket(s) for ICE`);
      
      // Broadcast to all participants in the call room (both old and new event names)
      // Use nsp.to() to broadcast to room (excludes sender)
      nsp.to(rooms.call(callId)).emit('call:ice', { callId, candidate });
      nsp.to(rooms.call(callId)).emit('webrtc.ice', { callId, candidate });
      
      // Also send directly to each socket in the room (excluding sender) for immediate delivery
      roomSockets.forEach(s => {
        if (s.id !== socket.id) {
          console.log(`[Socket] Sending ICE candidate directly to socket ${s.id}`);
          s.emit('call:ice', { callId, candidate });
          s.emit('webrtc.ice', { callId, candidate });
        }
      });
    });

    // Notification handlers
    socket.on('notifications:mark-read', async ({ notificationId }: { notificationId: string }) => {
      // Handle marking notification as read
      socket.emit('notifications:read', { notificationId });
    });

    socket.on('notifications:mark-all-read', async () => {
      // Handle marking all notifications as read
      socket.emit('notifications:all-read', { success: true });
    });

    // Appointment notification handlers
    socket.on('appointment:request', async ({ appointmentId, staffId }: { appointmentId: string; staffId: string }) => {
      if (appointmentRepo) {
        const appointment = await appointmentRepo.get(appointmentId);
        if (appointment && appointment.staffId === staffId) {
          // Notify staff about new appointment request
          nsp.to(rooms.staff(staffId)).emit('notifications:appointment', {
            type: 'new_appointment',
            appointment: {
              appointmentId: appointment.appointmentId,
              clientName: appointment.clientName,
              purpose: appointment.purpose,
              appointmentDate: appointment.appointmentDate,
              appointmentTime: appointment.appointmentTime
            }
          });
        }
      }
    });

    socket.on('appointment:decision', async ({ appointmentId, decision, staffId }: { appointmentId: string; decision: 'approved' | 'rejected'; staffId: string }) => {
      if (appointmentRepo) {
        const appointment = await appointmentRepo.get(appointmentId);
        if (appointment) {
          const updatedAppointment = {
            ...appointment,
            status: decision === 'approved' ? 'Confirmed' as const : 'Cancelled' as const,
            updatedAt: Date.now()
          };
          await appointmentRepo.update(updatedAppointment);

          // Notify client about decision
          nsp.to(rooms.client(appointment.clientId)).emit('notifications:appointment_decision', {
            appointmentId,
            decision,
            appointment: updatedAppointment
          });

          // Notify staff
          nsp.to(rooms.staff(staffId)).emit('notifications:appointment_updated', {
            appointmentId,
            status: updatedAppointment.status
          });
        }
      }
    });

    socket.on(
      'call:appointment',
      async ({
        callId,
        status,
        details,
      }: {
        callId: string;
        status: 'confirmed' | 'rejected';
        details?: Record<string, any>;
      }) => {
        if (user.role !== 'staff') {
          console.warn('[Socket] call:appointment ignored for non-staff user');
          return;
        }

        const normalizedStatus = status === 'confirmed' ? 'confirmed' : 'rejected';
        let clientId: string | null = null;

        if (newCallRepo) {
          try {
            const call = await newCallRepo.get(callId);
            if (call?.createdByUserId) {
              clientId = call.createdByUserId;
            }
          } catch (error) {
            console.warn('[Socket] Unable to fetch call from newCallRepo for appointment update:', error);
          }
        }

        if (!clientId) {
          try {
            const session = await oldCallRepo.get(callId);
            if (session) {
              clientId =
                (session as any).createdByUserId ||
                (session as any).created_by ||
                (session as any).client_id ||
                (session as any).clientId ||
                null;
            }
          } catch (error) {
            console.warn('[Socket] Unable to fetch call from oldCallRepo for appointment update:', error);
          }
        }

        if (!clientId) {
          console.warn(`[Socket] Unable to resolve clientId for call ${callId} when sending appointment update`);
          return;
        }

        const payload = {
          callId,
          status: normalizedStatus,
          details: details || {},
        };

        nsp.to(rooms.client(clientId)).emit('call.appointment', payload);
        nsp.to(rooms.call(callId)).emit('call:appointment', payload);
      }
    );

    socket.on('disconnect', () => {
      console.log(`User ${user.userId} disconnected`);
    });
  });
}

