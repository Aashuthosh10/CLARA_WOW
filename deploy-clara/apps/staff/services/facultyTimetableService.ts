// Service to load and manage faculty timetable data from JSON
import facultyData from '../data/faculty_timetables.json';

export interface FacultyTimetableEntry {
  time: string;
  subject: string;
  class?: string;
  type: 'Theory' | 'Lab' | 'Break' | 'Free';
}

export interface FacultyData {
  id: string;
  name: string;
  designation: string;
  timetable: {
    Monday?: FacultyTimetableEntry[];
    Tuesday?: FacultyTimetableEntry[];
    Wednesday?: FacultyTimetableEntry[];
    Thursday?: FacultyTimetableEntry[];
    Friday?: FacultyTimetableEntry[];
    Saturday?: FacultyTimetableEntry[];
  };
  courses: Array<{
    code: string;
    name: string;
    type: string;
    units: number;
  }>;
  totalUnits: number;
}

export interface FacultyTimetableData {
  academicYear: string;
  semester: string;
  department: string;
  institution: string;
  faculties: FacultyData[];
  classSchedule: {
    timeSlots: Array<{
      slot: number;
      time: string;
      type?: string;
    }>;
  };
}

// Convert JSON format to our internal SemesterTimetable format
export function convertFacultyTimetableToSemesterFormat(
  faculty: FacultyData,
  semester: string
): import('../types').SemesterTimetable {
  const schedule: import('../types').SemesterTimetable['schedule'] = {};

  // Convert each day's timetable
  Object.entries(faculty.timetable).forEach(([day, entries]) => {
    if (!entries || entries.length === 0) return;

    schedule[day as import('../types').DayOfWeek] = entries
      .filter(entry => entry.type !== 'Break') // Filter out breaks
      .map(entry => {
        // Extract subject code if available (format: "CODE Name" or just "Name")
        let subjectCode = '';
        let courseName = entry.subject;
        
        // Try to extract subject code (usually first part before space)
        // Many JSON subjects are abbreviations like "CNS", "DS", "JAVA", "CN", etc.
        // Some have format like "BCS502 Computer Networks"
        if (entry.subject && entry.subject.length > 0) {
          const parts = entry.subject.trim().split(/\s+/);
          // Check if first part looks like a course code (alphanumeric, 3-10 chars)
          if (parts.length > 1 && /^[A-Z0-9]{3,10}$/i.test(parts[0])) {
            subjectCode = parts[0];
            courseName = parts.slice(1).join(' ');
          } else {
            // Subject is just an abbreviation or name, use as course name
            courseName = entry.subject;
            // For abbreviations like "CNS", "DS", try to find matching course code from courses array
            if (faculty.courses && faculty.courses.length > 0) {
              const matchingCourse = faculty.courses.find(c => 
                c.name.toLowerCase().includes(entry.subject.toLowerCase()) ||
                entry.subject.toLowerCase().includes(c.name.split(' ')[0]?.toLowerCase() || '')
              );
              if (matchingCourse) {
                subjectCode = matchingCourse.code;
                courseName = matchingCourse.name;
              }
            }
          }
        }

        return {
          time: entry.time,
          subject: entry.subject,
          subjectCode: subjectCode || undefined,
          courseName: courseName || entry.subject,
          classType: entry.type === 'Free' ? 'Free' : (entry.type === 'Lab' ? 'Lab' : 'Theory') as 'Theory' | 'Lab' | 'Free',
          batch: entry.class || undefined,
        };
      });
  });

  const data = facultyData as FacultyTimetableData;
  const academicYear = data.academicYear || '2025-26';
  const semesterType = data.semester || 'ODD';
  
  return {
    faculty: faculty.name,
    designation: faculty.designation,
    semester: `${semester} – ${semesterType} ${academicYear}`,
    schedule,
  };
}

// Get all faculties
export function getAllFaculties(): FacultyData[] {
  return (facultyData as FacultyTimetableData).faculties;
}

// Get faculty by ID
export function getFacultyById(id: string): FacultyData | undefined {
  return getAllFaculties().find(f => f.id === id);
}

// Get faculty by name (case-insensitive partial match)
export function getFacultyByName(name: string): FacultyData | undefined {
  const searchName = name.toLowerCase();
  return getAllFaculties().find(f => 
    f.name.toLowerCase().includes(searchName) ||
    searchName.includes(f.name.toLowerCase())
  );
}

// Get faculty by email (extract name from email)
export function getFacultyByEmail(email: string): FacultyData | undefined {
  // Try to match email prefix to faculty name
  const emailPrefix = email.split('@')[0].toLowerCase();
  
  // Common patterns: firstname.lastname, firstname_lastname, etc.
  const nameVariations = emailPrefix.split(/[._-]/).map(part => 
    part.charAt(0).toUpperCase() + part.slice(1)
  );
  
  // Try exact match first
  const exactMatch = getAllFaculties().find(f => 
    f.name.toLowerCase().replace(/\s+/g, '').includes(emailPrefix) ||
    emailPrefix.includes(f.name.toLowerCase().replace(/\s+/g, ''))
  );
  
  if (exactMatch) return exactMatch;
  
  // Try partial match with name variations
  return getAllFaculties().find(f => {
    const facultyName = f.name.toLowerCase();
    return nameVariations.some(variation => 
      facultyName.includes(variation.toLowerCase()) ||
      variation.toLowerCase().includes(facultyName.split(' ')[0])
    );
  });
}

// Get timetable data for a faculty
export function getFacultyTimetable(facultyIdOrName: string, semester: string): import('../types').SemesterTimetable | null {
  let faculty: FacultyData | undefined;
  
  // Try to find by ID first
  if (facultyIdOrName.startsWith('FAC')) {
    faculty = getFacultyById(facultyIdOrName);
  } else {
    // Try by name
    faculty = getFacultyByName(facultyIdOrName);
  }
  
  if (!faculty) return null;
  
  return convertFacultyTimetableToSemesterFormat(faculty, semester);
}

// Get all time slots from the JSON
export function getAllTimeSlots(): string[] {
  const slots = (facultyData as FacultyTimetableData).classSchedule.timeSlots;
  return slots.map(s => s.time);
}

// Export the full data
export const facultyTimetableData = facultyData as FacultyTimetableData;

