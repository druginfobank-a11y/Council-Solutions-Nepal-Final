
import React, { useMemo, useState, useEffect } from 'react';
import GovernmentDisclaimer from '../components/GovernmentDisclaimer';
import { User, UserRole, ExamResult, Quiz, LearningMaterial, StudyTask, Ad } from '../types';
import * as ReactRouter from 'react-router-dom';
import { db } from '../services/firebase';
import { collection, query, where, onSnapshot, limit, orderBy } from 'firebase/firestore';
import { verifyBunnyConnection, sanitizeUrl, ensureExternalLink } from '../services/storageService';
import { subscribeToTasks, addTask, updateTaskStatus, deleteTaskFromCloud, getWeeklyLeaderboard } from '../services/userService';
import { getProgramMasteryRankings } from '../services/contentService';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, Tooltip, Cell
} from 'recharts';
import confetti from 'canvas-confetti';

const { useNavigate } = ReactRouter as any;

/**
 * IMMERSIVE AD VIEWER (Internal notices)
 */
const ImmersiveAdViewer: React.FC<{ ad: Ad; onClose: () => void }> = ({ ad, onClose }) => {
  return createPortal(
    <div className="fixed inset-0 z-[10005] bg-slate-950/95 backdrop-blur-2xl flex flex-col h-[100dvh] w-full overflow-hidden animate-in fade-in duration-500">
      <header className="h-20 bg-slate-900/50 border-b border-white/5 flex items-center justify-between px-8 shrink-0 z-[10006]">
         <div className="flex items-center gap-4">
            <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
            <div>
               <p className="text-white text-[10px] font-black uppercase tracking-widest leading-none">Internal Protocol Notice</p>
               <p className="text-slate-500 text-[8px] font-bold uppercase tracking-widest mt-1">CPN Official Bulletin Node</p>
            </div>
         </div>
         <button 
            onClick={onClose}
            className="px-8 py-3 bg-red-600 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-2xl shadow-red-900/40 active:scale-95 transition-all flex items-center gap-2 border border-red-500/30"
         >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4"><path d="M18 6L6 18M6 6l12 12"/></svg>
            CLOSE
         </button>
      </header>
      
      <div className="flex-1 overflow-y-auto p-6 md:p-20 flex flex-col items-center">
         <div className="max-w-4xl w-full space-y-12 animate-in slide-in-from-bottom-8 duration-700">
            {ad.imageUrl && (
              <div className="w-full aspect-[21/9] rounded-[48px] overflow-hidden border border-white/10 shadow-2xl">
                 <img src={sanitizeUrl(ad.imageUrl)} className="w-full h-full object-cover" alt="Bulletin Graphic" />
              </div>
            )}
            
            <div className="space-y-6">
               <div className="flex items-center gap-3">
                  <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${
                    ad.type === 'warning' ? 'bg-red-600/20 text-red-500 border border-red-500/20' : 
                    ad.type === 'promo' ? 'bg-green-600/20 text-green-500 border border-green-500/20' : 
                    'bg-blue-600/20 text-blue-500 border border-blue-500/20'
                  }`}>
                    Official Synchronized Notice
                  </span>
                  <span className="text-slate-500 text-[9px] font-bold uppercase tracking-widest">{ad.createdAt ? new Date(ad.createdAt).toLocaleDateString() : 'Active Node'}</span>
               </div>
               
               <h2 className="text-4xl md:text-7xl font-black text-white uppercase tracking-tighter italic leading-none">{ad.title}</h2>
               
               <div className="p-1 w-24 h-1.5 bg-blue-600 rounded-full"></div>
               
               <div className="text-slate-300 text-lg md:text-2xl font-medium leading-relaxed max-w-3xl whitespace-pre-wrap">
                  {ad.content}
               </div>
            </div>
         </div>
      </div>
      
      <footer className="h-16 bg-slate-900/30 border-t border-white/5 flex items-center justify-center shrink-0">
         <p className="text-[8px] font-black text-slate-600 uppercase tracking-[0.6em]">Council Prep Nepal • Terminal Session Active</p>
      </footer>
    </div>,
    document.body
  );
};

/**
 * FULL SCREEN IN-APP BROWSER OVERLAY
 */
const ExternalNodeViewer: React.FC<{ url: string; onClose: () => void }> = ({ url, onClose }) => {
  const sanitizedUrl = ensureExternalLink(url);
  
  return createPortal(
    <div className="fixed inset-0 z-[10000] bg-slate-950 flex flex-col h-[100dvh] w-full overflow-hidden animate-in fade-in duration-500">
      <header className="h-16 md:h-20 bg-slate-900 border-b border-white/5 flex items-center justify-between px-6 shrink-0 z-[10001] shadow-2xl">
         <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
            <div>
               <p className="text-white text-[10px] font-black uppercase tracking-widest leading-none">External Handshake Active</p>
               <p className="text-slate-500 text-[8px] font-bold uppercase tracking-widest mt-1 truncate max-w-[150px] md:max-w-md">{sanitizedUrl}</p>
            </div>
         </div>
         <button 
            onClick={onClose}
            className="px-6 py-2.5 bg-red-600 text-white rounded-xl font-black text-[9px] md:text-[11px] uppercase tracking-widest shadow-xl shadow-red-900/40 active:scale-95 transition-all flex items-center gap-2"
         >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4"><path d="M18 6L6 18M6 6l12 12"/></svg>
            EXIT NODE
         </button>
      </header>
      
      <div className="flex-1 bg-white relative overflow-hidden">
         <iframe 
            src={sanitizedUrl} 
            className="w-full h-full border-none" 
            title="External Content"
            sandbox="allow-forms allow-modals allow-popups allow-scripts allow-same-origin"
         />
         
         <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center p-8 text-center bg-slate-950/50 backdrop-blur-[2px] opacity-0 hover:opacity-100 transition-opacity">
            <div className="bg-slate-900 p-8 rounded-[32px] border border-white/10 pointer-events-auto shadow-2xl max-w-sm">
               <p className="text-white text-xs font-bold leading-relaxed mb-6">If the content does not load, the destination node may have security restrictions against embedding.</p>
               <button 
                  onClick={() => window.open(sanitizedUrl, '_blank')}
                  className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest"
               >
                  Open in System Browser
               </button>
            </div>
         </div>
      </div>
      
      <footer className="h-10 bg-slate-900 border-t border-white/5 flex items-center justify-center shrink-0">
         <p className="text-[7px] font-black text-slate-500 uppercase tracking-[0.4em]">Secure Proxy provided by CPN Neural Link</p>
      </footer>
    </div>,
    document.body
  );
};

const RedirectConfirmation: React.FC<{ url: string; onConfirm: () => void; onCancel: () => void }> = ({ url, onConfirm, onCancel }) => {
  const sanitizedUrl = ensureExternalLink(url);

  return createPortal(
    <div className="fixed inset-0 z-[9999] bg-slate-950/90 backdrop-blur-2xl flex items-center justify-center p-6 animate-in">
      <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[48px] p-8 md:p-14 text-center space-y-8 shadow-[0_50px_100px_rgba(0,0,0,0.5)] border border-slate-100 dark:border-slate-800 transition-all scale-100">
        <div className="w-24 h-24 bg-blue-600/10 rounded-[40px] flex items-center justify-center text-5xl mx-auto border border-blue-500/20 shadow-2xl relative">
           <span className="animate-pulse">🌐</span>
           <div className="absolute inset-0 rounded-[40px] border-2 border-blue-500/20 animate-ping"></div>
        </div>
        <div>
          <h3 className="text-2xl md:text-3xl font-black uppercase dark:text-white italic tracking-tighter leading-tight">External Protocol Request</h3>
          <p className="text-slate-500 dark:text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] leading-relaxed mt-4">
            Authorized Practitioner: You are now leaving the secure CPN infrastructure node.
          </p>
          <div className="mt-8 p-5 bg-slate-50 dark:bg-slate-950 rounded-3xl border border-slate-200 dark:border-slate-800 group transition-all">
            <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-2 text-left">Destination Hash:</p>
            <p className="text-[10px] font-mono text-blue-600 dark:text-blue-400 font-bold break-all leading-relaxed text-left">{sanitizedUrl}</p>
          </div>
        </div>
        <div className="flex flex-col gap-4">
          <button 
            onClick={onConfirm} 
            className="w-full py-6 bg-blue-600 text-white rounded-3xl font-black uppercase text-[11px] tracking-[0.2em] shadow-2xl shadow-blue-600/30 active:scale-95 transition-all hover:bg-blue-700"
          >
            AUTHORIZE & TRANSMIT
          </button>
          <button 
            onClick={onCancel} 
            className="w-full py-6 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white rounded-3xl font-black uppercase text-[11px] tracking-[0.2em] active:scale-95 transition-all border border-transparent hover:border-slate-200"
          >
            ABORT & RETURN TO DASHBOARD
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

const AnalyticChart: React.FC<{ data: { label: string; value: number }[]; color: string; type: 'bar' | 'line'; showBenchmarks?: boolean }> = ({ data, color, type, showBenchmarks }) => {
  if (data.length === 0) return (
    <div className="h-48 flex items-center justify-center border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-[32px] opacity-30 text-[10px] font-black uppercase tracking-widest">Telemetry Node Offline</div>
  );
  const maxVal = 100;
  const chartHeight = 100;
  const chartWidth = 100;
  const nationalAvg = 82;

  return (
    <div className="w-full h-48 md:h-72 pt-10">
      <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full h-full overflow-visible" preserveAspectRatio="none">
        {[0, 25, 50, 75, 100].map(v => ( 
          <line key={v} x1="0" y1={chartHeight - v} x2={chartWidth} y2={chartHeight - v} stroke="currentColor" strokeWidth="0.1" className="text-slate-200 dark:text-slate-800" /> 
        ))}
        {showBenchmarks && (
          <g>
            <line x1="0" y1={chartHeight - nationalAvg} x2={chartWidth} y2={chartHeight - nationalAvg} stroke="#ef4444" strokeWidth="0.4" strokeDasharray="2" opacity="0.4" />
            <text x={chartWidth - 5} y={chartHeight - nationalAvg - 2} className="text-[3px] font-black fill-red-500 uppercase">National Peer Avg ({nationalAvg}%)</text>
          </g>
        )}
        {type === 'bar' ? data.map((d, i) => {
            const barWidth = (chartWidth / data.length) * 0.7;
            const x = (i * (chartWidth / data.length)) + (barWidth * 0.15);
            const h = (d.value / maxVal) * chartHeight;
            return (
              <g key={i} className="group/bar">
                <rect x={x} y={chartHeight - h} width={barWidth} height={h} fill={color} fillOpacity="0.1" />
                <rect x={x} y={chartHeight - h} width={barWidth} height={2} fill={color} />
                <text x={x + barWidth/2} y={chartHeight + 10} className="text-[2.5px] font-black fill-slate-400 uppercase text-center" textAnchor="middle">{d.label.length > 10 ? d.label.substring(0, 8) + '..' : d.label}</text>
              </g>
            );
          }) : (
          <path d={`M ${data.map((d, i) => `${(i / (data.length - 1)) * chartWidth},${chartHeight - (d.value / maxVal) * chartHeight}`).join(' L ')}`} fill="none" stroke={color} strokeWidth="1" strokeLinecap="round" />
        )}
      </svg>
    </div>
  );
};

const DashboardHero: React.FC<{ 
  user: User; 
  title: string; 
  subtitle: string; 
  actionLabel?: string; 
  onAction?: () => void;
  accentColor?: string;
  icon?: string;
}> = ({ user, title, subtitle, actionLabel, onAction, accentColor = 'blue', icon = '⚡' }) => {
  return (
    <div className={`relative w-full overflow-hidden rounded-[48px] mb-6 group animate-in min-h-[220px] md:min-h-[280px] flex items-center`}>
      <div className={`absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-950 to-black`}></div>
      <div className={`absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_50%_50%,_var(--tw-gradient-from)_0%,_transparent_50%)] from-${accentColor}-600`}></div>
      
      <div className="absolute top-0 right-0 w-1/2 h-full opacity-10 pointer-events-none transform translate-x-1/4">
        <svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full animate-[pulse_8s_infinite]">
          <circle cx="100" cy="100" r="80" stroke="white" strokeWidth="0.5" strokeDasharray="4 4" />
          <path d="M100 20V180M20 100H180" stroke="white" strokeWidth="0.2" />
        </svg>
      </div>

      <div className="relative px-8 py-10 md:px-14 md:py-16 flex flex-col md:flex-row items-center justify-between gap-8 z-10 w-full">
        <div className="flex flex-col md:flex-row items-center gap-6 md:gap-10 text-center md:text-left flex-1 min-w-0">
          <div className={`w-20 h-20 md:w-28 md:h-28 rounded-[32px] bg-${accentColor}-600/20 border border-${accentColor}-500/30 flex items-center justify-center text-4xl md:text-6xl shadow-2xl shadow-${accentColor}-900/40 relative`}>
            <span className="relative z-10">{icon}</span>
            <div className={`absolute inset-0 rounded-[32px] bg-${accentColor}-50 blur-2xl opacity-0 group-hover:opacity-20 transition-opacity`}></div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 justify-center md:justify-start mb-2">
              <span className={`px-3 py-1 rounded-full bg-${accentColor}-600/10 border border-${accentColor}-500/20 text-${accentColor}-500 text-[8px] font-black uppercase tracking-[0.3em]`}>
                {user.role} NODE ACTIVE
              </span>
              {typeof window !== 'undefined' && window.location.search.includes('reviewer=true') && (
                <span className="px-3 py-1 rounded-full bg-amber-600/10 border border-amber-500/20 text-amber-500 text-[8px] font-black uppercase tracking-[0.3em]">
                  ACADEMIC PRACTICE
                </span>
              )}
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
            </div>
            <h1 className="text-3xl md:text-5xl font-black text-white uppercase tracking-tighter italic leading-none mb-3 truncate">
              {title}
            </h1>
            <p className="text-slate-400 text-xs md:text-sm font-bold uppercase tracking-widest leading-relaxed max-w-lg mx-auto md:mx-0">
              {subtitle}
            </p>
          </div>
        </div>

        {actionLabel && (
          <button 
            onClick={onAction}
            className={`px-10 py-5 bg-${accentColor}-600 text-white rounded-[24px] font-black text-[11px] uppercase tracking-widest shadow-2xl hover:scale-105 active:scale-95 transition-all relative overflow-hidden group/btn`}
          >
            <span className="relative z-10 flex items-center gap-2">
              {actionLabel}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" className="group-hover/btn:translate-x-1 transition-transform"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </span>
            <div className="absolute inset-0 bg-white/10 translate-y-full group-hover/btn:translate-y-0 transition-transform"></div>
          </button>
        )}
      </div>
    </div>
  );
};

const BulletinBanner: React.FC<{ ads: Ad[] }> = ({ ads }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [redirectUrl, setRedirectUrl] = useState<string | null>(null);
  const [activeExternalUrl, setActiveExternalUrl] = useState<string | null>(null);
  const [immersiveAd, setImmersiveAd] = useState<Ad | null>(null);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (ads.length <= 1 || isPaused) return;
    
    const currentAd = ads[currentIndex];
    const duration = (currentAd?.displayDuration || 5) * 1000;
    
    const timer = setTimeout(() => {
      setCurrentIndex((prev) => (prev + 1) % ads.length);
    }, duration);
    
    return () => clearTimeout(timer);
  }, [currentIndex, ads, isPaused]);

  if (ads.length === 0) return null;

  const handleAdClick = (ad: Ad) => {
    if (ad.linkUrl) {
      setRedirectUrl(ad.linkUrl);
    } else {
      setImmersiveAd(ad);
    }
    setIsPaused(true);
  };

  return (
    <div className="relative mb-8 group shadow-2xl rounded-[48px] overflow-hidden min-h-[220px] md:min-h-[280px]">
      {redirectUrl && (
        <RedirectConfirmation 
          url={redirectUrl} 
          onConfirm={() => { 
            setActiveExternalUrl(redirectUrl);
            setRedirectUrl(null); 
          }} 
          onCancel={() => {
            setRedirectUrl(null);
            setIsPaused(false);
          }} 
        />
      )}

      {activeExternalUrl && (
        <ExternalNodeViewer 
          url={activeExternalUrl} 
          onClose={() => {
            setActiveExternalUrl(null);
            setIsPaused(false);
          }} 
        />
      )}

      {immersiveAd && (
        <ImmersiveAdViewer 
          ad={immersiveAd} 
          onClose={() => {
            setImmersiveAd(null);
            setIsPaused(false);
          }} 
        />
      )}

      {ads.map((ad, idx) => (
        <div 
          key={ad.id} 
          onClick={() => handleAdClick(ad)}
          className={`absolute inset-0 transition-all duration-700 ease-in-out flex items-center cursor-pointer group/ad ${
            idx === currentIndex ? 'opacity-100 translate-x-0 z-10' : 'opacity-0 translate-x-12 z-0'
          }`}
        >
          {ad.imageUrl ? (
            <>
              <img 
                src={sanitizeUrl(ad.imageUrl)} 
                className="absolute inset-0 w-full h-full object-cover grayscale-[0.2] group-hover/ad:grayscale-0 transition-all duration-1000 scale-105 group-hover/ad:scale-110" 
                alt="Ad" 
              />
              <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/80 to-transparent"></div>
            </>
          ) : (
            <>
              <div className="absolute inset-0 bg-slate-950"></div>
              <div className={`absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_50%_50%,_var(--tw-gradient-from)_0%,_transparent_70%)] ${
                ad.type === 'warning' ? 'from-red-600' : 
                ad.type === 'promo' ? 'from-green-600' : 
                'from-blue-600'
              }`}></div>
            </>
          )}

          <div className="relative px-8 py-10 md:px-14 md:py-16 flex flex-col md:flex-row items-center justify-between gap-8 z-10 w-full">
            <div className="flex flex-col md:flex-row items-center gap-6 md:gap-10 text-center md:text-left flex-1 min-w-0">
               {!ad.imageUrl && (
                 <div className={`w-20 h-20 md:w-28 md:h-28 rounded-[32px] flex items-center justify-center text-4xl md:text-5xl shrink-0 border border-white/5 shadow-2xl transition-transform group-hover/ad:scale-110 ${
                    ad.type === 'warning' ? 'bg-red-500/10 text-red-500 shadow-red-900/20' : 
                    ad.type === 'promo' ? 'bg-green-500/10 text-green-500 shadow-green-900/20' : 
                    'bg-blue-500/10 text-blue-500 shadow-blue-900/20'
                  }`}>
                    {ad.type === 'warning' ? '⚠️' : ad.type === 'promo' ? '🎁' : '📢'}
                  </div>
               )}
               
               <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 justify-center md:justify-start mb-2">
                    <span className={`px-3 py-1 rounded-full border text-[8px] font-black uppercase tracking-[0.3em] ${
                      ad.type === 'warning' ? 'bg-red-600/10 border-red-500/20 text-red-500' : 
                      ad.type === 'promo' ? 'bg-green-500/10 border-green-500/20 text-green-500' : 
                      'bg-blue-600/10 border-blue-500/20 text-blue-500'
                    }`}>
                      Official Notice
                    </span>
                    <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${
                      ad.type === 'warning' ? 'bg-red-500' : 
                      ad.type === 'promo' ? 'bg-green-500' : 
                      'bg-blue-500'
                    }`}></span>
                  </div>
                  <h3 className="text-2xl md:text-5xl font-black text-white uppercase tracking-tighter italic leading-none mb-4 truncate drop-shadow-lg group-hover/ad:translate-x-2 transition-transform">
                    {ad.title}
                  </h3>
                  <p className="text-slate-300 text-xs md:text-sm font-bold uppercase tracking-widest leading-relaxed line-clamp-2 max-w-2xl drop-shadow-md">
                    {ad.content}
                  </p>
               </div>
            </div>

            <div className="shrink-0 flex flex-col items-center gap-2">
               <div className="px-10 py-5 bg-blue-600/20 text-blue-400 border border-blue-500/30 rounded-[24px] font-black text-[10px] uppercase tracking-widest transition-all flex items-center gap-2 group/btn shadow-2xl backdrop-blur-md hover:bg-blue-600 hover:text-white">
                  {ad.linkUrl ? 'Launch Portal' : 'Open Notice'}
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" className="group-hover/ad:translate-x-1 transition-transform"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
               </div>
               <p className="text-[7px] font-black text-slate-500 uppercase tracking-widest opacity-0 group-hover/ad:opacity-100 transition-opacity">Click to Expand Node</p>
            </div>
          </div>
        </div>
      ))}

      {ads.length > 1 && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-3 z-20">
          {ads.map((_, idx) => (
            <button 
              key={idx}
              onClick={(e) => { e.stopPropagation(); setCurrentIndex(idx); }}
              className={`h-1.5 rounded-full transition-all duration-500 ${
                idx === currentIndex ? 'w-8 bg-blue-600' : 'w-1.5 bg-white/20 hover:bg-white/40'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const MetricCard: React.FC<{ label: string; value: string | number; trend?: string; color: string; icon: string }> = ({ label, value, trend, color, icon }) => (
  <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-8 rounded-[40px] shadow-sm flex flex-col justify-between">
    <div className="flex justify-between items-start mb-4">
      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl bg-${color}-500/10 text-${color}-500`}>{icon}</div>
      {trend && <span className={`text-[8px] font-black uppercase px-2 py-1 rounded-lg ${trend.startsWith('+') ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>{trend}</span>}
    </div>
    <div>
      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</p>
      <p className="text-2xl font-black text-slate-900 dark:text-white uppercase">{value}</p>
    </div>
  </div>
);

const AdminDashboard: React.FC<{ user: User }> = ({ user }) => {
  const navigate = useNavigate();
  const [stats, setStats] = useState({ 
    totalUsers: 0, 
    studentCount: 0, 
    activeSubscriptions: 0, 
    globalAccuracy: 0, 
    growth: '+12%' 
  });
  const [pendingCount, setPendingCount] = useState(0);
  const [results, setResults] = useState<ExamResult[]>([]);
  const [chartView, setChartView] = useState<'subject' | 'model' | 'unit'>('subject');
  const [ads, setAds] = useState<Ad[]>([]);

  useEffect(() => {
    const unsubUsers = onSnapshot(collection(db, 'users'), snap => {
       const allUsers = snap.docs.map(d => d.data() as User);
       const now = Date.now();
       const students = allUsers.filter(u => u.role === UserRole.STUDENT);
       const subs = students.filter(s => s.subscriptionEnd && new Date(s.subscriptionEnd).getTime() > now);
       
       setStats(s => ({ 
         ...s, 
         totalUsers: snap.size,
         studentCount: students.length,
         activeSubscriptions: subs.length
       }));
    }, (err) => console.warn("Admin telemetry fault (users):", err));

    const unsubResults = onSnapshot(collection(db, 'exam_results'), snap => {
       const data = snap.docs.map(d => d.data() as ExamResult);
       setResults(data);
       const avg = data.length > 0 ? data.reduce((acc, r) => acc + r.percentage, 0) / data.length : 0;
       setStats(s => ({ ...s, globalAccuracy: Math.round(avg) }));
    }, (err) => console.warn("Admin telemetry fault (results):", err));

    const unsubPendingQ = onSnapshot(query(collection(db, 'quizzes'), where('status', '==', 'pending')), s1 => {
      setPendingCount(prev => prev + s1.size);
    }, (err) => console.warn("Admin telemetry fault (quizzes):", err));

    const unsubAds = onSnapshot(query(collection(db, 'ads'), orderBy('createdAt', 'desc'), limit(5)), snap => {
       setAds(snap.docs.map(d => ({ id: d.id, ...d.data() } as Ad)));
    }, (err) => console.warn("Admin telemetry fault (ads):", err));

    return () => { unsubUsers(); unsubResults(); unsubPendingQ(); unsubAds(); };
  }, []);

  const chartData = useMemo(() => {
    const grouped: Record<string, number[]> = {};
    const keyFn = chartView === 'subject' ? (r: any) => r.subject || 'General' : chartView === 'model' ? (r: any) => r.quizTitle : (r: any) => r.unit || 'Common';
    results.forEach(r => { const k = keyFn(r); if (!grouped[k]) grouped[k] = []; grouped[k].push(r.percentage); });
    return Object.entries(grouped).map(([label, vals]) => ({ label, value: Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) }));
  }, [results, chartView]);

  return (
    <div className="space-y-8 animate-in pb-32 max-w-7xl mx-auto px-4 md:px-0">
      <DashboardHero user={user} title="Admin Control" subtitle="Real-time ecosystem orchestration and node moderation interface." actionLabel="Launch Console" onAction={() => navigate('/admin')} accentColor="red" icon="🛡️" />
      <BulletinBanner ads={ads} />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
         <MetricCard label="Total Applications" value={stats.totalUsers} trend="+14%" color="blue" icon="👥" />
         <MetricCard label="Total Students" value={stats.studentCount} color="purple" icon="🎓" />
         <MetricCard label="Active Subscriptions" value={stats.activeSubscriptions} trend={stats.studentCount > 0 ? `${Math.round((stats.activeSubscriptions/stats.studentCount)*100)}% of pool` : undefined} color="green" icon="💳" />
         <MetricCard label="Moderation Queue" value={pendingCount} color="orange" icon="⏳" />
      </div>
      <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-8 md:p-12 rounded-[56px] shadow-sm">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
           <div>
              <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight italic">Intelligence Heatmap</h3>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">Cross-domain performance benchmarking</p>
           </div>
           <div className="flex bg-slate-50 dark:bg-slate-950 p-1.5 rounded-2xl border border-slate-100 dark:border-slate-800">
              {(['subject', 'model', 'unit'] as const).map(v => (
                <button key={v} onClick={() => setChartView(v)} className={`px-6 py-2.5 rounded-xl text-[8px] font-black uppercase tracking-widest transition-all ${chartView === v ? 'bg-white dark:bg-slate-800 text-blue-600 shadow-md' : 'text-slate-400'}`}>
                  {v}
                </button>
              ))}
           </div>
        </div>
        <AnalyticChart data={chartData} color="#3b82f6" type={chartView === 'model' ? 'line' : 'bar'} showBenchmarks={true} />
      </div>
    </div>
  );
};

const InstructorDashboard: React.FC<{ user: User }> = ({ user }) => {
  const navigate = useNavigate();
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [ads, setAds] = useState<Ad[]>([]);
  const [topStudents, setTopStudents] = useState<any[]>([]);

  useEffect(() => {
    const unsubQ = onSnapshot(query(collection(db, 'quizzes'), where('uploadedBy', '==', user.id)), snap => setQuizzes(snap.docs.map(d => ({ id: d.id, ...d.data() } as Quiz))), (err) => console.warn("Instructor node sync failure (quizzes):", err));
    const unsubAds = onSnapshot(query(collection(db, 'ads'), limit(5)), snap => setAds(snap.docs.map(d => ({ id: d.id, ...d.data() } as Ad))), (err) => console.warn("Instructor node sync failure (ads):", err));
    
    if (user.council && user.program) {
      getProgramMasteryRankings(user.council, user.program).then(res => setTopStudents(res.slice(0, 5)));
    }
    return () => { unsubQ(); unsubAds(); };
  }, [user.id, user.council, user.program]);

  return (
    <div className="space-y-8 animate-in pb-32 max-w-7xl mx-auto px-4 md:px-0">
      <DashboardHero user={user} title="Educator Node" subtitle="Manage academic resources and provision knowledge assets." actionLabel="Architect Quiz" onAction={() => navigate('/quiz')} accentColor="purple" icon="📚" />
      <BulletinBanner ads={ads} />
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
         <div className="lg:col-span-8 space-y-8">
            <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-10 rounded-[56px] shadow-sm">
               <h3 className="text-sm font-black uppercase tracking-tight dark:text-white italic mb-8">Performance Distribution</h3>
               <AnalyticChart data={quizzes.map(q => ({ label: q.title, value: Math.random() * 40 + 60 }))} color="#a855f7" type="bar" showBenchmarks={true} />
            </div>
         </div>
         <div className="lg:col-span-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-8 rounded-[56px] shadow-sm">
            <h3 className="text-xs font-black uppercase tracking-widest dark:text-white mb-6">Top Program Talent</h3>
            <div className="space-y-4">
               {topStudents.map((s, i) => (
                 <div key={i} className="p-4 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-2xl flex items-center justify-between">
                    <div className="flex items-center gap-3">
                       <span className="w-8 h-8 rounded-lg flex items-center justify-center text-xs bg-purple-100 text-purple-600 font-black">{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${s.rank}`}</span>
                       <div>
                          <p className="text-[10px] font-black uppercase dark:text-white">{s.userName}</p>
                          <p className="text-[7px] font-bold text-slate-400 uppercase">{s.attempts} Syncs</p>
                       </div>
                    </div>
                    <span className="text-[11px] font-black text-purple-600">{Math.round(s.averageMastery)}%</span>
                 </div>
               ))}
               {topStudents.length === 0 && <p className="text-center py-10 opacity-20 text-[10px] font-black uppercase">No Talent Data</p>}
            </div>
         </div>
      </div>
    </div>
  );
};

const StudentDashboard: React.FC<{ user: User }> = ({ user }) => {
  const navigate = useNavigate();
  const [results, setResults] = useState<ExamResult[]>([]);
  const [ads, setAds] = useState<Ad[]>([]);
  const [tasks, setTasks] = useState<StudyTask[]>([]);
  const [userRank, setUserRank] = useState<number | null>(null);
  const [totalPeers, setTotalPeers] = useState<number>(0);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);

  useEffect(() => {
    const unsubRes = onSnapshot(query(collection(db, 'exam_results'), where('userId', '==', user.id)), snap => setResults(snap.docs.map(d => d.data() as ExamResult)), (err) => console.warn("Student node sync failure (results):", err));
    const unsubAds = onSnapshot(query(collection(db, 'ads'), limit(5)), snap => setAds(snap.docs.map(d => ({ id: d.id, ...d.data() } as Ad))), (err) => console.warn("Student node sync failure (ads):", err));
    
    if (user.council && user.program) {
      getProgramMasteryRankings(user.council, user.program).then(res => {
        setTotalPeers(res.length);
        const myRank = res.find(r => r.userId === user.id)?.rank;
        setUserRank(myRank || null);
      });

      const unsubLeaderboard = getWeeklyLeaderboard(user.council, setLeaderboard);
      return () => { unsubRes(); unsubAds(); unsubLeaderboard(); };
    }
    const unsubTasks = subscribeToTasks(user.id, setTasks, (err) => console.warn("Student node sync failure (tasks):", err));
    return () => { unsubRes(); unsubAds(); unsubTasks(); };
  }, [user.id, user.council, user.program]);

  const avgMastery = useMemo(() => results.length > 0 ? results.reduce((acc, r) => acc + r.percentage, 0) / results.length : 0, [results]);

  const isPremium = user.subscriptionEnd && new Date(user.subscriptionEnd).getTime() > Date.now();

  const weaknessData = useMemo(() => {
    if (!user.weaknesses) return [];
    return Object.entries(user.weaknesses).map(([subject, count]) => ({
      subject,
      count,
      fullMark: Math.max(...Object.values(user.weaknesses || {}), 10)
    })).slice(0, 6);
  }, [user.weaknesses]);

  return (
    <div className="space-y-8 animate-in pb-32 max-w-7xl mx-auto px-4 md:px-0">
      <DashboardHero 
        user={user} 
        title={`Welcome, ${(user.name || 'Scholar').split(' ')[0]}`} 
        subtitle="Your academic preparedness trajectory is synchronized." 
        actionLabel="Launch Evaluation" 
        onAction={() => navigate('/quiz')} 
        accentColor="blue" 
        icon="🎓" 
      />
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
         <MetricCard label="Mastery Index" value={`${Math.round(avgMastery)}%`} color="blue" icon="🎯" />
         <MetricCard label="Daily Streak" value={`${user.streakCount || 0} Days`} trend={user.dailyMcqCount ? `${user.dailyMcqCount}/5 MCQs` : '0/5 MCQs'} color="orange" icon="🔥" />
         <MetricCard label="Program Rank" value={userRank ? `#${userRank}` : 'Unranked'} trend={totalPeers > 1 ? `of ${totalPeers}` : undefined} color="purple" icon="🏆" />
         <MetricCard label="Node Status" value={isPremium ? 'PREMIUM' : 'EXPIRED'} color={isPremium ? 'orange' : 'red'} icon="⚡" />
      </div>

      <BulletinBanner ads={ads} />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
         <div className="lg:col-span-8 space-y-8">
            <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-10 rounded-[56px] shadow-sm">
               <div className="flex justify-between items-center mb-8">
                  <h3 className="text-sm font-black uppercase tracking-tight dark:text-white italic">Mastery Trajectory</h3>
                  <div className="flex items-center gap-2">
                     <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                     <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Accuracy %</span>
                  </div>
               </div>
               <AnalyticChart data={results.slice(-10).map(r => ({ label: r.quizTitle, value: r.percentage }))} color="#3b82f6" type="line" showBenchmarks={true} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
               <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-10 rounded-[56px] shadow-sm">
                  <h3 className="text-sm font-black uppercase tracking-tight dark:text-white italic mb-8">Weakness Heatmap</h3>
                  {weaknessData.length > 0 ? (
                    <div className="h-64 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <RadarChart cx="50%" cy="50%" outerRadius="80%" data={weaknessData}>
                          <PolarGrid stroke="#e2e8f0" />
                          <PolarAngleAxis dataKey="subject" tick={{ fill: '#94a3b8', fontSize: 8, fontWeight: 900 }} />
                          <Radar name="Weakness" dataKey="count" stroke="#ef4444" fill="#ef4444" fillOpacity={0.5} />
                        </RadarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="h-64 flex flex-col items-center justify-center opacity-20 text-center">
                       <span className="text-4xl mb-4">📊</span>
                       <p className="text-[10px] font-black uppercase tracking-widest">Insufficient Data for Heatmap</p>
                    </div>
                  )}
               </div>

               <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-10 rounded-[56px] shadow-sm">
                  <h3 className="text-sm font-black uppercase tracking-tight dark:text-white italic mb-8">Academic Badges</h3>
                  <div className="grid grid-cols-3 gap-4">
                     {(user.badges || []).map((badge, i) => (
                       <motion.div 
                         key={i}
                         initial={{ scale: 0 }}
                         animate={{ scale: 1 }}
                         whileHover={{ scale: 1.1, rotate: 5 }}
                         className="flex flex-col items-center gap-2"
                       >
                          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-2xl shadow-lg">
                             {badge === 'Consistent Scholar' ? '📅' : badge === 'Academic Legend' ? '👑' : '🏅'}
                          </div>
                          <span className="text-[7px] font-black text-slate-500 uppercase tracking-tight text-center leading-tight">{badge}</span>
                       </motion.div>
                     ))}
                     {(!user.badges || user.badges.length === 0) && (
                       <div className="col-span-3 py-10 text-center opacity-20">
                          <p className="text-[10px] font-black uppercase tracking-widest">No Badges Earned Yet</p>
                       </div>
                     )}
                  </div>
               </div>
            </div>
         </div>

         <div className="lg:col-span-4 space-y-8">
            <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-8 rounded-[48px] shadow-sm">
               <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xs font-black uppercase tracking-widest dark:text-white">Weekly Leaderboard</h3>
                  <span className="px-2 py-1 bg-blue-600/10 text-blue-600 rounded text-[7px] font-black uppercase tracking-widest">{user.council}</span>
               </div>
               <div className="space-y-4">
                  {leaderboard.map((entry, i) => (
                    <div key={i} className={`p-4 rounded-2xl flex items-center justify-between border ${entry.userId === user.id ? 'bg-blue-600/5 border-blue-600/20' : 'bg-slate-50 dark:bg-slate-950 border-slate-100 dark:border-slate-800'}`}>
                       <div className="flex items-center gap-3">
                          <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black ${i === 0 ? 'bg-amber-100 text-amber-600' : i === 1 ? 'bg-slate-200 text-slate-600' : i === 2 ? 'bg-orange-100 text-orange-600' : 'bg-slate-100 text-slate-400'}`}>
                             {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                          </span>
                          <div>
                             <p className="text-[10px] font-black uppercase dark:text-white truncate max-w-[120px]">{entry.userName}</p>
                             <p className="text-[7px] font-bold text-slate-400 uppercase">{entry.totalQuestions} Items</p>
                          </div>
                       </div>
                       <span className="text-[11px] font-black text-blue-600">{Math.round(entry.percentage)}%</span>
                    </div>
                  ))}
                  {leaderboard.length === 0 && <p className="text-center py-10 opacity-20 text-[10px] font-black uppercase">No Leaderboard Data</p>}
               </div>
            </div>

            <div className="bg-slate-900 border border-white/5 p-8 rounded-[48px] text-white shadow-2xl relative overflow-hidden group min-h-[250px] flex flex-col justify-between">
               <div className="absolute top-0 right-0 p-8 opacity-10 text-8xl group-hover:scale-110 transition-transform">🧠</div>
               {!user.intelligenceApproved && user.role !== UserRole.ADMIN && (
                 <div className="absolute top-4 right-4 bg-red-500/20 border border-red-500/30 px-3 py-1 rounded-full flex items-center gap-2 z-20">
                   <span className="text-[8px] font-black uppercase tracking-widest text-red-500">Locked</span>
                   <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="3"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                 </div>
               )}
               <div>
                  <h3 className="text-xl font-black uppercase tracking-tighter mb-2 italic">Neural Tutor</h3>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest leading-relaxed">
                    {!user.intelligenceApproved && user.role !== UserRole.ADMIN 
                      ? "Administrative authorization required for neural synchronization." 
                      : "24/7 Academic support Link synchronized."}
                  </p>
               </div>
               <button 
                 onClick={() => navigate('/tutor')} 
                 className={`w-full py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl transition-all ${
                   !user.intelligenceApproved && user.role !== UserRole.ADMIN
                     ? 'bg-slate-800 text-slate-500 border border-white/5'
                     : 'bg-white text-slate-950 hover:scale-105'
                 }`}
               >
                 {!user.intelligenceApproved && user.role !== UserRole.ADMIN ? 'Request Access' : 'Initiate Link'}
               </button>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-8 rounded-[48px] shadow-sm">
               <p className="text-[9px] font-black text-blue-500 uppercase tracking-widest mb-6">Study Directives</p>
               <div className="space-y-3 max-h-60 overflow-y-auto scrollbar-hide">
                  {tasks.slice(0, 5).map(t => (
                    <div key={t.id} className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-2xl">
                       <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${t.completed ? 'bg-green-500' : 'bg-blue-500'}`}></div>
                       <span className={`text-[10px] font-bold uppercase tracking-tight truncate ${t.completed ? 'text-slate-400 line-through' : 'dark:text-slate-300'}`}>{t.text}</span>
                    </div>
                  ))}
               </div>
            </div>
         </div>
      </div>
      <div className="pb-10">
        <GovernmentDisclaimer />
      </div>
    </div>
  );
};


const Dashboard: React.FC<{ user: User }> = ({ user }) => {
  if (user.role === UserRole.ADMIN) return <AdminDashboard user={user} />;
  if (user.role === UserRole.INSTRUCTOR) return <InstructorDashboard user={user} />;
  return <StudentDashboard user={user} />;
};

export default Dashboard;
