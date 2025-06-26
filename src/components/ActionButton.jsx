import React from 'react';

const ActionButton = ({ onClick, children, className = '' }) => (
  <button
    onClick={onClick}
    className={`w-full text-left p-3 my-1 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors duration-200 ${className}`}
  >
    {children}
  </button>
);

export default ActionButton;