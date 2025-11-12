"""
TC021: Socket.IO Call Acceptance Test
Test that call.accepted event is triggered when staff accepts a call
"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from test_utils.api_helpers import login_staff, get_token, initiate_call, accept_call, cleanup_call, login_client
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


def test_socketio_call_acceptance():
    """
    Test that call.accepted event is triggered when staff accepts a call
    - Client receives call.accepted event
    - Event contains correct staff information
    """
    staff_token = None
    client_token = None
    staff_socket = None
    client_socket = None
    call_id = None
    
    try:
        # Step 1: Login as staff and set availability
        print("[Test] Step 1: Logging in as staff...")
        staff_login_data = login_staff()
        staff_token = staff_login_data["token"]
        staff_user = staff_login_data["user"]
        staff_id = extract_staff_id(staff_user.get("email", staff_user.get("id", "")))
        
        from test_utils.api_helpers import set_staff_availability
        set_staff_availability(staff_token, status="available")
        print(f"[Test] Staff logged in and set to available, staffId: {staff_id}")
        
        # Step 2: Connect staff to Socket.IO
        print("[Test] Step 2: Connecting staff to Socket.IO...")
        staff_socket = connect_socketio(staff_token)
        assert staff_socket.connected, "Staff Socket.IO connection failed"
        staff_socket.join_staff_room(staff_id)
        time.sleep(0.5)
        print("[Test] Staff Socket.IO connected and joined room")
        
        # Step 3: Login as client and connect to Socket.IO
        print("[Test] Step 3: Logging in as client...")
        client_token = login_client()
        client_socket = connect_socketio(client_token)
        assert client_socket.connected, "Client Socket.IO connection failed"
        print("[Test] Client logged in and Socket.IO connected")
        
        # Step 4: Initiate call from client
        print("[Test] Step 4: Initiating call from client...")
        call_response = initiate_call(client_token, target_staff_id=staff_id)
        
        if call_response.status_code == 503:
            print("[Test] [WARN]  No staff available, waiting and retrying...")
            time.sleep(1)
            call_response = initiate_call(client_token, target_staff_id=staff_id)
        
        assert call_response.status_code == 200, f"Call initiation failed: {call_response.status_code}"
        call_data = call_response.json()
        call_id = call_data.get("callId")
        assert call_id, "Call ID not returned"
        print(f"[Test] Call initiated, callId: {call_id}")
        
        # Step 5: Wait for call.initiated event on staff socket
        print("[Test] Step 5: Waiting for call.initiated event on staff...")
        staff_event = wait_for_event(staff_socket, "call.initiated", timeout=EVENT_TIMEOUT)
        assert staff_event is not None, "Staff did not receive call.initiated event"
        print("[Test] Staff received call.initiated event")
        
        # Step 6: Join call room for both client and staff
        print("[Test] Step 6: Joining call rooms...")
        client_socket.join_call_room(call_id)
        staff_socket.join_call_room(call_id)
        time.sleep(0.5)
        
        # Step 7: Accept call from staff
        print("[Test] Step 7: Accepting call from staff...")
        accept_response = accept_call(staff_token, call_id)
        assert accept_response.status_code == 200, f"Call acceptance failed: {accept_response.status_code}"
        print("[Test] Call accepted via API")
        
        # Step 8: Wait for call.accepted event on client socket
        print("[Test] Step 8: Waiting for call.accepted event on client...")
        accepted_event = wait_for_event(client_socket, "call.accepted", timeout=EVENT_TIMEOUT)
        
        assert accepted_event is not None, "Client did not receive call.accepted event"
        print(f"[Test] [PASS] Received call.accepted event: {accepted_event}")
        
        # Step 9: Validate call.accepted event data
        print("[Test] Step 9: Validating call.accepted event data...")
        assert "callId" in accepted_event, "Event missing callId"
        assert accepted_event["callId"] == call_id, "Event callId mismatch"
        
        assert "staff" in accepted_event, "Event missing staff object"
        staff_info = accepted_event["staff"]
        assert "id" in staff_info, "Staff info missing id"
        assert staff_info["id"] == staff_id, f"Staff ID mismatch: expected {staff_id}, got {staff_info['id']}"
        
        print("[Test] [PASS] Event data validated")
        
        # Step 10: Verify call:update event on staff socket
        print("[Test] Step 10: Checking for call:update event...")
        update_event = wait_for_event(staff_socket, "call:update", timeout=5)
        if update_event:
            assert update_event.get("state") == "accepted", f"Expected state 'accepted', got {update_event.get('state')}"
            print("[Test] [PASS] Received call:update event with accepted state")
        
        print("[Test] [PASS] TC021 PASSED: Call acceptance events work correctly")
        
    except AssertionError as e:
        print(f"[Test] [FAIL] TC021 FAILED: {e}")
        raise
    except Exception as e:
        print(f"[Test] [FAIL] TC021 ERROR: {e}")
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
        if client_socket:
            cleanup_socketio(client_socket)


if __name__ == "__main__":
    test_socketio_call_acceptance()

