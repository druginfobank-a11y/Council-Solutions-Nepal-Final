
import React, { useState, useEffect } from 'react';
import * as ReactRouter from 'react-router-dom';
import { db } from '../services/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { SystemSettings } from '../types';

const { useNavigate, useParams } = ReactRouter as any;

const LegalView: React.FC = () => {
  const navigate = useNavigate();
  const { type } = useParams();
  const [sysConfig, setSysConfig] = useState<Partial<SystemSettings>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const snap = await getDoc(doc(db, 'system', 'config'));
        if (snap.exists()) setSysConfig(snap.data());
      } finally {
        setLoading(false);
      }
    };
    fetchConfig();
  }, []);

  const url = type === 'privacy' ? sysConfig.privacyPolicyUrl : sysConfig.termsOfServiceUrl;
  const title = type === 'privacy' ? 'Privacy Policy' : 'Terms of Service';

  if (loading) {
    return (
      <div className="h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white dark:bg-slate-950 overflow-hidden">
      {/* Header with Back Button */}
      <header className="h-20 shrink-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-6 z-30">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/')} 
            className="w-10 h-10 bg-slate-50 dark:bg-slate-800 rounded-xl flex items-center justify-center text-slate-400 hover:text-blue-500 transition-all active:scale-95 shadow-sm"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
          </button>
          <div>
            <h1 className="text-sm font-black uppercase tracking-tight dark:text-white">{title}</h1>
            <p className="text-[8px] font-black text-blue-500 uppercase tracking-widest">Legal Node</p>
          </div>
        </div>
        <button 
          onClick={() => url && window.open(url, '_blank')}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-[9px] font-black uppercase tracking-widest shadow-lg active:scale-95 transition-all"
        >
          Open External
        </button>
      </header>

      {/* Content Area */}
      <div className="flex-1 relative bg-slate-50 dark:bg-slate-950">
        {url ? (
          <iframe 
            src={url} 
            className="w-full h-full border-none"
            title={title}
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center">
            <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-[32px] flex items-center justify-center text-3xl mb-6">📄</div>
            <h2 className="text-xl font-black uppercase tracking-tight dark:text-white mb-2">Node Not Configured</h2>
            <p className="text-slate-500 text-xs font-bold uppercase tracking-widest max-w-xs leading-relaxed">
              The administrator has not yet synchronized the {title} asset for this academic terminal.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default LegalView;
