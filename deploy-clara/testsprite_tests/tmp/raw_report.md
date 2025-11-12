
# TestSprite AI Testing Report(MCP)

---

## 1️⃣ Document Metadata
- **Project Name:** AI-STUDIO
- **Date:** 2025-11-07
- **Prepared by:** TestSprite AI Team

---

## 2️⃣ Requirement Validation Summary

#### Test TC001
- **Test Name:** health check endpoint should return server status ok
- **Test Code:** [TC001_health_check_endpoint_should_return_server_status_ok.py](./TC001_health_check_endpoint_should_return_server_status_ok.py)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/05a42007-6d48-4823-818d-129bb803bd7e/191ca279-f45a-4142-90cd-465fbd5396f8
- **Status:** ✅ Passed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC002
- **Test Name:** staff login should authenticate and return jwt tokens
- **Test Code:** [TC002_staff_login_should_authenticate_and_return_jwt_tokens.py](./TC002_staff_login_should_authenticate_and_return_jwt_tokens.py)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/05a42007-6d48-4823-818d-129bb803bd7e/6f5f00c0-261f-487a-80f8-6fd3e751ac80
- **Status:** ✅ Passed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC003
- **Test Name:** refresh token endpoint should issue new access token
- **Test Code:** [TC003_refresh_token_endpoint_should_issue_new_access_token.py](./TC003_refresh_token_endpoint_should_issue_new_access_token.py)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/05a42007-6d48-4823-818d-129bb803bd7e/0fada881-f3ff-49d1-a0bc-ff679e9cede3
- **Status:** ✅ Passed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC004
- **Test Name:** initiate video call should create call and return call id and status
- **Test Code:** [TC004_initiate_video_call_should_create_call_and_return_call_id_and_status.py](./TC004_initiate_video_call_should_create_call_and_return_call_id_and_status.py)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/05a42007-6d48-4823-818d-129bb803bd7e/5baaccac-f033-48d8-867b-5b13f691516e
- **Status:** ✅ Passed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC005
- **Test Name:** accept call should succeed only if call is ringing
- **Test Code:** [TC005_accept_call_should_succeed_only_if_call_is_ringing.py](./TC005_accept_call_should_succeed_only_if_call_is_ringing.py)
- **Test Error:** Traceback (most recent call last):
  File "<string>", line 36, in test_accept_call_should_succeed_only_if_call_is_ringing
  File "/var/task/requests/models.py", line 1024, in raise_for_status
    raise HTTPError(http_error_msg, response=self)
requests.exceptions.HTTPError: 503 Server Error: Service Unavailable for url: http://localhost:8080/api/v1/calls

During handling of the above exception, another exception occurred:

Traceback (most recent call last):
  File "/var/task/handler.py", line 258, in run_with_retry
    exec(code, exec_env)
  File "<string>", line 83, in <module>
  File "<string>", line 42, in test_accept_call_should_succeed_only_if_call_is_ringing
AssertionError: Failed to initiate call: 503 Server Error: Service Unavailable for url: http://localhost:8080/api/v1/calls

- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/05a42007-6d48-4823-818d-129bb803bd7e/4097eae1-3921-467e-b7a0-0115ee64d900
- **Status:** ❌ Failed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC006
- **Test Name:** decline call should mark call as declined with reason
- **Test Code:** [TC006_decline_call_should_mark_call_as_declined_with_reason.py](./TC006_decline_call_should_mark_call_as_declined_with_reason.py)
- **Test Error:** Traceback (most recent call last):
  File "/var/task/handler.py", line 258, in run_with_retry
    exec(code, exec_env)
  File "<string>", line 122, in <module>
  File "<string>", line 84, in test_decline_call_should_mark_call_as_declined_with_reason
  File "<string>", line 38, in initiate_call
RuntimeError: No available staff to accept calls, cannot initiate call for testing decline

- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/05a42007-6d48-4823-818d-129bb803bd7e/3a7d6e86-d0da-4241-815e-a74e83e97214
- **Status:** ❌ Failed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC007
- **Test Name:** get available staff should return list filtered by org and skills
- **Test Code:** [TC007_get_available_staff_should_return_list_filtered_by_org_and_skills.py](./TC007_get_available_staff_should_return_list_filtered_by_org_and_skills.py)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/05a42007-6d48-4823-818d-129bb803bd7e/e31a11da-3a8d-4eee-8b60-b4a4e9fad671
- **Status:** ✅ Passed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC008
- **Test Name:** set staff availability should update status and skills
- **Test Code:** [TC008_set_staff_availability_should_update_status_and_skills.py](./TC008_set_staff_availability_should_update_status_and_skills.py)
- **Test Error:** Traceback (most recent call last):
  File "/var/task/handler.py", line 258, in run_with_retry
    exec(code, exec_env)
  File "<string>", line 75, in <module>
  File "<string>", line 19, in test_set_staff_availability_updates_status_and_skills
AssertionError: Login failed: Too many login attempts

- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/05a42007-6d48-4823-818d-129bb803bd7e/2372f7db-cc64-4924-8e3c-21381a4a6aa6
- **Status:** ❌ Failed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC009
- **Test Name:** get notifications should return all notifications
- **Test Code:** [TC009_get_notifications_should_return_all_notifications.py](./TC009_get_notifications_should_return_all_notifications.py)
- **Test Error:** Traceback (most recent call last):
  File "/var/task/handler.py", line 258, in run_with_retry
    exec(code, exec_env)
  File "<string>", line 65, in <module>
  File "<string>", line 20, in test_get_notifications_should_return_all_notifications
AssertionError: Login failed with status 429

- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/05a42007-6d48-4823-818d-129bb803bd7e/3b3d7eb2-3002-4066-b792-31681c947a5b
- **Status:** ❌ Failed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC010
- **Test Name:** mark notification as read should update notification status
- **Test Code:** [TC010_mark_notification_as_read_should_update_notification_status.py](./TC010_mark_notification_as_read_should_update_notification_status.py)
- **Test Error:** Traceback (most recent call last):
  File "/var/task/handler.py", line 258, in run_with_retry
    exec(code, exec_env)
  File "<string>", line 86, in <module>
  File "<string>", line 43, in test_mark_notification_as_read_should_update_notification_status
  File "<string>", line 17, in authenticate
  File "/var/task/requests/models.py", line 1024, in raise_for_status
    raise HTTPError(http_error_msg, response=self)
requests.exceptions.HTTPError: 429 Client Error: Too Many Requests for url: http://localhost:8080/api/auth/login

- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/05a42007-6d48-4823-818d-129bb803bd7e/76c80981-705a-4824-92a8-5348072b3ca4
- **Status:** ❌ Failed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---


## 3️⃣ Coverage & Matching Metrics

- **50.00** of tests passed

| Requirement        | Total Tests | ✅ Passed | ❌ Failed  |
|--------------------|-------------|-----------|------------|
| ...                | ...         | ...       | ...        |
---


## 4️⃣ Key Gaps / Risks
{AI_GNERATED_KET_GAPS_AND_RISKS}
---