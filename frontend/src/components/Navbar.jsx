import React from 'react';
import { NavLink } from 'react-router-dom';

function Navbar() {
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
                to="/" 
                end
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
        </div>
      </div>
    </nav>
  );
}

export default Navbar;
