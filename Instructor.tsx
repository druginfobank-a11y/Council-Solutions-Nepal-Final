
import React, { useState } from 'react';

type CalcType = 'Efficiency' | 'Retention' | 'Pace' | 'Density' | 'Predictor' | 'Analytics';

const StudyTools: React.FC = () => {
  const [activeCalc, setActiveCalc] = useState<CalcType>('Efficiency');

  const [vals, setVals] = useState<any>({
    hours: 8, tasks: 10, readingTime: 60, complexity: 5, 
    questions: 50, time: 60,
    material: 100, mockScore: 75, consistency: 0.8
  });

  const calculateResult = () => {
    switch (activeCalc) {
      case 'Efficiency':
        const efficiency = (vals.hours / (vals.tasks || 1)) * 10;
        return { val: efficiency.toFixed(1), unit: 'Index', label: efficiency > 8 ? 'High Productivity' : efficiency > 5 ? 'Optimal' : 'Needs Focus', color: efficiency > 5 ? 'text-green-500' : 'text-orange-500' };
      case 'Retention':
        const retention = (vals.readingTime / (vals.complexity * 2 || 1)) * 1.5;
        return { val: Math.min(retention, 100).toFixed(1), unit: '%', label: "Estimated Retention", color: 'text-blue-500' };
      case 'Pace':
        const pace = vals.questions / (vals.time || 1);
        return { val: pace.toFixed(2), unit: 'Q/min', label: pace > 1 ? 'Fast' : pace > 0.5 ? 'Steady' : 'Slow', color: pace > 0.5 ? 'text-green-500' : 'text-red-500' };
      case 'Density':
        const density = vals.material / (vals.time * 0.5 || 1);
        return { val: density.toFixed(2), unit: 'Units/hr', label: 'Knowledge Load', color: 'text-blue-500' };
      case 'Predictor':
        const score = vals.mockScore * (vals.consistency + 0.2);
        return { val: Math.min(score, 100).toFixed(0), unit: '%', label: 'Predicted Grade', color: 'text-purple-500' };
      default:
        return { val: '--', unit: '', label: 'Select Analytics', color: 'text-slate-500' };
    }
  };

  const res = calculateResult();

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-10">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-3xl md:text-5xl font-black tracking-tight mb-2 text-white">Academic Tools</h1>
          <p className="text-slate-500 font-bold text-sm">Data-driven study analytics and performance calculators</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in">
        <div className="lg:col-span-4 grid grid-cols-3 md:grid-cols-2 gap-2 md:gap-3">
          {(['Efficiency', 'Retention', 'Pace', 'Density', 'Predictor', 'Analytics'] as CalcType[]).map(c => (
            <button
              key={c}
              onClick={() => setActiveCalc(c)}
              className={`p-3 md:p-4 rounded-[24px] md:rounded-[32px] border-2 transition-all flex flex-col items-center justify-center gap-1 md:gap-2 text-center ${activeCalc === c ? 'bg-blue-600/10 border-blue-500 text-blue-500 shadow-xl' : 'bg-slate-900 border-slate-800 text-slate-500 hover:border-slate-700'}`}
            >
              <span className="text-base md:text-xl">{c === 'Efficiency' ? '⚖️' : c === 'Retention' ? '🧠' : c === 'Pace' ? '⏱️' : c === 'Density' ? '📏' : c === 'Predictor' ? '📈' : '📊'}</span>
              <span className="text-[7px] md:text-[9px] font-black uppercase tracking-widest leading-none">{c}</span>
            </button>
          ))}
        </div>

        <div className="lg:col-span-8 bg-slate-900 border border-slate-800 p-6 md:p-10 rounded-[32px] md:rounded-[48px] shadow-2xl relative overflow-hidden">
           <div className="relative z-10 space-y-6 md:space-y-8">
              <header className="flex justify-between items-center">
                <h3 className="text-sm md:text-lg font-black uppercase tracking-widest">{activeCalc} Analysis</h3>
                <span className="px-2 py-0.5 bg-slate-800 rounded-full text-[7px] font-black text-slate-500 uppercase tracking-widest">Academic Alignment</span>
              </header>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                {activeCalc === 'Efficiency' ? (
                  <>
                    <div>
                      <label className="text-[8px] md:text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 md:mb-2 block ml-2">Study Hours</label>
                      <input type="number" value={vals.hours} onChange={e => setVals({...vals, hours: Number(e.target.value)})} className="w-full h-14 bg-slate-800/50 border border-white/5 rounded-2xl px-6 text-sm text-white focus:ring-1 ring-blue-500 outline-none"/>
                    </div>
                    <div>
                      <label className="text-[8px] md:text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 md:mb-2 block ml-2">Total Tasks</label>
                      <input type="number" value={vals.tasks} onChange={e => setVals({...vals, tasks: Number(e.target.value)})} className="w-full h-14 bg-slate-800/50 border border-white/5 rounded-2xl px-6 text-sm text-white focus:ring-1 ring-blue-500 outline-none"/>
                    </div>
                  </>
                ) : activeCalc === 'Retention' ? (
                  <>
                    <div>
                      <label className="text-[8px] md:text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 md:mb-2 block ml-2">Reading Time (min)</label>
                      <input type="number" value={vals.readingTime} onChange={e => setVals({...vals, readingTime: Number(e.target.value)})} className="w-full h-14 bg-slate-800/50 border border-white/5 rounded-2xl px-6 text-sm text-white outline-none"/>
                    </div>
                    <div>
                      <label className="text-[8px] md:text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 md:mb-2 block ml-2">Complexity (1-10)</label>
                      <input type="number" value={vals.complexity} onChange={e => setVals({...vals, complexity: Number(e.target.value)})} className="w-full h-14 bg-slate-800/50 border border-white/5 rounded-2xl px-6 text-sm text-white outline-none"/>
                    </div>
                  </>
                ) : activeCalc === 'Pace' ? (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[8px] md:text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 block ml-2">Questions</label>
                        <input type="number" value={vals.questions} onChange={e => setVals({...vals, questions: Number(e.target.value)})} className="w-full h-14 bg-slate-800/50 border border-white/5 rounded-2xl px-4 text-sm text-white outline-none"/>
                      </div>
                      <div>
                        <label className="text-[8px] md:text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 block ml-2">Time (min)</label>
                        <input type="number" value={vals.time} onChange={e => setVals({...vals, time: Number(e.target.value)})} className="w-full h-14 bg-slate-800/50 border border-white/5 rounded-2xl px-4 text-sm text-white outline-none"/>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="md:col-span-2 py-6 text-center text-slate-500 text-xs font-bold italic px-4">Specialized Analytics synchronizing...</div>
                )}
              </div>

              <div className="pt-6 border-t border-slate-800 flex flex-col items-center text-center gap-4">
                 <div>
                    <p className="text-[8px] md:text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Calculated Output</p>
                    <div className="flex items-baseline justify-center gap-2">
                      <p className={`text-4xl md:text-6xl font-black tracking-tight ${res.color}`}>{res.val}</p>
                      <p className="text-slate-400 font-bold text-xs md:text-sm">{res.unit}</p>
                    </div>
                 </div>
                 <div className="bg-slate-800/50 p-4 rounded-2xl border border-white/5 w-full max-w-xs">
                    <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-0.5">Academic Classification</p>
                    <p className={`font-black uppercase tracking-widest text-[10px] ${res.color}`}>{res.label}</p>
                 </div>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};

export default StudyTools;
