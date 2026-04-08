
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { User, UserRole, LearningMaterial, SystemSettings, ExamResult } from '../types';
import { sanitizeUrl, uploadToBunny } from '../services/storageService';
import { db } from '../services/firebase';
import { collection, query, onSnapshot, orderBy, doc, getDoc, where } from 'firebase/firestore';
import { generateAudioBriefing, decodeRawPCM } from '../services/geminiService';
import { publishLearningMaterial, getCurriculum } from '../services/contentService';
import { PROGRAMS_DATA } from '../constants';

interface LibraryProps { user: User; }

const MaterialWatermark: React.FC<{ user: User }> = ({ user }) => (
  <div className="absolute inset-0 pointer-events-none z-50 overflow-hidden flex flex-wrap gap-12 p-12 rotate-[-15deg] opacity-[0.03] select-none">
    {Array.from({ length: 20 }).map((_, i) => (
      <span key={i} className="text-[10px] font-black text-slate-500 dark:text-white whitespace-nowrap uppercase tracking-widest">
        {(user.name ?? 'Practitioner')} • CSN SECURE
      </span>
    ))}
  </div>
);

const Library: React.FC<LibraryProps> = ({ user }) => {
  const audioContextRef = useRef<AudioContext | null>(null);
  const [activeCat, setActiveCat] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [deferredSearch, setDeferredSearch] = useState('');
  const [selectedAsset, setSelectedAsset] = useState<LearningMaterial | null>(null);
  const [readerMode, setReaderMode] = useState<'google' | 'native'>('google');
  const [isBriefingLoading, setIsBriefingLoading] = useState(false);
  const [isBriefingPlaying, setIsBriefingPlaying] = useState(false);
  const [materials, setMaterials] = useState<LearningMaterial[]>([]);
  const [examResults, setExamResults] = useState<ExamResult[]>([]);
  const [readerError, setReaderError] = useState(false);
  const [curriculum, setCurriculum] = useState<Record<string, Record<string, string[]>>>(PROGRAMS_DATA);
  const [sysConfig, setSysConfig] = useState<SystemSettings | null>(null);
  
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [uploadData, setUploadData] = useState<Partial<LearningMaterial>>({
    title: '', 
    description: '',
    category: 'Textbook', 
    subject: '', 
    unit: '',
    type: 'pdf',
    program: user.program || 'Common',
    council: user.council || 'NPC'
  });
  const [tempFile, setTempFile] = useState<File | null>(null);

  // MASTERY LOGIC: Determine highest cleared unit
  const masteryLevel = useMemo(() => {
    if (user.role !== UserRole.STUDENT) return 999; // Admins/Instructors have full clearance
    
    const passedUnits = new Set<number>();
    examResults.forEach(res => {
      // Extract numeric unit (e.g., "Unit 1" -> 1)
      const unitMatch = String(res.unit).match(/\d+/);
      const unitNum = unitMatch ? parseInt(unitMatch[0]) : 0;
      if (unitNum > 0 && res.percentage >= 70) {
        passedUnits.add(unitNum);
      }
    });

    // Progression loop: Check if sequence 1, 2, 3... is broken
    let currentMax = 1; // Unit 1 is always unlocked
    while (passedUnits.has(currentMax)) {
      currentMax++;
    }
    return currentMax;
  }, [examResults, user.role]);

  useEffect(() => {
    const fetchLiveCurriculum = async () => {
      const data = await getCurriculum();
      if (data) setCurriculum(data);
    };
    const fetchConfig = async () => {
      const snap = await getDoc(doc(db, 'system', 'config'));
      if (snap.exists()) setSysConfig(snap.data() as SystemSettings);
    };
    fetchLiveCurriculum();
    fetchConfig();

    if (user.role === UserRole.STUDENT) {
      const qResults = query(collection(db, 'exam_results'), where('userId', '==', user.id));
      const unsubResults = onSnapshot(qResults, (snap) => {
        setExamResults(snap.docs.map(d => d.data() as ExamResult));
      });
      return () => unsubResults();
    }
  }, [user.id, user.role]);

  useEffect(() => {
    const timer = setTimeout(() => setDeferredSearch(searchQuery), 350);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    const q = query(collection(db, 'materials'), orderBy('uploadDate', 'desc'));
    const unsub = onSnapshot(q, (snapshot) => {
      const allData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LearningMaterial));
      
      const userProg = user.program?.toLowerCase();
      const userCouncil = user.council?.toLowerCase();

      setMaterials(user.role === UserRole.STUDENT 
        ? allData.filter(m => {
            const mProg = m.program?.toLowerCase();
            const mCouncil = m.council?.toLowerCase();
            const isApproved = m.status === 'approved';
            const isGlobal = mProg === 'all programs' || mProg === 'common';
            const isMatch = (userProg && mProg === userProg) || (userCouncil && mCouncil === userCouncil);
            return isApproved && (isGlobal || isMatch);
          })
        : allData.filter(m => m.status === 'approved' || m.uploadedBy === user.id || user.role === UserRole.ADMIN)
      );
    }, (err) => {
      console.warn("Library synchronization deferred:", err);
    });
    return () => unsub();
  }, [user.id, user.program, user.council, user.role]);

  const activePrograms = useMemo(() => {
    const allProgs = Object.values(curriculum).flatMap(c => Object.values(c).flat());
    if (sysConfig?.enabledPrograms) {
      return allProgs.filter(p => sysConfig.enabledPrograms![p] !== false);
    }
    return allProgs;
  }, [curriculum, sysConfig]);

  const handleListenBriefing = async (material: LearningMaterial) => {
    if (isBriefingPlaying) return;
    setIsBriefingLoading(true);
    try {
      if (!audioContextRef.current) audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      const base64Audio = await generateAudioBriefing(`Briefing for ${material.title}. Description: ${material.description || 'No additional details.'}`);
      if (base64Audio) {
        const bytes = Uint8Array.from(atob(base64Audio), c => c.charCodeAt(0));
        const audioBuffer = await decodeRawPCM(bytes, audioContextRef.current, 24000);
        const source = audioContextRef.current.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioContextRef.current.destination);
        source.onended = () => setIsBriefingPlaying(false);
        setIsBriefingPlaying(true);
        source.start(0);
      }
    } catch (e) { alert("Audio Node failure."); }
    finally { setIsBriefingLoading(false); }
  };

  const handleDownload = (material: LearningMaterial) => {
    const url = sanitizeUrl(material.url);
    window.open(url, '_blank');
  };

  const handleUploadSubmit = async () => {
    if ((uploadData.type !== 'video' && !tempFile) || !uploadData.title) return;
    setIsUploading(true);
    try {
      let finalUrl = uploadData.url || '';
      if (uploadData.type !== 'video' && tempFile) {
        finalUrl = await uploadToBunny(tempFile, 'library', (p) => setUploadProgress(p));
      }
      
      await publishLearningMaterial({
        ...uploadData, 
        url: finalUrl,
        uploadedBy: user.id, 
        status: user.role === UserRole.ADMIN ? 'approved' : 'pending'
      });
      setIsUploadModalOpen(false);
      setTempFile(null);
    } catch (e) { alert("Sync error."); }
    finally { setIsUploading(false); }
  };

  const filteredList = useMemo(() => {
    return materials
      .filter(i => (activeCat === 'All' || i.type === activeCat.toLowerCase() || i.category === activeCat))
      .filter(i => !deferredSearch || i.title.toLowerCase().includes(deferredSearch.toLowerCase()));
  }, [materials, activeCat, deferredSearch]);

  const categories = ['All', 'Textbook', 'Notes', 'PPT', 'Handout', 'Video', 'Syllabus', 'Research'];

  const getTypeIcon = (type: string) => {
    switch(type) {
      case 'video': return '📽️';
      case 'ppt': return '📊';
      case 'handout': return '📝';
      case 'notes': return '📑';
      case 'book': return '📚';
      default: return '📄';
    }
  };

  const readerSource = useMemo(() => {
    if (!selectedAsset) return '';
    const sourceUrl = sanitizeUrl(selectedAsset.url);
    if (readerMode === 'google') return `https://docs.google.com/viewer?url=${encodeURIComponent(sourceUrl)}&embedded=true`;
    return sourceUrl;
  }, [selectedAsset, readerMode]);

  const renderReader = () => {
    if (!selectedAsset) return null;
    if (selectedAsset.type === 'video') {
       return createPortal(
          <div className="fixed inset-0 z-[9999] bg-slate-950/95 backdrop-blur-3xl flex flex-col items-center justify-center p-4">
             <button onClick={() => setSelectedAsset(null)} className="absolute top-8 right-8 w-14 h-14 bg-white/10 rounded-full flex items-center justify-center text-white hover:bg-red-600 transition-all">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18 6L6 18M6 6l12 12"/></svg>
             </button>
             <div className="w-full max-w-5xl aspect-video bg-black rounded-[48px] overflow-hidden shadow-[0_50px_100px_rgba(0,0,0,0.5)] border border-white/5">
                <iframe src={selectedAsset.url.includes('youtube') ? selectedAsset.url.replace('watch?v=', 'embed/') : selectedAsset.url} className="w-full h-full" allowFullScreen></iframe>
             </div>
             <h3 className="mt-8 text-2xl font-black text-white uppercase italic">{selectedAsset.title}</h3>
          </div>,
          document.body
       );
    }

    return createPortal(
      <div className="fixed inset-0 z-[10000] bg-slate-950 flex flex-col h-screen w-screen overflow-hidden animate-in">
        <div className="absolute top-0 left-0 right-0 p-4 md:p-6 flex justify-between items-start pointer-events-none z-[10001]">
          <div className="bg-slate-900/80 backdrop-blur-xl border border-white/10 px-4 md:px-6 py-2.5 md:py-3.5 rounded-2xl md:rounded-3xl pointer-events-auto shadow-2xl flex flex-col gap-0.5">
            <p className="text-blue-500 text-[7px] md:text-[8px] font-black uppercase tracking-[0.3em] leading-none">Intelligence Node</p>
            <h2 className="text-white text-[10px] md:text-xs font-black uppercase tracking-tight truncate max-w-[150px] md:max-w-xs">{selectedAsset.title}</h2>
          </div>
          <div className="flex items-center gap-3 pointer-events-auto">
            <div className="hidden sm:flex bg-slate-900/80 backdrop-blur-xl p-1.5 rounded-2xl border border-white/10 shadow-2xl">
              <button onClick={() => setReaderMode('google')} className={`px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${readerMode === 'google' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>Google</button>
              <button onClick={() => setReaderMode('native')} className={`px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${readerMode === 'native' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>Native</button>
            </div>
            <button onClick={() => setSelectedAsset(null)} className="w-12 h-12 md:w-16 md:h-16 bg-red-600 hover:bg-red-700 text-white rounded-2xl md:rounded-3xl flex items-center justify-center transition-all active:scale-90 shadow-[0_20px_50px_rgba(220,38,38,0.4)] border border-red-500/50">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
          </div>
        </div>
        <div className="flex-1 w-full h-full bg-slate-950 relative overflow-hidden flex items-center justify-center pt-safe pb-safe">
           {!readerError ? (
             <div className="w-full h-full flex items-center justify-center bg-slate-900 overflow-hidden">
               {readerMode === 'google' ? (
                 <iframe src={readerSource} className="w-full h-full border-none bg-white" title="Reader" loading="eager" onError={() => setReaderError(true)} />
               ) : (
                 <object data={readerSource} type="application/pdf" className="w-full h-full">
                   <div className="flex flex-col items-center justify-center h-full text-white p-8">
                      <p className="text-xs uppercase font-black tracking-widest opacity-50 mb-6">Native Link Fault</p>
                      <button onClick={() => setReaderMode('google')} className="px-8 py-4 bg-blue-600 rounded-2xl font-black uppercase text-[10px] tracking-widest">Switch to Google Engine</button>
                   </div>
                 </object>
               )}
             </div>
           ) : (
             <div className="flex flex-col items-center justify-center text-center p-8 space-y-6">
                <div className="text-5xl">🛰️</div>
                <h3 className="text-xl font-black text-white uppercase italic">Handshake Timeout</h3>
                <p className="text-slate-400 text-xs max-w-xs font-bold uppercase tracking-widest leading-loose">The intelligence engine is struggling to render this node. Use the direct link to bypass the cloud viewer.</p>
                <button onClick={() => handleDownload(selectedAsset!)} className="px-10 py-5 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl">Launch External Node</button>
             </div>
           )}
        </div>
        <MaterialWatermark user={user} />
      </div>,
      document.body
    );
  };

  return (
    <div className="space-y-6 animate-in pb-32 max-w-7xl mx-auto px-4 md:px-0">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <p className="text-blue-600 text-[10px] font-black uppercase tracking-[0.4em]">Resource Repository</p>
            {user.role === UserRole.STUDENT && (
              <span className="px-2 py-0.5 bg-blue-500/10 text-blue-500 text-[8px] font-black rounded uppercase tracking-widest">Unit {masteryLevel} Active</span>
            )}
          </div>
          <h1 className="text-3xl md:text-5xl font-black uppercase text-slate-900 dark:text-white leading-none italic">Academic Library</h1>
        </div>
        {user.role !== UserRole.STUDENT && (
          <button onClick={() => setIsUploadModalOpen(true)} className="w-full md:w-auto px-8 py-4 bg-blue-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-2xl">Provision Asset</button>
        )}
      </header>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1 flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {categories.map(cat => (
            <button key={cat} onClick={() => setActiveCat(cat)} className={`px-6 py-2.5 rounded-full whitespace-nowrap text-[9px] font-black uppercase tracking-widest border transition-all ${activeCat === cat ? 'bg-blue-600 border-blue-600 text-white shadow-lg' : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-500'}`}>{cat}</button>
          ))}
        </div>
        <div className="bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-xl px-4 flex items-center w-full md:w-64 h-12 shadow-inner">
          <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search Terminal..." className="bg-transparent border-none focus:ring-0 text-[10px] font-bold uppercase w-full dark:text-white" />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredList.map((item) => {
          const unitMatch = String(item.unit).match(/\d+/);
          const unitNum = unitMatch ? parseInt(unitMatch[0]) : 1;
          const isLocked = user.role === UserRole.STUDENT && unitNum > masteryLevel;

          return (
            <div key={item.id} className={`bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-8 rounded-[40px] group transition-all flex flex-col shadow-sm relative overflow-hidden ${isLocked ? 'grayscale opacity-60 cursor-not-allowed' : 'hover:border-blue-500/50'}`}>
              {isLocked && (
                <div className="absolute inset-0 z-40 bg-slate-950/20 backdrop-blur-[2px] flex flex-col items-center justify-center text-center p-6">
                   <div className="w-14 h-14 bg-slate-900/80 rounded-2xl flex items-center justify-center text-2xl shadow-xl border border-white/10 mb-4">🔒</div>
                   <p className="text-[9px] font-black text-white uppercase tracking-[0.2em]">Clear Unit {unitNum - 1} Prerequisite</p>
                </div>
              )}
              
              <div className="flex justify-between items-start mb-6 relative z-10">
                <div className="w-12 h-12 rounded-2xl bg-blue-600/10 flex items-center justify-center text-xl">{getTypeIcon(item.type)}</div>
                <button 
                  onClick={() => !isLocked && handleListenBriefing(item)} 
                  disabled={isBriefingLoading || isLocked} 
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all ${isBriefingPlaying ? 'bg-green-600 text-white border-green-500 animate-pulse' : 'bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-blue-600'}`}
                >
                  <span className="text-xs">{isBriefingLoading ? '⏳' : isBriefingPlaying ? '🔊' : '🎙️'}</span>
                  <span className="text-[8px] font-black uppercase tracking-widest">{isBriefingPlaying ? 'Playing' : 'Briefing'}</span>
                </button>
              </div>
              <div className="mb-6 flex-1 relative z-10">
                <div className="flex gap-2 mb-3">
                   <span className={`px-2 py-0.5 text-[7px] font-black rounded uppercase tracking-widest ${unitNum === masteryLevel ? 'bg-blue-600 text-white animate-pulse' : 'bg-blue-50 dark:bg-blue-900/30 text-blue-600'}`}>UNIT {item.unit || 'X'}</span>
                   <span className="px-2 py-0.5 bg-slate-50 dark:bg-slate-800 text-slate-500 text-[7px] font-black rounded uppercase tracking-widest">{item.subject}</span>
                </div>
                <h3 className="text-xl font-black text-slate-900 dark:text-white leading-tight uppercase mb-2 line-clamp-2">{item.title}</h3>
                <p className="text-[10px] font-medium text-slate-400 line-clamp-2 leading-relaxed">{item.description || 'Synchronized academic material.'}</p>
              </div>
              <div className="flex gap-2 relative z-10">
                <button onClick={() => { if(!isLocked) { setReaderError(false); setSelectedAsset(item); } }} disabled={isLocked} className="flex-1 py-4 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white rounded-2xl font-black uppercase text-[9px] tracking-widest hover:bg-blue-600 hover:text-white transition-all shadow-sm disabled:opacity-30">
                  {item.type === 'video' ? 'Play Stream' : 'Open Terminal'}
                </button>
                <button onClick={() => !isLocked && handleDownload(item)} disabled={isLocked} className="w-14 h-14 bg-blue-600/10 text-blue-600 rounded-2xl flex items-center justify-center hover:bg-blue-600 hover:text-white transition-all shadow-sm disabled:opacity-30">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
                </button>
              </div>
              <MaterialWatermark user={user} />
            </div>
          );
        })}
      </div>

      {isUploadModalOpen && (
        <div className="fixed inset-0 z-[3000] bg-slate-950 md:bg-slate-950/90 md:backdrop-blur-xl flex items-center justify-center">
           <div className="bg-white dark:bg-slate-900 w-full h-full md:h-auto md:max-h-[95vh] md:max-w-2xl md:rounded-[48px] overflow-hidden md:border border-slate-100 dark:border-slate-800 p-6 md:p-10 space-y-4 md:space-y-6 flex flex-col">
              <div className="flex justify-between items-center shrink-0">
                 <div>
                    <h3 className="text-xl md:text-2xl font-black uppercase dark:text-white italic tracking-tighter leading-tight">Provision Asset</h3>
                    <p className="text-[7px] md:text-[9px] font-black text-blue-500 uppercase tracking-widest mt-0.5">Academic Material Uplink</p>
                 </div>
                 <button onClick={() => setIsUploadModalOpen(false)} className="w-10 h-10 md:w-12 md:h-12 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center text-slate-400 hover:text-red-500 transition-colors">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18 6L6 18M6 6l12 12"/></svg>
                 </button>
              </div>

              <div className="flex-1 overflow-y-auto pr-1 scrollbar-hide space-y-6 pb-20 md:pb-0">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                   <div className="space-y-3 md:space-y-4">
                      <label className="text-[7px] md:text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Asset Metadata</label>
                      <input value={uploadData.title} onChange={e => setUploadData({...uploadData, title: e.target.value})} className="w-full h-12 md:h-14 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-xl px-4 md:px-6 text-xs md:text-sm font-bold dark:text-white outline-none" placeholder="Asset Title" />
                      <input value={uploadData.subject} onChange={e => setUploadData({...uploadData, subject: e.target.value})} className="w-full h-12 md:h-14 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-xl px-4 md:px-6 text-xs md:text-sm font-bold dark:text-white outline-none" placeholder="Subject Node" />
                      <div className="grid grid-cols-2 gap-3 md:gap-4">
                         <input value={uploadData.unit} onChange={e => setUploadData({...uploadData, unit: e.target.value})} className="w-full h-12 md:h-14 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-xl px-4 md:px-6 text-xs md:text-sm font-bold dark:text-white outline-none" placeholder="Unit #" />
                         <select value={uploadData.type} onChange={e => setUploadData({...uploadData, type: e.target.value as any})} className="w-full h-12 md:h-14 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-xl px-4 md:px-6 text-[9px] md:text-xs font-black uppercase dark:text-white outline-none">
                            <option value="pdf">PDF Doc</option>
                            <option value="video">Video Link</option>
                            <option value="ppt">PPT Deck</option>
                            <option value="handout">Handout</option>
                            <option value="book">Textbook</option>
                         </select>
                      </div>
                   </div>

                   <div className="space-y-3 md:space-y-4">
                      <label className="text-[7px] md:text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Distribution Hub</label>
                      <select value={uploadData.program} onChange={e => setUploadData({...uploadData, program: e.target.value})} className="w-full h-12 md:h-14 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-xl px-4 md:px-6 text-[8px] md:text-[10px] font-black uppercase dark:text-white outline-none">
                         <option value="All Programs">All Programs</option>
                         {activePrograms.map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                      <textarea value={uploadData.description} onChange={e => setUploadData({...uploadData, description: e.target.value})} className="w-full h-24 md:h-28 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-xl p-4 md:p-6 text-[10px] md:text-xs font-bold dark:text-white outline-none resize-none" placeholder="Academic context / description..." />
                   </div>
                </div>

                {uploadData.type === 'video' ? (
                   <input value={uploadData.url} onChange={e => setUploadData({...uploadData, url: e.target.value})} className="w-full h-12 md:h-14 bg-blue-50/30 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 rounded-xl px-4 md:px-6 text-xs md:text-sm font-bold dark:text-white outline-none" placeholder="Video Stream URL (YouTube/Vimeo)" />
                ) : (
                  <div onClick={() => fileInputRef.current?.click()} className="w-full h-24 md:h-32 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl md:rounded-3xl flex flex-col items-center justify-center cursor-pointer bg-slate-50 dark:bg-slate-950/50 hover:border-blue-500 transition-all">
                     <input ref={fileInputRef} type="file" className="hidden" accept=".pdf,.ppt,.pptx" onChange={e => setTempFile(e.target.files?.[0] || null)} />
                     <p className="text-[8px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest px-4 text-center truncate w-full">{tempFile ? tempFile.name : 'Drop Asset Node (PDF/PPT)'}</p>
                  </div>
                )}

                {isUploading && (
                  <div className="space-y-1 md:space-y-2">
                     <div className="flex justify-between items-center"><span className="text-[7px] md:text-[8px] font-black uppercase text-blue-500">Transmitting Data</span><span className="text-[7px] md:text-[8px] font-black text-blue-500">{uploadProgress}%</span></div>
                     <div className="h-1 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-600 transition-all duration-300" style={{ width: `${uploadProgress}%` }}></div>
                     </div>
                  </div>
                )}
              </div>

              <div className="shrink-0 pt-2">
                <button onClick={handleUploadSubmit} disabled={isUploading || (!tempFile && uploadData.type !== 'video')} className="w-full h-14 md:h-16 bg-blue-600 text-white rounded-xl md:rounded-2xl font-black uppercase text-[9px] md:text-[10px] tracking-widest shadow-xl active:scale-95 disabled:opacity-50 transition-all">
                  {isUploading ? 'SYNCHRONIZING...' : 'INITIALIZE BROADCAST'}
                </button>
              </div>
           </div>
        </div>
      )}

      {renderReader()}
    </div>
  );
};

export default Library;
