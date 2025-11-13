import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { apiService } from '../../../services/api';
import { useNotification } from '../../../components/NotificationProvider';

interface Student {
  id: string;
  name: string;
  usn: string;
  present: boolean | null;
}

const Attendance: React.FC = () => {
  const [semester, setSemester] = useState<number>(1);
  const [section, setSection] = useState<string>('A');
  const [studentList, setStudentList] = useState<Student[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { addNotification } = useNotification();

  const sections = ['A', 'B', 'C', 'D'];
  const semesters = [1, 2, 3, 4, 5, 6, 7, 8];

  const handleExcelImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const json: any[] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

      // Row 0 = headers, Rows 1+ = student data
      // Excel format: Column 0 = SL NO, Column 1 = USN, Column 2 = NAME
      const students = json.slice(1).map((row) => ({
        id: crypto.randomUUID(),
        name: row[2] || '',      // THIRD COLUMN = NAME (actual student name)
        usn: row[1] || '',       // SECOND COLUMN = USN
        present: null,
      }));

      // Filter out empty rows
      const validStudents = students.filter((s) => s.name && s.usn);

      setStudentList(validStudents);
      addNotification({
        type: 'system',
        title: 'Import Successful',
        message: `Successfully imported ${validStudents.length} students`,
      });
    } catch (err) {
      console.error('Excel import error:', err);
      addNotification({
        type: 'system',
        title: 'Import Error',
        message: 'Failed to import Excel file. Please check the file format.',
      });
    } finally {
      // Reset file input
      e.target.value = '';
    }
  };

  const handleAttendanceChange = (id: string, value: boolean) => {
    setStudentList((prev) =>
      prev.map((s) => (s.id === id ? { ...s, present: value } : s))
    );
  };

  const handleSubmit = async () => {
    // Validate all students are marked
    if (studentList.some((s) => s.present === null)) {
      alert('Mark all students before submitting.');
      return;
    }

    setSubmitting(true);
    try {
      console.log('Attendance Submitted:', studentList);

      // Convert to backend format
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const staffId = user.id || user.email?.split('@')[0] || '';

      const attendanceRecords = studentList.map((student) => ({
        studentId: student.id,
        status: student.present ? 'present' : 'absent',
      }));

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
          message: `Attendance marked successfully for ${studentList.length} students`,
        });
        // Reset attendance state
        setStudentList((prev) =>
          prev.map((s) => ({ ...s, present: null }))
        );
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

          <div>
            <label className="cursor-pointer bg-blue-600/80 hover:bg-blue-700 text-white px-4 py-3 rounded-lg transition-colors flex items-center gap-2 inline-block">
              <i className="fa-solid fa-file-excel"></i>
              <span>Import Excel</span>
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleExcelImport}
                className="hidden"
              />
            </label>
          </div>
        </div>
      </div>

      {/* Student Table */}
      {studentList.length === 0 ? (
        <div className="bg-slate-900/50 backdrop-blur-lg border border-white/10 rounded-2xl p-6 text-center">
          <p className="text-slate-400 mb-4">No students imported yet</p>
          <p className="text-slate-500 text-sm">Import students using the Excel import button above</p>
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
                {studentList.map((s, i) => (
                  <tr
                    key={s.id}
                    className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors"
                  >
                    <td className="py-3 px-4 text-slate-300">{i + 1}</td>
                    <td className="py-3 px-4 text-white font-medium">{s.name}</td>
                    <td className="py-3 px-4 text-slate-300">{s.usn}</td>
                    <td className="py-3 px-4 text-center">
                      <input
                        type="radio"
                        name={`a-${s.id}`}
                        checked={s.present === true}
                        onChange={() => handleAttendanceChange(s.id, true)}
                        className="w-5 h-5 text-blue-600 focus:ring-2 focus:ring-blue-500 cursor-pointer"
                      />
                    </td>
                    <td className="py-3 px-4 text-center">
                      <input
                        type="radio"
                        name={`a-${s.id}`}
                        checked={s.present === false}
                        onChange={() => handleAttendanceChange(s.id, false)}
                        className="w-5 h-5 text-red-600 focus:ring-2 focus:ring-red-500 cursor-pointer"
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
              disabled={submitting || studentList.length === 0}
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
