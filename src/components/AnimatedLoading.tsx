import React from 'react';

export const AnimatedLoading = ({ size = "w-20 h-20" }: { size?: string }) => (
  <div className={`relative flex items-center justify-center ${size}`}>
    {/* A nice CSS/SVG based animated loader that feels like a GIF */}
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" className="w-full h-full text-indigo-600 dark:text-indigo-400">
      <circle cx="50" cy="50" r="40" stroke="currentColor" strokeWidth="8" fill="none" opacity="0.2" />
      <circle cx="50" cy="50" r="40" stroke="currentColor" strokeWidth="8" fill="none" strokeLinecap="round">
        <animate attributeName="stroke-dashoffset" dur="2s" repeatCount="indefinite" from="0" to="502" />
        <animate attributeName="stroke-dasharray" dur="2s" repeatCount="indefinite" values="150.6 100.4;1 250;150.6 100.4" />
        <animateTransform attributeName="transform" type="rotate" dur="2s" repeatCount="indefinite" from="0 50 50" to="360 50 50" />
      </circle>
      <circle cx="50" cy="50" r="20" fill="currentColor" opacity="0.8">
        <animate attributeName="r" dur="2s" repeatCount="indefinite" values="18;24;18" />
        <animate attributeName="opacity" dur="2s" repeatCount="indefinite" values="0.5;1;0.5" />
      </circle>
    </svg>
  </div>
);
