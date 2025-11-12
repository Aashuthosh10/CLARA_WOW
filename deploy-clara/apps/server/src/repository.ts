import { Pool, QueryResult } from 'pg';
import dotenv from 'dotenv';

type CallSession = {
  call_id: string;
  client_id: string;
  staff_id?: string;
  dept_code?: string;
  state: 'created' | 'ringing' | 'accepted' | 'declined' | 'ended';
  created_at: number;
  updated_at: number;
  sdp_offer?: any;
  sdp_answer?: any;
};

dotenv.config();

export class CallRepository {
  private pool: Pool | null = null;
  private memoryStore: Map<string, CallSession> = new Map();
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
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS call_sessions (
          call_id VARCHAR(255) PRIMARY KEY,
          client_id VARCHAR(255) NOT NULL,
          staff_id VARCHAR(255),
          dept_code VARCHAR(255),
          state VARCHAR(50) NOT NULL,
          created_at BIGINT NOT NULL,
          updated_at BIGINT NOT NULL,
          sdp_offer JSONB,
          sdp_answer JSONB
        );
      `);
      console.log('Database initialized');
    } catch (e) {
      console.error('Failed to initialize database:', e);
      this.useMemory = true;
      this.pool = null;
    }
  }

  async create(session: CallSession): Promise<void> {
    if (this.useMemory || !this.pool) {
      this.memoryStore.set(session.call_id, { ...session });
      return;
    }

    try {
      await this.pool.query(
        `INSERT INTO call_sessions (call_id, client_id, staff_id, dept_code, state, created_at, updated_at, sdp_offer, sdp_answer)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          session.call_id,
          session.client_id,
          session.staff_id || null,
          session.dept_code || null,
          session.state,
          session.created_at,
          session.updated_at,
          session.sdp_offer ? JSON.stringify(session.sdp_offer) : null,
          session.sdp_answer ? JSON.stringify(session.sdp_answer) : null,
        ]
      );
    } catch (e) {
      console.error('Failed to create session in DB:', e);
      this.memoryStore.set(session.call_id, { ...session });
    }
  }

  async get(callId: string): Promise<CallSession | null> {
    if (this.useMemory || !this.pool) {
      const sess = this.memoryStore.get(callId);
      return sess ? { ...sess } : null;
    }

    try {
      const result: QueryResult = await this.pool.query(
        'SELECT * FROM call_sessions WHERE call_id = $1',
        [callId]
      );
      
      if (result.rows.length === 0) return null;
      
      const row = result.rows[0];
      return {
        call_id: row.call_id,
        client_id: row.client_id,
        staff_id: row.staff_id,
        dept_code: row.dept_code,
        state: row.state,
        created_at: row.created_at,
        updated_at: row.updated_at,
        sdp_offer: row.sdp_offer,
        sdp_answer: row.sdp_answer,
      };
    } catch (e) {
      console.error('Failed to get session from DB:', e);
      const sess = this.memoryStore.get(callId);
      return sess ? { ...sess } : null;
    }
  }

  async update(session: CallSession): Promise<void> {
    if (this.useMemory || !this.pool) {
      this.memoryStore.set(session.call_id, { ...session });
      return;
    }

    try {
      await this.pool.query(
        `UPDATE call_sessions 
         SET staff_id = $2, state = $3, updated_at = $4, sdp_offer = $5, sdp_answer = $6
         WHERE call_id = $1`,
        [
          session.call_id,
          session.staff_id || null,
          session.state,
          session.updated_at,
          session.sdp_offer ? JSON.stringify(session.sdp_offer) : null,
          session.sdp_answer ? JSON.stringify(session.sdp_answer) : null,
        ]
      );
    } catch (e) {
      console.error('Failed to update session in DB:', e);
      this.memoryStore.set(session.call_id, { ...session });
    }
  }

  async close() {
    if (this.pool) {
      await this.pool.end();
    }
  }
}

