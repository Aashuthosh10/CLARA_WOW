import requests
from requests.exceptions import RequestException

BASE_URL = "http://localhost:8080"
LOGIN_EMAIL = "staff@example.com"
LOGIN_PASSWORD = "SecurePass123!"

def test_accept_call_should_succeed_only_if_call_is_ringing():
    # Authenticate and get JWT token
    auth_url = f"{BASE_URL}/api/auth/login"
    auth_payload = {"email": LOGIN_EMAIL, "password": LOGIN_PASSWORD}
    try:
        auth_resp = requests.post(auth_url, json=auth_payload, timeout=30)
        auth_resp.raise_for_status()
        auth_data = auth_resp.json()
        token = auth_data.get("token")
        assert token, "Authentication token not received"
    except RequestException as e:
        raise AssertionError(f"Authentication failed: {str(e)}")

    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }

    # Step 1: Initiate a call to get a callId with ringing status
    calls_url = f"{BASE_URL}/api/v1/calls"
    # Using dummy valid clientId, optional fields can be added if needed for test environment
    call_payload = {
        "clientId": "test-client-123"
    }

    call_id = None
    try:
        call_resp = requests.post(calls_url, json=call_payload, headers=headers, timeout=30)
        call_resp.raise_for_status()
        call_data = call_resp.json()
        call_id = call_data.get("callId")
        call_status = call_data.get("status")
        assert call_id is not None, "callId not returned"
    except RequestException as e:
        raise AssertionError(f"Failed to initiate call: {str(e)}")

    try:
        # Verify we have a call in ringing or initiated state
        # Only accept if in "ringing" state per test description
        # If not ringing, try to fetch call details to assert status or fail test accordingly

        # Get call details
        call_details_url = f"{BASE_URL}/api/v1/calls/{call_id}"
        details_resp = requests.get(call_details_url, headers=headers, timeout=30)
        details_resp.raise_for_status()
        details_data = details_resp.json()
        call_current_status = details_data.get("status") or call_status

        # Prepare accept call URL
        accept_url = f"{BASE_URL}/api/v1/calls/{call_id}/accept"

        if call_current_status == "ringing":
            # Accept call - expect 200
            accept_resp = requests.post(accept_url, headers=headers, timeout=30)
            assert accept_resp.status_code == 200, f"Expected 200 for accepting ringing call, got {accept_resp.status_code}"
        else:
            # Accept call when not ringing - expect 409 conflict
            accept_resp = requests.post(accept_url, headers=headers, timeout=30)
            assert accept_resp.status_code == 409, f"Expected 409 for accepting non-ringing call, got {accept_resp.status_code}"

            # Also test accepting again if already accepted (edge case)
            if call_current_status == "accepted" or accept_resp.status_code == 200:
                second_accept_resp = requests.post(accept_url, headers=headers, timeout=30)
                assert second_accept_resp.status_code == 409, f"Expected 409 when accepting a call already accepted, got {second_accept_resp.status_code}"

    finally:
        # Clean up: end the call
        if call_id:
            try:
                end_url = f"{BASE_URL}/api/v1/calls/{call_id}/end"
                end_resp = requests.post(end_url, headers=headers, timeout=30)
                assert end_resp.status_code == 200
            except Exception:
                pass  # Suppress any exception in cleanup

test_accept_call_should_succeed_only_if_call_is_ringing()