"""
TC029: Timetable Socket.IO Update Test
Test timetable:updated Socket.IO event emission
"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from test_utils.api_helpers import login_staff, update_timetable
from test_utils.socketio_helpers import connect_socketio, wait_for_event, cleanup_socketio
import time
import threading

BASE_URL = "http://localhost:8080"
TIMEOUT = 30
EVENT_TIMEOUT = 10


def extract_staff_id(email: str) -> str:
    """Extract staffId from email"""
    if '@' in email:
        return email.split('@')[0]
    return email


def test_timetable_socketio_update():
    """
    Test timetable:updated Socket.IO event emission
    - Timetable update emits timetable:updated event
    - Event contains correct timetable data
    - Real-time sync via Socket.IO
    """
    staff_token = None
    staff_socket = None
    
    try:
        # Step 1: Login as staff and connect to Socket.IO
        print("[Test] Step 1: Setting up staff and Socket.IO...")
        staff_login_data = login_staff()
        staff_token = staff_login_data["token"]
        staff_user = staff_login_data["user"]
        faculty_id = extract_staff_id(staff_user.get("email", staff_user.get("id", "")))
        
        staff_socket = connect_socketio(staff_token)
        assert staff_socket.connected, "Staff Socket.IO connection failed"
        print(f"[Test] Staff ready, facultyId: {faculty_id}")
        
        # Step 2: Set up listener BEFORE updating (to avoid race condition)
        print("[Test] Step 2: Setting up timetable:updated listener...")
        semester = "5th Semester"
        
        update_event = [None]
        event_received = threading.Event()
        
        def timetable_handler(data):
            if data.get("facultyId") == faculty_id or (data.get("timetable") and data.get("timetable", {}).get("facultyId") == faculty_id):
                update_event[0] = data
                event_received.set()
        
        staff_socket.client.on("timetable:updated", timetable_handler, namespace=staff_socket.namespace)
        time.sleep(0.2)  # Give listener time to register
        
        # Step 3: Update timetable (this should trigger the event)
        print("[Test] Step 3: Updating timetable...")
        timetable_data = {
            "faculty": staff_user.get("name", "Test Faculty"),
            "designation": "Professor",
            "semester": semester,
            "schedule": {
                "Monday": [
                    {
                        "time": "09:00-10:00",
                        "subject": "Updated Subject",
                        "room": "Room 201",
                        "type": "Lecture"
                    }
                ],
                "Tuesday": [],
                "Wednesday": [],
                "Thursday": [],
                "Friday": [],
                "Saturday": [],
                "Sunday": []
            }
        }
        
        updated_timetable = update_timetable(staff_token, faculty_id, timetable_data)
        
        # Step 4: Wait for timetable:updated event
        print("[Test] Step 4: Waiting for timetable:updated event...")
        if not event_received.wait(timeout=EVENT_TIMEOUT):
            update_event[0] = None
        update_event = update_event[0]
        
        assert update_event is not None, "timetable:updated event not received"
        print(f"[Test] [PASS] Received timetable:updated event: {update_event}")
        
        # Step 5: Validate event data structure
        print("[Test] Step 5: Validating event data structure...")
        assert "facultyId" in update_event or "timetable" in update_event, "Event missing facultyId or timetable"
        
        if "timetable" in update_event:
            timetable = update_event["timetable"]
            assert timetable.get("semester") == semester, "Event semester mismatch"
            assert "schedule" in timetable, "Event timetable missing schedule"
        elif "facultyId" in update_event:
            assert update_event.get("semester") == semester or update_event.get("semester") == semester, "Event semester mismatch"
        
        print("[Test] [PASS] Event data structure validated")
        
        print("[Test] [PASS] TC029 PASSED: Timetable Socket.IO update event works correctly")
        
    except AssertionError as e:
        print(f"[Test] [FAIL] TC029 FAILED: {e}")
        raise
    except Exception as e:
        print(f"[Test] [FAIL] TC029 ERROR: {e}")
        raise
    finally:
        if staff_socket:
            cleanup_socketio(staff_socket)


if __name__ == "__main__":
    test_timetable_socketio_update()

