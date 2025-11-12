"""
Test Execution Script
Execute all test files in sequence and collect results
"""
import os
import sys
import subprocess
import json
import time
from datetime import datetime
from pathlib import Path

BASE_DIR = Path(__file__).parent
TEST_DIR = BASE_DIR
RESULTS_DIR = BASE_DIR / "tmp"
RESULTS_DIR.mkdir(exist_ok=True)

# Test files to execute (in order)
TEST_FILES = [
    "TC020_socketio_call_notifications_test.py",
    "TC021_socketio_call_acceptance_test.py",
    "TC022_socketio_call_decline_test.py",
    "TC023_socketio_call_lifecycle_test.py",
    "TC024_socketio_webrtc_sdp_exchange_test.py",
    "TC025_socketio_webrtc_ice_candidates_test.py",
    "TC026_socketio_webrtc_full_signaling_test.py",
    "TC027_timetable_get_test.py",
    "TC028_timetable_update_test.py",
    "TC029_timetable_socketio_update_test.py",
    "TC030_timetable_permissions_test.py",
    "TC031_complete_call_workflow_test.py",
    "TC032_staff_availability_call_routing_test.py",
    "TC033_notification_system_test.py",
    "TC034_call_notification_with_name_test.py",
]

def run_test(test_file: str) -> dict:
    """Run a single test file and return results"""
    test_path = TEST_DIR / test_file
    if not test_path.exists():
        return {
            "test": test_file,
            "status": "skipped",
            "error": "Test file not found",
            "duration": 0
        }
    
    print(f"\n{'='*80}")
    print(f"Running: {test_file}")
    print(f"{'='*80}")
    
    start_time = time.time()
    try:
        result = subprocess.run(
            [sys.executable, str(test_path)],
            cwd=str(TEST_DIR),
            capture_output=True,
            text=True,
            timeout=120  # 2 minute timeout per test
        )
        
        duration = time.time() - start_time
        
        if result.returncode == 0:
            status = "passed"
            error = None
        else:
            status = "failed"
            error = result.stderr or result.stdout
        
        return {
            "test": test_file,
            "status": status,
            "error": error,
            "duration": duration,
            "stdout": result.stdout,
            "stderr": result.stderr
        }
    except subprocess.TimeoutExpired:
        return {
            "test": test_file,
            "status": "timeout",
            "error": "Test exceeded 2 minute timeout",
            "duration": 120
        }
    except Exception as e:
        return {
            "test": test_file,
            "status": "error",
            "error": str(e),
            "duration": time.time() - start_time
        }

def main():
    """Main test execution function"""
    print("="*80)
    print("TestSprite Test Execution")
    print(f"Started at: {datetime.now().isoformat()}")
    print(f"Test directory: {TEST_DIR}")
    print(f"Total tests: {len(TEST_FILES)}")
    print("="*80)
    
    results = []
    start_time = time.time()
    
    for test_file in TEST_FILES:
        result = run_test(test_file)
        results.append(result)
        
        status_icon = "[PASS]" if result["status"] == "passed" else "[FAIL]"
        print(f"{status_icon} {test_file}: {result['status']} ({result['duration']:.2f}s)")
        
        # Add delay between tests to avoid rate limiting
        if result["status"] != "passed":
            time.sleep(2)  # Wait 2 seconds after failed tests
        else:
            time.sleep(1)  # Wait 1 second after passed tests
    
    total_duration = time.time() - start_time
    
    # Generate summary
    passed = sum(1 for r in results if r["status"] == "passed")
    failed = sum(1 for r in results if r["status"] == "failed")
    errors = sum(1 for r in results if r["status"] == "error")
    timeouts = sum(1 for r in results if r["status"] == "timeout")
    skipped = sum(1 for r in results if r["status"] == "skipped")
    
    summary = {
        "timestamp": datetime.now().isoformat(),
        "total_tests": len(TEST_FILES),
        "passed": passed,
        "failed": failed,
        "errors": errors,
        "timeouts": timeouts,
        "skipped": skipped,
        "total_duration": total_duration,
        "results": results
    }
    
    # Save results
    results_file = RESULTS_DIR / "test_results.json"
    with open(results_file, "w") as f:
        json.dump(summary, f, indent=2)
    
    # Print summary
    print("\n" + "="*80)
    print("Test Execution Summary")
    print("="*80)
    print(f"Total tests: {len(TEST_FILES)}")
    print(f"[PASS] Passed: {passed}")
    print(f"[FAIL] Failed: {failed}")
    print(f"[ERROR] Errors: {errors}")
    print(f"[TIMEOUT] Timeouts: {timeouts}")
    print(f"[SKIP] Skipped: {skipped}")
    print(f"Total duration: {total_duration:.2f}s")
    print("="*80)
    
    # Print failed tests
    if failed > 0 or errors > 0 or timeouts > 0:
        print("\nFailed/Error/Timeout Tests:")
        print("-"*80)
        for result in results:
            if result["status"] in ["failed", "error", "timeout"]:
                print(f"\n[FAIL] {result['test']}")
                if result.get("error"):
                    error_msg = result['error'][:200] if result['error'] else "No error message"
                    try:
                        print(f"   Error: {error_msg}...")
                    except UnicodeEncodeError:
                        print(f"   Error: [Encoding error - see stderr]")
    
    print(f"\nResults saved to: {results_file}")
    
    # Return exit code
    return 0 if failed == 0 and errors == 0 and timeouts == 0 else 1

if __name__ == "__main__":
    sys.exit(main())

