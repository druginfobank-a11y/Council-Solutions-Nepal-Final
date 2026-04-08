import React, { useState, useRef } from 'react';
// Fix: Use namespace import for react-router-dom to resolve named export errors
import * as ReactRouter from 'react-router-dom';
import { User, UserRole } from '../types';
import { updateUserProfile } from '../services/userService';
import { auth } from '../services/firebase';
import { sendPasswordResetEmail } from 'firebase/auth';
import { uploadToBunny } from '../services/storageService';

const { useNavigate } = ReactRouter as any;

interface ProfileProps {
  user: User;
}

const TRANSLATIONS: Record<string, Record<string, string>> = {
  ENG: {
    identity: 'IDENTITY',
    academic: 'ACADEMIC',
    performance: 'PERFORMANCE',
    professional: 'PROFESSIONAL',
    analytics: 'ANALYTICS',
    system: 'SYSTEM',
    security: 'SECURITY',
    save: 'Save Profile Changes',
    syncing: 'Syncing...',
    verified: 'Verified',
    practitioner: 'Practitioner',
    legalName: 'LEGAL NAME',
    phone: 'PRIMARY PHONE',
    bio: 'PROFESSIONAL BIOGRAPHY',
    institution: 'ASSOCIATED INSTITUTION',
    batch: 'ACADEMIC BATCH',
    program: 'ACADEMIC PROGRAM',
    specialization: 'SPECIALIZATION',
    councilId: 'COUNCIL REG NUMBER',
    resetPass: 'Send Password Reset Email',
    nodeSettings: 'NODE SETTINGS'
  },
  NEP: {
    identity: 'पहिचान',
    academic: 'शैक्षिक',
    performance: 'प्रदर्शन',
    professional: 'व्यावसायिक',
    analytics: 'विश्लेषण',
    system: 'प्रणाली',
    security: 'सुरक्षा',
    save: 'प्रोफाइल सुरक्षित गर्नुहोस्',
    syncing: 'सिंक हुँदैछ...',
    verified: 'प्रमाणित',
    practitioner: 'चिकित्सक',
    legalName: 'कानूनी नाम',
    phone: 'प्राथमिक फोन',
    bio: 'व्यावसायिक जीवनी',
    institution: 'सम्बद्ध संस्था',
    batch: 'शैक्षिक ब्याच',
    program: 'शैक्षिक कार्यक्रम',
    specialization: 'विशेषज्ञता',
    councilId: 'काउन्सिल दर्ता नम्बर',
    resetPass: 'पासवर्ड रिसेट इमेल पठाउनुहोस्',
    nodeSettings: 'नोड सेटिङहरू'
  }
};

const Profile: React.FC<ProfileProps> = ({ user }) => {
  const navigate = useNavigate();
  const [lang, setLang] = useState<'ENG' | 'NEP'>('ENG');
  const [activeTab, setActiveTab] = useState('IDENTITY');
  const [isSaving, setIsSaving] = useState(false);
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'));
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const t = TRANSLATIONS[lang];

  const [formData, setFormData] = useState({
    name: user.name || '',
    email: user.email || '',
    profileUrl: user.profileUrl || '',
    phone: (user as any).phone || '',
    college: user.college || '',
    bio: (user as any).bio || '',
    batch: user.batch || '',
    councilId: user.npcNumber || user.id.substring(0, 8).toUpperCase(),
    specialization: user.specialization || '',
    program: user.program || '',
    level: user.level || '',
    council: user.council || ''
  });

  const getRoleConfig = () => {
    switch (user.role) {
      case UserRole.INSTRUCTOR:
        return {
          label: t.practitioner,
          color: 'purple',
          icon: '🩺',
          subtitle: formData.specialization || 'Academic Educator',
          sidebar: [
            { id: 'IDENTITY', label: t.identity, icon: '👤' },
            { id: 'PROFESSIONAL', label: t.professional, icon: '📜' },
            { id: 'ANALYTICS', label: t.analytics, icon: '📊' },
            { id: 'SECURITY', label: t.security, icon: '🔐' },
          ],
          stats: [
            { label: 'INSTITUTION', value: formData.college || 'Not Linked', icon: '🏢' },
            { label: 'COUNCIL REG', value: formData.councilId, icon: '📜' },
            { label: 'QUIZZES', value: '12', special: true },
            { label: 'RATING', value: '4.9/5', special: true }
          ]
        };
      case UserRole.ADMIN:
        return {
          label: 'ADMINISTRATOR',
          color: 'red',
          icon: '🛡️',
          subtitle: 'System Controller',
          sidebar: [
            { id: 'IDENTITY', label: t.identity, icon: '👤' },
            { id: 'SYSTEM', label: t.system, icon: '⚙️' },
            { id: 'SECURITY', label: t.security, icon: '🔐' },
          ],
          stats: [
            { label: 'ACCESS LEVEL', value: 'Root Admin', icon: '🔑' },
            { label: 'NODE ID', value: user.id.substring(0, 8).toUpperCase(), icon: '🆔' },
            { label: 'USERS', value: '4.2k', special: true },
            { label: 'HEALTH', value: '99.9%', special: true }
          ]
        };
      default:
        return {
          label: 'STUDENT',
          color: 'blue',
          icon: '🎓',
          subtitle: formData.program || 'Health Scholar',
          sidebar: [
            { id: 'IDENTITY', label: t.identity, icon: '👤' },
            { id: 'ACADEMIC', label: t.academic, icon: '📖' },
            { id: 'PERFORMANCE', label: t.performance, icon: '📈' },
            { id: 'SECURITY', label: t.security, icon: '🔐' },
          ],
          stats: [
            { label: 'INSTITUTION', value: formData.college || 'Not Linked', icon: '🏢' },
            { label: 'COUNCIL', value: formData.council || 'N/A', icon: '⚖️' },
            { label: 'GLOBAL RANK', value: '#142', special: true },
            { label: 'MASTERY', value: '74%', special: true }
          ]
        };
    }
  };

  const roleConfig = getRoleConfig();

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert("Image too large. Max 5MB allowed for profile nodes.");
        return;
      }
      setPendingFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData({ ...formData, profileUrl: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    if (!user.id) {
      alert("Profile Sync Fault: Target Node ID is missing. Please refresh terminal.");
      return;
    }
    
    setIsSaving(true);
    try {
      let finalProfileUrl = formData.profileUrl;

      if (pendingFile) {
        finalProfileUrl = await uploadToBunny(pendingFile, 'profiles');
        setPendingFile(null);
      }

      // Variable Sync Node: Destructure to remove non-schema councilId field
      const { councilId, ...profileData } = formData;
      const syncData: Partial<User> = {
        ...profileData,
        profileUrl: finalProfileUrl,
        npcNumber: councilId // Map academic ID back to schema field
      };
      
      await updateUserProfile(user.id, syncData);
      setFormData(prev => ({ ...prev, profileUrl: finalProfileUrl }));
      alert("Profile synchronized successfully.");
    } catch (error: any) {
      console.error("Profile Sync Error:", error);
      alert(`Update failed: ${error.message || "Unknown Node Fault"}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handlePasswordReset = async () => {
    if (user.email) {
      try {
        await sendPasswordResetEmail(auth, user.email);
        alert(`Reset key sent to ${user.email}`);
      } catch (e) {
        alert("Reset failed.");
      }
    }
  };

  const toggleTheme = () => {
    const next = !isDark;
    setIsDark(next);
    if (next) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('csn_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('csn_theme', 'light');
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 md:space-y-10 pb-24 md:pb-32 transition-colors duration-500 animate-in">
      <div className="bg-white dark:bg-slate-900 rounded-[32px] md:rounded-[56px] shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden relative transition-colors">
        <div className={`h-32 md:h-48 bg-gradient-to-r ${
          user.role === UserRole.INSTRUCTOR ? 'from-purple-600 to-indigo-600' : 
          user.role === UserRole.ADMIN ? 'from-red-600 to-slate-900' : 
          'from-blue-600 to-cyan-600'
        } relative overflow-hidden transition-all duration-700`}>
           <div className="absolute inset-0 opacity-10 flex items-center justify-center pointer-events-none transform -rotate-12 scale-125 md:scale-150">
              <svg width="400" height="400" viewBox="0 0 100 100" fill="white">
                <path d="M50 0L61 39L100 50L61 61L50 100L39 61L0 50L39 39L50 0Z" />
              </svg>
           </div>
        </div>
        
        <div className="px-6 md:px-20 pb-8 md:pb-14 flex flex-col md:flex-row items-center md:items-end gap-6 md:gap-12 -mt-16 md:-mt-24 relative z-10">
          <div 
            onClick={() => fileInputRef.current?.click()}
            className="w-32 h-32 md:w-48 md:h-48 rounded-full border-[6px] border-white dark:border-slate-900 shadow-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center overflow-hidden shrink-0 transition-transform duration-500 hover:scale-105 cursor-pointer group"
          >
            {formData.profileUrl ? (
              <img src={formData.profileUrl} className="w-full h-full object-cover" alt="Profile" />
            ) : (
              <span className={`text-3xl md:text-6xl font-black text-${roleConfig.color}-600`}>{roleConfig.icon}</span>
            )}
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[10px] font-black uppercase tracking-widest">Update Node</div>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
          </div>
          
          <div className="flex-1 flex flex-col items-center md:items-start text-center md:text-left gap-2 md:gap-3">
             <div className="flex flex-col md:flex-row items-center gap-3 md:gap-6">
                <h1 className="text-2xl md:text-5xl font-black text-slate-900 dark:text-white leading-tight tracking-tighter uppercase">{formData.name || 'Anonymous'}</h1>
                <div className="flex items-center gap-2">
                   <span className={`bg-${roleConfig.color}-600 text-white text-[10px] md:text-xs font-black px-3 md:px-5 py-1.5 rounded-lg md:rounded-xl uppercase tracking-widest shadow-xl`}>{roleConfig.label}</span>
                   {user.isVerified && (
                     <span className="flex items-center gap-1.5 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 text-[9px] md:text-[11px] font-black px-3 md:px-5 py-1.5 rounded-lg md:rounded-xl border border-green-100 dark:border-green-800/30 uppercase tracking-widest">
                        {t.verified}
                     </span>
                   )}
                </div>
             </div>
             <p className="text-slate-500 dark:text-slate-400 font-black text-[10px] md:text-sm uppercase tracking-[0.2em] md:tracking-[0.3em]">{roleConfig.subtitle}</p>
             
             <div className="flex items-center gap-3 md:gap-4 mt-4 md:mt-6">
                <button onClick={toggleTheme} className="w-10 h-10 md:w-14 md:h-14 flex items-center justify-center rounded-xl md:rounded-2xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 shadow-sm text-lg md:text-2xl active:scale-90 transition-all text-slate-900 dark:text-white">
                  {isDark ? '☀️' : '🌙'}
                </button>
                <button 
                  onClick={() => setLang(lang === 'ENG' ? 'NEP' : 'ENG')}
                  className="px-6 md:px-10 py-2.5 md:py-4 rounded-xl md:rounded-2xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-black text-[10px] md:text-sm uppercase border border-slate-100 dark:border-slate-700 shadow-sm tracking-[0.2em]"
                >
                  {lang}
                </button>
             </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 border-t border-slate-100 dark:border-slate-800 divide-x divide-y md:divide-y-0 divide-slate-100 dark:border-slate-800">
           {roleConfig.stats.map((stat, i) => (
             <div key={i} className={`p-6 md:p-12 flex flex-col justify-center items-center md:items-start gap-1.5 ${stat.special ? `bg-${roleConfig.color}-50/20 dark:bg-${roleConfig.color}-900/5` : 'bg-transparent'}`}>
               <p className="text-[8px] md:text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] flex items-center gap-1.5">
                 {!stat.special && <span className={`text-${roleConfig.color}-500 text-xs md:text-sm`}>{stat.icon}</span>} {stat.label}
               </p>
               <p className={`text-xl md:text-3xl font-black ${stat.special ? `text-${roleConfig.color}-600 dark:text-${roleConfig.color}-400` : 'text-slate-900 dark:text-white uppercase tracking-tight'}`}>{stat.value || 'N/A'}</p>
             </div>
           ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 md:gap-14 pt-4 md:pt-10">
        <div className="lg:col-span-3 space-y-6">
           <p className="text-[10px] md:text-[12px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.3em] ml-4 md:ml-6">{t.nodeSettings}</p>
           <nav className="space-y-3">
              {roleConfig.sidebar.map(item => (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center gap-5 px-8 md:px-10 py-5 md:py-7 rounded-[24px] md:rounded-[32px] font-black text-[11px] md:text-[13px] uppercase tracking-[0.15em] transition-all duration-300 border ${
                    activeTab === item.id 
                    ? `bg-${roleConfig.color}-600 text-white border-${roleConfig.color}-600 shadow-2xl shadow-${roleConfig.color}-600/30 scale-[1.02] translate-x-1` 
                    : 'bg-white dark:bg-slate-900 text-slate-400 dark:text-slate-500 border-slate-100 dark:border-slate-800 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <span className="text-xl md:text-2xl">{item.icon}</span>
                  {item.label}
                </button>
              ))}
           </nav>
        </div>

        <div className="lg:col-span-9 bg-white dark:bg-slate-900 rounded-[48px] md:rounded-[64px] shadow-sm border border-slate-100 dark:border-slate-800 p-8 md:p-20 relative overflow-hidden transition-all duration-300 min-h-[500px]">
           {activeTab === 'IDENTITY' && (
             <div className="space-y-12 md:space-y-16 animate-in">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-14">
                  <div className="relative">
                    <div className="absolute -top-3 left-6 px-3 bg-white dark:bg-slate-900 z-10"><span className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{t.legalName}</span></div>
                    <input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full h-16 md:h-24 bg-slate-50 dark:bg-slate-950/50 border border-slate-100 dark:border-slate-800 rounded-[20px] md:rounded-[32px] px-8 md:px-12 text-sm md:text-lg font-black text-slate-900 dark:text-white outline-none focus:ring-4 ring-blue-500/5 transition-all shadow-inner" />
                  </div>
                  <div className="relative">
                    <div className="absolute -top-3 left-6 px-3 bg-white dark:bg-slate-900 z-10"><span className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{t.phone}</span></div>
                    <input type="text" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="w-full h-16 md:h-24 bg-slate-50 dark:bg-slate-950/50 border border-slate-100 dark:border-slate-800 rounded-[20px] md:rounded-[32px] px-8 md:px-12 text-sm md:text-lg font-black text-slate-900 dark:text-white outline-none focus:ring-4 ring-blue-500/5 transition-all shadow-inner" />
                  </div>
                  <div className="col-span-full relative">
                    <div className="absolute -top-3 left-6 px-3 bg-white dark:bg-slate-900 z-10"><span className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{t.institution}</span></div>
                    <input type="text" value={formData.college} onChange={e => setFormData({...formData, college: e.target.value})} className="w-full h-16 md:h-24 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-[20px] md:rounded-[32px] px-8 md:px-12 text-sm md:text-lg font-black text-slate-900 dark:text-white uppercase outline-none focus:ring-4 ring-blue-500/5 transition-all shadow-inner" />
                  </div>
               </div>
               <div className="relative">
                  <div className="absolute -top-3 left-8 px-4 bg-white dark:bg-slate-900 z-10"><span className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">{t.bio}</span></div>
                  <div className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-[32px] md:rounded-[48px] p-8 md:p-14 shadow-inner">
                     <textarea value={formData.bio} onChange={e => setFormData({...formData, bio: e.target.value})} placeholder="..." className="w-full bg-transparent border-none focus:ring-0 text-xs md:text-base font-bold text-slate-500 dark:text-slate-400 resize-none h-24 md:h-36" />
                  </div>
               </div>
               <button onClick={handleSave} disabled={isSaving} className={`w-full py-5 md:py-8 bg-${roleConfig.color}-600 text-white rounded-[24px] md:rounded-[36px] font-black text-[11px] md:text-sm uppercase tracking-[0.3em] shadow-2xl active:scale-95 disabled:opacity-50 transition-all`}>
                  {isSaving ? (
                    <div className="flex items-center justify-center gap-3">
                       <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                       <span>{t.syncing}</span>
                    </div>
                  ) : t.save}
               </button>
             </div>
           )}

           {activeTab === 'SYSTEM' && user.role === UserRole.ADMIN && (
             <div className="space-y-12 animate-in h-full flex flex-col">
                <div className="flex-1 space-y-8">
                   <div className="p-8 bg-red-50 dark:bg-red-950/20 rounded-[40px] border border-red-100 dark:border-red-900/40">
                      <div className="flex items-center justify-between mb-4">
                         <h3 className="text-xl font-black uppercase text-red-600 tracking-tight italic">System Control Hub</h3>
                         <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                      </div>
                      <p className="text-xs text-red-500/70 font-bold uppercase tracking-widest leading-relaxed">Administrator Clearance Verified. Access root configuration nodes from the specialized console.</p>
                   </div>
                   
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <button onClick={() => navigate('/admin')} className="p-8 bg-slate-900 border border-slate-800 rounded-[32px] text-left group hover:border-blue-500/50 transition-all shadow-xl">
                         <div className="text-3xl mb-4 group-hover:scale-110 transition-transform">⚙️</div>
                         <h4 className="text-white font-black uppercase text-sm tracking-tight mb-2">Global Settings</h4>
                         <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Manage QR codes, branding & zones.</p>
                      </button>
                      <button onClick={() => navigate('/admin')} className="p-8 bg-slate-900 border border-slate-800 rounded-[32px] text-left group hover:border-blue-500/50 transition-all shadow-xl">
                         <div className="text-3xl mb-4 group-hover:scale-110 transition-transform">📖</div>
                         <h4 className="text-white font-black uppercase text-sm tracking-tight mb-2">Curriculum Node</h4>
                         <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Deploy new academic program nodes.</p>
                      </button>
                   </div>
                </div>
                
                <button 
                  onClick={() => navigate('/admin')}
                  className="w-full py-6 md:py-8 bg-red-600 text-white rounded-[24px] md:rounded-[36px] font-black text-[11px] md:text-sm uppercase tracking-[0.3em] shadow-2xl active:scale-95 transition-all"
                >
                   Launch Global Console Node
                </button>
             </div>
           )}

           {activeTab === 'SECURITY' && (
             <div className="space-y-12 animate-in">
                <div className="bg-slate-50 dark:bg-slate-950 p-8 rounded-[32px] border border-slate-100 dark:border-slate-800 space-y-4">
                   <h3 className="text-xl font-black uppercase tracking-tight dark:text-white">Credentials</h3>
                   <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Update your academic access key</p>
                   <button onClick={handlePasswordReset} className="w-full py-5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl">{t.resetPass}</button>
                </div>
             </div>
           )}

           {activeTab === 'ACADEMIC' && user.role === UserRole.STUDENT && (
             <div className="space-y-8 animate-in">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                   <div className="relative">
                      <div className="absolute -top-3 left-6 px-3 bg-white dark:bg-slate-900 z-10"><span className="text-[9px] font-black text-blue-500 uppercase tracking-widest">{t.program}</span></div>
                      <div className="w-full h-20 bg-slate-50 dark:bg-slate-950/50 border border-slate-100 dark:border-slate-800 rounded-[24px] px-8 flex items-center text-sm font-black text-slate-900 dark:text-white uppercase">{formData.program}</div>
                   </div>
                   <div className="relative">
                      <div className="absolute -top-3 left-6 px-3 bg-white dark:bg-slate-900 z-10"><span className="text-[9px] font-black text-blue-500 uppercase tracking-widest">{t.batch}</span></div>
                      <input type="text" value={formData.batch} onChange={e => setFormData({...formData, batch: e.target.value})} className="w-full h-20 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-[24px] px-8 text-sm font-black text-slate-900 dark:text-white outline-none" />
                   </div>
                </div>
                <div className="p-10 bg-blue-600 rounded-[40px] text-white shadow-2xl relative overflow-hidden">
                   <div className="relative z-10">
                      <p className="text-[10px] font-black uppercase tracking-[0.3em] mb-2 opacity-60">Syllabus Completion</p>
                      <h4 className="text-4xl font-black mb-4 uppercase tracking-tighter">74.2% Synced</h4>
                      <div className="w-full h-3 bg-white/20 rounded-full overflow-hidden"><div className="w-[74%] h-full bg-white"></div></div>
                   </div>
                   <div className="absolute top-0 right-0 p-8 opacity-10 text-9xl">📖</div>
                </div>
                <button onClick={handleSave} disabled={isSaving} className="w-full py-5 md:py-8 bg-blue-600 text-white rounded-[24px] md:rounded-[36px] font-black text-[11px] md:text-sm uppercase tracking-[0.3em] shadow-2xl active:scale-95 disabled:opacity-50">{isSaving ? t.syncing : t.save}</button>
             </div>
           )}

           {activeTab === 'PROFESSIONAL' && user.role === UserRole.INSTRUCTOR && (
             <div className="space-y-8 animate-in">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                   <div className="relative">
                      <div className="absolute -top-3 left-6 px-3 bg-white dark:bg-slate-900 z-10"><span className="text-[9px] font-black text-purple-600 uppercase tracking-widest">{t.specialization}</span></div>
                      <input type="text" value={formData.specialization} onChange={e => setFormData({...formData, specialization: e.target.value})} className="w-full h-20 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-[24px] px-8 text-sm font-black text-slate-900 dark:text-white outline-none" />
                   </div>
                   <div className="relative">
                      <div className="absolute -top-3 left-6 px-3 bg-white dark:bg-slate-900 z-10"><span className="text-[9px] font-black text-purple-600 uppercase tracking-widest">{t.councilId}</span></div>
                      <div className="w-full h-20 bg-slate-50 dark:bg-slate-950/50 border border-slate-100 dark:border-slate-800 rounded-[24px] px-8 flex items-center text-sm font-black text-slate-400 uppercase">{formData.councilId}</div>
                   </div>
                </div>
                <button onClick={handleSave} disabled={isSaving} className="w-full py-5 md:py-8 bg-purple-600 text-white rounded-[24px] md:rounded-[36px] font-black text-[11px] md:text-sm uppercase tracking-[0.3em] shadow-2xl active:scale-95 disabled:opacity-50">{isSaving ? t.syncing : t.save}</button>
             </div>
           )}

           {(activeTab === 'PERFORMANCE' || activeTab === 'ANALYTICS') && (
             <div className="h-full flex flex-col items-center justify-center space-y-6 animate-in">
                <div className="w-24 h-24 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-full flex items-center justify-center text-4xl shadow-inner">📊</div>
                <h3 className="text-xl font-black uppercase tracking-tight dark:text-white">Metrics Synchronizing</h3>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-widest max-w-xs text-center leading-loose">Detailed academic performance tracking is being compiled from your activity nodes.</p>
             </div>
           )}
        </div>
      </div>
    </div>
  );
};

export default Profile;