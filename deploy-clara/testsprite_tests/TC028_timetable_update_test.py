"""
TC028: Timetable Update Test
Test PATCH /api/timetables/:facultyId endpoint
"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from test_utils.api_helpers import login_staff, get_timetable, update_timetable
import time

BASE_URL = "http://localhost:8080"
TIMEOUT = 30


def extract_staff_id(email: str) -> str:
    """Extract staffId from email"""
    if '@' in email:
        return email.split('@')[0]
    return email


def test_timetable_update():
    """
    Test timetable update with validation
    - PATCH /api/timetables/:facultyId updates timetable
    - Validates timetable data structure
    - Returns updated timetable
    """
    staff_token = None
    
    try:
        # Step 1: Login as staff
        print("[Test] Step 1: Logging in as staff...")
        staff_login_data = login_staff()
        staff_token = staff_login_data["token"]
        staff_user = staff_login_data["user"]
        faculty_id = extract_staff_id(staff_user.get("email", staff_user.get("id", "")))
        print(f"[Test] Staff logged in, facultyId: {faculty_id}")
        
        # Step 2: Create/update timetable
        print("[Test] Step 2: Updating timetable...")
        semester = "5th Semester"
        
        timetable_data = {
            "faculty": staff_user.get("name", "Test Faculty"),
            "designation": "Professor",
            "semester": semester,
            "schedule": {
                "Monday": [
                    {
                        "time": "09:00-10:00",
                        "subject": "Test Subject",
                        "room": "Room 101",
                        "type": "Lecture"
                    }
                ],
                "Tuesday": [],
                "Wednesday": [],
                "Thursday": [],
                "Friday": [],
                "Saturday": [],
                "Sunday": []
            }
        }
        
        updated_timetable = update_timetable(staff_token, faculty_id, timetable_data)
        
        # Validate response
        assert isinstance(updated_timetable, dict), "Response should be a dict"
        assert "success" in updated_timetable or "faculty" in updated_timetable, "Response missing expected fields"
        
        if "timetable" in updated_timetable:
            timetable = updated_timetable["timetable"]
        else:
            timetable = updated_timetable
        
        assert timetable.get("semester") == semester, "Semester mismatch"
        assert "schedule" in timetable, "Schedule missing in response"
        
        schedule = timetable["schedule"]
        assert "Monday" in schedule, "Monday missing in schedule"
        assert len(schedule["Monday"]) > 0, "Monday schedule should have classes"
        
        print("[Test] [PASS] Timetable updated successfully")
        
        # Step 3: Verify update by getting timetable
        print("[Test] Step 3: Verifying update by getting timetable...")
        time.sleep(0.5)  # Give server time to process
        retrieved = get_timetable(staff_token, faculty_id, semester)
        
        assert retrieved.get("semester") == semester, "Retrieved semester mismatch"
        assert "schedule" in retrieved, "Retrieved timetable missing schedule"
        assert "Monday" in retrieved["schedule"], "Retrieved timetable missing Monday"
        
        print("[Test] [PASS] Timetable update verified")
        
        print("[Test] [PASS] TC028 PASSED: Timetable update works correctly")
        
    except AssertionError as e:
        print(f"[Test] [FAIL] TC028 FAILED: {e}")
        raise
    except Exception as e:
        print(f"[Test] [FAIL] TC028 ERROR: {e}")
        raise


if __name__ == "__main__":
    test_timetable_update()

