
import React from 'react';

const Calendar: React.FC = () => {
  const days = Array.from({ length: 31 }, (_, i) => i + 1);
  const events = [
    { day: 14, title: 'NPC Form Deadline', type: 'red' },
    { day: 22, title: 'Mock Exam #2', type: 'blue' },
    { day: 28, title: 'Revision Session', type: 'green' },
  ];

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
         <h1 className="text-3xl font-bold">Study Planner</h1>
         <div className="flex gap-2">
            <button className="bg-slate-900 px-4 py-2 rounded-xl text-sm font-bold border border-slate-800">&lt; May 2024 &gt;</button>
         </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 p-8 rounded-[48px] shadow-2xl">
        <div className="grid grid-cols-7 gap-4 mb-6">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
            <div key={d} className="text-center text-slate-500 text-xs font-black uppercase">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-2">
          {/* Mock empty days for start of month */}
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={`empty-${i}`} className="aspect-square"></div>
          ))}
          {days.map(d => {
            const event = events.find(e => e.day === d);
            return (
              <div key={d} className={`aspect-square rounded-2xl border flex flex-col items-center justify-center relative transition-all cursor-pointer ${
                event ? 'bg-slate-800 border-slate-700' : 'border-transparent hover:bg-slate-800/50'
              }`}>
                <span className={`text-sm font-bold ${event ? 'text-white' : 'text-slate-500'}`}>{d}</span>
                {event && (
                  <div className={`w-1.5 h-1.5 rounded-full absolute bottom-2 ${
                    event.type === 'red' ? 'bg-red-500' : event.type === 'blue' ? 'bg-blue-500' : 'bg-green-500'
                  }`}></div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="font-bold text-lg">Upcoming Events</h3>
        {events.map((e, i) => (
          <div key={i} className="flex items-center gap-4 bg-slate-900 p-5 rounded-3xl border border-slate-800">
             <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl ${
               e.type === 'red' ? 'bg-red-500/10' : e.type === 'blue' ? 'bg-blue-500/10' : 'bg-green-500/10'
             }`}>
               {e.type === 'red' ? '📅' : e.type === 'blue' ? '📝' : '📖'}
             </div>
             <div className="flex-1">
               <p className="font-bold">{e.title}</p>
               <p className="text-xs text-slate-500">May {e.day}, 2024</p>
             </div>
             <button className="text-blue-500 text-xs font-bold uppercase">Details</button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Calendar;
