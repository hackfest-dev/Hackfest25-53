import React, { useState } from 'react';
import { FaChevronDown, FaChevronUp, FaQuestionCircle } from 'react-icons/fa';
import Navbar from './Navbar';
import Sidebar from './Sidebar';
import { useLocation } from 'react-router-dom';

// Custom scrollbar styles (similar to other components)
const scrollbarStyles = `
  .faq-scroll::-webkit-scrollbar {
    width: 4px;
    background: transparent;
  }
  
  .faq-scroll::-webkit-scrollbar-thumb {
    background: rgba(76, 61, 139, 0.5);
    border-radius: 4px;
  }
  
  .faq-scroll::-webkit-scrollbar-thumb:hover {
    background: rgba(94, 78, 153, 0.7);
  }
  
  .faq-scroll::-webkit-scrollbar-track {
    background: #1a1a1a;
    border-radius: 4px;
  }
  
  .faq-scroll {
    scrollbar-width: thin;
    scrollbar-color: rgba(76, 61, 139, 0.5) transparent;
  }
`;

// FAQ data
const faqData = [
  {
    id: 1,
    question: "What is Axentis?",
    answer: "Axentis is an AI-powered personal assistant platform that helps you manage your digital life. It combines productivity tracking, calendar management, communication tools, and an AI command terminal to automate tasks and provide insights into your digital activities."
  },
  {
    id: 2,
    question: "How do I connect my Google Calendar?",
    answer: "You can connect your Google Calendar by clicking on the 'Schedule' button in the Command terminal or by going to the Dashboard's Upcoming Events widget and clicking 'Connect Google Calendar'. You'll be prompted to authorize access to your Google account."
  },
  {
    id: 3,
    question: "What can I do with the AI Command terminal?",
    answer: "The AI Command terminal allows you to issue natural language commands to complete various tasks. For example, you can ask it to schedule meetings, summarize emails, look up information, or automate repetitive tasks. Just type your request and the AI will process it accordingly."
  },
  {
    id: 4,
    question: "How does time tracking work?",
    answer: "Axentis automatically tracks the time you spend on different applications and websites (with your permission). This data is categorized and visualized in the Dashboard, helping you understand how you spend your digital time and identify productivity patterns."
  },
  {
    id: 5,
    question: "Can I integrate Axentis with WhatsApp?",
    answer: "Yes, Axentis offers WhatsApp integration that allows you to manage messages and automate responses. You can set up the integration in the WhatsApp section of the dashboard and configure automated workflows based on incoming messages."
  },
  {
    id: 6,
    question: "How secure is my data with Axentis?",
    answer: "Axentis takes security seriously. All data is encrypted in transit and at rest. You maintain full control over your data and can delete it at any time. We only process the information necessary for the features you actively use, and we never sell your data to third parties."
  },
  {
    id: 7,
    question: "Can I customize the dashboard?",
    answer: "Currently, the dashboard layout is fixed, but we're working on customization options for a future update. You'll soon be able to rearrange widgets, customize colors, and hide sections you don't use frequently."
  },
  {
    id: 8,
    question: "What should I do if I encounter an error?",
    answer: "If you encounter an error, first try refreshing the page. If the problem persists, check your internet connection and make sure you're using a supported browser (Chrome, Firefox, Safari, or Edge). For persistent issues, click on the Support button in the bottom left corner to report the problem."
  },
  {
    id: 9,
    question: "Is Axentis available on mobile devices?",
    answer: "Currently, Axentis works best on desktop browsers. We're developing native mobile apps for iOS and Android that will be available in the coming months, offering a fully responsive experience optimized for mobile devices."
  },
  {
    id: 10,
    question: "How do I cancel my subscription?",
    answer: "You can manage your subscription from the Account Settings page. Click on your profile picture in the top right corner, select 'Profile Settings', then navigate to the 'Subscription' tab. From there, you can modify or cancel your subscription at any time."
  }
];

// FAQ Item component
const FAQItem = ({ faq, isOpen, toggleOpen }) => {
  return (
    <div className="mb-4 border border-gray-700 rounded-lg overflow-hidden bg-[#1a1a1a]">
      <button
        className="w-full px-6 py-4 text-left flex justify-between items-center focus:outline-none"
        onClick={toggleOpen}
      >
        <span className="text-gray-200 font-medium">{faq.question}</span>
        {isOpen ? <FaChevronUp className="text-gray-400" /> : <FaChevronDown className="text-gray-400" />}
      </button>
      
      {isOpen && (
        <div className="px-6 py-4 border-t border-gray-700 bg-[#121212]">
          <p className="text-gray-300">{faq.answer}</p>
        </div>
      )}
    </div>
  );
};

const FAQ = () => {
  const location = useLocation();
  const [openFAQs, setOpenFAQs] = useState([1]); // Open first FAQ by default
  const [searchQuery, setSearchQuery] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(location.pathname === '/analytics');
  
  const toggleSidebar = () => {
    setSidebarOpen(prev => !prev);
  };
  
  const toggleFAQ = (id) => {
    if (openFAQs.includes(id)) {
      setOpenFAQs(openFAQs.filter(faqId => faqId !== id));
    } else {
      setOpenFAQs([...openFAQs, id]);
    }
  };
  
  // Filter FAQs based on search query
  const filteredFAQs = faqData.filter(faq => 
    faq.question.toLowerCase().includes(searchQuery.toLowerCase()) || 
    faq.answer.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  return (
    <div className="h-screen flex flex-col bg-black">
      <style>{scrollbarStyles}</style>
      <Navbar toggleSidebar={toggleSidebar} />
      
      <div className="flex flex-1 overflow-hidden">
        <Sidebar isOpen={sidebarOpen} />
        
        <div className="flex-1 overflow-hidden bg-black">
          <div className="p-6 flex flex-col h-full">
            <div className="flex items-center mb-6">
              <FaQuestionCircle className="text-3xl text-purple-400 mr-3" />
              <h1 className="text-2xl font-bold text-white">Frequently Asked Questions</h1>
            </div>
            
            <div className="mb-6">
              <input
                type="text"
                placeholder="Search FAQs..."
                className="w-full px-4 py-3 bg-[#1a1a1a] border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            
            <div className="flex-1 overflow-hidden relative">
              <div className="h-full overflow-y-auto faq-scroll pr-2 pb-24">
                {filteredFAQs.length > 0 ? (
                  filteredFAQs.map(faq => (
                    <FAQItem
                      key={faq.id}
                      faq={faq}
                      isOpen={openFAQs.includes(faq.id)}
                      toggleOpen={() => toggleFAQ(faq.id)}
                    />
                  ))
                ) : (
                  <div className="text-center py-10 text-gray-400">
                    <FaQuestionCircle className="text-5xl mx-auto mb-4 opacity-50" />
                    <p>No FAQs matching your search.</p>
                    <button 
                      className="mt-4 px-4 py-2 bg-purple-600 rounded-md text-white hover:bg-purple-700 transition-colors"
                      onClick={() => setSearchQuery('')}
                    >
                      Clear Search
                    </button>
                  </div>
                )}
              </div>
              
              {/* Fade overlay */}
              <div 
                className="absolute bottom-0 left-0 right-0 h-24 pointer-events-none" 
                style={{
                  background: 'linear-gradient(to bottom, rgba(0, 0, 0, 0), rgba(0, 0, 0, 1) 85%)'
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FAQ;
