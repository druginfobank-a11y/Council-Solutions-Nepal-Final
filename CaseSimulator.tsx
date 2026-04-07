
import React, { useState, useEffect, useMemo, useRef } from 'react';
import * as ReactRouter from 'react-router-dom';
import { User, UserRole, PaymentRequest, Quiz, LearningMaterial, SystemSettings, Plan, ExamResult, Ad } from '../types';
import { subscribeToAllUsers, setUserVerification, subscribeToPaymentRequests, updatePaymentStatusInCloud, setUserIntelligenceApproval, setUserStatus } from '../services/userService';
import { updateQuizStatusInCloud, updateMaterialStatusInCloud, getCurriculum, getQuizRankings, saveCurriculum } from '../services/contentService';
import { subscribeToPlans, savePlanToCloud, deletePlanFromCloud } from '../services/planService';
import { verifyBunnyConnection, uploadToBunny, sanitizeUrl } from '../services/storageService';
import { generateQuizReport } from '../services/pdfService';
import { PROGRAMS_DATA } from '../constants';
import { doc, setDoc, collection, onSnapshot, addDoc, deleteDoc, query, where, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';
import CropModal from '../components/CropModal';

const { useLocation } = ReactRouter as any;

interface AdminPortalProps { user: User; }

const AdminPortal: React.FC<AdminPortalProps> = ({ user: currentAdmin }) => {
  const location = useLocation();
  const [activeTab, setActiveTab] = useState('Overview');
  const [isSaving, setIsSaving] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isUploadingQR, setIsUploadingQR] = useState<string | null>(null);
  const [verifyStatus, setVerifyStatus] = useState<{ success: boolean; message: string } | null>(null);
  const [processingNodes, setProcessingNodes] = useState<Set<string>>(new Set());

  // Finance Review State
  const [reviewingPayment, setReviewingPayment] = useState<PaymentRequest | null>(null);

  // Cropping States
  const [croppingImage, setCroppingImage] = useState<string | null>(null);
  const [cropTarget, setCropTarget] = useState<'adBanner' | null>(null);

  // Data States - Defensive arrays
  const [users, setUsers] = useState<User[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [payments, setPayments] = useState<PaymentRequest[]>([]);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [libraryItems, setLibraryItems] = useState<LearningMaterial[]>([]);
  const [ads, setAds] = useState<Ad[]>([]);
  
  // Gradebook States
  const [selectedQuizId, setSelectedQuizId] = useState<string | null>(null);
  const [rankings, setRankings] = useState<ExamResult[]>([]);
  const [isExporting, setIsExporting] = useState(false);

  // Curriculum States
  const [newCouncilName, setNewCouncilName] = useState('');
  const [newProgramInputs, setNewProgramInputs] = useState<Record<string, string>>({});
  const [curriculum, setCurriculum] = useState<Record<string, Record<string, string[]>>>(PROGRAMS_DATA);

  // Config States
  const [sysSettings, setSysSettings] = useState<SystemSettings>({
    maintenanceMode: false, platformName: 'Council Solutions Nepal', logoUrl: '', esewaNumber: '', esewaQrUrl: '', khaltiNumber: '', khaltiQrUrl: '',
    bankName: '', bankAccountNumber: '', bankQrUrl: '', bunnyRegion: 'Singapore', bunnyZoneName: '', bunnyPassword: '', bunnyPullZoneUrl: '',
    enabledPrograms: {}, privacyPolicyUrl: '', termsOfServiceUrl: '', showDisclaimers: false
  });
  
  const [adForm, setAdForm] = useState({ 
    title: '', 
    content: '', 
    type: 'info' as any, 
    targetCouncil: 'All',
    imageUrl: '',
    linkUrl: '',
    displayDuration: 5
  });
  const [planForm, setPlanForm] = useState<Partial<Plan>>({ name: '', price: '', duration: '1 Month', features: [], targetProgram: 'All Programs' });

  // Handle URL deep-linking to specific tabs
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tab = params.get('tab');
    if (tab) {
      setActiveTab(tab);
    }
  }, [location.search]);

  useEffect(() => {
    const unsubConfig = onSnapshot(doc(db, 'system', 'config'), (snap) => {
      if (snap.exists()) {
        const data = snap.data() as SystemSettings;
        setSysSettings(prev => ({ ...prev, ...data, enabledPrograms: data.enabledPrograms || {} }));
      }
    }, (err) => console.warn("Config node sync failure:", err));

    getCurriculum().then(data => data && setCurriculum(data));

    const unsubUsers = subscribeToAllUsers(setUsers, (err) => console.warn("Admin identity sync failure:", err));
    const unsubPlans = subscribeToPlans(setPlans, (err) => console.warn("Admin plan sync failure:", err));
    const unsubPayments = subscribeToPaymentRequests(setPayments, (err) => console.warn("Admin finance sync failure:", err));
    
    const unsubQuizzes = onSnapshot(collection(db, 'quizzes'), snap => setQuizzes(snap.docs.map(d => ({ id: d.id, ...d.data() } as Quiz))), (err) => console.warn("Admin logic sync failure:", err));
    const unsubMaterials = onSnapshot(collection(db, 'materials'), snap => setLibraryItems(snap.docs.map(d => ({ id: d.id, ...d.data() } as LearningMaterial))), (err) => console.warn("Admin asset sync failure:", err));
    const unsubAds = onSnapshot(collection(db, 'ads'), snap => setAds(snap.docs.map(d => ({ id: d.id, ...d.data() } as Ad))), (err) => console.warn("Admin bulletin sync failure:", err));
    
    return () => {
      unsubConfig(); unsubUsers(); unsubPlans(); unsubPayments(); unsubQuizzes(); unsubMaterials(); unsubAds();
    };
  }, []);

  useEffect(() => {
    if (selectedQuizId) {
      getQuizRankings(selectedQuizId).then(setRankings);
    }
  }, [selectedQuizId]);

  const handleModeration = async (id: string, type: 'identity' | 'quiz' | 'library' | 'payment' | 'intelligence', action: 'approved' | 'rejected') => {
    setProcessingNodes(prev => new Set(prev).add(id));
    try {
      if (type === 'identity') await setUserVerification(id, action === 'approved');
      if (type === 'quiz') await updateQuizStatusInCloud(id, action);
      if (type === 'library') await updateMaterialStatusInCloud(id, action);
      if (type === 'payment') {
        await updatePaymentStatusInCloud(id, action);
        if (reviewingPayment?.id === id) setReviewingPayment(null);
      }
      if (type === 'intelligence') await setUserIntelligenceApproval(id, action === 'approved');
    } catch (e) {
      alert(`Terminal Sync Fault.`);
    } finally { setProcessingNodes(prev => { const n = new Set(prev); n.delete(id); return n; }); }
  };

  const handleSaveSettings = async () => {
    setIsSaving(true);
    try {
      await setDoc(doc(db, 'system', 'config'), sysSettings, { merge: true });
      alert("Platform Parameters Synchronized.");
    } catch (e) { alert("Config commit fault."); }
    finally { setIsSaving(false); }
  };

  const handleSaveCurriculum = async () => {
    setIsSaving(true);
    try {
      await saveCurriculum(curriculum);
      await setDoc(doc(db, 'system', 'config'), { enabledPrograms: sysSettings.enabledPrograms }, { merge: true });
      alert("Academic Matrix Provisions Complete.");
    } catch (e) { alert("Matrix commit fault."); }
    finally { setIsSaving(false); }
  };

  const handleQRUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: 'esewaQrUrl' | 'khaltiQrUrl' | 'bankQrUrl' | 'logoUrl' | 'adBanner') => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (field === 'adBanner') {
        const reader = new FileReader();
        reader.onload = () => {
            setCroppingImage(reader.result as string);
            setCropTarget('adBanner');
        };
        reader.readAsDataURL(file);
        return;
    }

    setIsUploadingQR(field);
    try {
      const url = await uploadToBunny(file, 'system');
      setSysSettings(prev => ({ ...prev, [field]: url }));
    } catch (err) { alert("Asset uplink fault."); }
    finally { setIsUploadingQR(null); }
  };

  const handleCropComplete = async (croppedBlob: Blob) => {
    const field = cropTarget;
    if (!field) return;

    setCroppingImage(null);
    setCropTarget(null);
    setIsUploadingQR(field);
    
    try {
      const file = new File([croppedBlob], `cropped-${Date.now()}.jpg`, { type: 'image/jpeg' });
      const url = await uploadToBunny(file, field === 'adBanner' ? 'ads' : 'system');
      if (field === 'adBanner') {
        setAdForm(prev => ({ ...prev, imageUrl: url }));
      } else {
        setSysSettings(prev => ({ ...prev, [field]: url }));
      }
    } catch (err) {
      alert("Asset uplink fault after adjustment.");
    } finally {
      setIsUploadingQR(null);
    }
  };

  const executeDiagnostics = async () => {
    setIsVerifying(true);
    setVerifyStatus(null);
    try {
      const result = await verifyBunnyConnection(sysSettings);
      setVerifyStatus(result);
    } finally { setIsVerifying(false); }
  };

  const handleUpdatePlan = async () => {
    if (!planForm.name || !planForm.price) return;
    setIsSaving(true);
    try {
      const id = planForm.id || Math.random().toString(36).substring(7);
      await savePlanToCloud({ ...planForm, id } as Plan);
      setPlanForm({ name: '', price: '', duration: '1 Month', features: [], targetProgram: 'All Programs' });
      alert("Tier Node Synchronized.");
    } catch (e) { alert("Plan commit fault."); }
    finally { setIsSaving(false); }
  };

  const handleCreateAd = async () => {
    if (!adForm.title || !adForm.content) return;
    setIsSaving(true);
    try {
      await addDoc(collection(db, 'ads'), { ...adForm, createdAt: new Date().toISOString() });
      setAdForm({ title: '', content: '', type: 'info', targetCouncil: 'All', imageUrl: '', linkUrl: '', displayDuration: 5 });
      alert("Bulletin Broadcast Successful.");
    } catch (e) { alert("Ad dispatch fault."); }
    finally { setIsSaving(false); }
  };

  const handleExportGradebook = async () => {
    if (!selectedQuizId || rankings.length === 0) return;
    setIsExporting(true);
    try {
      const quiz = quizzes.find(q => q.id === selectedQuizId);
      if (quiz) await generateQuizReport(quiz, rankings, sysSettings.logoUrl);
    } finally { setIsExporting(false); }
  };

  const handleAddCouncil = () => {
    if (!newCouncilName.trim()) return;
    const name = newCouncilName.toUpperCase().trim();
    if (curriculum[name]) return alert("Council node exists.");
    setCurriculum({ ...curriculum, [name]: { Diploma: [], Bachelor: [], Master: [] } });
    setNewCouncilName('');
  };

  const handleAddProgram = (council: string, level: string) => {
    const key = `${council}-${level}`;
    const prog = (newProgramInputs[key] || '').trim();
    if (!prog) return;
    const updated = { ...curriculum };
    if (!updated[council][level]) updated[council][level] = [];
    if (!updated[council][level].includes(prog)) {
      updated[council][level] = [...updated[council][level], prog];
      setCurriculum(updated);
      setNewProgramInputs({ ...newProgramInputs, [key]: '' });
    }
  };

  const pendingInstructors = useMemo(() => (users || []).filter(u => u.role === UserRole.INSTRUCTOR && !u.isVerified), [users]);
  const aiRequests = useMemo(() => (users || []).filter(u => u.intelligenceRequested && !u.intelligenceApproved), [users]);
  const pendingQuizzes = useMemo(() => (quizzes || []).filter(q => q.status === 'pending'), [quizzes]);
  const pendingLibrary = useMemo(() => (libraryItems || []).filter(l => l.status === 'pending'), [libraryItems]);
  
  const consoleItems = [
    { id: 'Overview', icon: '📈', label: 'OVERVIEW' },
    { id: 'Gradebook', icon: '🎓', label: 'GRADEBOOK' },
    { id: 'Identity', icon: 'ID', label: 'IDENTITY', badge: (pendingInstructors.length || 0) + (aiRequests.length || 0) },
    { id: 'Finance', icon: '💰', label: 'FINANCE', badge: (payments || []).length },
    { id: 'Quizzes', icon: '📝', label: 'QUIZZES', badge: (pendingQuizzes || []).length },
    { id: 'Library', icon: '📚', label: 'LIBRARY', badge: (pendingLibrary || []).length },
    { id: 'Plans', icon: '💳', label: 'PLANS' },
    { id: 'Users', icon: '👥', label: 'USERS' },
    { id: 'Curriculum', icon: '📖', label: 'CURRICULUM' },
    { id: 'Ads', icon: '📢', label: 'ADS' },
    { id: 'System', icon: '⚙️', label: 'SYSTEM' },
    { id: 'Integrations', icon: '🔌', label: 'INTEGRATIONS' }
  ];

  const SystemField: React.FC<{ label: string; value: string; field: keyof SystemSettings; type?: 'text' | 'password' | 'select'; options?: string[]; placeholder?: string }> = ({ label, value, field, type = 'text', options, placeholder }) => (
    <div className="space-y-1.5">
      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">{label}</label>
      {type === 'select' ? (
        <select value={value} onChange={e => setSysSettings({...sysSettings, [field]: e.target.value})} className="w-full h-12 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 text-xs font-bold dark:text-white outline-none">
          {options?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
        </select>
      ) : (
        <input 
          type={type === 'password' ? 'password' : 'text'} 
          value={value || ''} 
          placeholder={placeholder}
          onChange={e => setSysSettings({...sysSettings, [field]: e.target.value})} 
          className="w-full h-12 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 text-xs font-bold dark:text-white outline-none" 
        />
      )}
    </div>
  );

  const QRUploader: React.FC<{ label: string; url: string | undefined; field: 'esewaQrUrl' | 'khaltiQrUrl' | 'bankQrUrl' | 'logoUrl' | 'adBanner' }> = ({ label, url, field }) => (
    <div className="space-y-3">
      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">{label}</label>
      <div 
        onClick={() => { if (!isUploadingQR) { document.getElementById(`qr-${field}`)?.click(); }}}
        className="w-full h-32 bg-slate-50 dark:bg-slate-950 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl flex flex-col items-center justify-center cursor-pointer hover:border-blue-500 transition-all overflow-hidden relative group"
      >
        <input id={`qr-${field}`} type="file" className="hidden" accept="image/*" onChange={(e) => handleQRUpload(e, field)} />
        {isUploadingQR === field ? (
          <div className="flex flex-col items-center gap-2"><div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div><p className="text-[8px] font-black text-blue-600">SYNCING...</p></div>
        ) : url ? (
          <div className="w-full h-full relative">
              <img src={sanitizeUrl(url)} className="w-full h-full object-contain p-2" alt={label} />
              <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[7px] font-black uppercase tracking-widest">Swap Node</div>
          </div>
        ) : (
          <div className="text-center"><span className="text-2xl block mb-1">📷</span><p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Upload Asset</p></div>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-8 md:space-y-12 animate-in pb-32 max-w-6xl mx-auto px-4 md:px-0">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <div className="w-16 h-16 bg-blue-600 rounded-3xl flex items-center justify-center text-3xl shadow-2xl mb-6 border border-white/10 shadow-blue-600/30">
             <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          </div>
          <h1 className="text-4xl md:text-6xl font-black uppercase tracking-tighter text-slate-900 dark:text-white leading-none italic">Console</h1>
          <p className="text-slate-500 text-[10px] md:text-[12px] font-black uppercase tracking-[0.4em] mt-3 opacity-60">Global Orchestration Hub</p>
        </div>
      </header>

      {/* Cropper Integration Node */}
      {croppingImage && (
          <CropModal 
            image={croppingImage} 
            onCropComplete={handleCropComplete} 
            onCancel={() => { setCroppingImage(null); setCropTarget(null); }} 
            aspect={cropTarget === 'adBanner' ? 3.2 / 1 : 1 / 1}
          />
      )}

      {/* Finance Detail Review Modal */}
      {reviewingPayment && (
        <div className="fixed inset-0 z-[5000] bg-slate-950/95 backdrop-blur-xl flex items-center justify-center p-4 md:p-10 animate-in">
          <div className="bg-white dark:bg-slate-900 w-full max-w-4xl md:rounded-[48px] overflow-hidden border border-slate-100 dark:border-slate-800 shadow-2xl flex flex-col h-[90vh]">
             <header className="p-6 md:p-8 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center shrink-0">
                <div>
                   <h3 className="text-xl md:text-2xl font-black uppercase dark:text-white italic tracking-tighter">Finance Verification Node</h3>
                   <p className="text-[8px] md:text-[10px] font-black text-blue-500 uppercase tracking-widest mt-1">Reviewing: {reviewingPayment.userName} • {reviewingPayment.planName}</p>
                </div>
                <button onClick={() => setReviewingPayment(null)} className="w-10 h-10 md:w-12 md:h-12 bg-slate-50 dark:bg-slate-800 rounded-xl flex items-center justify-center text-slate-400 hover:text-red-500 transition-colors">
                   <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18 6L6 18M6 6l12 12"/></svg>
                </button>
             </header>

             <div className="flex-1 overflow-y-auto p-4 md:p-8 flex flex-col md:flex-row gap-8 scrollbar-hide">
                <div className="flex-1 flex flex-col gap-6">
                   <div className="bg-slate-50 dark:bg-slate-950 rounded-[32px] border border-slate-100 dark:border-slate-800 p-4 relative overflow-hidden flex-1 group">
                      <img 
                        src={sanitizeUrl(reviewingPayment.screenshot)} 
                        className="w-full h-full object-contain cursor-zoom-in" 
                        alt="Payment Proof" 
                        onClick={() => window.open(reviewingPayment.screenshot)}
                      />
                      <div className="absolute top-4 right-4 px-3 py-1 bg-black/50 text-white rounded-full text-[8px] font-black uppercase tracking-widest pointer-events-none">Full-Resolution Asset</div>
                   </div>
                </div>
                <div className="w-full md:w-80 flex flex-col gap-6 shrink-0">
                   <div className="space-y-4">
                      <div className="p-6 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-3xl">
                         <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Practitioner ID</p>
                         <p className="text-xs font-black dark:text-white truncate">{reviewingPayment.userName}</p>
                      </div>
                      <div className="p-6 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-3xl">
                         <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Assigned Tier</p>
                         <p className="text-xs font-black text-blue-600 uppercase">{reviewingPayment.planName}</p>
                      </div>
                      <div className="p-6 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-3xl">
                         <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Reference Terminal Code</p>
                         <p className="text-sm font-black text-red-600 tracking-wider font-mono">{reviewingPayment.referenceId}</p>
                      </div>
                      <div className="p-6 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-3xl">
                         <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Submission Cycle</p>
                         <p className="text-xs font-bold text-slate-500">{new Date(reviewingPayment.timestamp).toLocaleString()}</p>
                      </div>
                   </div>
                   
                   <div className="mt-auto space-y-3 pt-6 border-t border-slate-100 dark:border-slate-800">
                      <button 
                        onClick={() => handleModeration(reviewingPayment.id, 'payment', 'approved')}
                        disabled={processingNodes.has(reviewingPayment.id)}
                        className="w-full h-16 bg-green-600 text-white rounded-[24px] font-black text-[10px] uppercase tracking-widest shadow-xl shadow-green-600/20 active:scale-95 transition-all disabled:opacity-50"
                      >
                         {processingNodes.has(reviewingPayment.id) ? 'SYNCING...' : 'VERIFY & GRANT ACCESS'}
                      </button>
                      <button 
                        onClick={() => handleModeration(reviewingPayment.id, 'payment', 'rejected')}
                        disabled={processingNodes.has(reviewingPayment.id)}
                        className="w-full h-16 bg-red-600 text-white rounded-[24px] font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all disabled:opacity-50"
                      >
                         {processingNodes.has(reviewingPayment.id) ? 'SYNCING...' : 'REJECT & VOID'}
                      </button>
                   </div>
                </div>
             </div>
          </div>
        </div>
      )}

      <div className="bg-[#0a101f] rounded-[56px] border border-white/5 p-10 md:p-14 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-600/5 blur-[120px] rounded-full pointer-events-none"></div>
        <div className="grid grid-cols-3 md:grid-cols-3 lg:grid-cols-3 gap-y-14 md:gap-y-16 items-center">
          {consoleItems.map(item => (
             <div key={item.id} className="flex flex-col items-center group relative">
                <button onClick={() => setActiveTab(item.id)} className={`relative flex flex-col items-center justify-center transition-all duration-500 ${activeTab === item.id ? 'z-10 scale-110' : 'hover:scale-105'}`}>
                   {activeTab === item.id && <div className="absolute inset-0 -m-8 md:-m-10 bg-white/5 border border-blue-500/20 rounded-[48px] shadow-[inset_0_0_40px_rgba(0,0,0,0.1)] backdrop-blur-sm animate-in fade-in zoom-in duration-500"></div>}
                   <div className={`w-14 h-14 md:w-16 md:h-16 rounded-[22px] md:rounded-[26px] flex items-center justify-center text-xl md:text-2xl mb-4 transition-all duration-300 relative ${activeTab === item.id ? 'bg-[#1a253a] shadow-[0_0_25px_rgba(59,130,246,0.3)] border border-blue-500/40' : 'bg-[#131b2d] border border-white/5 group-hover:border-white/10 shadow-xl'}`}>
                      {item.icon === 'ID' ? <div className="bg-[#7c3aed] w-9 h-9 md:w-10 md:h-10 rounded-xl flex items-center justify-center text-white text-[10px] md:text-[11px] font-black uppercase shadow-lg border border-white/20">ID</div> : <span className={`${activeTab === item.id ? 'opacity-100 scale-110' : 'opacity-70 group-hover:opacity-100 group-hover:scale-110'} transition-transform duration-300`}>{item.icon}</span>}
                      {item.badge !== undefined && item.badge > 0 && <span className="absolute -top-2 -right-2 bg-red-600 text-white text-[9px] font-black w-6 h-6 rounded-full flex items-center justify-center shadow-lg border-2 border-[#0a101f] animate-pulse">{item.badge}</span>}
                   </div>
                   <span className={`text-[8px] md:text-[9px] font-black uppercase tracking-[0.2em] transition-colors duration-300 ${activeTab === item.id ? 'text-blue-500' : 'text-slate-500 group-hover:text-slate-300'}`}>{item.label}</span>
                </button>
             </div>
          ))}
        </div>
      </div>

      <div className="mt-12 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-8 md:p-14 rounded-[56px] shadow-sm min-h-[500px]">
        
        {activeTab === 'Overview' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in">
             {[
               { l: 'Quiz Logic Nodes', v: (quizzes || []).length, c: 'blue' },
               { l: 'Library Asset Nodes', v: (libraryItems || []).length, c: 'red' },
               { l: 'Payment Request Nodes', v: (payments || []).length, c: 'green' }
             ].map((s, i) => (
               <div key={i} className="p-8 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-[40px]">
                  <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">{s.l}</p>
                  <p className={`text-4xl font-black text-${s.c}-600`}>{s.v}</p>
               </div>
             ))}
          </div>
        )}

        {activeTab === 'Gradebook' && (
          <div className="space-y-8 animate-in">
             <div className="flex flex-col md:flex-row gap-8">
                <div className="w-full md:w-72 space-y-4">
                   <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Assessment Nodes</h4>
                   <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2 scrollbar-hide">
                      {(quizzes || []).map(q => (
                        <button key={q.id} onClick={() => setSelectedQuizId(q.id)} className={`w-full text-left p-5 rounded-2xl border transition-all ${selectedQuizId === q.id ? 'bg-blue-600 border-blue-500 text-white shadow-xl' : 'bg-slate-50 dark:bg-slate-800 border-transparent hover:border-slate-200'}`}>
                           <p className="text-[10px] font-black uppercase truncate">{q.title}</p>
                           <p className={`text-[8px] font-bold uppercase mt-1 ${selectedQuizId === q.id ? 'text-blue-100' : 'text-slate-400'}`}>{q.subject} • {q.program}</p>
                        </button>
                      ))}
                   </div>
                </div>
                <div className="flex-1">
                   {selectedQuizId ? (
                     <div className="space-y-8">
                        <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-950 p-6 rounded-[32px] border border-slate-100 dark:border-slate-800">
                           <div>
                              <h4 className="text-xl font-black uppercase dark:text-white italic">Practitioner Performance</h4>
                              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">Found {(rankings || []).length} evaluations for this node.</p>
                           </div>
                           <button onClick={handleExportGradebook} disabled={isExporting || (rankings || []).length === 0} className="px-6 py-3 bg-blue-600 text-white rounded-xl font-black text-[9px] uppercase tracking-widest shadow-xl active:scale-95 transition-all">
                              {isExporting ? 'GENERATING...' : 'EXPORT TRANSCRIPT'}
                           </button>
                        </div>
                        <div className="overflow-x-auto">
                           <table className="w-full text-left border-collapse">
                              <thead>
                                 <tr className="border-b border-slate-100 dark:border-slate-800"><th className="pb-4 text-[9px] font-black text-slate-500 uppercase px-4">Rank</th><th className="pb-4 text-[9px] font-black text-slate-500 uppercase">Practitioner</th><th className="pb-4 text-[9px] font-black text-slate-500 uppercase">Score</th><th className="pb-4 text-[9px] font-black text-slate-500 uppercase text-right px-4">Mastery</th></tr>
                              </thead>
                              <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                                 {(rankings || []).map((r, i) => (
                                   <tr key={i} className="group hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all">
                                      <td className="py-5 text-[10px] font-black px-4">#{i+1}</td>
                                      <td className="py-5 text-[11px] font-bold uppercase dark:text-white">{r.userName}</td>
                                      <td className="py-5 text-[10px] font-bold text-slate-500">{r.score}/{r.totalQuestions}</td>
                                      <td className="py-5 text-right px-4"><span className={`px-2 py-0.5 rounded text-[8px] font-black ${r.percentage >= 50 ? 'bg-green-500/10 text-green-600' : 'bg-red-500/10 text-red-600'}`}>{Math.round(r.percentage)}%</span></td>
                                   </tr>
                                 ))}
                              </tbody>
                           </table>
                        </div>
                     </div>
                   ) : <div className="h-[400px] flex items-center justify-center border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-[48px] opacity-30 text-[11px] font-black uppercase tracking-widest">Select logic node to view telemetry.</div>}
                </div>
             </div>
          </div>
        )}

        {activeTab === 'Identity' && (
           <div className="space-y-12 animate-in">
              <section className="space-y-6">
                 <h3 className="text-xl font-black uppercase dark:text-white italic">Faculty Verification Queue</h3>
                 <div className="grid gap-4">
                    {(pendingInstructors || []).map(u => (
                      <div key={u.id} className="p-8 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-[32px] flex flex-col md:flex-row justify-between items-center gap-6">
                        <div className="flex gap-4 items-center w-full">
                           <div className="w-14 h-14 bg-purple-500/10 rounded-2xl flex items-center justify-center text-3xl">🩺</div>
                           <div className="min-w-0">
                              <p className="font-black text-base uppercase dark:text-white truncate">{u.name || 'Anonymous Node'}</p>
                              <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">{u.specialization || 'General'} • NPC: {u.npcNumber || 'Pending'}</p>
                           </div>
                        </div>
                        <div className="flex gap-3 w-full md:w-auto">
                           <button onClick={() => handleModeration(u.id, 'identity', 'approved')} className="flex-1 px-8 py-4 bg-blue-600 text-white rounded-2xl text-[9px] font-black uppercase shadow-lg active:scale-95 transition-all">Authorize</button>
                           <button onClick={() => handleModeration(u.id, 'identity', 'rejected')} className="flex-1 px-8 py-4 bg-red-600 text-white rounded-2xl text-[9px] font-black uppercase active:scale-95 transition-all">Deny</button>
                        </div>
                      </div>
                    ))}
                    {(pendingInstructors || []).length === 0 && <div className="py-12 text-center opacity-30 text-xs font-black uppercase border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-[32px]">Faculty Node Clear</div>}
                 </div>
              </section>

              <section className="space-y-6">
                 <h3 className="text-xl font-black uppercase dark:text-white italic">AI Access Requests</h3>
                 <div className="grid gap-4">
                    {(aiRequests || []).map(u => (
                      <div key={u.id} className="p-8 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-[32px] flex flex-col md:flex-row justify-between items-center gap-6">
                        <div className="flex gap-4 items-center w-full">
                           <div className="w-14 h-14 bg-blue-500/10 rounded-2xl flex items-center justify-center text-3xl">🧠</div>
                           <div className="min-w-0">
                              <p className="font-black text-base uppercase dark:text-white truncate">{u.name}</p>
                              <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">{u.program} • {u.email}</p>
                           </div>
                        </div>
                        <div className="flex gap-3 w-full md:w-auto">
                           <button onClick={() => handleModeration(u.id, 'intelligence', 'approved')} className="flex-1 px-8 py-4 bg-green-600 text-white rounded-2xl text-[9px] font-black uppercase shadow-lg active:scale-95 transition-all">Grant Link</button>
                           <button onClick={() => handleModeration(u.id, 'intelligence', 'rejected')} className="flex-1 px-8 py-4 bg-red-600 text-white rounded-2xl text-[9px] font-black uppercase active:scale-95 transition-all">Refuse</button>
                        </div>
                      </div>
                    ))}
                    {(aiRequests || []).length === 0 && <div className="py-12 text-center opacity-30 text-xs font-black uppercase border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-[32px]">Neural Access Clear</div>}
                 </div>
              </section>
           </div>
        )}

        {activeTab === 'Finance' && (
           <div className="space-y-8 animate-in">
              <h3 className="text-xl font-black uppercase italic mb-8">Financial Transmissions</h3>
              <div className="grid gap-4">
                 {(payments || []).map(p => (
                   <div key={p.id} className="p-8 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-[32px] flex flex-col md:flex-row justify-between items-center gap-6 group">
                     <div className="flex gap-6 items-center w-full">
                        <div className="w-16 h-16 bg-green-500/10 rounded-2xl flex items-center justify-center text-3xl cursor-pointer hover:scale-105 transition-transform" onClick={() => setReviewingPayment(p)}>📸</div>
                        <div className="min-w-0">
                           <p className="font-black text-base uppercase dark:text-white truncate">{p.userName}</p>
                           <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">{p.planName} • REF: {p.referenceId}</p>
                        </div>
                     </div>
                     <div className="flex gap-3 w-full md:w-auto">
                        <button onClick={() => setReviewingPayment(p)} className="flex-1 px-10 py-4 bg-blue-600 text-white rounded-2xl text-[10px] font-black uppercase shadow-lg active:scale-95 transition-all italic">Review Evidence</button>
                     </div>
                   </div>
                 ))}
                 {(payments || []).length === 0 && <div className="py-24 text-center opacity-30 text-xl font-black uppercase tracking-[0.2em]">Finance Terminal Clear</div>}
              </div>
           </div>
        )}

        {activeTab === 'Quizzes' && (
           <div className="space-y-8 animate-in">
              <h3 className="text-xl font-black uppercase italic mb-8">Pending Logic Architectures</h3>
              <div className="grid gap-4">
                 {(pendingQuizzes || []).map(q => (
                   <div key={q.id} className="p-8 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-[32px] flex flex-col md:flex-row justify-between items-center gap-6">
                     <div className="flex-1 min-w-0">
                        <p className="text-blue-600 text-[8px] font-black uppercase tracking-widest mb-1">{q.program} • {q.subject}</p>
                        <h4 className="text-lg font-black uppercase dark:text-white truncate">{q.title}</h4>
                        <p className="text-[9px] font-bold text-slate-400 mt-2 uppercase tracking-widest">{q.questionsCount} academic items • {q.difficulty} difficulty</p>
                     </div>
                     <div className="flex gap-3 w-full md:w-auto">
                        <button onClick={() => handleModeration(q.id, 'quiz', 'approved')} className="flex-1 px-8 py-4 bg-blue-600 text-white rounded-2xl text-[9px] font-black uppercase shadow-lg active:scale-95 transition-all">Release</button>
                        <button onClick={() => handleModeration(q.id, 'quiz', 'rejected')} className="flex-1 px-8 py-4 bg-red-600 text-white rounded-2xl text-[9px] font-black uppercase active:scale-95 transition-all">Flag</button>
                     </div>
                   </div>
                 ))}
                 {(pendingQuizzes || []).length === 0 && <div className="py-24 text-center opacity-30 text-xl font-black uppercase tracking-[0.2em]">Logic Queue Clear</div>}
              </div>
           </div>
        )}

        {activeTab === 'Library' && (
           <div className="space-y-8 animate-in">
              <h3 className="text-xl font-black uppercase italic mb-8">Asset Provisioning Queue</h3>
              <div className="grid gap-4">
                 {(pendingLibrary || []).map(l => (
                   <div key={l.id} className="p-8 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-[32px] flex flex-col md:flex-row justify-between items-center gap-6">
                     <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-4 mb-2">
                           <span className="w-12 h-12 bg-red-600/10 rounded-xl flex items-center justify-center text-2xl">📄</span>
                           <div>
                              <h4 className="text-lg font-black uppercase dark:text-white truncate">{l.title}</h4>
                              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{l.type} Node • {l.subject}</p>
                           </div>
                        </div>
                     </div>
                     <div className="flex gap-3 w-full md:w-auto">
                        <button onClick={() => window.open(l.url)} className="px-6 py-4 bg-slate-900 dark:bg-slate-800 text-white rounded-2xl text-[9px] font-black uppercase shadow-sm">Inspect</button>
                        <button onClick={() => handleModeration(l.id, 'library', 'approved')} className="flex-1 px-8 py-4 bg-blue-600 text-white rounded-2xl text-[9px] font-black uppercase shadow-lg active:scale-95 transition-all">Push</button>
                        <button onClick={() => handleModeration(l.id, 'library', 'rejected')} className="flex-1 px-8 py-4 bg-red-600 text-white rounded-2xl text-[9px] font-black uppercase active:scale-95 transition-all">Flag</button>
                     </div>
                   </div>
                 ))}
                 {(pendingLibrary || []).length === 0 && <div className="py-24 text-center opacity-30 text-xl font-black uppercase tracking-[0.2em]">Asset Terminal Clear</div>}
              </div>
           </div>
        )}

        {activeTab === 'Plans' && (
           <div className="space-y-12 animate-in">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                 <div className="bg-slate-50 dark:bg-slate-950 p-10 rounded-[48px] border border-slate-100 dark:border-slate-800 space-y-6">
                    <h4 className="text-xs font-black uppercase tracking-[0.3em] text-blue-600 italic">Tier Architect</h4>
                    <input value={planForm.name} onChange={e => setPlanForm({...planForm, name: e.target.value})} className="w-full h-14 bg-white dark:bg-slate-900 border border-slate-200 px-6 rounded-2xl text-xs font-bold dark:text-white outline-none" placeholder="Plan Name (e.g. Master Node)" />
                    <input value={planForm.price} onChange={e => setPlanForm({...planForm, price: e.target.value})} className="w-full h-14 bg-white dark:bg-slate-900 border border-slate-200 px-6 rounded-2xl text-xs font-bold dark:text-white outline-none" placeholder="Price (NPR)" />
                    <select value={planForm.duration} onChange={e => setPlanForm({...planForm, duration: e.target.value})} className="w-full h-14 bg-white dark:bg-slate-900 border border-slate-200 px-6 rounded-2xl text-[9px] font-black uppercase dark:text-white outline-none">
                       <option value="1 Month">1 Month cycle</option>
                       <option value="6 Months">6 Months cycle</option>
                       <option value="1 Year">1 Year cycle</option>
                    </select>
                    <button onClick={handleUpdatePlan} disabled={isSaving} className="w-full h-16 bg-blue-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl active:scale-95 transition-all">Initialize Subscription Node</button>
                 </div>
                 <div className="space-y-6">
                    <h4 className="text-xs font-black uppercase tracking-[0.3em] text-slate-400 italic">Active Tiers</h4>
                    <div className="space-y-3">
                       {(plans || []).map(p => (
                         <div key={p.id} className="flex justify-between items-center bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm group">
                            <div>
                               <p className="text-[10px] font-black uppercase dark:text-white">{p.name}</p>
                               <p className="text-[8px] font-bold text-slate-400 mt-1">NPR {p.price} / {p.duration}</p>
                            </div>
                            <button onClick={() => deletePlanFromCloud(p.id)} className="text-red-500 p-2 hover:bg-red-50 rounded-lg transition-all"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>
                         </div>
                       ))}
                    </div>
                 </div>
              </div>
           </div>
        )}

        {activeTab === 'Users' && (
          <div className="space-y-6 animate-in">
            <h3 className="text-xl font-black uppercase dark:text-white mb-8 italic">Practitioner Directory</h3>
            <div className="overflow-x-auto -mx-8 px-8 scrollbar-hide">
               <table className="w-full text-left">
                 <thead className="text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 dark:border-slate-800">
                    <tr><th className="pb-4 px-4">Practitioner</th><th className="pb-4">Program</th><th className="pb-4">Status</th><th className="pb-4 text-right px-4">Access</th></tr>
                 </thead>
                 <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                    {(users || []).map(u => (
                      <tr key={u.id} className="group hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-all">
                        <td className="py-5 px-4">
                           <div className="flex items-center gap-4">
                              <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden flex items-center justify-center font-black text-xs">{(u.name || '?').charAt(0).toUpperCase()}</div>
                              <div>
                                 <p className="text-[11px] font-black uppercase dark:text-white">{u.name || 'Unnamed node'}</p>
                                 <p className="text-[8px] text-slate-400 font-bold">{u.email}</p>
                              </div>
                           </div>
                        </td>
                        <td className="py-5 text-[10px] font-bold uppercase text-slate-500">{u.program || 'Common Node'}</td>
                        <td className="py-5">
                           <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${u.status === 'banned' ? 'bg-red-500 text-white' : 'bg-green-500 text-white'}`}>{u.status || 'active'}</span>
                        </td>
                        <td className="py-5 text-right px-4">
                           <button onClick={() => setUserStatus(u.id, u.status === 'banned' ? 'active' : 'banned')} className="text-[9px] font-black uppercase text-red-500 hover:underline tracking-widest">Toggle Proxy</button>
                        </td>
                      </tr>
                    ))}
                 </tbody>
               </table>
            </div>
          </div>
        )}

        {activeTab === 'Curriculum' && (
           <div className="space-y-12 animate-in">
              <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 bg-slate-50 dark:bg-slate-950 p-10 rounded-[48px] border border-slate-100 dark:border-slate-800">
                 <div className="flex-1">
                    <h3 className="text-2xl font-black uppercase tracking-tighter italic dark:text-white">Academic Matrix Provisioning</h3>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Append councils and programs to the global logic registry.</p>
                 </div>
                 <div className="flex w-full md:w-auto gap-3">
                    <input value={newCouncilName} onChange={e => setNewCouncilName(e.target.value)} placeholder="NEW COUNCIL" className="flex-1 md:w-64 h-14 bg-white dark:bg-slate-900 border border-slate-200 rounded-2xl px-6 text-[10px] font-black uppercase dark:text-white outline-none focus:ring-4 ring-blue-500/5 transition-all" />
                    <button onClick={handleAddCouncil} className="h-14 px-8 bg-blue-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl active:scale-95 transition-all">Add Council</button>
                 </div>
              </header>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                 {Object.keys(curriculum || {}).map(council => (
                    <div key={council} className="p-10 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[56px] shadow-sm relative group overflow-hidden">
                       <div className="flex items-center gap-4 mb-10">
                          <div className="w-14 h-14 rounded-2xl bg-blue-600 flex items-center justify-center text-white text-2xl font-black shadow-lg shadow-blue-600/20">{council.charAt(0)}</div>
                          <h4 className="font-black text-2xl dark:text-white uppercase tracking-tight">{council} COUNCIL</h4>
                       </div>
                       
                       {['Diploma', 'Bachelor', 'Master'].map(level => {
                         const inputKey = `${council}-${level}`;
                         const items = curriculum[council]?.[level] || [];
                         return (
                           <div key={level} className="mb-10 last:mb-0 space-y-5">
                              <div className="flex justify-between items-end border-b border-slate-50 dark:border-slate-800 pb-2">
                                 <p className="text-[10px] font-black text-blue-500 uppercase tracking-[0.3em]">{level} Node</p>
                                 <span className="text-[8px] font-black text-slate-300 uppercase">Registry: {(items || []).length} Units</span>
                              </div>
                              
                              <div className="grid grid-cols-1 gap-2.5">
                                 {(items || []).map((prog, idx) => {
                                   const isEnabled = sysSettings.enabledPrograms?.[prog] !== false;
                                   return (
                                     <div key={idx} className={`flex items-center justify-between p-5 rounded-2xl border transition-all ${isEnabled ? 'bg-slate-50 dark:bg-slate-950 border-slate-100 dark:border-slate-800' : 'bg-white dark:bg-slate-900 border-transparent opacity-40 grayscale'}`}>
                                        <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-tight truncate max-w-[200px]">{prog}</span>
                                        <button onClick={() => {
                                          const next = !isEnabled;
                                          setSysSettings({ ...sysSettings, enabledPrograms: { ...sysSettings.enabledPrograms, [prog]: next } });
                                        }} className={`w-10 h-6 rounded-full p-1 transition-all duration-300 relative ${isEnabled ? 'bg-green-500 shadow-lg shadow-green-500/20' : 'bg-slate-300 dark:bg-slate-700'}`}>
                                           <div className={`w-4 h-4 bg-white rounded-full shadow-md transition-transform duration-300 ${isEnabled ? 'translate-x-4' : 'translate-x-0'}`}></div>
                                        </button>
                                     </div>
                                   );
                                 })}
                              </div>

                              <div className="flex gap-2 pt-2">
                                 <input value={newProgramInputs[inputKey] || ''} onChange={e => setNewProgramInputs({...newProgramInputs, [inputKey]: e.target.value})} placeholder={`New ${level} Program`} className="flex-1 h-12 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-xl px-5 text-[9px] font-black uppercase dark:text-white outline-none" />
                                 <button onClick={() => handleAddProgram(council, level)} className="w-12 h-12 bg-slate-900 dark:bg-slate-800 text-white rounded-xl flex items-center justify-center font-black text-xl hover:bg-blue-600 transition-all">+</button>
                              </div>
                           </div>
                         );
                       })}
                    </div>
                 ))}
              </div>

              <div className="sticky bottom-8 z-20 max-w-2xl mx-auto">
                 <button onClick={handleSaveCurriculum} disabled={isSaving} className="w-full h-20 bg-blue-600 text-white rounded-[32px] font-black uppercase text-xs tracking-[0.3em] shadow-2xl shadow-blue-600/30 active:scale-95 transition-all">
                   {isSaving ? 'SYNCHRONIZING MATRIX...' : 'SYNC ACADEMIC MATRIX TO CLOUD'}
                 </button>
              </div>
           </div>
        )}

        {activeTab === 'Ads' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 animate-in">
             <div className="space-y-6">
                <h3 className="text-xl font-black uppercase italic">Dispatch Notice</h3>
                <div className="space-y-6">
                   <input value={adForm.title} onChange={e => setAdForm({...adForm, title: e.target.value})} className="w-full h-14 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 px-6 rounded-2xl text-sm font-bold dark:text-white outline-none" placeholder="Notice Heading" />
                   
                   <QRUploader label="Banner Image (Crop required for high-impact)" url={adForm.imageUrl} field="adBanner" />
                   
                   <textarea value={adForm.content} onChange={e => setAdForm({...adForm, content: e.target.value})} className="w-full h-32 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl text-xs font-bold dark:text-white outline-none resize-none" placeholder="Academic bulletin content..." />
                   
                   <div className="space-y-2">
                     <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Action Link (Optional)</label>
                     <input value={adForm.linkUrl} onChange={e => setAdForm({...adForm, linkUrl: e.target.value})} className="w-full h-14 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 px-6 rounded-2xl text-[10px] font-bold dark:text-white outline-none" placeholder="https://example.com/more-info" />
                   </div>

                   <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Display Duration (Sec)</label>
                        <input type="number" min="1" max="60" value={adForm.displayDuration} onChange={e => setAdForm({...adForm, displayDuration: parseInt(e.target.value) || 5})} className="w-full h-14 bg-slate-50 dark:bg-slate-950 border border-slate-200 rounded-2xl px-6 text-[10px] font-black text-slate-900 dark:text-white outline-none" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Context Theme</label>
                        <select value={adForm.type} onChange={e => setAdForm({...adForm, type: e.target.value as any})} className="h-14 w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 rounded-2xl px-4 text-[9px] font-black uppercase">
                           <option value="info">Information (Blue)</option>
                           <option value="promo">Promotion (Green)</option>
                           <option value="warning">Alert (Red)</option>
                        </select>
                      </div>
                   </div>

                   <button onClick={handleCreateAd} disabled={isSaving} className="w-full h-16 bg-blue-600 text-white font-black uppercase text-[10px] tracking-[0.2em] rounded-2xl shadow-xl active:scale-95 transition-all">Broadcast Bulletin</button>
                </div>
             </div>
             <div className="space-y-6">
                <h3 className="text-xl font-black uppercase italic text-slate-400">Active Bulletin Feed</h3>
                <div className="space-y-4 max-h-[700px] overflow-y-auto scrollbar-hide pr-2">
                   {(ads || []).map(ad => (
                     <div key={ad.id} className="p-6 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-[32px] flex flex-col gap-4 group relative">
                        <div className="flex justify-between items-start">
                           <div className="flex-1">
                              <p className={`text-[10px] font-black uppercase mb-1 ${ad.type === 'warning' ? 'text-red-500' : ad.type === 'promo' ? 'text-green-500' : 'text-blue-600'}`}>{ad.title}</p>
                              <p className="text-[10px] font-medium text-slate-500 line-clamp-2 leading-relaxed">{ad.content}</p>
                           </div>
                           <button onClick={() => deleteDoc(doc(db, 'ads', ad.id))} className="text-red-500 p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18 6L6 18M6 6l12 12"/></svg>
                           </button>
                        </div>
                        
                        <div className="flex items-center gap-3">
                           <span className="px-3 py-1 bg-slate-200 dark:bg-slate-800 text-[8px] font-black rounded-full uppercase tracking-widest">{ad.displayDuration || 5}s Duration</span>
                        </div>
                        
                        {ad.imageUrl && (
                          <div className="w-full h-32 rounded-2xl overflow-hidden bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
                             <img src={sanitizeUrl(ad.imageUrl)} className="w-full h-full object-cover" alt="Banner" />
                          </div>
                        )}

                        {ad.linkUrl && (
                          <div className="flex items-center gap-2 text-[8px] font-black text-blue-500 uppercase truncate">
                             <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                             <span className="truncate">{ad.linkUrl}</span>
                          </div>
                        )}
                     </div>
                   ))}
                   {(ads || []).length === 0 && <div className="py-20 text-center opacity-30 text-xs font-black uppercase">Feed Empty</div>}
                </div>
             </div>
          </div>
        )}

        {activeTab === 'System' && (
           <div className="space-y-12 animate-in">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                 <div className="space-y-10">
                    <h4 className="text-xs font-black text-blue-600 uppercase tracking-widest border-b border-blue-50 dark:border-blue-900/20 pb-2 italic">Platform Identity</h4>
                    <QRUploader label="Primary Brand Logo" url={sysSettings.logoUrl} field="logoUrl" />
                    <SystemField label="Platform Label" value={sysSettings.platformName} field="platformName" />
                    <div className="flex items-center justify-between p-6 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl">
                      <div>
                        <h4 className="text-[10px] font-black text-slate-900 dark:text-white uppercase tracking-tight">Show Academic Disclaimers</h4>
                        <p className="text-[8px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mt-1">Toggle visibility for Google Play review</p>
                      </div>
                      <button 
                        onClick={() => setSysSettings({...sysSettings, showDisclaimers: !sysSettings.showDisclaimers})}
                        className={`w-12 h-7 rounded-full p-1 transition-all duration-300 relative ${sysSettings.showDisclaimers ? 'bg-blue-600 shadow-lg shadow-blue-500/20' : 'bg-slate-300 dark:bg-slate-700'}`}
                      >
                        <div className={`w-5 h-5 bg-white rounded-full shadow-md transition-transform duration-300 ${sysSettings.showDisclaimers ? 'translate-x-5' : 'translate-x-0'}`}></div>
                      </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                       <SystemField label="Privacy Matrix Link" value={sysSettings.privacyPolicyUrl || ''} field="privacyPolicyUrl" placeholder="https://yoursite.com/privacy" />
                       <SystemField label="Terms Proxy Link" value={sysSettings.termsOfServiceUrl || ''} field="termsOfServiceUrl" placeholder="https://yoursite.com/terms" />
                    </div>
                 </div>
                 <div className="space-y-10">
                    <h4 className="text-xs font-black text-green-600 uppercase tracking-widest border-b border-green-50 dark:border-green-900/20 pb-2 italic">Gateway Proxies</h4>
                    <div className="grid grid-cols-2 gap-6">
                       <div className="space-y-6">
                          <SystemField label="eSewa ID" value={sysSettings.esewaNumber} field="esewaNumber" />
                          <QRUploader label="eSewa Scan Asset" url={sysSettings.esewaQrUrl} field="esewaQrUrl" />
                       </div>
                       <div className="space-y-6">
                          <SystemField label="Khalti ID" value={sysSettings.khaltiNumber} field="khaltiNumber" />
                          <QRUploader label="Khalti Scan Asset" url={sysSettings.khaltiQrUrl} field="khaltiQrUrl" />
                       </div>
                    </div>
                    <div className="space-y-6 pt-4">
                       <SystemField label="Bank Node Label" value={sysSettings.bankName} field="bankName" />
                       <SystemField label="Bank ID Node" value={sysSettings.bankAccountNumber} field="bankAccountNumber" />
                       <QRUploader label="Bank QR Asset" url={sysSettings.bankQrUrl} field="bankQrUrl" />
                    </div>
                 </div>
              </div>
              <button onClick={handleSaveSettings} disabled={isSaving} className="w-full h-16 md:h-20 bg-blue-600 text-white rounded-[24px] md:rounded-[36px] font-black uppercase text-[10px] md:text-xs tracking-widest shadow-2xl active:scale-95 transition-all">
                {isSaving ? 'UPDATING NODE CONFIG...' : 'SYNC GLOBAL SYSTEM PARAMETERS'}
              </button>
           </div>
        )}

        {activeTab === 'Integrations' && (
           <div className="space-y-12 animate-in">
              <div className="bg-slate-950 border border-white/5 p-10 md:p-16 rounded-[48px] relative overflow-hidden text-center">
                 <div className="absolute top-0 right-0 w-80 h-80 bg-blue-600/5 blur-[120px] rounded-full"></div>
                 <h3 className="text-2xl font-black uppercase text-white mb-10 italic">Cloud Infrastructure Node</h3>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mb-10">
                    <div className="space-y-6 text-left">
                       <h4 className="text-[10px] font-black text-blue-500 uppercase tracking-[0.3em] mb-4">Bunny.net CDN Matrix</h4>
                       <SystemField label="Integration Access Key" value={sysSettings.bunnyPassword} field="bunnyPassword" type="password" />
                       <SystemField label="Zone Identification" value={sysSettings.bunnyZoneName} field="bunnyZoneName" />
                       <SystemField label="Region Node" value={sysSettings.bunnyRegion} field="bunnyRegion" type="select" options={['Singapore', 'Default']} />
                       <SystemField label="Edge Pull Domain" value={sysSettings.bunnyPullZoneUrl} field="bunnyPullZoneUrl" />
                    </div>
                    <div className="flex flex-col items-center justify-center border-l border-white/5 pl-8">
                       <div className={`w-28 h-28 rounded-full flex items-center justify-center text-5xl mb-8 shadow-2xl transition-all ${verifyStatus?.success ? 'bg-green-500/20 text-green-500 border border-green-500/30' : 'bg-red-500/20 text-red-500 border border-red-500/30'}`}>
                          {verifyStatus?.success ? '✔️' : isVerifying ? '⌛' : '⚠️'}
                       </div>
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-10 leading-relaxed">{verifyStatus?.message || 'Handshake Pending'}</p>
                       <button onClick={executeDiagnostics} disabled={isVerifying} className="w-full py-5 bg-white text-slate-950 rounded-2xl font-black uppercase text-[10px] tracking-widest active:scale-95 transition-all">
                          {isVerifying ? 'INITIALIZING HANDSHAKE...' : 'EXECUTE INTEGRATION TEST'}
                       </button>
                    </div>
                 </div>
              </div>
              <button onClick={handleSaveSettings} disabled={isSaving} className="w-full h-16 bg-blue-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl active:scale-95 transition-all">COMMIT INFRASTRUCTURE CONFIG</button>
           </div>
        )}

      </div>
    </div>
  );
};

export default AdminPortal;
