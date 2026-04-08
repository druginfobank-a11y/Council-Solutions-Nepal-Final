
import React, { useState, useEffect, useRef } from 'react';
import * as ReactRouter from 'react-router-dom';
import { ICONS } from '../constants';
import Watermark from './Watermark';
import { User, UserRole, SystemSettings } from '../types';
import { db } from '../services/firebase';
import { collection, query, where, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { sanitizeUrl } from '../services/storageService';

import GovernmentDisclaimer from './GovernmentDisclaimer';

const { NavLink, Outlet, useNavigate, useLocation } = ReactRouter as any;

interface LayoutProps {
  user: User;
  onLogout: () => void;
}

interface Notification {
  id: string;
  type: 'identity' | 'quiz' | 'library' | 'payment';
  message: string;
  count: number;
}

const ActionToast: React.FC<{ notification: Notification; onDismiss: () => void; onAction: () => void }> = ({ notification, onDismiss, onAction }) => (
  <div className="fixed top-6 right-6 z-[3000] w-full max-w-sm animate-in fade-in slide-in-from-right-4 duration-500">
    <div className="bg-slate-900/90 backdrop-blur-2xl border border-blue-500/30 p-6 rounded-[32px] shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex items-center gap-5 relative overflow-hidden group">
      <div className="absolute top-0 left-0 w-1 h-full bg-blue-600"></div>
      <div className="w-12 h-12 bg-blue-600/10 rounded-2xl flex items-center justify-center text-2xl shrink-0">
        {notification.type === 'payment' ? '💰' : notification.type === 'identity' ? '🆔' : '📄'}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-1">Administrative Alert</p>
        <p className="text-white text-sm font-bold leading-tight truncate">{notification.message}</p>
        <button onClick={onAction} className="mt-3 text-[9px] font-black text-blue-400 uppercase tracking-widest hover:underline">Manage Node</button>
      </div>
      <button onClick={onDismiss} className="w-8 h-8 rounded-xl hover:bg-white/5 flex items-center justify-center text-slate-500 transition-colors">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18 6L6 18M6 6l12 12"/></svg>
      </button>
    </div>
  </div>
);


const Layout: React.FC<LayoutProps> = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [pendingTotal, setPendingTotal] = useState(0);
  const [sysConfig, setSysConfig] = useState<Partial<SystemSettings>>({});
  const [isConfigLoaded, setIsConfigLoaded] = useState(false);
  const [activeNotification, setActiveNotification] = useState<Notification | null>(null);
  const prevCountsRef = useRef<number[]>([0, 0, 0, 0]);

  // FULL SCREEN DETECTION NODE
  const isQuizHubActive = location.pathname === '/quiz';
  const isLegalActive = location.pathname.startsWith('/legal');

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const snap = await getDoc(doc(db, 'system', 'config'));
        if (snap.exists()) setSysConfig(snap.data());
      } finally { setIsConfigLoaded(true); }
    };
    fetchConfig();

    if (!user || user.role !== UserRole.ADMIN) {
      setPendingTotal(0);
      return;
    }

    const unsubscribes: (() => void)[] = [];
    const queries = [
      query(collection(db, 'users'), where('role', '==', UserRole.INSTRUCTOR), where('isVerified', '==', false)),
      query(collection(db, 'quizzes'), where('status', '==', 'pending')),
      query(collection(db, 'materials'), where('status', '==', 'pending')),
      query(collection(db, 'payments'), where('status', '==', 'pending'))
    ];
    const types: ('identity' | 'quiz' | 'library' | 'payment')[] = ['identity', 'quiz', 'library', 'payment'];
    const labels = ['Instructor Verifications', 'Quiz Submissions', 'Library Assets', 'Payment Requests'];
    const currentCounts = [0, 0, 0, 0];

    queries.forEach((q, idx) => {
      const unsub = onSnapshot(q, (snapshot) => {
          const newSize = snapshot.size;
          if (prevCountsRef.current[idx] > 0 && newSize > prevCountsRef.current[idx]) {
            setActiveNotification({ id: Math.random().toString(), type: types[idx], message: `${newSize - prevCountsRef.current[idx]} New ${labels[idx]} Detected`, count: newSize });
          }
          currentCounts[idx] = newSize;
          prevCountsRef.current[idx] = newSize;
          setPendingTotal(currentCounts.reduce((a, b) => a + b, 0));
        }, (error) => console.debug(`Handshake Deferred [Node ${idx}]`)
      );
      unsubscribes.push(unsub);
    });
    return () => unsubscribes.forEach(unsub => unsub());
  }, [user?.role, user?.id]);

  const getNavItems = () => {
    const common = [{ label: 'Dashboard', path: '/', icon: ICONS.Dashboard }, { label: 'Library', path: '/library', icon: ICONS.Library }];
    
    const isLocked = !user.intelligenceApproved && user.role !== UserRole.ADMIN;
    
    const lockedIcon = (Icon: any) => (props: any) => (
      <div className="relative">
        <Icon {...props} />
        {isLocked && (
          <div className="absolute -top-1 -right-1 bg-slate-900 rounded-full p-0.5 border border-white/10">
            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="4"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          </div>
        )}
      </div>
    );

    if (user.role === UserRole.STUDENT) {
      return [
        ...common, 
        { label: 'Quiz', path: '/quiz', icon: ICONS.Quiz }, 
        { label: 'Intelligence', path: '/tutor', icon: lockedIcon(ICONS.Tutor) }, 
        { label: 'Node', path: '/intelligence-node', icon: lockedIcon(ICONS.Brain) }
      ];
    }
    if (user.role === UserRole.INSTRUCTOR) {
      return [
        ...common, 
        { label: 'Instructor', path: '/instructor', icon: ICONS.Dashboard },
        { label: 'Quiz Hub', path: '/quiz', icon: ICONS.Quiz }, 
        { label: 'Intelligence', path: '/tutor', icon: lockedIcon(ICONS.Tutor) }
      ];
    }
    if (user.role === UserRole.ADMIN) {
      return [
        ...common, 
        { label: 'Quiz Hub', path: '/quiz', icon: ICONS.Quiz }, 
        { label: 'Admin', path: '/admin', icon: ICONS.Settings, badge: pendingTotal },
        { label: 'Intelligence', path: '/tutor', icon: ICONS.Tutor }
      ];
    }
    return common;
  };

  const handleNotificationAction = () => {
    if (!activeNotification) return;
    
    const tabMap: Record<string, string> = {
      identity: 'Identity',
      quiz: 'Quizzes',
      library: 'Library',
      payment: 'Finance'
    };
    
    const targetTab = tabMap[activeNotification.type] || 'Overview';
    navigate(`/admin?tab=${targetTab}`);
    setActiveNotification(null);
  };

  const moreItems = [{ label: 'My Profile', path: '/profile', icon: ICONS.Profile }, { label: 'Settings', path: '/settings', icon: ICONS.Settings }, ...(user.role === UserRole.STUDENT ? [{ label: 'Subscription', path: '/plans', icon: ICONS.Plans }] : [])];
  const navItems = getNavItems();
  
  useEffect(() => setIsMenuOpen(false), [location.pathname]);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-950 text-slate-900 dark:text-slate-50 relative transition-colors duration-500">
      <Watermark text={`${user.name} • ${user.role} • CPN`} />
      {activeNotification && (
        <ActionToast 
          notification={activeNotification} 
          onDismiss={() => setActiveNotification(null)} 
          onAction={handleNotificationAction} 
        />
      )}
      
      {/* SIDEBAR - CONDITIONALLY RENDERED */}
      {!isQuizHubActive && !isLegalActive && (
        <aside className="hidden md:flex flex-col w-72 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 p-8 shadow-sm z-30 h-full overflow-hidden shrink-0">
          <div className="mb-10 flex items-center gap-4 shrink-0">
            <div className="w-12 h-12 shrink-0">
              {!isConfigLoaded ? <div className="w-full h-full bg-slate-100 dark:bg-slate-800 rounded-2xl animate-pulse"></div> : sysConfig.logoUrl ? <img src={sanitizeUrl(sysConfig.logoUrl)} className="w-full h-full object-contain drop-shadow-md" alt="Logo" /> : <div className="w-full h-full bg-blue-600 rounded-2xl flex items-center justify-center font-black text-2xl shadow-xl text-white">C</div>}
            </div>
            <div className="flex flex-col"><span className="font-black text-sm tracking-tighter uppercase dark:text-white truncate">{sysConfig.platformName || 'Practice Node'}</span><span className="text-[8px] font-black text-amber-600 dark:text-amber-500 uppercase tracking-widest mt-1">Academic Practice Hub</span></div>
          </div>
          <nav className="flex-1 space-y-1.5 overflow-y-auto scrollbar-hide">
            {navItems.map((item) => (
              <NavLink key={item.path} to={item.path} className={({ isActive }: { isActive: boolean }) => `flex items-center gap-4 p-4 rounded-2xl transition-all duration-300 relative ${isActive ? 'bg-blue-600 text-white shadow-xl shadow-blue-600/20 scale-[1.03]' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                <item.icon className="w-5 h-5 shrink-0" /><span className="font-bold text-[13px] uppercase tracking-tight flex-1">{item.label}</span>
                {(item as any).badge !== undefined && (item as any).badge > 0 && <span className="bg-red-600 text-white text-[9px] font-black w-5 h-5 rounded-full flex items-center justify-center shadow-lg animate-in zoom-in">{(item as any).badge}</span>}
              </NavLink>
            ))}
            <div className="pt-8 mt-8 border-t border-slate-100 dark:border-slate-800 space-y-1.5">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.3em] mb-4 px-4">Node Management</p>
              {moreItems.map((item) => (
                <NavLink key={item.path} to={item.path} className={({ isActive }: { isActive: boolean }) => `flex items-center gap-4 p-4 rounded-2xl transition-all ${isActive ? 'text-blue-600 dark:text-blue-400 bg-blue-500/10' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                  <item.icon className="w-5 h-5 shrink-0" /><span className="font-bold text-[13px] uppercase tracking-tight">{item.label}</span>
                </NavLink>
              ))}
            </div>
            <GovernmentDisclaimer forceShow={sysConfig.showDisclaimers} />
          </nav>
          <button onClick={onLogout} className="mt-6 flex items-center gap-4 p-4 rounded-2xl text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 transition-all font-bold text-[13px] uppercase tracking-tight shrink-0 border-t border-slate-50 dark:border-slate-800"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg>Terminate Session</button>
        </aside>
      )}

      <main className={`flex-1 flex flex-col min-w-0 h-full overflow-hidden main-content-card bg-slate-50 dark:bg-slate-950 transition-all duration-500 ${isMenuOpen ? 'pushed' : ''}`}>
        {!isQuizHubActive && !isLegalActive && (
          <header className="md:hidden h-24 shrink-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-6 z-20 transition-colors">
            <div className="flex items-center gap-4">
               <div className="w-12 h-12 shadow-sm rounded-xl overflow-hidden bg-slate-50 dark:bg-slate-800 flex items-center justify-center border border-slate-100 dark:border-white/5">
                 {sysConfig.logoUrl ? <img src={sanitizeUrl(sysConfig.logoUrl)} className="w-full h-full object-contain" alt="Logo" /> : <div className="w-full h-full bg-blue-600 flex items-center justify-center font-black text-white text-xl">C</div>}
               </div>
               <div><span className="block font-black text-[12px] uppercase tracking-tighter dark:text-white truncate max-w-[160px] leading-tight">{sysConfig.platformName || 'Practice Node'}</span><span className="text-[7px] font-black text-amber-600 dark:text-amber-500 uppercase tracking-widest mt-1">Academic Practice Hub</span></div>
            </div>
            <div className="flex items-center gap-4">{user.role === UserRole.ADMIN && pendingTotal > 0 && <div className="w-8 h-8 bg-red-600 rounded-full flex items-center justify-center text-white text-[10px] font-black shadow-lg animate-pulse">{pendingTotal}</div>}<span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse border-2 border-white dark:border-slate-900"></span></div>
          </header>
        )}

        <div className={`flex-1 overflow-y-auto scroll-smooth scrollbar-hide ${isQuizHubActive || isLegalActive ? 'p-0 h-full w-full' : 'p-4 md:p-12'}`}>
          <Outlet />
          {!isQuizHubActive && !isLegalActive && (
            <div className="mt-12 pb-12 border-t border-slate-200 dark:border-slate-800 pt-12">
              <GovernmentDisclaimer forceShow={sysConfig.showDisclaimers} />
            </div>
          )}
        </div>

        {!isQuizHubActive && !isLegalActive && (
          <nav className="md:hidden h-20 shrink-0 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex items-center justify-around px-2 z-20 pb-safe shadow-[0_-10px_30px_rgba(0,0,0,0.05)]">
            {navItems.slice(0, 4).map((item) => (
              <NavLink key={item.path} to={item.path} className={({ isActive }: { isActive: boolean }) => `flex flex-col items-center gap-1.5 p-3 transition-all relative ${isActive ? 'text-blue-600 scale-110' : 'text-slate-400'}`}>
                <item.icon className="w-6 h-6" /><span className="text-[8px] font-black uppercase tracking-widest leading-none">{item.label.split(' ')[0]}</span>
                {location.pathname === item.path && <span className="absolute -bottom-1 w-1 h-1 bg-blue-600 rounded-full"></span>}
              </NavLink>
            ))}
            <button onClick={() => setIsMenuOpen(true)} className={`flex flex-col items-center gap-1.5 p-3 transition-all relative ${isMenuOpen || (user.role === UserRole.ADMIN && pendingTotal > 0) ? 'text-blue-600' : 'text-slate-400'}`}>
              <div className="relative"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/></svg>{user.role === UserRole.ADMIN && pendingTotal > 0 && <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-600 rounded-full border border-white dark:border-slate-900"></span>}</div>
              <span className="text-[8px] font-black uppercase tracking-widest leading-none">Menu</span>
            </button>
          </nav>
        )}
      </main>

      {!isQuizHubActive && (
        <>
          <div className={`drawer-overlay fixed inset-0 bg-slate-950/60 backdrop-blur-sm md:hidden ${isMenuOpen ? 'active' : ''}`} onClick={() => setIsMenuOpen(false)}></div>
          <div className={`mobile-drawer fixed left-0 top-0 bottom-0 w-[280px] bg-white dark:bg-slate-900 md:hidden flex flex-col p-8 ${isMenuOpen ? 'active' : ''}`}>
               <div className="flex items-center justify-between mb-12">
                  <div><p className="text-blue-500 text-[9px] font-black uppercase tracking-[0.4em] mb-1">Terminal</p><h2 className="text-slate-900 dark:text-white text-xl font-black uppercase tracking-tighter italic leading-none">Directory</h2></div>
                  <button onClick={() => setIsMenuOpen(false)} className="w-10 h-10 bg-slate-50 dark:bg-slate-800 rounded-xl flex items-center justify-center text-slate-400"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5"><path d="M18 6L6 18M6 6l12 12"/></svg></button>
               </div>
               <nav className="flex-1 space-y-2 overflow-y-auto scrollbar-hide">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.3em] mb-4 ml-4">Extended Nodes</p>
                  {navItems.slice(4).map((item) => (
                    <NavLink key={item.path} to={item.path} className={({ isActive }: { isActive: boolean }) => `flex items-center gap-4 p-5 rounded-[24px] transition-all relative ${isActive ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                      <item.icon className="w-6 h-6 shrink-0" /><span className="font-black text-xs uppercase tracking-widest flex-1">{item.label}</span>
                      {(item as any).badge !== undefined && (item as any).badge > 0 && <span className="bg-red-600 text-white text-[9px] font-black px-2 py-0.5 rounded-full shadow-lg">{(item as any).badge}</span>}
                    </NavLink>
                  ))}
                  <div className="h-px bg-slate-100 dark:bg-slate-800 my-6"></div>
                  {moreItems.map((item) => (
                    <NavLink key={item.path} to={item.path} className={({ isActive }: { isActive: boolean }) => `flex items-center gap-4 p-5 rounded-[24px] transition-all ${isActive ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                      <item.icon className="w-6 h-6 shrink-0" /><span className="font-black text-xs uppercase tracking-widest">{item.label}</span>
                    </NavLink>
                  ))}
                  <GovernmentDisclaimer forceShow={sysConfig.showDisclaimers} />
                  <button onClick={onLogout} className="w-full flex items-center gap-4 p-5 rounded-[24px] text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-all font-black text-xs uppercase tracking-widest mt-8 border border-red-100 dark:border-red-900/30"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/></svg>Exit Hub</button>
               </nav>
               <footer className="mt-auto pt-8 border-t border-slate-100 dark:border-slate-800"><div className="flex items-center gap-2 mb-4"><div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div><p className="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.4em]">Node Sync Active</p></div><p className="text-[8px] font-black text-slate-300 dark:text-slate-700 uppercase tracking-[0.6em]">CPN NEPAL • V3.6.2</p></footer>
          </div>
        </>
      )}
    </div>
  );
};

export default Layout;
