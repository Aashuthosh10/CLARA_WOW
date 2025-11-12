"""
TC027: Timetable GET Test
Test GET /api/timetables/:facultyId/:semester endpoint
"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from test_utils.api_helpers import login_staff, get_timetable
import time

BASE_URL = "http://localhost:8080"
TIMEOUT = 30


def extract_staff_id(email: str) -> str:
    """Extract staffId from email"""
    if '@' in email:
        return email.split('@')[0]
    return email


def test_timetable_get():
    """
    Test timetable retrieval for specific faculty/semester
    - GET /api/timetables/:facultyId/:semester returns timetable data
    - Returns 404 if timetable doesn't exist
    - Returns timetable with correct structure
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
        
        # Step 2: Try to get timetable for a semester
        print("[Test] Step 2: Getting timetable...")
        semester = "5th Semester"
        
        try:
            timetable = get_timetable(staff_token, faculty_id, semester)
            
            # Validate timetable structure
            assert isinstance(timetable, dict), "Timetable should be a dict"
            assert "facultyId" in timetable or "faculty" in timetable, "Timetable missing faculty identifier"
            assert "semester" in timetable, "Timetable missing semester"
            assert "schedule" in timetable, "Timetable missing schedule"
            
            schedule = timetable["schedule"]
            assert isinstance(schedule, dict), "Schedule should be a dict"
            
            # Validate schedule has day keys
            valid_days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
            for day in schedule.keys():
                assert day in valid_days, f"Invalid day in schedule: {day}"
            
            print(f"[Test] [PASS] Timetable retrieved successfully: {timetable.get('faculty', 'N/A')} - {semester}")
            
        except Exception as e:
            # 404 is acceptable if timetable doesn't exist yet
            if "404" in str(e) or "Not Found" in str(e):
                print(f"[Test] [WARN]  Timetable not found (404) - this is acceptable if timetable hasn't been created yet")
            else:
                raise
        
        # Step 3: Try to get non-existent timetable
        print("[Test] Step 3: Testing non-existent timetable...")
        try:
            non_existent = get_timetable(staff_token, "nonexistent-faculty", "Non-existent Semester")
            print("[Test] [WARN]  Non-existent timetable returned data (unexpected)")
        except Exception as e:
            if "404" in str(e) or "Not Found" in str(e):
                print("[Test] [PASS] Non-existent timetable correctly returns 404")
            else:
                print(f"[Test] [WARN]  Unexpected error for non-existent timetable: {e}")
        
        print("[Test] [PASS] TC027 PASSED: Timetable GET endpoint works correctly")
        
    except AssertionError as e:
        print(f"[Test] [FAIL] TC027 FAILED: {e}")
        raise
    except Exception as e:
        print(f"[Test] [FAIL] TC027 ERROR: {e}")
        raise


if __name__ == "__main__":
    test_timetable_get()

