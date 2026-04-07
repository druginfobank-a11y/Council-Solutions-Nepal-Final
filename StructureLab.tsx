
import React, { useState, useMemo } from 'react';
import GovernmentDisclaimer from '../components/GovernmentDisclaimer';
import * as ReactRouter from 'react-router-dom';
import { User } from '../types';
import { checkTechnicalInteraction, generateSolutionMatrix, generateStudyPlan, generateTechnicalDerivation } from '../services/geminiService';

const { useNavigate } = ReactRouter as any;

const ProgramHub: React.FC<{ user: User }> = ({ user }) => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [activeSubTab, setActiveSubTab] = useState<'tools' | 'emergency'>('tools');
  
  const isEng = user.council === 'NEC';
  const isMaster = user.level === 'Master' && (user.council === 'NMC' || user.council === 'NEC');
  
  const [componentA, setComponentA] = useState('');
  const [componentB, setComponentB] = useState('');
  const [problemStatement, setProblemStatement] = useState('');
  const [academicObjective, setAcademicObjective] = useState('');
  
  // Engineering Specific States
  const [formulaQuery, setFormulaQuery] = useState('');

  const handleNPCAction = async () => {
    if (!componentA || !componentB) return;
    setIsLoading(true);
    setResult(null);
    try {
      const data = await checkTechnicalInteraction(componentA, componentB);
      setResult(data);
    } catch (e) { alert("Interaction engine offline."); }
    finally { setIsLoading(false); }
  };

  const handleNMCAction = async () => {
    if (!problemStatement) return;
    setIsLoading(true);
    setResult(null);
    try {
      const context = isMaster ? `POSTGRADUATE_LEVEL: Specialization ${user.program}. Focus on advanced complexity.` : '';
      const data = await generateSolutionMatrix(`${context}\nProblem: ${problemStatement}`);
      setResult(data);
    } catch (e) { alert("Diagnostic engine offline."); }
    finally { setIsLoading(false); }
  };

  const handleNNCAction = async () => {
    if (!academicObjective) return;
    setIsLoading(true);
    setResult(null);
    try {
      const data = await generateStudyPlan(academicObjective);
      setResult(data);
    } catch (e) { alert("Care Synth engine offline."); }
    finally { setIsLoading(false); }
  };

  const handleNECAction = async () => {
    if (!formulaQuery) return;
    setIsLoading(true);
    setResult(null);
    try {
      // Re-using derivation generator for technical derivations
      const data = await generateTechnicalDerivation(`ENGINEERING_DERIVATION: ${formulaQuery}. Return steps, formula, and applications.`);
      setResult(data);
    } catch (e) { alert("Logic Engine Offline."); }
    finally { setIsLoading(false); }
  };

  const renderNEC = () => (
    <div className="space-y-6 animate-in">
      <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-8 rounded-[40px] shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10 text-6xl">⚙️</div>
        <h2 className="text-2xl font-black uppercase tracking-tight mb-6 text-slate-900 dark:text-white">Engineering Logic Synthesizer</h2>
        <div className="space-y-4">
           <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Derivation Query / Structural Analysis</label>
           <textarea 
            value={formulaQuery} 
            onChange={e => setFormulaQuery(e.target.value)} 
            placeholder="e.g. Derive bending stress for a cantilever beam with point load..." 
            className="w-full h-32 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl outline-none focus:ring-1 ring-blue-500"
          />
        </div>
        <button onClick={handleNECAction} disabled={isLoading} className="mt-6 w-full bg-blue-600 py-5 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl hover:bg-blue-700 transition-all text-white">
          {isLoading ? 'Synthesizing Logic...' : 'Analyze Technical Node'}
        </button>
      </div>

      {result && Array.isArray(result) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in">
          {result.map((item: any, i: number) => (
            <div key={i} className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-6 rounded-[32px] shadow-sm">
              <h4 className="font-black dark:text-white uppercase text-sm mb-4">{item.diagnosis || 'Result Node'}</h4>
              <p className="text-[10px] text-slate-500 leading-relaxed mb-4">{item.reasoning}</p>
              <div className="p-3 bg-blue-50 dark:bg-blue-900/10 rounded-xl">
                 <p className="text-[7px] font-black text-blue-600 uppercase tracking-widest mb-1">Standard Reference</p>
                 <p className="text-[9px] font-bold text-slate-600 dark:text-slate-400">{item.nepaleseContext}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderNPC = () => (
    <div className="space-y-6 animate-in">
      <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-8 rounded-[40px] shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10 text-6xl">🛠️</div>
        <h2 className="text-2xl font-black uppercase tracking-tight mb-6 text-slate-900 dark:text-white">Technical Interaction Analysis</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input value={componentA} onChange={e => setComponentA(e.target.value)} placeholder="Primary Component" className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl text-slate-900 dark:text-white outline-none focus:ring-1 ring-blue-500" />
          <input value={componentB} onChange={e => setComponentB(e.target.value)} placeholder="Interacting Component" className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl text-slate-900 dark:text-white outline-none focus:ring-1 ring-blue-500" />
        </div>
        <button onClick={handleNPCAction} disabled={isLoading} className="mt-6 w-full bg-blue-600 py-5 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl hover:bg-blue-700 transition-all text-white">
          {isLoading ? 'Analyzing Database...' : 'Check Technical Conflict'}
        </button>
      </div>

      {result && !Array.isArray(result) && (
        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-8 rounded-[40px] animate-in relative shadow-lg">
          <div className="flex justify-between items-center mb-6">
            <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${result.isConflict ? 'bg-red-600 text-white' : 'bg-green-600 text-white'}`}>
              {result.severity} Severity
            </span>
          </div>
          <h3 className="text-xl font-black mb-4 uppercase text-slate-900 dark:text-white">Mechanism</h3>
          <p className="text-slate-500 dark:text-slate-400 text-sm mb-6 leading-relaxed">{result.mechanism}</p>
        </div>
      )}
    </div>
  );

  const renderEmergencyMatrix = () => {
    const protocols = isEng ? [
      { title: 'Structural Instability', color: 'red', steps: ['Evacuate immediate zone', 'Assess load-bearing nodes', 'Reinforce critical joints', 'Report to regulatory body'] },
      { title: 'Electrical Surge Fault', color: 'orange', steps: ['Isolate main breakers', 'Check grounding connectivity', 'Inspect for arc damage', 'Synchronize phase loads'] },
      { title: 'Cyber Security Breach', color: 'purple', steps: ['Isolate infected nodes', 'Terminate external proxy', 'Initiate backup restoration', 'Patch logic vulnerabilities'] },
      { title: 'Material Fatigue', color: 'red', steps: ['Sonic testing', 'Stress distribution map', 'Load reduction', 'Component replacement'] }
    ] : [
      { title: 'Academic Burnout', color: 'red', steps: ['Immediate study break', 'Mindfulness session', 'Sleep cycle reset', 'Consult academic advisor'] },
      { title: 'Exam Anxiety', color: 'orange', steps: ['Breathing exercises', 'Mock test simulation', 'Topic prioritization', 'Positive visualization'] },
      { title: 'Memory Lapse', color: 'purple', steps: ['Active recall session', 'Spaced repetition', 'Mnemonic creation', 'Concept mapping'] },
      { title: 'Time Management Failure', color: 'red', steps: ['Pomodoro initiation', 'Distraction elimination', 'Priority matrix update', 'Schedule synchronization'] }
    ];

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in">
         {protocols.map((proto, i) => (
           <div key={i} className={`p-8 bg-white dark:bg-slate-900 border-2 border-${proto.color}-500/20 rounded-[48px] shadow-sm relative group overflow-hidden`}>
              <div className={`absolute top-0 right-0 w-32 h-32 bg-${proto.color}-500/5 blur-3xl`}></div>
              <div className="flex items-center gap-3 mb-6">
                 <span className={`w-2 h-2 rounded-full bg-${proto.color}-500 animate-pulse`}></span>
                 <h3 className="font-black text-lg uppercase tracking-tighter dark:text-white">{proto.title}</h3>
              </div>
              <div className="space-y-4">
                 {proto.steps.map((s, j) => (
                   <div key={j} className="flex items-center gap-4 group/step cursor-default">
                      <span className="text-[10px] font-black text-slate-400 w-4">{j+1}</span>
                      <p className="text-xs font-bold text-slate-500 group-hover/step:text-blue-500 transition-colors uppercase tracking-widest">{s}</p>
                   </div>
                 ))}
              </div>
              <button className="mt-10 w-full py-4 bg-slate-100 dark:bg-slate-800 text-[9px] font-black uppercase tracking-[0.3em] rounded-2xl hover:bg-blue-600 hover:text-white transition-all">Full Protocol</button>
           </div>
         ))}
      </div>
    );
  };

  const renderNMC = () => (
    <div className="space-y-6 animate-in">
      <div className={`p-8 rounded-[40px] shadow-sm relative overflow-hidden ${isMaster ? 'bg-indigo-950 text-white' : 'bg-white dark:bg-slate-900'}`}>
        <div className="absolute top-0 right-0 p-8 opacity-10 text-6xl">🧠</div>
        <h2 className="text-2xl font-black uppercase tracking-tight mb-6">Academic Logic Hub</h2>
        <div className="space-y-4">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Problem Statement / Scenario</label>
          <textarea 
            value={problemStatement} 
            onChange={e => setProblemStatement(e.target.value)} 
            placeholder="Describe academic scenario or problem..." 
            className="w-full h-32 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl outline-none focus:ring-1 ring-blue-500"
          />
        </div>
        <button onClick={handleNMCAction} disabled={isLoading} className="mt-6 w-full bg-blue-600 py-5 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl hover:bg-blue-700 transition-all text-white">
          {isLoading ? 'Synthesizing Solutions...' : 'Generate Solution Matrix'}
        </button>
      </div>

      {result && Array.isArray(result) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in">
          {result.map((item: any, i: number) => (
            <div key={i} className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-6 rounded-[32px] shadow-sm">
              <div className="flex justify-between items-start mb-4">
                <h4 className="font-black dark:text-white uppercase text-sm">{item.solution}</h4>
                <span className="text-[8px] font-black text-blue-500 uppercase border border-blue-500/30 px-2 py-0.5 rounded">{item.probability} Probability</span>
              </div>
              <p className="text-[10px] text-slate-500 leading-relaxed mb-4">{item.reasoning}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderNNC = () => (
    <div className="space-y-6 animate-in">
      <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-8 rounded-[40px] shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10 text-6xl">📚</div>
        <h2 className="text-2xl font-black uppercase tracking-tight mb-6 text-slate-900 dark:text-white">Study Plan Architect</h2>
        <div className="space-y-4">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Academic Objective</label>
          <input value={academicObjective} onChange={e => setAcademicObjective(e.target.value)} placeholder="e.g. Advanced Calculus Mastery..." className="w-full h-16 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl text-slate-900 dark:text-white outline-none focus:ring-1 ring-blue-500" />
        </div>
        <button onClick={handleNNCAction} disabled={isLoading} className="mt-6 w-full bg-blue-600 py-5 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl hover:bg-blue-700 transition-all text-white">
          {isLoading ? 'Architecting Study Plan...' : 'Generate Study Interventions'}
        </button>
      </div>

      {result && !Array.isArray(result) && (
        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-8 rounded-[40px] shadow-lg animate-in">
           <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-6">
                 <div>
                    <h4 className="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-2">Assessment</h4>
                    <p className="text-xs font-bold text-slate-500">{result.assessment}</p>
                 </div>
              </div>
              <div className="space-y-6">
                 <div>
                    <h4 className="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-2">Interventions</h4>
                    <ul className="space-y-2">
                       {result.interventions?.map((inv: string, i: number) => (
                         <li key={i} className="text-[10px] font-bold text-slate-600 flex gap-2"><span className="text-blue-500">•</span> {inv}</li>
                       ))}
                    </ul>
                 </div>
              </div>
           </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-8 animate-in pb-20">
      <div className="flex bg-white dark:bg-slate-900 p-1 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm w-full md:w-[450px]">
         <button onClick={() => { setActiveSubTab('tools'); setResult(null); }} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeSubTab === 'tools' ? 'bg-blue-600 text-white shadow-xl' : 'text-slate-400'}`}>
            {isEng ? 'Eng Tools' : 'Core Tools'}
         </button>
         <button onClick={() => { setActiveSubTab('emergency'); setResult(null); }} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeSubTab === 'emergency' ? 'bg-blue-600 text-white shadow-xl' : 'text-slate-400'}`}>
            {isEng ? 'Fault Protocols' : 'Study Protocols'}
         </button>
      </div>

      {activeSubTab === 'emergency' ? renderEmergencyMatrix() : (
        <>
          {isEng && renderNEC()}
          {user.council === 'NPC' && renderNPC()}
          {user.council === 'NMC' && renderNMC()}
          {user.council === 'NNC' && renderNNC()}
          {user.council === 'NHPC' && (
            <div className="py-20 text-center opacity-30 text-xl font-black uppercase tracking-[0.2em]">NHPC Specialized Tools Synchronizing...</div>
          )}
        </>
      )}
      <div className="pb-10">
        <GovernmentDisclaimer />
      </div>
    </div>
  );
};

export default ProgramHub;
