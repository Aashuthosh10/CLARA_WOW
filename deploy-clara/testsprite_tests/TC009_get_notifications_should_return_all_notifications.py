import requests

BASE_URL = "http://localhost:8080"
LOGIN_URL = f"{BASE_URL}/api/auth/login"
NOTIFICATIONS_URL = f"{BASE_URL}/api/notifications"
TIMEOUT = 30

# Provide valid credentials for authentication
TEST_EMAIL = "testuser@example.com"
TEST_PASSWORD = "testpassword"

def test_get_notifications_should_return_all_notifications():
    try:
        # Authenticate to get JWT token
        login_payload = {
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        }
        login_response = requests.post(LOGIN_URL, json=login_payload, timeout=TIMEOUT)
        assert login_response.status_code == 200, f"Login failed with status {login_response.status_code}"
        login_data = login_response.json()
        token = login_data.get("token")
        assert token, "JWT token not found in login response"

        headers = {
            "Authorization": f"Bearer {token}"
        }

        # Call GET /api/notifications to get all notifications
        notifications_response = requests.get(NOTIFICATIONS_URL, headers=headers, timeout=TIMEOUT)
        assert notifications_response.status_code == 200, f"Expected status 200, got {notifications_response.status_code}"

        # The response should be a JSON containing a list or array of notifications
        notifications_data = notifications_response.json()

        # Assert that the notifications_data is a list or has notifications property as list
        # Since PRD is not explicit on the exact structure, we allow both possibilities:
        if isinstance(notifications_data, dict):
            # Common pattern: the notifications list might be under a key
            notifications_list = None
            for key in ["notifications", "data", "items", "list"]:
                if key in notifications_data and isinstance(notifications_data[key], list):
                    notifications_list = notifications_data[key]
                    break
            if notifications_list is None:
                # fallback to all values collected as list items only if the dict contains only list(s)
                notifications_list = []
                for v in notifications_data.values():
                    if isinstance(v, list):
                        notifications_list = v
                        break
            assert notifications_list is not None, "No list of notifications found in response"
            # Further assert that each notification in the list is a dict (object)
            for notif in notifications_list:
                assert isinstance(notif, dict), "Notification item is not an object"
        else:
            # If the response is directly a list
            assert isinstance(notifications_data, list), "Response is not a list or object containing a list"
            for notif in notifications_data:
                assert isinstance(notif, dict), "Notification item is not an object"

    except requests.RequestException as e:
        assert False, f"Request failed: {e}"

test_get_notifications_should_return_all_notifications()