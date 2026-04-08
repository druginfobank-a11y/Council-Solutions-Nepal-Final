
import React from 'react';

interface WatermarkProps {
  text: string;
}

const Watermark: React.FC<WatermarkProps> = ({ text }) => {
  return (
    <div className="fixed inset-0 pointer-events-none z-[999] opacity-[0.03] select-none overflow-hidden flex flex-wrap gap-24 p-12 rotate-[-25deg]">
      {Array.from({ length: 40 }).map((_, i) => (
        <span key={i} className="text-white text-lg font-bold whitespace-nowrap">
          {text}
        </span>
      ))}
    </div>
  );
};

export default Watermark;
