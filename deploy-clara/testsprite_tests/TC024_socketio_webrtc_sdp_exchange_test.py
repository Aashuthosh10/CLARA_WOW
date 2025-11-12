"""
TC024: Socket.IO WebRTC SDP Exchange Test
Test SDP offer/answer exchange via Socket.IO call:sdp events
"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from test_utils.api_helpers import login_staff, get_token, initiate_call, accept_call, cleanup_call, login_client
from test_utils.socketio_helpers import connect_socketio, wait_for_event, cleanup_socketio
import time
import json
import threading

BASE_URL = "http://localhost:8080"
TIMEOUT = 30
EVENT_TIMEOUT = 15


def extract_staff_id(email: str) -> str:
    """Extract staffId from email"""
    if '@' in email:
        return email.split('@')[0]
    return email


def test_socketio_webrtc_sdp_exchange():
    """
    Test SDP offer/answer exchange via Socket.IO:
    - Client sends SDP offer via call:sdp event
    - Staff receives offer and sends answer via call:sdp event
    - Both parties receive correct SDP data
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
        
        # Step 4: Wait for call.initiated and join call rooms
        print("[Test] Step 4: Waiting for call.initiated and joining call rooms...")
        initiated_event = wait_for_event(staff_socket, "call.initiated", timeout=EVENT_TIMEOUT)
        assert initiated_event is not None, "call.initiated event not received"
        
        client_socket.join_call_room(call_id)
        staff_socket.join_call_room(call_id)
        time.sleep(0.5)
        print("[Test] Both parties joined call room")
        
        # Step 5: Accept call
        print("[Test] Step 5: Accepting call...")
        accept_response = accept_call(staff_token, call_id)
        assert accept_response.status_code == 200, f"Call acceptance failed: {accept_response.status_code}"
        time.sleep(0.5)  # Give time for WebRTC setup
        
        # Step 6: Set up listener BEFORE sending SDP (to avoid race condition)
        print("[Test] Step 6: Setting up SDP offer listener on staff socket...")
        offer_event = [None]
        event_received = threading.Event()
        
        def sdp_handler(data):
            if data.get("type") == "offer" and data.get("callId") == call_id:
                offer_event[0] = data
                event_received.set()
        
        staff_socket.client.on("call:sdp", sdp_handler, namespace=staff_socket.namespace)
        staff_socket.client.on("webrtc.offer", sdp_handler, namespace=staff_socket.namespace)
        time.sleep(0.2)  # Give listener time to register
        
        # Step 7: Client sends SDP offer
        print("[Test] Step 7: Client sending SDP offer...")
        test_offer_sdp = "v=0\r\no=- 1234567890 1234567890 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\n"
        client_socket.emit_event("call:sdp", {
            "callId": call_id,
            "type": "offer",
            "sdp": test_offer_sdp
        })
        print("[Test] SDP offer sent from client")
        
        # Step 8: Staff receives SDP offer
        print("[Test] Step 8: Waiting for staff to receive SDP offer...")
        if not event_received.wait(timeout=EVENT_TIMEOUT):
            offer_event[0] = None
        offer_event = offer_event[0]
        
        assert offer_event is not None, "Staff did not receive SDP offer"
        assert offer_event.get("callId") == call_id, "callId mismatch in SDP offer"
        assert offer_event.get("type") == "offer", f"Expected type 'offer', got {offer_event.get('type')}"
        assert "sdp" in offer_event, "SDP offer missing sdp field"
        assert offer_event["sdp"] == test_offer_sdp, "SDP offer content mismatch"
        print("[Test] [PASS] Staff received SDP offer correctly")
        
        # Step 9: Set up answer listener BEFORE sending answer
        print("[Test] Step 9: Setting up SDP answer listener on client socket...")
        answer_event = [None]
        answer_received = threading.Event()
        
        def answer_handler(data):
            if data.get("type") == "answer" and data.get("callId") == call_id:
                answer_event[0] = data
                answer_received.set()
        
        client_socket.client.on("call:sdp", answer_handler, namespace=client_socket.namespace)
        client_socket.client.on("webrtc.answer", answer_handler, namespace=client_socket.namespace)
        time.sleep(0.2)  # Give listener time to register
        
        # Step 10: Staff sends SDP answer
        print("[Test] Step 10: Staff sending SDP answer...")
        test_answer_sdp = "v=0\r\no=- 9876543210 9876543210 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\n"
        staff_socket.emit_event("call:sdp", {
            "callId": call_id,
            "type": "answer",
            "sdp": test_answer_sdp
        })
        print("[Test] SDP answer sent from staff")
        
        # Step 11: Client receives SDP answer
        print("[Test] Step 11: Waiting for client to receive SDP answer...")
        if not answer_received.wait(timeout=EVENT_TIMEOUT):
            answer_event[0] = None
        answer_event = answer_event[0]
        
        assert answer_event is not None, "Client did not receive SDP answer"
        assert answer_event.get("callId") == call_id, "callId mismatch in SDP answer"
        assert answer_event.get("type") == "answer", f"Expected type 'answer', got {answer_event.get('type')}"
        assert "sdp" in answer_event, "SDP answer missing sdp field"
        assert answer_event["sdp"] == test_answer_sdp, "SDP answer content mismatch"
        print("[Test] [PASS] Client received SDP answer correctly")
        
        print("[Test] [PASS] TC024 PASSED: SDP offer/answer exchange works via Socket.IO")
        
    except AssertionError as e:
        print(f"[Test] [FAIL] TC024 FAILED: {e}")
        raise
    except Exception as e:
        print(f"[Test] [FAIL] TC024 ERROR: {e}")
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
    test_socketio_webrtc_sdp_exchange()

