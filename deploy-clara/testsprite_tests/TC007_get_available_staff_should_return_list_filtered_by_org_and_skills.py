import requests

BASE_URL = "http://localhost:8080"
TIMEOUT = 30

# Credentials for authentication (should be valid for the test environment)
AUTH_EMAIL = "staff@example.com"
AUTH_PASSWORD = "Password123!"

def authenticate():
    url = f"{BASE_URL}/api/auth/login"
    payload = {"email": AUTH_EMAIL, "password": AUTH_PASSWORD}
    headers = {"Content-Type": "application/json"}
    resp = requests.post(url, json=payload, headers=headers, timeout=TIMEOUT)
    resp.raise_for_status()
    data = resp.json()
    assert "token" in data and isinstance(data["token"], str)
    return data["token"]

def test_get_available_staff_filtered_by_org_and_skills():
    token = authenticate()
    headers = {
        "Authorization": f"Bearer {token}"
    }

    # Example query parameters for filtering
    params = {
        "orgId": "org123",
        "skills": "python,webRTC"
    }

    url = f"{BASE_URL}/api/v1/staff/availability"
    resp = requests.get(url, headers=headers, params=params, timeout=TIMEOUT)
    assert resp.status_code == 200, f"Expected 200 OK, got {resp.status_code}"

    json_data = resp.json()
    assert "staff" in json_data, "Response JSON missing 'staff' key"
    assert isinstance(json_data["staff"], list), "'staff' is not a list"

    # Further validating each staff item contains key info (loosely, since schema is object)
    for staff_member in json_data["staff"]:
        assert isinstance(staff_member, dict)
        # Optionally check for orgId and skills keys in each staff if present
        if "orgId" in staff_member:
            assert staff_member["orgId"] == params["orgId"], "Staff orgId does not match filter"
        if "skills" in staff_member and isinstance(staff_member["skills"], list):
            # Ensure all requested skills are subset of staff skills
            requested_skills = set(s.strip().lower() for s in params["skills"].split(","))
            staff_skills = set(skill.lower() for skill in staff_member["skills"])
            assert requested_skills.issubset(staff_skills), "Staff skills do not match filter"

test_get_available_staff_filtered_by_org_and_skills()