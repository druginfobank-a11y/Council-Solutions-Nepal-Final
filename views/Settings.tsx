import React, { useState, useEffect } from 'react';
import * as ReactRouter from 'react-router-dom';
import { auth, db } from '../services/firebase';
import { sendPasswordResetEmail, signOut, deleteUser } from 'firebase/auth';
import { doc, deleteDoc, getDoc } from 'firebase/firestore';
import { SystemSettings } from '../types';
import { ensureExternalLink } from '../services/storageService';

const { useNavigate } = ReactRouter as any;

const Settings: React.FC = () => {
  const navigate = useNavigate();
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'));
  const [sysConfig, setSysConfig] = useState<Partial<SystemSettings>>({});
  const [prefs, setPrefs] = useState({
    highYield: true,
    alerts: true
  });

  useEffect(() => {
    const fetchConfig = async () => {
      const snap = await getDoc(doc(db, 'system', 'config'));
      if (snap.exists()) setSysConfig(snap.data());
    };
    fetchConfig();
  }, []);

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('csn_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('csn_theme', 'light');
    }
  }, [isDark]);

  const handlePasswordReset = async () => {
    if (auth.currentUser?.email) {
      try {
        await sendPasswordResetEmail(auth, auth.currentUser.email);
        alert(`Recovery key dispatched to ${auth.currentUser.email}. Check your inbox.`);
      } catch (e) {
        alert("Node failure: Could not send recovery link.");
      }
    }
  };

  const handleLogout = async () => {
    if (confirm("Terminate active academic session?")) {
      await signOut(auth);
      navigate('/auth');
    }
  };

  const handleDeleteAccount = async () => {
    const user = auth.currentUser;
    if (!user) return;

    const confirmDel = confirm("CRITICAL ACTION: This will permanently purge your academic record, evaluation history, and data node from the CSN cloud. This cannot be undone. Proceed?");
    if (!confirmDel) return;

    try {
      // 1. Delete Firestore Data Node
      await deleteDoc(doc(db, 'users', user.uid));
      // 2. Delete Auth Node
      await deleteUser(user);
      alert("Terminal Session Purged Successfully.");
      navigate('/auth');
    } catch (e: any) {
      alert("SECURITY BLOCK: You must have a recent login session to perform this action. Please log out and log back in before purging node.");
    }
  };

  const handleOpenLegal = (url: string | undefined, type: 'privacy' | 'terms') => {
    if (url) {
      navigate(`/legal/${type}`);
    } else {
      alert(`The ${type === 'privacy' ? 'Privacy Policy' : 'Terms of Service'} link has not been configured in the system node yet.`);
    }
  };

  const ControlCard = ({ label, desc, active, onToggle, icon }: { label: string, desc: string, active: boolean, onToggle: () => void, icon: string }) => (
    <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-6 md:p-8 rounded-[32px] md:rounded-[40px] flex items-center justify-between shadow-sm hover:shadow-md transition-all group">
      <div className="flex items-center gap-5">
        <div className="w-12 h-12 bg-slate-50 dark:bg-slate-800 rounded-2xl flex items-center justify-center text-xl shadow-inner group-hover:scale-110 transition-transform">
          {icon}
        </div>
        <div>
          <h3 className="text-sm md:text-base font-black text-slate-900 dark:text-white uppercase tracking-tight">{label}</h3>
          <p className="text-[9px] md:text-[10px] font-bold text-slate-500 dark:text-slate-300 uppercase tracking-widest mt-1">{desc}</p>
        </div>
      </div>
      <button 
        onClick={onToggle}
        className={`w-14 h-8 rounded-full p-1.5 transition-all duration-300 relative overflow-hidden ${active ? 'bg-blue-600 shadow-lg shadow-blue-500/20' : 'bg-slate-200 dark:bg-slate-800'}`}
      >
        <div className={`w-5 h-5 bg-white rounded-full shadow-md transition-transform duration-300 ${active ? 'translate-x-6' : 'translate-x-0'}`}></div>
      </button>
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto py-6 md:py-12 space-y-10 md:space-y-14 pb-32 animate-in">
      <header className="px-2">
        <p className="text-blue-600 dark:text-blue-400 text-[10px] font-black uppercase tracking-[0.4em] mb-2">Terminal Configuration</p>
        <h1 className="text-4xl md:text-6xl font-black uppercase tracking-tighter text-slate-900 dark:text-white leading-none">Settings</h1>
        <p className="text-slate-500 dark:text-slate-300 font-bold uppercase text-[11px] tracking-widest mt-3 opacity-60">Personalize your academic workspace.</p>
      </header>

      <div className="space-y-6">
        <div className="space-y-4">
          <p className="text-[9px] font-black text-slate-500 dark:text-slate-300 uppercase tracking-widest ml-6">Display & Logic</p>
          <ControlCard label="Dark Mode" desc="OLED-optimized visualization" icon="🌙" active={isDark} onToggle={() => setIsDark(!isDark)} />
          <ControlCard label="High-Yield Focus" desc="Prioritize exam-critical data" icon="🎯" active={prefs.highYield} onToggle={() => setPrefs({...prefs, highYield: !prefs.highYield})} />
        </div>

        <div className="space-y-4 pt-4">
          <p className="text-[9px] font-black text-slate-500 dark:text-slate-300 uppercase tracking-widest ml-6">Security & Node Data</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button onClick={handlePasswordReset} className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-8 rounded-[32px] md:rounded-[40px] text-center hover:bg-blue-600 hover:text-white group transition-all text-slate-900 dark:text-white">
              <div className="text-2xl mb-3 group-hover:scale-125 transition-transform">🔐</div>
              <p className="text-[10px] font-black uppercase tracking-widest">Reset Credentials</p>
            </button>
            <button onClick={handleLogout} className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-8 rounded-[32px] md:rounded-[40px] text-center hover:bg-blue-600 hover:text-white group transition-all text-slate-900 dark:text-white">
              <div className="text-2xl mb-3 group-hover:scale-125 transition-transform">🚪</div>
              <p className="text-[10px] font-black uppercase tracking-widest">Terminate Session</p>
            </button>
          </div>
          <button onClick={handleDeleteAccount} className="w-full bg-red-600/5 hover:bg-red-600 text-red-600 hover:text-white border border-red-100 dark:border-red-900/30 p-5 rounded-2xl font-black uppercase text-[9px] tracking-[0.2em] transition-all">
             Purge Node & Delete Account (Play Store Compliance)
          </button>
        </div>

        <div className="space-y-4 pt-4">
          <p className="text-[9px] font-black text-slate-500 dark:text-slate-300 uppercase tracking-widest ml-6">Legal & Governance</p>
          <div className="flex gap-2">
             <button onClick={() => handleOpenLegal(sysConfig.privacyPolicyUrl, 'privacy')} className="flex-1 py-4 bg-slate-50 dark:bg-slate-950 hover:bg-blue-50 dark:hover:bg-blue-900/10 rounded-xl text-[9px] font-black uppercase dark:text-slate-400 transition-all">Privacy Policy</button>
             <button onClick={() => handleOpenLegal(sysConfig.termsOfServiceUrl, 'terms')} className="flex-1 py-4 bg-slate-50 dark:bg-slate-950 hover:bg-blue-50 dark:hover:bg-blue-900/10 rounded-xl text-[9px] font-black uppercase dark:text-slate-400 transition-all">Terms of Use</button>
          </div>
        </div>
      </div>

      <footer className="text-center pt-10 opacity-30">
        <div className="inline-flex items-center gap-3 bg-slate-100 dark:bg-slate-800/50 px-6 py-2 rounded-full border border-slate-200 dark:border-slate-800">
           <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
           <p className="text-[10px] font-black text-slate-500 dark:text-slate-300 uppercase tracking-widest">CSN STABLE v3.6.2 • NODE-ID: {auth.currentUser?.uid?.substring(0,8).toUpperCase()}</p>
        </div>
        <p className="mt-4 text-[8px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.4em]">Official Council Node Nepal</p>
      </footer>
    </div>
  );
};

export default Settings;