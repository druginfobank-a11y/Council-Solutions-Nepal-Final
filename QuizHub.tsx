import React, { useState, useRef } from 'react';
import { User } from '../types';
import { generateAcademicScenario, analyzeAcademicImage, generateAcademicVideo } from '../services/geminiService';

import GovernmentDisclaimer from '../components/GovernmentDisclaimer';

interface PracticalLabProps { user: User; }

const PracticalLab: React.FC<PracticalLabProps> = ({ user }) => {
  const [labMode, setLabMode] = useState<'audit' | 'vision' | 'theatre'>('audit');
  const [scenario, setScenario] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');
  const [selectedDrug, setSelectedDrug] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ isCorrect: boolean; message: string } | null>(null);

  // Vision States
  const [visionImage, setVisionImage] = useState<File | null>(null);
  const [visionPreview, setVisionPreview] = useState<string | null>(null);
  const [visionQuery, setVisionQuery] = useState('Explain academic significance and suggest council-aligned study plan.');
  const [visionResult, setVisionResult] = useState<string | null>(null);
  const visionInputRef = useRef<HTMLInputElement>(null);

  // Theatre States
  const [theatrePrompt, setTheatrePrompt] = useState('An academic simulation of structural engineering showing correct load distribution.');
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  const startNewCase = async () => {
    setIsLoading(true);
    setFeedback(null);
    setSelectedDrug(null);
    try {
      const data = await generateAcademicScenario(user.program || 'General', user.council || 'General');
      setScenario(data);
    } catch (error) {
      alert("System failure. Neural link disrupted.");
    } finally { setIsLoading(false); }
  };

  const handleAudit = (drugId: string) => {
    if (!scenario || feedback) return;
    const drug = scenario.prescriptions.find((p: any) => p.id === drugId);
    setSelectedDrug(drugId);
    if (drug.isErroneous) setFeedback({ isCorrect: true, message: `CRITICAL FINDING: ${drug.errorDetail}` });
    else setFeedback({ isCorrect: false, message: `INCORRECT: ${drug.drug} is academically appropriate. Look closer.` });
  };

  const handleVisionAnalysis = async () => {
    if (!visionPreview || !visionImage) return;
    setIsLoading(true);
    setVisionResult(null);
    try {
      const result = await analyzeAcademicImage(visionPreview, visionImage.type, visionQuery);
      setVisionResult(result || "Analysis inconclusive.");
    } catch (e) {
      alert("Vision Node Error.");
    } finally { setIsLoading(false); }
  };

  const handleTheatreGenerate = async () => {
    if (!theatrePrompt.trim()) return;
    setIsLoading(true);
    setVideoUrl(null);
    try {
      const url = await generateAcademicVideo(theatrePrompt, setProgressMsg);
      setVideoUrl(url);
    } catch (e) {
      alert("Theatre Node failure.");
    } finally { setIsLoading(false); setProgressMsg(''); }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in pb-24 relative transition-colors">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-12">
        <div className="space-y-2">
          <p className="text-blue-600 dark:text-blue-400 text-[10px] font-black uppercase tracking-[0.4em] mb-1">Academic Lab Node</p>
          <h1 className="text-3xl md:text-5xl font-black tracking-tight leading-none text-slate-900 dark:text-white uppercase italic">
            {labMode === 'audit' ? 'Audit Lab' : labMode === 'vision' ? 'Vision Lab' : 'Theatre'}
          </h1>
        </div>
        <div className="flex bg-slate-100 dark:bg-slate-900 p-1.5 rounded-[24px] border border-slate-200 dark:border-slate-800 shadow-sm overflow-x-auto scrollbar-hide">
           {(['audit', 'vision', 'theatre'] as const).map(mode => (
             <button 
               key={mode} 
               onClick={() => setLabMode(mode)}
               className={`px-6 py-2.5 rounded-full whitespace-nowrap text-[9px] font-black uppercase tracking-widest transition-all ${labMode === mode ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}
             >
               {mode}
             </button>
           ))}
        </div>
      </header>

      {labMode === 'audit' && scenario && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in">
           <div className="lg:col-span-12 flex justify-end mb-4">
              <button onClick={startNewCase} disabled={isLoading} className="bg-blue-600 text-white px-8 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl">Synthesize Case</button>
           </div>
           <div className="lg:col-span-4 space-y-6">
              <div className="bg-white dark:bg-slate-900 p-8 rounded-[40px] border border-slate-100 dark:border-slate-800">
                 <p className="text-[9px] font-black text-blue-500 uppercase mb-4">Patient HUD</p>
                 <h3 className="text-xl font-black dark:text-white uppercase mb-4">{scenario.patientName}</h3>
                 <p className="text-xs font-bold text-slate-500 leading-relaxed italic">"{scenario.history}"</p>
              </div>
           </div>
           <div className="lg:col-span-8 bg-slate-50 dark:bg-slate-900 p-8 rounded-[48px] border border-slate-200 dark:border-slate-800 shadow-inner">
              <h3 className="text-2xl font-serif italic mb-8">Study Orders</h3>
              <div className="space-y-4">
                 {scenario.prescriptions.map((p: any) => (
                    <button key={p.id} onClick={() => handleAudit(p.id)} className={`w-full text-left p-6 rounded-3xl border-2 transition-all ${selectedDrug === p.id ? (p.isErroneous ? 'bg-red-50 border-red-500' : 'bg-slate-100 border-slate-300') : 'bg-white dark:bg-slate-800 border-transparent hover:border-slate-200'}`}>
                       <h4 className="font-black dark:text-white uppercase">{p.drug}</h4>
                       <p className="text-xs text-slate-400 font-bold">{p.dose} • {p.frequency}</p>
                    </button>
                 ))}
              </div>
              {feedback && (
                <div className={`mt-8 p-6 rounded-2xl border-2 ${feedback.isCorrect ? 'bg-green-50 border-green-500 text-green-700' : 'bg-red-50 border-red-500 text-red-700'}`}>
                  <p className="text-[10px] font-black uppercase mb-1">{feedback.isCorrect ? '✓ Finding Confirmed' : '❌ Analysis Error'}</p>
                  <p className="text-xs font-bold">{feedback.message}</p>
                </div>
              )}
           </div>
        </div>
      )}

      {labMode === 'vision' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in">
           <div className="space-y-6">
              <div onClick={() => visionInputRef.current?.click()} className="w-full aspect-[4/3] bg-white dark:bg-slate-900 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-[48px] flex items-center justify-center cursor-pointer overflow-hidden group">
                 <input ref={visionInputRef} type="file" className="hidden" onChange={e => { const file = e.target.files?.[0]; if(file) { setVisionImage(file); const r = new FileReader(); r.onload = () => setVisionPreview(r.result as string); r.readAsDataURL(file); }}} />
                 {visionPreview ? <img src={visionPreview} className="w-full h-full object-contain" /> : <div className="text-center"><span className="text-4xl block mb-2">📸</span><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Attach Academic Image</p></div>}
              </div>
              <textarea value={visionQuery} onChange={e => setVisionQuery(e.target.value)} className="w-full h-24 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 text-xs font-bold dark:text-white outline-none" />
              <button onClick={handleVisionAnalysis} disabled={isLoading || !visionPreview} className="w-full py-5 bg-blue-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-blue-600/20 active:scale-95 disabled:opacity-50 transition-all">
                {isLoading ? 'Synchronizing Llama Vision...' : 'Initiate Llama Analysis'}
              </button>
           </div>
           <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-10 rounded-[56px] min-h-[300px] shadow-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 p-6">
                <span className="px-3 py-1 bg-purple-600 text-white text-[7px] font-black rounded-full uppercase tracking-widest">Llama 3.2 Vision Node</span>
              </div>
              <p className="text-xs font-black text-blue-500 uppercase tracking-widest mb-6">Neural Logic Report</p>
              <p className="text-sm font-medium leading-relaxed dark:text-slate-300 whitespace-pre-wrap">{visionResult || "Awaiting multi-modal satellite link..."}</p>
           </div>
        </div>
      )}

      {labMode === 'theatre' && (
        <div className="space-y-8 animate-in">
           <div className="bg-slate-950 border border-white/5 p-10 md:p-14 rounded-[56px] shadow-2xl relative overflow-hidden flex flex-col items-center text-center">
              <div className="absolute top-0 left-0 w-full h-full bg-blue-600/5 blur-[120px] pointer-events-none"></div>
              <div className="relative z-10 max-w-xl space-y-8">
                 <div className="w-20 h-20 bg-blue-600 rounded-3xl flex items-center justify-center text-4xl shadow-2xl mx-auto border border-white/10 animate-pulse">🎬</div>
                 <h2 className="text-3xl md:text-5xl font-black text-white uppercase tracking-tighter italic">Simulation Theatre</h2>
                 <p className="text-slate-400 text-xs font-bold uppercase tracking-widest leading-relaxed">Enter an academic scenario to generate a high-fidelity visualization using Veo 3.1 Node Architecture.</p>
                 
                 <div className="flex gap-3 bg-white/5 p-2 rounded-[32px] border border-white/10 focus-within:border-blue-500/50 transition-all shadow-inner">
                    <input value={theatrePrompt} onChange={e => setTheatrePrompt(e.target.value)} placeholder="Describe an academic procedure..." className="flex-1 bg-transparent border-none focus:ring-0 text-sm px-6 text-white placeholder-slate-700 font-bold" />
                    <button onClick={handleTheatreGenerate} disabled={isLoading} className="w-16 h-16 bg-blue-600 disabled:bg-slate-800 rounded-2xl flex items-center justify-center text-white shadow-2xl transition-all">
                       <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M5 3l14 9-14 9V3z"/></svg>
                    </button>
                 </div>

                 {isLoading && (
                   <div className="space-y-4 animate-in">
                      <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-600 animate-[progress_15s_ease-in-out_infinite]" style={{width: '60%'}}></div>
                      </div>
                      <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest">{progressMsg}</p>
                   </div>
                 )}
              </div>

              {videoUrl && (
                <div className="mt-12 w-full max-w-4xl aspect-video bg-black rounded-[40px] overflow-hidden border border-white/10 shadow-[0_0_100px_rgba(0,0,0,0.5)] animate-in">
                   <video src={videoUrl} controls className="w-full h-full object-cover" />
                </div>
              )}
           </div>
        </div>
      )}
      <style>{`@keyframes progress { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }`}</style>
      <div className="pb-10">
        <GovernmentDisclaimer />
      </div>
    </div>
  );
};

export default PracticalLab;