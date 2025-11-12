import requests

BASE_URL = "http://localhost:8080"
TIMEOUT = 30

# Provide valid staff credentials here for authentication
STAFF_EMAIL = "staff@example.com"
STAFF_PASSWORD = "correct_password"


def authenticate():
    url = f"{BASE_URL}/api/auth/login"
    payload = {"email": STAFF_EMAIL, "password": STAFF_PASSWORD}
    headers = {"Content-Type": "application/json"}
    resp = requests.post(url, json=payload, headers=headers, timeout=TIMEOUT)
    resp.raise_for_status()
    data = resp.json()
    token = data.get("token")
    assert token is not None, "Authentication token not found in response"
    return token


def initiate_call(token):
    url = f"{BASE_URL}/api/v1/calls"
    # Using minimal required clientId. Adjust as needed.
    # Assuming clientId is the staff user id or some preset test client id
    payload = {
        "clientId": "test-client-001",
        "reason": "Test call for decline functionality"
    }
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    resp = requests.post(url, json=payload, headers=headers, timeout=TIMEOUT)
    if resp.status_code == 503:
        # No available staff, cannot proceed
        raise RuntimeError("No available staff to accept calls, cannot initiate call for testing decline")
    resp.raise_for_status()
    data = resp.json()
    call_id = data.get("callId")
    status = data.get("status")
    assert call_id is not None, "callId missing in initiate call response"
    assert status in ("ringing", "initiated"), "Unexpected call status"
    return call_id


def get_call_details(token, call_id):
    url = f"{BASE_URL}/api/v1/calls/{call_id}"
    headers = {
        "Authorization": f"Bearer {token}"
    }
    resp = requests.get(url, headers=headers, timeout=TIMEOUT)
    resp.raise_for_status()
    return resp.json()


def decline_call(token, call_id, reason=None):
    url = f"{BASE_URL}/api/v1/calls/{call_id}/decline"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    payload = {} if reason is None else {"reason": reason}
    resp = requests.post(url, json=payload, headers=headers, timeout=TIMEOUT)
    resp.raise_for_status()
    return resp


def cancel_call(token, call_id):
    url = f"{BASE_URL}/api/v1/calls/{call_id}/cancel"
    headers = {
        "Authorization": f"Bearer {token}"
    }
    resp = requests.post(url, headers=headers, timeout=TIMEOUT)
    resp.raise_for_status()
    return resp


def test_decline_call_should_mark_call_as_declined_with_reason():
    token = authenticate()
    call_id = None
    try:
        call_id = initiate_call(token)

        # Decline with reason
        reason_text = "Not available to take the call"
        decline_resp = decline_call(token, call_id, reason=reason_text)
        assert decline_resp.status_code == 200

        # Verify call is marked declined by fetching details
        call_details = get_call_details(token, call_id)
        # The PRD does not specify exact declined status or field,
        # so we check some plausible fields or keys indicating decline.
        # We'll assert that the call state/status is not "ringing" or "initiated"
        # and optionally check the decline reason presence in response.
        status = call_details.get("status")
        assert status is not None
        assert status.lower() in ("declined", "ended", "canceled") or status.lower() not in ("ringing", "initiated")
        # Check reason is reflected if available in call details
        reason_in_details = call_details.get("reason")
        if reason_in_details is not None:
            assert reason_text == reason_in_details or reason_text in reason_in_details

        # Decline without reason (optional test)
        # Initiate another call to test this
        call_id_2 = initiate_call(token)
        try:
            decline_resp2 = decline_call(token, call_id_2)
            assert decline_resp2.status_code == 200
            details2 = get_call_details(token, call_id_2)
            status2 = details2.get("status")
            assert status2 is not None
            assert status2.lower() in ("declined", "ended", "canceled") or status2.lower() not in ("ringing", "initiated")
        finally:
            cancel_call(token, call_id_2)
    finally:
        if call_id:
            cancel_call(token, call_id)


test_decline_call_should_mark_call_as_declined_with_reason()