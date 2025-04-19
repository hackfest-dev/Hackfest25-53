import React, { useState, useRef, useEffect } from 'react';
import { FaBars, FaUserCircle, FaSignOutAlt, FaUserCog } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../../services/firebase';

const Navbar = ({ toggleSidebar }) => {
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();
  
  // Get user directly from Firebase auth
  const user = auth.currentUser;

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleLogout = async () => {
    try {
      // Use Firebase's signOut method directly
      await signOut(auth);
      console.log('Successfully logged out');
      navigate('/login');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  return (
    <nav className="bg-[#1C1B23] border-b border-gray-700 shadow-md">
      <div className="px-4 py-3 flex items-center justify-between">
        <div className="flex items-center">
          <button
            onClick={toggleSidebar}
            className="text-gray-400 hover:text-white focus:outline-none focus:text-white mr-4"
          >
            <FaBars className="h-6 w-6" />
          </button>
          <span className="text-xl font-bold bg-gradient-to-b from-[#4c3d8b] to-[#5e4e99] bg-clip-text text-transparent">
            Axentis
          </span>
        </div>
        
        <div className="flex items-center space-x-4">
          <div className="relative" ref={dropdownRef}>
            <div 
              className="flex items-center space-x-3 cursor-pointer"
              onClick={() => setShowDropdown(!showDropdown)}
            >
              <span className="text-sm hidden md:block text-gray-300">
                {user?.displayName || user?.email || 'User'}
              </span>
              {user?.photoURL ? (
                <img 
                  src={user.photoURL} 
                  alt="Profile" 
                  className="h-8 w-8 rounded-full border border-gray-700"
                />
              ) : (
                <FaUserCircle className="h-8 w-8 text-gray-400" />
              )}
            </div>
            
            {/* Dropdown menu */}
            {showDropdown && (
              <div className="absolute right-0 mt-2 w-48 bg-[#1C1B23] rounded-md shadow-lg z-50 border border-gray-700 overflow-hidden">
                <div className="py-2">
                  <div className="px-4 py-2 border-b border-gray-700">
                    <p className="text-sm font-medium text-gray-300">{user?.displayName || 'User'}</p>
                    <p className="text-xs text-gray-500 truncate">{user?.email}</p>
                  </div>
                  
                  <a href="/profile" className="block px-4 py-2 text-sm text-gray-400 hover:bg-gray-800 flex items-center">
                    <FaUserCog className="mr-2" />
                    Profile Settings
                  </a>
                  
                  <button 
                    onClick={handleLogout}
                    className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-gray-800 flex items-center"
                  >
                    <FaSignOutAlt className="mr-2" />
                    Logout
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
