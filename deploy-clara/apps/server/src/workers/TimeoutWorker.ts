/**
 * Timeout Worker
 * Background job that marks calls as 'missed' if they timeout (45s ring timeout)
 * Runs every 10 seconds to check for timed-out calls
 */
import { CallRepository } from '../repositories/CallRepository.js';
import { Server as IOServer } from 'socket.io';
import { Call } from '../models/Call.js';

const NAMESPACE = '/rtc';
const rooms = {
  client: (id: string) => `client:${id}`,
  call: (id: string) => `call:${id}`,
};

export class TimeoutWorker {
  private callRepo: CallRepository;
  private io: IOServer;
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor(callRepo: CallRepository, io: IOServer) {
    this.callRepo = callRepo;
    this.io = io;
  }

  start() {
    if (this.isRunning) {
      console.warn('[TimeoutWorker] Already running');
      return;
    }

    this.isRunning = true;
    console.log('[TimeoutWorker] Started - checking for timed-out calls every 10s');

    // Check immediately, then every 10 seconds
    this.check();
    this.intervalId = setInterval(() => this.check(), 10000);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log('[TimeoutWorker] Stopped');
  }

  private async check() {
    try {
      const timedOutCalls = await this.callRepo.findTimedOutCalls();
      
      if (timedOutCalls.length === 0) {
        return;
      }

      console.log(`[TimeoutWorker] Found ${timedOutCalls.length} timed-out call(s)`);

      for (const call of timedOutCalls) {
        await this.handleTimedOutCall(call);
      }
    } catch (error) {
      console.error('[TimeoutWorker] Error checking for timed-out calls:', error);
    }
  }

  private async handleTimedOutCall(call: Call) {
    try {
      // Update call status to 'missed'
      await this.callRepo.updateStatus(call.id, 'missed', {
        endedAt: Date.now(),
        reason: 'Ring timeout (45s)',
      });

      // Emit missed event to client
      const nsp = this.io.of(NAMESPACE);
      nsp.to(rooms.client(call.createdByUserId)).emit('call.missed', {
        callId: call.id,
        reason: 'No staff available to answer',
      });

      // Emit to call room as well
      nsp.to(rooms.call(call.id)).emit('call:update', {
        callId: call.id,
        state: 'missed',
        reason: 'Ring timeout',
      });

      console.log(`[TimeoutWorker] Marked call ${call.id} as missed`);
    } catch (error) {
      console.error(`[TimeoutWorker] Error handling timed-out call ${call.id}:`, error);
    }
  }
}

