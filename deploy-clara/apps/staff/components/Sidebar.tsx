import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { StaffProfile, NavItem } from '../types';

interface SidebarProps {
  user: StaffProfile;
  activeItem: NavItem;
  setActiveItem: (item: NavItem) => void;
}

const navItems: { name: NavItem; icon: string }[] = [
  { name: 'Dashboard', icon: 'fa-solid fa-table-columns' },
  { name: 'Timetable', icon: 'fa-solid fa-calendar-days' },
  { name: 'Appointments', icon: 'fa-solid fa-handshake' },
  { name: 'Task Management', icon: 'fa-solid fa-list-check' },
  { name: 'AI Assistant', icon: 'fa-solid fa-robot' },
  { name: 'Meeting Summarizer', icon: 'fa-solid fa-file-lines' },
  { name: 'Team Directory', icon: 'fa-solid fa-users' },
  { name: 'Settings', icon: 'fa-solid fa-cog' },
];

const Sidebar: React.FC<SidebarProps> = ({ user, activeItem, setActiveItem }) => {
  const navigate = useNavigate();
  const { username } = useParams<{ username: string }>();

  const handleNavClick = (item: NavItem) => {
    setActiveItem(item);
    if (item === 'Settings' && username) {
      navigate(`/${username}/settings`);
    } else if (username && item !== 'Settings') {
      navigate(`/${username}`);
    }
  };

  // Helper to get user initials
  const getInitials = (name: string): string => {
    if (!name) return "?";
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  // Check if avatar is a valid URL (not just URL parameters)
  const isAvatarUrl = (avatar: string): boolean => {
    if (!avatar || typeof avatar !== 'string') return false;
    // Check if it's a full URL (starts with http:// or https://)
    return avatar.startsWith('http://') || avatar.startsWith('https://');
  };

  const userInitials = getInitials(user.name);

  return (
    <aside className="fixed top-0 left-0 h-screen w-[280px] bg-slate-900/50 backdrop-blur-lg border-r border-white/10 p-6 flex flex-col text-white z-40 transition-transform transform -translate-x-full lg:translate-x-0">
      <div className="flex items-center space-x-4 mb-8">
        {isAvatarUrl(user.avatar) ? (
          <img
            src={user.avatar}
            alt={user.name}
            className="w-12 h-12 rounded-full object-cover border-2 border-purple-500/50"
            onError={(e) => {
              // Fallback to initials if image fails to load
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
              const parent = target.parentElement;
              if (parent) {
                const fallback = document.createElement('div');
                fallback.className = 'w-12 h-12 rounded-full bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center text-xl font-bold text-white';
                fallback.textContent = userInitials;
                parent.appendChild(fallback);
              }
            }}
          />
        ) : (
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center text-xl font-bold text-white">
            {userInitials}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-white truncate">{user.name}</h3>
          <p className="text-sm text-slate-400 truncate">{user.department}</p>
        </div>
      </div>

      <nav className="flex flex-col space-y-2 flex-1 overflow-y-auto">
        {navItems.map((item) => (
          <button
            key={item.name}
            onClick={() => handleNavClick(item.name)}
            className={`flex items-center space-x-3 p-3 rounded-lg transition-all duration-200 text-left ${
              activeItem === item.name
                ? 'bg-blue-600/50 text-white shadow-lg'
                : 'text-slate-400 hover:bg-slate-700/50 hover:text-white'
            }`}
          >
            <i className={`${item.icon} w-5 text-center flex-shrink-0`}></i>
            <span className="font-semibold text-sm truncate">{item.name}</span>
          </button>
        ))}
      </nav>
    </aside>
  );
};

export default Sidebar;