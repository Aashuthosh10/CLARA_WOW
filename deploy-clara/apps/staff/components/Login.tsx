
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../services/api';
import { useServerReady } from '../src/hooks/useServerReady';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  
  const { isReady, isChecking, error: serverError, progress } = useServerReady({
    maxRetries: 20,
    retryDelay: 500,
  });

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await apiService.login(email, password);
      
      if (response.data && response.data.token) {
        // Store tokens and user data
        localStorage.setItem('token', response.data.token);
        if (response.data.refreshToken) {
          localStorage.setItem('refreshToken', response.data.refreshToken);
        }
        localStorage.setItem('user', JSON.stringify(response.data.user));
        
        // Redirect to user's personalized route
        // Use shortName or normalized name as route
        const username = response.data.user.shortName?.toLowerCase() || 
                         response.data.user.name?.toLowerCase().replace(/\s+/g, '');
        navigate(`/${username}`);
      } else {
        setError(response.error || 'Invalid email or password. Please check your credentials.');
      }
    } catch (error: any) {
      console.error('Login error:', error);
      setError(error.message || 'An error occurred. Please ensure the backend server is running.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center font-sans">
      <div className="w-full max-w-md bg-slate-800/70 border border-white/10 rounded-2xl p-8 text-white shadow-2xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold">Staff Login</h1>
          <p className="text-slate-400 mt-2">Welcome back! Please sign in to continue</p>
        </div>
        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2" htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              className="w-full bg-slate-900/80 border border-slate-700 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-purple-500 transition"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2" htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              className="w-full bg-slate-900/80 border border-slate-700 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-purple-500 transition"
              required
            />
          </div>
          {isChecking && !isReady && (
            <div className="bg-yellow-500/20 border border-yellow-500/50 rounded-lg p-3 mb-4">
              <p className="text-yellow-300 text-sm text-center">
                ⚠️ Server status unknown. You can still try to login.
              </p>
            </div>
          )}
          {error && (
            <p className="text-red-400 text-sm text-center">{error}</p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold py-3 rounded-lg transition-transform transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
