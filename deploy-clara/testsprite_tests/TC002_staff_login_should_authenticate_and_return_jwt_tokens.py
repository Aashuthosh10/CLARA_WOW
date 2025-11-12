import requests

BASE_URL = "http://localhost:8080"
LOGIN_ENDPOINT = "/api/auth/login"
TIMEOUT = 30

def test_staff_login_should_authenticate_and_return_jwt_tokens():
    url = BASE_URL + LOGIN_ENDPOINT
    # Use valid test credentials for login
    payload = {
        "email": "valid.staff@example.com",
        "password": "ValidPassword123!"
    }
    headers = {
        "Content-Type": "application/json"
    }
    try:
        response = requests.post(url, json=payload, headers=headers, timeout=TIMEOUT)
    except requests.RequestException as e:
        assert False, f"HTTP request failed: {e}"

    assert response.status_code == 200, f"Expected status 200, got {response.status_code}"

    try:
        data = response.json()
    except ValueError:
        assert False, "Response is not in JSON format"

    assert "token" in data, "Response JSON missing 'token'"
    assert isinstance(data["token"], str) and len(data["token"]) > 0, "'token' should be a non-empty string"

    assert "refreshToken" in data, "Response JSON missing 'refreshToken'"
    assert isinstance(data["refreshToken"], str) and len(data["refreshToken"]) > 0, "'refreshToken' should be a non-empty string"

    assert "user" in data, "Response JSON missing 'user'"
    assert isinstance(data["user"], dict) and len(data["user"]) > 0, "'user' should be a non-empty object"

test_staff_login_should_authenticate_and_return_jwt_tokens()