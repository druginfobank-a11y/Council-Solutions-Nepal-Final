
import React, { useState } from 'react';
import { GoogleGenAI } from "@google/genai";

const PatientSimulator: React.FC = () => {
  const [sessionActive, setSessionActive] = useState(false);
  const [messages, setMessages] = useState<{role: string, content: string}[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const startScenario = async () => {
    setSessionActive(true);
    setIsLoading(true);
    // Initialize GoogleGenAI right before the API call as per guidelines
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    try {
      // Use gemini-3.1-pro-preview for complex academic task simulation
      const response = await ai.models.generateContent({
        model: 'gemini-3.1-pro-preview',
        contents: "Start an academic simulation. You are a 45-year-old patient named 'Biraj' presenting at a pharmacy in Kathmandu with severe chest pain. Only describe your symptoms and wait for my questions. Do not give the diagnosis yet.",
        config: { systemInstruction: "Act as a realistic patient in an academic setting. Be vague about symptoms to encourage questioning. Use typical Nepalese patient descriptions of pain if appropriate." }
      });
      // Store AI response with 'model' role
      setMessages([{ role: 'model', content: response.text || "Hello... I'm feeling very unwell." }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAction = async () => {
    if (!input.trim() || isLoading) return;
    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setIsLoading(true);

    // Initialize GoogleGenAI right before the API call as per guidelines
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    try {
      // Use gemini-3.1-pro-preview for advanced medical context reasoning during multi-turn simulation
      const response = await ai.models.generateContent({
        model: 'gemini-3.1-pro-preview',
        contents: [
          ...messages.map(m => ({ 
            parts: [{ text: m.content }], 
            role: m.role === 'model' ? 'model' : 'user' 
          })), 
          { parts: [{ text: userMsg }], role: 'user' }
        ],
      });
      // Append model response using the correct 'model' role
      setMessages(prev => [...prev, { role: 'model', content: response.text || "..." }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-[calc(100vh-14rem)] flex flex-col space-y-6">
      {!sessionActive ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-slate-900 border border-slate-800 rounded-[48px] shadow-2xl max-w-2xl mx-auto">
           <div className="w-24 h-24 bg-red-600/10 rounded-[40px] flex items-center justify-center text-4xl mb-8 border border-red-500/20 shadow-2xl">🚑</div>
           <h2 className="text-3xl font-black mb-4 tracking-tight">Virtual Patient Simulator</h2>
           <p className="text-slate-400 text-sm mb-10 leading-relaxed">
             Test your academic reasoning against AI-powered patient avatars. Interview, diagnose, and treat in a risk-free environment.
           </p>
           <button 
             onClick={startScenario}
             className="bg-blue-600 hover:bg-blue-700 text-white px-12 py-4 rounded-3xl font-black uppercase tracking-widest text-xs shadow-2xl shadow-blue-600/30 active:scale-95 transition-all"
           >
             START NEW SESSION
           </button>
        </div>
      ) : (
        <div className="flex-1 flex flex-col bg-slate-900 border border-slate-800 rounded-[40px] overflow-hidden shadow-2xl">
          <header className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-800/30">
             <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-slate-800 flex items-center justify-center text-2xl border border-white/5">👨🏽</div>
                <div>
                   <h3 className="font-bold">Patient: Biraj M.</h3>
                   <p className="text-[10px] text-red-500 font-black uppercase tracking-widest flex items-center gap-1">
                     <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span> Critical Case
                   </p>
                </div>
             </div>
             <button onClick={() => setSessionActive(false)} className="text-[10px] font-black text-slate-500 uppercase tracking-widest hover:text-white transition-colors">Terminate</button>
          </header>

          <div className="flex-1 overflow-y-auto p-8 space-y-6 scrollbar-hide">
             {messages.map((m, i) => (
               <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                 <div className={`max-w-[80%] p-6 rounded-[32px] ${m.role === 'user' ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-slate-800 text-slate-200 rounded-tl-none border border-slate-700'}`}>
                    <p className="text-sm font-medium leading-relaxed">{m.content}</p>
                 </div>
               </div>
             ))}
             {isLoading && (
               <div className="flex justify-start">
                  <div className="bg-slate-800/50 p-4 rounded-2xl animate-pulse flex gap-2">
                     <div className="w-1.5 h-1.5 bg-slate-500 rounded-full"></div>
                     <div className="w-1.5 h-1.5 bg-slate-500 rounded-full"></div>
                  </div>
               </div>
             )}
          </div>

          <footer className="p-6 border-t border-slate-800 bg-slate-900/50">
             <div className="flex gap-3 bg-slate-800 p-2 rounded-2xl border border-white/5 focus-within:ring-2 ring-blue-500 transition-all">
                <input 
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAction()}
                  placeholder="Ask an academic question (e.g. 'How long has it been hurting?')"
                  className="flex-1 bg-transparent border-none focus:ring-0 text-sm px-4 text-white placeholder-slate-500"
                />
                <button onClick={handleAction} className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-xl shadow-blue-600/20 active:scale-95">
                   <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                </button>
             </div>
          </footer>
        </div>
      )}
    </div>
  );
};

export default PatientSimulator;
