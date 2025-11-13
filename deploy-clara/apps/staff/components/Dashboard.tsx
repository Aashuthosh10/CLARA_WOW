import React, { useState, createContext, useEffect, useCallback, lazy, Suspense } from 'react';
import {
  StaffProfile,
  NavItem,
  TimetableEntry,
  Meeting,
  Group,
  ChatMessage,
  SemesterTimetable,
  CallUpdate,
  PendingAppointment,
  Appointment,
} from '../types';
import { HOD_EMAIL } from '../constants';
import Sidebar from './Sidebar';
import DashboardHome from './DashboardHome';
import AIChatAssistant from './AIChatAssistant';
import TaskManagement from './TaskManagement';
import MeetingSummarizer from './MeetingSummarizer';
import Timetable from './Timetable';
// Lazy load Attendance component
const Attendance = lazy(() => import('../src/pages/Attendance/index'));
import TeamDirectory from './TeamDirectory';
import Settings from './Settings';
import { useNotification } from './NotificationProvider';
import NotificationContainer from './NotificationContainer';
import NotificationSync from './NotificationSync';
import { apiService } from '../services/api';
import { StaffRTC, type CallIncomingEvent } from '../services/StaffRTC';
import FloatingCallNotification from './FloatingCallNotification';
import { useStaffCallStore } from '../src/stores/callStore';
import CallRoom from './CallRoom';

interface DashboardProps {
  user: StaffProfile;
  onLogout: () => void;
  initialView?: NavItem;
}

export const UserContext = createContext<{ user: StaffProfile | null }>({ user: null });

const Appointments: React.FC = () => <div className="text-white p-6 rounded-2xl bg-slate-900/50 backdrop-blur-lg border border-white/10">Appointments Content</div>;

const Header: React.FC<{ activeView: NavItem, onLogout: () => void, user?: StaffProfile }> = ({ activeView, onLogout, user }) => (
    <header className="flex justify-between items-center mb-6 bg-slate-900/30 backdrop-blur-lg border border-white/10 rounded-2xl p-6">
        <div>
            <h1 className="text-3xl font-bold text-white">{activeView}</h1>
            <p className="text-slate-400">Welcome back{user ? `, ${user.name.split(' ').pop()}` : ''}! Here's what's happening today.</p>
        </div>
        <div className="flex items-center space-x-4">
            <span className="flex items-center space-x-2 bg-green-500/20 text-green-400 px-3 py-1 rounded-full text-sm">
                <span className="w-2 h-2 bg-green-400 rounded-full"></span>
                <span>Connected</span>
            </span>
            <button
                onClick={onLogout}
                className="bg-red-500/80 hover:bg-red-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors"
            >
                <i className="fa-solid fa-right-from-bracket"></i>
                <span>Logout</span>
            </button>
        </div>
    </header>
);

const Dashboard: React.FC<DashboardProps> = ({ user, onLogout, initialView = 'Dashboard' }) => {
  const [activeView, setActiveView] = useState<NavItem>(initialView);
  const [incomingCall, setIncomingCall] = useState<CallIncomingEvent | null>(null);
  const [staffRTC, setStaffRTC] = useState<StaffRTC | null>(null);
  const [timetable, setTimetable] = useState<TimetableEntry[]>([]);
  const [semesterTimetable, setSemesterTimetable] = useState<SemesterTimetable | null>(null);
  const [selectedSemester, setSelectedSemester] = useState<string>(() => {
    // Initialize from localStorage if available
    return localStorage.getItem('selectedSemester') || "5th Semester";
  });
  
  // Handler for semester change that also reloads timetable
  const handleSemesterChange = (semester: string) => {
    setSelectedSemester(semester);
    // Save to localStorage for AI Assistant to sync
    localStorage.setItem('selectedSemester', semester);
    // Dispatch custom event for same-tab updates
    window.dispatchEvent(new CustomEvent('semester:changed', {
      detail: { semester }
    }));
    // The useEffect will automatically reload the timetable when selectedSemester changes
  };
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>(() => {
    try {
      const stored = localStorage.getItem('staff-appointments');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const [pendingAppointments, setPendingAppointments] = useState<PendingAppointment[]>([]);
  const [callUpdates, setCallUpdates] = useState<CallUpdate[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [activeChatGroup, setActiveChatGroup] = useState<string | null>(null);
  const { addNotification } = useNotification();
  const isCallActive = useStaffCallStore((state) => state.state === 'connecting' || state.state === 'in_call');

  const isHod = user.email === HOD_EMAIL;
  const staffId = user.email?.split('@')[0] || user.id;

  const persistAppointments = useCallback(
    (updater: (prev: Appointment[]) => Appointment[]) => {
      setAppointments((prev) => {
        const next = updater(prev);
        try {
          localStorage.setItem('staff-appointments', JSON.stringify(next));
        } catch (error) {
          console.error('[Dashboard] Failed to persist appointments:', error);
        }
        return next;
      });
    },
    []
  );

  const pushCallUpdate = useCallback((update: CallUpdate) => {
    setCallUpdates((prev) => {
      const filtered = prev.filter((entry) => entry.callId !== update.callId);
      return [update, ...filtered].slice(0, 10);
    });
  }, []);

  const addPendingAppointment = useCallback((appointment: PendingAppointment) => {
    setPendingAppointments((prev) => {
      const exists = prev.some((item) => item.callId === appointment.callId);
      if (exists) {
        return prev;
      }
      return [appointment, ...prev];
    });
  }, []);

  const removePendingAppointment = useCallback((appointmentId: string) => {
    setPendingAppointments((prev) => prev.filter((item) => item.id !== appointmentId));
  }, []);

  const handleApprovePendingAppointment = useCallback(
    (pendingId: string) => {
      setPendingAppointments((prevPending) => {
        const item = prevPending.find((p) => p.id === pendingId);
        if (!item) {
          return prevPending;
        }

        const scheduledDate = item.scheduledFor?.date || new Date().toLocaleDateString();
        const scheduledTime =
          item.scheduledFor?.time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const appointmentRecord: Appointment = {
          id: `apt-${item.callId}`,
          clientName: item.clientName,
          purpose: item.purpose || 'Video consultation',
          date: scheduledDate,
          time: scheduledTime,
          status: 'Confirmed',
          staffId,
        };

        persistAppointments((prev) => [...prev, appointmentRecord]);

        if (staffRTC) {
          staffRTC.notifyAppointmentDecision(item.callId, 'confirmed', {
            staffId,
            staffName: user.name,
            clientName: item.clientName,
            date: scheduledDate,
            time: scheduledTime,
            purpose: appointmentRecord.purpose,
          });
        }

        return prevPending.filter((p) => p.id !== pendingId);
      });
    },
    [persistAppointments, staffRTC, staffId, user.name]
  );

  const handleRejectPendingAppointment = useCallback(
    (pendingId: string) => {
      setPendingAppointments((prevPending) => {
        const item = prevPending.find((p) => p.id === pendingId);
        if (!item) {
          return prevPending;
        }

        if (staffRTC) {
          const now = new Date();
          staffRTC.notifyAppointmentDecision(item.callId, 'rejected', {
            staffId,
            staffName: user.name,
            clientName: item.clientName,
            date: now.toLocaleDateString(),
            time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            purpose: item.purpose,
          });
        }

        return prevPending.filter((p) => p.id !== pendingId);
      });
    },
    [staffRTC, staffId, user.name]
  );

  const handleEndActiveCall = useCallback(async () => {
    const store = useStaffCallStore.getState();
    const activeCallId = store.callData.callId;

    if (activeCallId && staffRTC) {
      try {
        await staffRTC.endCall(activeCallId);
      } catch (error) {
        console.error('[Dashboard] Failed to end call via StaffRTC:', error);
      }
    }

    try {
      store.endCall();
    } catch (error) {
      console.warn('[Dashboard] Failed to update call store on end:', error);
    }

    addNotification({
      type: 'meeting',
      title: 'Call Ended',
      message: 'Video call closed successfully.',
    });
  }, [staffRTC, addNotification]);

  const registerRtcHandlers = useCallback(
    (rtc: StaffRTC) => {
      rtc.attachHandlers({
        onIncoming: (call) => {
          const clientName = call.clientInfo.name || call.clientInfo.clientId || 'Client';
          pushCallUpdate({
            id: `${call.callId}-${call.ts}`,
            callId: call.callId,
            clientName,
            timestamp: call.ts || Date.now(),
            direction: 'incoming',
            status: 'ringing',
            purpose: call.purpose,
          });
          try {
            useStaffCallStore.getState().onIncoming({
              callId: call.callId,
              clientInfo: {
                id: call.clientInfo.clientId,
                name: clientName,
                avatar: call.clientInfo.avatar,
              },
              reason: call.purpose,
              createdAt: call.ts,
            });
            useStaffCallStore.getState().showPopup();
          } catch (error) {
            console.warn('[Dashboard] Failed to forward incoming call to call store:', error);
          }
          setIncomingCall(call);
        },
        onUpdate: (update) => {
          if (!update.callId) {
            return;
          }
          if (update.callId) {
            setCallUpdates((prev) =>
              prev.map((entry) => {
                if (entry.callId !== update.callId) {
                  return entry;
                }
                let status: CallUpdate['status'] = entry.status;
                if (update.state === 'accepted') status = 'answered';
                if (update.state === 'declined') status = 'declined';
                if (update.state === 'ended') status = 'ended';
                if (update.state === 'ringing') status = 'ringing';
                return { ...entry, status };
              })
            );
          }

          if ((update.state === 'declined' || update.state === 'ended') && update.callId) {
            removePendingAppointment(update.callId);
            try {
              const store = useStaffCallStore.getState();
              if (update.state === 'ended') {
                store.endCall();
              } else {
                store.declineCall(update.reason);
              }
            } catch (error) {
              console.warn('[Dashboard] Failed to sync call store on update:', error);
            }
          }

          if (update.state === 'accepted' && update.callId) {
            try {
              useStaffCallStore.getState().setInCall({ callId: update.callId });
            } catch (error) {
              console.warn('[Dashboard] Failed to set call store in_call state:', error);
            }
          }
        },
      });
    },
    [pushCallUpdate, removePendingAppointment]
  );

  // Load current semester timetable for dashboard display
  useEffect(() => {
    if (!user) return;
    
    const loadSemesterTimetable = async () => {
      try {
        const facultyId = user.email?.split('@')[0] || user.id || user.email || '';
        const normalizedFacultyId = facultyId.includes('@') ? facultyId.split('@')[0] : facultyId;
        
        // Try to load from localStorage first (fastest)
        const getLocalStorageKey = (facultyId: string, semester: string): string => {
          const normalizedId = facultyId.toLowerCase().replace(/[^a-z0-9]/g, '_');
          const normalizedSem = semester.toLowerCase().replace(/[^a-z0-9]/g, '_');
          return `timetable_${normalizedId}_${normalizedSem}`;
        };
        
        const key = getLocalStorageKey(normalizedFacultyId, selectedSemester);
        const stored = localStorage.getItem(key);
        if (stored) {
          const data = JSON.parse(stored);
          setSemesterTimetable(data);
          return;
        }
        
        // Try to load from API
        try {
          const { timetableApi } = await import('../services/timetableApi');
          const apiData = await timetableApi.getTimetable(normalizedFacultyId, selectedSemester);
          const convertedData: SemesterTimetable = {
            faculty: apiData.faculty,
            designation: apiData.designation,
            semester: apiData.semester,
            schedule: apiData.schedule,
          };
          setSemesterTimetable(convertedData);
          // Also save to localStorage for future use
          const saveKey = getLocalStorageKey(normalizedFacultyId, selectedSemester);
          localStorage.setItem(saveKey, JSON.stringify(convertedData));
          console.log('✅ Loaded timetable from API and saved to localStorage:', saveKey);
        } catch (apiError) {
          // If API fails, log the error but don't throw
          console.warn('⚠️ Could not load timetable from API for dashboard:', apiError);
          console.warn('   This is normal if no timetable has been set yet.');
          // Keep null to show empty state message
        }
      } catch (error) {
        console.error('Error loading semester timetable for dashboard:', error);
      }
    };
    
    loadSemesterTimetable();
    
    // Listen for timetable updates via localStorage changes
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key && e.key.startsWith('timetable_')) {
        const facultyId = user.email?.split('@')[0] || user.id || user.email || '';
        const normalizedFacultyId = facultyId.includes('@') ? facultyId.split('@')[0] : facultyId;
        const key = `timetable_${normalizedFacultyId.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${selectedSemester.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
        if (e.key === key && e.newValue) {
          try {
            const data = JSON.parse(e.newValue);
            setSemesterTimetable(data);
          } catch (err) {
            console.error('Error parsing updated timetable:', err);
          }
        }
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    
    // Also listen for custom events (for same-tab updates)
    const handleTimetableUpdate = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail && customEvent.detail.semester === selectedSemester) {
        console.log('Dashboard received timetable update event:', customEvent.detail);
        // Reload from localStorage to ensure consistency
        const facultyId = user.email?.split('@')[0] || user.id || user.email || '';
        const normalizedFacultyId = facultyId.includes('@') ? facultyId.split('@')[0] : facultyId;
        const getLocalStorageKey = (facultyId: string, semester: string): string => {
          const normalizedId = facultyId.toLowerCase().replace(/[^a-z0-9]/g, '_');
          const normalizedSem = semester.toLowerCase().replace(/[^a-z0-9]/g, '_');
          return `timetable_${normalizedId}_${normalizedSem}`;
        };
        const key = getLocalStorageKey(normalizedFacultyId, selectedSemester);
        const stored = localStorage.getItem(key);
        if (stored) {
          try {
            const data = JSON.parse(stored);
            console.log('Dashboard updating timetable from localStorage:', data);
            setSemesterTimetable(data);
          } catch (err) {
            console.error('Error parsing updated timetable:', err);
            // Fallback to event data
            if (customEvent.detail.timetable) {
              setSemesterTimetable(customEvent.detail.timetable);
            }
          }
        } else {
          // Use event data if localStorage not available
          if (customEvent.detail.timetable) {
            console.log('Dashboard updating timetable from event data:', customEvent.detail.timetable);
            setSemesterTimetable(customEvent.detail.timetable);
          }
        }
        
        // Also try to reload from API to ensure we have the latest data
        const reloadFromApi = async () => {
          try {
            const { timetableApi } = await import('../services/timetableApi');
            const apiData = await timetableApi.getTimetable(normalizedFacultyId, selectedSemester);
            const convertedData: SemesterTimetable = {
              faculty: apiData.faculty,
              designation: apiData.designation,
              semester: apiData.semester,
              schedule: apiData.schedule,
            };
            console.log('Dashboard reloaded timetable from API:', convertedData);
            setSemesterTimetable(convertedData);
          } catch (apiError) {
            console.log('Could not reload from API, using cached data:', apiError);
          }
        };
        
        // Reload from API after a short delay to ensure DB has been updated
        setTimeout(reloadFromApi, 500);
      }
    };
    
    window.addEventListener('timetable:updated', handleTimetableUpdate);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('timetable:updated', handleTimetableUpdate);
    };
  }, [user, selectedSemester]);

  useEffect(() => {
    if (user) {
      const savedTimetable = localStorage.getItem(`timetable_${user.id}`);
      setTimetable(savedTimetable ? JSON.parse(savedTimetable) : []);
    }
    const savedMeetings = localStorage.getItem('meetings');
    setMeetings(savedMeetings ? JSON.parse(savedMeetings) : []);
    const savedAppointments = localStorage.getItem('staff-appointments');
    setAppointments(savedAppointments ? JSON.parse(savedAppointments) : []);
    const savedGroups = localStorage.getItem('groups');
    setGroups(savedGroups ? JSON.parse(savedGroups) : []);

    // Initialize unified RTC if enabled
    const enableUnified = (import.meta.env.VITE_ENABLE_UNIFIED_MODE ?? 'true') === 'true';
    if (enableUnified && user && !staffRTC) {
      // Always use backend server port (8080), not the staff dev server port
      const apiBase = import.meta.env.VITE_API_BASE || 'http://localhost:8080';

      const getStoredToken = () =>
        localStorage.getItem('token') || localStorage.getItem('clara-jwt-token') || null;

      const storeToken = (tokenValue: string) => {
        localStorage.setItem('token', tokenValue);
        localStorage.setItem('clara-jwt-token', tokenValue);
      };

      const ensureAvailability = async (tokenValue: string) => {
        try {
          await fetch(`${apiBase}/api/v1/staff/availability`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${tokenValue}`,
            },
            body: JSON.stringify({ status: 'available', orgId: 'default' }),
          });
          console.log('[Dashboard] Staff availability set to available');
        } catch (error) {
          console.error('[Dashboard] Failed to set staff availability:', error);
        }
      };

      const initializeRTC = async (tokenValue: string) => {
        await ensureAvailability(tokenValue);
        const rtc = new StaffRTC({
          token: tokenValue,
          staffId,
        });
        registerRtcHandlers(rtc);
        setStaffRTC(rtc);
      };

      const token = getStoredToken();
      if (!token) {
        fetch(`${apiBase}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: user.email,
            role: 'staff',
            staffId: user.id,
            dept: user.department || 'general',
          }),
        })
          .then((res) => res.json())
          .then(async (data) => {
            if (data.token) {
              storeToken(data.token);
              await initializeRTC(data.token);
            }
          })
          .catch(console.error);
      } else {
        void initializeRTC(token);
      }
    }

    return () => {
      if (staffRTC) {
        staffRTC.disconnect();
      }
    };
  }, [user, staffRTC, staffId, registerRtcHandlers]);

  useEffect(() => {
    if (staffRTC) {
      registerRtcHandlers(staffRTC);
    }
  }, [staffRTC, registerRtcHandlers]);
  
  // When active view changes away from Team Directory, clear the active chat
  useEffect(() => {
    if (activeView !== 'Team Directory') {
      setActiveChatGroup(null);
    }
  }, [activeView]);

  const handleTimetableUpdate = (newTimetable: TimetableEntry[]) => {
    setTimetable(newTimetable);
    if (user) {
        localStorage.setItem(`timetable_${user.id}`, JSON.stringify(newTimetable));
    }
  };

  const handleSetMeeting = (meetingData: Omit<Meeting, 'id'>) => {
    const newMeeting = { ...meetingData, id: Date.now().toString() };
    const updatedMeetings = [...meetings, newMeeting];
    setMeetings(updatedMeetings);
    localStorage.setItem('meetings', JSON.stringify(updatedMeetings));
    addNotification({
        type: 'meeting',
        title: 'New Meeting Scheduled',
        message: `"${newMeeting.title}" on ${new Date(newMeeting.date).toLocaleDateString()}`
    });
  };

  const handleCreateGroup = (groupData: Omit<Group, 'id'>) => {
    const newGroup = { ...groupData, id: Date.now().toString(), messages: [] };
    const updatedGroups = [...groups, newGroup];
    setGroups(updatedGroups);
    localStorage.setItem('groups', JSON.stringify(updatedGroups));
  };

  const handleAddMessage = async (groupId: string, messageData: Omit<ChatMessage, 'id'>) => {
    const newMessage = { ...messageData, id: Date.now().toString() };
    const updatedGroups = groups.map(g => 
      g.id === groupId ? { ...g, messages: [...g.messages, newMessage] } : g
    );
    setGroups(updatedGroups);
    localStorage.setItem('groups', JSON.stringify(updatedGroups));

    // Find the group to get member IDs
    const group = updatedGroups.find(g => g.id === groupId);
    if (group && group.members && group.members.length > 0) {
      // Send notification to all group members except the sender
      try {
        await apiService.createNotification(
          group.members,
          'message',
          `New Message in ${group.name}`,
          `${messageData.senderName}: ${messageData.text.substring(0, 40)}${messageData.text.length > 40 ? '...' : ''}`,
          groupId,
          user.id
        );
      } catch (error) {
        console.error('Error creating notification:', error);
      }
    }
  };

  const renderActiveComponent = () => {
    switch (activeView) {
      case 'Dashboard':
        return (
          <DashboardHome
            timetable={timetable}
            meetings={meetings}
            appointments={appointments}
            callUpdates={callUpdates}
            pendingAppointments={pendingAppointments}
            onAcceptPendingAppointment={handleApprovePendingAppointment}
            onRejectPendingAppointment={handleRejectPendingAppointment}
            semesterTimetable={semesterTimetable}
            selectedSemester={selectedSemester}
            onSemesterChange={handleSemesterChange}
          />
        );
      case 'Timetable':
        return <Timetable initialTimetable={timetable} onTimetableUpdate={handleTimetableUpdate} user={user} />;
      case 'Attendance':
        return (
          <Suspense fallback={<div className="p-6 text-white">Loading Attendance...</div>}>
            <Attendance />
          </Suspense>
        );
      case 'Appointments':
        return <Appointments />;
      case 'Task Management':
        return <TaskManagement />;
      case 'AI Assistant':
        return <AIChatAssistant />;
      case 'Meeting Summarizer':
        return <MeetingSummarizer />;
      case 'Team Directory':
        return <TeamDirectory 
                  isHod={isHod} 
                  currentUser={user}
                  groups={groups}
                  meetings={meetings}
                  onSetMeeting={handleSetMeeting}
                  onCreateGroup={handleCreateGroup}
                  onAddMessage={handleAddMessage}
                  activeChatGroup={activeChatGroup}
                  setActiveChatGroup={setActiveChatGroup}
                />;
      case 'Settings':
        return <Settings />;
      default:
        return (
          <DashboardHome
            timetable={timetable}
            meetings={meetings}
            appointments={appointments}
            callUpdates={callUpdates}
            pendingAppointments={pendingAppointments}
            onAcceptPendingAppointment={handleApprovePendingAppointment}
            onRejectPendingAppointment={handleRejectPendingAppointment}
            semesterTimetable={semesterTimetable}
            selectedSemester={selectedSemester}
            onSemesterChange={handleSemesterChange}
          />
        );
    }
  };

  const handleAcceptCall = async () => {
    if (!incomingCall || !staffRTC) return;
    try {
      useStaffCallStore.getState().acceptCall();
    } catch (error) {
      console.warn('[Dashboard] Failed to update call store on accept:', error);
    }
    pushCallUpdate({
      id: `${incomingCall.callId}-accept`,
      callId: incomingCall.callId,
      clientName: incomingCall.clientInfo.name || incomingCall.clientInfo.clientId || 'Client',
      timestamp: Date.now(),
      direction: 'incoming',
      status: 'answered',
      purpose: incomingCall.reason,
    });
    const result = await staffRTC.accept(incomingCall.callId);
    if (result) {
      useStaffCallStore
        .getState()
        .setInCall({
          callId: incomingCall.callId,
          clientInfo: {
            id: incomingCall.clientInfo.clientId,
            name: incomingCall.clientInfo.name,
          },
          peerConnection: result.pc,
          localStream: result.stream,
          remoteStream: result.remoteStream,
          startedAt: Date.now(),
          reason: incomingCall.reason,
        });
      if (result.pc) {
        result.pc.addEventListener('track', (event: RTCTrackEvent) => {
          const remoteStream = event.streams?.[0];
          if (!remoteStream) return;
          useStaffCallStore.getState().setInCall({ remoteStream });
        });
      }
      addPendingAppointment({
        id: incomingCall.callId,
        callId: incomingCall.callId,
        clientName: incomingCall.clientInfo.name || incomingCall.clientInfo.clientId || 'Client',
        purpose: incomingCall.reason,
        staffId,
        requestedAt: Date.now(),
      });
      setIncomingCall(null);
      addNotification({
        type: 'meeting',
        title: 'Call Accepted',
        message: `Video call with ${incomingCall.clientInfo.name || incomingCall.clientInfo.clientId} connected`,
      });
    }
  };

  const handleDeclineCall = async () => {
    if (!incomingCall || !staffRTC) return;
    await staffRTC.decline(incomingCall.callId, 'Declined by staff');
    try {
      useStaffCallStore.getState().declineCall('Declined by staff');
    } catch (error) {
      console.warn('[Dashboard] Failed to update call store on decline:', error);
    }
    pushCallUpdate({
      id: `${incomingCall.callId}-decline`,
      callId: incomingCall.callId,
      clientName: incomingCall.clientInfo.name || incomingCall.clientInfo.clientId || 'Client',
      timestamp: Date.now(),
      direction: 'incoming',
      status: 'declined',
      purpose: incomingCall.reason,
    });
    setIncomingCall(null);
  };

  return (
    <UserContext.Provider value={{ user }}>
      <div className="flex min-h-screen bg-gradient-to-br from-[#0f172a] to-[#1e1b4b] p-4 lg:p-6 font-sans">
        <Sidebar user={user} activeItem={activeView} setActiveItem={setActiveView} />
        <main className="flex-1 ml-4 lg:ml-[280px] transition-all duration-300">
          <Header activeView={activeView} onLogout={onLogout} user={user} />
          <div className="h-[calc(100vh-120px)] overflow-y-auto pr-2">
              {renderActiveComponent()}
          </div>
        </main>
        {/* Sync notifications from backend */}
        <NotificationSync userId={user.id} isActive={activeView !== 'Team Directory'} />
        {/* Show notifications in all views except Team Directory */}
        {activeView !== 'Team Directory' && <NotificationContainer />}
        <FloatingCallNotification
          visible={!!incomingCall}
          call={incomingCall}
          onAccept={handleAcceptCall}
          onDecline={handleDeclineCall}
          timeoutMs={15000}
        />
        {isCallActive && <CallRoom onEndCall={handleEndActiveCall} />}
      </div>
    </UserContext.Provider>
  );
};

export default Dashboard;