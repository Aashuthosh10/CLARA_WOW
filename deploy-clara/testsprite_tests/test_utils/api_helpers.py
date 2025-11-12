"""
API Helper Functions for TestSprite Tests
Provides reusable functions for authentication, staff availability, and call management
"""
import requests
import time
from typing import Optional, Dict, Any, List

BASE_URL = "http://localhost:8080"
TIMEOUT = 30

# Test credentials
STAFF_EMAIL = "nagashreen@gmail.com"
STAFF_PASSWORD = "Password123!"
CLIENT_ID = "test-client-123"
DEFAULT_ORG_ID = "default"


def login_staff(email: str = STAFF_EMAIL, password: str = STAFF_PASSWORD, retry_delay: float = 2.0) -> Dict[str, Any]:
    """
    Login as staff and return token and user info
    
    Args:
        email: Staff email
        password: Staff password
        retry_delay: Delay between retries for rate limiting
        
    Returns:
        Dict with 'token', 'refreshToken', and 'user' keys
        
    Raises:
        AssertionError: If login fails
    """
    import time
    url = f"{BASE_URL}/api/auth/login"
    payload = {
        "email": email,
        "password": password
    }
    
    max_retries = 3
    for attempt in range(max_retries):
        response = requests.post(url, json=payload, timeout=TIMEOUT)
        if response.status_code == 429:
            if attempt < max_retries - 1:
                wait_time = retry_delay * (attempt + 1)
                print(f"[API] Rate limited, waiting {wait_time}s before retry...")
                time.sleep(wait_time)
                continue
            else:
                response.raise_for_status()
        else:
            response.raise_for_status()
            break
    
    data = response.json()
    assert "token" in data and isinstance(data["token"], str)
    assert "refreshToken" in data and isinstance(data["refreshToken"], str)
    assert "user" in data and isinstance(data["user"], dict)
    return data


def login_client(client_id: str = CLIENT_ID, retry_delay: float = 2.0) -> str:
    """
    Login as client using unified format
    
    Args:
        client_id: Client identifier
        retry_delay: Delay between retries for rate limiting
        
    Returns:
        JWT token string
    """
    import time
    url = f"{BASE_URL}/api/auth/login"
    payload = {
        "username": client_id,
        "role": "client"
    }
    
    max_retries = 3
    for attempt in range(max_retries):
        response = requests.post(url, json=payload, timeout=TIMEOUT)
        if response.status_code == 429:
            if attempt < max_retries - 1:
                wait_time = retry_delay * (attempt + 1)
                print(f"[API] Rate limited, waiting {wait_time}s before retry...")
                time.sleep(wait_time)
                continue
            else:
                response.raise_for_status()
        else:
            response.raise_for_status()
            break
    
    data = response.json()
    assert "token" in data
    return data["token"]


def get_token(email: str = STAFF_EMAIL, password: str = STAFF_PASSWORD) -> str:
    """Quick helper to get just the token"""
    data = login_staff(email, password)
    return data["token"]


def set_staff_availability(token: str, status: str = "available", org_id: str = DEFAULT_ORG_ID, skills: Optional[List[str]] = None) -> Dict[str, Any]:
    """
    Set staff availability status
    
    Args:
        token: JWT token
        status: 'available', 'busy', 'away', or 'offline'
        org_id: Organization ID
        skills: Optional list of skills
        
    Returns:
        Response data
    """
    url = f"{BASE_URL}/api/v1/staff/availability"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    payload = {
        "status": status,
        "orgId": org_id
    }
    if skills:
        payload["skills"] = skills
    
    response = requests.put(url, json=payload, headers=headers, timeout=TIMEOUT)
    response.raise_for_status()
    return response.json()


def get_available_staff(token: str, org_id: Optional[str] = None, skills: Optional[List[str]] = None) -> List[Dict[str, Any]]:
    """
    Get list of available staff
    
    Args:
        token: JWT token
        org_id: Optional organization ID filter
        skills: Optional skills filter
        
    Returns:
        List of staff objects
    """
    url = f"{BASE_URL}/api/v1/staff/availability"
    headers = {"Authorization": f"Bearer {token}"}
    params = {}
    if org_id:
        params["orgId"] = org_id
    if skills:
        params["skills"] = ",".join(skills) if isinstance(skills, list) else skills
    
    response = requests.get(url, headers=headers, params=params, timeout=TIMEOUT)
    response.raise_for_status()
    data = response.json()
    assert "staff" in data and isinstance(data["staff"], list)
    return data["staff"]


def initiate_call(token: str, client_id: str = CLIENT_ID, org_id: Optional[str] = None, 
                  target_staff_id: Optional[str] = None, reason: Optional[str] = None,
                  department: Optional[str] = None, client_name: Optional[str] = None) -> requests.Response:
    """
    Initiate a video call
    
    Args:
        token: JWT token (client or staff)
        client_id: Client identifier
        org_id: Optional organization ID
        target_staff_id: Optional specific staff to call
        reason: Optional call reason
        department: Optional department filter
        client_name: Optional client name from prechat form
        
    Returns:
        Response object
    """
    url = f"{BASE_URL}/api/v1/calls"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    payload = {
        "clientId": client_id
    }
    if org_id:
        payload["orgId"] = org_id
    if target_staff_id:
        payload["targetStaffId"] = target_staff_id
    if reason:
        payload["reason"] = reason
    if department:
        payload["department"] = department
    if client_name:
        payload["clientName"] = client_name
    
    return requests.post(url, json=payload, headers=headers, timeout=TIMEOUT)


def accept_call(token: str, call_id: str) -> requests.Response:
    """
    Accept a call (staff only)
    
    Args:
        token: Staff JWT token
        call_id: Call ID to accept
        
    Returns:
        Response object
    """
    url = f"{BASE_URL}/api/v1/calls/{call_id}/accept"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    return requests.post(url, headers=headers, timeout=TIMEOUT)


def decline_call(token: str, call_id: str, reason: Optional[str] = None) -> requests.Response:
    """
    Decline a call (staff only)
    
    Args:
        token: Staff JWT token
        call_id: Call ID to decline
        reason: Optional decline reason
        
    Returns:
        Response object
    """
    url = f"{BASE_URL}/api/v1/calls/{call_id}/decline"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    payload = {}
    if reason:
        payload["reason"] = reason
    
    return requests.post(url, json=payload, headers=headers, timeout=TIMEOUT)


def cancel_call(token: str, call_id: str) -> requests.Response:
    """
    Cancel a call (client only)
    
    Args:
        token: Client JWT token
        call_id: Call ID to cancel
        
    Returns:
        Response object
    """
    url = f"{BASE_URL}/api/v1/calls/{call_id}/cancel"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    return requests.post(url, headers=headers, timeout=TIMEOUT)


def end_call(token: str, call_id: str) -> requests.Response:
    """
    End an ongoing call
    
    Args:
        token: JWT token (client or staff)
        call_id: Call ID to end
        
    Returns:
        Response object
    """
    url = f"{BASE_URL}/api/v1/calls/{call_id}/end"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    return requests.post(url, headers=headers, timeout=TIMEOUT)


def get_call_details(token: str, call_id: str) -> Dict[str, Any]:
    """
    Get call details including participants
    
    Args:
        token: JWT token
        call_id: Call ID
        
    Returns:
        Call details dict
    """
    url = f"{BASE_URL}/api/v1/calls/{call_id}"
    headers = {"Authorization": f"Bearer {token}"}
    response = requests.get(url, headers=headers, timeout=TIMEOUT)
    response.raise_for_status()
    return response.json()


def cleanup_call(token: str, call_id: str):
    """
    Cleanup a call by canceling or ending it
    
    Args:
        token: JWT token
        call_id: Call ID to cleanup
    """
    try:
        cancel_call(token, call_id)
    except:
        try:
            end_call(token, call_id)
        except:
            pass  # Call may already be ended


def get_timetable(token: str, faculty_id: str, semester: str) -> Dict[str, Any]:
    """
    Get timetable for a faculty and semester
    
    Args:
        token: JWT token
        faculty_id: Faculty ID
        semester: Semester name
        
    Returns:
        Timetable data
    """
    url = f"{BASE_URL}/api/timetables/{faculty_id}/{semester}"
    headers = {"Authorization": f"Bearer {token}"}
    response = requests.get(url, headers=headers, timeout=TIMEOUT)
    response.raise_for_status()
    return response.json()


def update_timetable(token: str, faculty_id: str, timetable_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Update timetable for a faculty
    
    Args:
        token: JWT token
        faculty_id: Faculty ID
        timetable_data: Timetable data to update
        
    Returns:
        Updated timetable data
    """
    url = f"{BASE_URL}/api/timetables/{faculty_id}"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    response = requests.patch(url, json=timetable_data, headers=headers, timeout=TIMEOUT)
    response.raise_for_status()
    return response.json()

