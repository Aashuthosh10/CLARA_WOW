import requests

BASE_URL = "http://localhost:8080"
TIMEOUT = 30

def test_refresh_token_endpoint_should_issue_new_access_token():
    login_url = f"{BASE_URL}/api/auth/login"
    refresh_url = f"{BASE_URL}/api/auth/refresh-token"
    login_payload = {
        "email": "testuser@example.com",
        "password": "TestPassword123!"
    }
    try:
        # Step 1: Authenticate and get refreshToken
        login_resp = requests.post(login_url, json=login_payload, timeout=TIMEOUT)
        assert login_resp.status_code == 200, f"Login failed with status {login_resp.status_code}"
        login_data = login_resp.json()
        refresh_token = login_data.get("refreshToken")
        assert isinstance(refresh_token, str) and refresh_token, "refreshToken missing or invalid in login response"

        # Step 2: Use refreshToken to get new access token
        refresh_payload = {
            "refreshToken": refresh_token
        }
        refresh_resp = requests.post(refresh_url, json=refresh_payload, timeout=TIMEOUT)
        assert refresh_resp.status_code == 200, f"Refresh token request failed with status {refresh_resp.status_code}"

        # Validate response contains a new token (access token)
        refresh_data = refresh_resp.json()
        # We expect a new access token in the response. The PRD description lacks explicit schema
        # for the refresh response body, so we check for presence of a string token.
        access_token = refresh_data.get("token") or refresh_data.get("accessToken")
        assert isinstance(access_token, str) and access_token, "New access token missing or invalid in refresh response"
    except requests.RequestException as e:
        assert False, f"HTTP request failed: {e}"

test_refresh_token_endpoint_should_issue_new_access_token()