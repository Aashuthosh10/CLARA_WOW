import React, { useState } from 'react';
import { apiService } from '../services/api';
import { useNotification } from './NotificationProvider';

const Settings: React.FC = () => {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const { addNotification } = useNotification();

  const validatePassword = (password: string): string | null => {
    if (password.length < 8) {
      return 'Password must be at least 8 characters long';
    }
    if (!/[0-9]/.test(password)) {
      return 'Password must contain at least one number';
    }
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      return 'Password must contain at least one symbol';
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    // Validation
    const newPasswordError = validatePassword(newPassword);
    if (newPasswordError) {
      setErrors({ newPassword: newPasswordError });
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrors({ confirmPassword: 'Passwords do not match' });
      return;
    }

    setLoading(true);
    try {
      const response = await apiService.changePassword(oldPassword, newPassword, confirmPassword);
      
      if (response.data) {
        addNotification({
          type: 'system',
          title: 'Success',
          message: 'Password updated successfully'
        });
        setOldPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setErrors({ submit: response.error || 'Failed to change password' });
      }
    } catch (error) {
      console.error('Error changing password:', error);
      setErrors({ submit: 'An error occurred. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="text-white p-4 lg:p-6 rounded-2xl bg-slate-900/50 backdrop-blur-lg border border-white/10 max-w-2xl mx-auto w-full">
      <h2 className="text-2xl font-bold mb-6">Change Password</h2>
      
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2" htmlFor="oldPassword">
            Current Password
          </label>
          <input
            id="oldPassword"
            type="password"
            value={oldPassword}
            onChange={(e) => setOldPassword(e.target.value)}
            className="w-full bg-slate-800/80 border border-slate-700 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-purple-500 transition"
            required
          />
          {errors.oldPassword && (
            <p className="text-red-400 text-sm mt-1">{errors.oldPassword}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2" htmlFor="newPassword">
            New Password
          </label>
          <input
            id="newPassword"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full bg-slate-800/80 border border-slate-700 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-purple-500 transition"
            required
          />
          {errors.newPassword && (
            <p className="text-red-400 text-sm mt-1">{errors.newPassword}</p>
          )}
          <p className="text-slate-400 text-xs mt-1">
            Must be at least 8 characters with one number and one symbol
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2" htmlFor="confirmPassword">
            Confirm New Password
          </label>
          <input
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full bg-slate-800/80 border border-slate-700 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-purple-500 transition"
            required
          />
          {errors.confirmPassword && (
            <p className="text-red-400 text-sm mt-1">{errors.confirmPassword}</p>
          )}
        </div>

        {errors.submit && (
          <div className="bg-red-500/20 border border-red-500/50 text-red-400 px-4 py-3 rounded-lg">
            {errors.submit}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold py-3 rounded-lg transition-transform transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Updating...' : 'Update Password'}
        </button>
      </form>
    </div>
  );
};

export default Settings;

