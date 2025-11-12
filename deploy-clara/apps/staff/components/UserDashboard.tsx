import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Dashboard from './Dashboard';
import { StaffProfile } from '../types';
import { apiService } from '../services/api';
import { useNotification } from './NotificationProvider';

const UserDashboard: React.FC = () => {
  const { username } = useParams<{ username: string }>();
  const navigate = useNavigate();
  const [user, setUser] = useState<StaffProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const { addNotification } = useNotification();

  useEffect(() => {
    const loadUserData = async () => {
      try {
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
          try {
            const userData = JSON.parse(storedUser);
            // Validate user data structure
            if (userData && userData.id && userData.name) {
              setUser(userData);
              setLoading(false);
              return;
            }
          } catch (parseError) {
            console.error('Error parsing stored user:', parseError);
            localStorage.removeItem('user');
          }
        }

        // If no stored user or invalid, fetch from API
        if (username) {
          const response = await apiService.getUserData(username);
          if (response.data && response.data.user) {
            setUser(response.data.user);
            localStorage.setItem('user', JSON.stringify(response.data.user));
          } else {
            console.error('Failed to load user data:', response.error);
            addNotification({
              type: 'system',
              title: 'Error',
              message: response.error || 'Failed to load user data. Please login again.'
            });
            // Clear invalid data
            localStorage.removeItem('token');
            localStorage.removeItem('refreshToken');
            localStorage.removeItem('user');
            navigate('/');
          }
        } else {
          navigate('/');
        }
      } catch (error: any) {
        console.error('Error loading user data:', error);
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
        navigate('/');
      } finally {
        setLoading(false);
      }
    };

    loadUserData();
  }, [username, navigate, addNotification]);

  const handleLogout = async () => {
    try {
      await apiService.logout();
      navigate('/');
    } catch (error) {
      console.error('Logout error:', error);
      // Clear tokens anyway
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
      navigate('/');
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-gradient-to-br from-[#0f172a] to-[#1e1b4b] flex items-center justify-center">
        <div className="text-white text-xl">Loading your dashboard...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return <Dashboard user={user} onLogout={handleLogout} />;
};

export default UserDashboard;

