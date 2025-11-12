import http from 'http';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { Server as IOServer } from 'socket.io';
import { createProxyMiddleware } from 'http-proxy-middleware';
import jwt from 'jsonwebtoken';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { v4 as uuid } from 'uuid';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
// Types (moved inline since workspace deps not available)
const NAMESPACE = '/rtc';
const rooms = {
  staff: (id: string) => `staff:${id}`,
  dept: (code: string) => `dept:${code}`,
  client: (id: string) => `client:${id}`,
  call: (id: string) => `call:${id}`,
};

type Role = 'client' | 'staff';
type AuthPayload = {
  userId: string;
  role: Role;
  staffId?: string;
  dept?: string;
  tenant?: string;
};
type CallState = 'created' | 'ringing' | 'accepted' | 'declined' | 'ended';
type CallSession = {
  call_id: string;
  client_id: string;
  staff_id?: string;
  dept_code?: string;
  state: CallState;
  created_at: number;
  updated_at: number;
  sdp_offer?: any;
  sdp_answer?: any;
};
import { CallRepository } from './repository.js';
import { setupSocketHandlers } from './socket.js';
import { TimetableRepository, type FacultyTimetable } from './timetableRepository.js';
import { StaffAvailabilityRepository } from './repositories/StaffAvailabilityRepository.js';
import { CallRepository as NewCallRepository } from './repositories/CallRepository.js';
import { createStaffRoutes } from './routes/staff.js';
import { createCallRoutes } from './routes/calls.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

const corsOrigins = (process.env.CORS_ORIGINS || '').split(',').filter(Boolean);
app.use(cors({ origin: corsOrigins.length > 0 ? corsOrigins : true, credentials: true }));

const server = http.createServer(app);

const io = new IOServer(server, {
  path: process.env.SOCKET_PATH || '/socket',
  cors: { origin: corsOrigins.length > 0 ? corsOrigins : true, credentials: true },
});

const ENABLE_UNIFIED = process.env.ENABLE_UNIFIED_MODE === 'true';
const JWT_SECRET = process.env.JWT_SECRET || 'changeme';

// JWT Auth Middleware
function authMiddleware(req: Request & { user?: AuthPayload }, res: Response, next: NextFunction) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return res.status(401).json({ error: 'missing token' });
  try {
    const payload = jwt.verify(token, JWT_SECRET) as AuthPayload;
    req.user = payload;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'invalid token' });
  }
}

// Socket auth
io.of(NAMESPACE).use((socket, next) => {
  try {
    const token = socket.handshake.auth?.token || 
      socket.handshake.headers?.authorization?.toString().replace('Bearer ', '');
    if (!token) return next(new Error('missing token'));
    const payload = jwt.verify(token, JWT_SECRET) as AuthPayload;
    (socket as any).user = payload;
    next();
  } catch (e) {
    next(new Error('unauthorized'));
  }
});

// Initialize repositories
const callRepo = new CallRepository();
const timetableRepo = new TimetableRepository();
const availabilityRepo = new StaffAvailabilityRepository();
const newCallRepo = new NewCallRepository();

const STAFF_DIRECTORY: Record<string, { displayName: string; shortCode: string }> = {
  'lakshmidurgan@gmail.com': { displayName: 'Prof. Lakshmi Durga N', shortCode: 'ldn' },
  'anithacs@gmail.com': { displayName: 'Prof. Anitha C S', shortCode: 'acs' },
  'gdhivyasri@gmail.com': { displayName: 'Dr. G Dhivyasri', shortCode: 'gd' },
  'nishask@gmail.com': { displayName: 'Prof. Nisha S K', shortCode: 'nsk' },
  'amarnathbpatil@gmail.com': { displayName: 'Prof. Amarnath B Patil', shortCode: 'abp' },
  'nagashreen@gmail.com': { displayName: 'Dr. Nagashree N', shortCode: 'nn' },
  'anilkumarkv@gmail.com': { displayName: 'Prof. Anil Kumar K V', shortCode: 'akv' },
  'jyotikumari@gmail.com': { displayName: 'Prof. Jyoti Kumari', shortCode: 'jk' },
  'vidyashreer@gmail.com': { displayName: 'Prof. Vidyashree R', shortCode: 'vr' },
  'bhavanaa@gmail.com': { displayName: 'Dr. Bhavana A', shortCode: 'ba' },
  'bhavyatn@gmail.com': { displayName: 'Prof. Bhavya T N', shortCode: 'btn' },
};

const WEEK_DAYS: Array<keyof FacultyTimetable['schedule']> = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const DEFAULT_TIME_SLOTS = [
  '08:30-09:25',
  '09:25-10:20',
  '10:20-10:40',
  '10:40-11:35',
  '11:35-12:30',
  '12:30-01:15',
  '01:15-02:10',
  '02:10-03:05',
  '03:05-04:00',
] as const;

const DEFAULT_TIME_SLOT_ORDER = new Map<string, number>(DEFAULT_TIME_SLOTS.map((slot, index) => [slot, index]));

type StaffLookupEntry = {
  email: string;
  displayName: string;
  shortCode: string;
  facultyId: string;
};

// SemesterClass type from timetableRepository
type SemesterClass = {
  time: string;
  subject: string;
  subjectCode?: string;
  courseName?: string;
  classType?: 'Theory' | 'Lab' | 'Free' | 'Busy';
  batch?: string;
  room?: string;
};

type TimetableEntry = SemesterClass;

function normalizeFacultyId(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

const STAFF_LOOKUP: StaffLookupEntry[] = Object.entries(STAFF_DIRECTORY).map(([email, meta]) => {
  const facultyId = normalizeFacultyId(email.split('@')[0] || email);
  return {
    email,
    displayName: meta.displayName,
    shortCode: meta.shortCode.toLowerCase(),
    facultyId,
  };
});

function resolveStaffIdentifier(identifier: string): StaffLookupEntry | null {
  const normalized = identifier.trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  if (normalized.includes('@')) {
    const directEmail = STAFF_LOOKUP.find((entry) => entry.email.toLowerCase() === normalized);
    if (directEmail) {
      return directEmail;
    }
    const prefix = normalized.split('@')[0] || normalized;
    const facultyId = normalizeFacultyId(prefix);
    const byPrefix = STAFF_LOOKUP.find((entry) => entry.facultyId === facultyId);
    if (byPrefix) {
      return byPrefix;
    }
  }

  const cleaned = normalized.replace(/[^a-z0-9]/g, '');

  const byShort = STAFF_LOOKUP.find((entry) => entry.shortCode === cleaned);
  if (byShort) {
    return byShort;
  }

  const byFacultyId = STAFF_LOOKUP.find((entry) => entry.facultyId === cleaned);
  if (byFacultyId) {
    return byFacultyId;
  }

  const byName = STAFF_LOOKUP.find((entry) => {
    const nameLower = entry.displayName.toLowerCase();
    return nameLower.includes(normalized) || normalized.includes(nameLower);
  });
  if (byName) {
    return byName;
  }

  return null;
}

function parseTimeToMinutes(range: string): number {
  const [start] = range.split('-');
  if (!start) return Number.POSITIVE_INFINITY;
  const [rawHour, rawMinute] = start.split(':');
  const hour = rawHour ? parseInt(rawHour, 10) : NaN;
  const minute = rawMinute ? parseInt(rawMinute, 10) : 0;

  if (Number.isNaN(hour)) {
    return Number.POSITIVE_INFINITY;
  }

  // Treat early-hour values (1,2,3,4,5) as afternoon slots.
  const normalizedHour = hour < 7 ? hour + 12 : hour;
  return normalizedHour * 60 + minute;
}

function sortTimeSlots(slots: string[]): string[] {
  return [...slots].sort((a, b) => {
    const indexA = DEFAULT_TIME_SLOT_ORDER.has(a) ? DEFAULT_TIME_SLOT_ORDER.get(a)! : Number.POSITIVE_INFINITY;
    const indexB = DEFAULT_TIME_SLOT_ORDER.has(b) ? DEFAULT_TIME_SLOT_ORDER.get(b)! : Number.POSITIVE_INFINITY;
    if (indexA !== indexB) {
      return indexA - indexB;
    }
    return parseTimeToMinutes(a) - parseTimeToMinutes(b);
  });
}

function isFreeEntry(entry?: TimetableEntry | null): boolean {
  if (!entry) return true;
  const classType = (entry.classType || '').toLowerCase();
  if (classType === 'free') return true;
  const subject = (entry.subject || '').toLowerCase();
  if (!subject) return true;
  return subject.includes('free') || subject.includes('break') || subject.includes('lunch');
}

function computeAvailabilityFromTimetable(timetable: FacultyTimetable, dayFilter?: string) {
  const allSlotsSet = new Set<string>(DEFAULT_TIME_SLOTS);

  WEEK_DAYS.forEach((day) => {
    const entries = timetable.schedule[day] || [];
    entries.forEach((entry) => {
      if (entry?.time) {
        allSlotsSet.add(entry.time);
      }
    });
  });

  const allSlots = sortTimeSlots(Array.from(allSlotsSet));
  const filter = dayFilter ? dayFilter.trim().toLowerCase() : null;

  const availability = WEEK_DAYS.flatMap((day) => {
    if (filter && day.toLowerCase() !== filter) {
      return [];
    }

    const entries = timetable.schedule[day] || [];
    const entryMap = new Map(entries.map((entry) => [entry.time, entry]));

    const freeSlots: string[] = [];
    const busySlots: Array<{ time: string; subject: string; classType?: string; batch?: string }> = [];

    allSlots.forEach((slot) => {
      const entry = entryMap.get(slot);
      if (!entry || isFreeEntry(entry)) {
        freeSlots.push(slot);
      } else {
        busySlots.push({
          time: slot,
          subject: entry.subject,
          classType: entry.classType,
          batch: entry.batch,
        });
      }
    });

    return [
      {
        day,
        freeSlots,
        busySlots,
        nextFreeSlot: freeSlots[0] || null,
      },
    ];
  });

  return availability;
}

async function seedDefaultAvailability() {
  try {
    const now = Date.now();
    await Promise.all(
      Object.keys(STAFF_DIRECTORY).map((email) =>
        availabilityRepo.setAvailability({
          userId: email,
          orgId: 'default',
          status: 'available',
          updatedAt: now,
          skills: [],
        })
      )
    );
    console.log('[Server] Seeded default staff availability');
  } catch (error) {
    console.error('[Server] Failed to seed staff availability', error);
  }
}

void seedDefaultAvailability();

// Helper function to create complete StaffProfile objects
function createStaffProfile(email: string, dept?: string): {
  id: string;
  name: string;
  email: string;
  department: string;
  shortName: string;
  description: string;
  subjects: string[];
  avatar: string;
} {
  const normalizedEmail = email.toLowerCase();
  const directoryEntry = STAFF_DIRECTORY[normalizedEmail];
  const emailPrefix = normalizedEmail.split('@')[0];

  const displayName = directoryEntry?.displayName ||
    emailPrefix.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  const shortCode = directoryEntry?.shortCode || emailPrefix;

  return {
    id: email,
    name: displayName,
    email,
    department: dept || 'general',
    shortName: shortCode.toLowerCase(),
    description: `Staff member in ${dept || 'general'} department`,
    subjects: [],
    avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=6366f1&color=fff&size=128`,
  };
}

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests',
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100, // Increased for test suite
  message: 'Too many login attempts',
});

// Health check - must be before proxy
app.get('/healthz', (_req, res) => res.json({ status: 'ok' }));

// Auth endpoints - support both unified and staff formats
const unifiedLoginSchema = z.object({
  username: z.string(),
  password: z.string().optional(),
  role: z.enum(['client', 'staff']),
  staffId: z.string().optional(),
  dept: z.string().optional(),
});

const staffLoginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

app.post('/api/auth/login', authLimiter, async (req, res) => {
  // Try staff format first (email/password)
  const staffParsed = staffLoginSchema.safeParse(req.body);
  if (staffParsed.success) {
    const { email, password } = staffParsed.data;
    // For demo: accept any email/password combination
    // In production, verify against database
    const userId = email;
    const claims: AuthPayload = { 
      userId, 
      role: 'staff', 
      staffId: email.split('@')[0], // Use email prefix as staffId
      dept: 'general' 
    };
    
    const token = jwt.sign(claims, JWT_SECRET, { algorithm: 'HS256', expiresIn: '15m' });
    const refreshToken = jwt.sign({ userId }, JWT_SECRET, { algorithm: 'HS256', expiresIn: '7d' });
    
    // Return format expected by staff app
    return res.json({ 
      token, 
      refreshToken,
      user: createStaffProfile(email, 'general')
    });
  }
  
  // Try unified format (username/role)
  const unifiedParsed = unifiedLoginSchema.safeParse(req.body);
  if (unifiedParsed.success) {
    const { username, role, staffId, dept } = unifiedParsed.data;
    const userId = username;
    const claims: AuthPayload = { userId, role, staffId, dept };
    
    const token = jwt.sign(claims, JWT_SECRET, { algorithm: 'HS256', expiresIn: '15m' });
    return res.json({ token });
  }
  
  return res.status(400).json({ error: 'Invalid login format' });
});

// Staff auth refresh token endpoint
app.post('/api/auth/refresh-token', authLimiter, async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(400).json({ error: 'Refresh token required' });
  
  try {
    const payload = jwt.verify(refreshToken, JWT_SECRET) as { userId: string };
    const claims: AuthPayload = { userId: payload.userId, role: 'staff' };
    const newToken = jwt.sign(claims, JWT_SECRET, { algorithm: 'HS256', expiresIn: '15m' });
    const newRefreshToken = jwt.sign({ userId: payload.userId }, JWT_SECRET, { algorithm: 'HS256', expiresIn: '7d' });
    
    res.json({ token: newToken, refreshToken: newRefreshToken });
  } catch (e) {
    return res.status(401).json({ error: 'Invalid refresh token' });
  }
});

// Staff logout endpoint
app.post('/api/auth/logout', authMiddleware, (_req, res) => {
  res.json({ message: 'Logged out successfully' });
});

// Mock user data endpoint for staff app
app.get('/api/user/:username', authMiddleware, async (req: Request & { user?: AuthPayload }, res) => {
  const { username } = req.params;
  // Prioritize JWT user ID (which contains the email) if available
  // Otherwise, reconstruct email from username parameter
  const email = req.user?.userId?.includes('@') 
    ? req.user.userId 
    : (username.includes('@') ? username : `${username}@example.com`);
  const dept = req.user?.dept || 'general';
  
  // Return complete StaffProfile matching the Staff app's expected structure
  res.json({
    user: createStaffProfile(email, dept),
    meetings: [],
    tasks: [],
    timetable: [],
  });
});

// Mock notifications endpoints for staff app
app.get('/api/notifications', authMiddleware, (_req, res) => {
  res.json({ notifications: [] });
});

app.get('/api/notifications/unread', authMiddleware, (_req, res) => {
  res.json({ count: 0 });
});

app.post('/api/notifications', authMiddleware, (_req, res) => {
  res.json({ message: 'Notification created', count: 0 });
});

app.patch('/api/notifications/:id/read', authMiddleware, (_req, res) => {
  res.json({ notification: { id: _req.params.id, read: true } });
});

app.patch('/api/notifications/read-all', authMiddleware, (_req, res) => {
  res.json({ message: 'All notifications marked as read' });
});

app.delete('/api/notifications/:id', authMiddleware, (_req, res) => {
  res.json({ message: 'Notification deleted' });
});

// Mount new v1 API routes (must be before old routes for precedence)
app.use('/api', authMiddleware, createStaffRoutes(availabilityRepo));
app.use('/api', authMiddleware, createCallRoutes(newCallRepo, availabilityRepo, io));

// Timetable endpoints
type AuthPayloadWithEmail = AuthPayload & { email?: string };

// Helper to check if user can edit timetable
function canEditTimetable(req: Request & { user?: AuthPayloadWithEmail }, facultyId: string): boolean {
  if (!req.user) {
    console.log('canEditTimetable: No user in request');
    return false;
  }
  
  const userId = req.user.userId?.toLowerCase() || '';
  const email = req.user.email?.toLowerCase() || userId;
  const staffId = req.user.staffId?.toLowerCase() || '';
  const targetId = facultyId.toLowerCase().replace(/[^a-z0-9]/g, '');
  
  console.log('canEditTimetable check:', {
    userId,
    email,
    staffId,
    targetId,
    role: req.user.role
  });
  
  // Admin can edit any timetable (check for admin role or email)
  if (req.user.role === 'staff' && (
    userId.includes('admin') ||
    email === 'nagashreen@gmail.com' || // HOD is admin
    userId === 'nagashreen@gmail.com' ||
    email.includes('nagashreen')
  )) {
    console.log('canEditTimetable: User is admin - allowing edit');
    return true;
  }
  
  // Faculty can edit their own timetable
  // Normalize IDs for comparison (remove @domain, special chars)
  const normalizedUserId = userId.replace(/[^a-z0-9]/g, '');
  const normalizedEmail = email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
  const normalizedStaffId = staffId.replace(/[^a-z0-9]/g, '');
  
  const canEdit = normalizedUserId === targetId ||
         normalizedStaffId === targetId ||
         normalizedEmail === targetId ||
         email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '') === targetId ||
         userId.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '') === targetId;
  
  console.log('canEditTimetable result:', canEdit, {
    normalizedUserId,
    normalizedEmail,
    normalizedStaffId,
    targetId
  });
  
  return canEdit;
}

// Timetable schema for validation
const timetableSchema = z.object({
  faculty: z.string(),
  designation: z.string().optional(),
  semester: z.string(),
  schedule: z.object({
    Monday: z.array(z.object({
      time: z.string(),
      subject: z.string(),
      subjectCode: z.string().optional(),
      courseName: z.string().optional(),
      classType: z.enum(['Theory', 'Lab', 'Free', 'Busy']).optional(),
      batch: z.string().optional(),
      room: z.string().optional(),
    })).optional(),
    Tuesday: z.array(z.object({
      time: z.string(),
      subject: z.string(),
      subjectCode: z.string().optional(),
      courseName: z.string().optional(),
      classType: z.enum(['Theory', 'Lab', 'Free', 'Busy']).optional(),
      batch: z.string().optional(),
      room: z.string().optional(),
    })).optional(),
    Wednesday: z.array(z.object({
      time: z.string(),
      subject: z.string(),
      subjectCode: z.string().optional(),
      courseName: z.string().optional(),
      classType: z.enum(['Theory', 'Lab', 'Free', 'Busy']).optional(),
      batch: z.string().optional(),
      room: z.string().optional(),
    })).optional(),
    Thursday: z.array(z.object({
      time: z.string(),
      subject: z.string(),
      subjectCode: z.string().optional(),
      courseName: z.string().optional(),
      classType: z.enum(['Theory', 'Lab', 'Free', 'Busy']).optional(),
      batch: z.string().optional(),
      room: z.string().optional(),
    })).optional(),
    Friday: z.array(z.object({
      time: z.string(),
      subject: z.string(),
      subjectCode: z.string().optional(),
      courseName: z.string().optional(),
      classType: z.enum(['Theory', 'Lab', 'Free', 'Busy']).optional(),
      batch: z.string().optional(),
      room: z.string().optional(),
    })).optional(),
    Saturday: z.array(z.object({
      time: z.string(),
      subject: z.string(),
      subjectCode: z.string().optional(),
      courseName: z.string().optional(),
      classType: z.enum(['Theory', 'Lab', 'Free', 'Busy']).optional(),
      batch: z.string().optional(),
      room: z.string().optional(),
    })).optional(),
  }),
  workload: z.object({
    theory: z.number(),
    lab: z.number(),
    totalUnits: z.number(),
  }).optional(),
});

// GET /api/timetables/:facultyId/:semester - Get timetable
app.get('/api/timetables/:facultyId/:semester', apiLimiter, authMiddleware, async (req: Request & { user?: AuthPayloadWithEmail }, res) => {
  const { facultyId, semester } = req.params;
  
  try {
    // Normalize facultyId - remove @domain if present
    const normalizedFacultyId = facultyId.includes('@') ? facultyId.split('@')[0] : facultyId;
    const timetable = await timetableRepo.get(normalizedFacultyId, semester);
    if (!timetable) {
      res.status(404).json({ error: 'Timetable not found' });
      return;
    }
    
    // Check access - user can view their own or admin can view any
    if (!canEditTimetable(req, normalizedFacultyId)) {
      // Return read-only version
      const { editHistory, ...readOnlyTimetable } = timetable;
      res.json(readOnlyTimetable);
      return;
    }
    
    res.json(timetable);
  } catch (e) {
    console.error('Error fetching timetable:', e);
    res.status(500).json({ error: 'Failed to fetch timetable' });
  }
});

// GET /api/timetables/semester/:semester - Get all timetables for a semester (admin only)
app.get('/api/timetables/semester/:semester', apiLimiter, authMiddleware, async (req: Request & { user?: AuthPayloadWithEmail }, res) => {
  const { semester } = req.params;
  
  try {
    // Check if user is admin
    const userId = req.user?.userId?.toLowerCase() || '';
    const email = req.user?.email?.toLowerCase() || userId;
    const isAdmin = req.user?.role === 'staff' && (
      userId.includes('admin') ||
      email === 'nagashreen@gmail.com' ||
      userId === 'nagashreen@gmail.com'
    );
    
    if (!isAdmin) {
      res.status(403).json({ error: 'Access denied. Admin only.' });
      return;
    }
    
    const timetables = await timetableRepo.getAllForSemester(semester);
    res.json(timetables);
  } catch (e) {
    console.error('Error fetching timetables for semester:', e);
    res.status(500).json({ error: 'Failed to fetch timetables' });
  }
});


// Public endpoint to retrieve normalized availability summary for a staff member
app.get('/api/public/staff/:identifier/availability', apiLimiter, async (req, res) => {
  const { identifier } = req.params;
  const semesterQuery = (req.query.semester as string | undefined)?.trim();
  const dayQuery = (req.query.day as string | undefined)?.trim();

  try {
    const staffEntry = resolveStaffIdentifier(identifier);
    if (!staffEntry) {
      res.status(404).json({ error: 'Staff member not found' });
      return;
    }

    let timetable: FacultyTimetable | null = null;
    if (semesterQuery) {
      timetable = await timetableRepo.get(staffEntry.facultyId, semesterQuery);
    }

    if (!timetable) {
      timetable = await timetableRepo.getLatestForFaculty(staffEntry.facultyId);
    }

    if (!timetable) {
      res.status(404).json({ error: 'No timetable data available for this staff member yet.' });
      return;
    }

    const availability = computeAvailabilityFromTimetable(timetable, dayQuery);

    res.json({
      staff: {
        name: staffEntry.displayName,
        email: staffEntry.email,
        shortName: staffEntry.shortCode.toUpperCase(),
        facultyId: staffEntry.facultyId,
      },
      source: {
        semester: timetable.semester,
        updatedAt: timetable.updatedAt,
      },
      generatedAt: new Date().toISOString(),
      availability,
    });
  } catch (error) {
    console.error('Error generating staff availability summary:', error);
    res.status(500).json({ error: 'Failed to generate staff availability summary' });
  }
});

// PATCH /api/timetables/:facultyId - Update timetable
app.patch('/api/timetables/:facultyId', apiLimiter, authMiddleware, async (req: Request & { user?: AuthPayloadWithEmail }, res) => {
  const { facultyId } = req.params;
  
  console.log('Timetable update request:', {
    facultyId,
    userId: req.user?.userId,
    email: req.user?.email,
    staffId: req.user?.staffId,
    role: req.user?.role
  });
  
  // Normalize facultyId - remove @domain if present and clean up
  const normalizedFacultyId = (facultyId.includes('@') ? facultyId.split('@')[0] : facultyId)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
  
  console.log('Normalized faculty ID:', normalizedFacultyId);
  
  // Check edit permission
  const hasPermission = canEditTimetable(req, normalizedFacultyId);
  console.log('Permission check result:', hasPermission);
  
  if (!hasPermission) {
    console.error('Access denied for timetable update:', {
      facultyId: normalizedFacultyId,
      userId: req.user?.userId,
      email: req.user?.email
    });
    return res.status(403).json({ 
      error: 'Access denied. You can only edit your own timetable.',
      details: {
        requestedFacultyId: normalizedFacultyId,
        userUserId: req.user?.userId,
        userEmail: req.user?.email,
        userStaffId: req.user?.staffId
      }
    });
  }
  
  console.log('✅ Permission granted for timetable update');
  
  const parsed = timetableSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.message });
  }
  
  const timetableData = parsed.data;
  const editedBy = req.user?.userId || req.user?.email || req.user?.staffId || 'unknown';
  
  // Validate schedule - check for overlapping times within same day
  const validationErrors: string[] = [];
  Object.entries(timetableData.schedule).forEach(([day, classes]) => {
    if (!classes || classes.length === 0) return;
    const sortedClasses = [...classes].sort((a, b) => {
      const [aStart] = a.time.split('-');
      const [bStart] = b.time.split('-');
      return aStart.localeCompare(bStart);
    });
    
    for (let i = 0; i < sortedClasses.length - 1; i++) {
      const current = sortedClasses[i];
      const next = sortedClasses[i + 1];
      const [currentStart, currentEnd] = current.time.split('-');
      const [nextStart, nextEnd] = next.time.split('-');
      
      if (currentEnd > nextStart) {
        validationErrors.push(`${day}: Overlapping classes ${current.time} and ${next.time}`);
      }
    }
  });
  
  if (validationErrors.length > 0) {
    return res.status(400).json({ 
      error: 'Validation failed', 
      details: validationErrors 
    });
  }
  
  try {
    // Calculate workload if not provided
    let workload = timetableData.workload;
    if (!workload) {
      let theoryHours = 0;
      let labHours = 0;
      
      Object.values(timetableData.schedule).forEach(dayClasses => {
        if (!dayClasses) return;
        dayClasses.forEach(cls => {
          const [start, end] = cls.time.split('-');
          const [startH, startM] = start.split(':').map(Number);
          const [endH, endM] = end.split(':').map(Number);
          const duration = (endH * 60 + endM - (startH * 60 + startM)) / 60;
          
          if (cls.classType === 'Theory') {
            theoryHours += duration;
          } else if (cls.classType === 'Lab') {
            labHours += duration;
          }
        });
      });
      
      workload = {
        theory: Math.round(theoryHours),
        lab: Math.round(labHours),
        totalUnits: Math.round(theoryHours + labHours),
      };
    }
    
    const timetable: FacultyTimetable = {
      facultyId: normalizedFacultyId.toLowerCase(),
      faculty: timetableData.faculty,
      designation: timetableData.designation,
      semester: timetableData.semester,
      schedule: timetableData.schedule as FacultyTimetable['schedule'], // Type assertion for Busy support
      workload,
      updatedAt: new Date().toISOString(),
      editHistory: [],
    };
    
    const updated = await timetableRepo.createOrUpdate(
      timetable,
      editedBy,
      `Updated timetable for ${timetableData.semester}`
    );
    
    // Emit real-time update via Socket.IO
    io.of(NAMESPACE).emit('timetable:updated', {
      facultyId: normalizedFacultyId,
      semester: timetableData.semester,
      timetable: updated,
    });
    
    return res.json({ 
      success: true,
      timetable: updated,
      message: 'Timetable updated successfully'
    });
  } catch (e) {
    console.error('Error updating timetable:', e);
    return res.status(500).json({ error: 'Failed to update timetable' });
  }
});

// Location finding API endpoint
app.post('/api/locations/find', apiLimiter, async (req, res) => {
  try {
    const { query, language = 'en' } = req.body;
    
    if (!query || typeof query !== 'string') {
      return res.status(400).json({ 
        success: false, 
        error: 'Query is required' 
      });
    }

    // Note: For now, location matching is done client-side
    // This endpoint can be extended to use server-side matching
    // or to return location database data if needed
    
    res.json({
      success: true,
      message: 'Location matching is handled client-side. Please use the LocationMatcher in the client app.',
      note: 'For server-side matching, implement location matching logic here'
    });
  } catch (error: any) {
    console.error('Error in location find endpoint:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Get all floors and locations (optional - for future use)
app.get('/api/locations/floors', apiLimiter, async (_req, res) => {
  try {
    // This endpoint can return the full location database
    // For now, return a message indicating client-side data is used
    res.json({
      success: true,
      message: 'Location data is loaded client-side. See locationsDatabase.ts in the client app.'
    });
  } catch (error: any) {
    console.error('Error in floors endpoint:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// REST endpoints
const initiateSchema = z.object({
  clientId: z.string(),
  targetStaffId: z.string().optional(),
  department: z.string().optional(),
  purpose: z.string().optional(),
});

app.post('/api/calls/initiate', apiLimiter, authMiddleware, async (req: Request & { user?: AuthPayload }, res) => {
  const parsed = initiateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
  
  const { clientId, targetStaffId, department, purpose } = parsed.data;
  const callId = uuid();
  const now = Date.now();
  
  const session: CallSession = {
    call_id: callId,
    client_id: clientId,
    staff_id: targetStaffId,
    dept_code: department,
    state: 'ringing',
    created_at: now,
    updated_at: now,
  };
  
  await callRepo.create(session);
  
  const nsp = io.of(NAMESPACE);
  const clientInfo = { clientId, name: req.user?.userId };
  
  if (targetStaffId) {
    nsp.to(rooms.staff(targetStaffId)).emit('call:incoming', { callId, clientInfo, purpose, ts: now });
  } else if (department) {
    nsp.to(rooms.dept(department)).emit('call:incoming', { callId, clientInfo, purpose, ts: now });
  }
  nsp.to(rooms.call(callId)).emit('call:update', { callId, state: 'ringing' });
  
  return res.json({ callId });
});

const acceptDeclineSchema = z.object({
  callId: z.string(),
  staffId: z.string(),
  reason: z.string().optional(),
});

app.post('/api/calls/accept', apiLimiter, authMiddleware, async (req, res) => {
  const parsed = acceptDeclineSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
  
  const { callId, staffId } = parsed.data;
  const sess = await callRepo.get(callId);
  if (!sess) return res.status(404).json({ error: 'not found' });
  
  sess.state = 'accepted';
  sess.staff_id = staffId;
  sess.updated_at = Date.now();
  
  await callRepo.update(sess);
  
  io.of(NAMESPACE).to(rooms.call(callId)).emit('call:update', { callId, state: 'accepted', staffId });
  return res.json({ ok: true });
});

app.post('/api/calls/decline', apiLimiter, authMiddleware, async (req, res) => {
  const parsed = acceptDeclineSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
  
  const { callId, staffId, reason } = parsed.data;
  const sess = await callRepo.get(callId);
  if (!sess) return res.status(404).json({ error: 'not found' });
  
  sess.state = 'declined';
  sess.staff_id = staffId;
  sess.updated_at = Date.now();
  
  await callRepo.update(sess);
  
  io.of(NAMESPACE).to(rooms.call(callId)).emit('call:update', { callId, state: 'declined', reason });
  return res.json({ ok: true });
});

const sdpSchema = z.object({
  callId: z.string(),
  from: z.string(),
  type: z.enum(['offer', 'answer']),
  sdp: z.any(),
});

app.post('/api/calls/sdp', apiLimiter, authMiddleware, async (req, res) => {
  const parsed = sdpSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
  
  const { callId, type, sdp } = parsed.data;
  const sess = await callRepo.get(callId);
  if (!sess) return res.status(404).json({ error: 'not found' });
  
  if (type === 'offer') sess.sdp_offer = sdp;
  else sess.sdp_answer = sdp;
  sess.updated_at = Date.now();
  
  await callRepo.update(sess);
  
  io.of(NAMESPACE).to(rooms.call(callId)).emit('call:sdp', { callId, type, sdp });
  return res.json({ ok: true });
});

const iceSchema = z.object({
  callId: z.string(),
  from: z.string(),
  candidate: z.any(),
});

app.post('/api/calls/ice', apiLimiter, authMiddleware, async (req, res) => {
  const parsed = iceSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
  
  const { callId, candidate } = parsed.data;
  const sess = await callRepo.get(callId);
  if (!sess) return res.status(404).json({ error: 'not found' });
  
  io.of(NAMESPACE).to(rooms.call(callId)).emit('call:ice', { callId, candidate });
  return res.json({ ok: true });
});

// Setup Socket.IO handlers
setupSocketHandlers(io.of(NAMESPACE), callRepo);

// Dev proxy vs prod static - Always serve from unified server
if (ENABLE_UNIFIED) {
  const clientPath = process.env.CLIENT_PUBLIC_PATH || '/';
  const staffPath = process.env.STAFF_PUBLIC_PATH || '/staff';
  
  if (process.env.NODE_ENV === 'development') {
    // Dev: Proxy to Vite dev servers but accessible via 8080
    
    // Staff proxy - must be before client proxy to match /staff first
    app.use(staffPath, createProxyMiddleware({
      target: 'http://localhost:5174',
      changeOrigin: true,
      ws: true,
    }));
    
    // Client proxy - use catch-all that respects Express route precedence
    // Since API routes are defined above, they'll be matched first
    // This will only proxy requests that don't match any defined routes
    app.use(createProxyMiddleware({
      target: 'http://localhost:5173',
      changeOrigin: true,
      ws: true,
    }));
  } else {
    // Prod: Serve static builds
    const clientDist = path.resolve(__dirname, '../../client/dist');
    const staffDist = path.resolve(__dirname, '../../staff/dist');
    
    // Serve static files
    app.use(clientPath, express.static(clientDist, { index: 'index.html' }));
    app.use(staffPath, express.static(staffDist, { index: 'index.html' }));
    
    // SPA fallback routes (must come after static and API routes)
    app.get(`${staffPath}/*`, (_req, res) => {
      res.sendFile(path.join(staffDist, 'index.html'));
    });
    app.get(clientPath === '/' ? '/*' : `${clientPath}/*`, (_req, res) => {
      res.sendFile(path.join(clientDist, 'index.html'));
    });
  }
}

const port = Number(process.env.PORT || 8080);
server.listen(port, '0.0.0.0', () => {
  console.log(`Server listening on :${port}`);
  console.log(`Unified mode: ${ENABLE_UNIFIED}`);
  console.log(`Health check: http://localhost:${port}/healthz`);
}).on('error', (err: any) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${port} is already in use. Please free the port or change PORT in .env`);
  } else {
    console.error('Server error:', err);
  }
  process.exit(1);
});

// Graceful shutdown
const shutdown = () => {
  console.log('Shutting down...');
  server.close(() => {
    callRepo.close();
    timetableRepo.close();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

