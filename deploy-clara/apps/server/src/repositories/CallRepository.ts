/**
 * Production-grade Call Repository with CAS (Compare-And-Swap) support
 * Implements race-condition safe accept operations
 */
import { Pool, QueryResult } from 'pg';
import { Call, CallParticipant, CallStatus } from '../models/Call.js';
import dotenv from 'dotenv';

dotenv.config();

export class CallRepository {
  private pool: Pool | null = null;
  private memoryStore: Map<string, Call> = new Map();
  private participantsStore: Map<string, CallParticipant[]> = new Map();
  private useMemory = false;

  constructor() {
    const dbUrl = process.env.DATABASE_URL;
    if (dbUrl && dbUrl.startsWith('postgres')) {
      try {
        this.pool = new Pool({ connectionString: dbUrl });
        this.initDb().catch(console.error);
      } catch (e) {
        console.warn('Failed to connect to Postgres, using in-memory store:', e);
        this.useMemory = true;
      }
    } else {
      this.useMemory = true;
      console.log('Using in-memory store (no DATABASE_URL)');
    }
  }

  private async initDb() {
    if (!this.pool) return;
    
    try {
      // Calls table with proper indexes
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS calls (
          id VARCHAR(255) PRIMARY KEY,
          org_id VARCHAR(255) NOT NULL,
          status VARCHAR(50) NOT NULL,
          created_by_user_id VARCHAR(255) NOT NULL,
          accepted_by_user_id VARCHAR(255),
          started_at BIGINT,
          ended_at BIGINT,
          reason TEXT,
          metadata JSONB,
          ring_expires_at BIGINT,
          created_at BIGINT NOT NULL,
          updated_at BIGINT NOT NULL
        );
      `);

      // Indexes for performance
      await this.pool.query(`
        CREATE INDEX IF NOT EXISTS idx_calls_status ON calls(status);
        CREATE INDEX IF NOT EXISTS idx_calls_org_id ON calls(org_id);
        CREATE INDEX IF NOT EXISTS idx_calls_ring_expires_at ON calls(ring_expires_at) WHERE status = 'ringing';
      `);

      // CallParticipants table
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS call_participants (
          id VARCHAR(255) PRIMARY KEY,
          call_id VARCHAR(255) NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
          user_id VARCHAR(255) NOT NULL,
          role VARCHAR(50) NOT NULL,
          state VARCHAR(50) NOT NULL,
          joined_at BIGINT,
          left_at BIGINT,
          stats JSONB,
          created_at BIGINT NOT NULL
        );
      `);

      await this.pool.query(`
        CREATE INDEX IF NOT EXISTS idx_call_participants_call_id ON call_participants(call_id);
        CREATE INDEX IF NOT EXISTS idx_call_participants_user_id ON call_participants(user_id);
      `);

      console.log('✅ Database schema initialized');
    } catch (e) {
      console.error('Failed to initialize database:', e);
      this.useMemory = true;
      this.pool = null;
    }
  }

  async create(call: Call, participants: CallParticipant[]): Promise<void> {
    if (this.useMemory || !this.pool) {
      this.memoryStore.set(call.id, { ...call });
      this.participantsStore.set(call.id, participants.map(p => ({ ...p })));
      return;
    }

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      
      // Insert call
      await client.query(
        `INSERT INTO calls (id, org_id, status, created_by_user_id, accepted_by_user_id, started_at, ended_at, reason, metadata, ring_expires_at, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [
          call.id, call.orgId, call.status, call.createdByUserId,
          call.acceptedByUserId || null, call.startedAt || null, call.endedAt || null,
          call.reason || null, call.metadata ? JSON.stringify(call.metadata) : null,
          call.ringExpiresAt || null, call.createdAt, call.updatedAt
        ]
      );

      // Insert participants
      for (const p of participants) {
        await client.query(
          `INSERT INTO call_participants (id, call_id, user_id, role, state, joined_at, left_at, stats, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            p.id, p.callId, p.userId, p.role, p.state,
            p.joinedAt || null, p.leftAt || null,
            p.stats ? JSON.stringify(p.stats) : null,
            Date.now()
          ]
        );
      }

      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      console.error('Failed to create call in DB:', e);
      this.memoryStore.set(call.id, { ...call });
      this.participantsStore.set(call.id, participants.map(p => ({ ...p })));
    } finally {
      client.release();
    }
  }

  async get(callId: string): Promise<Call | null> {
    if (this.useMemory || !this.pool) {
      return this.memoryStore.get(callId) || null;
    }

    try {
      const result: QueryResult = await this.pool.query(
        'SELECT * FROM calls WHERE id = $1',
        [callId]
      );
      
      if (result.rows.length === 0) return null;
      
      const row = result.rows[0];
      const metadata = row.metadata || {};
      return {
        id: row.id,
        orgId: row.org_id,
        status: row.status as CallStatus,
        createdByUserId: row.created_by_user_id,
        acceptedByUserId: row.accepted_by_user_id,
        startedAt: row.started_at,
        endedAt: row.ended_at,
        endedBy: metadata.endedBy,
        reason: row.reason,
        metadata: metadata,
        ringExpiresAt: row.ring_expires_at,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    } catch (e) {
      console.error('Failed to get call from DB:', e);
      return this.memoryStore.get(callId) || null;
    }
  }

  /**
   * CAS (Compare-And-Swap) operation for race-condition safe accept
   * Only updates if status='ringing' AND acceptedByUserId IS NULL
   * Returns true if update succeeded, false if race condition detected
   */
  async acceptCallCAS(callId: string, staffId: string): Promise<boolean> {
    if (this.useMemory || !this.pool) {
      const call = this.memoryStore.get(callId);
      if (!call || call.status !== 'ringing' || call.acceptedByUserId) {
        return false;
      }
      call.status = 'accepted';
      call.acceptedByUserId = staffId;
      call.startedAt = Date.now();
      call.updatedAt = Date.now();
      return true;
    }

    try {
      // Atomic update with condition check
      const result: QueryResult = await this.pool.query(
        `UPDATE calls 
         SET status = 'accepted', 
             accepted_by_user_id = $2, 
             started_at = $3, 
             updated_at = $3
         WHERE id = $1 
           AND status = 'ringing' 
           AND accepted_by_user_id IS NULL
         RETURNING id`,
        [callId, staffId, Date.now()]
      );

      return result.rows.length > 0;
    } catch (e) {
      console.error('Failed to accept call (CAS):', e);
      return false;
    }
  }

  async updateStatus(callId: string, status: CallStatus, metadata?: Partial<Call>): Promise<void> {
    if (this.useMemory || !this.pool) {
      const call = this.memoryStore.get(callId);
      if (call) {
        call.status = status;
        call.updatedAt = Date.now();
        if (metadata) Object.assign(call, metadata);
      }
      return;
    }

    try {
      const updates: string[] = ['status = $2', 'updated_at = $3'];
      const values: any[] = [callId, status, Date.now()];
      let paramIndex = 4;

      if (metadata?.endedAt) {
        updates.push(`ended_at = $${paramIndex}`);
        values.push(metadata.endedAt);
        paramIndex++;
      }
      if (metadata?.reason) {
        updates.push(`reason = $${paramIndex}`);
        values.push(metadata.reason);
        paramIndex++;
      }
      if (metadata?.endedBy) {
        // Store endedBy in metadata since we don't have a dedicated column
        const currentMetadata = metadata.metadata || {};
        currentMetadata.endedBy = metadata.endedBy;
        updates.push(`metadata = $${paramIndex}`);
        values.push(JSON.stringify(currentMetadata));
        paramIndex++;
      }

      await this.pool.query(
        `UPDATE calls SET ${updates.join(', ')} WHERE id = $1`,
        values
      );
    } catch (e) {
      console.error('Failed to update call status:', e);
      const call = this.memoryStore.get(callId);
      if (call) {
        call.status = status;
        call.updatedAt = Date.now();
        if (metadata) Object.assign(call, metadata);
      }
    }
  }

  /**
   * Find calls that have timed out (still ringing after ringExpiresAt)
   */
  async findTimedOutCalls(): Promise<Call[]> {
    const now = Date.now();
    
    if (this.useMemory || !this.pool) {
      return Array.from(this.memoryStore.values())
        .filter(c => c.status === 'ringing' && c.ringExpiresAt && c.ringExpiresAt < now);
    }

    try {
      const result: QueryResult = await this.pool.query(
        `SELECT * FROM calls 
         WHERE status = 'ringing' 
           AND ring_expires_at IS NOT NULL 
           AND ring_expires_at < $1`,
        [now]
      );

      return result.rows.map(row => {
        const metadata = row.metadata || {};
        return {
          id: row.id,
          orgId: row.org_id,
          status: row.status as CallStatus,
          createdByUserId: row.created_by_user_id,
          acceptedByUserId: row.accepted_by_user_id,
          startedAt: row.started_at,
          endedAt: row.ended_at,
          endedBy: metadata.endedBy,
          reason: row.reason,
          metadata: metadata,
          ringExpiresAt: row.ring_expires_at,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        };
      });
    } catch (e) {
      console.error('Failed to find timed out calls:', e);
      return [];
    }
  }

  async getParticipants(callId: string): Promise<CallParticipant[]> {
    if (this.useMemory || !this.pool) {
      return this.participantsStore.get(callId) || [];
    }

    try {
      const result: QueryResult = await this.pool.query(
        'SELECT * FROM call_participants WHERE call_id = $1',
        [callId]
      );

      return result.rows.map(row => ({
        id: row.id,
        callId: row.call_id,
        userId: row.user_id,
        role: row.role as 'client' | 'staff',
        state: row.state as 'invited' | 'joined' | 'left',
        joinedAt: row.joined_at,
        leftAt: row.left_at,
        stats: row.stats,
      }));
    } catch (e) {
      console.error('Failed to get participants:', e);
      return this.participantsStore.get(callId) || [];
    }
  }

  async close() {
    if (this.pool) {
      await this.pool.end();
    }
  }
}

