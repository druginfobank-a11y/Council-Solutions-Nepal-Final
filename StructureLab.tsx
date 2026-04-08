import React, { useState, useEffect, useRef } from 'react';
// Fix: Use namespace import for react-router-dom to resolve named export errors
import * as ReactRouter from 'react-router-dom';
import { User, Plan, SystemSettings } from '../types';
import { subscribeToPlans } from '../services/planService';
import { doc, getDoc, collection, addDoc } from 'firebase/firestore';
import { db, auth } from '../services/firebase';
import { sanitizeUrl, uploadToBunny } from '../services/storageService';

const { useNavigate } = ReactRouter as any;

interface PlansProps {
  user: User;
}

const Plans: React.FC<PlansProps> = ({ user }) => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [availablePlans, setAvailablePlans] = useState<Plan[]>([]);
  const [activeTab, setActiveTab] = useState<'plans' | 'pay' | 'history'>('plans');
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<'esewa' | 'khalti'>('esewa');
  const [refCode, setRefCode] = useState('');
  
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadPercent, setUploadPercent] = useState(0);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(true);

  const [sysSettings, setSysSettings] = useState<Partial<SystemSettings>>({
    esewaQrUrl: '',
    khaltiQrUrl: '',
    esewaNumber: '',
    khaltiNumber: ''
  });

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const snap = await getDoc(doc(db, 'system', 'config'));
        if (snap.exists()) setSysSettings(snap.data());
      } catch (e) {
        console.warn("System configuration unreachable via current academic node.");
      }
    };
    fetchSettings();

    const unsubscribe = subscribeToPlans(setAvailablePlans, (err) => {
      console.warn("Permission restricted for Plan Node.", err.message);
      setSyncError("Infrastructure connectivity deferred. Please check your credentials.");
    });
    return () => unsubscribe();
  }, []);

  const handleSelectPlan = (plan: Plan) => {
    setSelectedPlan(plan);
    setSyncError(null);
    setActiveTab('pay');
  };

  const handleScreenshotChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setSyncError(null);
      const reader = new FileReader();
      reader.onloadend = () => setScreenshotPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleSubmitPayment = async () => {
    setSyncError(null);
    
    // Safety check for fresh authentication context
    const currentUser = auth.currentUser;
    if (!currentUser) {
      setSyncError("Session Termination Error: Please re-initialize your terminal session (Log out and back in).");
      return;
    }

    if (!selectedPlan) { setSyncError("Subscription Fault: Subscription tier not selected."); return; }
    if (!refCode.trim()) { setSyncError("Evidence Missing: Transaction reference code required."); return; }
    if (!selectedFile) { setSyncError("Evidence Missing: Payment screenshot required."); return; }
    
    setIsSubmitting(true);
    setUploadPercent(0);
    
    try {
      // 1. Synchronize screenshot with Bunny CDN
      const cloudUrl = await uploadToBunny(selectedFile, 'payments', (percent) => setUploadPercent(percent));
      
      // 2. Transmit payment record to Root Academic Node
      // The userId must match the authenticated currentUser.uid exactly for rule validation
      await addDoc(collection(db, 'payments'), {
        userId: currentUser.uid, 
        userName: user.name,
        planId: selectedPlan.id,
        planName: selectedPlan.name,
        referenceId: refCode.trim(),
        screenshot: cloudUrl,
        status: 'pending',
        timestamp: new Date().toISOString()
      });
      
      alert("Evidence Transmission Successful: Academic Hub will verify within 1-2 cycles.");
      setActiveTab('history');
      setRefCode('');
      setSelectedFile(null);
      setScreenshotPreview(null);
    } catch (e: any) { 
      console.error("Transmission Node Error:", e);
      setSyncError(`Node Synchronization Failure: ${e.message || "Unknown Security Violation"}`);
    } finally { 
      setIsSubmitting(false); 
      setUploadPercent(0);
    }
  };

  const filteredPlans = availablePlans.filter(p => p.targetProgram === 'All Programs' || p.targetProgram === user.program);
  const currentQr = selectedMethod === 'esewa' ? sysSettings.esewaQrUrl : sysSettings.khaltiQrUrl;
  const sanitizedQr = sanitizeUrl(currentQr || '');

  return (
    <div className="space-y-8 animate-in pb-24 max-w-6xl mx-auto px-4 md:px-0">
      <header>
        <p className="text-blue-600 text-[10px] font-black uppercase tracking-[0.4em] mb-1">Infrastructure Access</p>
        <h1 className="text-3xl md:text-5xl font-black uppercase tracking-tight dark:text-white leading-none text-slate-900">Tier Selection</h1>
      </header>

      <div className="flex bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-1.5 rounded-[24px] shadow-sm max-w-md">
        {(['plans', 'pay', 'history'] as const).map(tab => (
          <button 
            key={tab} 
            onClick={() => { setActiveTab(tab); setSyncError(null); }}
            className={`flex-1 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === tab ? 'bg-blue-600 text-white shadow-xl shadow-blue-500/20' : 'text-slate-500 dark:text-slate-400'}`}
          >
            {tab === 'plans' ? 'Plans' : tab === 'pay' ? 'Scan Proof' : 'History'}
          </button>
        ))}
      </div>

      {activeTab === 'plans' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {filteredPlans.length === 0 ? (
            <div className="col-span-full py-20 text-center opacity-30 text-2xl font-black uppercase">No Tiers Configured</div>
          ) : filteredPlans.map(plan => (
            <div key={plan.id} className={`bg-white dark:bg-slate-900 border rounded-[48px] flex flex-col relative overflow-hidden transition-all hover:shadow-2xl ${plan.isPopular ? 'border-blue-500 shadow-blue-500/10' : 'border-slate-100 dark:border-slate-800 shadow-sm'}`}>
              {plan.imageUrl && (
                <div className="w-full h-40 overflow-hidden border-b border-slate-50 dark:border-slate-800">
                  <img src={sanitizeUrl(plan.imageUrl)} className="w-full h-full object-cover" alt={plan.name} />
                </div>
              )}
              <div className="p-10 flex flex-col flex-1">
                <h3 className="text-xl font-black uppercase mb-2 dark:text-white">{plan.name}</h3>
                <div className="mb-8"><span className="text-4xl font-black text-slate-900 dark:text-white">NPR {plan.price}</span><span className="text-slate-500 text-xs uppercase ml-2">/ {plan.duration}</span></div>
                <ul className="space-y-4 mb-10 flex-1">
                  {plan.features.map((f, i) => <li key={i} className="flex gap-3 text-slate-600 dark:text-slate-400 text-xs font-bold uppercase tracking-wide"><span className="text-blue-500">✓</span> {f}</li>)}
                </ul>
                <button onClick={() => handleSelectPlan(plan)} className={`w-full py-4 rounded-2xl font-black text-[10px] uppercase transition-all ${plan.isPopular ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-300 hover:bg-blue-600 hover:text-white'}`}>Select Tier</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'pay' && (
        !selectedPlan ? (
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-12 rounded-[56px] text-center animate-in flex flex-col items-center">
             <div className="w-20 h-20 bg-blue-50 dark:bg-blue-900/20 rounded-3xl flex items-center justify-center text-3xl mb-6">🎫</div>
             <h3 className="text-2xl font-black uppercase tracking-tight dark:text-white">No Tier Selected</h3>
             <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-2 max-w-sm mb-8 leading-relaxed">Please select a subscription plan from the "Plans" tab before scanning payment proof.</p>
             <button onClick={() => setActiveTab('plans')} className="px-10 py-4 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl active:scale-95 transition-all">Go to Plans</button>
          </div>
        ) : (
          <div className="space-y-8 animate-in">
            {syncError && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 p-6 rounded-[32px] animate-in flex items-center gap-4">
                 <div className="w-10 h-10 bg-red-600/10 rounded-full flex items-center justify-center shrink-0">⚠️</div>
                 <p className="text-red-600 dark:text-red-400 text-xs font-black uppercase tracking-tight">{syncError}</p>
              </div>
            )}
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-10 rounded-[48px] shadow-sm space-y-8">
                <div className="flex justify-between items-start">
                  <h2 className="text-xl font-black uppercase tracking-tight dark:text-white">1. Secure Destination</h2>
                  <div className="text-right">
                      <p className="text-[8px] font-black text-slate-400 uppercase">Tier Selected</p>
                      <p className="text-sm font-black text-blue-600 uppercase">{selectedPlan.name}</p>
                  </div>
                </div>
                <div className="flex gap-2 bg-slate-50 dark:bg-slate-950 p-1.5 rounded-[20px]">
                  <button onClick={() => { setSelectedMethod('esewa'); setQrLoading(true); }} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${selectedMethod === 'esewa' ? 'bg-white dark:bg-slate-800 text-blue-600 shadow-sm' : 'text-slate-400'}`}>eSewa</button>
                  <button onClick={() => { setSelectedMethod('khalti'); setQrLoading(true); }} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${selectedMethod === 'khalti' ? 'bg-white dark:bg-slate-800 text-blue-600 shadow-sm' : 'text-slate-400'}`}>Khalti</button>
                </div>
                <div className="text-center p-8 bg-slate-50 dark:bg-slate-950 rounded-[32px] border border-slate-100 dark:border-white/5 space-y-6">
                  <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">GATEWAY: {selectedMethod === 'esewa' ? sysSettings.esewaNumber : sysSettings.khaltiNumber || 'ID PENDING'}</p>
                  <div className="w-56 h-56 mx-auto bg-white rounded-[32px] p-4 shadow-2xl relative flex items-center justify-center overflow-hidden border border-slate-100">
                    {qrLoading && <div className="absolute inset-0 bg-slate-50 flex items-center justify-center"><div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div></div>}
                    {sanitizedQr ? (
                      <img 
                        src={sanitizedQr} 
                        onLoad={() => setQrLoading(false)}
                        onError={() => setQrLoading(false)}
                        className={`w-full h-full object-contain transition-opacity duration-500 ${qrLoading ? 'opacity-0' : 'opacity-100'}`} 
                        alt="Payment QR" 
                      />
                    ) : (
                      <div className="text-[8px] font-black text-slate-400 uppercase text-center px-4">Node Error:<br/>QR Missing</div>
                    )}
                  </div>
                  <p className="text-lg font-black text-slate-900 dark:text-white tracking-tight mt-4">NPR {selectedPlan.price}</p>
                  <p className="text-[8px] font-bold text-slate-400 uppercase italic">Scan with official mobile app</p>
                </div>
              </div>
              
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-10 rounded-[48px] shadow-sm">
                <h2 className="text-xl font-black uppercase tracking-tight dark:text-white mb-8">2. Academic Evidence</h2>
                <div className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Reference Code</label>
                      <input value={refCode} onChange={e => setRefCode(e.target.value)} className="w-full h-16 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 px-6 rounded-2xl text-sm font-bold dark:text-white outline-none focus:ring-4 ring-blue-500/5 transition-all" placeholder="Transaction ID" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Screenshot Evidence</label>
                      <label className="w-full aspect-video bg-slate-50 dark:bg-slate-950 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-3xl flex flex-col items-center justify-center cursor-pointer overflow-hidden transition-all hover:border-blue-500 group relative">
                          <input type="file" accept="image/*" className="hidden" onChange={handleScreenshotChange} />
                          {screenshotPreview ? (
                            <img src={screenshotPreview} className="w-full h-full object-cover" alt="Proof Preview" />
                          ) : (
                            <div className="text-center space-y-2">
                                <span className="text-2xl group-hover:scale-125 transition-transform block">📸</span>
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Attach Receipt</span>
                            </div>
                          )}
                      </label>
                    </div>
                    
                    {isSubmitting && (
                      <div className="space-y-2">
                        <div className="flex justify-between items-center"><span className="text-[8px] font-black uppercase text-blue-500">Transmitting Node Data</span><span className="text-[8px] font-black text-blue-500">{uploadPercent}%</span></div>
                        <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div className="h-full bg-blue-600 transition-all duration-300" style={{ width: `${uploadPercent}%` }}></div>
                        </div>
                      </div>
                    )}

                    <button onClick={handleSubmitPayment} disabled={isSubmitting} className="w-full bg-blue-600 text-white font-black h-16 md:h-20 rounded-[28px] uppercase text-[10px] tracking-widest shadow-xl active:scale-95 transition-all disabled:opacity-50">
                      {isSubmitting ? 'TRANSMITTING...' : 'SYNCHRONIZE PAYMENT'}
                    </button>
                    <p className="text-[8px] text-center font-bold text-slate-400 uppercase tracking-widest">Data is transmitted via secure academic node</p>
                </div>
              </div>
            </div>
          </div>
        )
      )}

      {activeTab === 'history' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-12 rounded-[56px] text-center animate-in">
           <div className="w-20 h-20 bg-blue-50 dark:bg-blue-900/20 rounded-3xl flex items-center justify-center text-3xl mx-auto mb-6">⏳</div>
           <h3 className="text-2xl font-black uppercase tracking-tight dark:text-white">Queue Synchronizing</h3>
           <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-2 max-w-sm mx-auto leading-relaxed">Your payment evidence is being processed by the root moderation node. Refreshing cycle is 1-2 hours.</p>
        </div>
      )}
    </div>
  );
};

export default Plans;