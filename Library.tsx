import React, { useState, useMemo, useEffect } from 'react';
import { UserRole, User, SystemSettings } from '../types';
import { auth, db } from '../services/firebase';
import { PROGRAMS_DATA } from '../constants';
import { getCurriculum } from '../services/contentService';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
} from 'firebase/auth';
import { doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';
import { sanitizeUrl, ensureExternalLink } from '../services/storageService';

interface AuthProps {
  onLogin: (user: User) => void;
  systemConfig: Partial<SystemSettings> | null;
}

const Auth: React.FC<AuthProps> = ({ onLogin, systemConfig }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [role, setRole] = useState<UserRole>(UserRole.STUDENT);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [curriculum, setCurriculum] = useState<Record<string, Record<string, string[]>>>(PROGRAMS_DATA);
  
  const [formData, setFormData] = useState({
    name: '', email: '', password: '', npcNumber: '', specialization: '',
    batch: '', college: '', level: '', program: '', council: ''
  });

  useEffect(() => {
    const fetchCurriculum = async () => {
      const data = await getCurriculum();
      if (data) setCurriculum(data);
    };
    fetchCurriculum();
  }, []);

  useEffect(() => {
    setFormData(prev => ({ ...prev, program: '' }));
  }, [formData.council, formData.level]);

  const activeCouncils = useMemo(() => {
    const councils = Object.keys(curriculum);
    if (systemConfig?.enabledPrograms && Object.keys(systemConfig.enabledPrograms).length > 0) {
      return councils.filter(council => {
        const councilNode = curriculum[council];
        // Fix: Corrected variable name typo (removed space) to resolve "Cannot find name 'allProgsForCouncil'"
        const allProgsForCouncil = Object.values(councilNode).flat() as string[];
        return allProgsForCouncil.some(p => systemConfig.enabledPrograms![p] !== false);
      });
    }
    return councils;
  }, [curriculum, systemConfig]);

  const availablePrograms = useMemo(() => {
    if (!formData.council) return [];
    const councilNode = curriculum[formData.council];
    if (!councilNode) return [];
    let programs: string[] = formData.level ? (councilNode[formData.level] || []) : (Object.values(councilNode).flat() as string[]);
    const uniquePrograms = Array.from(new Set(programs));
    if (systemConfig?.enabledPrograms && Object.keys(systemConfig.enabledPrograms).length > 0) {
      return uniquePrograms.filter(p => systemConfig.enabledPrograms![p] !== false);
    }
    return uniquePrograms;
  }, [formData.council, formData.level, systemConfig, curriculum]);

  // SESSION PROTOCOL: Creates device-specific verification link
  const createSecureSessionID = () => {
    const sid = crypto.randomUUID();
    localStorage.setItem('csn_session_id', sid);
    return sid;
  };

  const handleOpenLegal = (type: 'terms' | 'privacy') => {
    const url = type === 'terms' 
      ? systemConfig?.termsOfServiceUrl 
      : systemConfig?.privacyPolicyUrl;
    
    if (url) {
      window.open(ensureExternalLink(url), '_blank');
    } else {
      alert(`The ${type === 'terms' ? 'Terms of Service' : 'Privacy Policy'} node is currently being updated by the administrator.`);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLogin && !agreedToTerms) {
      setError("Please agree to the terms and privacy policy.");
      return;
    }
    setError(null);
    setIsLoading(true);
    try {
      const sid = createSecureSessionID();
      if (isLogin) {
        const cred = await signInWithEmailAndPassword(auth, formData.email, formData.password);
        
        // Claim terminal session in cloud
        await updateDoc(doc(db, 'users', cred.user.uid), {
          currentSessionId: sid
        });

        const userDoc = await getDoc(doc(db, 'users', cred.user.uid));
        if (userDoc.exists()) {
          onLogin({ id: cred.user.uid, ...userDoc.data() } as User);
        } else {
          onLogin({ id: cred.user.uid, name: 'Practitioner', email: formData.email, role: UserRole.STUDENT, isVerified: true, createdAt: new Date().toISOString(), currentSessionId: sid });
        }
      } else {
        const cred = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
        
        const now = new Date();
        const trialExpiry = new Date(now.getTime() + (48 * 60 * 60 * 1000));
        
        const newUser: any = {
          id: cred.user.uid, name: formData.name, email: formData.email,
          role: role, isVerified: role === UserRole.STUDENT, // Students verified by default (paywall protected later)
          createdAt: now.toISOString(),
          subscriptionEnd: trialExpiry.toISOString(),
          currentSessionId: sid,
          npcNumber: formData.npcNumber, specialization: formData.specialization,
          level: formData.level || 'Not Specified', council: formData.council, program: formData.program, batch: formData.batch, college: formData.college,
          status: 'active',
          intelligenceApproved: false
        };
        await setDoc(doc(db, 'users', cred.user.uid), newUser);
        onLogin(newUser as User);
      }
    } catch (err: any) {
      setError(err.message || "Credential verification node failed.");
    } finally { setIsLoading(false); }
  };

  return (
    <div className="min-h-full bg-slate-50 dark:bg-slate-950 transition-colors overflow-y-auto flex flex-col items-center pt-8 pb-12 px-4 md:justify-center md:pt-0 md:pb-0">
      <div className={`w-full ${isLogin ? 'max-w-sm' : 'max-w-xl'} animate-in flex flex-col gap-6`}>
        <div className="text-center shrink-0">
          <div className="w-10 h-10 md:w-16 md:h-16 mx-auto mb-2 md:mb-3">
            {systemConfig?.logoUrl ? (
              <img src={sanitizeUrl(systemConfig.logoUrl)} className="w-full h-full object-contain drop-shadow-lg" alt="Logo" />
            ) : (
              <div className="w-10 h-10 md:w-16 md:h-16 bg-blue-600 rounded-xl md:rounded-[32px] flex items-center justify-center font-black text-xl md:text-3xl shadow-xl text-white">C</div>
            )}
          </div>
          <h1 className="text-base md:text-2xl font-black tracking-tight text-slate-900 dark:text-white uppercase">
            {systemConfig?.platformName || 'Council Solutions'}
          </h1>
          <p className="text-slate-500 text-[7px] md:text-[8px] font-black tracking-[0.25em] uppercase mt-0.5 opacity-60">Academic Ecosystem</p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-5 md:p-10 rounded-[32px] md:rounded-[48px] shadow-xl md:shadow-2xl flex flex-col relative transition-all">
          {error && <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-xl text-red-600 text-[8px] font-black uppercase text-center animate-in">{error}</div>}
          
          <div className="flex bg-slate-50 dark:bg-slate-800/50 p-1 rounded-2xl mb-6 border border-slate-100 dark:border-slate-800 w-full max-w-[200px] mx-auto shrink-0">
             <button onClick={() => { setIsLogin(true); setError(null); }} className={`flex-1 py-2 rounded-xl text-[8px] font-black uppercase tracking-widest transition-all ${isLogin ? 'bg-white dark:bg-slate-700 text-blue-600 shadow-sm' : 'text-slate-400'}`}>Login</button>
             <button onClick={() => { setIsLogin(false); setError(null); }} className={`flex-1 py-2 rounded-xl text-[8px] font-black uppercase tracking-widest transition-all ${!isLogin ? 'bg-white dark:bg-slate-700 text-blue-600 shadow-sm' : 'text-slate-400'}`}>Signup</button>
          </div>

          {!isLogin && (
            <div className="grid grid-cols-2 gap-1 p-1 bg-slate-50 dark:bg-slate-950 rounded-2xl mb-6 border border-slate-100 dark:border-slate-800 shrink-0">
               <button onClick={() => setRole(UserRole.STUDENT)} className={`py-2 rounded-xl text-[8px] font-black uppercase tracking-widest transition-all ${role === UserRole.STUDENT ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400'}`}>Student</button>
               <button onClick={() => setRole(UserRole.INSTRUCTOR)} className={`py-2 rounded-xl text-[8px] font-black uppercase tracking-widest transition-all ${role === UserRole.INSTRUCTOR ? 'bg-purple-600 text-white shadow-lg' : 'text-slate-400'}`}>Instructor</button>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 md:space-y-5">
            <div className={`grid grid-cols-1 ${!isLogin ? 'md:grid-cols-2' : ''} gap-3 md:gap-4`}>
               {!isLogin && (
                 <div className="col-span-full">
                    <label className="text-[7px] md:text-[8px] font-black text-slate-400 uppercase tracking-widest ml-2 mb-1 block">Full Legal Name</label>
                    <input required className="w-full h-11 md:h-14 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-xl px-4 md:px-5 text-[10px] md:text-[11px] font-bold dark:text-white outline-none" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="Dr. Practitioner" />
                 </div>
               )}
               <div className={!isLogin && role === UserRole.INSTRUCTOR ? 'col-span-full' : ''}>
                  <label className="text-[7px] md:text-[8px] font-black text-slate-400 uppercase tracking-widest ml-2 mb-1 block">Academic Email</label>
                  <input type="email" required className="w-full h-11 md:h-14 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-xl px-4 md:px-5 text-[10px] md:text-[11px] font-bold dark:text-white outline-none" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} placeholder="node@council.np" />
               </div>
               <div className={!isLogin && role === UserRole.INSTRUCTOR ? 'col-span-full' : ''}>
                  <label className="text-[7px] md:text-[8px] font-black text-slate-400 uppercase tracking-widest ml-2 mb-1 block">Access Key</label>
                  <input type="password" required className="w-full h-11 md:h-14 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-xl px-4 md:px-5 text-[10px] md:text-[11px] font-bold dark:text-white outline-none" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} placeholder="••••••••" />
               </div>
               
               {!isLogin && (
                 <>
                   <div className="space-y-1">
                     <label className="text-[7px] md:text-[8px] font-black text-slate-400 uppercase tracking-widest ml-2 block">Council</label>
                     <select required className="w-full h-11 md:h-14 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-xl px-4 md:px-5 text-[10px] md:text-[11px] font-black dark:text-white outline-none" value={formData.council} onChange={e => setFormData({...formData, council: e.target.value})}>
                        <option value="">Regulatory Body</option>
                        {activeCouncils.map(c => <option key={c} value={c}>{c}</option>)}
                     </select>
                   </div>
                   
                   <div className="space-y-1">
                     <label className="text-[7px] md:text-[8px] font-black text-slate-400 uppercase tracking-widest ml-2 block">Level</label>
                     <select className="w-full h-11 md:h-14 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-xl px-4 md:px-5 text-[10px] md:text-[11px] font-black dark:text-white outline-none" value={formData.level} onChange={e => setFormData({...formData, level: e.target.value})}>
                        <option value="">Level (Optional)</option>
                        <option value="Bachelor">Bachelor</option>
                        <option value="Diploma">Diploma</option>
                        <option value="Master">Master</option>
                     </select>
                   </div>

                   <div className="col-span-full space-y-1 animate-in">
                     <label className="text-[7px] md:text-[8px] font-black text-blue-500 uppercase tracking-widest ml-2 block">Academic Program</label>
                     <select required disabled={!formData.council} className="w-full h-11 md:h-14 bg-slate-50 dark:bg-slate-950 border border-blue-500/20 rounded-xl px-4 md:px-5 text-[10px] md:text-[11px] font-black dark:text-white outline-none disabled:opacity-50" value={formData.program} onChange={e => setFormData({...formData, program: e.target.value})}>
                        <option value="">{formData.council ? 'Select Domain' : 'Select Council First'}</option>
                        {availablePrograms.map(p => <option key={p} value={p}>{p}</option>)}
                     </select>
                   </div>
                   
                   {role === UserRole.INSTRUCTOR && (
                     <>
                        <div className="space-y-1">
                          <label className="text-[7px] md:text-[8px] font-black text-slate-400 uppercase tracking-widest ml-2 block">Reg No.</label>
                          <input required className="w-full h-11 md:h-14 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-xl px-4 md:px-5 text-[10px] md:text-[11px] font-bold dark:text-white outline-none" value={formData.npcNumber} onChange={e => setFormData({...formData, npcNumber: e.target.value})} placeholder="ID #" />
                        </div>
                        <div className="space-y-1 col-span-full">
                          <label className="text-[7px] md:text-[8px] font-black text-slate-400 uppercase tracking-widest ml-2 block">Specialization</label>
                          <input required className="w-full h-11 md:h-14 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-xl px-4 md:px-5 text-[10px] md:text-[11px] font-bold dark:text-white outline-none" value={formData.specialization} onChange={e => setFormData({...formData, specialization: e.target.value})} placeholder="Expertise" />
                        </div>
                     </>
                   )}
                   <div className="space-y-1 col-span-full">
                      <label className="text-[7px] md:text-[8px] font-black text-slate-400 uppercase tracking-widest ml-2 block">Current Institution</label>
                      <input required className="w-full h-11 md:h-14 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-xl px-4 md:px-5 text-[10px] md:text-[11px] font-bold dark:text-white uppercase outline-none" value={formData.college} onChange={e => setFormData({...formData, college: e.target.value})} placeholder="College/Hospital Name" />
                   </div>
                 </>
               )}
            </div>

            {!isLogin && (
              <div className="flex items-start gap-3 mt-4 px-2">
                 <input type="checkbox" id="terms" checked={agreedToTerms} onChange={e => setAgreedToTerms(e.target.checked)} className="mt-1 w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                 <label htmlFor="terms" className="text-[8px] font-bold text-slate-500 uppercase leading-relaxed tracking-tight">
                    I agree to the <span className="text-blue-600 cursor-pointer hover:underline" onClick={() => handleOpenLegal('terms')}>Terms</span> and <span className="text-blue-600 cursor-pointer hover:underline" onClick={() => handleOpenLegal('privacy')}>Privacy Policy</span>.
                 </label>
              </div>
            )}

            <button type="submit" disabled={isLoading} className="w-full h-12 md:h-16 bg-blue-600 text-white rounded-xl md:rounded-[24px] font-black text-[9px] md:text-[10px] uppercase tracking-widest shadow-lg active:scale-95 disabled:opacity-50 transition-all mt-4">
              {isLoading ? 'Syncing...' : (isLogin ? 'Initialize Session' : 'Create Node')}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800 text-center">
            <button onClick={() => { setIsLogin(!isLogin); setError(null); }} className="text-[8px] md:text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-blue-600">
              {isLogin ? "Join Ecosystem" : "Restore Node Session"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;