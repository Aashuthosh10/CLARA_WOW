import requests

BASE_URL = "http://localhost:8080"
TIMEOUT = 30

def test_health_check_endpoint_returns_status_ok():
    url = f"{BASE_URL}/healthz"
    try:
        response = requests.get(url, timeout=TIMEOUT)
        assert response.status_code == 200, f"Expected status code 200 but got {response.status_code}"
        json_data = response.json()
        assert isinstance(json_data, dict), "Response is not a JSON object"
        assert json_data.get("status") == "ok", f"Expected JSON key 'status' to be 'ok' but got {json_data.get('status')}"
    except requests.RequestException as e:
        assert False, f"Request to {url} failed with exception: {e}"

test_health_check_endpoint_returns_status_ok()