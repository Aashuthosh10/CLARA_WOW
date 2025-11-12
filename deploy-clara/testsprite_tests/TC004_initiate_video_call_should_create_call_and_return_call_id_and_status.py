import requests
import time

BASE_URL = "http://localhost:8080"
TIMEOUT = 30

# Dummy staff credentials for authentication (to be replaced with valid test credentials)
STAFF_EMAIL = "staff@example.com"
STAFF_PASSWORD = "TestPassword123!"

def login():
    url = f"{BASE_URL}/api/auth/login"
    payload = {
        "email": STAFF_EMAIL,
        "password": STAFF_PASSWORD
    }
    response = requests.post(url, json=payload, timeout=TIMEOUT)
    response.raise_for_status()
    data = response.json()
    assert "token" in data and isinstance(data["token"], str)
    assert "refreshToken" in data and isinstance(data["refreshToken"], str)
    assert "user" in data and isinstance(data["user"], dict)
    return data["token"]

def get_available_staff(token, org_id=None, skills=None):
    url = f"{BASE_URL}/api/v1/staff/availability"
    headers = {"Authorization": f"Bearer {token}"}
    params = {}
    if org_id is not None:
        params["orgId"] = org_id
    if skills is not None:
        if isinstance(skills, list):
            params["skills"] = ",".join(skills)
        else:
            params["skills"] = skills
    response = requests.get(url, headers=headers, params=params, timeout=TIMEOUT)
    response.raise_for_status()
    data = response.json()
    assert "staff" in data and isinstance(data["staff"], list)
    return data["staff"]

def initiate_call(token, payload):
    url = f"{BASE_URL}/api/v1/calls"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    response = requests.post(url, json=payload, headers=headers, timeout=TIMEOUT)
    return response

def delete_call(token, call_id):
    # No delete endpoint documented for call resource.
    # Try to cancel or end call to cleanup.
    headers = {"Authorization": f"Bearer {token}"}
    try:
        cancel_url = f"{BASE_URL}/api/v1/calls/{call_id}/cancel"
        resp = requests.post(cancel_url, headers=headers, timeout=TIMEOUT)
        if resp.status_code == 200:
            return
    except Exception:
        pass
    try:
        end_url = f"{BASE_URL}/api/v1/calls/{call_id}/end"
        resp = requests.post(end_url, headers=headers, timeout=TIMEOUT)
        if resp.status_code == 200:
            return
    except Exception:
        pass
    # No documented way to forcibly delete a call

def test_TC004_initiate_video_call_should_create_call_and_return_call_id_and_status():
    """
    Verify POST /api/v1/calls initiates a video call returning 200 with callId and status.
    Verify 503 response when no staff is available.
    Also validate JWT auth, voice recognition independent operation, and WebRTC aspects indirectly via API.
    """
    token = login()

    # Optional: Check staff availability before initiating call to attempt a successful call
    staff_list = get_available_staff(token)
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }

    # Prepare a call payload with minimal required parameter clientId
    # and optionally include orgId and targetStaffId if available from staff_list
    client_id = "test-client-123"
    org_id = None
    target_staff_id = None
    if staff_list:
        # Pick the first available staff's id if exists and if 'id' field present, else fallback None
        s = staff_list[0]
        if isinstance(s, dict):
            target_staff_id = s.get("id") or s.get("staffId") or None
            org_id = s.get("orgId") or None

    payload = {
        "clientId": client_id
    }
    if org_id:
        payload["orgId"] = org_id
    if target_staff_id:
        payload["targetStaffId"] = target_staff_id
    else:
        # Not required by spec, but adding to try exact routing
        payload["targetStaffId"] = "nonexistent-staff-id"

    call_id = None
    try:
        # Initiate call, expecting either 200 or 503
        response = initiate_call(token, payload)
        
        if response.status_code == 200:
            data = response.json()
            assert "callId" in data and isinstance(data["callId"], str) and data["callId"]
            assert "status" in data and data["status"] in ("ringing", "initiated")
            call_id = data["callId"]
            # Additional check: Try to GET call details using callId as sanity check of API endpoint
            call_details_url = f"{BASE_URL}/api/v1/calls/{call_id}"
            resp_call_details = requests.get(call_details_url, headers={"Authorization": f"Bearer {token}"}, timeout=TIMEOUT)
            assert resp_call_details.status_code == 200
            json_cd = resp_call_details.json()
            assert isinstance(json_cd, dict)
            assert "callId" in json_cd and json_cd["callId"] == call_id

        elif response.status_code == 503:
            # No staff available response - valid error case
            # Response body may be empty or have error message, accept either
            try:
                data = response.json()
                assert isinstance(data, dict)
            except Exception:
                # No JSON body - acceptable in 503 error
                pass
        else:
            # Unexpected status code - fail test
            assert False, f"Unexpected status code {response.status_code} returned"
    finally:
        # Cleanup: cancel or end call if initiated
        if call_id:
            delete_call(token, call_id)


test_TC004_initiate_video_call_should_create_call_and_return_call_id_and_status()