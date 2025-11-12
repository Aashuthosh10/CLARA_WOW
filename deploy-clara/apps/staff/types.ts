export interface StaffProfile {
  id: string;
  name: string;
  email: string;
  department: string;
  shortName: string;
  description: string;
  subjects: string[];
  avatar: string;
}

export type DayOfWeek = "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday" | "Saturday";

export type ActivityType = "Teaching" | "Office Hours" | "Meeting" | "Lab Session" | "Consultation" | "Free" | "Busy" | "Team Standup" | "Client Review" | "Sprint Planning" | "Team Lunch";

export interface TimetableEntry {
  id: string;
  day: DayOfWeek;
  timeSlot: { start: string; end: string };
  activity: ActivityType;
  subject?: string;
  room?: string;
  batch?: string;
  notes?: string;
  isRecurring?: boolean;
}

// New types for semester-based timetable
export interface SemesterClass {
  time: string;
  subject: string;
  subjectCode?: string;
  courseName?: string;
  classType?: "Theory" | "Lab" | "Free" | "Busy";
  batch?: string;
  room?: string;
  coordinator?: string;
  isFree?: boolean;
}

export interface SemesterTimetable {
  faculty: string;
  designation?: string;
  semester: string;
  schedule: {
    Monday?: SemesterClass[];
    Tuesday?: SemesterClass[];
    Wednesday?: SemesterClass[];
    Thursday?: SemesterClass[];
    Friday?: SemesterClass[];
    Saturday?: SemesterClass[];
  };
}

export interface Appointment {
  id: string;
  clientName: string;
  purpose: string;
  date: string;
  time: string;
  status: 'Pending' | 'Confirmed' | 'Rejected';
  staffId?: string;
}

export interface CallLog {
  id: string;
  clientName: string;
  duration: string;
  status: 'completed' | 'missed' | 'rejected';
  timestamp: string;
}

export type CallDirection = 'incoming' | 'outgoing';

export interface CallUpdate {
  id: string;
  callId: string;
  clientName: string;
  timestamp: number;
  direction: CallDirection;
  status: 'ringing' | 'answered' | 'missed' | 'ended' | 'declined';
  purpose?: string;
}

export interface PendingAppointment {
  id: string;
  callId: string;
  clientName: string;
  staffId: string;
  purpose?: string;
  requestedAt: number;
  scheduledFor?: {
    date?: string;
    time?: string;
  };
}

export interface Task {
  id: string;
  title: string;
  description: string;
  dueDate: string;
  priority: 'High' | 'Medium' | 'Low' | 'None';
  status: 'To Do' | 'In Progress' | 'Done';
}

export type NavItem = "Dashboard" | "Timetable" | "Appointments" | "Task Management" | "AI Assistant" | "Meeting Summarizer" | "Team Directory" | "Settings";

export interface Meeting {
  id: string;
  title: string;
  date: string;
  time: string;
  location: string;
  attendees: string[]; // array of staff IDs
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: string;
  fileName?: string;
}

export interface Group {
  id: string;
  name: string;
  members: string[]; // array of staff IDs
  messages: ChatMessage[];
}

export interface Notification {
  id: number;
  type: 'message' | 'meeting' | 'system';
  title: string;
  message: string;
}
