import React, { useState, useEffect } from 'react';
import { 
  X, 
  Key, 
  ShieldCheck, 
  Check, 
  Cpu, 
  HelpCircle,
  ExternalLink
} from 'lucide-react';
import { sounds } from '../services/audioEffects';

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ isOpen, onClose }) => {
  const [provider, setProvider] = useState<'client_neural' | 'fal_vton' | 'fashn' | 'replicate' | 'gemini_vision'>('client_neural');
  const [apiKey, setApiKey] = useState<string>('');
  const [isSaved, setIsSaved] = useState<boolean>(false);

  useEffect(() => {
    const savedProv = localStorage.getItem('anywear_api_provider') as any;
    const savedKey = localStorage.getItem('anywear_api_key') || '';
    if (savedProv) setProvider(savedProv);
    if (savedKey) setApiKey(savedKey);
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    localStorage.setItem('anywear_api_provider', provider);
    localStorage.setItem('anywear_api_key', apiKey);
    setIsSaved(true);
    sounds.playSuccessTone();
    setTimeout(() => {
      setIsSaved(false);
      onClose();
    }, 800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div 
        className="w-full max-w-lg rounded-3xl border border-white/10 bg-[#0d0d16] p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-950/60 border border-cyan-500/30 text-cyan-400">
              <Key className="h-4 w-4" />
            </div>
            <div>
              <h3 className="font-display text-base font-bold text-white">AI Inference & Provider Settings</h3>
              <p className="text-[10px] font-mono text-neutral-400">WORLD-MODEL COMPUTATION PIPELINE</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-neutral-900 text-neutral-400 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Inference Provider Selection */}
        <div className="space-y-4 mb-6">
          <label className="text-[11px] font-mono text-neutral-400 block">VIRTUAL TRY-ON ENGINE BACKEND</label>
          
          <div className="space-y-2">
            {[
              {
                id: 'client_neural',
                name: 'Decart Real-Time World Model (Built-in Client WASM)',
                desc: 'Zero API keys required. Instant 40ms local cloth warping & neural lighting harmonization.',
                isDefault: true
              },
              {
                id: 'fal_vton',
                name: 'Fal.ai IDM-VTON (Photorealistic Cloud API)',
                desc: 'Direct integration with Fal.ai IDM-VTON high-fashion inpainting endpoint.',
                isDefault: false
              },
              {
                id: 'gemini_vision',
                name: 'Google Gemini 2.0 / Flash Multimodal Try-On',
                desc: 'Prompt-guided fashion stylization via Gemini Vision API.',
                isDefault: false
              }
            ].map((p) => (
              <div
                key={p.id}
                onClick={() => {
                  sounds.playClick();
                  setProvider(p.id as any);
                }}
                className={`rounded-2xl border p-3.5 cursor-pointer transition-all ${
                  provider === p.id
                    ? 'border-cyan-400 bg-cyan-950/30 ring-1 ring-cyan-400'
                    : 'border-white/10 bg-neutral-900/40 hover:border-white/20'
                }`}
              >
                <div className="flex items-center justify-between font-bold text-xs text-white mb-1">
                  <span>{p.name}</span>
                  {provider === p.id && <Check className="h-4 w-4 text-cyan-400" />}
                </div>
                <p className="text-[11px] text-neutral-400">{p.desc}</p>
              </div>
            ))}
          </div>

          {/* Optional API Key Input if external provider */}
          {provider !== 'client_neural' && (
            <div className="pt-2 animate-in fade-in duration-200">
              <label className="text-[11px] font-mono text-neutral-400 mb-1.5 block">
                ENTER {provider.toUpperCase()} API KEY
              </label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk_..."
                className="w-full rounded-xl border border-white/10 bg-black/60 p-3 text-xs text-white placeholder:text-neutral-500 outline-none focus:border-cyan-400"
              />
              <p className="text-[10px] text-neutral-500 mt-1">Keys are stored exclusively in your browser's localStorage.</p>
            </div>
          )}
        </div>

        {/* Save button */}
        <div className="flex gap-3">
          <button
            onClick={handleSave}
            className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-cyan-400 text-black py-3 text-xs font-bold hover:bg-cyan-300 transition-colors shadow-lg shadow-cyan-400/20"
          >
            {isSaved ? <Check className="h-4 w-4 text-black" /> : <ShieldCheck className="h-4 w-4" />}
            <span>{isSaved ? 'Settings Saved!' : 'Save & Apply Engine'}</span>
          </button>
        </div>

      </div>
    </div>
  );
};
