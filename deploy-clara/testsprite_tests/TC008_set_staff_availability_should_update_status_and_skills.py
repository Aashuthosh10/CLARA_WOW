import requests

BASE_URL = "http://localhost:8080"
LOGIN_URL = f"{BASE_URL}/api/auth/login"
STAFF_AVAILABILITY_URL = f"{BASE_URL}/api/v1/staff/availability"

EMAIL = "staff@example.com"
PASSWORD = "StrongPassword123!"

def test_set_staff_availability_updates_status_and_skills():
    session = requests.Session()
    try:
        # Authenticate to obtain JWT token
        login_payload = {
            "email": EMAIL,
            "password": PASSWORD
        }
        login_resp = session.post(LOGIN_URL, json=login_payload, timeout=30)
        assert login_resp.status_code == 200, f"Login failed: {login_resp.text}"
        login_data = login_resp.json()
        token = login_data.get("token")
        assert token, "JWT token missing in login response"
        headers = {"Authorization": f"Bearer {token}"}

        # Prepare payload for availability update
        availability_payload = {
            "status": "available",
            "skills": ["voice recognition", "call management", "webrtc"]
        }

        # Post staff availability update
        update_resp = session.post(
            STAFF_AVAILABILITY_URL,
            json=availability_payload,
            headers=headers,
            timeout=30
        )
        assert update_resp.status_code == 200, f"Failed to update availability: {update_resp.text}"

        # Optionally, confirm update via get available staff filtered by these skills
        params = {
            "skills": ",".join(availability_payload["skills"])
        }
        get_resp = session.get(STAFF_AVAILABILITY_URL, headers=headers, params=params, timeout=30)
        assert get_resp.status_code == 200, f"Failed to get available staff: {get_resp.text}"
        staff_data = get_resp.json()
        assert "staff" in staff_data and isinstance(staff_data["staff"], list), "Invalid staff data response"

        # Verify that this staff member appears in the filtered list by checking skills and status
        # Since no staff ID or user details are exposed in PRD, verify presence of at least one staff member with matching skills
        found = False
        for staff_member in staff_data["staff"]:
            member_skills = staff_member.get("skills") or staff_member.get("skill") or []
            member_status = staff_member.get("status")
            # Match if any skill matches and status equals updated status
            if (isinstance(member_skills, list) and
                any(skill in member_skills for skill in availability_payload["skills"]) and
                member_status == availability_payload["status"]):
                found = True
                break
        assert found, "Updated staff availability not reflected in available staff list"

    finally:
        # Cleanup: reset staff availability to offline and clear skills if possible
        if 'headers' in locals():
            cleanup_payload = {
                "status": "offline",
                "skills": []
            }
            try:
                session.post(STAFF_AVAILABILITY_URL, json=cleanup_payload, headers=headers, timeout=30)
            except Exception:
                pass

test_set_staff_availability_updates_status_and_skills()