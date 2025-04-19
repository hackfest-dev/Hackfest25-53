import React from 'react';
import { NavLink } from 'react-router-dom';

function Navbar({ user, isConnected, onLogout }) {
  return (
    <nav className="bg-gray-800 shadow-lg border-b border-gray-700">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex justify-between">
          <div className="flex space-x-4">
            <div className="flex items-center mr-2">
              <span className="font-bold text-xl text-indigo-400">Axentis</span>
            </div>
            <div className="flex items-center space-x-1">
              <NavLink 
                to="/analytics" 
                className={({ isActive }) => 
                  `px-3 py-4 text-sm font-medium transition-colors duration-200 ${
                    isActive 
                      ? 'text-indigo-400 border-b-2 border-indigo-400' 
                      : 'text-gray-300 hover:text-white'
                  }`
                }
              >
                Analytics
              </NavLink>
              <NavLink 
                to="/dashboard" 
                className={({ isActive }) => 
                  `px-3 py-4 text-sm font-medium transition-colors duration-200 ${
                    isActive 
                      ? 'text-indigo-400 border-b-2 border-indigo-400' 
                      : 'text-gray-300 hover:text-white'
                  }`
                }
              >
                Dashboard
              </NavLink>
              <NavLink 
                to="/whatsapp" 
                className={({ isActive }) => 
                  `px-3 py-4 text-sm font-medium transition-colors duration-200 ${
                    isActive 
                      ? 'text-indigo-400 border-b-2 border-indigo-400' 
                      : 'text-gray-300 hover:text-white'
                  }`
                }
              >
                WhatsApp Bot
              </NavLink>
              <NavLink 
                to="/commands" 
                className={({ isActive }) => 
                  `px-3 py-4 text-sm font-medium transition-colors duration-200 ${
                    isActive 
                      ? 'text-indigo-400 border-b-2 border-indigo-400' 
                      : 'text-gray-300 hover:text-white'
                  }`
                }
              >
                Command Panel
              </NavLink>
              <NavLink 
                to="/screenshots" 
                className={({ isActive }) => 
                  `px-3 py-4 text-sm font-medium transition-colors duration-200 ${
                    isActive 
                      ? 'text-indigo-400 border-b-2 border-indigo-400' 
                      : 'text-gray-300 hover:text-white'
                  }`
                }
              >
                Screenshot Panel
              </NavLink>
            </div>
          </div>
          
          {/* User profile and connection status */}
          {user && (
            <div className="flex items-center space-x-4">
              <div className="connection-status hidden md:block">
                <span className={`px-3 py-1 rounded-full text-xs ${isConnected ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'}`}>
                  {isConnected ? 'Connected' : 'Disconnected'}
                </span>
              </div>
              <div className="user-profile flex items-center space-x-2">
                {user.photoURL && (
                  <img 
                    src={user.photoURL} 
                    alt={user.displayName || 'User'} 
                    className="w-7 h-7 rounded-full border border-gray-700"
                  />
                )}
                <span className="text-sm text-gray-300 hidden md:block">{user.displayName || user.email}</span>
              </div>
              <button
                onClick={onLogout}
                className="bg-red-600/80 hover:bg-red-700 text-white text-xs px-3 py-1 rounded transition-colors duration-200"
              >
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}

export default Navbar;
