import { StaffProfile, TimetableEntry, Appointment, CallLog, CallUpdate, ActivityType, Task } from './types';

export const HOD_EMAIL = 'nagashreen@gmail.com';

/**
 * Get the role label for a staff member based on their name or email
 * @param staff - StaffProfile object or object with name and email
 * @returns "Head of Department" for Nagashreen, "Staff" for others
 */
export const getStaffRole = (staff: { name: string; email?: string }): string => {
  const name = staff.name?.toLowerCase() || '';
  const email = staff.email?.toLowerCase() || '';
  const hodEmail = HOD_EMAIL.toLowerCase();
  
  // Check if email matches HOD_EMAIL (most reliable)
  // Or if name contains "nagashreen" or "nagashree" (handles variations)
  if (email === hodEmail || 
      name.includes('nagashreen') || 
      name.includes('nagashree')) {
    return 'Head of Department';
  }
  
  return 'Staff';
};

export const STAFF_PROFILES: StaffProfile[] = [
  {
    id: 'ldn',
    name: "Prof. Lakshmi Durga N",
    email: "lakshmidurgan@gmail.com",
    department: "Computer Science",
    shortName: "LDN",
    description: "Professor specializing in Software Engineering and Project Management with expertise in Data Visualization and Computer Networks. Focuses on practical software development methodologies and network engineering principles.",
    subjects: ["Software Engineering", "Project Management", "Data Visualization"],
    avatar: "PL"
  },
  {
    id: 'acs',
    name: "Prof. Anitha C S",
    email: "anithacs@gmail.com",
    department: "Computer Science",
    shortName: "ACS",
    description: "Associate Professor specializing in Research Methodology, Intellectual Property Rights, and Computer Networks Lab. Expert in academic research guidance and network systems.",
    subjects: ["Research Methodology", "IPR", "Computer Networks"],
    avatar: "PA"
  },
  {
    id: 'gd',
    name: "Dr. G Dhivyasri",
    email: "gdhivyasri@gmail.com",
    department: "Computer Science",
    shortName: "GD",
    description: "Doctorate-level Professor with deep expertise in Computer Networks. Specializes in network architecture, protocols, and advanced networking technologies.",
    subjects: ["Computer Networks", "Network Security"],
    avatar: "DG"
  },
  {
    id: 'nsk',
    name: "Prof. Nisha S K",
    email: "nishask@gmail.com",
    department: "Computer Science",
    shortName: "NSK",
    description: "Professor specializing in NOSQL Databases. Expert in modern database systems, including MongoDB, Cassandra, and other non-relational database technologies.",
    subjects: ["NOSQL Databases", "MongoDB"],
    avatar: "PN"
  },
  {
    id: 'abp',
    name: "Prof. Amarnath B Patil",
    email: "amarnathbpatil@gmail.com",
    department: "Computer Science",
    shortName: "ABP",
    description: "Professor guiding students in Mini Projects. Focuses on hands-on project development, industry-oriented solutions, and practical implementation of computer science concepts.",
    subjects: ["Mini Projects", "Software Development"],
    avatar: "PA"
  },
  {
    id: 'nn',
    name: "Dr. Nagashree N",
    email: "nagashreen@gmail.com",
    department: "Computer Science",
    shortName: "NN",
    description: "Doctorate-level Professor teaching Theory of Computation and Yoga. Combines theoretical computer science expertise with holistic wellness practices.",
    subjects: ["Theory of Computation", "Yoga"],
    avatar: "DN"
  },
  {
    id: 'akv',
    name: "Prof. Anil Kumar K V",
    email: "anilkumarkv@gmail.com",
    department: "Computer Science",
    shortName: "AKV",
    description: "Professor specializing in Environmental Studies. Educates students on environmental sustainability, ecological systems, and green computing practices.",
    subjects: ["Environmental Studies", "Green Computing"],
    avatar: "PA"
  },
  {
    id: 'jk',
    name: "Prof. Jyoti Kumari",
    email: "jyotikumari@gmail.com",
    department: "Computer Science",
    shortName: "JK",
    description: "Professor handling Computer Networks Lab and Physical Education. Expert in practical network implementation and promoting physical fitness among students.",
    subjects: ["Computer Networks Lab", "Physical Education"],
    avatar: "PJ"
  },
  {
    id: 'vr',
    name: "Prof. Vidyashree R",
    email: "vidyashreer@gmail.com",
    department: "Computer Science",
    shortName: "VR",
    description: "Professor specializing in Data Visualization Lab. Expert in data analysis, visualization tools, and creating meaningful insights from complex datasets.",
    subjects: ["Data Visualization Lab", "Data Analysis"],
    avatar: "PV"
  },
  {
    id: 'ba',
    name: "Dr. Bhavana A",
    email: "bhavanaa@gmail.com",
    department: "Computer Science",
    shortName: "BA",
    description: "Doctorate-level Professor guiding students in Mini Projects. Focuses on research-oriented project development and innovative problem-solving approaches.",
    subjects: ["Mini Projects", "Research"],
    avatar: "DB"
  },
  {
    id: 'btn',
    name: "Prof. Bhavya T N",
    email: "bhavyatn@gmail.com",
    department: "Computer Science",
    shortName: "BTN",
    description: "Professor coordinating National Service Scheme (NSS). Dedicated to community service, social responsibility, and student engagement in civic activities.",
    subjects: ["NSS Coordinator"],
    avatar: "PB"
  },
];

export const MOCK_TIMETABLE: TimetableEntry[] = [
    { id: '1', day: 'Monday', timeSlot: { start: '09:00', end: '10:00' }, activity: 'Team Standup' },
    { id: '2', day: 'Tuesday', timeSlot: { start: '11:00', end: '12:00' }, activity: 'Client Review' },
    { id: '3', day: 'Wednesday', timeSlot: { start: '09:00', end: '10:00' }, activity: 'Meeting', subject: 'with Sarah' },
    { id: '4', day: 'Thursday', timeSlot: { start: '14:00', end: '15:00' }, activity: 'Sprint Planning' },
    { id: '5', day: 'Friday', timeSlot: { start: '15:00', end: '16:00' }, activity: 'Team Lunch' },
];

export const MOCK_APPOINTMENTS: Appointment[] = [
    { id: '1', clientName: 'Quarterly Review', purpose: 'Project Alpha', date: 'Today', time: '2:00 PM', status: 'Confirmed' },
    { id: '2', clientName: 'Product Demo', purpose: 'New Feature Showcase', date: 'Tomorrow', time: '10:00 AM', status: 'Pending' },
];

export const MOCK_CALL_LOGS: CallLog[] = [];
export const MOCK_CALL_UPDATES: CallUpdate[] = [];

export const MOCK_TASKS: Task[] = [
  { id: '1', title: 'Prepare Q3 Report', description: 'Compile sales data and create presentation slides for the quarterly review meeting.', dueDate: '2024-08-15', priority: 'High', status: 'In Progress' },
  { id: '2', title: 'Update Onboarding Docs', description: 'Revise the documentation for new hires with the latest software updates.', dueDate: '2024-08-22', priority: 'Medium', status: 'To Do' },
  { id: '3', title: 'Organize Team Outing', description: 'Plan a team-building event for September.', dueDate: '2024-09-01', priority: 'Low', status: 'To Do' },
];


// FIX: Import `ActivityType` to resolve reference error.
export const ACTIVITY_COLORS: Record<ActivityType, string> = {
    "Teaching": "bg-blue-500",
    "Office Hours": "bg-green-500",
    "Meeting": "bg-purple-500",
    "Lab Session": "bg-yellow-500 text-black",
    "Consultation": "bg-indigo-500",
    "Free": "bg-gray-600",
    "Busy": "bg-red-500",
    "Team Standup": "bg-sky-500",
    "Client Review": "bg-teal-500",
    "Sprint Planning": "bg-orange-500",
    "Team Lunch": "bg-pink-500",
};