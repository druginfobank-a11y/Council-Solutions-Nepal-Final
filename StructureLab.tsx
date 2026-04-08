import React, { useState, useRef, useEffect } from 'react';
import { getTutorResponse, startLiveVivaSession } from '../services/geminiService';
import { UserRole, User } from '../types';
import { auth, db } from '../services/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';

interface Message {
  role: 'user' | 'model' | 'error';
  content: string;
  node?: string;
  errorType?: 'auth' | 'generic';
}

const WaveformVisualizer: React.FC = () => (
  <div className="flex items-center gap-1 h-5 md:h-8 px-1 md:px-4">
    {Array.from({ length: 12 }).map((_, i) => (
      <div 
        key={i} 
        className="w-0.5 md:w-1 bg-red-500 rounded-full animate-[viva-pulse_1s_ease-in-out_infinite]" 
        style={{ height: `${20 + Math.random() * 80}%`, animationDelay: `${i * 0.08}s` }}
      ></div>
    ))}
  </div>
);

const AcademicContent: React.FC<{ text: string, node?: string }> = ({ text, node }) => {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  
  let currentTable: string[][] = [];
  let inTable = false;

  const parseInlineStyles = (line: string) => {
    const parts = line.split(/(\*\*.*?\*\*|\*.*?\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} className="font-black text-white">{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith('*') && part.endsWith('*')) {
        return <em key={i} className="italic text-blue-400/90">{part.slice(1, -1)}</em>;
      }
      return part;
    });
  };

  const renderTable = (rows: string[][], key: number) => {
    if (rows.length < 2) return null;
    const filteredRows = rows.filter(row => !row.every(cell => cell.trim().match(/^-+$/)));
    if (filteredRows.length === 0) return null;

    const headers = filteredRows[0];
    const body = filteredRows.slice(1);

    return (
      <div key={`table-${key}`} className="my-4 md:my-6 overflow-x-auto rounded-xl md:rounded-2xl border border-blue-500/20 bg-slate-950/50 shadow-2xl scrollbar-hide">
        <table className="min-w-full divide-y divide-blue-500/10 text-left border-collapse">
          <thead className="bg-blue-600/5">
            <tr>
              {headers.map((h, i) => (
                <th key={i} className="px-3 md:px-6 py-3 md:py-4 text-[9px] md:text-xs font-black text-blue-400 uppercase tracking-widest whitespace-nowrap">{h.trim()}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {body.map((row, ri) => (
              <tr key={ri} className="hover:bg-white/[0.02] transition-colors group">
                {row.map((cell, ci) => (
                  <td key={ci} className="px-3 md:px-6 py-3 md:py-4 text-[10px] md:text-sm text-slate-300 font-medium leading-relaxed">{parseInlineStyles(cell.trim())}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.includes('|')) {
      const cells = line.split('|').filter((_, idx, arr) => {
        if (idx === 0 && line.startsWith('|')) return false;
        if (idx === arr.length - 1 && line.endsWith('|')) return false;
        return true;
      });
      if (cells.length > 0) {
        currentTable.push(cells);
        inTable = true;
        continue;
      }
    }
    if (inTable && (!line.includes('|') || i === lines.length - 1)) {
      elements.push(renderTable(currentTable, i));
      currentTable = [];
      inTable = false;
      if (!line.includes('|') && line === '') continue;
    }
    if (!inTable) {
      if (!line) {
        elements.push(<div key={i} className="h-1 md:h-2" />);
        continue;
      }
      if (line.startsWith('###')) {
        elements.push(
          <div key={i} className="mt-6 md:mt-12 mb-3 md:mb-8 flex items-center gap-3 md:gap-6">
            <h3 className="text-blue-500 text-[10px] md:text-xl font-black uppercase tracking-[0.12em] md:tracking-[0.2em] leading-none shrink-0 italic">{parseInlineStyles(line.replace(/^###\s*/, ''))}</h3>
            <div className="h-px flex-1 bg-gradient-to-r from-blue-600/30 to-transparent"></div>
          </div>
        );
      } else {
        elements.push(<p key={i} className="text-slate-300 text-xs md:text-base leading-[1.6] md:leading-[1.8] font-medium tracking-tight">{parseInlineStyles(line)}</p>);
      }
    }
  }

  return (
    <div className="space-y-3 md:space-y-6">
      <div className="prose prose-invert max-w-none space-y-3 md:space-y-4">{elements}</div>
      {node && (
        <div className="pt-3 md:pt-4 border-t border-white/5 flex items-center gap-2">
          <span className="w-1 md:w-1.5 h-1 md:h-1.5 rounded-full bg-green-500"></span>
          <p className="text-[6px] md:text-[7px] font-black text-slate-500 uppercase tracking-widest">Logic Node: {node.toUpperCase()}</p>
        </div>
      )}
    </div>
  );
};

const Tutor: React.FC = () => {
  const [currentUserData, setCurrentUserData] = useState<User | null>(null);
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [isRequesting, setIsRequesting] = useState(false);
  const [messages, setMessages] = useState<Message[]>(() => {
    try {
      const saved = localStorage.getItem('csn_tutor_chat');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.map(m => ({
            role: m.role || 'model',
            content: String(m.content || ''),
            node: m.node ? String(m.node) : undefined,
            errorType: m.errorType
          }));
        }
      }
    } catch (e) {
      console.warn("Storage node sync failure.");
    }
    return [{ role: 'model', content: "### Intelligence Hub Initialized\nWelcome to the CSN Tutor Node. How can I assist your professional preparation today?", node: 'system' }];
  });
  
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [vivaSession, setVivaSession] = useState<{stop: () => void} | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchUser = async () => {
      if (auth.currentUser) {
        const snap = await getDoc(doc(db, 'users', auth.currentUser.uid));
        if (snap.exists()) {
          setCurrentUserData(snap.data() as User);
        }
      }
      setIsDataLoaded(true);
    };
    fetchUser();
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
    if (messages.length > 1) {
      const safeMessages = messages.map(m => ({
        role: m.role,
        content: typeof m.content === 'string' ? m.content : '[Non-String Data]',
        node: m.node ? String(m.node) : undefined,
        errorType: m.errorType
      }));
      try {
        localStorage.setItem('csn_tutor_chat', JSON.stringify(safeMessages));
      } catch (e) {
        console.error("Local storage sync fault:", e);
      }
    }
  }, [messages, isLoading]);

  const handleRequestAccess = async () => {
    if (!auth.currentUser) return;
    setIsRequesting(true);
    try {
      await updateDoc(doc(db, 'users', auth.currentUser.uid), {
        intelligenceRequested: true
      });
      setCurrentUserData(prev => prev ? { ...prev, intelligenceRequested: true } : null);
    } catch (e) {
      alert("Transmission failure. Check network node.");
    } finally {
      setIsRequesting(false);
    }
  };

  const handleSend = async (manualQuery?: string) => {
    const queryToUse = typeof manualQuery === 'string' ? manualQuery : input.trim();
    if (!queryToUse || isLoading) return;

    const history = messages
      .filter(m => m.role !== 'error' && m.node !== 'system')
      .slice(-10)
      .map(m => ({ 
        role: (m.role === 'model' ? 'model' : 'user') as 'user' | 'model', 
        content: String(m.content) 
      }));

    if (typeof manualQuery !== 'string') {
      setMessages(prev => [...prev, { role: 'user', content: queryToUse }]);
      setInput('');
    }

    setIsLoading(true);
    try {
      const context = currentUserData ? { program: currentUserData.program || '', council: currentUserData.council || '' } : undefined;
      const response = await getTutorResponse(queryToUse, history, context);
      setMessages(prev => [...prev, { role: 'model', content: String(response.text || ''), node: String(response.node || 'unknown') }]);
    } catch (error: any) {
      setMessages(prev => [...prev, { 
        role: 'error', 
        content: `### Neural Link Fault\n${String(error.message || "Diagnostic connection failure.")}`,
        errorType: error.message === 'AUTHORIZATION_REQUIRED' ? 'auth' : 'generic'
      }]);
    } finally { setIsLoading(false); }
  };

  const toggleViva = async () => {
    if (vivaSession) { vivaSession.stop(); setVivaSession(null); return; }
    try {
      const session = await startLiveVivaSession({ council: currentUserData?.council || 'NMC' }, {
        onError: (msg: string) => { console.warn(msg); setVivaSession(null); },
        onClose: () => setVivaSession(null)
      });
      setVivaSession(session);
    } catch (e) { alert("Live Audio Node failure."); }
  };

  if (isDataLoaded && !currentUserData?.intelligenceApproved && currentUserData?.role !== UserRole.ADMIN) {
    const hasRequested = currentUserData?.intelligenceRequested;

    return (
      <div className="flex-1 min-h-0 flex flex-col items-center justify-center text-center p-6 md:p-12 bg-slate-950 border border-slate-900 md:rounded-[48px] rounded-3xl animate-in overflow-hidden relative">
         <div className="absolute inset-0 bg-blue-600/5 blur-[120px] rounded-full animate-pulse"></div>
         <div className="relative z-10 flex flex-col items-center w-full max-w-lg">
            <div className={`w-16 h-16 md:w-24 md:h-24 ${hasRequested ? 'bg-orange-600/10 border-orange-500/20' : 'bg-red-600/10 border-red-500/20'} rounded-2xl md:rounded-[40px] flex items-center justify-center text-3xl md:text-5xl mb-6 md:mb-8 border shadow-2xl`}>
               {hasRequested ? '📡' : '🔓'}
            </div>
            <h2 className="text-2xl md:text-5xl font-black text-white uppercase tracking-tighter italic mb-3 md:mb-4">
               {hasRequested ? 'Request Processing' : 'Access Restricted'}
            </h2>
            <p className="text-slate-500 text-[10px] md:text-base font-bold uppercase tracking-[0.15em] md:tracking-[0.2em] leading-relaxed md:leading-loose mb-8 md:mb-10">
               {hasRequested 
                 ? "Administrative clearance is being verified for your practitioner profile. Telemetry link will activate shortly." 
                 : "The AI Intelligence Node requires explicit administrative clearance. Request a neural link to begin technical tutoring."
               }
            </p>
            <div className="flex flex-col md:flex-row gap-3 md:gap-4 w-full md:w-auto">
               {!hasRequested ? (
                 <button 
                   onClick={handleRequestAccess}
                   disabled={isRequesting}
                   className="w-full md:w-auto px-10 py-4 md:px-12 md:py-5 bg-blue-600 text-white rounded-xl md:rounded-2xl font-black uppercase text-[9px] md:text-[10px] tracking-widest shadow-xl active:scale-95 transition-all hover:bg-blue-700 flex items-center justify-center gap-3"
                 >
                   {isRequesting ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : null}
                   REQUEST NEURAL ACCESS
                 </button>
               ) : (
                 <button className="w-full md:w-auto px-8 py-4 md:px-10 md:py-4 bg-slate-900 text-orange-500 border border-orange-500/20 rounded-xl md:rounded-2xl font-black uppercase text-[9px] md:text-[10px] tracking-widest cursor-default">
                   Status: Awaiting Node Approval
                 </button>
               )}
               <button onClick={() => window.location.reload()} className="w-full md:w-auto px-8 py-4 md:px-10 md:py-4 bg-white/5 text-white border border-white/10 rounded-xl md:rounded-2xl font-black uppercase text-[9px] md:text-[10px] tracking-widest hover:bg-white/10 transition-all">
                  Refresh Sync
               </button>
            </div>
         </div>
      </div>
    );
  }

  const isEng = currentUserData?.council === 'NEC';

  return (
    <div className="flex flex-1 flex-col bg-slate-950 border border-slate-900 md:rounded-[48px] rounded-3xl overflow-hidden shadow-2xl relative min-h-0 transition-all">
      <div className="flex-1 flex flex-col relative min-w-0 h-full">
        <header className="p-3 md:p-6 border-b border-slate-900 bg-slate-950/80 backdrop-blur-2xl flex items-center justify-between shrink-0 z-20">
          <div className="flex items-center gap-3 md:gap-5">
            <div className={`w-8 h-8 md:w-14 md:h-14 rounded-lg md:rounded-[20px] flex items-center justify-center text-base md:text-2xl shadow-2xl ${isEng ? 'bg-orange-600 shadow-orange-600/20' : 'bg-blue-600 shadow-blue-600/20'} transition-all duration-700 relative overflow-hidden group`}>
              <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              {isEng ? '⚙️' : '⚡'}
            </div>
            <div className="min-w-0">
              <h2 className="font-black text-[10px] md:text-lg tracking-tight text-white uppercase leading-none italic truncate">{isEng ? 'Engineering Node' : 'Intelligence Hub'}</h2>
              <p className="text-[6px] md:text-[9px] text-slate-500 font-black uppercase tracking-[0.2em] mt-1">Status: Active</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
             <button onClick={toggleViva} className={`flex items-center gap-1.5 md:gap-3 px-3 md:px-5 py-2 md:py-3.5 rounded-lg md:rounded-2xl transition-all font-black text-[7px] md:text-[9px] uppercase tracking-widest border ${vivaSession ? 'bg-red-600 border-red-500 text-white shadow-2xl shadow-red-600/20' : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-white hover:border-blue-500/50'}`}>
                {vivaSession ? <WaveformVisualizer /> : <span className="text-sm md:text-lg">🎙️</span>}
                <span className="hidden xs:inline">{vivaSession ? 'Stop' : 'Live Sync'}</span>
             </button>
          </div>
        </header>
        
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 md:p-10 space-y-6 md:space-y-12 scrollbar-hide scroll-smooth">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-500`}>
              <div className={`max-w-[92%] md:max-w-[85%] p-4 md:p-10 rounded-2xl md:rounded-[40px] relative transition-all ${
                msg.role === 'user' ? 'bg-blue-600 text-white shadow-2xl shadow-blue-900/20 border border-white/10 rounded-tr-none' : 
                msg.role === 'error' ? 'bg-red-600/10 border border-red-500/30 text-red-100' :
                'bg-slate-900/40 text-slate-200 border border-slate-800 rounded-tl-none'
              }`}>
                {msg.role === 'user' && (
                  <div className="absolute -top-2 right-2 md:right-8 px-1.5 md:px-3 py-0.5 md:py-1 bg-blue-700 rounded-full text-[5px] md:text-[8px] font-black uppercase tracking-widest text-blue-200 border border-white/10 shadow-lg">Practitioner</div>
                )}
                <AcademicContent text={msg.content} node={msg.node} />
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start animate-in fade-in duration-300">
              <div className="bg-slate-900/50 px-5 md:px-10 py-3 md:py-7 rounded-xl md:rounded-[32px] border border-slate-800/60 flex items-center gap-3 md:gap-4 shadow-2xl">
                <div className="flex gap-1 md:gap-2">
                  <div className="w-1 md:w-2 h-1 md:h-2 rounded-full animate-bounce [animation-duration:0.8s] [animation-delay:-0.3s] bg-blue-500"></div>
                  <div className="w-1 md:w-2 h-1 md:h-2 rounded-full animate-bounce [animation-duration:0.8s] [animation-delay:-0.15s] bg-blue-500"></div>
                  <div className="w-1 md:w-2 h-1 md:h-2 rounded-full animate-bounce [animation-duration:0.8s] bg-blue-500"></div>
                </div>
                <div className="flex flex-col">
                  <span className="text-[7px] md:text-[10px] font-black uppercase text-slate-500 tracking-[0.2em]">Neural Processing</span>
                </div>
              </div>
            </div>
          )}
        </div>
        
        <div className="p-3 md:p-8 bg-slate-950/90 backdrop-blur-3xl border-t border-slate-900 z-10">
          <div className="max-w-5xl mx-auto flex gap-2 md:gap-4 bg-slate-900/80 p-1.5 md:p-3 rounded-2xl md:rounded-[36px] border border-white/5 focus-within:border-blue-500/40 transition-all shadow-2xl group">
              <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSend()} placeholder={isEng ? "Ask technical query..." : "Ask academic query..."} className="flex-1 bg-transparent border-none focus:ring-0 text-xs md:text-lg px-3 md:px-6 text-white placeholder-slate-700 font-bold" />
              <button onClick={() => handleSend()} disabled={isLoading || !input.trim()} className={`w-10 h-10 md:w-16 md:h-16 rounded-xl md:rounded-2xl flex items-center justify-center text-white shadow-2xl transition-all active:scale-95 shrink-0 ${isLoading ? 'bg-slate-800' : 'bg-blue-600 shadow-blue-600/20'}`}>
                {isLoading ? <div className="w-4 h-4 md:w-6 md:h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" className="md:w-6 md:h-6"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>}
              </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Tutor;