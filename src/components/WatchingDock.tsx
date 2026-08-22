'use client';

import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuth } from './AuthProvider';
import { useFriendsWatching, WatchingRow } from './WatchingNow';
import { Radio, X } from 'lucide-react';

/**
 * Floating "friends are watching" dock, bottom-right.
 *
 * Hidden entirely when nobody is watching, so it never sits there as an
 * empty box taking up a corner of every page.
 */
const WatchingDock = () => {
  const { user } = useAuth();
  const { watching } = useFriendsWatching();
  const [open, setOpen] = useState(false);

  if (!user || watching.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[60] flex flex-col items-end gap-3">
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className="w-72 max-w-[calc(100vw-3rem)] rounded-3xl bg-card border border-white/10 shadow-2xl overflow-hidden"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
              <p className="flex items-center gap-2 text-xs font-bold text-white">
                <Radio size={13} className="text-accent" />
                <span>Watching now</span>
              </p>
              <button
                onClick={() => setOpen(false)}
                className="p-1 rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition-colors"
              >
                <X size={14} />
              </button>
            </div>
            <div className="p-2 max-h-80 overflow-y-auto">
              {watching.map((w) => (
                <WatchingRow key={w.user_id} w={w} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 pl-3 pr-4 py-2.5 rounded-full bg-accent text-white shadow-2xl shadow-accent/30 hover:scale-105 active:scale-95 transition-transform"
        title={`${watching.length} friend${watching.length === 1 ? '' : 's'} watching`}
      >
        <span className="relative flex items-center justify-center w-4 h-4">
          <span className="absolute inset-0 rounded-full bg-white/40 animate-ping" />
          <span className="relative w-2 h-2 rounded-full bg-white" />
        </span>
        <span className="text-xs font-bold">{watching.length} watching</span>
      </button>
    </div>
  );
};

export default WatchingDock;
