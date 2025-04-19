import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { FaChartPie, FaWhatsapp, FaTerminal, FaCamera, FaCog, FaInfoCircle, FaRobot } from 'react-icons/fa';

const Sidebar = ({ isOpen }) => {
  const location = useLocation();
  
  const menuItems = [
    { name: 'Dashboard', icon: <FaChartPie />, path: '/analytics' },
    { name: 'WhatsApp', icon: <FaWhatsapp />, path: '/whatsapp' },
    { name: 'Commands', icon: <FaTerminal />, path: '/commands' },
    // { name: 'Screenshots', icon: <FaCamera />, path: '/screenshots' },
    { name: 'faqs', icon: <FaInfoCircle />, path: '/faqs' },
    { name: 'Multimodal Agent', icon: <FaRobot />, path: '/multimodal-agent' },
  ];
  
  return (
    <div className={`bg-black border-r border-gray-700 transition-all duration-300 ${isOpen ? 'w-48 md:w-56 lg:w-64' : 'w-16 md:w-20'} flex-shrink-0`}>
      <div className="py-4 overflow-y-auto h-full">
        <ul className="space-y-2 px-3">
          {menuItems.map((item) => (
            <li key={item.name}>
              <Link
                to={item.path}
                className={`flex items-center p-3 rounded-lg transition-colors duration-200 ${
                  location.pathname === item.path 
                    ? 'bg-[#212121] text-indigo-300' 
                    : 'text-gray-400 hover:bg-gray-700/50 hover:text-white'
                }`}
              >
                <div className={`text-xl ${!isOpen ? 'mx-auto' : ''}`}>{item.icon}</div>
                {isOpen && <span className="ml-3 truncate">{item.name}</span>}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default Sidebar;
