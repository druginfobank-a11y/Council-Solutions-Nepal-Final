
import React, { useState } from 'react';

const AnatomyLab: React.FC = () => {
  const [selectedPart, setSelectedPart] = useState<string | null>(null);

  const anatomyFacts = {
    'Heart': { fact: 'Left Ventricle is the thickest chamber. Blood supply is primarily via LCA and RCA.', correlation: 'Myocardial Infarction common in LAD branch.' },
    'Lungs': { fact: 'Right lung has 3 lobes, Left has 2. Base sits on the Diaphragm.', correlation: 'Aspiration more common in Right Main Bronchus due to steep angle.' },
    'Kidneys': { fact: 'Retroperitoneal organs. Functional unit is the Nephron.', correlation: 'ACE Inhibitors protect efferent arteriole in Diabetic Nephropathy.' }
  };

  return (
    <div className="h-[calc(100vh-14rem)] flex flex-col lg:flex-row gap-8 animate-in">
       {/* Visual Interface */}
       <div className="flex-1 bg-slate-900 border border-slate-800 rounded-[48px] shadow-2xl relative overflow-hidden flex flex-col items-center justify-center p-12">
          <div className="absolute top-0 left-0 p-8">
             <h2 className="text-2xl font-black uppercase tracking-tight">Anatomy Lab</h2>
             <p className="text-[10px] text-blue-500 font-black uppercase tracking-widest">3D Study Environment</p>
          </div>
          
          <div className="relative w-full max-w-sm aspect-square flex flex-col gap-4">
             {Object.keys(anatomyFacts).map((part) => (
               <button 
                 key={part}
                 onClick={() => setSelectedPart(part)}
                 className={`w-full py-8 rounded-[32px] border-2 transition-all font-black uppercase tracking-widest text-sm flex items-center justify-center gap-4 ${selectedPart === part ? 'bg-blue-600 border-blue-500 shadow-2xl shadow-blue-600/20 scale-105' : 'bg-slate-800 border-white/5 text-slate-500 hover:border-slate-700'}`}
               >
                 <span>{part === 'Heart' ? '❤️' : part === 'Lungs' ? '🫁' : '🫘'}</span>
                 {part} Module
               </button>
             ))}
          </div>

          <div className="mt-12 p-6 bg-slate-800/50 rounded-3xl border border-white/5 text-center max-w-sm">
             <p className="text-xs text-slate-500 font-bold leading-relaxed">Rotate and pinch to zoom academic landmarks. High-yield points are marked with blue nodes.</p>
          </div>
       </div>

       {/* Fact Sheet */}
       <div className="w-full lg:w-96 bg-slate-900 border border-slate-800 rounded-[48px] shadow-2xl p-8 flex flex-col">
          {selectedPart ? (
            <div className="space-y-8 animate-in">
               <header>
                  <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-1">Anatomy Detail</p>
                  <h3 className="text-3xl font-black tracking-tight">{selectedPart.toUpperCase()}</h3>
               </header>

               <div className="space-y-6">
                  <div className="bg-slate-800/50 p-6 rounded-3xl border border-white/5">
                     <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">Academic Fact</p>
                     <p className="text-sm font-medium text-slate-200 leading-relaxed">{(anatomyFacts as any)[selectedPart].fact}</p>
                  </div>
                  <div className="bg-orange-500/5 p-6 rounded-3xl border border-orange-500/20">
                     <p className="text-[9px] font-black text-orange-500 uppercase tracking-widest mb-2">Academic Correlation</p>
                     <p className="text-sm font-bold text-slate-300 leading-relaxed">{(anatomyFacts as any)[selectedPart].correlation}</p>
                  </div>
               </div>

               <button className="w-full bg-blue-600 py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-lg active:scale-95 transition-all">View Histology</button>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center opacity-30">
               <div className="text-5xl mb-4">🔬</div>
               <p className="font-bold text-sm">Select an organ to load high-yield academic facts</p>
            </div>
          )}
       </div>
    </div>
  );
};

export default AnatomyLab;
