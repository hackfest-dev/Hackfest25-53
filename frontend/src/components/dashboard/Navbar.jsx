import React from 'react';
import { FaBars, FaUserCircle } from 'react-icons/fa';

const Navbar = ({ user, toggleSidebar }) => {
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
          <div className="relative">
            <div className="flex items-center space-x-3 cursor-pointer">
              <span className="text-sm hidden md:block">{user?.displayName || user?.email || 'User'}</span>
              {user?.photoURL ? (
                <img 
                  src={user.photoURL} 
                  alt="Profile" 
                  className="h-8 w-8 rounded-full"
                />
              ) : (
                <FaUserCircle className="h-8 w-8 text-gray-400" />
              )}
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
