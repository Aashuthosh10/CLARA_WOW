import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Login from './Login';

const Home: React.FC = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Check if user is already logged in
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');

    if (token && user) {
      try {
        const userData = JSON.parse(user);
        const username = userData.shortName?.toLowerCase() || 
                         userData.name?.toLowerCase().replace(/\s+/g, '');
        navigate(`/${username}`);
      } catch (error) {
        // Invalid user data, stay on login page
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
      }
    }
  }, [navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f172a] to-[#1e1b4b]">
      <Login />
    </div>
  );
};

export default Home;

