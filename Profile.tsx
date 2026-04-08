
import React, { useState, useEffect } from 'react';
import { fetchLiveCouncilNews } from '../services/geminiService';

const News: React.FC = () => {
  const [news, setNews] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadNews = async () => {
      try {
        const data = await fetchLiveCouncilNews();
        setNews(data);
      } catch (e) {
        console.error("News sync failed.");
      } finally {
        setIsLoading(false);
      }
    };
    loadNews();
  }, []);

  return (
    <div className="space-y-8 pb-10 max-w-5xl mx-auto animate-in">
      <header className="flex justify-between items-end px-4 md:px-0">
         <div>
            <p className="text-blue-600 dark:text-blue-400 text-[10px] font-black uppercase tracking-[0.4em] mb-2">Academic Grounding: Verified</p>
            <h1 className="text-4xl md:text-6xl font-black uppercase tracking-tighter italic">Intelligence Feed</h1>
         </div>
         <div className="hidden md:flex items-center gap-3">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Live Node Sync Active</p>
         </div>
      </header>
      
      <div className="space-y-8">
        {isLoading ? (
          Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="bg-slate-100 dark:bg-slate-900 border border-transparent p-12 rounded-[56px] animate-pulse h-64"></div>
          ))
        ) : (
          news.map((item, idx) => (
            <div key={idx} className="bg-white dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 p-8 md:p-12 rounded-[56px] group shadow-sm hover:shadow-2xl transition-all relative overflow-hidden">
              <div className="absolute top-0 right-0 w-80 h-80 bg-blue-600/5 blur-[120px] rounded-full group-hover:bg-blue-600/10 transition-all duration-1000"></div>
              
              <div className="flex justify-between items-start mb-8 relative z-10">
                <div className="flex gap-3">
                  <span className="px-4 py-1.5 bg-blue-600 text-white rounded-full text-[8px] font-black uppercase tracking-widest shadow-lg shadow-blue-600/20 italic">Grounded Node</span>
                  <span className="px-4 py-1.5 bg-slate-50 dark:bg-slate-800 text-slate-500 rounded-full text-[8px] font-black uppercase tracking-widest border border-slate-100 dark:border-white/5">{item.date}</span>
                </div>
                <div className="w-10 h-10 bg-blue-50 dark:bg-blue-900/20 rounded-xl flex items-center justify-center text-blue-600 text-xl">📜</div>
              </div>

              <h2 className="text-2xl md:text-4xl font-black mb-6 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors leading-tight uppercase tracking-tight relative z-10">
                {item.title}
              </h2>
              
              <div className="text-slate-500 dark:text-slate-400 text-sm md:text-base leading-relaxed font-medium relative z-10 space-y-4">
                 {item.content.split('\n').map((line: string, i: number) => (
                   <p key={i}>{line}</p>
                 ))}
              </div>

              {item.citations && item.citations.length > 0 && (
                <div className="mt-10 pt-10 border-t border-slate-50 dark:border-slate-800 relative z-10">
                   <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-4">Official Verification Links</p>
                   <div className="flex flex-wrap gap-3">
                      {item.citations.map((cite: any, i: number) => (
                        <a key={i} href={cite.uri} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-4 py-2 bg-blue-600/5 hover:bg-blue-600 hover:text-white border border-blue-600/20 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">
                           <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                           {cite.title.length > 20 ? cite.title.substring(0, 20) + '...' : cite.title}
                        </a>
                      ))}
                   </div>
                </div>
              )}
            </div>
          ))
        )}
        
        {!isLoading && news.length === 0 && (
          <div className="py-20 text-center opacity-30 flex flex-col items-center">
            <div className="text-6xl mb-6">📡</div>
            <h3 className="text-2xl font-black uppercase tracking-widest">Grounding node signal weak.</h3>
            <p className="text-[10px] font-bold uppercase mt-2">Check academic domain connectivity.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default News;
