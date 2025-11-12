from test_utils.api_helpers import login_staff, login_client, set_staff_availability, initiate_call
from test_utils.socketio_helpers import connect_socketio, cleanup_socketio
import time

def extract_staff_id(email):
    return email.split('@')[0] if '@' in email else email

def main():
    staff_data = login_staff()
    staff_token = staff_data['token']
    staff_id = extract_staff_id(staff_data['user']['email'])
    set_staff_availability(staff_token, status='offline')
    client_token = login_client()
    resp = initiate_call(client_token, target_staff_id=staff_id)
    print('offline status', resp.status_code)
    set_staff_availability(staff_token, status='available')
    helper = connect_socketio(staff_token)
    helper.join_staff_room(staff_id)
    time.sleep(0.5)
    resp = initiate_call(client_token, target_staff_id=staff_id)
    print('available status', resp.status_code)
    if resp.status_code == 200:
        call_id = resp.json().get('callId')
        print('call id', call_id)
        event = helper.wait_for_event('call.initiated', timeout=10)
        print('event', event)
    cleanup_socketio(helper)

if __name__ == '__main__':
    main()
