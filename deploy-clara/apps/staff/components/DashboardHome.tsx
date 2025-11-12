import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ACTIVITY_COLORS } from '../constants';
import {
  TimetableEntry,
  Meeting,
  SemesterTimetable,
  SemesterClass,
  DayOfWeek,
  CallUpdate,
  PendingAppointment,
  Appointment,
} from '../types';

const Card: React.FC<{ children: React.ReactNode; className?: string; title: string; icon: string }> = ({ children, className, title, icon }) => (
    <div className={`bg-slate-900/50 backdrop-blur-lg rounded-2xl border border-white/10 p-6 text-white ${className}`}>
        <div className="flex items-center space-x-3 mb-4">
            <i className={`${icon} text-xl text-purple-400`}></i>
            <h2 className="text-xl font-bold">{title}</h2>
        </div>
        {children}
    </div>
);

// Time slots matching the official timetable
const TIME_SLOTS = [
    "08:30-09:25", "09:25-10:20", "10:20-10:40", "10:40-11:35", "11:35-12:30",
    "12:30-01:15", "01:15-02:10", "02:10-03:05", "03:05-04:10"
];

const DAYS: DayOfWeek[] = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// Helper to get today's day name
const getToday = (): DayOfWeek => {
    const today = new Date().toLocaleString("en-IN", { weekday: "long" }) as DayOfWeek;
    return DAYS.includes(today) ? today : "Monday"; // Fallback to Monday if not found
};

// Helper to get next day
const getNextDay = (currentDay: DayOfWeek): DayOfWeek => {
    const currentIndex = DAYS.indexOf(currentDay);
    const nextIndex = (currentIndex + 1) % DAYS.length;
    return DAYS[nextIndex];
};

// Helper to get previous day
const getPrevDay = (currentDay: DayOfWeek): DayOfWeek => {
    const currentIndex = DAYS.indexOf(currentDay);
    const prevIndex = (currentIndex - 1 + DAYS.length) % DAYS.length;
    return DAYS[prevIndex];
};

// Helper to check if time slot is a break
const isBreakTime = (time: string): boolean => {
    return time === "10:20-10:40" || time === "12:30-01:15";
};

// Helper to parse time string to minutes
const parseTime = (timeStr: string): number => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
};

// Get timetable entries for a specific time slot and day
const getTimetableEntry = (
    schedule: SemesterTimetable['schedule'],
    day: DayOfWeek,
    timeSlot: string
): SemesterClass | null => {
    const dayClasses = schedule[day];
    if (!dayClasses) return null;

    const [slotStart, slotEnd] = timeSlot.split('-');
    const slotStartTime = parseTime(slotStart);
    const slotEndTime = parseTime(slotEnd);

    // Find class that overlaps with this time slot
    for (const cls of dayClasses) {
        const [classStart, classEnd] = cls.time.split('-');
        const classStartTime = parseTime(classStart);
        const classEndTime = parseTime(classEnd);

        // Check if time slot overlaps with class
        if (classStartTime < slotEndTime && classEndTime > slotStartTime) {
            return cls;
        }
    }

    return null;
};

const SEMESTER_OPTIONS = [
    "1st Semester", "2nd Semester", "3rd Semester", "4th Semester",
    "5th Semester", "6th Semester", "7th Semester", "8th Semester"
];

const TimetableCard: React.FC<{ 
    timetable: TimetableEntry[];
    semesterTimetable: SemesterTimetable | null;
    selectedSemester: string;
    onSemesterChange: (semester: string) => void;
}> = ({ timetable, semesterTimetable: initialSemesterTimetable, selectedSemester, onSemesterChange }) => {
    const [selectedDay, setSelectedDay] = useState<DayOfWeek>(getToday());
    const [semesterTimetable, setSemesterTimetable] = useState<SemesterTimetable | null>(initialSemesterTimetable);
    
    // Reset to today when semester changes
    useEffect(() => {
        setSelectedDay(getToday());
    }, [selectedSemester]);
    
    // Sync with prop changes
    useEffect(() => {
        setSemesterTimetable(initialSemesterTimetable);
    }, [initialSemesterTimetable]);
    
    // Listen for timetable updates to refresh the display
    useEffect(() => {
        // Get faculty ID from user context (stored in localStorage)
        const getUserFromStorage = () => {
            try {
                const userStr = localStorage.getItem('user');
                if (userStr) {
                    const user = JSON.parse(userStr);
                    const email = user.email || user.id || '';
                    return email.includes('@') ? email.split('@')[0] : email;
                }
            } catch (e) {
                console.error('Error getting user from storage:', e);
            }
            return null;
        };
        
        const handleTimetableUpdate = (e: Event) => {
            const customEvent = e as CustomEvent;
            if (customEvent.detail && customEvent.detail.semester === selectedSemester) {
                console.log('DashboardHome: Received timetable update event, refreshing...', customEvent.detail);
                // Try to get facultyId from event or localStorage
                const facultyId = customEvent.detail.facultyId || getUserFromStorage();
                if (facultyId) {
                    const normalizedId = facultyId.toLowerCase().replace(/[^a-z0-9]/g, '_');
                    const normalizedSem = selectedSemester.toLowerCase().replace(/[^a-z0-9]/g, '_');
                    const storageKey = `timetable_${normalizedId}_${normalizedSem}`;
                    const stored = localStorage.getItem(storageKey);
                    if (stored) {
                        try {
                            const data = JSON.parse(stored);
                            setSemesterTimetable(data);
                            console.log('DashboardHome: Timetable refreshed from localStorage with key:', storageKey);
                        } catch (err) {
                            console.error('Error parsing updated timetable:', err);
                        }
                    } else {
                        console.warn('DashboardHome: No timetable found in localStorage with key:', storageKey);
                    }
                }
            }
        };
        
        const handleStorageChange = (e: StorageEvent) => {
            if (e.key && e.key.startsWith('timetable_') && e.newValue) {
                const normalizedSem = selectedSemester.toLowerCase().replace(/[^a-z0-9]/g, '_');
                // Check if this storage key matches our semester
                if (e.key.includes(normalizedSem)) {
                    try {
                        const data = JSON.parse(e.newValue);
                        setSemesterTimetable(data);
                        console.log('DashboardHome: Timetable refreshed from storage event:', e.key);
                    } catch (err) {
                        console.error('Error parsing storage event timetable:', err);
                    }
                }
            }
        };
        
        window.addEventListener('timetable:updated', handleTimetableUpdate);
        window.addEventListener('storage', handleStorageChange);
        
        return () => {
            window.removeEventListener('timetable:updated', handleTimetableUpdate);
            window.removeEventListener('storage', handleStorageChange);
        };
    }, [selectedSemester]);

    // Use semester timetable if available, otherwise fall back to old format
    if (!semesterTimetable || !semesterTimetable.schedule) {
        return (
            <Card title="Today's Schedule" icon="fa-solid fa-calendar-day" className="md:col-span-2">
                <div className="flex flex-col items-center justify-center h-full text-slate-400 min-h-[200px] p-4">
                    <p className="mb-2 text-center">No timetable set for {selectedSemester}.</p>
                    <p className="text-sm text-center text-slate-500">Please set your timetable in the Timetable section.</p>
                    <p className="text-xs text-center text-slate-600 mt-2">The timetable will appear here once it's configured.</p>
                </div>
            </Card>
        );
    }

    // Get today's schedule entries - map all time slots
    const getTodaySchedule = (): Array<{ time: string; entry: SemesterClass | 'break' | null }> => {
        const entries: Array<{ time: string; entry: SemesterClass | 'break' | null }> = [];
        
        // Map all time slots to their entries
        TIME_SLOTS.forEach(time => {
            if (isBreakTime(time)) {
                entries.push({ time, entry: 'break' });
            } else {
                // Check if any class overlaps with this time slot
                const classEntry = getTimetableEntry(semesterTimetable.schedule, selectedDay, time);
                if (classEntry && classEntry.classType !== 'Free' && classEntry.classType !== 'Busy') {
                    entries.push({ time, entry: classEntry });
                } else if (classEntry && classEntry.classType === 'Busy') {
                    // Include Busy entries in the schedule display
                    entries.push({ time, entry: classEntry });
                } else {
                    // Empty slot
                    entries.push({ time, entry: null });
                }
            }
        });

        return entries;
    };

    const todaySchedule = getTodaySchedule();
    const isToday = selectedDay === getToday();

    // Get formatted date for selected day
    const getFormattedDate = (day: DayOfWeek): string => {
        const today = new Date();
        const currentDayIndex = DAYS.indexOf(getToday());
        const selectedDayIndex = DAYS.indexOf(day);
        const diff = selectedDayIndex - currentDayIndex;
        const targetDate = new Date(today);
        targetDate.setDate(today.getDate() + diff);
        return targetDate.toLocaleDateString("en-IN", { 
            weekday: "long", 
            year: "numeric", 
            month: "long", 
            day: "numeric" 
        });
    };

    // Calculate workload for the day
    const calculateDayWorkload = () => {
        let theoryHours = 0;
        let labHours = 0;
        
        todaySchedule.forEach(({ entry }) => {
            if (entry && entry !== 'break' && entry !== null && entry.classType) {
                const [start, end] = entry.time.split('-');
                const startTime = parseTime(start);
                const endTime = parseTime(end);
                const duration = (endTime - startTime) / 60; // duration in hours
                
                if (entry.classType === "Theory") {
                    theoryHours += duration;
                } else if (entry.classType === "Lab") {
                    labHours += duration;
                }
            }
        });

        return {
            theory: Math.round(theoryHours),
            lab: Math.round(labHours),
            total: Math.round(theoryHours + labHours)
        };
    };

    const workload = calculateDayWorkload();

    // Get coordinator name (from timetable or default to faculty name)
    const getCoordinator = (entry: SemesterClass): string => {
        return entry.coordinator || semesterTimetable.faculty || "—";
    };

    // Get initials from name
    const getInitials = (name: string): string => {
        if (!name || name === "—") return "—";
        const parts = name.split(' ');
        if (parts.length >= 2) {
            return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
        }
        return name.substring(0, 2).toUpperCase();
    };

    const handleNextDay = () => setSelectedDay(getNextDay(selectedDay));
    const handlePrevDay = () => setSelectedDay(getPrevDay(selectedDay));

    return (
        <Card title="Today's Schedule" icon="fa-solid fa-calendar-day" className="md:col-span-2">
            {/* Semester Selector */}
            <div className="mb-4 flex items-center gap-3">
                <select
                    value={selectedSemester}
                    onChange={(e) => onSemesterChange(e.target.value)}
                    className="bg-slate-800/50 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                >
                    {SEMESTER_OPTIONS.map(sem => (
                        <option key={sem} value={sem}>{sem}</option>
                    ))}
                </select>
            </div>

            {/* Day Navigation with Date Header */}
            <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                    <button
                        onClick={handlePrevDay}
                        className="flex items-center gap-2 px-3 py-1.5 bg-slate-800/50 hover:bg-slate-700/50 rounded-lg text-sm text-white transition-colors border border-white/10"
                    >
                        <i className="fa-solid fa-chevron-left text-xs"></i>
                        <span>Prev Day</span>
                    </button>
                    
                    <div className="flex items-center gap-2">
                        <h3 className={`text-lg font-semibold ${isToday ? 'text-purple-400' : 'text-white'}`}>
                            {selectedDay}
                        </h3>
                        {isToday && (
                            <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded-full">
                                Today
                            </span>
                        )}
                    </div>

                    <button
                        onClick={handleNextDay}
                        className="flex items-center gap-2 px-3 py-1.5 bg-slate-800/50 hover:bg-slate-700/50 rounded-lg text-sm text-white transition-colors border border-white/10"
                    >
                        <span>Next Day</span>
                        <i className="fa-solid fa-chevron-right text-xs"></i>
                    </button>
                </div>
                {/* Date Display */}
                <div className="text-center text-sm text-slate-400 mb-3">
                    {getFormattedDate(selectedDay)}
                </div>
            </div>

            {/* Schedule Display - Professional Table Format */}
            <div className="max-h-[500px] overflow-y-auto overflow-x-auto">
                <AnimatePresence mode="wait">
                    {todaySchedule.filter(e => e.entry && e.entry !== 'break' && e.entry !== null).length === 0 ? (
                        <motion.div
                            key="empty"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.2 }}
                            className="text-center text-slate-400 py-8"
                        >
                            <div className="text-4xl mb-2">🎉</div>
                            <p className="text-sm">No classes scheduled for {selectedDay.toLowerCase()} — enjoy your free day!</p>
                        </motion.div>
                    ) : (
                        <motion.div
                            key={selectedDay}
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            transition={{ duration: 0.3 }}
                            className="min-w-full"
                        >
                            {/* Professional Table Header - Desktop */}
                            <div className="hidden md:grid grid-cols-7 gap-2 text-center text-xs font-semibold mb-2 sticky top-0 bg-gradient-to-r from-slate-900/90 to-slate-800/90 backdrop-blur-md z-10 border-b-2 border-purple-500/30 py-3 px-2">
                                <div className="text-slate-300">Time</div>
                                <div className="text-slate-300">Subject</div>
                                <div className="text-slate-300">Course Name</div>
                                <div className="text-slate-300">Type</div>
                                <div className="text-slate-300">Batch/Section</div>
                                <div className="text-slate-300">Coordinator</div>
                                <div className="text-slate-300">Room</div>
                            </div>

                            {/* Table Body - Glass Cards */}
                            <div className="space-y-2">
                                {todaySchedule.map(({ time, entry }, index) => {
                                    const isBreak = isBreakTime(time);
                                    const isCoffeeBreak = time === "10:20-10:40";
                                    const isLunchBreak = time === "12:30-01:15";

                                    return (
                                        <motion.div
                                            key={time}
                                            initial={{ opacity: 0, y: 5 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: index * 0.03 }}
                                            className={`hidden md:grid grid-cols-7 gap-2 items-center py-3 px-2 rounded-lg transition-all ${
                                                isBreak
                                                    ? isCoffeeBreak
                                                        ? 'bg-slate-700/40 backdrop-blur-sm border border-slate-600/50'
                                                        : 'bg-slate-800/50 backdrop-blur-sm border border-slate-700/50'
                                                    : entry && entry !== 'break' && entry !== null
                                                        ? 'bg-gradient-to-r from-indigo-500/15 via-purple-500/10 to-indigo-500/15 backdrop-blur-md border border-white/8 hover:border-purple-400/30 hover:shadow-lg'
                                                        : 'bg-slate-800/30 backdrop-blur-sm border border-slate-700/30'
                                            }`}
                                            style={{
                                                backdropFilter: 'blur(8px)',
                                                background: isBreak
                                                    ? isCoffeeBreak
                                                        ? 'rgba(51, 65, 85, 0.4)'
                                                        : 'rgba(30, 41, 59, 0.5)'
                                                    : entry && entry !== 'break' && entry !== null
                                                        ? 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.1))'
                                                        : 'rgba(30, 41, 59, 0.3)',
                                                borderRadius: '12px',
                                                padding: '12px 16px'
                                            }}
                                        >
                                            {/* Time Column */}
                                            <div className="text-xs text-slate-300 font-mono text-center">
                                                {time}
                                            </div>

                                            {/* Subject Column */}
                                            <div className="text-center">
                                                {isBreak ? (
                                                    <span className="text-slate-400 text-xs">
                                                        {isCoffeeBreak ? '☕' : '🍱'}
                                                    </span>
                                                ) : entry && entry !== 'break' && entry !== null ? (
                                                    <div className="text-lg font-semibold text-white">
                                                        {entry.subjectCode || entry.subject}
                                                    </div>
                                                ) : (
                                                    <span className="text-slate-500 text-xs">—</span>
                                                )}
                                            </div>

                                            {/* Course Name Column */}
                                            <div className="text-center">
                                                {isBreak ? (
                                                    <span className="text-slate-300 text-xs font-medium">
                                                        {isCoffeeBreak ? 'Coffee Break' : 'Lunch Break'}
                                                    </span>
                                                ) : entry && entry !== 'break' && entry !== null ? (
                                                    <div className={`text-sm truncate ${entry.classType === 'Busy' || entry.subject === 'Busy' || entry.courseName?.includes('Busy') ? 'text-orange-400 font-semibold' : 'text-gray-300'}`} title={entry.courseName}>
                                                        {entry.classType === 'Busy' || entry.subject === 'Busy' ? 'Busy - Not Available' : (entry.courseName || entry.subject || "—")}
                                                    </div>
                                                ) : (
                                                    <span className="text-slate-500 text-xs">Free</span>
                                                )}
                                            </div>

                                            {/* Type Column */}
                                            <div className="text-center">
                                                {isBreak ? (
                                                    <span className="px-2 py-1 rounded text-xs font-medium bg-slate-600/30 text-slate-300">
                                                        🟫 Break
                                                    </span>
                                                ) : entry && entry !== 'break' && entry !== null && entry.classType ? (
                                                    entry.classType === 'Busy' || entry.subject === 'Busy' || entry.courseName?.includes('Busy') ? (
                                                        <span className="px-2 py-1 rounded text-xs font-medium bg-orange-500/20 text-orange-400">
                                                            🔴 Busy
                                                        </span>
                                                    ) : (
                                                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                                                            entry.classType === 'Theory' 
                                                                ? 'bg-green-500/20 text-green-400' 
                                                                : entry.classType === 'Lab'
                                                                ? 'bg-blue-500/20 text-blue-400'
                                                                : 'bg-slate-500/20 text-slate-400'
                                                        }`}>
                                                            {entry.classType === 'Theory' && '🟩'} 
                                                            {entry.classType === 'Lab' && '🟦'}
                                                            {' '}{entry.classType}
                                                        </span>
                                                    )
                                                ) : (
                                                    <span className="text-slate-500 text-xs">—</span>
                                                )}
                                            </div>

                                            {/* Batch/Section Column */}
                                            <div className="text-center">
                                                {entry && entry !== 'break' && entry !== null && entry.batch ? (
                                                    <span className="text-sm text-gray-300">
                                                        {entry.batch}
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-500 text-xs">—</span>
                                                )}
                                            </div>

                                            {/* Coordinator Column */}
                                            <div className="text-center">
                                                {entry && entry !== 'break' && entry !== null ? (
                                                    <div className="flex items-center justify-center gap-1.5">
                                                        <span className="text-xs bg-purple-500/20 text-purple-300 rounded-full w-6 h-6 flex items-center justify-center font-semibold">
                                                            {getInitials(getCoordinator(entry))}
                                                        </span>
                                                        <span className="text-xs text-gray-300 truncate max-w-[80px]" title={getCoordinator(entry)}>
                                                            {getCoordinator(entry).split(' ').pop() || getCoordinator(entry)}
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <span className="text-slate-500 text-xs">—</span>
                                                )}
                                            </div>

                                            {/* Room Column */}
                                            <div className="text-center">
                                                {entry && entry !== 'break' && entry !== null && entry.room ? (
                                                    <span className="text-sm text-gray-300">
                                                        {entry.room}
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-500 text-xs">—</span>
                                                )}
                                            </div>
                                        </motion.div>
                                    );
                                })}
                                
                                {/* Mobile Card View */}
                                {todaySchedule.map(({ time, entry }, index) => {
                                    const isBreak = isBreakTime(time);
                                    const isCoffeeBreak = time === "10:20-10:40";
                                    const isLunchBreak = time === "12:30-01:15";

                                    return (
                                        <motion.div
                                            key={`mobile-${time}`}
                                            initial={{ opacity: 0, y: 5 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: index * 0.03 }}
                                            className={`md:hidden rounded-lg p-4 transition-all ${
                                                isBreak
                                                    ? isCoffeeBreak
                                                        ? 'bg-slate-700/40 backdrop-blur-sm border border-slate-600/50'
                                                        : 'bg-slate-800/50 backdrop-blur-sm border border-slate-700/50'
                                                    : entry && entry !== 'break' && entry !== null
                                                        ? 'bg-gradient-to-r from-indigo-500/15 via-purple-500/10 to-indigo-500/15 backdrop-blur-md border border-white/8'
                                                        : 'bg-slate-800/30 backdrop-blur-sm border border-slate-700/30'
                                            }`}
                                            style={{
                                                backdropFilter: 'blur(8px)',
                                                background: isBreak
                                                    ? isCoffeeBreak
                                                        ? 'rgba(51, 65, 85, 0.4)'
                                                        : 'rgba(30, 41, 59, 0.5)'
                                                    : entry && entry !== 'break' && entry !== null
                                                        ? 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.1))'
                                                        : 'rgba(30, 41, 59, 0.3)',
                                                borderRadius: '12px',
                                                padding: '12px 16px'
                                            }}
                                        >
                                            <div className="flex items-start justify-between mb-2">
                                                <div className="text-xs text-slate-300 font-mono">{time}</div>
                                                {entry && entry !== 'break' && entry !== null && entry.classType && (
                                                    entry.classType === 'Busy' || entry.subject === 'Busy' || entry.courseName?.includes('Busy') ? (
                                                        <span className="px-2 py-1 rounded text-xs font-medium bg-orange-500/20 text-orange-400">
                                                            🔴 Busy
                                                        </span>
                                                    ) : (
                                                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                                                            entry.classType === 'Theory' 
                                                                ? 'bg-green-500/20 text-green-400' 
                                                                : entry.classType === 'Lab'
                                                                ? 'bg-blue-500/20 text-blue-400'
                                                                : 'bg-slate-500/20 text-slate-400'
                                                        }`}>
                                                            {entry.classType === 'Theory' && '🟩'} 
                                                            {entry.classType === 'Lab' && '🟦'}
                                                            {' '}{entry.classType}
                                                        </span>
                                                    )
                                                )}
                                            </div>
                                            
                                            {isBreak ? (
                                                <div className="text-sm text-slate-300 font-medium">
                                                    {isCoffeeBreak ? '☕ Coffee Break' : '🍱 Lunch Break'}
                                                </div>
                                            ) : entry && entry !== 'break' && entry !== null ? (
                                                <>
                                                    <div className={`text-lg font-semibold mb-1 ${entry.classType === 'Busy' || entry.subject === 'Busy' ? 'text-orange-400' : 'text-white'}`}>
                                                        {entry.subjectCode || entry.subject}
                                                    </div>
                                                    {(entry.courseName || entry.classType === 'Busy' || entry.subject === 'Busy') && (
                                                        <div className={`text-sm mb-2 ${entry.classType === 'Busy' || entry.subject === 'Busy' || entry.courseName?.includes('Busy') ? 'text-orange-400 font-semibold' : 'text-gray-300'}`}>
                                                            {entry.classType === 'Busy' || entry.subject === 'Busy' ? 'Busy - Not Available' : entry.courseName}
                                                        </div>
                                                    )}
                                                    <div className="flex flex-wrap gap-3 text-xs text-gray-400">
                                                        {entry.batch && (
                                                            <span><i className="fa-solid fa-users mr-1"></i>{entry.batch}</span>
                                                        )}
                                                        {entry.room && (
                                                            <span><i className="fa-solid fa-door-open mr-1"></i>Room: {entry.room}</span>
                                                        )}
                                                        {getCoordinator(entry) !== "—" && (
                                                            <span className="flex items-center gap-1">
                                                                <span className="bg-purple-500/20 text-purple-300 rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-semibold">
                                                                    {getInitials(getCoordinator(entry))}
                                                                </span>
                                                                {getCoordinator(entry).split(' ').pop()}
                                                            </span>
                                                        )}
                                                    </div>
                                                </>
                                            ) : (
                                                <div className="text-slate-500 text-sm">Free</div>
                                            )}
                                        </motion.div>
                                    );
                                })}
                            </div>

                            {/* Workload Summary */}
                            {(workload.theory > 0 || workload.lab > 0) && (
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: todaySchedule.length * 0.03 }}
                                    className="mt-4 pt-4 border-t border-slate-700/50"
                                >
                                    <div className="flex items-center justify-center gap-4 text-sm">
                                        <span className="text-slate-400">
                                            <span className="text-green-400 font-semibold">Theory:</span> {workload.theory} hrs
                                        </span>
                                        <span className="text-slate-500">|</span>
                                        <span className="text-slate-400">
                                            <span className="text-blue-400 font-semibold">Lab:</span> {workload.lab} hrs
                                        </span>
                                        <span className="text-slate-500">|</span>
                                        <span className="text-slate-400">
                                            <span className="text-purple-400 font-semibold">Total:</span> {workload.total} Units
                                        </span>
                                    </div>
                                </motion.div>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </Card>
    );
};

const CallUpdatesCard: React.FC<{ updates: CallUpdate[] }> = ({ updates }) => (
  <Card title="Call Updates" icon="fa-solid fa-phone-volume">
    {updates.length === 0 ? (
      <p className="text-slate-400">No recent calls.</p>
    ) : (
      <div className="space-y-3">
        {updates.map((update) => (
          <div
            key={update.id}
            className="bg-slate-800/50 border border-white/10 rounded-lg px-4 py-3 flex items-center justify-between"
          >
            <div>
              <p className="font-semibold text-white">{update.clientName}</p>
              <p className="text-xs text-slate-400">
                {update.direction === 'incoming' ? 'Incoming' : 'Outgoing'} call •{' '}
                {new Date(update.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
              {update.purpose && <p className="text-xs text-slate-500 mt-1 line-clamp-1">{update.purpose}</p>}
            </div>
            <span
              className={`text-xs font-semibold px-3 py-1 rounded-full ${
                update.status === 'answered'
                  ? 'bg-green-500/20 text-green-400'
                  : update.status === 'ringing'
                  ? 'bg-yellow-500/20 text-yellow-400'
                  : update.status === 'declined'
                  ? 'bg-red-500/20 text-red-400'
                  : 'bg-slate-700/40 text-slate-300'
              }`}
            >
              {update.status.charAt(0).toUpperCase() + update.status.slice(1)}
            </span>
          </div>
        ))}
      </div>
    )}
  </Card>
);

const MeetingsCard: React.FC<{ meetings: Meeting[] }> = ({ meetings }) => (
    <Card title="Upcoming Meetings" icon="fa-solid fa-users-viewfinder">
        {meetings.length === 0 ? (
            <p className="text-slate-400">No upcoming meetings.</p>
        ) : (
            <div className="space-y-3">
                {meetings.map(meeting => (
                    <div key={meeting.id} className="bg-slate-800/50 p-3 rounded-lg">
                        <p className="font-semibold">{meeting.title}</p>
                        <p className="text-sm text-slate-400 flex items-center space-x-2 mt-1">
                            <i className="fa-regular fa-calendar-alt"></i>
                            <span>{new Date(meeting.date).toLocaleDateString()} at {meeting.time}</span>
                        </p>
                         <p className="text-sm text-slate-400 flex items-center space-x-2 mt-1">
                            <i className="fa-solid fa-location-dot"></i>
                            <span>{meeting.location}</span>
                        </p>
                    </div>
                ))}
            </div>
        )}
    </Card>
);


const AppointmentsCard: React.FC<{ appointments: Appointment[] }> = ({ appointments }) => (
  <Card title="Appointments" icon="fa-solid fa-handshake">
    {appointments.length === 0 ? (
      <p className="text-slate-400">No appointments scheduled.</p>
    ) : (
      <div className="space-y-3">
        {appointments.map((apt) => (
          <div key={apt.id} className="bg-slate-800/50 p-3 rounded-lg flex justify-between items-center">
            <div>
              <p className="font-semibold">{apt.clientName}</p>
              <p className="text-sm text-slate-400 flex items-center space-x-2">
                <i className="fa-regular fa-clock"></i>
                <span>
                  {apt.date}, {apt.time}
                </span>
              </p>
              {apt.purpose && <p className="text-xs text-slate-500 mt-1">{apt.purpose}</p>}
            </div>
            <span
              className={`px-3 py-1 text-xs rounded-full ${
                apt.status === 'Confirmed'
                  ? 'bg-green-500/20 text-green-400'
                  : apt.status === 'Pending'
                  ? 'bg-yellow-500/20 text-yellow-400'
                  : 'bg-red-500/20 text-red-400'
              }`}
            >
              {apt.status}
            </span>
          </div>
        ))}
      </div>
    )}
  </Card>
);

const PendingAppointmentsCard: React.FC<{
  items: PendingAppointment[];
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
}> = ({ items, onAccept, onReject }) => (
  <Card title="Pending Appointments" icon="fa-solid fa-calendar-check">
    {items.length === 0 ? (
      <p className="text-slate-400">No pending appointments.</p>
    ) : (
      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.id} className="bg-slate-800/50 p-4 rounded-xl border border-white/10">
            <div className="flex justify-between items-start gap-4">
              <div>
                <p className="text-white font-semibold">{item.clientName}</p>
                {item.purpose && <p className="text-xs text-slate-400 mt-1">{item.purpose}</p>}
                <p className="text-xs text-slate-500 mt-1">
                  Requested{' '}
                  {new Date(item.requestedAt).toLocaleString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                    day: 'numeric',
                    month: 'short',
                  })}
                </p>
                {item.scheduledFor && (item.scheduledFor.date || item.scheduledFor.time) && (
                  <p className="text-xs text-slate-400 mt-1">
                    Proposed: {item.scheduledFor.date || '—'}
                    {item.scheduledFor.time ? ` at ${item.scheduledFor.time}` : ''}
                  </p>
                )}
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => onReject(item.id)}
                  className="px-3 py-1 text-xs rounded-full bg-red-500/20 text-red-400 hover:bg-red-500/30 transition"
                >
                  Reject
                </button>
                <button
                  onClick={() => onAccept(item.id)}
                  className="px-3 py-1 text-xs rounded-full bg-green-500/20 text-green-400 hover:bg-green-500/30 transition"
                >
                  Accept
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    )}
  </Card>
);

interface DashboardHomeProps {
  timetable: TimetableEntry[];
  meetings: Meeting[];
  appointments: Appointment[];
  callUpdates: CallUpdate[];
  pendingAppointments: PendingAppointment[];
  onAcceptPendingAppointment: (id: string) => void;
  onRejectPendingAppointment: (id: string) => void;
  semesterTimetable: SemesterTimetable | null;
  selectedSemester: string;
  onSemesterChange: (semester: string) => void;
}

const DashboardHome: React.FC<DashboardHomeProps> = ({
  timetable,
  meetings,
  appointments,
  callUpdates,
  pendingAppointments,
  onAcceptPendingAppointment,
  onRejectPendingAppointment,
  semesterTimetable,
  selectedSemester,
  onSemesterChange,
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-full">
      <TimetableCard
        timetable={timetable}
        semesterTimetable={semesterTimetable}
        selectedSemester={selectedSemester}
        onSemesterChange={onSemesterChange}
      />
      <CallUpdatesCard updates={callUpdates} />
      <MeetingsCard meetings={meetings} />
      <PendingAppointmentsCard
        items={pendingAppointments}
        onAccept={onAcceptPendingAppointment}
        onReject={onRejectPendingAppointment}
      />
      <AppointmentsCard appointments={appointments} />
    </div>
  );
};

export default DashboardHome;