import React from 'react';
import noTicketsBoy from '../assets/images/no_tickets_boy_1783673233424.jpg';

export const AnimatedNoTickets = ({ size = "w-40 h-40", message = "WE DON'T HAVE TICKETS BOSS! 🎉" }: { size?: string, message?: string }) => (
  <div className={`relative flex flex-col items-center justify-center ${size} mt-6`}>
    <div className="absolute -top-10 left-1/2 transform -translate-x-1/2 bg-white dark:bg-slate-800 border-2 border-indigo-200 dark:border-indigo-600 rounded-2xl px-5 py-2 shadow-xl z-10 whitespace-nowrap animate-bounce-slow">
      <p className="text-base font-black text-indigo-600 dark:text-indigo-400">
        {message}
      </p>
      {/* Speech bubble arrow */}
      <div className="absolute -bottom-2.5 left-1/2 transform -translate-x-1/2 w-4 h-4 bg-white dark:bg-slate-800 border-b-2 border-r-2 border-indigo-200 dark:border-indigo-600 rotate-45"></div>
    </div>

    <div className="relative w-full h-full p-2 mt-4">
      <img 
        src={noTicketsBoy} 
        alt="No Tickets Celebration" 
        className="w-full h-full object-contain mix-blend-multiply dark:opacity-80 rounded-2xl" 
        style={{ animation: 'dance 1.2s ease-in-out infinite' }}
      />
    </div>
    <style>{`
      @keyframes dance {
        0%, 100% { transform: translateY(0) rotate(-4deg) scale(1); }
        25% { transform: translateY(-12px) rotate(4deg) scale(1.05); }
        50% { transform: translateY(0) rotate(-4deg) scale(1); }
        75% { transform: translateY(-12px) rotate(4deg) scale(1.05); }
      }
      @keyframes bounce-slow {
        0%, 100% { transform: translate(-50%, 0); }
        50% { transform: translate(-50%, -6px); }
      }
      .animate-bounce-slow {
        animation: bounce-slow 2.5s ease-in-out infinite;
      }
    `}</style>
  </div>
);
