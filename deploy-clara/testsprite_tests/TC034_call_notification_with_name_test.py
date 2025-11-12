"""
TC034: Call Notification with Client Name Test
Test that client name from prechat form is sent to server and displayed in staff notification
"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from test_utils.api_helpers import login_staff, get_token, initiate_call, cleanup_call, login_client
from test_utils.socketio_helpers import connect_socketio, wait_for_event, cleanup_socketio
import time

BASE_URL = "http://localhost:8080"
TIMEOUT = 30
EVENT_TIMEOUT = 10


def extract_staff_id(email: str) -> str:
    """Extract staffId from email (e.g., 'nagashreen' from 'nagashreen@gmail.com')"""
    if '@' in email:
        return email.split('@')[0]
    return email


def test_call_notification_with_client_name():
    """
    Test that client name from prechat is sent and displayed correctly:
    - Client sends clientName in call initiation request
    - Server uses clientName in call.initiated event
    - Staff receives call.initiated with correct client name
    - Staff dashboard displays the client name
    """
    staff_token = None
    client_token = None
    staff_socket = None
    call_id = None
    
    try:
        # Step 1: Login as staff
        print("[Test] Step 1: Logging in as staff...")
        staff_login_data = login_staff()
        staff_token = staff_login_data["token"]
        staff_user = staff_login_data["user"]
        staff_id = extract_staff_id(staff_user.get("email", staff_user.get("id", "")))
        print(f"[Test] Staff logged in, staffId: {staff_id}")
        
        # Step 2: Connect staff to Socket.IO and join staff room
        print("[Test] Step 2: Connecting staff to Socket.IO...")
        staff_socket = connect_socketio(staff_token)
        assert staff_socket.connected, "Staff Socket.IO connection failed"
        print("[Test] Staff Socket.IO connected")
        
        # Join staff room
        print(f"[Test] Joining staff room for staffId: {staff_id}")
        assert staff_socket.join_staff_room(staff_id), "Failed to join staff room"
        time.sleep(0.5)  # Give server time to process room join
        print("[Test] Staff joined room")
        
        # Step 3: Login as client
        print("[Test] Step 3: Logging in as client...")
        client_token = login_client()
        print("[Test] Client logged in")
        
        # Step 3.5: Set staff availability first
        print("[Test] Step 3.5: Setting staff availability...")
        from test_utils.api_helpers import set_staff_availability
        try:
            set_staff_availability(staff_token, status="available")
            print("[Test] Staff availability set to available")
        except Exception as e:
            print(f"[Test] [WARN] Failed to set availability: {e}")
            # Continue anyway - might work if staff is already available
        
        # Step 4: Initiate call with client name (simulating prechat form)
        print("[Test] Step 4: Initiating call with client name...")
        test_client_name = "Test User Name"
        
        # Use initiate_call helper but we need to modify it to include clientName
        # For now, we'll make a direct API call
        import requests
        url = f"{BASE_URL}/api/v1/calls"
        headers = {
            "Authorization": f"Bearer {client_token}",
            "Content-Type": "application/json"
        }
        payload = {
            "clientId": "test-client-123",
            "targetStaffId": staff_id,
            "reason": "Test call with name",
            "clientName": test_client_name  # This is the key field we're testing
        }
        
        call_response = requests.post(url, json=payload, headers=headers, timeout=TIMEOUT)
        
        if call_response.status_code == 200:
            call_data = call_response.json()
            call_id = call_data.get("callId")
            assert call_id, "Call ID not returned"
            print(f"[Test] Call initiated with clientName: {test_client_name}, callId: {call_id}")
            
            # Step 5: Wait for call.initiated event on staff socket
            print("[Test] Step 5: Waiting for call.initiated event...")
            event_data = wait_for_event(staff_socket, "call.initiated", timeout=EVENT_TIMEOUT)
            
            assert event_data is not None, "call.initiated event not received by staff"
            print(f"[Test] [PASS] Received call.initiated event: {event_data}")
            
            # Step 6: Validate that client name is present and correct
            print("[Test] Step 6: Validating client name in event...")
            assert "client" in event_data, "Event missing client object"
            client_info = event_data["client"]
            assert "name" in client_info, "Client info missing name field"
            assert client_info["name"] == test_client_name, f"Client name mismatch: expected '{test_client_name}', got '{client_info['name']}'"
            
            print(f"[Test] [PASS] Client name validated: {client_info['name']}")
            
            # Step 7: Validate other required fields
            assert "id" in client_info, "Client info missing id"
            assert event_data["callId"] == call_id, f"Event callId mismatch: expected {call_id}, got {event_data['callId']}"
            
            print("[Test] [PASS] TC034 PASSED: Client name is correctly sent and received in call notification")
            
        elif call_response.status_code == 503:
            print("[Test] [WARN]  No staff available (503) - setting availability and retrying...")
            # Set staff availability and retry
            from test_utils.api_helpers import set_staff_availability
            set_staff_availability(staff_token, status="available")
            time.sleep(0.5)
            
            call_response = requests.post(url, json=payload, headers=headers, timeout=TIMEOUT)
            if call_response.status_code == 200:
                call_data = call_response.json()
                call_id = call_data.get("callId")
                event_data = wait_for_event(staff_socket, "call.initiated", timeout=EVENT_TIMEOUT)
                assert event_data is not None, "call.initiated event not received after setting availability"
                assert "client" in event_data and "name" in event_data["client"], "Event missing client name"
                assert event_data["client"]["name"] == test_client_name, f"Client name mismatch after retry"
                print("[Test] [PASS] Received call.initiated event with correct name after setting availability")
            else:
                assert False, f"Call initiation failed with status {call_response.status_code}"
        else:
            assert False, f"Unexpected status code: {call_response.status_code}"
        
    except AssertionError as e:
        print(f"[Test] [FAIL] TC034 FAILED: {e}")
        raise
    except Exception as e:
        print(f"[Test] [FAIL] TC034 ERROR: {e}")
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
    test_call_notification_with_client_name()

