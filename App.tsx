
import React, { useState, useEffect, ReactNode, Component } from 'react';
import * as ReactRouter from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './views/Dashboard';
import Tutor from './views/Tutor';
import Library from './views/Library';
import QuizHub from './views/QuizHub';
import ProgramHub from './views/ProgramHub';
import PracticalLab from './views/PracticalLab';
import News from './views/News';
import Profile from './views/Profile';
import Settings from './views/Settings';
import StudyTools from './views/StudyTools';
import AdminPortal from './views/AdminPortal';
import Auth from './views/Auth';
import Plans from './views/Plans';
import LegalView from './views/LegalView';
import { User, UserRole, SystemSettings } from './types';
import { auth, db } from './services/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, onSnapshot, updateDoc } from 'firebase/firestore';

const { HashRouter, Routes, Route, Navigate, Link } = ReactRouter as any;
const Router = HashRouter;

interface ErrorBoundaryProps { children?: ReactNode; }
interface ErrorBoundaryState { hasError: boolean; }

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = { hasError: false };
  static getDerivedStateFromError(_: any): ErrorBoundaryState { return { hasError: true }; }
  render() {
    if (this.state.hasError) {
      return (
        <div className="h-screen flex items-center justify-center bg-slate-950 text-white p-8 text-center">
          <div className="space-y-6">
            <h1 className="text-4xl font-bold uppercase tracking-tighter italic">System Node Fault 🚨</h1>
            <p className="text-slate-400 max-w-xs mx-auto uppercase tracking-widest text-[10px] leading-relaxed">A circular dependency or orchestration fault was detected in the neural network.</p>
            <button onClick={() => window.location.reload()} className="bg-blue-600 px-8 py-3 rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl active:scale-95">Restart Protocol</button>
          </div>
        </div>
      );
    }
    return (this as any).props.children || null;
  }
}

const InstructorPendingScreen: React.FC<{ onLogout: () => void }> = ({ onLogout }) => (
  <div className="h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center relative overflow-hidden">
    <div className="absolute inset-0 bg-purple-600/5 blur-[120px] rounded-full animate-pulse"></div>
    <div className="max-w-md w-full space-y-10 animate-in relative z-10">
      <div className="w-24 h-24 bg-purple-600/10 rounded-[40px] flex items-center justify-center text-purple-500 text-5xl shadow-[0_0_50px_rgba(168,85,247,0.2)] mx-auto border border-purple-500/20">⏳</div>
      <div className="space-y-3">
        <h1 className="text-3xl md:text-4xl font-black text-white uppercase tracking-tighter leading-none italic">ID Verification Pending</h1>
        <p className="text-purple-500 text-[10px] font-black uppercase tracking-[0.4em]">Protocol: Faculty Accreditation Review</p>
      </div>
      <div className="bg-white/5 border border-white/5 p-8 rounded-[40px] backdrop-blur-xl text-center">
        <p className="text-slate-400 text-sm font-medium leading-relaxed mb-6">
          Your instructor credentials have been received. To maintain institutional standards, an administrator must verify your profile before you can architect logic nodes.
        </p>
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-purple-500/10 rounded-full border border-purple-500/20">
          <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse"></span>
          <span className="text-[8px] font-black text-purple-400 uppercase tracking-widest">Awaiting Verification Sync</span>
        </div>
      </div>
      <button onClick={onLogout} className="text-slate-500 text-[9px] font-black uppercase tracking-[0.3em] hover:text-white transition-colors">Terminate Auth Session</button>
    </div>
  </div>
);

const SessionConflictScreen: React.FC<{ onReauthorize: () => void }> = ({ onReauthorize }) => (
  <div className="h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center relative overflow-hidden">
    <div className="absolute inset-0 bg-orange-600/5 blur-[120px] rounded-full animate-pulse"></div>
    <div className="max-w-md w-full space-y-10 animate-in relative z-10">
      <div className="w-24 h-24 bg-orange-600/10 rounded-[40px] flex items-center justify-center text-orange-500 text-5xl shadow-[0_0_50px_rgba(249,115,22,0.2)] mx-auto border border-orange-500/20">📱</div>
      <div className="space-y-3">
        <h1 className="text-3xl md:text-4xl font-black text-white uppercase tracking-tighter leading-none italic">Security Protocol Breach</h1>
        <p className="text-orange-500 text-[10px] font-black uppercase tracking-[0.4em]">Node Active in Another Device</p>
      </div>
      <div className="bg-white/5 border border-white/5 p-8 rounded-[40px] backdrop-blur-xl">
        <p className="text-slate-400 text-sm font-medium leading-relaxed mb-8">
          Security policy allows only one active academic terminal per account. Your session has been synchronized to a different device. 
          <br/><br/>
          To continue on this terminal, you must terminate other active node sessions.
        </p>
        <button onClick={onReauthorize} className="w-full bg-blue-600 text-white py-5 rounded-3xl font-black text-[11px] uppercase tracking-[0.2em] shadow-2xl hover:scale-105 active:scale-95 transition-all">Terminate Other Sessions</button>
      </div>
      <button onClick={() => signOut(auth)} className="text-slate-500 text-[9px] font-black uppercase tracking-[0.3em] hover:text-white transition-colors">Logout This Device</button>
    </div>
  </div>
);

const ExpiredAccessScreen: React.FC<{ onLogout: () => void }> = ({ onLogout }) => (
  <div className="h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center relative overflow-hidden">
    <div className="absolute inset-0 bg-red-600/5 blur-[120px] rounded-full animate-pulse"></div>
    <div className="max-w-md w-full space-y-10 animate-in relative z-10">
      <div className="w-24 h-24 bg-red-600/10 rounded-[40px] flex items-center justify-center text-red-500 text-5xl shadow-[0_0_50px_rgba(220,38,38,0.2)] mx-auto border border-red-500/20">🔒</div>
      <div className="space-y-3">
        <h1 className="text-3xl md:text-4xl font-black text-white uppercase tracking-tighter leading-none italic">Node Access Revoked</h1>
        <p className="text-red-500 text-[10px] font-black uppercase tracking-[0.4em]">Protocol: Trial Expired / License Required</p>
      </div>
      <div className="bg-white/5 border border-white/5 p-8 rounded-[40px] backdrop-blur-xl">
        <p className="text-slate-400 text-sm font-medium leading-relaxed mb-8">
          Your initial 48-hour academic trial period has concluded. High-yield logic nodes and AI tutoring now require an active subscription node.
        </p>
        <Link to="/plans" className="block w-full bg-blue-600 text-white py-5 rounded-3xl font-black text-[11px] uppercase tracking-[0.2em] shadow-2xl hover:scale-105 active:scale-95 transition-all">Synchronize License</Link>
      </div>
      <button onClick={onLogout} className="text-slate-500 text-[9px] font-black uppercase tracking-[0.3em] hover:text-white transition-colors">Terminate Session</button>
    </div>
  </div>
);

const LockedIntelligenceScreen: React.FC<{ user: User }> = ({ user }) => {
  const [requesting, setRequesting] = useState(false);
  const [requested, setRequested] = useState(user.intelligenceRequested || false);

  const handleRequest = async () => {
    if (requested) return;
    setRequesting(true);
    try {
      await updateDoc(doc(db, 'users', user.id), {
        intelligenceRequested: true
      });
      setRequested(true);
    } catch (e) {
      alert("Request protocol failure.");
    } finally {
      setRequesting(false);
    }
  };

  return (
    <div className="h-full min-h-[60vh] flex flex-col items-center justify-center p-6 text-center relative overflow-hidden">
      <div className="absolute inset-0 bg-blue-600/5 blur-[120px] rounded-full animate-pulse"></div>
      <div className="max-w-md w-full space-y-8 animate-in relative z-10">
        <div className="w-20 h-20 bg-blue-600/10 rounded-[32px] flex items-center justify-center text-blue-500 text-4xl shadow-[0_0_50px_rgba(37,99,235,0.2)] mx-auto border border-blue-500/20">🧠</div>
        <div className="space-y-3">
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tighter leading-none italic">Intelligence Node Locked</h1>
          <p className="text-blue-500 text-[9px] font-black uppercase tracking-[0.4em]">Protocol: Administrative Authorization Required</p>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-8 rounded-[40px] shadow-sm">
          <p className="text-slate-500 dark:text-slate-400 text-sm font-medium leading-relaxed mb-8">
            Access to AI tutoring, vision analysis, and simulation theatre is restricted for new students. An administrator must verify your academic standing before intelligence nodes can be synchronized.
          </p>
          {requested ? (
            <div className="inline-flex items-center gap-2 px-6 py-3 bg-green-500/10 rounded-full border border-green-500/20">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
              <span className="text-[9px] font-black text-green-600 uppercase tracking-widest">Authorization Request Pending</span>
            </div>
          ) : (
            <button 
              onClick={handleRequest} 
              disabled={requesting}
              className="w-full bg-blue-600 text-white py-5 rounded-3xl font-black text-[11px] uppercase tracking-[0.2em] shadow-2xl hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
            >
              {requesting ? 'Transmitting Request...' : 'Request Intelligence Access'}
            </button>
          )}
        </div>
        <Link to="/" className="text-slate-500 text-[9px] font-black uppercase tracking-[0.3em] hover:text-blue-600 transition-colors">Return to Dashboard</Link>
      </div>
    </div>
  );
};

const KeySelectionScreen: React.FC<{ onAuthorize: () => void }> = ({ onAuthorize }) => (
  <div className="h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center relative overflow-hidden">
    <div className="absolute inset-0 bg-blue-600/5 blur-[120px] rounded-full animate-pulse"></div>
    <div className="max-w-md w-full space-y-10 animate-in relative z-10">
      <div className="w-20 h-20 bg-blue-600 rounded-[32px] flex items-center justify-center text-white text-4xl shadow-[0_0_50px_rgba(37,99,235,0.3)] mx-auto border border-white/10">🔌</div>
      <div className="space-y-3">
        <h1 className="text-3xl font-black text-white uppercase tracking-tighter leading-none">Node Authorization Required</h1>
        <p className="text-blue-500 text-[10px] font-black uppercase tracking-[0.4em]">Protocol: Verify Intelligence Key</p>
      </div>
      <div className="bg-white/5 border border-white/10 p-8 rounded-[40px] backdrop-blur-xl">
        <p className="text-slate-400 text-sm font-medium leading-relaxed mb-6 italic">"The intelligence satellite network requires a valid API key to synchronize real-time academic data and AI tutoring."</p>
        <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener noreferrer" className="text-[9px] font-black text-blue-400 uppercase tracking-widest hover:underline block">Check Billing Compliance</a>
      </div>
      <button onClick={onAuthorize} className="w-full bg-blue-600 text-white py-5 rounded-3xl font-black text-[11px] uppercase tracking-[0.2em] shadow-2xl shadow-blue-600/20 hover:scale-105 active:scale-95 transition-all">Authorize Node Link</button>
    </div>
  </div>
);

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [sysConfig, setSysConfig] = useState<Partial<SystemSettings> | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [needsKey, setNeedsKey] = useState(false);
  const [sessionConflict, setSessionConflict] = useState(false);

  // ROBUST SANITIZATION: Prevents circular errors by strictly allowing only serializable plain objects/arrays/primitives
  const sanitizeFirestoreData = (data: any): any => {
    if (data === null || typeof data !== 'object') return data;
    
    // Convert Firestore Timestamps to ISO strings
    if (data.seconds !== undefined && data.nanoseconds !== undefined) {
      return new Date(data.seconds * 1000).toISOString();
    }

    if (Array.isArray(data)) return data.map(sanitizeFirestoreData);

    // Filter for Plain Objects only. Strips out minified internal Firebase classes (circular references)
    const isPlainObject = Object.prototype.toString.call(data) === '[object Object]' && 
                          (data.constructor === Object || data.constructor === undefined);

    if (!isPlainObject) return '[Filtered Reference]';

    const sanitized: any = {};
    for (const key in data) {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        sanitized[key] = sanitizeFirestoreData(data[key]);
      }
    }
    return sanitized;
  };

  useEffect(() => {
    const checkKeySelection = async () => {
      const apiKey = String(process.env.GEMINI_API_KEY || "");
      const aistudio = (window as any).aistudio;
      const isKeyMissing = !apiKey || apiKey.length < 5;
      if (isKeyMissing && aistudio) {
        const hasKey = await aistudio.hasSelectedApiKey();
        if (!hasKey) setNeedsKey(true);
      } else if (isKeyMissing && !aistudio) {
        setNeedsKey(true);
      }
    };

    const fetchConfig = async () => {
      try {
        const snap = await getDoc(doc(db, 'system', 'config'));
        if (snap.exists()) {
          setSysConfig(sanitizeFirestoreData(snap.data()));
        }
      } catch (e) { console.warn("Global configuration node inaccessible."); }
    };

    fetchConfig();
    checkKeySelection();

    let userUnsub: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (userUnsub) { userUnsub(); userUnsub = null; }

      if (firebaseUser) {
        userUnsub = onSnapshot(doc(db, 'users', firebaseUser.uid), (docSnap) => {
          if (docSnap.exists()) {
            const rawData = docSnap.data();
            const sanitizedData = sanitizeFirestoreData(rawData) as User;
            
            // SECURITY NODE: Enforce single-device session integrity
            if (sanitizedData.role === UserRole.STUDENT) {
              const localSid = localStorage.getItem('csn_session_id');
              if (sanitizedData.currentSessionId && localSid && sanitizedData.currentSessionId !== localSid) {
                setSessionConflict(true);
              } else {
                setSessionConflict(false);
              }
            }

            const { id: _id, ...rest } = sanitizedData;
            setUser({ id: firebaseUser.uid, ...rest });
          } else {
            setUser({ id: firebaseUser.uid, email: firebaseUser.email || '', role: UserRole.STUDENT, isVerified: true, createdAt: new Date().toISOString() } as User);
          }
          setInitializing(false);
        }, (err) => {
          console.error("User node sync fault:", err);
          setInitializing(false);
        });
      } else {
        setUser(null);
        setInitializing(false);
        setSessionConflict(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (userUnsub) userUnsub();
    };
  }, []);

  const handleReauthorizeSession = async () => {
    if (!auth.currentUser) return;
    const newSid = crypto.randomUUID();
    localStorage.setItem('csn_session_id', newSid);
    try {
      await updateDoc(doc(db, 'users', auth.currentUser.uid), {
        currentSessionId: newSid
      });
      setSessionConflict(false);
    } catch (e) { alert("Session re-claim protocol failure."); }
  };

  const handleAuthorize = async () => {
    const aistudio = (window as any).aistudio;
    if (aistudio) {
      await aistudio.openSelectKey();
      setNeedsKey(false);
    } else { alert("Outside AI Studio context. Set API_KEY manually."); }
  };

  const handleLogout = () => signOut(auth);

  if (needsKey) return <KeySelectionScreen onAuthorize={handleAuthorize} />;
  if (initializing) return <div className="h-screen bg-slate-950 flex items-center justify-center"><div className="w-10 h-10 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div></div>;

  const isExpired = user?.role === UserRole.STUDENT && 
                    user?.subscriptionEnd && 
                    new Date(user.subscriptionEnd).getTime() < Date.now();

  return (
    <ErrorBoundary>
      <Router>
        <Routes>
          {!user ? (
            <>
              <Route path="/auth" element={<Auth onLogin={setUser} systemConfig={sysConfig} />} />
              <Route path="/legal/:type" element={<LegalView />} />
              <Route path="*" element={<Navigate to="/auth" replace />} />
            </>
          ) : (
            user.role === UserRole.INSTRUCTOR && !user.isVerified ? (
              <Route path="*" element={<InstructorPendingScreen onLogout={handleLogout} />} />
            ) : sessionConflict ? (
              <Route path="*" element={<SessionConflictScreen onReauthorize={handleReauthorizeSession} />} />
            ) : (
              <Route path="/" element={<Layout user={user} onLogout={handleLogout} />}>
                {isExpired ? (
                  <>
                    <Route index element={<ExpiredAccessScreen onLogout={handleLogout} />} />
                    <Route path="plans" element={<Plans user={user} />} />
                    <Route path="profile" element={<Profile user={user} />} />
                    <Route path="legal/:type" element={<LegalView />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </>
                ) : (
                  <>
                    <Route index element={<Dashboard user={user} />} />
                    <Route path="tutor" element={user.intelligenceApproved || user.role === UserRole.ADMIN ? <Tutor /> : <LockedIntelligenceScreen user={user} />} />
                    <Route path="library" element={<Library user={user} />} />
                    <Route path="quiz" element={<QuizHub user={user} />} />
                    <Route path="program-hub" element={user.intelligenceApproved || user.role === UserRole.ADMIN ? <ProgramHub user={user} /> : <LockedIntelligenceScreen user={user} />} />
                    <Route path="lab" element={user.intelligenceApproved || user.role === UserRole.ADMIN ? <PracticalLab user={user} /> : <LockedIntelligenceScreen user={user} />} />
                    <Route path="news" element={<News />} />
                    <Route path="profile" element={<Profile user={user} />} />
                    <Route path="settings" element={<Settings />} />
                    <Route path="intelligence-node" element={user.intelligenceApproved || user.role === UserRole.ADMIN ? <StudyTools user={user} /> : <LockedIntelligenceScreen user={user} />} />
                    <Route path="plans" element={<Plans user={user} />} />
                    <Route path="legal/:type" element={<LegalView />} />
                    {user.role === UserRole.ADMIN && <Route path="admin" element={<AdminPortal user={user} />} />}
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </>
                )}
              </Route>
            )
          )}
        </Routes>
      </Router>
    </ErrorBoundary>
  );
};

export default App;
