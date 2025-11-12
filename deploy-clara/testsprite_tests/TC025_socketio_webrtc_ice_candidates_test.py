"""
TC025: Socket.IO WebRTC ICE Candidates Test
Test ICE candidate exchange via Socket.IO call:ice events
"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from test_utils.api_helpers import login_staff, get_token, initiate_call, accept_call, cleanup_call, login_client
from test_utils.socketio_helpers import connect_socketio, wait_for_event, cleanup_socketio
import time
import threading

BASE_URL = "http://localhost:8080"
TIMEOUT = 30
EVENT_TIMEOUT = 15


def extract_staff_id(email: str) -> str:
    """Extract staffId from email"""
    if '@' in email:
        return email.split('@')[0]
    return email


def test_socketio_webrtc_ice_candidates():
    """
    Test ICE candidate exchange via Socket.IO:
    - Client sends ICE candidates via call:ice event
    - Staff receives ICE candidates
    - Staff sends ICE candidates
    - Client receives ICE candidates
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
        
        # Step 3: Initiate and accept call
        print("[Test] Step 3: Initiating and accepting call...")
        call_response = initiate_call(client_token, target_staff_id=staff_id)
        
        if call_response.status_code == 503:
            time.sleep(1)
            call_response = initiate_call(client_token, target_staff_id=staff_id)
        
        assert call_response.status_code == 200, f"Call initiation failed: {call_response.status_code}"
        call_data = call_response.json()
        call_id = call_data.get("callId")
        assert call_id, "Call ID not returned"
        
        # Wait for call.initiated
        wait_for_event(staff_socket, "call.initiated", timeout=EVENT_TIMEOUT)
        
        # Join call rooms
        client_socket.join_call_room(call_id)
        staff_socket.join_call_room(call_id)
        time.sleep(0.5)
        
        # Accept call
        accept_response = accept_call(staff_token, call_id)
        assert accept_response.status_code == 200, f"Call acceptance failed: {accept_response.status_code}"
        time.sleep(0.5)
        print(f"[Test] Call accepted, callId: {call_id}")
        
        # Step 4: Set up ICE listener BEFORE sending (to avoid race condition)
        print("[Test] Step 4: Setting up ICE candidate listener on staff socket...")
        ice_event = [None]
        ice_received = threading.Event()
        
        def ice_handler(data):
            if data.get("callId") == call_id:
                ice_event[0] = data
                ice_received.set()
        
        staff_socket.client.on("call:ice", ice_handler, namespace=staff_socket.namespace)
        staff_socket.client.on("webrtc.ice", ice_handler, namespace=staff_socket.namespace)
        time.sleep(0.2)  # Give listener time to register
        
        # Step 5: Client sends ICE candidate
        print("[Test] Step 5: Client sending ICE candidate...")
        test_candidate = {
            "candidate": "candidate:1 1 UDP 2130706431 192.168.1.1 54321 typ host",
            "sdpMLineIndex": 0,
            "sdpMid": "0"
        }
        client_socket.emit_event("call:ice", {
            "callId": call_id,
            "candidate": test_candidate
        })
        print("[Test] ICE candidate sent from client")
        
        # Step 6: Staff receives ICE candidate
        print("[Test] Step 6: Waiting for staff to receive ICE candidate...")
        if not ice_received.wait(timeout=EVENT_TIMEOUT):
            ice_event[0] = None
        ice_event = ice_event[0]
        
        assert ice_event is not None, "Staff did not receive ICE candidate"
        assert ice_event.get("callId") == call_id, "callId mismatch in ICE event"
        assert "candidate" in ice_event, "ICE event missing candidate field"
        
        candidate = ice_event["candidate"]
        assert candidate.get("candidate") == test_candidate["candidate"], "ICE candidate content mismatch"
        print("[Test] [PASS] Staff received ICE candidate correctly")
        
        # Step 7: Set up second ICE listener BEFORE sending
        print("[Test] Step 7: Setting up ICE candidate listener on client socket...")
        ice_event2 = [None]
        ice_received2 = threading.Event()
        received_candidates = []
        
        def ice_handler2(data):
            if data.get("callId") == call_id:
                received_candidates.append(data)
                # Only accept the second candidate (from staff)
                candidate_data = data.get("candidate", {})
                if isinstance(candidate_data, dict):
                    candidate_str = candidate_data.get("candidate", "")
                else:
                    candidate_str = candidate_data
                # Check if this is the second candidate (from staff, not the first one from client)
                if "192.168.1.2" in candidate_str or len(received_candidates) > 1:
                    ice_event2[0] = data
                    ice_received2.set()
        
        # Remove any existing handlers first
        try:
            client_socket.client.off("call:ice", namespace=client_socket.namespace)
            client_socket.client.off("webrtc.ice", namespace=client_socket.namespace)
        except:
            pass
        
        client_socket.client.on("call:ice", ice_handler2, namespace=client_socket.namespace)
        client_socket.client.on("webrtc.ice", ice_handler2, namespace=client_socket.namespace)
        time.sleep(0.2)  # Give listener time to register
        
        # Step 8: Staff sends ICE candidate
        print("[Test] Step 8: Staff sending ICE candidate...")
        test_candidate2 = {
            "candidate": "candidate:2 1 UDP 2130706431 192.168.1.2 54322 typ host",
            "sdpMLineIndex": 0,
            "sdpMid": "0"
        }
        staff_socket.emit_event("call:ice", {
            "callId": call_id,
            "candidate": test_candidate2
        })
        print("[Test] ICE candidate sent from staff")
        
        # Step 9: Client receives ICE candidate
        print("[Test] Step 9: Waiting for client to receive ICE candidate...")
        if not ice_received2.wait(timeout=EVENT_TIMEOUT):
            ice_event2[0] = None
        ice_event2 = ice_event2[0]
        
        assert ice_event2 is not None, "Client did not receive ICE candidate"
        assert ice_event2.get("callId") == call_id, "callId mismatch in ICE event"
        assert "candidate" in ice_event2, f"ICE event missing candidate field. Event: {ice_event2}"
        
        candidate2 = ice_event2["candidate"]
        print(f"[Test] Received candidate2: {candidate2}, Expected: {test_candidate2}")
        # Handle both object and direct string formats
        if isinstance(candidate2, dict):
            received_candidate_str = candidate2.get("candidate")
        else:
            received_candidate_str = candidate2
        expected_candidate_str = test_candidate2.get("candidate") if isinstance(test_candidate2, dict) else test_candidate2
        assert received_candidate_str == expected_candidate_str, f"ICE candidate content mismatch. Received: {received_candidate_str}, Expected: {expected_candidate_str}"
        print("[Test] [PASS] Client received ICE candidate correctly")
        
        print("[Test] [PASS] TC025 PASSED: ICE candidate exchange works via Socket.IO")
        
    except AssertionError as e:
        print(f"[Test] [FAIL] TC025 FAILED: {e}")
        raise
    except Exception as e:
        print(f"[Test] [FAIL] TC025 ERROR: {e}")
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
    test_socketio_webrtc_ice_candidates()

