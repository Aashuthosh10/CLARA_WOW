import React, { useEffect, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { StaffProfile } from '../types';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { username } = useParams<{ username: string }>();
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [user, setUser] = useState<StaffProfile | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('token');
      const storedUser = localStorage.getItem('user');

      if (!token || !storedUser) {
        setIsAuthorized(false);
        return;
      }

      try {
        const userData = JSON.parse(storedUser);
        setUser(userData);

        // Check if username matches route param
        // Username can be name (normalized) or shortName
        const normalizedName = userData.name?.toLowerCase().replace(/\s+/g, '') || '';
        const shortName = userData.shortName?.toLowerCase() || '';
        const routeUsername = username?.toLowerCase() || '';

        if (normalizedName === routeUsername || shortName === routeUsername) {
          setIsAuthorized(true);
        } else {
          setIsAuthorized(false);
        }
      } catch (error) {
        console.error('Error checking auth:', error);
        setIsAuthorized(false);
      }
    };

    checkAuth();
  }, [username]);

  if (isAuthorized === null) {
    // Loading state
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  if (!isAuthorized) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;

