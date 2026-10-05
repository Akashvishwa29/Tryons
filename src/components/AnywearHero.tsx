import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  ArrowRight, 
  Camera, 
  Layers, 
  ShoppingBag,
  ExternalLink
} from 'lucide-react';
import { Garment } from '../types';
import { sounds } from '../services/audioEffects';

interface AnywearHeroProps {
  onOpenTryModal: () => void;
  onOpenFullStudio: () => void;
  onOpenStoreSimulator: () => void;
  activeGarment: Garment;
  garments: Garment[];
  onSelectGarment: (garment: Garment) => void;
}

export const AnywearHero: React.FC<AnywearHeroProps> = ({
  onOpenTryModal,
  onOpenFullStudio,
  onOpenStoreSimulator,
  activeGarment,
  garments,
  onSelectGarment
}) => {
  const [currentHost, setCurrentHost] = useState<string>('revolve.com');
  const [hostIndex, setHostIndex] = useState<number>(0);
  const [heroModelLook, setHeroModelLook] = useState<Garment>(garments[0]);

  const hosts = ['revolve.com', 'zara.com', 'pinterest.com', 'asos.com', 'farfetch.com'];

  useEffect(() => {
    const timer = setInterval(() => {
      setHostIndex((prev) => {
        const next = (prev + 1) % hosts.length;
        setCurrentHost(hosts[next]);
        return next;
      });
    }, 2800);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="w-full min-h-[calc(100vh-64px)] grid grid-cols-1 lg:grid-cols-2 bg-[#fffffc] text-[#170404]">
      
      {/* LEFT COLUMN: HERO CONTENT */}
      <section className="flex flex-col justify-between p-8 sm:p-14 lg:p-18 animate-in fade-in duration-500">
        
        {/* Wordmark */}
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#170404] text-white">
            <Sparkles className="h-5 w-5 text-[#fec6ff]" />
          </div>
          <span className="text-2xl font-bold tracking-tight font-display text-[#170404]">
            TRYONS
          </span>
        </div>

        {/* Hero Title & Actions */}
        <div className="my-10 max-w-xl">
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight text-[#170404] leading-[0.98]">
            Try clothes on,<br />anywhere online
          </h1>

          <p className="text-lg sm:text-xl text-[#736b6b] mt-6 leading-relaxed font-normal">
            Drag any clothing item from any online store and see it on you, instantly through your camera in real time.
          </p>

          {/* CTA Buttons */}
          <div className="flex items-center gap-3.5 mt-8 flex-wrap">
            <button
              onClick={() => {
                sounds.playSuccessTone();
                onOpenTryModal();
              }}
              className="flex items-center justify-center gap-2 rounded-xl bg-[#170404] text-[#fffffc] px-7 py-4 text-base font-bold shadow-xl hover:bg-black hover:scale-105 active:scale-95 transition-all"
            >
              <Camera className="h-5 w-5 text-[#fec6ff]" />
              <span>Try Live Now</span>
            </button>

            <button
              onClick={() => {
                sounds.playClick();
                onOpenFullStudio();
              }}
              className="flex items-center justify-center gap-2 rounded-xl border border-black/20 bg-[#fffffc] text-[#170404] px-7 py-4 text-base font-bold hover:bg-[#f1edf6] transition-all"
            >
              <Layers className="h-4 w-4" />
              <span>Full Studio AR</span>
            </button>
          </div>

          {/* Store Owner link */}
          <div className="mt-8 pt-6 border-t border-black/10">
            <button
              onClick={onOpenStoreSimulator}
              className="group flex items-center justify-between w-full rounded-xl border border-black/15 bg-neutral-50/80 p-3.5 text-xs font-semibold text-[#170404] hover:border-black hover:bg-white transition-all text-left"
            >
              <span>Own a store? Add Tryons virtual fitting to your website</span>
              <span className="text-neutral-400 group-hover:text-black group-hover:translate-x-1 transition-all">
                →
              </span>
            </button>
          </div>
        </div>

        {/* Footer Tag */}
        <div className="flex items-center gap-2 text-xs text-[#a49595]">
          <span>Powered by</span>
          <span className="font-bold tracking-wider text-[#170404]">TRYONS WORLD MODELS</span>
        </div>
      </section>

      {/* RIGHT COLUMN: MESH GRADIENT & LIVE BROWSER MOCKUP */}
      <section className="relative flex flex-col items-center justify-center p-8 sm:p-12 overflow-hidden bg-[#eae4f7] bg-gradient-to-tr from-[#eae4f7] via-[#fedfff] to-[#fec6ff]">
        
        {/* Beta Pill */}
        <div className="mb-6 flex items-center gap-2 rounded-full border border-white/60 bg-white/50 px-4 py-2 text-xs font-semibold text-[#5a2540] shadow-md backdrop-blur-md">
          <Sparkles className="h-3.5 w-3.5 text-[#c65a92]" />
          <span>Tryons Beta. Live virtual try-on engine.</span>
        </div>

        {/* Floating Browser Mockup */}
        <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl overflow-hidden border border-black/10 transition-transform duration-300 hover:scale-[1.01]">
          
          {/* Browser Bar */}
          <div className="h-10 bg-[#f3eef4] border-b border-black/5 flex items-center px-3.5 gap-2">
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
            </div>

            {/* Rotating URL address */}
            <div className="flex-1 ml-2 bg-black/5 rounded-md h-6 px-3 flex items-center text-[11px] font-mono text-[#736b6b]">
              <span>https://{currentHost}/product/gown</span>
            </div>
          </div>

          {/* Browser Body with interactive try-on preview */}
          <div className="relative aspect-[16/10] bg-neutral-900 overflow-hidden group">
            <video
              src="/hero-tryon.mp4"
              poster="/hero-tryon-poster.jpg"
              autoPlay
              loop
              muted
              playsInline
              preload="metadata"
              aria-label="Live virtual try-on demo"
              className="w-full h-full object-cover"
            />

            {/* Overlay Garment Tag */}
            <div className="absolute top-3 left-3 bg-black/70 backdrop-blur-md rounded-xl border border-white/20 p-2 text-white flex items-center gap-2">
              <img src={heroModelLook.thumbnail} alt="" className="h-8 w-8 object-contain" />
              <div>
                <div className="text-[11px] font-bold">{heroModelLook.name}</div>
                <div className="text-[9px] text-[#fec6ff]">{heroModelLook.brand || 'Tryons Studio'}</div>
              </div>
            </div>

            {/* Floating Action Button inside browser */}
            <div className="absolute bottom-3 inset-x-3">
              <button
                onClick={() => {
                  sounds.playSuccessTone();
                  onOpenTryModal();
                }}
                className="w-full rounded-xl bg-white/95 text-black py-2.5 text-xs font-bold shadow-xl hover:bg-white flex items-center justify-center gap-2 backdrop-blur-md transition-all"
              >
                <Camera className="h-4 w-4 text-[#c65a92]" />
                <span>Try this dress on yourself in live camera</span>
              </button>
            </div>
          </div>

          {/* Garment Quick Swapper under browser */}
          <div className="p-3 bg-white border-t border-black/5 flex items-center justify-between gap-2 overflow-x-auto">
            <span className="text-[10px] font-bold text-neutral-400 font-mono whitespace-nowrap">SAMPLE LOOKS:</span>
            <div className="flex items-center gap-2">
              {garments.slice(0, 4).map((g) => (
                <button
                  key={g.id}
                  onClick={() => {
                    sounds.playClick();
                    setHeroModelLook(g);
                    onSelectGarment(g);
                  }}
                  className={`h-10 w-10 rounded-lg border p-1 transition-all ${
                    heroModelLook.id === g.id
                      ? 'border-black ring-1 ring-black bg-neutral-100'
                      : 'border-black/10 hover:border-black/30'
                  }`}
                >
                  <img src={g.thumbnail} alt={g.name} className="h-full w-full object-contain" />
                </button>
              ))}
            </div>
          </div>

        </div>

      </section>

    </div>
  );
};
