
import React, { useState, useEffect, useRef, useMemo } from 'react';
import * as ReactRouter from 'react-router-dom';
import { User, UserRole, QuizMode, Quiz, ExamResult, SystemSettings } from '../types';
import { generateMCQs } from '../services/geminiService';
import { publishQuiz, submitExamResult, getCurriculum, getQuizRankings } from '../services/contentService';
import { PROGRAMS_DATA } from '../constants';
import { db } from '../services/firebase';
import { collection, query, onSnapshot, where, orderBy, doc, getDoc, getDocs } from 'firebase/firestore';

const { useNavigate } = ReactRouter as any;

interface AssessmentSession {
  quizId: string;
  title: string;
  subject: string;
  unit: string;
  mode: QuizMode;
  moduleType: string;
  questions: any[];
  currentIdx: number;
  selectedAnswers: (number | null)[];
  isFinished: boolean;
  timeLeft: number; 
  score?: number;
  sessionRank?: number;
  revealExpl?: boolean[]; 
}

const QuizHub: React.FC<{ user: User }> = ({ user }) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'AVAILABLE' | 'COMPLETED'>('AVAILABLE');
  const [provisionedSubTab, setProvisionedSubTab] = useState<QuizMode>(QuizMode.EXAM);
  const [isConfigView, setIsConfigView] = useState(false);
  const [activeSession, setActiveSession] = useState<AssessmentSession | null>(null);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [availableQuizzes, setAvailableQuizzes] = useState<Quiz[]>([]);
  const [pastResults, setPastResults] = useState<ExamResult[]>([]);
  const [isSubmittingResult, setIsSubmittingResult] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [curriculum, setCurriculum] = useState<Record<string, Record<string, string[]>>>(PROGRAMS_DATA);
  const [sysConfig, setSysConfig] = useState<SystemSettings | null>(null);
  
  const [creationStep, setCreationStep] = useState<'config' | 'draft'>('config');
  const [draftQuestions, setDraftQuestions] = useState<any[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [config, setConfig] = useState({
    title: '', subject: '', category: 'General', 
    moduleType: 'Unit-wise' as 'Unit-wise' | 'Set-wise' | 'Mock Exam' | 'Subject Drill',
    unitNumber: '1',
    program: user.program || 'Common', mode: QuizMode.EXAM,
    difficulty: 'Medium' as 'Easy' | 'Medium' | 'Hard',
    duration: 30, topic: '', qCount: 10, genMode: 'topic' as 'topic' | 'file',
    attachedFile: null as File | null,
    scheduledDate: '',
    scheduledTime: '08:00',
    language: 'ENG' as 'ENG' | 'NEP'
  });

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
  }, []);

  useEffect(() => {
    let q = query(collection(db, 'quizzes'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      let data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Quiz));
      const userProg = user.program?.toLowerCase();
      if (user.role === UserRole.STUDENT) {
        data = data.filter(q => {
          const qProg = q.program?.toLowerCase();
          const isApproved = q.status === 'approved';
          const isGlobal = qProg === 'common' || qProg === 'all programs';
          const isMatch = userProg && qProg === userProg;
          return isApproved && (isGlobal || isMatch);
        });
      }
      setAvailableQuizzes(data);
    }, (err) => {
      console.warn("Quiz availability sync deferred:", err);
    });
    return () => unsubscribe();
  }, [user.role, user.program]);

  useEffect(() => {
    if (activeTab === 'COMPLETED') {
      const q = query(collection(db, 'exam_results'), where('userId', '==', user.id));
      const unsub = onSnapshot(q, (snap) => {
        const results = snap.docs.map(d => ({ id: d.id, ...d.data() } as ExamResult));
        results.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        setPastResults(results);
      }, (err) => {
        console.warn("History sync deferred:", err);
      });
      return () => unsub();
    }
  }, [activeTab, user.id]);

  useEffect(() => {
    let timer: any;
    if (activeSession && !activeSession.isFinished && !showExitConfirm) {
      timer = setInterval(() => {
        setActiveSession(prev => {
          if (!prev || prev.isFinished) return prev;
          if (prev.mode === QuizMode.EXAM) {
            if (prev.timeLeft <= 0) return { ...prev, timeLeft: 0 };
            return { ...prev, timeLeft: prev.timeLeft - 1 };
          }
          return { ...prev, timeLeft: prev.timeLeft + 1 };
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [activeSession?.isFinished, showExitConfirm, !!activeSession]);

  useEffect(() => {
    if (activeSession && activeSession.mode === QuizMode.EXAM && activeSession.timeLeft === 0 && !activeSession.isFinished) {
      handleComplete();
    }
  }, [activeSession?.timeLeft]);

  const checkIsLocked = (quiz: Quiz) => {
    if (!quiz.scheduledDate) return false;
    const now = new Date();
    const [year, month, day] = quiz.scheduledDate.split('-').map(Number);
    const [hour, minute] = (quiz.scheduledTime || '00:00').split(':').map(Number);
    const scheduled = new Date(year, month - 1, day, hour, minute);
    return now < scheduled;
  };

  const getLockMessage = (quiz: Quiz) => {
    if (!quiz.scheduledDate) return '';
    return `Active on ${quiz.scheduledDate} at ${quiz.scheduledTime || '00:00'}`;
  };

  const startQuiz = async (quiz: Quiz, selectedMode?: QuizMode) => {
    if (!quiz.questions || quiz.questions.length === 0) {
      alert("This logic node contains no academic items.");
      return;
    }

    if (checkIsLocked(quiz)) {
      alert(`Access Restricted: This assessment is scheduled for a future synchronization cycle. ${getLockMessage(quiz)}`);
      return;
    }

    // Attempt Limit Check for Mock Exams
    if (quiz.moduleType === 'Mock Exam') {
      const qRes = query(
        collection(db, 'exam_results'),
        where('userId', '==', user.id),
        where('quizId', '==', quiz.id)
      );
      const snap = await getDocs(qRes);
      if (!snap.empty && quiz.mode === QuizMode.EXAM) {
        if (!confirm("You have already synchronized with this Mock Exam node. Subsequent attempts will NOT factor into your global program ranking. Proceed in Practice Mode?")) {
           return;
        }
        selectedMode = QuizMode.PRACTICE;
      }
    }

    const mode = selectedMode || quiz.mode || QuizMode.EXAM;
    setActiveSession({
      quizId: quiz.id, title: quiz.title, subject: quiz.subject || 'General', unit: quiz.unit || 'Common', mode,
      moduleType: quiz.moduleType || 'General', questions: quiz.questions,
      currentIdx: 0, selectedAnswers: new Array(quiz.questions.length).fill(null),
      revealExpl: new Array(quiz.questions.length).fill(false),
      isFinished: false, timeLeft: mode === QuizMode.EXAM ? (quiz.duration || 30) * 60 : 0
    });
  };

  const handleComplete = async () => {
    if (!activeSession || activeSession.isFinished || isSubmittingResult) return;
    setIsSubmittingResult(true);
    let correctCount = 0;
    activeSession.questions.forEach((q, i) => { if (activeSession.selectedAnswers[i] === q.correctAnswer) correctCount++; });
    
    try {
      await submitExamResult({
        quizId: activeSession.quizId, quizTitle: activeSession.title, userId: user.id, userName: user.name,
        score: correctCount, totalQuestions: activeSession.questions.length, percentage: (correctCount / activeSession.questions.length) * 100,
        timestamp: new Date().toISOString(), program: user.program || 'Common', council: user.council || 'NPC',
        subject: activeSession.subject, unit: activeSession.unit,
        quizModuleType: activeSession.moduleType
      });
      
      const allRanks = await getQuizRankings(activeSession.quizId);
      const myRank = allRanks.find(r => r.userId === user.id)?.rank;

      setActiveSession(prev => prev ? { ...prev, isFinished: true, score: correctCount, sessionRank: myRank } : null);
    } catch (e) { console.error("Result sync failed."); }
    finally { setIsSubmittingResult(false); }
  };

  const handleOptionSelect = (idx: number) => {
    if (!activeSession || activeSession.isFinished) return;
    const newAnswers = [...activeSession.selectedAnswers];
    newAnswers[activeSession.currentIdx] = idx;
    const newExpl = [...(activeSession.revealExpl || [])];
    if (activeSession.mode === QuizMode.PRACTICE) newExpl[activeSession.currentIdx] = true;
    setActiveSession({ ...activeSession, selectedAnswers: newAnswers, revealExpl: newExpl });
  };

  const handleLaunchBuilder = async () => {
    setGenError(null);
    if (config.topic === '' && config.genMode === 'topic') return setGenError("Logic Error: Topic context required.");
    setIsGenerating(true);
    try {
      let fileData = undefined;
      if (config.genMode === 'file' && config.attachedFile) {
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.readAsDataURL(config.attachedFile!);
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => reject(new Error("File Read Fail."));
        });
        fileData = { data: base64, mimeType: config.attachedFile.type };
      }

      const unitString = config.moduleType === 'Unit-wise' ? `Unit ${config.unitNumber}` : config.moduleType;

      const questions = await generateMCQs(
        config.topic, config.qCount, config.program, user.council || 'NMC',
        config.subject, fileData, config.difficulty, unitString, config.language
      );

      if (questions && Array.isArray(questions)) {
        setDraftQuestions(prev => [...prev, ...questions]);
        setCreationStep('draft');
      } else { throw new Error("Invalid AI payload."); }
    } catch (e: any) { setGenError(e.message || "Synthesis exception."); }
    finally { setIsGenerating(false); }
  };

  const handleDeleteDraftItem = (idx: number) => {
    if (confirm("Purge this academic item from draft repository?")) {
      setDraftQuestions(prev => prev.filter((_, i) => i !== idx));
    }
  };

  const handleFinalPublish = async () => {
    if (draftQuestions.length === 0) return;
    setIsPublishing(true);
    try {
      const unitString = config.moduleType === 'Unit-wise' ? `Unit ${config.unitNumber}` : config.moduleType;
      await publishQuiz({
        title: config.title || `Set: ${config.subject}`,
        category: config.category, subject: config.subject, unit: unitString,
        mode: config.mode, difficulty: config.difficulty, program: config.program,
        council: user.council || 'NPC', duration: config.duration, questionsCount: draftQuestions.length,
        status: user.role === UserRole.ADMIN ? 'approved' : 'pending', uploadedBy: user.id,
        scheduledDate: config.scheduledDate,
        scheduledTime: config.scheduledTime,
        moduleType: config.moduleType
      }, draftQuestions);
      setIsConfigView(false);
      setCreationStep('config');
      setDraftQuestions([]);
    } catch (e) { alert("Deployment failure."); }
    finally { setIsPublishing(false); }
  };

  const filteredProvisioned = useMemo(() => {
    return availableQuizzes.filter(q => q.mode === provisionedSubTab);
  }, [availableQuizzes, provisionedSubTab]);

  if (activeSession) {
    const q = activeSession.questions[activeSession.currentIdx];
    const isPractice = activeSession.mode === QuizMode.PRACTICE;
    const minutes = Math.floor(activeSession.timeLeft / 60);
    const seconds = activeSession.timeLeft % 60;
    
    const totalQuestions = activeSession.questions.length;
    const solvedCount = activeSession.selectedAnswers.filter(ans => ans !== null).length;
    const progressPercent = (solvedCount / totalQuestions) * 100;

    return (
      <div className="fixed inset-0 z-[6000] flex flex-col bg-slate-50 dark:bg-slate-950 h-[100dvh] w-full overflow-hidden animate-in">
        {showExitConfirm && (
          <div className="fixed inset-0 z-[7000] bg-slate-950/80 backdrop-blur-xl flex items-center justify-center p-6">
            <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-[40px] p-10 text-center space-y-8 shadow-2xl border border-slate-100 dark:border-slate-800">
               <div className="w-20 h-20 bg-red-600/10 rounded-3xl flex items-center justify-center text-4xl mx-auto border border-red-500/20">🚨</div>
               <div>
                  <h3 className="text-2xl font-black uppercase dark:text-white italic">Abort Transmission?</h3>
                  <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest leading-relaxed mt-2">Active evaluation sync will be lost. This action is recorded in the academic log.</p>
               </div>
               <div className="flex flex-col gap-3">
                  <button onClick={() => { setActiveSession(null); setShowExitConfirm(false); }} className="w-full py-5 bg-red-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl">Purge Session</button>
                  <button onClick={() => setShowExitConfirm(false)} className="w-full py-5 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white rounded-2xl font-black uppercase text-[10px] tracking-widest">Resume Sync</button>
               </div>
            </div>
          </div>
        )}

        <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-900 shrink-0">
          <div className={`h-full transition-all duration-700 ease-out shadow-[0_0_15px_rgba(59,130,246,0.5)] ${isPractice ? 'bg-blue-600' : 'bg-red-600'}`} style={{ width: `${progressPercent}%` }}></div>
        </div>

        <header className={`h-16 md:h-28 flex items-center px-4 md:px-10 text-white shrink-0 shadow-lg relative z-10 transition-colors ${isPractice ? 'bg-blue-600' : 'bg-red-600'}`}>
          <div className="flex-1 min-w-0">
             <div className="flex items-center gap-3">
                <span className="bg-white/20 px-2 py-0.5 rounded text-[7px] font-black uppercase tracking-widest">{isPractice ? 'Practice' : 'Exam'} Mode</span>
                <h2 className="font-black uppercase text-[10px] md:text-xl tracking-tighter leading-none truncate italic">{activeSession.title}</h2>
             </div>
             
             <div className="flex items-center gap-4 md:gap-8 mt-3">
                <div className="flex flex-col">
                   <p className="text-[6px] md:text-[8px] font-black uppercase tracking-widest opacity-60">Items</p>
                   <p className="text-[10px] md:text-sm font-black uppercase tracking-tight tabular-nums">{totalQuestions}</p>
                </div>
                <div className="w-px h-6 bg-white/20"></div>
                <div className="flex flex-col">
                   <p className="text-[6px] md:text-[8px] font-black uppercase tracking-widest opacity-60">Pending</p>
                   <p className="text-[10px] md:text-sm font-black uppercase tracking-tight tabular-nums">{totalQuestions - solvedCount}</p>
                </div>
             </div>
          </div>

          {!activeSession.isFinished && (
            <div className={`px-4 md:px-8 py-2 md:py-4 rounded-2xl md:rounded-3xl font-black text-[10px] md:text-2xl tracking-widest tabular-nums shrink-0 flex items-center gap-2 md:gap-4 ${isPractice ? 'bg-white/10 text-blue-100 border border-white/10' : 'bg-white text-red-600 shadow-2xl shadow-red-900/50'}`}>
              {isPractice ? '∞' : `${minutes}:${seconds.toString().padStart(2, '0')}`}
            </div>
          )}
          
          <button onClick={() => setShowExitConfirm(true)} className="ml-3 md:ml-6 w-10 h-10 md:w-16 md:h-16 bg-white/10 rounded-2xl md:rounded-3xl flex items-center justify-center hover:bg-white/20 transition-all shrink-0 border border-white/5">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-10 flex flex-col items-center scrollbar-hide">
          {activeSession.isFinished ? (
            <div className="max-w-md w-full text-center space-y-8 animate-in pt-10 pb-20">
               <div className={`w-20 h-20 rounded-[32px] flex items-center justify-center text-3xl mx-auto shadow-2xl ${isPractice ? 'bg-blue-600' : 'bg-red-600'}`}>🎯</div>
               <h2 className="text-2xl font-black uppercase tracking-tighter dark:text-white italic">Session Sync Complete</h2>
               <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm space-y-6">
                  <div className={`p-4 rounded-2xl border ${isPractice ? 'bg-blue-50 dark:bg-blue-900/10 border-blue-100' : 'bg-red-50 dark:bg-red-900/10 border-red-100'}`}>
                     <p className={`text-[8px] font-black uppercase tracking-widest mb-1 ${isPractice ? 'text-blue-600' : 'text-red-600'}`}>Accuracy Index</p>
                     <p className={`text-4xl font-black uppercase tracking-tighter ${isPractice ? 'text-blue-600' : 'text-red-600'}`}>{Math.round((activeSession.score || 0) / activeSession.questions.length * 100)}%</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl">
                      <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Score</p>
                      <p className="text-xl font-black dark:text-white">{activeSession.score} / {activeSession.questions.length}</p>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl">
                      <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Session Rank</p>
                      <p className="text-xl font-black text-purple-600">#{activeSession.sessionRank || '--'}</p>
                    </div>
                  </div>
                  {activeSession.moduleType === 'Mock Exam' && activeSession.mode === QuizMode.PRACTICE && (
                    <p className="text-[8px] font-bold text-slate-500 uppercase tracking-widest leading-relaxed">Note: Only the 1st attempt factors into program rankings. Subsequent practice syncs are for skill retention.</p>
                  )}
               </div>
               <button onClick={() => { setActiveSession(null); setShowExitConfirm(false); }} className="w-full py-5 bg-slate-900 dark:bg-white dark:text-slate-950 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl hover:scale-105 active:scale-95 transition-all">Exit Assessment</button>
            </div>
          ) : (
            <div className="max-w-4xl w-full space-y-6 md:space-y-12 animate-in pb-20">
               <div className="bg-white dark:bg-slate-900 p-6 md:p-14 rounded-[32px] md:rounded-[56px] shadow-sm border border-slate-100 dark:border-slate-800 text-center relative overflow-hidden group">
                  <p className="text-sm md:text-2xl font-black leading-snug md:leading-relaxed text-slate-900 dark:text-white uppercase tracking-tight italic break-words relative z-10">"{q.question}"</p>
               </div>
               <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-8">
                  {q.options.map((opt: string, idx: number) => {
                    const isSelected = activeSession.selectedAnswers[activeSession.currentIdx] === idx;
                    const isCorrect = q.correctAnswer === idx;
                    const shouldReveal = isPractice && activeSession.revealExpl?.[activeSession.currentIdx];
                    const selectedClasses = isPractice ? 'border-blue-600 bg-blue-600/5 text-blue-600' : 'border-red-600 bg-red-600/5 text-red-600';
                    const circleClasses = isPractice ? 'bg-blue-600 text-white shadow-lg' : 'bg-red-600 text-white shadow-lg';
                    return (
                      <button 
                        key={idx} onClick={() => handleOptionSelect(idx)} disabled={shouldReveal} 
                        className={`p-4 md:p-8 rounded-[24px] md:rounded-[40px] border-2 text-left flex items-center gap-3 md:gap-6 transition-all relative overflow-hidden ${shouldReveal ? isCorrect ? 'border-green-500 bg-green-500/5 text-green-600' : isSelected ? 'border-red-500 bg-red-500/5 text-red-600 opacity-60' : 'border-slate-100 dark:border-slate-800 opacity-30' : isSelected ? selectedClasses : 'border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-500'}`}
                      >
                        <span className={`w-8 h-8 md:w-14 md:h-14 rounded-lg md:rounded-2xl flex items-center justify-center font-black text-[10px] md:text-xl shrink-0 ${shouldReveal ? isCorrect ? 'bg-green-600 text-white' : isSelected ? 'bg-red-600 text-white' : 'bg-slate-200 dark:bg-slate-800' : isSelected ? circleClasses : 'bg-slate-100 dark:bg-slate-800'}`}>{String.fromCharCode(65+idx)}</span>
                        <span className="font-bold text-xs md:text-lg leading-tight uppercase flex-1 break-words">{opt}</span>
                      </button>
                    );
                  })}
               </div>
            </div>
          )}
        </div>

        {!activeSession.isFinished && (
          <footer className="p-4 md:p-10 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex gap-3 md:gap-6 shrink-0 shadow-[0_-10px_40px_rgba(0,0,0,0.04)]">
             <button disabled={activeSession.currentIdx === 0} onClick={() => setActiveSession({...activeSession, currentIdx: activeSession.currentIdx - 1})} className="flex-1 py-4 md:py-8 rounded-xl md:rounded-[32px] bg-slate-50 dark:bg-slate-800 font-black text-[9px] md:text-[13px] uppercase tracking-widest text-slate-400 disabled:opacity-30 transition-all border border-transparent hover:border-slate-200">BACK</button>
             {activeSession.currentIdx === activeSession.questions.length - 1 ? (
               <button onClick={handleComplete} disabled={isSubmittingResult} className={`flex-1 py-4 md:py-8 rounded-xl md:rounded-[32px] text-white font-black text-[9px] md:text-[13px] uppercase tracking-widest shadow-xl transition-all active:scale-95 ${isPractice ? 'bg-blue-600' : 'bg-red-600'}`}>TRANSMIT</button>
             ) : (
               <button onClick={() => setActiveSession({...activeSession, currentIdx: activeSession.currentIdx + 1})} className={`flex-1 py-4 md:py-8 rounded-xl md:rounded-[32px] text-white font-black text-[9px] md:text-[13px] uppercase tracking-widest shadow-xl transition-all active:scale-95 ${isPractice ? 'bg-blue-600' : 'bg-red-600'}`}>NEXT ITEM</button>
             )}
          </footer>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-full bg-slate-50 dark:bg-slate-950 animate-in">
      {isConfigView ? (
        <div className="fixed inset-0 z-[6000] bg-slate-950/20 backdrop-blur-sm md:p-10 flex flex-col items-center justify-center h-[100dvh] w-full animate-in overflow-hidden">
          <div className="bg-white dark:bg-slate-900 w-full max-w-6xl md:rounded-[48px] shadow-2xl overflow-hidden flex flex-col h-full md:h-[90vh] border border-slate-100 dark:border-slate-800">
             <header className="p-4 md:p-10 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-white dark:bg-slate-900 shrink-0">
                <div className="min-w-0">
                   <h2 className="text-xl md:text-3xl font-black uppercase tracking-tighter text-slate-900 dark:text-white leading-none truncate italic">Logic Architect</h2>
                   <p className="text-[9px] font-black text-blue-500 uppercase tracking-widest mt-2">Drafting Set Nodes • Registry: {draftQuestions.length} Items</p>
                </div>
                <button onClick={() => setIsConfigView(false)} className="w-10 h-10 md:w-12 md:h-12 flex items-center justify-center bg-slate-50 dark:bg-slate-800 rounded-xl text-slate-400 hover:text-slate-950 transition-all shrink-0">
                   <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
                </button>
             </header>

             <div className="flex-1 overflow-y-auto p-5 md:p-12 pb-48 scrollbar-hide">
                {creationStep === 'config' ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-14 animate-in w-full mx-auto">
                     <div className="space-y-8">
                        {genError && <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 rounded-2xl text-[9px] font-black text-red-600 uppercase leading-relaxed">{genError}</div>}
                        <div className="space-y-4">
                           <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Assessment Node Mode</label>
                           <div className="flex bg-slate-100 dark:bg-slate-950 p-1.5 rounded-[20px] border border-slate-200 dark:border-slate-800">
                              <button onClick={() => setConfig({...config, mode: QuizMode.EXAM})} className={`flex-1 py-3 rounded-xl text-[9px] font-black uppercase transition-all ${config.mode === QuizMode.EXAM ? 'bg-red-600 text-white shadow-md' : 'text-slate-400'}`}>⏱️ Exam</button>
                              <button onClick={() => setConfig({...config, mode: QuizMode.PRACTICE})} className={`flex-1 py-3 rounded-xl text-[9px] font-black uppercase transition-all ${config.mode === QuizMode.PRACTICE ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400'}`}>💡 Practice</button>
                           </div>
                        </div>
                        <div className="space-y-3">
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Internal Title</label>
                          <input value={config.title} onChange={e => setConfig({...config, title: e.target.value})} className="w-full h-14 bg-slate-50 dark:bg-slate-950 border border-slate-200 rounded-xl px-5 text-xs font-bold dark:text-white outline-none" placeholder="e.g. Academic Path Finals" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                           <div className="space-y-3">
                              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Subject Node</label>
                              <input value={config.subject} onChange={e => setConfig({...config, subject: e.target.value})} className="w-full h-14 bg-slate-50 dark:bg-slate-950 border border-slate-200 rounded-xl px-5 text-xs font-bold dark:text-white outline-none" placeholder="Microbiology" />
                           </div>
                           <div className="space-y-3">
                              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Logical Module</label>
                              <select value={config.moduleType} onChange={e => setConfig({...config, moduleType: e.target.value as any})} className="w-full h-14 bg-slate-50 dark:bg-slate-950 border border-slate-200 rounded-xl px-4 text-[9px] font-black uppercase dark:text-white outline-none">
                                <option value="Unit-wise">Unit-wise</option>
                                <option value="Set-wise">Set-wise</option>
                                <option value="Mock Exam">Mock Exam</option>
                                <option value="Subject Drill">Subject Drill</option>
                              </select>
                           </div>
                        </div>
                        {config.moduleType === 'Unit-wise' && (
                          <div className="space-y-3 animate-in">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Unit # Selection</label>
                            <input type="number" min="1" max="50" value={config.unitNumber} onChange={e => setConfig({...config, unitNumber: e.target.value})} className="w-full h-14 bg-slate-50 dark:bg-slate-950 border border-blue-500/20 rounded-xl px-5 text-xs font-bold dark:text-white outline-none" />
                          </div>
                        )}
                        <div className="grid grid-cols-2 gap-4">
                           <div className="space-y-3">
                              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Number of Items</label>
                              <input type="number" min="1" max="100" value={config.qCount} onChange={e => setConfig({...config, qCount: parseInt(e.target.value) || 10})} className="w-full h-14 bg-slate-50 dark:bg-slate-950 border border-slate-200 rounded-xl px-5 text-xs font-bold dark:text-white outline-none" />
                           </div>
                           {config.mode === QuizMode.EXAM && (
                             <div className="space-y-3 animate-in">
                               <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Exam Duration (Min)</label>
                               <input type="number" min="1" value={config.duration} onChange={e => setConfig({...config, duration: parseInt(e.target.value) || 30})} className="w-full h-14 bg-slate-50 dark:bg-slate-950 border border-red-500/20 rounded-xl px-5 text-xs font-bold dark:text-white outline-none" placeholder="Minutes" />
                             </div>
                           )}
                        </div>
                        {config.mode === QuizMode.EXAM && (
                          <div className="grid grid-cols-2 gap-4 animate-in">
                             <div className="space-y-3">
                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Assessment Date</label>
                                <input type="date" value={config.scheduledDate} onChange={e => setConfig({...config, scheduledDate: e.target.value})} className="w-full h-14 bg-slate-50 dark:bg-slate-950 border border-slate-200 rounded-xl px-5 text-xs font-bold dark:text-white outline-none" />
                             </div>
                             <div className="space-y-3">
                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Start Time (UTC+5:45)</label>
                                <input type="time" value={config.scheduledTime} onChange={e => setConfig({...config, scheduledTime: e.target.value})} className="w-full h-14 bg-slate-50 dark:bg-slate-950 border border-slate-200 rounded-xl px-5 text-xs font-bold dark:text-white outline-none" />
                             </div>
                          </div>
                        )}
                     </div>
                     <div className="space-y-8">
                        <div className="space-y-3">
                           <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Academic Program Node</label>
                           <select value={config.program} onChange={e => setConfig({...config, program: e.target.value})} className="w-full h-14 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-xl px-4 md:px-6 text-[8px] md:text-[10px] font-black uppercase dark:text-white outline-none">
                              <option value="Common">Global Registry</option>
                              {Object.entries(curriculum).map(([council, levels]) => (
                                <optgroup key={council} label={council}>{Object.values(levels).flat().filter(p => sysConfig?.enabledPrograms?.[p] !== false).map(p => <option key={p} value={p}>{p}</option>)}</optgroup>
                              ))}
                           </select>
                        </div>
                        <div className="space-y-4">
                           <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Logic Node Engine</label>
                           <div className="flex bg-slate-100 dark:bg-slate-950 p-1.5 rounded-[20px] border border-slate-200 dark:border-slate-800">
                              <button onClick={() => setConfig({...config, genMode: 'topic'})} className={`flex-1 py-3 rounded-xl text-[9px] font-black uppercase transition-all ${config.genMode === 'topic' ? 'bg-white dark:bg-slate-800 text-purple-600 shadow-sm' : 'text-slate-400'}`}>Qwen-Logic</button>
                              <button onClick={() => setConfig({...config, genMode: 'file'})} className={`flex-1 py-3 rounded-xl text-[9px] font-black uppercase transition-all ${config.genMode === 'file' ? 'bg-white dark:bg-slate-800 text-blue-600 shadow-sm' : 'text-slate-400'}`}>Llama-Vision</button>
                           </div>
                        </div>
                        <div className="grid grid-cols-1 gap-6">
                           <div className="space-y-3">
                              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">{config.genMode === 'topic' ? 'Focus Topic Matrix' : 'PDF Source Node'}</label>
                              {config.genMode === 'topic' ? (
                                <input value={config.topic} onChange={e => setConfig({...config, topic: e.target.value})} className="w-full h-14 bg-slate-50 dark:bg-slate-950 border border-slate-200 rounded-xl px-5 text-xs font-bold dark:text-white outline-none shadow-inner" placeholder="e.g. Acute inflammation stages" />
                              ) : (
                                <div onClick={() => fileInputRef.current?.click()} className="w-full h-28 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-[32px] flex flex-col items-center justify-center cursor-pointer hover:border-blue-500 transition-all bg-slate-50 dark:bg-slate-950/50 group relative">
                                   <input ref={fileInputRef} type="file" className="hidden" accept=".pdf,image/*" onChange={e => setConfig({...config, attachedFile: e.target.files?.[0] || null})} />
                                   <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest group-hover:text-blue-500 text-center px-6 truncate w-full">{config.attachedFile ? `📎 ${config.attachedFile.name}` : "Attach Syllabus Reference"}</p>
                                </div>
                              )}
                           </div>
                           {config.genMode !== 'file' && (
                             <div className="space-y-3 animate-in">
                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Difficulty Level</label>
                                <select value={config.difficulty} onChange={e => setConfig({...config, difficulty: e.target.value as any})} className="w-full h-14 bg-slate-50 dark:bg-slate-950 border border-slate-200 rounded-xl px-4 text-[9px] font-black uppercase dark:text-white outline-none">
                                  <option value="Easy">Easy</option>
                                  <option value="Medium">Medium</option>
                                  <option value="Hard">Hard</option>
                                </select>
                             </div>
                           )}
                        </div>
                     </div>
                  </div>
                ) : (
                  <div className="space-y-8 animate-in pb-20 w-full mx-auto">
                     <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
                        {draftQuestions.map((q, i) => (
                           <div key={i} className={`p-6 md:p-8 bg-white dark:bg-slate-900 rounded-[32px] border border-slate-100 dark:border-slate-800 shadow-sm transition-all relative group`}>
                              <div className="flex justify-between items-start mb-6">
                                 <span className="text-[8px] font-black text-blue-500 uppercase tracking-[0.2em]">ITEM {i+1}</span>
                                 <button onClick={() => handleDeleteDraftItem(i)} className="opacity-0 group-hover:opacity-100 w-8 h-8 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-500 flex items-center justify-center transition-all hover:bg-red-500 hover:text-white">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18 6L6 18M6 6l12 12"/></svg>
                                 </button>
                              </div>
                              <div className="space-y-6">
                                 <p className="text-xs md:text-sm font-black uppercase text-slate-900 dark:text-white leading-snug break-words">"{q.question}"</p>
                                 <div className="space-y-2">
                                    {q.options.map((opt: string, idx: number) => (
                                       <div key={idx} className={`p-4 rounded-xl border-2 text-[10px] font-bold break-words ${idx === q.correctAnswer ? 'bg-green-500/10 border-green-500/30 text-green-600' : 'bg-slate-50 dark:bg-slate-950 border-slate-50 dark:border-slate-800 text-slate-400 opacity-60'}`}><span className="mr-3 opacity-40">{String.fromCharCode(65+idx)}.</span>{opt}</div>
                                    ))}
                                 </div>
                              </div>
                           </div>
                        ))}
                     </div>
                  </div>
                )}
             </div>

             <footer className="p-4 md:p-10 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0 z-50">
               <div className="max-w-6xl mx-auto flex flex-col md:flex-row gap-4">
                  {creationStep === 'config' ? (
                    <button onClick={handleLaunchBuilder} disabled={isGenerating} className={`w-full h-16 md:h-20 ${config.genMode === 'file' ? 'bg-blue-600' : 'bg-purple-600'} text-white rounded-[24px] md:rounded-[36px] font-black text-[11px] md:text-[13px] uppercase tracking-[0.2em] shadow-2xl active:scale-95 transition-all flex items-center justify-center gap-3`}>
                       {isGenerating ? <div className="w-5 h-5 border-3 border-white/30 border-t-white rounded-full animate-spin"></div> : (draftQuestions.length > 0 ? 'APPEND MORE LOGIC' : 'INITIATE SYNTHESIS')}
                    </button>
                  ) : (
                    <>
                      <button onClick={() => { setCreationStep('config'); setGenError(null); }} className="flex-1 h-16 md:h-20 bg-slate-900 text-white rounded-[24px] md:rounded-[36px] font-black uppercase tracking-[0.2em] text-[10px] shadow-xl active:scale-95 transition-all">ADD MORE ITEMS</button>
                      <button onClick={handleFinalPublish} disabled={isPublishing || draftQuestions.length === 0} className="flex-[2] h-16 md:h-20 bg-blue-600 text-white rounded-[24px] md:rounded-[36px] font-black uppercase tracking-[0.2em] md:tracking-[0.3em] text-[10px] md:text-xs shadow-2xl active:scale-95 transition-all">
                        {isPublishing ? 'DEPLOYING...' : `RELEASE REPOSITORY (${draftQuestions.length} ITEMS)`}
                      </button>
                    </>
                  )}
               </div>
             </footer>
          </div>
        </div>
      ) : (
        <div className="flex flex-col flex-1 h-screen">
          <header className="shrink-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 h-20 md:h-24 flex items-center justify-between px-6 md:px-12 z-20 transition-colors">
            <div className="flex items-center gap-4">
              <button onClick={() => navigate('/')} className="w-10 h-10 md:w-12 md:h-12 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center text-slate-500 hover:bg-blue-600 hover:text-white transition-all shadow-sm group">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="group-hover:-translate-x-1 transition-transform"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
              </button>
              <div>
                <p className="text-blue-600 text-[8px] md:text-[10px] font-black uppercase tracking-[0.3em] mb-0.5">Intelligence Hub</p>
                <h1 className="text-lg md:text-2xl font-black uppercase tracking-tight text-slate-900 dark:text-white leading-none italic">Assigned Nodes</h1>
              </div>
            </div>
            {user.role !== UserRole.STUDENT && (
              <button onClick={() => { setIsConfigView(true); setCreationStep('config'); setGenError(null); setDraftQuestions([]); }} className="px-6 md:px-10 py-3 md:py-4 bg-blue-600 text-white rounded-xl md:rounded-2xl font-black text-[9px] md:text-[11px] uppercase tracking-widest shadow-xl active:scale-95 transition-all">
                Architect Set
              </button>
            )}
          </header>

          <div className="flex-1 overflow-y-auto p-6 md:p-12 scrollbar-hide">
            <div className="max-w-7xl mx-auto space-y-12 pb-20">
              <div className="flex bg-white dark:bg-slate-900 p-1 rounded-[24px] border border-slate-100 dark:border-slate-800 shadow-sm w-full md:w-72">
                 <button onClick={() => setActiveTab('AVAILABLE')} className={`flex-1 py-3.5 rounded-2xl text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'AVAILABLE' ? 'bg-blue-600 text-white shadow-xl' : 'text-slate-400'}`}>Provisioned</button>
                 <button onClick={() => setActiveTab('COMPLETED')} className={`flex-1 py-3.5 rounded-2xl text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'COMPLETED' ? 'bg-blue-600 text-white shadow-xl' : 'text-slate-400'}`}>History</button>
              </div>

              <div className="pb-20">
                {activeTab === 'AVAILABLE' ? (
                  <div className="space-y-12 animate-in">
                    <div className="flex gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
                       <button onClick={() => setProvisionedSubTab(QuizMode.EXAM)} className={`relative px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] transition-all ${provisionedSubTab === QuizMode.EXAM ? 'text-red-600' : 'text-slate-400 hover:text-slate-600'}`}>Exam Nodes {provisionedSubTab === QuizMode.EXAM && <div className="absolute bottom-0 left-0 right-0 h-1 bg-red-600 rounded-full animate-in zoom-in duration-300"></div>}</button>
                       <button onClick={() => setProvisionedSubTab(QuizMode.PRACTICE)} className={`relative px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] transition-all ${provisionedSubTab === QuizMode.PRACTICE ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}>Practice Nodes {provisionedSubTab === QuizMode.PRACTICE && <div className="absolute bottom-0 left-0 right-0 h-1 bg-blue-600 rounded-full animate-in zoom-in duration-300"></div>}</button>
                    </div>

                    {filteredProvisioned.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 animate-in">
                         {filteredProvisioned.map(quiz => {
                           const isExam = quiz.mode === QuizMode.EXAM;
                           const isLocked = checkIsLocked(quiz);
                           const bgClass = isExam ? 'bg-red-50 dark:bg-red-900/20' : 'bg-blue-50 dark:bg-blue-900/20';
                           const accentClass = isExam ? 'text-red-600' : 'text-blue-600';
                           const btnClass = isExam ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700';
                           
                           return (
                             <div key={quiz.id} className={`bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-8 rounded-[48px] shadow-sm hover:shadow-2xl transition-all flex flex-col h-full group relative overflow-hidden ${isLocked ? 'opacity-70 grayscale-[0.5]' : ''}`}>
                                {isLocked && (
                                   <div className="absolute top-0 right-0 p-6 flex flex-col items-end z-20">
                                      <div className="w-10 h-10 bg-slate-900/90 rounded-xl flex items-center justify-center text-white shadow-xl border border-white/10 mb-2">🔒</div>
                                      <span className="text-[7px] font-black bg-red-600 text-white px-2 py-1 rounded uppercase tracking-widest shadow-lg">LOCKED NODE</span>
                                   </div>
                                )}
                                
                                <div className="flex justify-between items-start mb-10">
                                   <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-3xl ${bgClass} group-hover:scale-110 transition-transform`}>{isExam ? '⏱️' : '🧩'}</div>
                                   <span className={`${bgClass} ${accentClass} px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest italic`}>{quiz.moduleType || (isExam ? 'Critical Evaluation' : 'Skill Acquisition')}</span>
                                </div>
                                
                                <h3 className="text-xl font-black uppercase leading-tight mb-4 dark:text-white italic line-clamp-2">{quiz.title}</h3>
                                <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mb-4">{quiz.subject} • {quiz.questionsCount} Academic Items</p>
                                
                                {isLocked && (
                                  <div className="bg-red-50 dark:bg-red-900/10 p-3 rounded-xl border border-red-100 dark:border-red-900/30 mb-6">
                                     <p className="text-[8px] font-black text-red-600 uppercase tracking-widest">Protocol Scheduled:</p>
                                     <p className="text-[9px] font-bold text-red-700 dark:text-red-400">{getLockMessage(quiz)}</p>
                                  </div>
                                )}

                                <div className="mt-auto">
                                   <button 
                                      onClick={() => startQuiz(quiz)} 
                                      disabled={isLocked}
                                      className={`w-full py-4 ${isLocked ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed' : `${btnClass} text-white shadow-lg active:scale-95`} rounded-2xl font-black text-[10px] uppercase transition-all tracking-widest`}
                                   >
                                      {isLocked ? 'NODE RESTRICTED' : `LAUNCH ${isExam ? 'EXAM' : 'PRACTICE'} NODE`}
                                   </button>
                                </div>
                             </div>
                           );
                         })}
                      </div>
                    ) : (
                      <div className="py-24 text-center opacity-30 flex flex-col items-center">
                         <div className="text-6xl mb-6">{provisionedSubTab === QuizMode.EXAM ? '📡' : '🎓'}</div>
                         <h3 className="text-2xl font-black uppercase tracking-widest">Registry Empty</h3>
                         <p className="text-[10px] font-bold uppercase mt-2">No {provisionedSubTab.toLowerCase()} nodes found for your profile.</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in">
                     {pastResults.map(res => (
                       <div key={res.id} className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-8 rounded-[48px] shadow-sm hover:shadow-lg transition-all">
                          <div className="flex justify-between items-start mb-8">
                             <div className="w-12 h-12 bg-green-100 dark:bg-green-900/20 rounded-2xl flex items-center justify-center text-xl shadow-sm">🏆</div>
                             {!res.isFirstAttempt && (
                                <span className="bg-blue-50 dark:bg-blue-900/30 text-blue-600 px-2 py-1 rounded text-[7px] font-black uppercase tracking-widest">Practice Sync</span>
                             )}
                          </div>
                          <h3 className="text-lg font-black uppercase dark:text-white truncate mb-2">{res.quizTitle}</h3>
                          <div className="flex justify-between items-center mt-6">
                            <p className="text-[9px] font-black text-slate-400 uppercase">{new Date(res.timestamp).toLocaleDateString()}</p>
                            <p className="text-xl font-black text-green-600">{Math.round(res.percentage)}%</p>
                          </div>
                       </div>
                     ))}
                     {pastResults.length === 0 && <div className="col-span-full py-24 text-center opacity-20 text-xl font-black uppercase">No Evaluation Records Found</div>}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default QuizHub;
