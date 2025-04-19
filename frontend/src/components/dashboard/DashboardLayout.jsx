import React, { useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import Navbar from './Navbar';
import Sidebar from './Sidebar';
import Command from './Command';

const DashboardLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  
  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  return (
    <div className="flex h-screen bg-black text-gray-100">
      <Sidebar isOpen={sidebarOpen} />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <Navbar toggleSidebar={toggleSidebar} />
        
        <main className="flex-1 overflow-y-auto p-4">
          <Routes>
            <Route path="/commands" element={<Command />} />
          </Routes>
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;