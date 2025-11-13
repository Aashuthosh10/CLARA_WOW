import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { AttendanceRepository } from '../repositories/AttendanceRepository.js';
import { MarkAttendanceRequest } from '../models/Attendance.js';

type AuthenticatedRequest = Request & { user?: { userId: string; role: string; staffId?: string } };

export function createAttendanceRoutes(attendanceRepo: AttendanceRepository): Router {
  const router = Router();

  // POST /attendance/import - Import students
  const importSchema = z.object({
    students: z.array(
      z.object({
        studentId: z.string(),
        name: z.string(),
        usn: z.string(),
        semester: z.number().int().min(1).max(8),
        section: z.string().length(1),
      })
    ),
  });

  router.post('/import', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const parsed = importSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.message });
      }

      const { students } = parsed.data;
      const count = await attendanceRepo.importStudents(students);

      res.json({
        message: `Successfully imported ${count} students`,
        count,
      });
    } catch (error: any) {
      console.error('[Attendance] Import error:', error);
      res.status(500).json({ error: error.message || 'Failed to import students' });
    }
  });

  // GET /attendance/students - Get students by semester and section
  router.get('/students', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const sem = parseInt(req.query.sem as string);
      const section = req.query.section as string;

      if (!sem || !section) {
        return res.status(400).json({ error: 'semester and section are required' });
      }

      if (sem < 1 || sem > 8) {
        return res.status(400).json({ error: 'semester must be between 1 and 8' });
      }

      const students = await attendanceRepo.getStudents(sem, section);
      res.json(students);
    } catch (error: any) {
      console.error('[Attendance] Get students error:', error);
      res.status(500).json({ error: error.message || 'Failed to get students' });
    }
  });

  // POST /attendance/mark - Mark attendance
  const markAttendanceSchema = z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    sem: z.number().int().min(1).max(8),
    section: z.string().length(1),
    staffId: z.string(),
    attendance: z.array(
      z.object({
        studentId: z.string(),
        status: z.enum(['present', 'absent']),
      })
    ),
    override: z.boolean().optional(),
  });

  router.post('/mark', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const parsed = markAttendanceSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.message });
      }

      const { date, sem, section, staffId, attendance, override } = parsed.data;

      // Validate date format
      const dateObj = new Date(date);
      if (isNaN(dateObj.getTime())) {
        return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD' });
      }

      // Validate all students are marked
      if (attendance.length === 0) {
        return res.status(400).json({ error: 'At least one student attendance must be marked' });
      }

      const result = await attendanceRepo.markAttendance(
        date,
        sem,
        section,
        staffId,
        attendance,
        override || false
      );

      res.json({
        message: `Attendance marked successfully for ${result.count} students`,
        attendanceId: result.attendanceId,
        count: result.count,
      });
    } catch (error: any) {
      console.error('[Attendance] Mark attendance error:', error);
      if (error.message?.includes('already marked')) {
        return res.status(409).json({ error: error.message });
      }
      res.status(500).json({ error: error.message || 'Failed to mark attendance' });
    }
  });

  return router;
}

