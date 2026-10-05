import React from 'react';
import { 
  Sparkles, 
  Camera, 
  Layers, 
  ShoppingBag, 
  Volume2, 
  VolumeX, 
  Settings, 
  Image as ImageIcon,
  Activity,
  Home
} from 'lucide-react';
import { AppMode } from '../types';
import { sounds } from '../services/audioEffects';

interface NavbarProps {
  currentMode: AppMode;
  onModeChange: (mode: AppMode) => void;
  fps: number;
  latencyMs: number;
  isMuted: boolean;
  onToggleMute: () => void;
  onOpenSettings: () => void;
  onOpenGallery: () => void;
  onOpenTryModal: () => void;
  snapshotCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentMode,
  onModeChange,
  fps,
  latencyMs,
  isMuted,
  onToggleMute,
  onOpenSettings,
  onOpenGallery,
  onOpenTryModal,
  snapshotCount
}) => {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-black/10 bg-[#fffffc]/90 backdrop-blur-xl text-[#170404]">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        
        {/* Brand & Tryons Wordmark */}
        <div className="flex items-center gap-4">
          <button 
            onClick={() => onModeChange('home')}
            className="flex items-center gap-2.5 text-left group"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#170404] text-white shadow-md group-hover:scale-105 transition-transform">
              <Sparkles className="h-4 w-4 text-[#fec6ff]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-display text-lg font-bold tracking-tight text-[#170404]">
                  TRYONS
                </span>
                <span className="rounded-full bg-black/5 border border-black/10 px-2 py-0.5 text-[9px] font-bold text-[#c65a92]">
                  LIVE AR
                </span>
              </div>
            </div>
          </button>
        </div>

        {/* Mode Switcher Tabs */}
        <div className="hidden md:flex items-center rounded-xl border border-black/10 bg-neutral-100/70 p-1">
          <button
            onClick={() => {
              sounds.playClick();
              onModeChange('home');
            }}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
              currentMode === 'home'
                ? 'bg-white text-[#170404] shadow-sm font-bold'
                : 'text-neutral-500 hover:text-black'
            }`}
          >
            <Home className="h-3.5 w-3.5" />
            <span>Overview</span>
          </button>

          <button
            onClick={() => {
              sounds.playClick();
              onModeChange('live');
            }}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
              currentMode === 'live'
                ? 'bg-white text-[#170404] shadow-sm font-bold'
                : 'text-neutral-500 hover:text-black'
            }`}
          >
            <Camera className="h-3.5 w-3.5" />
            <span>Studio AR</span>
          </button>

          <button
            onClick={() => {
              sounds.playClick();
              onModeChange('neural_studio');
            }}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
              currentMode === 'neural_studio'
                ? 'bg-white text-[#170404] shadow-sm font-bold'
                : 'text-neutral-500 hover:text-black'
            }`}
          >
            <Layers className="h-3.5 w-3.5" />
            <span>AI Snapshot Studio</span>
          </button>

          <button
            onClick={() => {
              sounds.playClick();
              onModeChange('store_simulator');
            }}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
              currentMode === 'store_simulator'
                ? 'bg-white text-[#170404] shadow-sm font-bold'
                : 'text-neutral-500 hover:text-black'
            }`}
          >
            <ShoppingBag className="h-3.5 w-3.5" />
            <span>Store Widget</span>
          </button>
        </div>

        {/* Action Controls & Try Live Modal Trigger */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => {
              sounds.playSuccessTone();
              onOpenTryModal();
            }}
            className="flex items-center gap-1.5 rounded-xl bg-[#170404] text-[#fffffc] px-4 py-2 text-xs font-bold shadow-md hover:bg-black hover:scale-105 active:scale-95 transition-all"
          >
            <Camera className="h-3.5 w-3.5 text-[#fec6ff]" />
            <span>Try Example</span>
          </button>

          <button
            onClick={onToggleMute}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-black/10 bg-white text-neutral-600 hover:text-black"
          >
            {isMuted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
          </button>

          <button
            onClick={() => {
              sounds.playClick();
              onOpenGallery();
            }}
            className="relative flex h-8 items-center gap-1.5 rounded-lg border border-black/10 bg-white px-2.5 text-xs font-medium text-neutral-700 hover:text-black"
          >
            <ImageIcon className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Looks</span>
            {snapshotCount > 0 && (
              <span className="ml-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#170404] px-1 font-mono text-[9px] font-bold text-white">
                {snapshotCount}
              </span>
            )}
          </button>

          <button
            onClick={() => {
              sounds.playClick();
              onOpenSettings();
            }}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-black/10 bg-white text-neutral-600 hover:text-black"
          >
            <Settings className="h-3.5 w-3.5" />
          </button>
        </div>

      </div>
    </header>
  );
};
