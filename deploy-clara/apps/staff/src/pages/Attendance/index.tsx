import React, { useState, useEffect } from 'react';
import { apiService } from '../../../services/api';
import { useNotification } from '../../../components/NotificationProvider';

// Dynamic import for xlsx to avoid blocking the app
let XLSX: any = null;
const loadXLSX = async () => {
  if (!XLSX) {
    try {
      XLSX = (await import('xlsx')).default;
    } catch (error) {
      console.error('Failed to load xlsx:', error);
      throw new Error('Excel import functionality is not available');
    }
  }
  return XLSX;
};

interface Student {
  studentId: string;
  name: string;
  usn: string;
  semester: number;
  section: string;
}

interface AttendanceRecord {
  studentId: string;
  status: 'present' | 'absent';
}

const Attendance: React.FC = () => {
  const [semester, setSemester] = useState<number>(1);
  const [section, setSection] = useState<string>('A');
  const [students, setStudents] = useState<Student[]>([]);
  const [attendance, setAttendance] = useState<Record<string, 'present' | 'absent'>>({});
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { addNotification } = useNotification();

  const sections = ['A', 'B', 'C', 'D'];
  const semesters = [1, 2, 3, 4, 5, 6, 7, 8];

  // Load students when semester/section changes
  useEffect(() => {
    if (semester && section) {
      loadStudents();
    }
  }, [semester, section]);

  const loadStudents = async () => {
    setLoading(true);
    try {
      const response = await apiService.getStudents(semester, section);
      if (response.data) {
        setStudents(response.data);
        // Initialize attendance state
        const initialAttendance: Record<string, 'present' | 'absent'> = {};
        response.data.forEach((student: Student) => {
          initialAttendance[student.studentId] = 'present'; // Default to present
        });
        setAttendance(initialAttendance);
      } else {
        setStudents([]);
        setAttendance({});
      }
    } catch (error) {
      console.error('Error loading students:', error);
      setStudents([]);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImporting(true);
    try {
      const xlsxLib = await loadXLSX();
      const data = await file.arrayBuffer();
      const workbook = xlsxLib.read(data, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = xlsxLib.utils.sheet_to_json(worksheet);

      const parsedStudents: Student[] = jsonData.map((row: any, index: number) => ({
        studentId: row.studentId || row['Student ID'] || `student-${Date.now()}-${index}`,
        name: row.name || row.Name || row['Student Name'] || '',
        usn: row.usn || row.USN || row['University Seat Number'] || '',
        semester: row.semester || row.Semester || semester,
        section: row.section || row.Section || section,
      }));

      // Send to backend
      const response = await apiService.importStudents(parsedStudents);
      if (response.data) {
        addNotification({
          type: 'system',
          title: 'Import Successful',
          message: `Successfully imported ${parsedStudents.length} students`,
        });
        loadStudents();
      } else {
        addNotification({
          type: 'system',
          title: 'Import Failed',
          message: response.error || 'Failed to import students',
        });
      }
    } catch (error: any) {
      console.error('Error importing file:', error);
      addNotification({
        type: 'system',
        title: 'Import Error',
        message: error.message || 'Failed to parse file',
      });
    } finally {
      setImporting(false);
      // Reset file input
      event.target.value = '';
    }
  };

  const handleGoogleSheetsImport = async () => {
    const url = prompt('Enter Google Sheets URL (must be published as CSV):');
    if (!url) return;

    setImporting(true);
    try {
      const xlsxLib = await loadXLSX();
      // Convert Google Sheets URL to CSV export URL
      const csvUrl = url
        .replace('/edit#gid=', '/export?format=csv&gid=')
        .replace('/edit', '/export?format=csv');

      const response = await fetch(csvUrl);
      const csvText = await response.text();
      
      // Parse CSV
      const workbook = xlsxLib.read(csvText, { type: 'string' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = xlsxLib.utils.sheet_to_json(worksheet);

      const parsedStudents: Student[] = jsonData.map((row: any, index: number) => ({
        studentId: row.studentId || row['Student ID'] || `student-${Date.now()}-${index}`,
        name: row.name || row.Name || row['Student Name'] || '',
        usn: row.usn || row.USN || row['University Seat Number'] || '',
        semester: row.semester || row.Semester || semester,
        section: row.section || row.Section || section,
      }));

      // Send to backend
      const importResponse = await apiService.importStudents(parsedStudents);
      if (importResponse.data) {
        addNotification({
          type: 'system',
          title: 'Import Successful',
          message: `Successfully imported ${parsedStudents.length} students from Google Sheets`,
        });
        loadStudents();
      } else {
        addNotification({
          type: 'system',
          title: 'Import Failed',
          message: importResponse.error || 'Failed to import students',
        });
      }
    } catch (error: any) {
      console.error('Error importing from Google Sheets:', error);
      addNotification({
        type: 'system',
        title: 'Import Error',
        message: error.message || 'Failed to import from Google Sheets',
      });
    } finally {
      setImporting(false);
    }
  };

  const handleAttendanceChange = (studentId: string, status: 'present' | 'absent') => {
    setAttendance((prev) => ({
      ...prev,
      [studentId]: status,
    }));
  };

  const handleSubmit = async () => {
    // Validate all students are marked
    const unmarkedStudents = students.filter(
      (student) => !attendance[student.studentId]
    );

    if (unmarkedStudents.length > 0) {
      addNotification({
        type: 'system',
        title: 'Validation Error',
        message: `Please mark attendance for all ${unmarkedStudents.length} unmarked students`,
      });
      return;
    }

    setSubmitting(true);
    try {
      const attendanceRecords: AttendanceRecord[] = students.map((student) => ({
        studentId: student.studentId,
        status: attendance[student.studentId] || 'present',
      }));

      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const staffId = user.id || user.email?.split('@')[0] || '';

      const response = await apiService.markAttendance({
        date: new Date().toISOString().split('T')[0],
        sem: semester,
        section,
        staffId,
        attendance: attendanceRecords,
      });

      if (response.data) {
        addNotification({
          type: 'system',
          title: 'Success',
          message: `Attendance marked successfully for ${students.length} students`,
        });
        // Reset attendance state
        const resetAttendance: Record<string, 'present' | 'absent'> = {};
        students.forEach((student) => {
          resetAttendance[student.studentId] = 'present';
        });
        setAttendance(resetAttendance);
      } else {
        addNotification({
          type: 'system',
          title: 'Error',
          message: response.error || 'Failed to mark attendance',
        });
      }
    } catch (error: any) {
      console.error('Error submitting attendance:', error);
      addNotification({
        type: 'system',
        title: 'Error',
        message: error.message || 'Failed to submit attendance',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="bg-slate-900/50 backdrop-blur-lg border border-white/10 rounded-2xl p-6">
        <h1 className="text-3xl font-bold text-white mb-2">Attendance Management</h1>
        <p className="text-slate-400">Mark and manage student attendance</p>
      </div>

      {/* Filters Section */}
      <div className="bg-slate-900/50 backdrop-blur-lg border border-white/10 rounded-2xl p-6">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Semester
            </label>
            <select
              value={semester}
              onChange={(e) => setSemester(Number(e.target.value))}
              className="w-full bg-slate-800/80 border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              {semesters.map((sem) => (
                <option key={sem} value={sem}>
                  {sem}
                </option>
              ))}
            </select>
          </div>

          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Section
            </label>
            <select
              value={section}
              onChange={(e) => setSection(e.target.value)}
              className="w-full bg-slate-800/80 border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              {sections.map((sec) => (
                <option key={sec} value={sec}>
                  {sec}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-2">
            <label className="cursor-pointer bg-blue-600/80 hover:bg-blue-700 text-white px-4 py-3 rounded-lg transition-colors flex items-center gap-2">
              <i className="fa-solid fa-file-excel"></i>
              <span>Import Excel/CSV</span>
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileUpload}
                className="hidden"
                disabled={importing}
              />
            </label>

            <button
              onClick={handleGoogleSheetsImport}
              disabled={importing}
              className="bg-green-600/80 hover:bg-green-700 text-white px-4 py-3 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <i className="fa-solid fa-table"></i>
              <span>Import Google Sheets</span>
            </button>
          </div>
        </div>
      </div>

      {/* Student Table */}
      {loading ? (
        <div className="bg-slate-900/50 backdrop-blur-lg border border-white/10 rounded-2xl p-6 text-center">
          <p className="text-slate-400">Loading students...</p>
        </div>
      ) : students.length === 0 ? (
        <div className="bg-slate-900/50 backdrop-blur-lg border border-white/10 rounded-2xl p-6 text-center">
          <p className="text-slate-400 mb-4">No students found for Semester {semester}, Section {section}</p>
          <p className="text-slate-500 text-sm">Import students using the buttons above</p>
        </div>
      ) : (
        <div className="bg-slate-900/50 backdrop-blur-lg border border-white/10 rounded-2xl p-6">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left py-3 px-4 text-slate-300 font-semibold">Sl.No</th>
                  <th className="text-left py-3 px-4 text-slate-300 font-semibold">Name</th>
                  <th className="text-left py-3 px-4 text-slate-300 font-semibold">USN</th>
                  <th className="text-center py-3 px-4 text-slate-300 font-semibold">Present</th>
                  <th className="text-center py-3 px-4 text-slate-300 font-semibold">Absent</th>
                </tr>
              </thead>
              <tbody>
                {students.map((student, index) => (
                  <tr
                    key={student.studentId}
                    className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors"
                  >
                    <td className="py-3 px-4 text-slate-300">{index + 1}</td>
                    <td className="py-3 px-4 text-white font-medium">{student.name}</td>
                    <td className="py-3 px-4 text-slate-300">{student.usn}</td>
                    <td className="py-3 px-4 text-center">
                      <input
                        type="radio"
                        name={`attendance-${student.studentId}`}
                        checked={attendance[student.studentId] === 'present'}
                        onChange={() => handleAttendanceChange(student.studentId, 'present')}
                        className="w-5 h-5 text-blue-600 focus:ring-2 focus:ring-blue-500"
                      />
                    </td>
                    <td className="py-3 px-4 text-center">
                      <input
                        type="radio"
                        name={`attendance-${student.studentId}`}
                        checked={attendance[student.studentId] === 'absent'}
                        onChange={() => handleAttendanceChange(student.studentId, 'absent')}
                        className="w-5 h-5 text-red-600 focus:ring-2 focus:ring-red-500"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Submit Button */}
          <div className="mt-6 flex justify-end">
            <button
              onClick={handleSubmit}
              disabled={submitting || students.length === 0}
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold px-6 py-3 rounded-lg transition-transform transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center gap-2"
            >
              {submitting ? (
                <>
                  <i className="fa-solid fa-spinner fa-spin"></i>
                  <span>Submitting...</span>
                </>
              ) : (
                <>
                  <i className="fa-solid fa-check"></i>
                  <span>Submit Attendance</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Attendance;

