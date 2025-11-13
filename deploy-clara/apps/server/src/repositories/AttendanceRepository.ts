import { Pool } from 'pg';
import { v4 as uuid } from 'uuid';
import dotenv from 'dotenv';
import { Student } from '../models/Student.js';
import { Attendance } from '../models/Attendance.js';

dotenv.config();

export class AttendanceRepository {
  private pool: Pool | null = null;
  private memoryStore: Map<string, Student> = new Map();
  private attendanceStore: Map<string, Attendance> = new Map();
  private useMemory = false;

  constructor() {
    const dbUrl = process.env.DATABASE_URL;
    if (dbUrl && dbUrl.startsWith('postgres')) {
      try {
        this.pool = new Pool({ connectionString: dbUrl });
        this.initDb().catch(console.error);
      } catch (e) {
        console.warn('Failed to connect to Postgres for Attendance, using in-memory store:', e);
        this.useMemory = true;
      }
    } else {
      this.useMemory = true;
      console.log('Using in-memory store for Attendance (no DATABASE_URL)');
    }
  }

  private async initDb() {
    if (!this.pool) return;

    try {
      // Students table
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS students (
          student_id VARCHAR(255) PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          usn VARCHAR(100) UNIQUE NOT NULL,
          semester INTEGER NOT NULL,
          section VARCHAR(10) NOT NULL,
          created_at BIGINT NOT NULL,
          updated_at BIGINT NOT NULL
        );
      `);

      await this.pool.query(`
        CREATE INDEX IF NOT EXISTS idx_students_semester_section ON students(semester, section);
        CREATE INDEX IF NOT EXISTS idx_students_usn ON students(usn);
      `);

      // Attendance table
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS attendance (
          id VARCHAR(255) PRIMARY KEY,
          date VARCHAR(10) NOT NULL,
          semester INTEGER NOT NULL,
          section VARCHAR(10) NOT NULL,
          staff_id VARCHAR(255) NOT NULL,
          student_id VARCHAR(255) NOT NULL REFERENCES students(student_id) ON DELETE CASCADE,
          status VARCHAR(20) NOT NULL CHECK (status IN ('present', 'absent')),
          created_at BIGINT NOT NULL,
          updated_at BIGINT NOT NULL,
          UNIQUE(date, student_id)
        );
      `);

      await this.pool.query(`
        CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(date);
        CREATE INDEX IF NOT EXISTS idx_attendance_semester_section ON attendance(semester, section);
        CREATE INDEX IF NOT EXISTS idx_attendance_staff_id ON attendance(staff_id);
        CREATE INDEX IF NOT EXISTS idx_attendance_student_id ON attendance(student_id);
      `);

      console.log('✅ Attendance database schema initialized');
    } catch (e) {
      console.error('Failed to initialize attendance database:', e);
      this.useMemory = true;
      this.pool = null;
    }
  }

  // Student operations
  async importStudents(students: Student[]): Promise<number> {
    const now = Date.now();
    let count = 0;

    if (this.useMemory) {
      for (const student of students) {
        const existing = this.memoryStore.get(student.studentId);
        if (!existing) {
          this.memoryStore.set(student.studentId, {
            ...student,
            createdAt: now,
            updatedAt: now,
          });
          count++;
        } else {
          // Update existing
          this.memoryStore.set(student.studentId, {
            ...student,
            createdAt: existing.createdAt || now,
            updatedAt: now,
          });
        }
      }
      return count;
    }

    if (!this.pool) throw new Error('Database not available');

    for (const student of students) {
      try {
        await this.pool.query(
          `INSERT INTO students (student_id, name, usn, semester, section, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (student_id) 
           DO UPDATE SET name = $2, usn = $3, semester = $4, section = $5, updated_at = $7`,
          [student.studentId, student.name, student.usn, student.semester, student.section, now, now]
        );
        count++;
      } catch (error: any) {
        // Handle USN conflict
        if (error.code === '23505' && error.constraint === 'students_usn_key') {
          // Update by USN instead
          await this.pool.query(
            `UPDATE students SET name = $1, semester = $2, section = $3, updated_at = $4 WHERE usn = $5`,
            [student.name, student.semester, student.section, now, student.usn]
          );
          count++;
        } else {
          console.error(`Error importing student ${student.studentId}:`, error);
        }
      }
    }

    return count;
  }

  async getStudents(semester: number, section: string): Promise<Student[]> {
    if (this.useMemory) {
      return Array.from(this.memoryStore.values()).filter(
        (s) => s.semester === semester && s.section === section
      );
    }

    if (!this.pool) throw new Error('Database not available');

    const result = await this.pool.query(
      `SELECT student_id, name, usn, semester, section, created_at, updated_at
       FROM students
       WHERE semester = $1 AND section = $2
       ORDER BY name`,
      [semester, section]
    );

    return result.rows.map((row) => ({
      studentId: row.student_id,
      name: row.name,
      usn: row.usn,
      semester: row.semester,
      section: row.section,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  // Attendance operations
  async markAttendance(
    date: string,
    semester: number,
    section: string,
    staffId: string,
    attendanceRecords: Array<{ studentId: string; status: 'present' | 'absent' }>,
    override: boolean = false
  ): Promise<{ attendanceId: string; count: number }> {
    const now = Date.now();
    const attendanceId = uuid();

    // Check for existing attendance if not overriding
    if (!override) {
      const existing = await this.getAttendanceByDate(date, semester, section);
      if (existing.length > 0) {
        throw new Error(`Attendance already marked for ${date}. Use override flag to update.`);
      }
    }

    if (this.useMemory) {
      for (const record of attendanceRecords) {
        const attendance: Attendance = {
          id: uuid(),
          date,
          semester,
          section,
          staffId,
          studentId: record.studentId,
          status: record.status,
          createdAt: now,
          updatedAt: now,
        };
        this.attendanceStore.set(attendance.id, attendance);
      }
      return { attendanceId, count: attendanceRecords.length };
    }

    if (!this.pool) throw new Error('Database not available');

    // Use transaction
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Delete existing if override
      if (override) {
        await client.query(
          `DELETE FROM attendance WHERE date = $1 AND semester = $2 AND section = $3`,
          [date, semester, section]
        );
      }

      // Insert new attendance records
      for (const record of attendanceRecords) {
        const id = uuid();
        await client.query(
          `INSERT INTO attendance (id, date, semester, section, staff_id, student_id, status, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           ON CONFLICT (date, student_id) 
           DO UPDATE SET status = $7, staff_id = $5, updated_at = $9`,
          [id, date, semester, section, staffId, record.studentId, record.status, now, now]
        );
      }

      await client.query('COMMIT');
      return { attendanceId, count: attendanceRecords.length };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async getAttendanceByDate(date: string, semester: number, section: string): Promise<Attendance[]> {
    if (this.useMemory) {
      return Array.from(this.attendanceStore.values()).filter(
        (a) => a.date === date && a.semester === semester && a.section === section
      );
    }

    if (!this.pool) throw new Error('Database not available');

    const result = await this.pool.query(
      `SELECT id, date, semester, section, staff_id, student_id, status, created_at, updated_at
       FROM attendance
       WHERE date = $1 AND semester = $2 AND section = $3`,
      [date, semester, section]
    );

    return result.rows.map((row) => ({
      id: row.id,
      date: row.date,
      semester: row.semester,
      section: row.section,
      staffId: row.staff_id,
      studentId: row.student_id,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }
}

