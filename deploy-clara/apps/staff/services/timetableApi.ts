// Timetable API service for fetching and updating timetables
// Determine API base URL - prefer env vars, otherwise use unified server
const getApiBaseUrl = () => {
  // First, check environment variables
  if ((import.meta as any).env?.VITE_API_BASE_URL || (import.meta as any).env?.VITE_API_BASE) {
    const base = (import.meta as any).env?.VITE_API_BASE_URL || (import.meta as any).env?.VITE_API_BASE;
    // Remove trailing slash and ensure /api is appended correctly
    const cleanBase = base.replace(/\/+$/, '');
    // If base already includes /api, don't add it again
    if (cleanBase.endsWith('/api')) {
      return cleanBase;
    }
    return `${cleanBase}/api`;
  }
  
  // In browser environment, try to detect the correct API base
  if (typeof window !== 'undefined') {
    const origin = window.location.origin;
    const port = window.location.port;
    const pathname = window.location.pathname;
    
    // If accessed through unified server (port 8080 or /staff path), use current origin
    if (port === '8080' || pathname.startsWith('/staff')) {
      return `${origin}/api`;
    }
    
    // If staff app is on a different port (like 5174), try to use port 8080 for API
    // This handles the case where staff and server run separately in dev
    if (port === '5174' || port === '5173') {
      // Try to construct the API URL - assume server is on same host, port 8080
      const host = window.location.hostname;
      return `http://${host}:8080/api`;
    }
    
    // Default fallback: use current origin
    return `${origin}/api`;
  }
  
  // Server-side or fallback
  return 'http://localhost:8080/api';
};

const API_BASE = getApiBaseUrl();

export interface TimetableResponse {
  facultyId: string;
  faculty: string;
  designation?: string;
  semester: string;
  schedule: {
    Monday?: SemesterClass[];
    Tuesday?: SemesterClass[];
    Wednesday?: SemesterClass[];
    Thursday?: SemesterClass[];
    Friday?: SemesterClass[];
    Saturday?: SemesterClass[];
  };
  workload?: {
    theory: number;
    lab: number;
    totalUnits: number;
  };
  updatedAt: string;
  editHistory?: Array<{
    editedBy: string;
    date: string;
    fieldChanged: string;
  }>;
}

export interface SemesterClass {
  time: string;
  subject: string;
  subjectCode?: string;
  courseName?: string;
  classType?: 'Theory' | 'Lab' | 'Free' | 'Busy';
  batch?: string;
  room?: string;
}

export interface UpdateTimetableRequest {
  faculty: string;
  designation?: string;
  semester: string;
  schedule: TimetableResponse['schedule'];
  workload?: {
    theory: number;
    lab: number;
    totalUnits: number;
  };
}

class TimetableApiService {
  private getToken(): string | null {
    return localStorage.getItem('token') || localStorage.getItem('clara-jwt-token');
  }
  
  private async refreshToken(): Promise<boolean> {
    const refreshToken = localStorage.getItem('refreshToken');
    if (!refreshToken) {
      return false;
    }
    
    try {
      const response = await fetch(`${API_BASE}/auth/refresh-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.token) {
          localStorage.setItem('token', data.token);
          if (data.refreshToken) {
            localStorage.setItem('refreshToken', data.refreshToken);
          }
          return true;
        }
      }
    } catch (error) {
      console.error('Token refresh failed:', error);
    }
    return false;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    let token = this.getToken();
    
    // If no token, don't make authenticated requests (will fail gracefully)
    if (!token) {
      console.warn('No authentication token found for timetable API request');
    }
    
    let headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    let response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });
    
    // If token expired (401 or 403), try to refresh
    if ((response.status === 401 || response.status === 403) && token) {
      console.log('Timetable API: Token expired, attempting refresh...');
      const refreshed = await this.refreshToken();
      if (refreshed) {
        token = this.getToken();
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
          console.log('Timetable API: Retrying with refreshed token');
          response = await fetch(`${API_BASE}${endpoint}`, {
            ...options,
            headers,
          });
        }
      } else {
        // Refresh failed, clear tokens
        console.warn('Timetable API: Token refresh failed, clearing auth data');
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('clara-jwt-token');
      }
    }

    // Get content type first
    const contentType = response.headers.get('content-type') || '';
    const isJson = contentType.includes('application/json');

    // Handle non-OK responses
    if (!response.ok) {
      // For 404, try JSON first (server should return JSON)
      if (response.status === 404) {
        if (isJson) {
          try {
            const errorData = await response.json();
            const error = new Error(errorData.error || errorData.message || 'Timetable not found');
            (error as any).status = 404;
            throw error;
          } catch (e: any) {
            // If error already has status, rethrow it
            if (e.status === 404) throw e;
            // Otherwise, it's a JSON parsing error
            throw new Error('Timetable not found');
          }
        } else {
          // If not JSON, it might be an HTML error page
          const text = await response.text();
          if (text.includes('<!DOCTYPE') || text.includes('<html')) {
            throw new Error('Timetable not found');
          }
          throw new Error(text || 'Timetable not found');
        }
      }

      // For other error status codes (401, 403, 500, etc.)
      if (response.status === 401 || response.status === 403) {
        // Invalid token - clear it and throw a user-friendly error
        localStorage.removeItem('token');
        localStorage.removeItem('clara-jwt-token');
        const error = new Error('Authentication failed. Please log in again.');
        (error as any).status = response.status;
        throw error;
      }
      
      if (isJson) {
        try {
          const errorData = await response.json();
          const error = new Error(errorData.error || errorData.message || `HTTP ${response.status}`);
          // Attach validation details if available
          if (errorData.details) {
            (error as any).details = errorData.details;
          }
          (error as any).status = response.status;
          throw error;
        } catch (e: any) {
          // If it's already an Error object, rethrow
          if (e instanceof Error) throw e;
          const error = new Error(`HTTP ${response.status}`);
          (error as any).status = response.status;
          throw error;
        }
      } else {
        // Non-JSON error response
        const text = await response.text();
        const error = new Error(text || `Server returned non-JSON response. Status: ${response.status}`);
        (error as any).status = response.status;
        throw error;
      }
    }

    // Successful response - parse JSON
    if (!isJson) {
      const text = await response.text();
      throw new Error(`Server returned non-JSON response. Status: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Get timetable for a specific faculty and semester
   */
  async getTimetable(facultyId: string, semester: string): Promise<TimetableResponse> {
    return this.request<TimetableResponse>(`/timetables/${encodeURIComponent(facultyId)}/${encodeURIComponent(semester)}`);
  }

  /**
   * Update timetable for a faculty
   */
  async updateTimetable(
    facultyId: string,
    timetable: UpdateTimetableRequest
  ): Promise<{ success: boolean; timetable: TimetableResponse; message: string }> {
    return this.request(`/timetables/${encodeURIComponent(facultyId)}`, {
      method: 'PATCH',
      body: JSON.stringify(timetable),
    });
  }

  /**
   * Get all timetables for a semester (admin only)
   */
  async getAllTimetablesForSemester(semester: string): Promise<TimetableResponse[]> {
    return this.request<TimetableResponse[]>(`/timetables/semester/${encodeURIComponent(semester)}`);
  }
}

export const timetableApi = new TimetableApiService();

