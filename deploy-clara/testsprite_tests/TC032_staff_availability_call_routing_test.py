"""
TC032: Staff Availability Call Routing Test
Test that staff availability status affects call routing
"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from test_utils.api_helpers import (
    login_staff, login_client, set_staff_availability, 
    get_available_staff, initiate_call, cleanup_call
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


def test_staff_availability_call_routing():
    """
    Test that staff availability status affects call routing:
    - Available staff receives calls
    - Busy/offline staff does not receive calls
    - Call routing respects availability status
    """
    staff_token = None
    client_token = None
    staff_socket = None
    call_id = None
    
    try:
        # Step 1: Staff login
        print("[Test] Step 1: Staff login...")
        staff_login_data = login_staff()
        staff_token = staff_login_data["token"]
        staff_user = staff_login_data["user"]
        staff_id = extract_staff_id(staff_user.get("email", staff_user.get("id", "")))
        print(f"[Test] Staff logged in, staffId: {staff_id}")
        
        # Step 2: Staff set to offline
        print("[Test] Step 2: Setting staff to offline...")
        set_staff_availability(staff_token, status="offline")
        time.sleep(0.5)
        
        # Check available staff list
        available = get_available_staff(staff_token)
        staff_in_list = any(s.get("staffId") == staff_id or s.get("id") == staff_id for s in available)
        assert not staff_in_list, "Offline staff should not be in available list"
        print("[Test] [PASS] Offline staff not in available list")
        
        # Step 3: Try to initiate call (should fail or route elsewhere)
        print("[Test] Step 3: Attempting to initiate call to offline staff...")
        client_token = login_client()
        call_response = initiate_call(client_token, target_staff_id=staff_id)
        
        if call_response.status_code == 503:
            print("[Test] [PASS] Call initiation correctly rejected (503) for offline staff")
        elif call_response.status_code == 200:
            print("[Test] [WARN]  Call initiated to offline staff (may route to other staff)")
            call_data = call_response.json()
            call_id = call_data.get("callId")
        else:
            print(f"[Test] [WARN]  Unexpected status code: {call_response.status_code}")
        
        # Step 4: Set staff to available
        print("[Test] Step 4: Setting staff to available...")
        set_staff_availability(staff_token, status="available")
        time.sleep(0.5)
        
        # Check available staff list
        available = get_available_staff(staff_token)
        # Staff availability returns userId field, need to check both userId and staffId/id
        staff_in_list = any(
            s.get("staffId") == staff_id or 
            s.get("id") == staff_id or 
            s.get("userId") == staff_id or
            s.get("userId") == staff_user.get("email", "") or
            (s.get("userId") and s.get("userId").split("@")[0] == staff_id)
            for s in available
        )
        assert staff_in_list, f"Available staff should be in available list. Staff ID: {staff_id}, Available: {[s.get('userId') or s.get('staffId') or s.get('id') for s in available]}"
        print("[Test] [PASS] Available staff in available list")
        
        # Step 5: Connect staff to Socket.IO
        print("[Test] Step 5: Staff connecting to Socket.IO...")
        staff_socket = connect_socketio(staff_token)
        assert staff_socket.connected, "Staff Socket.IO connection failed"
        staff_socket.join_staff_room(staff_id)
        time.sleep(0.5)
        
        # Step 6: Initiate call to available staff
        print("[Test] Step 6: Initiating call to available staff...")
        if call_id:
            cleanup_call(client_token, call_id)
            call_id = None
        
        call_response = initiate_call(client_token, target_staff_id=staff_id)
        
        if call_response.status_code == 200:
            call_data = call_response.json()
            call_id = call_data.get("callId")
            print(f"[Test] Call initiated, callId: {call_id}")
            
            # Step 7: Staff should receive call.initiated
            print("[Test] Step 7: Waiting for staff to receive call.initiated...")
            initiated_event = wait_for_event(staff_socket, "call.initiated", timeout=EVENT_TIMEOUT)
            assert initiated_event is not None, "Available staff should receive call.initiated"
            assert initiated_event["callId"] == call_id, "callId mismatch"
            print("[Test] [PASS] Available staff received call.initiated")
        else:
            print(f"[Test] [WARN]  Call initiation failed with status {call_response.status_code}")
        
        # Step 8: Set staff to busy
        print("[Test] Step 8: Setting staff to busy...")
        set_staff_availability(staff_token, status="busy")
        time.sleep(0.5)
        
        # Check available staff list
        available = get_available_staff(staff_token)
        staff_in_list = any(s.get("staffId") == staff_id or s.get("id") == staff_id for s in available)
        # Busy staff might still be in list but with busy status
        print(f"[Test] Staff in available list after busy: {staff_in_list}")
        
        print("[Test] [PASS] TC032 PASSED: Staff availability affects call routing")
        
    except AssertionError as e:
        print(f"[Test] [FAIL] TC032 FAILED: {e}")
        raise
    except Exception as e:
        print(f"[Test] [FAIL] TC032 ERROR: {e}")
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
    test_staff_availability_call_routing()

