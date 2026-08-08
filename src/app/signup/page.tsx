'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Film, Mail, Lock, User, ArrowRight, Loader2, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          display_name: fullName,
        },
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      router.push('/login');
      router.refresh();
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-32">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-accent/10 rounded-full blur-[128px]" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent/5 rounded-full blur-[128px]" />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md relative z-10"
      >
        <div className="bg-card border border-white/10 rounded-[32px] p-8 md:p-10 shadow-2xl backdrop-blur-xl">
          <div className="text-center mb-10">
            <Link href="/" className="inline-flex items-center space-x-2 mb-6 group">
              <div className="w-12 h-12 bg-accent rounded-2xl flex items-center justify-center text-white shadow-xl shadow-accent/20 group-hover:scale-110 transition-transform">
                <Film size={24} />
              </div>
            </Link>
            <h1 className="text-3xl font-bold text-white tracking-tight mb-2">Create Account</h1>
            <p className="text-muted text-sm">Join CineMinimal to track your movies and TV shows.</p>
          </div>

          <form onSubmit={handleSignup} className="space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-white/40 uppercase tracking-[0.2em] ml-1">Full Name</label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" size={18} />
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="John Doe"
                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white text-sm focus:border-accent focus:bg-white/[0.08] transition-all outline-none"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-white/40 uppercase tracking-[0.2em] ml-1">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" size={18} />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="john@example.com"
                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white text-sm focus:border-accent focus:bg-white/[0.08] transition-all outline-none"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-white/40 uppercase tracking-[0.2em] ml-1">Password</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" size={18} />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white text-sm focus:border-accent focus:bg-white/[0.08] transition-all outline-none"
                  />
                </div>
              </div>
            </div>

            {error && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-start space-x-3 text-red-400 text-sm"
              >
                <AlertCircle size={18} className="shrink-0 mt-0.5" />
                <span>{error}</span>
              </motion.div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="group relative w-full bg-accent hover:bg-accent/90 disabled:bg-accent/50 text-white py-4 rounded-2xl font-bold tracking-widest uppercase text-xs shadow-xl shadow-accent/20 transition-all active:scale-[0.98] overflow-hidden"
            >
              <span className="relative z-10 flex items-center justify-center">
                {loading ? (
                  <Loader2 className="animate-spin" size={20} />
                ) : (
                  <>
                    Sign Up
                    <ArrowRight size={18} className="ml-2 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </span>
              <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
            </button>
          </form>

          <p className="text-center mt-10 text-muted text-sm">
            Already have an account?{' '}
            <Link href="/login" className="text-white font-bold hover:text-accent transition-colors">Sign in</Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
