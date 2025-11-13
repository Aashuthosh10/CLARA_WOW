export interface Attendance {
  id: string;
  date: string; // ISO date string (YYYY-MM-DD)
  semester: number;
  section: string;
  staffId: string;
  studentId: string;
  status: 'present' | 'absent';
  createdAt: number;
  updatedAt: number;
}

export interface AttendanceRecord {
  studentId: string;
  status: 'present' | 'absent';
}

export interface MarkAttendanceRequest {
  date: string;
  sem: number;
  section: string;
  staffId: string;
  attendance: AttendanceRecord[];
  override?: boolean; // Allow duplicate attendance for same day
}

