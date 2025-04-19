import React, { useMemo } from 'react';
import { Pie } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';

// Register the required chart components
ChartJS.register(ArcElement, Tooltip, Legend);

const CategoryBreakdown = ({ data }) => {
  const chartData = useMemo(() => {
    // Count activities by category
    const categoryCount = data.reduce((acc, item) => {
      acc[item.category] = (acc[item.category] || 0) + 1;
      return acc;
    }, {});
    
    // Generate dark purple-themed colors for each category
    const colors = Object.keys(categoryCount).map((_, index) => {
      // Create different shades of purple that work on dark backgrounds
      const purpleShades = [
        'rgba(149, 128, 255, 0.7)',
        'rgba(128, 90, 213, 0.7)',
        'rgba(168, 130, 255, 0.7)',
        'rgba(106, 90, 205, 0.7)',
        'rgba(138, 118, 223, 0.7)',
        'rgba(122, 104, 220, 0.7)',
        'rgba(147, 112, 219, 0.7)',
        'rgba(154, 136, 255, 0.7)',
      ];
      
      return purpleShades[index % purpleShades.length];
    });
    
    return {
      labels: Object.keys(categoryCount),
      datasets: [
        {
          data: Object.values(categoryCount),
          backgroundColor: colors,
          borderColor: '#0A0A0A',
          borderWidth: 1,
        },
      ],
    };
  }, [data]);
  
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false, // Hide the legend completely
      },
      tooltip: {
        enabled: true, // Ensure tooltips are enabled
        backgroundColor: 'rgba(20, 20, 20, 0.95)',
        titleColor: '#d1d1d1',
        bodyColor: '#b0b0b0',
        borderColor: 'rgba(70, 70, 70, 0.3)',
        borderWidth: 1,
        padding: 12,
        displayColors: true,
        callbacks: {
          title: function(tooltipItems) {
            return tooltipItems[0].label; // Make sure the category name appears as title
          },
          label: function(context) {
            const label = context.label || '';
            const value = context.raw || 0;
            const total = context.dataset.data.reduce((a, b) => a + b, 0);
            const percentage = ((value / total) * 100).toFixed(1);
            return `${value} activities (${percentage}%)`;
          }
        }
      }
    },
    cutout: '40%',
    elements: {
      arc: {
        borderWidth: 1,
        borderColor: '#0A0A0A'
      }
    }
  };
  
  return (
    <div className="bg-[#121212] text-gray-300 relative rounded-lg overflow-hidden h-full flex flex-col"
    style={{
      border: '0.5px solid #4B5563',
    }}>
      <div className="text-gray-300 text-sm font-medium pb-2 px-4 pt-3 bg-[#1C1B23] rounded-t-lg">CATEGORY BREAKDOWN</div>
      <div className="flex-1 flex items-center justify-center px-4">
        {data.length > 0 ? (
          <div className="w-full h-full flex items-center justify-center" style={{ maxHeight: "calc(100% - 60px)" }}>
            <Pie data={chartData} options={options} />
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-600">
            No category data available
          </div>
        )}
      </div>
    </div>
  );
};

export default CategoryBreakdown;
