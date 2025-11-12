import requests

BASE_URL = "http://localhost:8080"
TIMEOUT = 30

# Replace these with valid credentials for authentication
TEST_USER_EMAIL = "testuser@example.com"
TEST_USER_PASSWORD = "testpassword"

def authenticate():
    url = f"{BASE_URL}/api/auth/login"
    payload = {
        "email": TEST_USER_EMAIL,
        "password": TEST_USER_PASSWORD
    }
    resp = requests.post(url, json=payload, timeout=TIMEOUT)
    resp.raise_for_status()
    data = resp.json()
    assert "token" in data and data["token"], "No token in login response"
    return data["token"]

def create_notification(headers):
    url = f"{BASE_URL}/api/notifications"
    resp = requests.post(url, headers=headers, timeout=TIMEOUT)
    resp.raise_for_status()
    data = resp.json()
    # Expect at least an id or some identifier
    # Assuming API returns notification object containing id
    # If response is empty or returns just status, fail the test
    if isinstance(data, dict) and "id" in data:
        return data["id"]
    else:
        # Try if data is a list or fallback to get from headers or raise error
        raise AssertionError("Notification creation did not return an id")

def delete_notification(notification_id, headers):
    url = f"{BASE_URL}/api/notifications/{notification_id}"
    resp = requests.delete(url, headers=headers, timeout=TIMEOUT)
    resp.raise_for_status()
    assert resp.status_code == 200, f"Failed to delete notification {notification_id}"

def test_mark_notification_as_read_should_update_notification_status():
    token = authenticate()
    headers = {
        "Authorization": f"Bearer {token}"
    }

    notification_id = None

    # Create a new notification to ensure test isolation
    try:
        notification_id = create_notification(headers)

        assert notification_id, "Created notification id is invalid"

        url = f"{BASE_URL}/api/notifications/{notification_id}/read"
        resp = requests.patch(url, headers=headers, timeout=TIMEOUT)

        assert resp.status_code == 200, f"Expected 200 status, got {resp.status_code}"
        
        # Optionally verify the notification is marked as read by fetching notifications or unread endpoint
        # Let's get unread notifications to check the notification is no longer present
        unread_url = f"{BASE_URL}/api/notifications/unread"
        unread_resp = requests.get(unread_url, headers=headers, timeout=TIMEOUT)
        unread_resp.raise_for_status()
        unread_notifications = unread_resp.json()
        assert isinstance(unread_notifications, list) or isinstance(unread_notifications, dict), "Unread notifications response invalid"
        # The unread notifications may be a list or dict with 'notifications' - check if notification id is absent
        # Try to find notification_id in unread notifications, if found fail
        if isinstance(unread_notifications, list):
            assert notification_id not in [n.get("id") for n in unread_notifications if "id" in n], "Notification still unread after marking as read"
        elif isinstance(unread_notifications, dict):
            # If the structure contains a list under a key (e.g. 'notifications' or 'data'), try known keys
            candidates = []
            for key in ("notifications", "data", "items", "unread"):
                if key in unread_notifications and isinstance(unread_notifications[key], list):
                    candidates = unread_notifications[key]
                    break
            if candidates:
                assert notification_id not in [n.get("id") for n in candidates if "id" in n], "Notification still unread after marking as read"

    finally:
        if notification_id:
            delete_notification(notification_id, headers)

test_mark_notification_as_read_should_update_notification_status()