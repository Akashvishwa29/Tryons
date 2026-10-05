import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { AnywearHero } from './components/AnywearHero';
import { AnywearModal } from './components/AnywearModal';
import { LiveCameraViewport } from './components/LiveCameraViewport';
import { WardrobeDrawer } from './components/WardrobeDrawer';
import { FittingControlPanel } from './components/FittingControlPanel';
import { NeuralTryonModal } from './components/NeuralTryonModal';
import { StoreWidgetSimulator } from './components/StoreWidgetSimulator';
import { SnapshotGalleryModal } from './components/SnapshotGalleryModal';
import { ApiKeyModal } from './components/ApiKeyModal';
import { GARMENT_CATALOG } from './data/garmentCatalog';
import { SAMPLE_MODELS } from './data/sampleVideos';
import { AppMode, FittingSettings, Garment, SampleModel, SnapshotItem } from './types';
import { sounds } from './services/audioEffects';
import { Sparkles, ArrowRight, ShieldCheck, Zap, Layers, Compass, ExternalLink } from 'lucide-react';

export function App() {
  const [currentMode, setCurrentMode] = useState<AppMode>('home');
  const [garments, setGarments] = useState<Garment[]>(GARMENT_CATALOG);
  const [activeGarment, setActiveGarment] = useState<Garment>(GARMENT_CATALOG[0]);
  const [activeModel, setActiveModel] = useState<SampleModel>(SAMPLE_MODELS[0]);
  const [snapshots, setSnapshots] = useState<SnapshotItem[]>([]);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [fps, setFps] = useState<number>(60);
  const [latencyMs, setLatencyMs] = useState<number>(32);

  // Modals state
  const [isTryModalOpen, setIsTryModalOpen] = useState<boolean>(false);
  const [isFittingOpen, setIsFittingOpen] = useState<boolean>(false);
  const [isNeuralModalOpen, setIsNeuralModalOpen] = useState<boolean>(false);
  const [neuralSourceImage, setNeuralSourceImage] = useState<string>('');
  const [isGalleryOpen, setIsGalleryOpen] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);

  // Fitting Parameters & Shaders
  const [fittingSettings, setFittingSettings] = useState<FittingSettings>({
    shoulderScale: 1.05,
    torsoLength: 1.0,
    verticalOffset: 0,
    horizontalOffset: 0,
    waistTaper: 1.0,
    drapeTightness: 1.0,
    physicsSway: 0.65,
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

  const handleToggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    sounds.setMuted(nextMuted);
  };

  const handleAddCustomGarment = (newGarment: Garment) => {
    setGarments(prev => [newGarment, ...prev]);
  };

  const handleTriggerNeuralStudio = (sourceImageDataUrl: string) => {
    setNeuralSourceImage(sourceImageDataUrl);
    setIsNeuralModalOpen(true);
  };

  const handleSaveSnapshot = (snap: SnapshotItem) => {
    setSnapshots(prev => [snap, ...prev]);
  };

  const handleDeleteSnapshot = (id: string) => {
    setSnapshots(prev => prev.filter(s => s.id !== id));
  };

  const handleClearAllSnapshots = () => {
    setSnapshots([]);
  };

  const handleTryOnFromStore = (garment: Garment) => {
    setActiveGarment(garment);
    setIsTryModalOpen(true);
    sounds.playSuccessTone();
  };

  return (
    <div className="min-h-screen bg-[#fffffc] text-[#170404] flex flex-col selection:bg-[#fec6ff] selection:text-black">
      
      {/* Header Bar */}
      <Navbar
        currentMode={currentMode}
        onModeChange={setCurrentMode}
        fps={fps}
        latencyMs={latencyMs}
        isMuted={isMuted}
        onToggleMute={handleToggleMute}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenGallery={() => setIsGalleryOpen(true)}
        onOpenTryModal={() => setIsTryModalOpen(true)}
        snapshotCount={snapshots.length}
      />

      {/* Main Content Area */}
      <main className="flex-1 w-full flex flex-col">
        
        {/* MODE 1: TRYONS HOME & HERO */}
        {currentMode === 'home' && (
          <AnywearHero
            onOpenTryModal={() => setIsTryModalOpen(true)}
            onOpenFullStudio={() => setCurrentMode('live')}
            onOpenStoreSimulator={() => setCurrentMode('store_simulator')}
            activeGarment={activeGarment}
            garments={garments}
            onSelectGarment={setActiveGarment}
          />
        )}

        {/* MODE 2: LIVE AR STUDIO & WARDROBE DRAWER */}
        {currentMode === 'live' && (
          <div className="animate-in fade-in duration-300 bg-[#0a0a12] text-white min-h-[calc(100vh-64px)] pb-12">
            <LiveCameraViewport
              activeGarment={activeGarment}
              fittingSettings={fittingSettings}
              activeModel={activeModel}
              onModelChange={setActiveModel}
              sampleModels={SAMPLE_MODELS}
              onCaptureSnapshot={handleSaveSnapshot}
              onOpenFittingPanel={() => setIsFittingOpen(true)}
              onTriggerNeuralStudio={handleTriggerNeuralStudio}
              onUpdateTelemetry={(newFps, newLat) => {
                setFps(newFps);
                setLatencyMs(newLat);
              }}
              onAddCustomGarment={handleAddCustomGarment}
              onSelectGarment={setActiveGarment}
            />

            <WardrobeDrawer
              garments={garments}
              activeGarment={activeGarment}
              onSelectGarment={setActiveGarment}
              onAddCustomGarment={handleAddCustomGarment}
            />
          </div>
        )}

        {/* MODE 3: AI NEURAL SNAP STUDIO */}
        {currentMode === 'neural_studio' && (
          <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-8 animate-in fade-in duration-300">
            <div className="rounded-3xl border border-black/10 bg-gradient-to-r from-purple-100 via-pink-50 to-neutral-100 p-8 mb-8">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="rounded-md bg-black/10 px-2.5 py-0.5 font-mono text-[11px] font-bold text-black">
                      TRYONS INPAINTING VIRTUAL FITTING
                    </span>
                  </div>
                  <h2 className="font-display text-3xl font-extrabold text-black tracking-tight">
                    AI Virtual Fitting Snapshot Studio
                  </h2>
                  <p className="text-sm text-neutral-600 mt-2 max-w-2xl">
                    Generate high-definition editorial fashion photos. Select any portrait model or upload your photo, pick a couture dress, and let our generative world models synthesize realistic fabric folds and lighting.
                  </p>
                </div>

                <button
                  onClick={() => {
                    setNeuralSourceImage(SAMPLE_MODELS[3].url);
                    setIsNeuralModalOpen(true);
                  }}
                  className="flex items-center gap-2 rounded-2xl bg-black px-6 py-3.5 text-sm font-bold text-white shadow-xl hover:scale-105 active:scale-95 transition-all whitespace-nowrap"
                >
                  <Sparkles className="h-4 w-4 text-[#fec6ff]" />
                  <span>Launch Virtual Fitting Studio</span>
                </button>
              </div>
            </div>

            {/* Quick Model Cards */}
            <div className="mb-8">
              <h3 className="font-display text-lg font-bold text-black mb-3">
                Select Model Snapshot to Fit
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {SAMPLE_MODELS.filter(m => m.id !== 'webcam').map((m) => (
                  <div
                    key={m.id}
                    onClick={() => {
                      sounds.playClick();
                      setNeuralSourceImage(m.url || m.thumbnail);
                      setIsNeuralModalOpen(true);
                    }}
                    className="group relative rounded-2xl border border-black/10 bg-white overflow-hidden cursor-pointer hover:border-black hover:scale-[1.02] transition-all p-2 shadow-sm"
                  >
                    <div className="aspect-[3/4] rounded-xl overflow-hidden mb-2 bg-neutral-100">
                      <img src={m.thumbnail} alt={m.name} className="h-full w-full object-cover group-hover:scale-105 transition-transform" />
                    </div>
                    <div className="p-1">
                      <h4 className="font-display text-xs font-bold text-black truncate">{m.name}</h4>
                      <p className="text-[10px] text-neutral-500 truncate">{m.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <WardrobeDrawer
              garments={garments}
              activeGarment={activeGarment}
              onSelectGarment={(g) => {
                setActiveGarment(g);
                setNeuralSourceImage(SAMPLE_MODELS[3].url);
                setIsNeuralModalOpen(true);
              }}
              onAddCustomGarment={handleAddCustomGarment}
            />
          </div>
        )}

        {/* MODE 4: STORE EXTENSION & EMBED WIDGET SIMULATOR */}
        {currentMode === 'store_simulator' && (
          <StoreWidgetSimulator
            garments={garments}
            onTryOnInLiveAR={handleTryOnFromStore}
          />
        )}

      </main>

      {/* SIGNATURE 3-STEP TRYONS TRY-ON MODAL */}
      <AnywearModal
        isOpen={isTryModalOpen}
        onClose={() => setIsTryModalOpen(false)}
        garments={garments}
        activeGarment={activeGarment}
        onSelectGarment={setActiveGarment}
        onAddCustomGarment={handleAddCustomGarment}
        fittingSettings={fittingSettings}
      />

      {/* FIT CONTROLS MODAL */}
      <FittingControlPanel
        isOpen={isFittingOpen}
        onClose={() => setIsFittingOpen(false)}
        settings={fittingSettings}
        onUpdateSettings={setFittingSettings}
      />

      {/* NEURAL INPAINTING MODAL */}
      <NeuralTryonModal
        isOpen={isNeuralModalOpen}
        onClose={() => setIsNeuralModalOpen(false)}
        sourceImage={neuralSourceImage || (SAMPLE_MODELS[3].url)}
        activeGarment={activeGarment}
        garments={garments}
        onSaveToGallery={handleSaveSnapshot}
      />

      {/* SNAPSHOT GALLERY LOOKBOOK */}
      <SnapshotGalleryModal
        isOpen={isGalleryOpen}
        onClose={() => setIsGalleryOpen(false)}
        snapshots={snapshots}
        onDeleteSnapshot={handleDeleteSnapshot}
        onClearAll={handleClearAllSnapshots}
      />

      {/* API KEY & ENGINE SETTINGS */}
      <ApiKeyModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />

      {/* Tryons Footer */}
      <footer className="border-t border-black/10 bg-[#fffffc] py-6 px-4 sm:px-6 text-center text-xs text-[#a49595]">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-display font-bold text-[#170404]">TRYONS AI</span>
            <span className="text-[10px] font-mono text-[#c65a92]">REAL-TIME WORLD MODELS</span>
          </div>
          <div className="text-[11px] text-[#736b6b]">
            Live virtual try-on for any online store. Drag any clothing item and see it on yourself in real time.
          </div>
          <div className="font-mono text-[10px] text-[#a49595]">
            60 FPS · WEBGPU / WASM ACCELERATED
          </div>
        </div>
      </footer>

    </div>
  );
}

export default App;
