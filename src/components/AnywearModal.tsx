import React, { useState, useEffect, useRef } from 'react';
import { 
  Camera, 
  X, 
  Sparkles, 
  Upload, 
  Check, 
  RefreshCw, 
  AlertCircle,
  ArrowRight,
  Sparkle,
  Sliders,
  Download,
  Flame,
  Zap,
  Layers
} from 'lucide-react';
import { Garment, FittingSettings } from '../types';
import { poseDetector } from '../services/poseDetector';
import { clothEngine } from '../services/clothWarpEngine';
import { sounds } from '../services/audioEffects';
import { aiTryonEngine } from '../services/aiTryonEngine';

declare global {
  interface Window {
    DecartSDK?: any;
    __awTryonQueue?: any;
    __awTrack?: (event: string, props?: any) => void;
    __decartModelSlug?: string | null;
    __decartApiSessionId?: string | null;
    __decartProductImageUrl?: string | null;
    __decartForceSessionEnd?: (reason?: string, opts?: any) => void;
    __decartModerationResetAttempt?: any;
    openTryModal?: (e?: any, opts?: any) => void;
    closeTryModal?: () => void;
  }
}

interface AnywearModalProps {
  isOpen: boolean;
  onClose: () => void;
  garments: Garment[];
  activeGarment: Garment;
  onSelectGarment: (garment: Garment) => void;
  onAddCustomGarment: (garment: Garment) => void;
  fittingSettings: FittingSettings;
}

export const AnywearModal: React.FC<AnywearModalProps> = ({
  isOpen,
  onClose,
  garments,
  activeGarment,
  onSelectGarment,
  onAddCustomGarment,
  fittingSettings
}) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [isConnecting, setIsConnecting] = useState(false);
  const [statusText, setStatusText] = useState<string>('');
  const [isDressing, setIsDressing] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [engineMode, setEngineMode] = useState<'webrtc' | 'neural-canvas'>('neural-canvas');
  const [useDemoVideo, setUseDemoVideo] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const camStreamRef = useRef<MediaStream | null>(null);
  const rtClientRef = useRef<any>(null);
  const animFrameRef = useRef<number | null>(null);
  const queueTicketIdRef = useRef<string | null>(null);

  // Model definition helper for Decart
  const modelDefFor = (slug: string) => ({
    name: slug,
    urlPath: '/v1/stream',
    fps: 30,
    width: 1088,
    height: 624,
    inputSchema: {}
  });

  // Start Camera & Initialize Dual-Engine Try-On
  const startExperience = async () => {
    if (isConnecting) return;
    setIsConnecting(true);
    setErrorMessage(null);
    setStatusText('Accessing camera...');
    sounds.playClick();

    let stepStage = 'camera';

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera not supported in this browser.');
      }

      // Stop existing tracks
      if (camStreamRef.current) {
        camStreamRef.current.getTracks().forEach(t => t.stop());
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      });

      camStreamRef.current = stream;

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        localVideoRef.current.src = '';
        localVideoRef.current.muted = true;
        localVideoRef.current.playsInline = true;
        await localVideoRef.current.play().catch(console.warn);
      }

      setUseDemoVideo(false);
      setStep(2);
      sounds.playSuccessTone();

      // Start local high-speed 3D anatomical engine right away
      setEngineMode('neural-canvas');
      setStatusText('Fitting garment...');

      // Connect to Decart WebRTC in background if available
      tryDecartWebRTC(stream);

    } catch (err: any) {
      console.warn('Camera failed, switching to demo mode:', err);
      setIsConnecting(false);
      if (err.name === 'NotAllowedError') {
        setErrorMessage('Camera permission was denied. Please allow camera access.');
      } else {
        startDemoMode();
      }
    } finally {
      setIsConnecting(false);
    }
  };

  const tryDecartWebRTC = async (stream: MediaStream) => {
    const AWQ = window.__awTryonQueue;
    const DecartSDK = window.DecartSDK;

    if (!AWQ || !DecartSDK) {
      console.log('Decart SDK not found in window, running local 3D Neural Engine.');
      return;
    }

    try {
      setStatusText('Connecting to Decart AI Neural Stream...');

      const got = await AWQ.acquire({
        base: /^(?:localhost|127\.0\.0\.1)$/.test(location.hostname) ? '' : 'https://anywear.decart.ai',
        body: {},
        track: (ev: string, p: any) => {
          if (window.__awTrack) window.__awTrack(ev, Object.assign({ platform: 'landing_demo' }, p || {}));
        },
        isCancelled: () => !camStreamRef.current,
        onWaiting: (pos: number) => {
          setStatusText(pos && pos > 1 ? `Queued in line #${pos}...` : 'AI Studio is connecting...');
        }
      });

      if (got.cancelled || !camStreamRef.current) return;
      if (got.busy) {
        console.log('Decart queue busy, staying on local high-precision 3D warp engine.');
        setStatusText('');
        return;
      }

      queueTicketIdRef.current = got.ticketId || null;
      const tok = got.token;
      if (!tok || !tok.modelName) return;

      const modelName = tok.modelName;
      window.__decartModelSlug = modelName;

      const { createDecartClient } = DecartSDK;
      const client = createDecartClient({ apiKey: tok.apiKey });

      const rtClient = await client.realtime.connect(stream, {
        model: modelDefFor(modelName),
        onRemoteStream: (remoteStream: MediaStream) => {
          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = remoteStream;
            remoteVideoRef.current.play().catch(console.warn);
            setEngineMode('webrtc');
            setStatusText('');
          }
        }
      });

      rtClientRef.current = rtClient;
      AWQ.startHeartbeat(got.ticketId, got.token);

      rtClient.on('connectionChange', (state: string) => {
        if (state === 'connected' || state === 'generating') {
          setStatusText('');
        }
        if (state === 'disconnected') {
          if (window.__awTryonQueue) window.__awTryonQueue.release();
          setEngineMode('neural-canvas');
        }
      });

      rtClient.on('error', (err: any) => {
        console.warn('[Decart WebRTC warning]', err);
        setEngineMode('neural-canvas');
      });

      // Send initial garment
      if (activeGarment && activeGarment.thumbnail) {
        const fullUrl = activeGarment.thumbnail.startsWith('http') 
          ? activeGarment.thumbnail 
          : `${window.location.origin}${activeGarment.thumbnail}`;
        rtClient.setImage(fullUrl).catch(console.warn);
      }

    } catch (e) {
      console.log('WebRTC connection notice (using high-speed local engine):', e);
      setStatusText('');
      setEngineMode('neural-canvas');
    }
  };

  const startDemoMode = () => {
    setUseDemoVideo(true);
    setStep(2);
    setEngineMode('neural-canvas');
    if (localVideoRef.current) {
      if (camStreamRef.current) {
        camStreamRef.current.getTracks().forEach(t => t.stop());
        camStreamRef.current = null;
      }
      localVideoRef.current.srcObject = null;
      localVideoRef.current.src = '/hero-tryon.mp4';
      localVideoRef.current.crossOrigin = 'anonymous';
      localVideoRef.current.loop = true;
      localVideoRef.current.muted = true;
      localVideoRef.current.playsInline = true;
      localVideoRef.current.play().catch(console.warn);
    }
  };

  const teardown = () => {
    if (window.__awTryonQueue) {
      try { window.__awTryonQueue.release(); } catch (_) {}
    }
    if (rtClientRef.current) {
      try { rtClientRef.current.disconnect(); } catch (_) {}
      rtClientRef.current = null;
    }
    if (camStreamRef.current) {
      camStreamRef.current.getTracks().forEach(t => t.stop());
      camStreamRef.current = null;
    }
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
    }
    setEngineMode('neural-canvas');
    setStatusText('');
  };

  useEffect(() => {
    if (!isOpen) {
      teardown();
      setStep(1);
    } else {
      poseDetector.initialize();
      // Expose modal functions to window for any external links
      window.openTryModal = () => {};
      window.closeTryModal = onClose;
    }
    return () => {
      teardown();
    };
  }, [isOpen]);

  // Preload garment for local engine
  useEffect(() => {
    if (activeGarment) {
      clothEngine.preloadGarment(activeGarment);
    }
  }, [activeGarment]);

  // Render Loop for Local 3D Anatomical Cloth Warper
  useEffect(() => {
    if (!isOpen || step !== 2) return;

    let isRunning = true;

    const loop = () => {
      if (!isRunning) return;

      const video = localVideoRef.current;
      const canvas = canvasRef.current;

      if (video && canvas && (engineMode === 'neural-canvas' || !remoteVideoRef.current?.srcObject)) {
        const ctx = canvas.getContext('2d');
        if (ctx && video.readyState >= 2) {
          const vw = video.videoWidth || 640;
          const vh = video.videoHeight || 480;

          if (canvas.width !== vw || canvas.height !== vh) {
            canvas.width = vw;
            canvas.height = vh;
          }

          const w = canvas.width;
          const h = canvas.height;

          // Draw camera frame with mirror flip
          ctx.save();
          if (!useDemoVideo) {
            ctx.translate(w, 0);
            ctx.scale(-1, 1);
          }
          ctx.drawImage(video, 0, 0, w, h);
          ctx.restore();

          // Real-time pose tracking and dynamic 3D cloth warping
          poseDetector.updatePose(video, (landmarks) => {
            clothEngine.render(
              ctx,
              w,
              h,
              landmarks,
              activeGarment,
              fittingSettings,
              { 
                isMirrored: !useDemoVideo,
                sourceVideo: video
              }
            );
          });
        }
      }

      animFrameRef.current = requestAnimationFrame(loop);
    };

    animFrameRef.current = requestAnimationFrame(loop);

    return () => {
      isRunning = false;
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [isOpen, step, activeGarment, fittingSettings, useDemoVideo, engineMode]);

  const handleApplyGarment = async (garment: Garment) => {
    setIsDressing(true);
    sounds.playGarmentSwap();
    onSelectGarment(garment);

    // If WebRTC streaming is active, send garment to Decart GPU server
    if (rtClientRef.current) {
      try {
        const fullUrl = garment.thumbnail.startsWith('http') 
          ? garment.thumbnail 
          : `${window.location.origin}${garment.thumbnail}`;
        await rtClientRef.current.setImage(fullUrl);
      } catch (err) {
        console.warn('Decart setImage fallback to local:', err);
      }
    }

    setTimeout(() => {
      setIsDressing(false);
    }, 400);
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);

    const garmentId = e.dataTransfer.getData('text/plain');
    if (garmentId) {
      const found = garments.find(g => g.id === garmentId || g.thumbnail === garmentId);
      if (found) {
        handleApplyGarment(found);
        return;
      }
    }

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = async (ev) => {
          const rawUrl = ev.target?.result as string;
          const cleanUrl = await aiTryonEngine.removeBackgroundFromImage(rawUrl);
          const customG: Garment = {
            id: `drop_${Date.now()}`,
            name: file.name.replace(/\.[^/.]+$/, "").slice(0, 20) || 'Dropped Look',
            category: 'dresses',
            color: '#c65a92',
            description: 'Dropped garment image',
            thumbnail: cleanUrl,
            renderType: 'image',
            defaultScale: 1.22,
            anchorOffset: { x: 0, y: -25 },
            aspectRatio: 1,
            torsoCoverage: 1.32,
            shoulderSpanRatio: 1.35,
            isCustom: true,
            tags: ['Dropped', 'Custom']
          };
          onAddCustomGarment(customG);
          handleApplyGarment(customG);
        };
        reader.readAsDataURL(file);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/65 backdrop-blur-md animate-in fade-in duration-200 font-sans">
      
      {/* Hidden background video elements */}
      <video
        ref={localVideoRef}
        playsInline
        muted
        autoPlay
        style={{
          position: 'fixed',
          top: -9999,
          left: -9999,
          width: '640px',
          height: '480px',
          opacity: 0,
          pointerEvents: 'none'
        }}
      />

      {/* Main Dialog Container */}
      <div 
        className="relative w-full max-w-4xl h-full max-h-[660px] flex flex-col rounded-[24px] border border-black/10 bg-[#fffffc] text-[#170404] shadow-2xl p-6 sm:p-8 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 z-20 flex h-8 w-8 items-center justify-center rounded-full border border-black/15 text-[#170404] hover:bg-black/5 transition-colors"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Top Progress Dots */}
        <div className="flex items-center gap-2 mb-4">
          <div className={`h-1.5 rounded-full transition-all duration-300 ${step === 1 ? 'w-8 bg-[#170404]' : 'w-1.5 bg-black/20'}`} />
          <div className={`h-1.5 rounded-full transition-all duration-300 ${step === 2 ? 'w-8 bg-[#170404]' : 'w-1.5 bg-black/20'}`} />
          <div className={`h-1.5 rounded-full transition-all duration-300 ${step === 3 ? 'w-8 bg-[#170404]' : 'w-1.5 bg-black/20'}`} />
        </div>

        {/* STEP 1: TURN ON CAMERA */}
        {step === 1 && (
          <div className="flex-1 flex flex-col justify-between">
            <div>
              <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#170404]">
                Turn on your camera.
              </h2>
              <p className="text-sm text-[#736b6b] mt-1.5">
                Tryons runs live right in your browser. No photo upload needed.
              </p>
            </div>

            <div className="flex-1 my-6 rounded-2xl bg-[#180810]/5 border border-black/5 flex flex-col items-center justify-center p-6 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full border border-black/15 text-[#170404] mb-5 bg-white shadow-sm">
                <Camera className="h-7 w-7" />
              </div>

              {errorMessage && (
                <div className="mb-4 text-xs font-semibold text-rose-600 bg-rose-50 border border-rose-200 px-4 py-2 rounded-xl">
                  {errorMessage}
                </div>
              )}

              <button
                onClick={startExperience}
                disabled={isConnecting}
                className="flex items-center gap-2 rounded-full bg-[#170404] text-white px-8 py-3.5 text-sm font-medium shadow-lg hover:bg-black hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
              >
                {isConnecting ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>Accessing camera...</span>
                  </>
                ) : (
                  <>
                    <Camera className="h-4 w-4" />
                    <span>Enable camera</span>
                  </>
                )}
              </button>

              <button
                onClick={startDemoMode}
                className="mt-4 text-xs text-[#a49595] hover:text-[#170404] underline underline-offset-4 transition-colors"
              >
                Or try with live demo runway model →
              </button>
            </div>

            <div className="text-[11px] text-[#a49595] text-center font-mono">
              REAL-TIME AI TRY-ON • ZERO LATENCY • PRIVATE
            </div>
          </div>
        )}

        {/* STEP 2: DRAG PRODUCT ONTO YOURSELF */}
        {step === 2 && (
          <div className="flex-1 flex flex-col min-h-0">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-[#170404]">
                Drag a product onto yourself.
              </h2>

              <span className="text-xs font-semibold text-[#a49595] flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                {engineMode === 'webrtc' ? 'Live AI Stream' : '3D Real-Time Warp'}
              </span>
            </div>

            {/* Tip Banner */}
            <div className="flex items-center gap-2 rounded-full border border-black/10 bg-black/[0.02] px-3.5 py-1.5 text-xs text-[#170404] mb-3 self-start">
              <Sparkles className="h-3.5 w-3.5 text-[#c65a92]" />
              <span>For best results — remove any thick jacket or outer layer for the most accurate try-on.</span>
            </div>

            {/* Main Shelf + Video Stage */}
            <div className="flex-1 grid grid-cols-12 gap-3.5 min-h-0">
              
              {/* Left Shelf: Garments */}
              <div className="col-span-4 grid grid-cols-2 gap-2.5 overflow-y-auto pr-1">
                {garments.slice(0, 6).map((g) => {
                  const isSelected = activeGarment.id === g.id;
                  return (
                    <div
                      key={g.id}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData('text/plain', g.id);
                        e.dataTransfer.effectAllowed = 'copy';
                      }}
                      onClick={() => handleApplyGarment(g)}
                      className={`group relative rounded-xl border p-2 flex flex-col items-center justify-between cursor-grab active:cursor-grabbing transition-all ${
                        isSelected
                          ? 'border-[#170404] bg-[#fffffc] shadow-md ring-1 ring-black'
                          : 'border-black/10 bg-[#f7f4f9] hover:border-black/25 hover:bg-white'
                      }`}
                    >
                      <div className="aspect-[3/4] w-full flex items-center justify-center p-1">
                        <img 
                          src={g.thumbnail} 
                          alt={g.name} 
                          className="h-full w-full object-contain pointer-events-none group-hover:scale-105 transition-transform" 
                        />
                      </div>
                      <span className="text-[11px] font-medium text-[#170404] truncate w-full text-center mt-1">
                        {g.name.split(' ')[0]} {g.name.split(' ')[1] || ''}
                      </span>
                      {isSelected && (
                        <div className="absolute top-1.5 right-1.5 h-4 w-4 rounded-full bg-[#170404] text-white flex items-center justify-center text-[9px]">
                          ✓
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Right Stage: Output Video / Canvas */}
              <div 
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragOver(true);
                }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleDrop}
                className={`col-span-8 relative rounded-2xl bg-[#181818] overflow-hidden flex items-center justify-center border-2 transition-all ${
                  isDragOver ? 'border-[#c65a92] shadow-[0_0_20px_rgba(198,90,146,0.5)] scale-[1.01]' : 'border-transparent'
                }`}
              >
                {/* WebRTC Remote Stream Video */}
                <video 
                  ref={remoteVideoRef} 
                  autoPlay 
                  playsInline 
                  muted
                  className={`h-full w-full object-cover ${engineMode === 'webrtc' ? 'block' : 'hidden'}`}
                />

                {/* Real-time 3D Canvas Warper (Active fallback & instant preview) */}
                <canvas 
                  ref={canvasRef} 
                  className={`h-full w-full object-cover ${engineMode === 'webrtc' ? 'hidden' : 'block'}`} 
                />

                {/* Status Notice */}
                {statusText && (
                  <div className="absolute bottom-4 bg-black/75 backdrop-blur-md text-white text-xs px-4 py-2 rounded-full flex items-center gap-2 z-20">
                    <RefreshCw className="h-3.5 w-3.5 animate-spin text-[#c65a92]" />
                    <span>{statusText}</span>
                  </div>
                )}

                {/* Fitting Feedback */}
                {isDressing && (
                  <div className="absolute inset-0 bg-black/35 backdrop-blur-[2px] flex items-center justify-center z-20 animate-in fade-in duration-150">
                    <div className="rounded-full bg-white text-black px-4 py-2 font-medium text-xs flex items-center gap-2 shadow-xl">
                      <Sparkles className="h-4 w-4 text-[#c65a92] animate-spin" />
                      <span>Fitting {activeGarment.name.slice(0, 20)}...</span>
                    </div>
                  </div>
                )}

                {/* Drag Invitation */}
                {isDragOver && (
                  <div className="absolute inset-0 bg-[#c65a92]/30 backdrop-blur-sm flex flex-col items-center justify-center z-30 pointer-events-none">
                    <Sparkles className="h-10 w-10 text-white animate-bounce" />
                    <span className="text-sm font-bold text-white mt-2">DROP TO WEAR</span>
                  </div>
                )}

                {/* Current Outfit Pill */}
                <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-md rounded-lg border border-white/15 px-2.5 py-1 flex items-center gap-2 z-10">
                  <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: activeGarment.color }} />
                  <span className="text-[11px] font-medium text-white">{activeGarment.name}</span>
                </div>
              </div>

            </div>

            {/* Bottom Controls */}
            <div className="flex items-center justify-between mt-3.5 pt-3 border-t border-black/10">
              <span className="text-[11px] text-[#a49595] font-mono">
                POWERED BY TRYONS REAL-TIME AI
              </span>

              <button
                onClick={() => {
                  sounds.playClick();
                  setStep(3);
                }}
                className="flex items-center gap-2 rounded-full bg-[#170404] text-white px-6 py-2.5 text-xs font-medium hover:bg-black transition-all"
              >
                <span>Continue</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: INSTALL EXTENSION */}
        {step === 3 && (
          <div className="flex-1 flex flex-col justify-between">
            <div>
              <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#170404]">
                Install on every online store.
              </h2>
              <p className="text-xs text-[#736b6b] mt-1.5">
                Add <strong>Tryons</strong> to Chrome and try on items from Zara, ASOS, Revolve, and Amazon directly on product pages.
              </p>
            </div>

            <div className="my-4 rounded-2xl bg-[#180810]/5 border border-black/10 p-6 text-center flex flex-col items-center justify-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#170404] text-white mb-3 shadow-md">
                <Sparkles className="h-6 w-6 text-[#fedfff]" />
              </div>

              <h3 className="font-semibold text-base text-[#170404] mb-1">Tryons Chrome Extension</h3>
              <p className="text-xs text-[#736b6b] max-w-md mb-4">
                Drag any clothing item from any website onto your camera and see it on yourself before you buy.
              </p>

              <a
                href="https://chromewebstore.google.com/detail/anywear-virtual-try-on/hijnklblgecbdlhjiofhlhjpndpifejh"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-full bg-[#170404] text-white px-8 py-3 text-xs font-medium shadow-lg hover:bg-black transition-all"
              >
                <span>Add to Chrome (Free Beta)</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </a>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-black/10">
              <button
                onClick={() => {
                  sounds.playClick();
                  setStep(2);
                }}
                className="text-xs font-medium text-[#170404] hover:underline"
              >
                ← Try another look
              </button>

              <button
                onClick={onClose}
                className="text-xs font-medium text-[#a49595] hover:text-[#170404]"
              >
                Done
              </button>
            </div>
          </div>
        )}

      </div>

    </div>
  );
};
