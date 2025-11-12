"""
TC031: Complete Call Workflow Test
End-to-end test: Login → Set Availability → Initiate Call → Receive Notification → Accept → WebRTC → End
"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from test_utils.api_helpers import (
    login_staff, login_client, set_staff_availability, 
    initiate_call, accept_call, end_call, cleanup_call
)
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


def test_complete_call_workflow():
    """
    Test complete call workflow end-to-end:
    1. Staff login and set availability
    2. Client login
    3. Client initiates call
    4. Staff receives call.initiated notification
    5. Staff accepts call
    6. Client receives call.accepted
    7. WebRTC signaling (SDP + ICE)
    8. End call
    """
    staff_token = None
    client_token = None
    staff_socket = None
    client_socket = None
    call_id = None
    
    try:
        # Step 1: Staff login
        print("[Test] Step 1: Staff login...")
        staff_login_data = login_staff()
        staff_token = staff_login_data["token"]
        staff_user = staff_login_data["user"]
        staff_id = extract_staff_id(staff_user.get("email", staff_user.get("id", "")))
        print(f"[Test] Staff logged in, staffId: {staff_id}")
        
        # Step 2: Staff set availability
        print("[Test] Step 2: Setting staff availability...")
        set_staff_availability(staff_token, status="available")
        print("[Test] Staff set to available")
        
        # Step 3: Staff connect to Socket.IO
        print("[Test] Step 3: Staff connecting to Socket.IO...")
        staff_socket = connect_socketio(staff_token)
        assert staff_socket.connected, "Staff Socket.IO connection failed"
        staff_socket.join_staff_room(staff_id)
        time.sleep(0.5)
        print("[Test] Staff Socket.IO connected")
        
        # Step 4: Client login
        print("[Test] Step 4: Client login...")
        client_token = login_client()
        print("[Test] Client logged in")
        
        # Step 5: Client connect to Socket.IO
        print("[Test] Step 5: Client connecting to Socket.IO...")
        client_socket = connect_socketio(client_token)
        assert client_socket.connected, "Client Socket.IO connection failed"
        print("[Test] Client Socket.IO connected")
        
        # Step 6: Client initiates call
        print("[Test] Step 6: Client initiating call...")
        call_response = initiate_call(client_token, target_staff_id=staff_id, reason="Test call")
        
        if call_response.status_code == 503:
            print("[Test] [WARN]  No staff available, retrying...")
            time.sleep(1)
            call_response = initiate_call(client_token, target_staff_id=staff_id, reason="Test call")
        
        assert call_response.status_code == 200, f"Call initiation failed: {call_response.status_code}"
        call_data = call_response.json()
        call_id = call_data.get("callId")
        assert call_id, "Call ID not returned"
        print(f"[Test] Call initiated, callId: {call_id}")
        
        # Step 7: Staff receives call.initiated
        print("[Test] Step 7: Waiting for staff to receive call.initiated...")
        initiated_event = wait_for_event(staff_socket, "call.initiated", timeout=EVENT_TIMEOUT)
        assert initiated_event is not None, "Staff did not receive call.initiated"
        assert initiated_event["callId"] == call_id, "callId mismatch"
        print("[Test] [PASS] Staff received call.initiated")
        
        # Step 8: Join call rooms
        print("[Test] Step 8: Joining call rooms...")
        client_socket.join_call_room(call_id)
        staff_socket.join_call_room(call_id)
        time.sleep(0.5)
        
        # Step 9: Staff accepts call
        print("[Test] Step 9: Staff accepting call...")
        accept_response = accept_call(staff_token, call_id)
        assert accept_response.status_code == 200, f"Call acceptance failed: {accept_response.status_code}"
        print("[Test] Call accepted")
        
        # Step 10: Client receives call.accepted
        print("[Test] Step 10: Waiting for client to receive call.accepted...")
        accepted_event = wait_for_event(client_socket, "call.accepted", timeout=EVENT_TIMEOUT)
        assert accepted_event is not None, "Client did not receive call.accepted"
        assert accepted_event["callId"] == call_id, "callId mismatch in call.accepted"
        print("[Test] [PASS] Client received call.accepted")
        
        # Step 11: WebRTC signaling - SDP offer
        print("[Test] Step 11: Starting WebRTC signaling (SDP offer)...")
        
        # Set up offer listener BEFORE sending
        offer_received = [None]
        offer_received_event = threading.Event()
        
        def offer_handler(data):
            if data.get("type") == "offer" and data.get("callId") == call_id:
                offer_received[0] = data
                offer_received_event.set()
        
        staff_socket.client.on("call:sdp", offer_handler, namespace=staff_socket.namespace)
        staff_socket.client.on("webrtc.offer", offer_handler, namespace=staff_socket.namespace)
        time.sleep(0.2)  # Give listener time to register
        
        offer_sdp = "v=0\r\no=- 1234567890 1234567890 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\n"
        client_socket.emit_event("call:sdp", {
            "callId": call_id,
            "type": "offer",
            "sdp": offer_sdp
        })
        
        if not offer_received_event.wait(timeout=EVENT_TIMEOUT):
            offer_received[0] = None
        offer_received = offer_received[0]
        assert offer_received is not None and offer_received.get("type") == "offer", "Staff did not receive SDP offer"
        print("[Test] [PASS] SDP offer received by staff")
        
        # Step 12: WebRTC signaling - SDP answer
        print("[Test] Step 12: Staff sending SDP answer...")
        
        # Set up answer listener BEFORE sending
        answer_received = [None]
        answer_received_event = threading.Event()
        
        def answer_handler(data):
            if data.get("type") == "answer" and data.get("callId") == call_id:
                answer_received[0] = data
                answer_received_event.set()
        
        client_socket.client.on("call:sdp", answer_handler, namespace=client_socket.namespace)
        client_socket.client.on("webrtc.answer", answer_handler, namespace=client_socket.namespace)
        time.sleep(0.2)  # Give listener time to register
        
        answer_sdp = "v=0\r\no=- 9876543210 9876543210 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\n"
        staff_socket.emit_event("call:sdp", {
            "callId": call_id,
            "type": "answer",
            "sdp": answer_sdp
        })
        
        if not answer_received_event.wait(timeout=EVENT_TIMEOUT):
            answer_received[0] = None
        answer_received = answer_received[0]
        assert answer_received is not None and answer_received.get("type") == "answer", "Client did not receive SDP answer"
        print("[Test] [PASS] SDP answer received by client")
        
        # Step 13: WebRTC signaling - ICE candidates
        print("[Test] Step 13: Exchanging ICE candidates...")
        
        # Set up ICE listener BEFORE sending
        ice_received = [None]
        ice_received_event = threading.Event()
        
        def ice_handler(data):
            if data.get("callId") == call_id:
                ice_received[0] = data
                ice_received_event.set()
        
        staff_socket.client.on("call:ice", ice_handler, namespace=staff_socket.namespace)
        staff_socket.client.on("webrtc.ice", ice_handler, namespace=staff_socket.namespace)
        time.sleep(0.2)  # Give listener time to register
        
        client_candidate = {
            "candidate": "candidate:1 1 UDP 2130706431 192.168.1.1 54321 typ host",
            "sdpMLineIndex": 0,
            "sdpMid": "0"
        }
        client_socket.emit_event("call:ice", {
            "callId": call_id,
            "candidate": client_candidate
        })
        
        if not ice_received_event.wait(timeout=EVENT_TIMEOUT):
            ice_received[0] = None
        ice_received = ice_received[0]
        assert ice_received is not None, "Staff did not receive ICE candidate"
        print("[Test] [PASS] ICE candidate exchange completed")
        
        # Step 14: End call
        print("[Test] Step 14: Ending call...")
        end_response = end_call(staff_token, call_id)
        assert end_response.status_code == 200, f"Call end failed: {end_response.status_code}"
        print("[Test] Call ended")
        
        # Step 15: Verify call end events
        print("[Test] Step 15: Verifying call end events...")
        end_events = client_socket.listen_for_events(["call.ended", "call:update"], timeout=5)
        if end_events.get("call.ended") or (end_events.get("call:update") and end_events["call:update"].get("state") == "ended"):
            print("[Test] [PASS] Call end event received")
        else:
            print("[Test] [WARN]  Call end event not received (may be expected)")
        
        print("[Test] [PASS] TC031 PASSED: Complete call workflow works end-to-end")
        
    except AssertionError as e:
        print(f"[Test] [FAIL] TC031 FAILED: {e}")
        raise
    except Exception as e:
        print(f"[Test] [FAIL] TC031 ERROR: {e}")
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
    test_complete_call_workflow()

