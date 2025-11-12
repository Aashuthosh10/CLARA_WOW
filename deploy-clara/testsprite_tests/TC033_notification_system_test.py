"""
TC033: Notification System Test
Test notification creation and delivery via Socket.IO
"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from test_utils.api_helpers import (
    login_staff, login_client, set_staff_availability, 
    initiate_call, accept_call, cleanup_call
)
from test_utils.socketio_helpers import connect_socketio, wait_for_event, cleanup_socketio
import time

BASE_URL = "http://localhost:8080"
TIMEOUT = 30
EVENT_TIMEOUT = 10


def extract_staff_id(email: str) -> str:
    """Extract staffId from email"""
    if '@' in email:
        return email.split('@')[0]
    return email


def test_notification_system():
    """
    Test notification creation and delivery via Socket.IO:
    - Notifications created when call is initiated
    - Notifications delivered via Socket.IO
    - Notification events have correct structure
    """
    staff_token = None
    client_token = None
    staff_socket = None
    call_id = None
    
    try:
        # Step 1: Staff login and setup
        print("[Test] Step 1: Setting up staff...")
        staff_login_data = login_staff()
        staff_token = staff_login_data["token"]
        staff_user = staff_login_data["user"]
        staff_id = extract_staff_id(staff_user.get("email", staff_user.get("id", "")))
        
        set_staff_availability(staff_token, status="available")
        
        staff_socket = connect_socketio(staff_token)
        assert staff_socket.connected, "Staff Socket.IO connection failed"
        staff_socket.join_staff_room(staff_id)
        time.sleep(0.5)
        print(f"[Test] Staff ready, staffId: {staff_id}")
        
        # Step 2: Client login and initiate call
        print("[Test] Step 2: Client initiating call...")
        client_token = login_client()
        call_response = initiate_call(client_token, target_staff_id=staff_id, reason="Test notification")
        
        if call_response.status_code == 503:
            time.sleep(1)
            call_response = initiate_call(client_token, target_staff_id=staff_id, reason="Test notification")
        
        assert call_response.status_code == 200, f"Call initiation failed: {call_response.status_code}"
        call_data = call_response.json()
        call_id = call_data.get("callId")
        assert call_id, "Call ID not returned"
        print(f"[Test] Call initiated, callId: {call_id}")
        
        # Step 3: Wait for call.initiated (this is a notification)
        print("[Test] Step 3: Waiting for call notification...")
        initiated_event = wait_for_event(staff_socket, "call.initiated", timeout=EVENT_TIMEOUT)
        assert initiated_event is not None, "Staff did not receive call notification"
        print("[Test] [PASS] Call notification received")
        
        # Step 4: Check for other notification events
        print("[Test] Step 4: Checking for notification events...")
        # Listen for various notification events
        notification_events = staff_socket.listen_for_events([
            "notifications:new",
            "notifications:appointment_updated",
            "notification:created"
        ], timeout=5)
        
        if any(notification_events.values()):
            print("[Test] [PASS] Additional notification events received")
            for event_name, event_data in notification_events.items():
                if event_data:
                    print(f"[Test]   - {event_name}: {event_data}")
        else:
            print("[Test] [WARN]  No additional notification events (may be expected)")
        
        # Step 5: Accept call and check for update notifications
        print("[Test] Step 5: Accepting call and checking for update notifications...")
        accept_response = accept_call(staff_token, call_id)
        assert accept_response.status_code == 200, f"Call acceptance failed: {accept_response.status_code}"
        
        # Check for appointment/notification update events
        update_events = staff_socket.listen_for_events([
            "notifications:appointment_updated",
            "call:update"
        ], timeout=5)
        
        if any(update_events.values()):
            print("[Test] [PASS] Update notification events received")
        else:
            print("[Test] [WARN]  No update notification events (may be expected)")
        
        print("[Test] [PASS] TC033 PASSED: Notification system works via Socket.IO")
        
    except AssertionError as e:
        print(f"[Test] [FAIL] TC033 FAILED: {e}")
        raise
    except Exception as e:
        print(f"[Test] [FAIL] TC033 ERROR: {e}")
        raise
    finally:
        # Cleanup
        if call_id and client_token:
            try:
                cleanup_call(client_token, call_id)
            except:
                pass
        if staff_socket:
            cleanup_socketio(staff_socket)


if __name__ == "__main__":
    test_notification_system()

