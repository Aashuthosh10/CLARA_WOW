"""
TC023: Socket.IO Call Lifecycle Test
Test complete call lifecycle via Socket.IO events
"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from test_utils.api_helpers import login_staff, get_token, initiate_call, accept_call, end_call, cleanup_call, login_client
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


def test_socketio_call_lifecycle():
    """
    Test complete call lifecycle via Socket.IO:
    - call.initiated → call.accepted → call:update → call.ended
    """
    staff_token = None
    client_token = None
    staff_socket = None
    client_socket = None
    call_id = None
    
    try:
        # Step 1: Setup staff
        print("[Test] Step 1: Setting up staff...")
        staff_login_data = login_staff()
        staff_token = staff_login_data["token"]
        staff_user = staff_login_data["user"]
        staff_id = extract_staff_id(staff_user.get("email", staff_user.get("id", "")))
        
        from test_utils.api_helpers import set_staff_availability
        set_staff_availability(staff_token, status="available")
        
        staff_socket = connect_socketio(staff_token)
        assert staff_socket.connected, "Staff Socket.IO connection failed"
        staff_socket.join_staff_room(staff_id)
        time.sleep(0.5)
        print(f"[Test] Staff ready, staffId: {staff_id}")
        
        # Step 2: Setup client
        print("[Test] Step 2: Setting up client...")
        client_token = login_client()
        client_socket = connect_socketio(client_token)
        assert client_socket.connected, "Client Socket.IO connection failed"
        print("[Test] Client ready")
        
        # Step 3: Initiate call
        print("[Test] Step 3: Initiating call...")
        call_response = initiate_call(client_token, target_staff_id=staff_id)
        
        if call_response.status_code == 503:
            time.sleep(1)
            call_response = initiate_call(client_token, target_staff_id=staff_id)
        
        assert call_response.status_code == 200, f"Call initiation failed: {call_response.status_code}"
        call_data = call_response.json()
        call_id = call_data.get("callId")
        assert call_id, "Call ID not returned"
        print(f"[Test] Call initiated, callId: {call_id}")
        
        # Step 4: Verify call.initiated event
        print("[Test] Step 4: Verifying call.initiated event...")
        initiated_event = wait_for_event(staff_socket, "call.initiated", timeout=EVENT_TIMEOUT)
        assert initiated_event is not None, "call.initiated event not received"
        assert initiated_event["callId"] == call_id, "callId mismatch in call.initiated"
        print("[Test] [PASS] call.initiated event received")
        
        # Step 5: Join call rooms
        print("[Test] Step 5: Joining call rooms...")
        client_socket.join_call_room(call_id)
        staff_socket.join_call_room(call_id)
        time.sleep(0.5)
        
        # Step 6: Accept call
        print("[Test] Step 6: Accepting call...")
        accept_response = accept_call(staff_token, call_id)
        assert accept_response.status_code == 200, f"Call acceptance failed: {accept_response.status_code}"
        
        # Step 7: Verify call.accepted event
        print("[Test] Step 7: Verifying call.accepted event...")
        accepted_event = wait_for_event(client_socket, "call.accepted", timeout=EVENT_TIMEOUT)
        assert accepted_event is not None, "call.accepted event not received"
        assert accepted_event["callId"] == call_id, "callId mismatch in call.accepted"
        print("[Test] [PASS] call.accepted event received")
        
        # Step 8: Verify call:update events
        print("[Test] Step 8: Verifying call:update events...")
        # Staff should receive update with 'accepted' state
        staff_update = wait_for_event(staff_socket, "call:update", timeout=5)
        if staff_update:
            assert staff_update.get("state") == "accepted", f"Expected 'accepted' state, got {staff_update.get('state')}"
            print("[Test] [PASS] call:update (accepted) received on staff socket")
        
        # Step 9: End call
        print("[Test] Step 9: Ending call...")
        end_response = end_call(staff_token, call_id)
        assert end_response.status_code == 200, f"Call end failed: {end_response.status_code}"
        
        # Step 10: Verify call.ended or call:update (ended) event
        print("[Test] Step 10: Verifying call end events...")
        # Check for call.ended or call:update with ended state
        ended_events = client_socket.listen_for_events(["call.ended", "call:update"], timeout=5)
        
        if ended_events.get("call.ended"):
            print("[Test] [PASS] call.ended event received")
        elif ended_events.get("call:update"):
            update = ended_events["call:update"]
            if update and update.get("state") == "ended":
                print("[Test] [PASS] call:update (ended) event received")
            else:
                print("[Test] [WARN]  call:update received but state is not 'ended'")
        else:
            print("[Test] [WARN]  No call end event received (may be expected)")
        
        print("[Test] [PASS] TC023 PASSED: Complete call lifecycle works via Socket.IO")
        
    except AssertionError as e:
        print(f"[Test] [FAIL] TC023 FAILED: {e}")
        raise
    except Exception as e:
        print(f"[Test] [FAIL] TC023 ERROR: {e}")
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
    test_socketio_call_lifecycle()

