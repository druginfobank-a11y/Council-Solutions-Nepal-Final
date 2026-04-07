
import React, { useState, useEffect } from 'react';
import { User, StudyTask, UserRole } from '../types';
import { generateMCQs, generateStudyCountdown, generateFlashcards } from '../services/geminiService';
import { addTask, requestIntelligenceAccess } from '../services/userService';
import { motion, AnimatePresence } from 'motion/react';

interface StudyToolsProps {
  user: User;
}

const StudyTools: React.FC<StudyToolsProps> = ({ user }) => {
  const [activeTab, setActiveTab] = useState<'ANALYTICS' | 'REVIEW' | 'PLAN'>('ANALYTICS');
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
  const [reviewQuestions, setReviewQuestions] = useState<any[]>([]);
  const [isGeneratingReview, setIsGeneratingReview] = useState(false);
  const [isRequesting, setIsRequesting] = useState(false);

  const isApproved = user.role === UserRole.ADMIN || user.intelligenceApproved;

  const handleRequestAccess = async () => {
    setIsRequesting(true);
    try {
      await requestIntelligenceAccess(user.id);
      alert("Access request sent to the high council. Awaiting admin synchronization.");
    } catch (e) {
      console.error("Request failed:", e);
    } finally {
      setIsRequesting(false);
    }
  };

  if (!isApproved) {
    return (
      <div className="h-[70vh] flex flex-col items-center justify-center p-6 text-center relative overflow-hidden">
        <div className="absolute inset-0 bg-blue-600/5 blur-[120px] rounded-full animate-pulse"></div>
        <div className="max-w-md w-full space-y-10 animate-in relative z-10">
          <div className="w-24 h-24 bg-slate-900 rounded-[40px] flex items-center justify-center text-blue-500 text-5xl shadow-[0_0_50px_rgba(37,99,235,0.2)] mx-auto border border-white/5">🔒</div>
          <div className="space-y-3">
            <h1 className="text-3xl md:text-4xl font-black text-white uppercase tracking-tighter leading-none italic">Intelligence Node Locked</h1>
            <p className="text-blue-500 text-[10px] font-black uppercase tracking-[0.4em]">Protocol: Admin Verification Required</p>
          </div>
          <div className="bg-white/5 border border-white/5 p-8 rounded-[40px] backdrop-blur-xl text-center">
            <p className="text-slate-400 text-sm font-medium leading-relaxed mb-6">
              The Intelligence Node contains high-yield predictive modeling and AI study architects. To maintain institutional integrity, access is restricted to verified students.
            </p>
            {user.intelligenceRequested ? (
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500/10 rounded-full border border-blue-500/20">
                <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
                <span className="text-[8px] font-black text-blue-400 uppercase tracking-widest">Awaiting Admin Approval</span>
              </div>
            ) : (
              <button 
                onClick={handleRequestAccess}
                disabled={isRequesting}
                className="w-full bg-blue-600 text-white py-5 rounded-3xl font-black text-[11px] uppercase tracking-[0.2em] shadow-2xl hover:scale-105 active:scale-95 transition-all"
              >
                {isRequesting ? 'TRANSMITTING...' : 'REQUEST NODE ACCESS'}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  const [vals, setVals] = useState<any>({
    hours: 8, tasks: 10, readingTime: 60, complexity: 5, 
    questions: 50, time: 60,
    material: 100, mockScore: 75, consistency: 0.8
  });

  const calculateEfficiency = () => {
    const efficiency = (vals.hours / (vals.tasks || 1)) * 10;
    return { val: efficiency.toFixed(1), unit: 'Index', label: efficiency > 8 ? 'High Productivity' : efficiency > 5 ? 'Optimal' : 'Needs Focus', color: efficiency > 5 ? 'text-green-500' : 'text-orange-500' };
  };

  const handleGeneratePlan = async () => {
    setIsGeneratingPlan(true);
    try {
      const tasks = await generateStudyCountdown(user.weaknesses || {}, user.program || 'Common');
      
      for (const task of tasks) {
        await addTask(user.id, {
          text: task.text,
          priority: task.priority as 'High' | 'Medium' | 'Low',
          completed: false,
          timestamp: new Date().toISOString()
        });
      }
      alert("AI Study Plan synchronized to your Study Directives!");
    } catch (e) {
      console.error("Plan generation failed:", e);
      alert("Neural link disrupted. Please try again.");
    } finally {
      setIsGeneratingPlan(false);
    }
  };

  const handleGenerateReview = async () => {
    setIsGeneratingReview(true);
    try {
      const weakSubjects = Object.keys(user.weaknesses || {}).slice(0, 3).join(', ') || 'General Medicine';
      const cards = await generateFlashcards(weakSubjects, 5);
      setReviewQuestions(cards);
    } catch (e) {
      console.error("Review generation failed:", e);
      alert("Flashcard synthesis failed. Node disconnected.");
    } finally {
      setIsGeneratingReview(false);
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-32 px-4 md:px-0">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl md:text-5xl font-black tracking-tighter uppercase italic text-white leading-none">Intelligence Node</h1>
          <p className="text-slate-500 font-bold text-[10px] uppercase tracking-[0.4em] mt-3">Scientific Learning & Performance Analytics</p>
        </div>
        <div className="flex bg-slate-900 p-1.5 rounded-[24px] border border-white/5">
           {(['ANALYTICS', 'REVIEW', 'PLAN'] as const).map(tab => (
             <button 
               key={tab} 
               onClick={() => setActiveTab(tab)}
               className={`px-6 py-3 rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all ${activeTab === tab ? 'bg-blue-600 text-white shadow-xl' : 'text-slate-500 hover:text-slate-300'}`}
             >
               {tab}
             </button>
           ))}
        </div>
      </header>

      <AnimatePresence mode="wait">
        {activeTab === 'ANALYTICS' && (
          <motion.div 
            key="analytics"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="grid grid-cols-1 lg:grid-cols-12 gap-8"
          >
            <div className="lg:col-span-4 space-y-4">
               <div className="bg-white dark:bg-slate-900 p-8 rounded-[40px] border border-slate-100 dark:border-slate-800 shadow-sm">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-6">Efficiency Matrix</p>
                  <div className="space-y-6">
                     <div>
                        <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-2 block">Study Hours</label>
                        <input type="number" value={vals.hours} onChange={e => setVals({...vals, hours: Number(e.target.value)})} className="w-full h-12 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-xl px-4 text-xs font-bold dark:text-white outline-none"/>
                     </div>
                     <div>
                        <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-2 block">Total Tasks</label>
                        <input type="number" value={vals.tasks} onChange={e => setVals({...vals, tasks: Number(e.target.value)})} className="w-full h-12 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-xl px-4 text-xs font-bold dark:text-white outline-none"/>
                     </div>
                  </div>
               </div>
               <div className="bg-blue-600 p-8 rounded-[40px] text-white shadow-2xl">
                  <p className="text-[9px] font-black uppercase tracking-widest opacity-60 mb-2">Calculated Index</p>
                  <div className="flex items-baseline gap-2">
                     <span className="text-5xl font-black italic tracking-tighter">{calculateEfficiency().val}</span>
                     <span className="text-xs font-bold uppercase opacity-60">Points</span>
                  </div>
                  <p className="mt-4 text-[10px] font-black uppercase tracking-widest bg-white/20 inline-block px-3 py-1 rounded-full">{calculateEfficiency().label}</p>
               </div>
            </div>
            <div className="lg:col-span-8 bg-white dark:bg-slate-900 p-10 rounded-[56px] border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col items-center justify-center text-center">
               <div className="w-24 h-24 bg-slate-50 dark:bg-slate-950 rounded-[40px] flex items-center justify-center text-4xl mb-6">📈</div>
               <h3 className="text-xl font-black uppercase tracking-tight dark:text-white italic">Advanced Telemetry</h3>
               <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-2 max-w-sm">Synchronize your daily academic logs to unlock predictive performance modeling and retention mapping.</p>
            </div>
          </motion.div>
        )}

        {activeTab === 'REVIEW' && (
          <motion.div 
            key="review"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-8"
          >
            <div className="bg-slate-900 p-10 rounded-[56px] border border-white/5 text-center space-y-6">
               <div className="w-20 h-20 bg-blue-600/10 rounded-[32px] flex items-center justify-center text-4xl mx-auto border border-blue-500/20">🧠</div>
               <h2 className="text-2xl md:text-4xl font-black text-white uppercase tracking-tighter italic">Smart Review Node</h2>
               <p className="text-slate-400 text-sm font-medium max-w-xl mx-auto">Our Anki-style algorithm analyzes your weakness heatmap to generate high-yield flashcards for spaced repetition.</p>
               <button 
                 onClick={handleGenerateReview}
                 disabled={isGeneratingReview}
                 className="px-10 py-5 bg-blue-600 text-white rounded-3xl font-black text-[11px] uppercase tracking-widest shadow-2xl active:scale-95 transition-all"
               >
                 {isGeneratingReview ? 'SYNTHESIZING...' : 'INITIATE SMART REVIEW'}
               </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               {reviewQuestions.map((q, i) => (
                 <div key={i} className="bg-white dark:bg-slate-900 p-8 rounded-[40px] border border-slate-100 dark:border-slate-800 shadow-sm group cursor-pointer">
                    <p className="text-[8px] font-black text-blue-500 uppercase tracking-widest mb-4">Item #{i+1}</p>
                    <p className="text-sm font-black dark:text-white uppercase tracking-tight leading-relaxed mb-6 italic">"{q.question}"</p>
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                       <p className="text-[8px] font-black text-green-500 uppercase tracking-widest mb-2">Correct Logic:</p>
                       <p className="text-xs font-bold text-slate-500 uppercase">{q.answer}</p>
                    </div>
                 </div>
               ))}
            </div>
          </motion.div>
        )}

        {activeTab === 'PLAN' && (
          <motion.div 
            key="plan"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-white dark:bg-slate-900 p-10 md:p-20 rounded-[56px] border border-slate-100 dark:border-slate-800 shadow-sm text-center space-y-10"
          >
            <div className="w-24 h-24 bg-purple-600/10 rounded-[40px] flex items-center justify-center text-5xl mx-auto border border-purple-500/20 shadow-2xl">🗓️</div>
            <div className="space-y-4">
               <h2 className="text-3xl md:text-5xl font-black dark:text-white uppercase tracking-tighter italic leading-none">AI Study Architect</h2>
               <p className="text-slate-500 text-sm md:text-lg font-medium max-w-2xl mx-auto leading-relaxed">
                 Generate a custom 30-day "Exam Countdown" schedule tailored to your specific weak areas identified in the neural network.
               </p>
            </div>
            <button 
              onClick={handleGeneratePlan}
              disabled={isGeneratingPlan}
              className="px-12 py-6 bg-purple-600 text-white rounded-[32px] font-black text-[12px] uppercase tracking-[0.2em] shadow-2xl shadow-purple-900/40 active:scale-95 transition-all"
            >
              {isGeneratingPlan ? 'ORCHESTRATING PLAN...' : 'GENERATE 30-DAY COUNTDOWN'}
            </button>
            <div className="pt-10 border-t border-slate-100 dark:border-slate-800 flex flex-wrap justify-center gap-8 opacity-40">
               <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                  <span className="text-[8px] font-black uppercase tracking-widest">Weakness Analysis</span>
               </div>
               <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                  <span className="text-[8px] font-black uppercase tracking-widest">Spaced Repetition</span>
               </div>
               <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                  <span className="text-[8px] font-black uppercase tracking-widest">Exam Simulation</span>
               </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default StudyTools;
