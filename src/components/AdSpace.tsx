'use client';

import React, { useState, useEffect } from 'react';

interface AdSpaceProps {
  type?: 'banner' | 'sidebar' | 'portrait';
  className?: string;
}

const FUN_MESSAGES = [
  "This ad just paid for 5 seconds of your movie! 🍿",
  "Ads: The salt on our popcorn. They keep the servers running! 🚀",
  "Helping us keep the lights on, one click at a time. ✨",
  "A tiny ad for a giant cinema experience. Thanks for your support! 🎬",
  "Keepin' it free, keepin' it minimalist. Enjoy the show! 💎"
];

const AdSpace = ({ type = 'banner', className = '' }: AdSpaceProps) => {
  const [msg, setMsg] = useState(FUN_MESSAGES[0]);

  useEffect(() => {
    // Pick a random fun message for each mount
    setMsg(FUN_MESSAGES[Math.floor(Math.random() * FUN_MESSAGES.length)]);
  }, []);

  return (
    <div className={`relative flex items-center justify-center bg-white/[0.02] border border-white/5 rounded-3xl overflow-hidden group transition-all hover:border-white/10 ${className} ${
      type === 'banner' ? 'w-full h-32 md:h-48' : 
      type === 'sidebar' ? 'w-full aspect-[4/5]' : 
      'w-full min-h-[500px] h-full'
    }`}>
      {/* Decorative Background grid */}
      <div className="absolute inset-0 opacity-10" 
           style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.1) 1px, transparent 0)', backgroundSize: '24px 24px' }} 
      />
      
      <div className="relative text-center space-y-2 p-6">
        <div className="inline-block px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[10px] font-bold uppercase tracking-widest text-white/40 group-hover:text-white/60 transition-colors">
          Advertisement
        </div>
        <div className="text-muted text-sm font-medium">Your Ad Here</div>
        <p className="text-[10px] text-muted/50 max-w-[200px] mx-auto group-hover:text-muted/70 transition-colors">
          {msg}
        </p>
      </div>

      {/* Shine effect */}
      <div className="absolute inset-0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000 ease-in-out bg-gradient-to-r from-transparent via-white/[0.03] to-transparent pointer-events-none" />
    </div>
  );
};

export default AdSpace;
