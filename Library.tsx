import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { User, Quiz, LearningMaterial } from '../types';
import { db } from '../services/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';

const FacultyDashboard: React.FC<{ user: User }> = ({ user }) => {
  const [myQuizzes, setMyQuizzes] = useState<Quiz[]>([]);
  const [myMaterials, setMyMaterials] = useState<LearningMaterial[]>([]);
  const [programMaterials, setProgramMaterials] = useState<LearningMaterial[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user.id) return;

    // 1. My Quizzes
    const quizQuery = query(
      collection(db, 'quizzes'),
      where('uploadedBy', '==', user.id)
    );
    const unsubQuizzes = onSnapshot(quizQuery, (snap) => {
      setMyQuizzes(snap.docs.map(d => ({ id: d.id, ...d.data() } as Quiz)));
    });

    // 2. My Materials
    const materialQuery = query(
      collection(db, 'materials'),
      where('uploadedBy', '==', user.id)
    );
    const unsubMaterials = onSnapshot(materialQuery, (snap) => {
      setMyMaterials(snap.docs.map(d => ({ id: d.id, ...d.data() } as LearningMaterial)));
    });

    // 3. Program Materials (Filtered by instructor's program)
    const instructorProgram = user.program;
    
    let unsubProgMaterials = () => {};
    if (instructorProgram) {
      const progMaterialQuery = query(
        collection(db, 'materials'),
        where('program', '==', instructorProgram),
        where('status', '==', 'approved')
      );
      unsubProgMaterials = onSnapshot(progMaterialQuery, (snap) => {
        setProgramMaterials(snap.docs.map(d => ({ id: d.id, ...d.data() } as LearningMaterial)));
      });
    }

    setLoading(false);
    return () => {
      unsubQuizzes();
      unsubMaterials();
      unsubProgMaterials();
    };
  }, [user.id, user.program]);

  const stats = [
    { label: 'My Quizzes', value: myQuizzes.length, icon: '⏱️', color: 'bg-blue-500' },
    { label: 'My Uploads', value: myMaterials.length, icon: '📄', color: 'bg-purple-500' },
    { label: 'Program Notes', value: programMaterials.length, icon: '📚', color: 'bg-amber-500' },
  ];

  if (loading) {
    return (
      <div className="h-[60vh] flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-10 pb-20">
      <header className="space-y-2">
        <p className="text-blue-600 text-[10px] font-black uppercase tracking-[0.4em]">Faculty Terminal</p>
        <h1 className="text-3xl md:text-4xl font-black uppercase tracking-tighter text-slate-900 dark:text-white italic">Instructor Dashboard</h1>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {stats.map((stat, i) => (
          <motion.div 
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-white dark:bg-slate-900 p-8 rounded-[40px] border border-slate-100 dark:border-slate-800 shadow-sm flex items-center gap-6"
          >
            <div className={`w-16 h-16 ${stat.color} rounded-2xl flex items-center justify-center text-2xl shadow-lg shadow-blue-500/20`}>
              {stat.icon}
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{stat.label}</p>
              <p className="text-3xl font-black dark:text-white tabular-nums">{stat.value}</p>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        {/* My Quizzes Section */}
        <section className="space-y-6">
          <div className="flex items-center justify-between px-2">
            <h2 className="text-xl font-black uppercase tracking-tight dark:text-white italic">My Quiz Nodes</h2>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{myQuizzes.length} Total</span>
          </div>
          <div className="space-y-4">
            {myQuizzes.length > 0 ? myQuizzes.map((quiz) => (
              <div key={quiz.id} className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 flex items-center justify-between group hover:border-blue-500/30 transition-all">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl ${quiz.status === 'approved' ? 'bg-green-500/10 text-green-500' : 'bg-amber-500/10 text-amber-500'}`}>
                    {quiz.status === 'approved' ? '✅' : '⏳'}
                  </div>
                  <div>
                    <h3 className="font-black text-sm uppercase dark:text-white truncate max-w-[200px]">{quiz.title}</h3>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{quiz.subject} • {quiz.questionsCount} Items</p>
                  </div>
                </div>
                <div className="text-right">
                   <span className={`text-[8px] font-black px-2 py-1 rounded uppercase tracking-widest ${quiz.status === 'approved' ? 'bg-green-500 text-white' : 'bg-amber-500 text-white'}`}>
                     {quiz.status}
                   </span>
                </div>
              </div>
            )) : (
              <div className="py-12 text-center bg-slate-100 dark:bg-slate-900/50 rounded-[40px] border-2 border-dashed border-slate-200 dark:border-slate-800">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">No Quiz Nodes Deployed</p>
              </div>
            )}
          </div>
        </section>

        {/* My Materials Section */}
        <section className="space-y-6">
          <div className="flex items-center justify-between px-2">
            <h2 className="text-xl font-black uppercase tracking-tight dark:text-white italic">My Uploaded Assets</h2>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{myMaterials.length} Total</span>
          </div>
          <div className="space-y-4">
            {myMaterials.length > 0 ? myMaterials.map((material) => (
              <div key={material.id} className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 flex items-center justify-between group hover:border-purple-500/30 transition-all">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-purple-500/10 text-purple-500 rounded-xl flex items-center justify-center text-xl">
                    📄
                  </div>
                  <div>
                    <h3 className="font-black text-sm uppercase dark:text-white truncate max-w-[200px]">{material.title}</h3>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{material.subject} • {material.type}</p>
                  </div>
                </div>
                <div className="text-right">
                   <span className={`text-[8px] font-black px-2 py-1 rounded uppercase tracking-widest ${material.status === 'approved' ? 'bg-green-500 text-white' : 'bg-amber-500 text-white'}`}>
                     {material.status || 'pending'}
                   </span>
                </div>
              </div>
            )) : (
              <div className="py-12 text-center bg-slate-100 dark:bg-slate-900/50 rounded-[40px] border-2 border-dashed border-slate-200 dark:border-slate-800">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">No Assets Uploaded</p>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Program Materials Section */}
      <section className="space-y-6">
        <div className="flex items-center justify-between px-2">
          <h2 className="text-xl font-black uppercase tracking-tight dark:text-white italic">Program Resource Network</h2>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
            <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest">Live Sync: {user.program || 'Common'}</span>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {programMaterials.length > 0 ? programMaterials.map((material) => (
            <div key={material.id} className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 flex items-center gap-4 group hover:shadow-xl transition-all">
              <div className="w-14 h-14 bg-slate-50 dark:bg-slate-800 rounded-2xl flex items-center justify-center text-2xl shrink-0">
                {material.type === 'pdf' ? '📕' : '📘'}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-black text-sm uppercase dark:text-white truncate">{material.title}</h3>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">{material.subject} • {material.unit || 'General'}</p>
              </div>
              <a href={material.url} target="_blank" rel="noopener noreferrer" className="w-10 h-10 bg-blue-600 text-white rounded-xl flex items-center justify-center shadow-lg hover:scale-110 transition-all">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M7 17l9.2-9.2M17 17V7H7"/></svg>
              </a>
            </div>
          )) : (
            <div className="col-span-full py-20 text-center bg-white dark:bg-slate-900 rounded-[56px] border border-slate-100 dark:border-slate-800">
               <div className="text-4xl mb-4 opacity-20">📡</div>
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">No Program Resources Detected</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default FacultyDashboard;
