// Determine API base URL - prefer env vars, otherwise use unified server
const getApiBaseUrl = () => {
  if (import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_BASE) {
    return `${import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_BASE}/api`;
  }
  // In development, always use the unified server on port 8080
  if (typeof window !== 'undefined') {
    // If accessed through unified server, use current origin
    if (window.location.port === '8080' || window.location.pathname.startsWith('/staff')) {
      return `${window.location.origin}/api`;
    }
    // Otherwise, use the unified server port
    return 'http://localhost:8080/api';
  }
  return 'http://localhost:8080/api';
};

const API_BASE_URL = getApiBaseUrl();

interface ApiResponse<T> {
  data?: T;
  error?: string;
}

class ApiService {
  private getToken(): string | null {
    return localStorage.getItem('token');
  }

  private getRefreshToken(): string | null {
    return localStorage.getItem('refreshToken');
  }

  private async refreshAccessToken(): Promise<boolean> {
    try {
      const refreshToken = this.getRefreshToken();
      if (!refreshToken) {
        return false;
      }

      const response = await fetch(`${API_BASE_URL}/auth/refresh-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken }),
      });

      if (response.ok) {
        const data = await response.json();
        localStorage.setItem('token', data.token);
        localStorage.setItem('refreshToken', data.refreshToken);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error refreshing token:', error);
      return false;
    }
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const token = this.getToken();
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      let response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers,
      });

      // If token expired (401 or 403), try to refresh
      if ((response.status === 401 || response.status === 403) && token) {
        console.log('Token expired or invalid, attempting refresh...');
        const refreshed = await this.refreshAccessToken();
        if (refreshed) {
          // Retry request with new token
          const newToken = this.getToken();
          if (newToken) {
            headers['Authorization'] = `Bearer ${newToken}`;
            console.log('Retrying request with refreshed token');
            response = await fetch(`${API_BASE_URL}${endpoint}`, {
              ...options,
              headers,
            });
          }
        } else {
          // Refresh failed, clear tokens and redirect to login
          console.warn('Token refresh failed, clearing auth data');
          localStorage.removeItem('token');
          localStorage.removeItem('refreshToken');
        }
      }

      let data;
      const contentType = response.headers.get('content-type');
      
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        const text = await response.text();
        return { error: text || 'Request failed' };
      }

      if (!response.ok) {
        return { error: data.error || data.message || 'Request failed' };
      }

      return { data };
    } catch (error: any) {
      console.error('API request error:', error);
      if (error.message?.includes('Failed to fetch') || error.message?.includes('NetworkError')) {
        return { error: `Cannot connect to server. Please ensure the backend is running on ${API_BASE_URL.replace('/api', '')}` };
      }
      return { error: error.message || 'Network error. Please check your connection.' };
    }
  }

  async login(email: string, password: string) {
    return this.request<{ token: string; refreshToken: string; user: any }>(
      '/auth/login',
      {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }
    );
  }

  async logout() {
    const result = await this.request('/auth/logout', {
      method: 'POST',
    });
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    return result;
  }

  async getUserData(username: string) {
    return this.request<{ user: any; meetings: any[]; tasks: any[]; timetable: any[] }>(
      `/user/${username}`
    );
  }

  async changePassword(oldPassword: string, newPassword: string, confirmPassword: string) {
    return this.request<{ message: string }>('/auth/change-password', {
      method: 'PATCH',
      body: JSON.stringify({ oldPassword, newPassword, confirmPassword }),
    });
  }

  async createNotification(userIds: string[], type: string, title: string, message: string, groupId?: string, senderId?: string) {
    return this.request<{ message: string; count: number }>('/notifications', {
      method: 'POST',
      body: JSON.stringify({ userIds, type, title, message, groupId, senderId }),
    });
  }

  async getNotifications() {
    return this.request<{ notifications: any[] }>('/notifications');
  }

  async getUnreadCount() {
    return this.request<{ count: number }>('/notifications/unread');
  }

  async markAsRead(notificationId: string) {
    return this.request<{ notification: any }>(`/notifications/${notificationId}/read`, {
      method: 'PATCH',
    });
  }

  async markAllAsRead() {
    return this.request<{ message: string }>('/notifications/read-all', {
      method: 'PATCH',
    });
  }

  async deleteNotification(notificationId: string) {
    return this.request<{ message: string }>(`/notifications/${notificationId}`, {
      method: 'DELETE',
    });
  }

  // Attendance API methods
  async importStudents(students: Array<{ studentId: string; name: string; usn: string; semester: number; section: string }>) {
    return this.request<{ message: string; count: number }>('/attendance/import', {
      method: 'POST',
      body: JSON.stringify({ students }),
    });
  }

  async getStudents(semester: number, section: string) {
    return this.request<Array<{ studentId: string; name: string; usn: string; semester: number; section: string }>>(
      `/attendance/students?sem=${semester}&section=${section}`
    );
  }

  async markAttendance(data: {
    date: string;
    sem: number;
    section: string;
    staffId: string;
    attendance: Array<{ studentId: string; status: 'present' | 'absent' }>;
  }) {
    return this.request<{ message: string; attendanceId: string }>('/attendance/mark', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }
}

export const apiService = new ApiService();

