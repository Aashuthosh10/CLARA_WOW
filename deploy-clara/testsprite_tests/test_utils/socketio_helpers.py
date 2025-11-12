"""
Socket.IO Helper Functions for TestSprite Tests
Provides reusable functions for Socket.IO connections, event listening, and room management
"""
import socketio
import time
import threading
from typing import Optional, Dict, Any, Callable, List
from queue import Queue, Empty

BASE_URL = "http://localhost:8080"
SOCKET_PATH = "/socket"
NAMESPACE = "/rtc"
TIMEOUT = 30
EVENT_TIMEOUT = 10


class SocketIOHelper:
    """Helper class for Socket.IO testing"""
    
    def __init__(self, token: str, server_url: str = BASE_URL, socket_path: str = SOCKET_PATH, namespace: str = NAMESPACE):
        """
        Initialize Socket.IO helper
        
        Args:
            token: JWT authentication token
            server_url: Server base URL
            socket_path: Socket.IO path
            namespace: Socket.IO namespace
        """
        self.token = token
        self.server_url = server_url
        self.socket_path = socket_path
        self.namespace = namespace
        self.client = None
        self.connected = False
        self.event_queue = Queue()
        self.event_listeners = {}
        self.received_events = []
        
    def connect(self, wait_time: float = 2.0) -> bool:
        """
        Connect to Socket.IO server with JWT authentication
        
        Args:
            wait_time: Time to wait for connection
            
        Returns:
            True if connected successfully
        """
        try:
            self.client = socketio.Client()
            
            # Set up event handlers
            @self.client.on('connect', namespace=self.namespace)
            def on_connect():
                self.connected = True
                print(f"[SocketIO] Connected to {self.namespace}")
            
            @self.client.on('disconnect', namespace=self.namespace)
            def on_disconnect():
                self.connected = False
                print(f"[SocketIO] Disconnected from {self.namespace}")
            
            @self.client.on('connect_error', namespace=self.namespace)
            def on_connect_error(data):
                print(f"[SocketIO] Connection error: {data}")
                self.connected = False
            
            # Connect with authentication
            self.client.connect(
                self.server_url,
                socketio_path=self.socket_path,
                namespaces=[self.namespace],
                auth={'token': self.token},
                wait_timeout=wait_time
            )
            
            time.sleep(0.5)  # Give connection time to establish
            return self.connected
            
        except Exception as e:
            print(f"[SocketIO] Connection failed: {e}")
            self.connected = False
            return False
    
    def disconnect(self):
        """Disconnect from Socket.IO server"""
        if self.client and self.connected:
            try:
                self.client.disconnect()
            except:
                pass
            self.connected = False
            self.client = None
    
    def join_staff_room(self, staff_id: str) -> bool:
        """
        Join staff room
        
        Args:
            staff_id: Staff ID to join room for
            
        Returns:
            True if join event was emitted
        """
        if not self.connected:
            return False
        
        try:
            self.client.emit('join:staff', {'staffId': staff_id}, namespace=self.namespace)
            time.sleep(0.2)  # Give server time to process
            return True
        except Exception as e:
            print(f"[SocketIO] Failed to join staff room: {e}")
            return False
    
    def join_call_room(self, call_id: str) -> bool:
        """
        Join call room
        
        Args:
            call_id: Call ID to join room for
            
        Returns:
            True if join event was emitted
        """
        if not self.connected:
            return False
        
        try:
            self.client.emit('join:call', {'callId': call_id}, namespace=self.namespace)
            time.sleep(0.2)  # Give server time to process
            return True
        except Exception as e:
            print(f"[SocketIO] Failed to join call room: {e}")
            return False
    
    def wait_for_event(self, event_name: str, timeout: float = EVENT_TIMEOUT) -> Optional[Dict[str, Any]]:
        """
        Wait for a specific Socket.IO event
        
        Args:
            event_name: Name of event to wait for
            timeout: Maximum time to wait in seconds
            
        Returns:
            Event data if received, None if timeout
        """
        if not self.connected:
            return None
        
        # Set up one-time listener
        event_received = threading.Event()
        event_data = [None]
        
        @self.client.on(event_name, namespace=self.namespace)
        def event_handler(data):
            event_data[0] = data
            event_received.set()
            self.received_events.append({'event': event_name, 'data': data, 'timestamp': time.time()})
        
        # Wait for event
        if event_received.wait(timeout=timeout):
            return event_data[0]
        else:
            # Remove listener on timeout
            try:
                self.client.off(event_name, namespace=self.namespace)
            except:
                pass
            return None
    
    def listen_for_events(self, event_names: List[str], timeout: float = EVENT_TIMEOUT) -> Dict[str, Optional[Dict[str, Any]]]:
        """
        Listen for multiple events and return first one received
        
        Args:
            event_names: List of event names to listen for
            timeout: Maximum time to wait in seconds
            
        Returns:
            Dict mapping event names to their data (None if not received)
        """
        if not self.connected:
            return {name: None for name in event_names}
        
        results = {name: None for name in event_names}
        event_received = threading.Event()
        received_event_name = [None]
        
        def create_handler(event_name):
            def handler(data):
                if received_event_name[0] is None:  # Only capture first event
                    results[event_name] = data
                    received_event_name[0] = event_name
                    self.received_events.append({'event': event_name, 'data': data, 'timestamp': time.time()})
                    event_received.set()
            return handler
        
        # Register handlers
        for event_name in event_names:
            self.client.on(event_name, create_handler(event_name), namespace=self.namespace)
        
        # Wait for any event
        event_received.wait(timeout=timeout)
        
        # Clean up handlers
        for event_name in event_names:
            try:
                self.client.off(event_name, namespace=self.namespace)
            except:
                pass
        
        return results
    
    def emit_event(self, event_name: str, data: Dict[str, Any]) -> bool:
        """
        Emit a Socket.IO event
        
        Args:
            event_name: Event name to emit
            data: Event data
            
        Returns:
            True if emitted successfully
        """
        if not self.connected:
            return False
        
        try:
            self.client.emit(event_name, data, namespace=self.namespace)
            return True
        except Exception as e:
            print(f"[SocketIO] Failed to emit event {event_name}: {e}")
            return False
    
    def get_received_events(self) -> List[Dict[str, Any]]:
        """Get all received events"""
        return self.received_events.copy()
    
    def clear_received_events(self):
        """Clear received events history"""
        self.received_events.clear()


def connect_socketio(token: str, server_url: str = BASE_URL, socket_path: str = SOCKET_PATH, namespace: str = NAMESPACE) -> SocketIOHelper:
    """
    Connect to Socket.IO server with JWT authentication
    
    Args:
        token: JWT authentication token
        server_url: Server base URL
        socket_path: Socket.IO path
        namespace: Socket.IO namespace
        
    Returns:
        SocketIOHelper instance
    """
    helper = SocketIOHelper(token, server_url, socket_path, namespace)
    if helper.connect():
        return helper
    else:
        raise ConnectionError("Failed to connect to Socket.IO server")


def wait_for_event(helper: SocketIOHelper, event_name: str, timeout: float = EVENT_TIMEOUT) -> Optional[Dict[str, Any]]:
    """
    Wait for a specific Socket.IO event
    
    Args:
        helper: SocketIOHelper instance
        event_name: Event name to wait for
        timeout: Maximum wait time
        
    Returns:
        Event data or None
    """
    return helper.wait_for_event(event_name, timeout)


def cleanup_socketio(helper: SocketIOHelper):
    """
    Cleanup Socket.IO connection
    
    Args:
        helper: SocketIOHelper instance to cleanup
    """
    if helper:
        helper.disconnect()

