import React from 'react';
import { 
  X, 
  RotateCcw, 
  Sliders, 
  Eye, 
  Wind, 
  Palette, 
  Sparkles,
  Maximize2,
  ScanLine
} from 'lucide-react';
import { FittingSettings } from '../types';
import { sounds } from '../services/audioEffects';

interface FittingControlPanelProps {
  isOpen: boolean;
  onClose: () => void;
  settings: FittingSettings;
  onUpdateSettings: (newSettings: FittingSettings) => void;
}

export const FittingControlPanel: React.FC<FittingControlPanelProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings
}) => {
  if (!isOpen) return null;

  const handleSliderChange = (key: keyof FittingSettings, value: number | boolean | string) => {
    onUpdateSettings({
      ...settings,
      [key]: value
    });
  };

  const handleResetDefaults = () => {
    sounds.playClick();
    onUpdateSettings({
      shoulderScale: 1.0,
      torsoLength: 1.0,
      verticalOffset: 0,
      horizontalOffset: 0,
      waistTaper: 1.0,
      drapeTightness: 1.0,
      physicsSway: 0.6,
      opacity: 1.0,
      blendMode: 'source-over',
      hueShift: 0,
      saturation: 1.0,
      brightness: 1.0,
      textureOverlay: 'none',
      showMeshDebug: false,
      showSkeletonDebug: false,
      showBoundingBox: false,
      showLaserScanner: false,
      mirrorCamera: true
    });
  };

  const applyPreset = (preset: 'tight' | 'regular' | 'oversized') => {
    sounds.playClick();
    if (preset === 'tight') {
      onUpdateSettings({
        ...settings,
        shoulderScale: 0.95,
        torsoLength: 0.98,
        waistTaper: 0.85,
        drapeTightness: 1.3,
        physicsSway: 0.3
      });
    } else if (preset === 'regular') {
      onUpdateSettings({
        ...settings,
        shoulderScale: 1.05,
        torsoLength: 1.0,
        waistTaper: 1.0,
        drapeTightness: 1.0,
        physicsSway: 0.6
      });
    } else if (preset === 'oversized') {
      onUpdateSettings({
        ...settings,
        shoulderScale: 1.25,
        torsoLength: 1.15,
        waistTaper: 1.2,
        drapeTightness: 0.7,
        physicsSway: 0.9
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/60 backdrop-blur-sm p-4 sm:p-6 animate-in fade-in duration-200">
      <div 
        className="w-full max-w-md h-full max-h-[92vh] flex flex-col rounded-2xl border border-white/10 bg-[#0d0d16] p-5 shadow-2xl overflow-y-auto custom-scrollbar"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-950/60 border border-cyan-500/30 text-cyan-400">
              <Sliders className="h-4 w-4" />
            </div>
            <div>
              <h3 className="font-display text-base font-bold text-white">Live Fit & Material Engine</h3>
              <p className="text-[10px] font-mono text-neutral-400">REAL-TIME CLOTH DEFORMATION HUD</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleResetDefaults}
              title="Reset to defaults"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-neutral-900 text-neutral-400 hover:text-white"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-neutral-900 text-neutral-400 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Fit Profiles Quick Buttons */}
        <div className="mb-5">
          <label className="text-[11px] font-mono text-neutral-400 mb-2 block">QUICK SILHOUETTE PRESETS</label>
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => applyPreset('tight')}
              className="rounded-xl border border-white/10 bg-neutral-900/60 py-2 text-xs font-semibold text-neutral-300 hover:border-cyan-500/40 hover:text-cyan-300"
            >
              Couture Tight
            </button>
            <button
              onClick={() => applyPreset('regular')}
              className="rounded-xl border border-white/10 bg-neutral-900/60 py-2 text-xs font-semibold text-neutral-300 hover:border-cyan-500/40 hover:text-cyan-300"
            >
              Classic Fit
            </button>
            <button
              onClick={() => applyPreset('oversized')}
              className="rounded-xl border border-white/10 bg-neutral-900/60 py-2 text-xs font-semibold text-neutral-300 hover:border-cyan-500/40 hover:text-cyan-300"
            >
              Runway Oversize
            </button>
          </div>
        </div>

        {/* SECTION 1: BODY PROPORTIONS & DEFORMATION */}
        <div className="space-y-4 border-b border-white/10 pb-5 mb-5">
          <div className="flex items-center gap-2 text-xs font-bold text-cyan-400">
            <Maximize2 className="h-3.5 w-3.5" />
            <span>BODY CONTOUR & MESH WARPING</span>
          </div>

          {/* Shoulder Scale */}
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-neutral-300">Shoulder Width Span</span>
              <span className="font-mono text-cyan-400">{Math.round(settings.shoulderScale * 100)}%</span>
            </div>
            <input
              type="range"
              min="0.7"
              max="1.5"
              step="0.02"
              value={settings.shoulderScale}
              onChange={(e) => handleSliderChange('shoulderScale', parseFloat(e.target.value))}
              className="w-full accent-cyan-400 h-1.5 bg-neutral-800 rounded-lg cursor-pointer"
            />
          </div>

          {/* Torso Length */}
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-neutral-300">Torso & Hemline Drop</span>
              <span className="font-mono text-cyan-400">{Math.round(settings.torsoLength * 100)}%</span>
            </div>
            <input
              type="range"
              min="0.7"
              max="1.5"
              step="0.02"
              value={settings.torsoLength}
              onChange={(e) => handleSliderChange('torsoLength', parseFloat(e.target.value))}
              className="w-full accent-cyan-400 h-1.5 bg-neutral-800 rounded-lg cursor-pointer"
            />
          </div>

          {/* Vertical Offset */}
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-neutral-300">Collar Vertical Shift</span>
              <span className="font-mono text-cyan-400">{settings.verticalOffset}px</span>
            </div>
            <input
              type="range"
              min="-60"
              max="60"
              step="1"
              value={settings.verticalOffset}
              onChange={(e) => handleSliderChange('verticalOffset', parseInt(e.target.value))}
              className="w-full accent-cyan-400 h-1.5 bg-neutral-800 rounded-lg cursor-pointer"
            />
          </div>

          {/* Cloth Physics Sway */}
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-neutral-300 flex items-center gap-1.5">
                <Wind className="h-3 w-3 text-emerald-400" />
                <span>Dynamic Cloth Sway & Physics</span>
              </span>
              <span className="font-mono text-emerald-400">{Math.round(settings.physicsSway * 100)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="1.0"
              step="0.05"
              value={settings.physicsSway}
              onChange={(e) => handleSliderChange('physicsSway', parseFloat(e.target.value))}
              className="w-full accent-emerald-400 h-1.5 bg-neutral-800 rounded-lg cursor-pointer"
            />
          </div>
        </div>

        {/* SECTION 2: FABRIC COLOR & SHADERS */}
        <div className="space-y-4 border-b border-white/10 pb-5 mb-5">
          <div className="flex items-center gap-2 text-xs font-bold text-fuchsia-400">
            <Palette className="h-3.5 w-3.5" />
            <span>FABRIC TEXTURE & SHADER CUSTOMIZATION</span>
          </div>

          {/* Hue Rotation */}
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-neutral-300">Color Hue Shift</span>
              <span className="font-mono text-fuchsia-400">{settings.hueShift}°</span>
            </div>
            <input
              type="range"
              min="-180"
              max="180"
              step="5"
              value={settings.hueShift}
              onChange={(e) => handleSliderChange('hueShift', parseInt(e.target.value))}
              className="w-full accent-fuchsia-400 h-1.5 bg-neutral-800 rounded-lg cursor-pointer"
            />
          </div>

          {/* Texture Overlay Shaders */}
          <div>
            <label className="text-[11px] font-mono text-neutral-400 mb-2 block">FABRIC FINISH SHADER</label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'none', label: 'Standard Matte' },
                { id: 'silk', label: 'Lustrous Silk Sheen' },
                { id: 'velvet', label: 'Deep Velvet Texture' },
                { id: 'metallic', label: 'Metallic Liquid Foil' },
                { id: 'holographic', label: 'Holographic Iridescent' },
                { id: 'neon', label: 'Cyberpunk Neon Glow' }
              ].map((tex) => (
                <button
                  key={tex.id}
                  onClick={() => {
                    sounds.playClick();
                    handleSliderChange('textureOverlay', tex.id);
                  }}
                  className={`rounded-xl border p-2 text-left text-xs font-medium transition-all ${
                    settings.textureOverlay === tex.id
                      ? 'border-fuchsia-500 bg-fuchsia-950/40 text-fuchsia-300 shadow-sm shadow-fuchsia-500/20'
                      : 'border-white/10 bg-neutral-900/60 text-neutral-400 hover:text-white'
                  }`}
                >
                  {tex.label}
                </button>
              ))}
            </div>
          </div>

          {/* Opacity */}
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-neutral-300">Garment Opacity</span>
              <span className="font-mono text-neutral-300">{Math.round(settings.opacity * 100)}%</span>
            </div>
            <input
              type="range"
              min="0.2"
              max="1.0"
              step="0.05"
              value={settings.opacity}
              onChange={(e) => handleSliderChange('opacity', parseFloat(e.target.value))}
              className="w-full accent-neutral-300 h-1.5 bg-neutral-800 rounded-lg cursor-pointer"
            />
          </div>
        </div>

        {/* SECTION 3: HUD DEBUG & SKELETON */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold text-amber-400">
            <ScanLine className="h-3.5 w-3.5" />
            <span>HUD DIAGNOSTICS & RETICLES</span>
          </div>

          <div className="space-y-2">
            {[
              { key: 'showSkeletonDebug', label: 'Show Pose Skeleton & Landmarks' },
              { key: 'showMeshDebug', label: 'Show Cloth Bézier Mesh Wireframe' },
              { key: 'showBoundingBox', label: 'Show Decart Target Bounding Box' },
              { key: 'showLaserScanner', label: 'Show Live Laser Sweep Beam' },
              { key: 'mirrorCamera', label: 'Mirror Camera Stream (Selfie Mode)' }
            ].map((toggle) => (
              <label
                key={toggle.key}
                className="flex items-center justify-between rounded-xl border border-white/5 bg-neutral-900/40 px-3 py-2 text-xs text-neutral-300 cursor-pointer hover:bg-neutral-900/70"
              >
                <span>{toggle.label}</span>
                <input
                  type="checkbox"
                  checked={!!settings[toggle.key as keyof FittingSettings]}
                  onChange={(e) => handleSliderChange(toggle.key as keyof FittingSettings, e.target.checked)}
                  className="h-4 w-4 rounded accent-cyan-400 cursor-pointer"
                />
              </label>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
};
