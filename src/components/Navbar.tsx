'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Search, Film, Tv, Home, User, LogOut, Bookmark, History, Menu, X, Sparkles, Users, ShieldCheck, MessageCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from './AuthProvider';
import NotificationBell from './NotificationBell';
import { getUnreadTotal, subscribeToMessages } from '@/lib/dm';
import { getIncomingRequestCount } from '@/lib/friends';

const Navbar = () => {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isAdmin, signOut } = useAuth();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [pendingRequests, setPendingRequests] = useState(0);
  const [unreadDms, setUnreadDms] = useState(0);

  // Refetched on mount and whenever the tab regains focus — a badge count
  // doesn't justify a realtime subscription, and coming back to the tab is
  // when a stale count would actually be noticed.
  useEffect(() => {
    if (!user) {
      setPendingRequests(0);
      return;
    }
    let cancelled = false;
    const refresh = async () => {
      try {
        const count = await getIncomingRequestCount();
        if (!cancelled) setPendingRequests(count);
      } catch {
        // Non-critical; leave the previous count rather than surfacing an error.
      }
    };
    refresh();
    window.addEventListener('focus', refresh);
    return () => {
      cancelled = true;
      window.removeEventListener('focus', refresh);
    };
  }, [user]);

  // Unread DMs. Unlike friend requests these arrive mid-session and are
  // worth showing immediately, so this one listens as well as refetching.
  useEffect(() => {
    if (!user) {
      setUnreadDms(0);
      return;
    }
    let cancelled = false;
    const refresh = async () => {
      try {
        const n = await getUnreadTotal();
        if (!cancelled) setUnreadDms(n);
      } catch {
        // Non-critical; keep the previous count.
      }
    };
    refresh();
    const unsubscribe = subscribeToMessages(() => refresh());
    window.addEventListener('focus', refresh);
    return () => {
      cancelled = true;
      unsubscribe();
      window.removeEventListener('focus', refresh);
    };
  }, [user]);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
      setIsSearchExpanded(false);
      setSearchQuery('');
    }
  };

  const navLinks = [
    { name: 'Home', href: '/', icon: Home, badge: 0 },
    { name: 'Movies', href: '/movies', icon: Film, badge: 0 },
    { name: 'TV Shows', href: '/tv', icon: Tv, badge: 0 },
    { name: 'Anime', href: '/anime', icon: Sparkles, badge: 0 },
    // Always shown, signed in or not: hiding it made the social side of
    // the app invisible to anyone logged out. The page itself renders a
    // sign-in prompt rather than an error.
    { name: 'Friends', href: '/friends', icon: Users, badge: user ? pendingRequests : 0 },
  ];

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
      isScrolled ? 'py-4 bg-black/80 backdrop-blur-xl border-b border-white/5' : 'py-6 bg-gradient-to-b from-black/95 via-black/60 to-transparent'
    }`}>
      <div className="container mx-auto px-6 grid grid-cols-2 lg:grid-cols-3 items-center">
        {/* Logo (Left side) */}
        <div className="flex items-center">
          <Link href="/" className="flex items-center space-x-2 group">
            <div className="w-10 h-10 bg-accent rounded-xl flex items-center justify-center text-white shadow-lg shadow-accent/20 group-hover:scale-105 transition-transform">
              <Film size={20} />
            </div>
            <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent hidden sm:inline-block">
              CineMinimal
            </span>
          </Link>
        </div>

        {/* Desktop Navigation (Centered) */}
        <div className="hidden lg:flex items-center justify-center space-x-8">
          {navLinks.map((link) => (
            <Link
              key={link.name}
              href={link.href}
              className={`text-sm font-medium transition-colors hover:text-accent flex items-center space-x-2 ${
                pathname === link.href ? 'text-accent' : 'text-white/70'
              }`}
            >
              <link.icon size={16} />
              <span>{link.name}</span>
              {link.badge > 0 && (
                <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-accent text-white text-[10px] font-bold flex items-center justify-center">
                  {link.badge > 9 ? '9+' : link.badge}
                </span>
              )}
            </Link>
          ))}
        </div>

        {/* Search & Actions (Right side) */}
        <div className="flex items-center justify-end space-x-4">
          <form 
            onSubmit={handleSearch}
            className={`relative flex items-center transition-all duration-300 ${isSearchExpanded ? 'w-full max-w-[300px]' : 'w-10'}`}
          >
            <input
              type="text"
              placeholder="Search movies, shows..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setIsSearchExpanded(true)}
              onBlur={() => !searchQuery && setIsSearchExpanded(false)}
              className={`w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-accent/50 transition-all ${
                isSearchExpanded ? 'opacity-100 pl-10' : 'opacity-0'
              }`}
            />
            <button
              type={isSearchExpanded ? 'submit' : 'button'}
              onClick={() => !isSearchExpanded && setIsSearchExpanded(true)}
              className={`absolute left-0 p-2 text-white/70 hover:text-accent transition-colors`}
            >
              <Search size={20} />
            </button>
            {isSearchExpanded && searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 text-white/40 hover:text-white"
              >
                <X size={14} />
              </button>
            )}
          </form>

          <div className="flex items-center space-x-4">
            {user && <NotificationBell />}
            {user ? (
              <div className="relative">
                <button
                  onClick={() => setIsProfileOpen(!isProfileOpen)}
                  className="w-10 h-10 rounded-full bg-accent/20 border border-accent/20 flex items-center justify-center text-accent hover:bg-accent/30 transition-all overflow-hidden"
                >
                  {user.user_metadata.avatar_url ? (
                    <img src={user.user_metadata.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <User size={20} />
                  )}
                </button>

                <AnimatePresence>
                  {isProfileOpen && (
                    <>
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-40"
                        onClick={() => setIsProfileOpen(false)}
                      />
                      <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        className="absolute right-0 mt-4 w-56 bg-card border border-white/10 rounded-2xl p-2 shadow-2xl z-50 backdrop-blur-xl"
                      >
                        <div className="px-3 py-2 border-b border-white/5 mb-2">
                          <p className="text-xs font-bold text-white/40 uppercase tracking-widest mb-1">Signed in as</p>
                          <p className="text-sm font-medium truncate">{user.email}</p>
                        </div>
                        <Link
                          href="/profile"
                          onClick={() => setIsProfileOpen(false)}
                          className="flex items-center space-x-3 px-3 py-2 rounded-xl text-sm hover:bg-white/5 transition-colors text-white/70 hover:text-white"
                        >
                          <User size={16} />
                          <span>Profile</span>
                        </Link>
                        <Link
                          href="/friends"
                          onClick={() => setIsProfileOpen(false)}
                          className="flex items-center space-x-3 px-3 py-2 rounded-xl text-sm hover:bg-white/5 transition-colors text-white/70 hover:text-white"
                        >
                          <Users size={16} />
                          <span className="flex-1">Friends</span>
                          {pendingRequests > 0 && (
                            <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-accent text-white text-[10px] font-bold flex items-center justify-center">
                              {pendingRequests > 9 ? '9+' : pendingRequests}
                            </span>
                          )}
                        </Link>
                        <Link
                          href="/messages"
                          onClick={() => setIsProfileOpen(false)}
                          className="flex items-center space-x-3 px-3 py-2 rounded-xl text-sm hover:bg-white/5 transition-colors text-white/70 hover:text-white"
                        >
                          <MessageCircle size={16} />
                          <span className="flex-1">Messages</span>
                          {unreadDms > 0 && (
                            <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-accent text-white text-[10px] font-bold flex items-center justify-center">
                              {unreadDms > 9 ? '9+' : unreadDms}
                            </span>
                          )}
                        </Link>
                        <Link
                          href="/watchlist"
                          onClick={() => setIsProfileOpen(false)}
                          className="flex items-center space-x-3 px-3 py-2 rounded-xl text-sm hover:bg-white/5 transition-colors text-white/70 hover:text-white"
                        >
                          <Bookmark size={16} />
                          <span>Watchlist</span>
                        </Link>
                        <Link
                          href="/history"
                          onClick={() => setIsProfileOpen(false)}
                          className="flex items-center space-x-3 px-3 py-2 rounded-xl text-sm hover:bg-white/5 transition-colors text-white/70 hover:text-white"
                        >
                          <History size={16} />
                          <span>History</span>
                        </Link>
                        {isAdmin && (
                          <Link
                            href="/admin"
                            onClick={() => setIsProfileOpen(false)}
                            className="flex items-center space-x-3 px-3 py-2 rounded-xl text-sm hover:bg-white/5 transition-colors text-accent"
                          >
                            <ShieldCheck size={16} />
                            <span>Moderation</span>
                          </Link>
                        )}
                        <button
                          onClick={() => {
                            signOut();
                            setIsProfileOpen(false);
                          }}
                          className="w-full flex items-center space-x-3 px-3 py-2 rounded-xl text-sm hover:bg-red-500/10 transition-colors text-red-400 mt-2"
                        >
                          <LogOut size={16} />
                          <span>Sign Out</span>
                        </button>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              <Link
                href="/login"
                className="bg-accent text-white px-4 py-2 rounded-xl text-sm font-bold shadow-lg shadow-accent/20 hover:scale-105 active:scale-95 transition-all whitespace-nowrap"
              >
                Sign In
              </Link>
            )}

            <button
              className="md:hidden text-white/70"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-black/90 backdrop-blur-2xl border-b border-white/10 overflow-hidden"
          >
            <div className="container mx-auto px-6 py-8 flex flex-col space-y-6">
              {navLinks.map((link) => (
                <Link
                  key={link.name}
                  href={link.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`text-lg font-bold flex items-center space-x-4 ${
                    pathname === link.href ? 'text-accent' : 'text-white/70'
                  }`}
                >
                  <link.icon size={24} />
                  <span>{link.name}</span>
                  {link.badge > 0 && (
                    <span className="min-w-[20px] h-[20px] px-1.5 rounded-full bg-accent text-white text-xs font-bold flex items-center justify-center">
                      {link.badge > 9 ? '9+' : link.badge}
                    </span>
                  )}
                </Link>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

export default Navbar;
