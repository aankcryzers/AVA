import React from 'react';

const SidebarButton = ({ onClick, children, isActive }) => (
  <button
    onClick={onClick}
    className={`w-full text-left px-4 py-3 my-1 rounded-lg transition-colors duration-200 ${
      isActive ? 'bg-blue-600 text-white' : 'hover:bg-gray-700'
    }`}
  >
    {children}
  </button>
);

export default SidebarButton;