import React, { useState } from 'react';
import { 
  X, 
  Sparkles, 
  Download, 
  Wand2, 
  Layers, 
  Check, 
  RefreshCw, 
  Share2, 
  Clock,
  SplitSquareVertical
} from 'lucide-react';
import { Garment, SnapshotItem } from '../types';
import { aiTryonEngine, AiTryonResult } from '../services/aiTryonEngine';
import { sounds } from '../services/audioEffects';
import confetti from 'canvas-confetti';

interface NeuralTryonModalProps {
  isOpen: boolean;
  onClose: () => void;
  sourceImage: string;
  activeGarment: Garment;
  garments: Garment[];
  onSaveToGallery: (snapshot: SnapshotItem) => void;
}

export const NeuralTryonModal: React.FC<NeuralTryonModalProps> = ({
  isOpen,
  onClose,
  sourceImage,
  activeGarment,
  garments,
  onSaveToGallery
}) => {
  const [selectedGarment, setSelectedGarment] = useState<Garment>(activeGarment);
  const [prompt, setPrompt] = useState<string>('');
  const [selectedPreset, setSelectedPreset] = useState<string>('Editorial Studio');
  const [isRendering, setIsRendering] = useState<boolean>(false);
  const [result, setResult] = useState<AiTryonResult | null>(null);
  const [splitPos, setSplitPos] = useState<number>(50);

  if (!isOpen) return null;

  const stylePresets = [
    { name: 'Editorial Studio', desc: 'Crisp Vogue lighting with clean fabric texture' },
    { name: 'Paris Runway Catwalk', desc: 'Dynamic spotlight with dramatic cloth drape' },
    { name: 'Cyberpunk Neon', desc: 'Glowing volumetric rim light and metallic reflections' },
    { name: 'Gala Red Carpet', desc: 'Warm paparazzi flashes and luxury silk luster' },
    { name: 'Golden Hour Sunset', desc: 'Soft golden rim light and natural linen drape' },
  ];

  const handleRunAiTryOn = async () => {
    setIsRendering(true);
    sounds.playClick();

    try {
      const res = await aiTryonEngine.executeTryOn({
        sourceImage,
        garment: selectedGarment,
        prompt: prompt || `High-fashion tailored ${selectedGarment.name} with realistic fabric folds, perfect neckline fitting and shadow cast`,
        stylePreset: selectedPreset
      });

      setResult(res);
      sounds.playSuccessTone();

      confetti({
        particleCount: 50,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#00f2fe', '#ec4899', '#3b82f6']
      });

      // Save to snapshot gallery
      onSaveToGallery({
        id: `ai_${Date.now()}`,
        timestamp: Date.now(),
        imageUrl: res.outputImage,
        beforeImageUrl: sourceImage,
        garmentName: selectedGarment.name,
        garmentId: selectedGarment.id,
        mode: 'neural_snap',
        notes: `AI Try-On: ${selectedPreset} | Render: ${res.processingTimeMs}ms`
      });
    } catch (err) {
      console.error('AI try-on render failed:', err);
    } finally {
      setIsRendering(false);
    }
  };

  const handleDownload = () => {
    if (!result?.outputImage) return;
    const a = document.createElement('a');
    a.href = result.outputImage;
    a.download = `anywear_ai_fit_${selectedGarment.id}_${Date.now()}.jpg`;
    a.click();
    sounds.playClick();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 sm:p-6 animate-in fade-in duration-200">
      <div 
        className="w-full max-w-5xl h-full max-h-[92vh] flex flex-col md:flex-row rounded-3xl border border-cyan-500/30 bg-[#0c0c14] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Left Side: Preview & Before/After Stage */}
        <div className="flex-1 bg-black/90 p-6 flex flex-col items-center justify-center relative overflow-hidden border-b md:border-b-0 md:border-r border-white/10">
          
          {/* Top Status */}
          <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-10">
            <div className="flex items-center gap-2 rounded-xl bg-black/60 border border-white/10 px-3 py-1 text-[11px] font-mono text-cyan-400">
              <Sparkles className="h-3.5 w-3.5" />
              <span>DECART NEURAL FITTING ENGINE</span>
            </div>

            {result && (
              <div className="flex items-center gap-1.5 rounded-xl bg-emerald-950/80 border border-emerald-500/30 px-3 py-1 text-[11px] font-mono text-emerald-400">
                <Clock className="h-3.5 w-3.5" />
                <span>{result.processingTimeMs}ms INFERENCE</span>
              </div>
            )}
          </div>

          {/* Image Stage */}
          <div className="relative w-full max-w-md aspect-[3/4] rounded-2xl overflow-hidden border border-white/10 shadow-2xl bg-neutral-950">
            {isRendering ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm z-20">
                <div className="relative flex h-16 w-16 items-center justify-center">
                  <div className="animate-spin absolute h-full w-full rounded-full border-2 border-cyan-500 border-t-transparent" />
                  <Sparkles className="h-6 w-6 text-cyan-400 animate-pulse" />
                </div>
                <h4 className="mt-4 font-display text-sm font-bold text-white">Synthesizing Neural Garment...</h4>
                <p className="text-[11px] text-neutral-400 font-mono mt-1">Harmonizing lighting, skin tones & cloth physics</p>
              </div>
            ) : result ? (
              /* Before vs After Interactive Slider */
              <div className="relative w-full h-full select-none overflow-hidden group">
                {/* Background Image (Rendered AI Fit) */}
                <img 
                  src={result.outputImage} 
                  alt="AI Fit" 
                  className="absolute inset-0 w-full h-full object-cover" 
                />

                {/* Foreground Image (Original Frame) clipped by split slider */}
                <div 
                  className="absolute inset-0 overflow-hidden" 
                  style={{ clipPath: `inset(0 ${100 - splitPos}% 0 0)` }}
                >
                  <img 
                    src={sourceImage} 
                    alt="Original" 
                    className="absolute inset-0 w-full h-full object-cover" 
                  />
                  <span className="absolute top-4 left-4 bg-black/70 border border-white/10 px-2 py-0.5 rounded text-[10px] font-mono text-white">
                    ORIGINAL
                  </span>
                </div>

                <span className="absolute top-4 right-4 bg-cyan-950/80 border border-cyan-500/40 px-2 py-0.5 rounded text-[10px] font-mono text-cyan-300">
                  AI FIT
                </span>

                {/* Interactive Split Bar */}
                <div 
                  className="absolute top-0 bottom-0 w-1 bg-cyan-400 cursor-ew-resize z-10 shadow-[0_0_10px_#00f2fe]"
                  style={{ left: `${splitPos}%` }}
                >
                  <div className="absolute top-1/2 -translate-y-1/2 -left-3 h-7 w-7 rounded-full bg-cyan-400 text-black flex items-center justify-center font-bold text-xs shadow-lg">
                    ↔
                  </div>
                </div>

                <input
                  type="range"
                  min="0"
                  max="100"
                  value={splitPos}
                  onChange={(e) => setSplitPos(Number(e.target.value))}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-ew-resize z-20"
                />
              </div>
            ) : (
              <img 
                src={sourceImage} 
                alt="Source Snapshot" 
                className="w-full h-full object-cover" 
              />
            )}
          </div>

          {/* Action Footer for rendered image */}
          {result && (
            <div className="mt-4 flex items-center gap-3">
              <button
                onClick={handleDownload}
                className="flex items-center gap-2 rounded-xl bg-white text-black px-4 py-2 text-xs font-bold shadow-lg hover:bg-neutral-200 transition-colors"
              >
                <Download className="h-4 w-4" /> Download Look (HD)
              </button>
              <button
                onClick={handleRunAiTryOn}
                className="flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold text-white hover:bg-white/10"
              >
                <RefreshCw className="h-3.5 w-3.5" /> Re-render Fit
              </button>
            </div>
          )}

        </div>

        {/* Right Side: Studio Controls & Prompt Injector */}
        <div className="w-full md:w-96 p-6 flex flex-col justify-between bg-[#0e0e18] overflow-y-auto">
          <div>
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-4">
              <div>
                <h3 className="font-display text-base font-bold text-white">Generative Virtual Fitting</h3>
                <p className="text-[11px] text-neutral-400">Decart World-Model Inpainting</p>
              </div>
              <button
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-neutral-900 text-neutral-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Step 1: Select Garment */}
            <div className="mb-4">
              <label className="text-[11px] font-mono text-neutral-400 mb-2 block">1. SELECT GARMENT TO FIT</label>
              <div className="grid grid-cols-4 gap-2 max-h-36 overflow-y-auto pr-1">
                {garments.map((g) => (
                  <button
                    key={g.id}
                    onClick={() => {
                      sounds.playClick();
                      setSelectedGarment(g);
                    }}
                    className={`relative rounded-xl border p-1.5 flex flex-col items-center transition-all ${
                      selectedGarment.id === g.id
                        ? 'border-cyan-400 bg-cyan-950/40 ring-1 ring-cyan-400'
                        : 'border-white/10 bg-neutral-900/60 hover:border-white/30'
                    }`}
                  >
                    <img src={g.thumbnail} alt={g.name} className="h-10 w-10 object-contain" />
                    <span className="text-[9px] font-medium text-neutral-300 truncate w-full text-center mt-1">
                      {g.name.slice(0, 10)}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Step 2: Choose Photography Preset */}
            <div className="mb-4">
              <label className="text-[11px] font-mono text-neutral-400 mb-2 block">2. LIGHTING & STYLE PRESET</label>
              <div className="space-y-1.5">
                {stylePresets.map((preset) => (
                  <button
                    key={preset.name}
                    onClick={() => {
                      sounds.playClick();
                      setSelectedPreset(preset.name);
                    }}
                    className={`w-full text-left rounded-xl border px-3 py-2 text-xs transition-all ${
                      selectedPreset === preset.name
                        ? 'border-cyan-400 bg-cyan-950/30 text-white shadow-sm'
                        : 'border-white/5 bg-neutral-900/40 text-neutral-400 hover:border-white/15 hover:text-neutral-200'
                    }`}
                  >
                    <div className="font-bold flex items-center justify-between">
                      <span>{preset.name}</span>
                      {selectedPreset === preset.name && <Check className="h-3.5 w-3.5 text-cyan-400" />}
                    </div>
                    <div className="text-[10px] text-neutral-500">{preset.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Step 3: Custom Prompt Refinement */}
            <div className="mb-5">
              <label className="text-[11px] font-mono text-neutral-400 mb-1.5 block">3. OPTIONAL PROMPT REFINEMENT</label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="e.g. Add glowing iridescent embroidery, cinched waistline, satin highlights..."
                rows={2}
                className="w-full rounded-xl border border-white/10 bg-black/60 p-2.5 text-xs text-white placeholder:text-neutral-500 outline-none focus:border-cyan-400"
              />
            </div>
          </div>

          {/* Primary Render Button */}
          <button
            onClick={handleRunAiTryOn}
            disabled={isRendering}
            className="w-full flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-500 via-indigo-500 to-fuchsia-500 py-3 text-sm font-bold text-white shadow-xl shadow-cyan-500/20 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 transition-all"
          >
            {isRendering ? (
              <>
                <Sparkles className="h-4 w-4 animate-spin" />
                <span>Running Generative Fitting...</span>
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                <span>Generate Photorealistic Try-On</span>
              </>
            )}
          </button>

        </div>

      </div>
    </div>
  );
};
