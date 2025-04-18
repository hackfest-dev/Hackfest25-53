import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { logOut } from '../services/firebase';

function Navbar({ user }) {
  const navigate = useNavigate();
  
  const handleLogout = async () => {
    try {
      await logOut();
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <nav className="bg-gray-800 border-b border-gray-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <span className="font-bold text-xl text-indigo-400">Axentis</span>
            </div>
            <div className="hidden md:block">
              <div className="ml-10 flex items-baseline space-x-4">
                <NavLink to="/" className={({isActive}) => 
                  isActive 
                    ? "bg-gray-900 text-white px-3 py-2 rounded-md text-sm font-medium" 
                    : "text-gray-300 hover:bg-gray-700 hover:text-white px-3 py-2 rounded-md text-sm font-medium"
                }>
                  Dashboard
                </NavLink>
                <NavLink to="/whatsapp" className={({isActive}) => 
                  isActive 
                    ? "bg-gray-900 text-white px-3 py-2 rounded-md text-sm font-medium" 
                    : "text-gray-300 hover:bg-gray-700 hover:text-white px-3 py-2 rounded-md text-sm font-medium"
                }>
                  WhatsApp
                </NavLink>
                <NavLink to="/commands" className={({isActive}) => 
                  isActive 
                    ? "bg-gray-900 text-white px-3 py-2 rounded-md text-sm font-medium" 
                    : "text-gray-300 hover:bg-gray-700 hover:text-white px-3 py-2 rounded-md text-sm font-medium"
                }>
                  Commands
                </NavLink>
                <NavLink to="/screenshots" className={({isActive}) => 
                  isActive 
                    ? "bg-gray-900 text-white px-3 py-2 rounded-md text-sm font-medium" 
                    : "text-gray-300 hover:bg-gray-700 hover:text-white px-3 py-2 rounded-md text-sm font-medium"
                }>
                  Screenshots
                </NavLink>
              </div>
            </div>
          </div>
          {user && (
            <div className="hidden md:block">
              <div className="ml-4 flex items-center md:ml-6">
                <button
                  onClick={handleLogout}
                  className="flex items-center text-gray-300 hover:bg-gray-700 hover:text-white px-3 py-2 rounded-md text-sm font-medium"
                >
                  <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  Logout
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Mobile menu, show/hide based on menu state */}
      <div className="md:hidden">
        <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
          <NavLink to="/" className={({isActive}) => 
            isActive 
              ? "bg-gray-900 text-white block px-3 py-2 rounded-md text-base font-medium" 
              : "text-gray-300 hover:bg-gray-700 hover:text-white block px-3 py-2 rounded-md text-base font-medium"
          }>
            Dashboard
          </NavLink>
          <NavLink to="/whatsapp" className={({isActive}) => 
            isActive 
              ? "bg-gray-900 text-white block px-3 py-2 rounded-md text-base font-medium" 
              : "text-gray-300 hover:bg-gray-700 hover:text-white block px-3 py-2 rounded-md text-base font-medium"
          }>
            WhatsApp
          </NavLink>
          <NavLink to="/commands" className={({isActive}) => 
            isActive 
              ? "bg-gray-900 text-white block px-3 py-2 rounded-md text-base font-medium" 
              : "text-gray-300 hover:bg-gray-700 hover:text-white block px-3 py-2 rounded-md text-base font-medium"
          }>
            Commands
          </NavLink>
          <NavLink to="/screenshots" className={({isActive}) => 
            isActive 
              ? "bg-gray-900 text-white block px-3 py-2 rounded-md text-base font-medium" 
              : "text-gray-300 hover:bg-gray-700 hover:text-white block px-3 py-2 rounded-md text-base font-medium"
          }>
            Screenshots
          </NavLink>
          {user && (
            <button
              onClick={handleLogout}
              className="flex items-center w-full text-left text-gray-300 hover:bg-gray-700 hover:text-white px-3 py-2 rounded-md text-base font-medium"
            >
              <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Logout
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}

export default Navbar;
