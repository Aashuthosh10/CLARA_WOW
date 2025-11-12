import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { NotificationProvider } from './components/NotificationProvider';
import ErrorBoundary from './components/ErrorBoundary';
import Home from './components/Home';
import UserDashboard from './components/UserDashboard';
import ProtectedRoute from './components/ProtectedRoute';
import Settings from './components/Settings';
import Dashboard from './components/Dashboard';

const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <NotificationProvider>
        <BrowserRouter>
          <Routes>
            {/* Home/Login route */}
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Home />} />
            
            {/* Protected user dashboard route */}
            <Route 
              path="/:username" 
              element={
                <ProtectedRoute>
                  <UserDashboard />
                </ProtectedRoute>
              } 
            />
            
            {/* Protected settings route */}
            <Route 
              path="/:username/settings" 
              element={
                <ProtectedRoute>
                  <SettingsRouteWrapper />
                </ProtectedRoute>
              } 
            />
            
            {/* Catch all - redirect to home */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </NotificationProvider>
    </ErrorBoundary>
  );
};

// Settings route component that shows Dashboard with Settings view
const SettingsRouteWrapper: React.FC = () => {
  const [user, setUser] = React.useState<any>(null);

  React.useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (error) {
        console.error('Error parsing user data:', error);
      }
    }
  }, []);

  if (!user) {
    return (
      <div className="fixed inset-0 bg-gradient-to-br from-[#0f172a] to-[#1e1b4b] flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <Dashboard 
      user={user} 
      initialView="Settings"
      onLogout={() => {
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
        window.location.href = '/';
      }}
    />
  );
};

export default App;
