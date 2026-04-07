
import React, { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';

interface CropModalProps {
  image: string;
  onCropComplete: (croppedImage: Blob) => void;
  onCancel: () => void;
  aspect?: number;
}

const CropModal: React.FC<CropModalProps> = ({ image, onCropComplete, onCancel, aspect = 3.2 / 1 }) => {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);

  const onCropChange = useCallback((crop: { x: number; y: number }) => {
    setCrop(crop);
  }, []);

  const onCropAreaChange = useCallback((_croppedArea: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const createImage = (url: string): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
      const image = new Image();
      image.addEventListener('load', () => resolve(image));
      image.addEventListener('error', (error) => reject(error));
      image.setAttribute('crossOrigin', 'anonymous');
      image.src = url;
    });

  const getCroppedImg = async (imageSrc: string, pixelCrop: any): Promise<Blob> => {
    const image = await createImage(imageSrc);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) throw new Error('No 2d context');

    canvas.width = pixelCrop.width;
    canvas.height = pixelCrop.height;

    ctx.drawImage(
      image,
      pixelCrop.x,
      pixelCrop.y,
      pixelCrop.width,
      pixelCrop.height,
      0,
      0,
      pixelCrop.width,
      pixelCrop.height
    );

    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
      }, 'image/jpeg', 0.9);
    });
  };

  const handleApply = async () => {
    try {
      const croppedBlob = await getCroppedImg(image, croppedAreaPixels);
      onCropComplete(croppedBlob);
    } catch (e) {
      console.error(e);
      alert("Error generating cropped asset node.");
    }
  };

  return (
    <div className="fixed inset-0 z-[8000] bg-slate-950/90 backdrop-blur-xl flex flex-col items-center justify-center p-4 md:p-10 animate-in">
      <div className="bg-white dark:bg-slate-900 w-full max-w-5xl rounded-[48px] overflow-hidden border border-slate-100 dark:border-slate-800 flex flex-col shadow-2xl h-[80vh]">
        <header className="p-6 md:p-8 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center shrink-0">
          <div>
            <h3 className="text-xl md:text-2xl font-black uppercase dark:text-white italic tracking-tighter">Adjust Banner Logic</h3>
            <p className="text-[8px] md:text-[10px] font-black text-blue-500 uppercase tracking-widest mt-1">Optimization Node: Precision Cropping</p>
          </div>
          <button onClick={onCancel} className="w-10 h-10 md:w-12 md:h-12 bg-slate-50 dark:bg-slate-800 rounded-xl flex items-center justify-center text-slate-400 hover:text-red-500 transition-colors">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </header>

        <div className="flex-1 relative bg-slate-950/50">
          <Cropper
            image={image}
            crop={crop}
            zoom={zoom}
            aspect={aspect}
            onCropChange={onCropChange}
            onCropComplete={onCropAreaChange}
            onZoomChange={setZoom}
            classes={{
                containerClassName: "rounded-inner",
                mediaClassName: "max-w-none"
            }}
          />
        </div>

        <footer className="p-6 md:p-10 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0 space-y-6">
          <div className="flex items-center gap-6">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest shrink-0">Zoom Node</span>
            <input
              type="range"
              value={zoom}
              min={1}
              max={3}
              step={0.1}
              aria-labelledby="Zoom"
              onChange={(e) => setZoom(Number(e.target.value))}
              className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full appearance-none cursor-pointer accent-blue-600"
            />
          </div>
          <div className="flex gap-4">
            <button onClick={onCancel} className="flex-1 py-4 bg-slate-100 dark:bg-slate-800 text-slate-500 font-black uppercase text-[10px] tracking-widest rounded-2xl">Cancel</button>
            <button onClick={handleApply} className="flex-[2] py-4 bg-blue-600 text-white font-black uppercase text-[10px] tracking-widest rounded-2xl shadow-xl shadow-blue-600/20 active:scale-95 transition-all italic">Synchronize Crop</button>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default CropModal;
