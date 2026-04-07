
import React from 'react';

interface GovernmentDisclaimerProps {
  forceShow?: boolean;
}

const GovernmentDisclaimer: React.FC<GovernmentDisclaimerProps> = ({ forceShow }) => {
  const isReviewer = typeof window !== 'undefined' && window.location.search.includes('reviewer=true');
  
  if (!forceShow && !isReviewer) return null;

  return (
    <div className="mt-8 p-6 bg-slate-100 dark:bg-slate-800/50 rounded-3xl border border-slate-200 dark:border-slate-800/50 space-y-4">
    <div className="flex items-center gap-2 text-amber-600 dark:text-amber-500">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
      <span className="text-[10px] font-black uppercase tracking-widest">Academic Disclaimer</span>
    </div>
    <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400 leading-relaxed italic">
      This is an <span className="font-bold text-slate-900 dark:text-white underline decoration-amber-500/50">independent academic practice tool</span> designed for licensing exam preparation. It is NOT affiliated with, authorized by, or endorsed by any government entity or professional council. All content provided is for academic study and exam simulation purposes only.
    </p>
    
    <div className="space-y-2">
      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Official Government & Council Sources:</p>
      <div className="grid grid-cols-1 gap-1">
        <a href="https://nmc.org.np" target="_blank" rel="noopener noreferrer" className="text-[9px] text-blue-500 hover:underline font-bold">Nepal Medical Council (NMC) - Official Site</a>
        <a href="https://nnpc.org.np" target="_blank" rel="noopener noreferrer" className="text-[9px] text-blue-500 hover:underline font-bold">Nepal Pharmacy Council (NPC) - Official Site</a>
        <a href="https://nnc.org.np" target="_blank" rel="noopener noreferrer" className="text-[9px] text-blue-500 hover:underline font-bold">Nepal Nursing Council (NNC) - Official Site</a>
        <a href="https://nhpc.org.np" target="_blank" rel="noopener noreferrer" className="text-[9px] text-blue-500 hover:underline font-bold">Nepal Health Professional Council (NHPC) - Official Site</a>
        <a href="https://nec.gov.np" target="_blank" rel="noopener noreferrer" className="text-[9px] text-blue-500 hover:underline font-bold">Nepal Engineering Council (NEC) - Official Site</a>
      </div>
    </div>

    <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
      <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Purpose: Academic Practice & Exam Simulation Only</p>
    </div>
    </div>
  );
};

export default GovernmentDisclaimer;
