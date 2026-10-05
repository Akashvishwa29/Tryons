import React, { useEffect, useRef, useState, useCallback } from 'react';
import { 
  Camera, 
  Video as VideoIcon, 
  Square, 
  RefreshCw, 
  Sliders, 
  Maximize, 
  Minimize, 
  SplitSquareVertical, 
  Scan, 
  Layers, 
  Sparkles,
  AlertCircle,
  Upload
} from 'lucide-react';
import { BodyLandmarks, FittingSettings, Garment, SampleModel, SnapshotItem } from '../types';
import { poseDetector } from '../services/poseDetector';
import { clothEngine } from '../services/clothWarpEngine';
import { sounds } from '../services/audioEffects';
import { recorderService } from '../services/recorder';
import { aiTryonEngine } from '../services/aiTryonEngine';
import confetti from 'canvas-confetti';

interface LiveCameraViewportProps {
  activeGarment: Garment;
  fittingSettings: FittingSettings;
  activeModel: SampleModel;
  onModelChange: (model: SampleModel) => void;
  sampleModels: SampleModel[];
  onCaptureSnapshot: (snapshot: SnapshotItem) => void;
  onOpenFittingPanel: () => void;
  onTriggerNeuralStudio: (sourceImageDataUrl: string) => void;
  onUpdateTelemetry: (fps: number, latency: number) => void;
  onAddCustomGarment?: (garment: Garment) => void;
  onSelectGarment?: (garment: Garment) => void;
}

export const LiveCameraViewport: React.FC<LiveCameraViewportProps> = ({
  activeGarment,
  fittingSettings,
  activeModel,
  onModelChange,
  sampleModels,
  onCaptureSnapshot,
  onOpenFittingPanel,
  onTriggerNeuralStudio,
  onUpdateTelemetry,
  onAddCustomGarment,
  onSelectGarment
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rawCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordingSeconds, setRecordingSeconds] = useState<number>(0);
  const [isSplitView, setIsSplitView] = useState<boolean>(false);
  const [splitRatio, setSplitRatio] = useState<number>(0.5);
  const [isDraggingSplit, setIsDraggingSplit] = useState<boolean>(false);
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16' | '4:5'>('16:9');
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [isFrozen, setIsFrozen] = useState<boolean>(false);
  const [flashEffect, setFlashEffect] = useState<boolean>(false);
  const [isDragOver, setIsDragOver] = useState<boolean>(false);

  // FPS calculation
  const frameCountRef = useRef(0);
  const lastFpsTimeRef = useRef(performance.now());
  const animFrameIdRef = useRef<number | null>(null);

  // Initialize camera or sample video stream
  const initMediaStream = useCallback(async () => {
    if (activeModel.id === 'webcam') {
      try {
        setCameraError(null);
        if (videoRef.current && videoRef.current.srcObject) {
          const currentStream = videoRef.current.srcObject as MediaStream;
          currentStream.getTracks().forEach(track => track.stop());
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode,
            width: { ideal: 1280 },
            height: { ideal: 720 }
          },
          audio: false
        });

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.src = '';
          videoRef.current.muted = true;
          videoRef.current.playsInline = true;
          await videoRef.current.play().catch(console.warn);
        }
      } catch (err: any) {
        console.warn('Webcam error:', err);
        setCameraError(err.message || 'Camera access denied. Switching to demo model.');
        const fallback = sampleModels.find(m => m.id !== 'webcam') || sampleModels[1];
        if (fallback) onModelChange(fallback);
      }
    } else {
      if (videoRef.current) {
        if (videoRef.current.srcObject) {
          const currentStream = videoRef.current.srcObject as MediaStream;
          currentStream.getTracks().forEach(track => track.stop());
          videoRef.current.srcObject = null;
        }
        videoRef.current.src = activeModel.url;
        videoRef.current.loop = true;
        videoRef.current.muted = true;
        videoRef.current.playsInline = true;
        videoRef.current.crossOrigin = 'anonymous';
        videoRef.current.play().catch(console.warn);
      }
    }
  }, [activeModel, facingMode, sampleModels, onModelChange]);

  useEffect(() => {
    poseDetector.initialize();
    initMediaStream();

    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(t => t.stop());
      }
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
      }
    };
  }, [initMediaStream]);

  // Preload active garment
  useEffect(() => {
    clothEngine.preloadGarment(activeGarment);
  }, [activeGarment]);

  // Optimized Non-blocking 60 FPS Render Loop
  useEffect(() => {
    let isRunning = true;

    const renderLoop = () => {
      if (!isRunning) return;

      const video = videoRef.current;
      const canvas = canvasRef.current;
      const rawCanvas = rawCanvasRef.current;

      if (video && canvas && rawCanvas && !isFrozen) {
        const ctx = canvas.getContext('2d');
        const rawCtx = rawCanvas.getContext('2d');

        if (ctx && rawCtx) {
          const vw = video.videoWidth || 640;
          const vh = video.videoHeight || 480;

          if (canvas.width !== vw || canvas.height !== vh) {
            canvas.width = vw;
            canvas.height = vh;
            rawCanvas.width = canvas.width;
            rawCanvas.height = canvas.height;
          }

          const w = canvas.width;
          const h = canvas.height;

          // FPS counter
          const now = performance.now();
          frameCountRef.current++;
          if (now - lastFpsTimeRef.current >= 1000) {
            const currentFps = Math.round((frameCountRef.current * 1000) / (now - lastFpsTimeRef.current));
            onUpdateTelemetry(currentFps, 32);
            frameCountRef.current = 0;
            lastFpsTimeRef.current = now;
          }

          const isMirrored = fittingSettings.mirrorCamera && activeModel.id === 'webcam';

          // 1. Draw raw frame
          ctx.save();
          if (isMirrored) {
            ctx.translate(w, 0);
            ctx.scale(-1, 1);
          }
          ctx.drawImage(video, 0, 0, w, h);
          ctx.restore();

          rawCtx.save();
          if (isMirrored) {
            rawCtx.translate(w, 0);
            rawCtx.scale(-1, 1);
          }
          rawCtx.drawImage(video, 0, 0, w, h);
          rawCtx.restore();

          // 2. Non-blocking async pose update
          poseDetector.updatePose(video, (landmarks) => {
            clothEngine.render(
              ctx,
              w,
              h,
              landmarks,
              activeGarment,
              fittingSettings,
              {
                splitRatio: isSplitView ? splitRatio : 1.0,
                isMirrored,
                sourceVideo: video
              }
            );

            // Split slider divider
            if (isSplitView) {
              const splitX = w * splitRatio;
              ctx.save();
              ctx.strokeStyle = '#00f2fe';
              ctx.lineWidth = 3;
              ctx.beginPath();
              ctx.moveTo(splitX, 0);
              ctx.lineTo(splitX, h);
              ctx.stroke();
              ctx.restore();
            }
          });
        }
      }

      animFrameIdRef.current = requestAnimationFrame(renderLoop);
    };

    animFrameIdRef.current = requestAnimationFrame(renderLoop);

    return () => {
      isRunning = false;
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
      }
    };
  }, [activeGarment, fittingSettings, activeModel, isSplitView, splitRatio, isFrozen, onUpdateTelemetry]);

  // Handle Drag & Drop of any image directly onto camera viewport
  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith('image/')) {
        sounds.playClick();
        const reader = new FileReader();
        reader.onload = async (ev) => {
          const rawUrl = ev.target?.result as string;
          const cleanUrl = await aiTryonEngine.removeBackgroundFromImage(rawUrl);
          const customG: Garment = {
            id: `drop_${Date.now()}`,
            name: file.name.replace(/\.[^/.]+$/, "").slice(0, 20) || 'Custom Drop',
            category: 'dresses',
            color: '#00f2fe',
            description: 'Dropped garment image',
            thumbnail: cleanUrl,
            renderType: 'image',
            defaultScale: 1.0,
            anchorOffset: { x: 0, y: -10 },
            aspectRatio: 1,
            torsoCoverage: 1.5,
            shoulderSpanRatio: 1.15,
            isCustom: true,
            tags: ['Dropped', 'Custom']
          };
          if (onAddCustomGarment) onAddCustomGarment(customG);
          if (onSelectGarment) onSelectGarment(customG);
          sounds.playSuccessTone();
        };
        reader.readAsDataURL(file);
      }
    }
  };

  const handleTakeSnapshot = () => {
    if (!canvasRef.current) return;
    sounds.playCameraShutter();
    setFlashEffect(true);
    setTimeout(() => setFlashEffect(false), 200);

    const snapshot = recorderService.captureSnapshot(
      canvasRef.current,
      activeGarment,
      'live_ar',
      rawCanvasRef.current || undefined
    );

    onCaptureSnapshot(snapshot);
    confetti({
      particleCount: 30,
      spread: 60,
      origin: { y: 0.8 },
      colors: ['#00f2fe', '#ff007f']
    });
  };

  const handleToggleRecording = async () => {
    if (!canvasRef.current) return;
    sounds.playClick();

    if (!isRecording) {
      try {
        await recorderService.startRecording(canvasRef.current, (seconds) => {
          setRecordingSeconds(seconds);
        });
        setIsRecording(true);
        setRecordingSeconds(0);
      } catch (e) {
        console.error('Recording error', e);
      }
    } else {
      try {
        const { videoUrl } = await recorderService.stopRecording();
        setIsRecording(false);
        sounds.playSuccessTone();

        const a = document.createElement('a');
        a.href = videoUrl;
        a.download = `tryons_fit_${activeGarment.id}_${Date.now()}.webm`;
        a.click();
      } catch (e) {
        console.error('Stop recording error', e);
        setIsRecording(false);
      }
    }
  };

  return (
    <div className="relative flex flex-col items-center justify-center p-3 sm:p-6 w-full max-w-6xl mx-auto">
      
      {/* Permanent, non-unmounted video element for stable WebRTC stream decoding */}
      <video
        ref={videoRef}
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

      {/* Viewport Frame Container with Drag-and-Drop */}
      <div 
        ref={containerRef}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        className={`relative overflow-hidden rounded-2xl border border-white/10 bg-neutral-950 shadow-2xl transition-all duration-300 w-full aspect-[16/9] ${
          isDragOver ? 'ring-4 ring-cyan-400 border-cyan-400' : ''
        }`}
      >
        <canvas ref={rawCanvasRef} className="hidden" />
        <canvas ref={canvasRef} className="h-full w-full object-contain cursor-crosshair" />

        {flashEffect && (
          <div className="absolute inset-0 bg-white opacity-80 z-30 pointer-events-none transition-opacity duration-200" />
        )}

        {/* Drag Over Overlay */}
        {isDragOver && (
          <div className="absolute inset-0 bg-cyan-950/60 backdrop-blur-sm z-30 flex flex-col items-center justify-center pointer-events-none">
            <Upload className="h-12 w-12 text-cyan-400 animate-bounce mb-2" />
            <span className="text-base font-bold text-white">DROP IMAGE TO WEAR INSTANTLY</span>
          </div>
        )}

        {/* Top Overlay */}
        <div className="absolute top-4 left-4 right-4 flex items-center justify-between pointer-events-none z-20">
          <div className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-black/70 px-3.5 py-1.5 backdrop-blur-md pointer-events-auto">
            <div className="h-3.5 w-3.5 rounded-full" style={{ backgroundColor: activeGarment.color }} />
            <div>
              <span className="font-display text-xs font-bold text-white block">{activeGarment.name}</span>
              <span className="text-[10px] text-cyan-400 font-mono">{activeGarment.brand || 'Tryons'} · {activeGarment.category.toUpperCase()}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 pointer-events-auto">
            <select
              value={activeModel.id}
              onChange={(e) => {
                const found = sampleModels.find(m => m.id === e.target.value);
                if (found) {
                  sounds.playClick();
                  onModelChange(found);
                }
              }}
              className="rounded-xl border border-white/10 bg-black/70 px-3 py-1.5 text-xs font-medium text-neutral-200 backdrop-blur-md outline-none focus:border-cyan-500"
            >
              {sampleModels.map((m) => (
                <option key={m.id} value={m.id} className="bg-neutral-900 text-white">
                  {m.id === 'webcam' ? '📹 Live Webcam' : `👗 Demo: ${m.name}`}
                </option>
              ))}
            </select>

            <button
              onClick={() => {
                if (canvasRef.current) {
                  sounds.playSuccessTone();
                  onTriggerNeuralStudio(canvasRef.current.toDataURL('image/jpeg', 0.95));
                }
              }}
              className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-fuchsia-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-lg shadow-cyan-500/20 hover:scale-105 active:scale-95 transition-all"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>AI HD Inpaint</span>
            </button>
          </div>
        </div>

        {/* Bottom Action Controls */}
        <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between pointer-events-none z-20">
          <div className="flex items-center gap-2 pointer-events-auto">
            <button
              onClick={() => {
                sounds.playClick();
                setIsSplitView(!isSplitView);
              }}
              className={`flex h-9 items-center gap-1.5 rounded-xl border px-3 text-xs font-medium backdrop-blur-md ${
                isSplitView ? 'border-cyan-400 bg-cyan-950/80 text-cyan-300' : 'border-white/10 bg-black/60 text-neutral-300'
              }`}
            >
              <SplitSquareVertical className="h-3.5 w-3.5" />
              <span>Split</span>
            </button>
          </div>

          <div className="flex items-center gap-3 pointer-events-auto">
            <button
              onClick={handleTakeSnapshot}
              className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-black shadow-xl hover:scale-110 active:scale-95 transition-all"
            >
              <Camera className="h-5 w-5" />
            </button>

            <button
              onClick={handleToggleRecording}
              className={`flex h-10 items-center gap-2 rounded-full border px-4 text-xs font-bold ${
                isRecording ? 'border-red-500 bg-red-600 text-white animate-pulse' : 'border-white/15 bg-black/70 text-neutral-200'
              }`}
            >
              {isRecording ? <Square className="h-4 w-4 fill-white" /> : <VideoIcon className="h-4 w-4 text-red-500" />}
              <span>{isRecording ? 'Stop' : 'Record'}</span>
            </button>
          </div>

          <div className="flex items-center gap-2 pointer-events-auto">
            <button
              onClick={() => {
                sounds.playClick();
                onOpenFittingPanel();
              }}
              className="flex h-9 items-center gap-1.5 rounded-xl border border-white/10 bg-black/60 px-3 text-xs font-medium text-neutral-200 backdrop-blur-md hover:border-cyan-500/50 hover:text-cyan-300"
            >
              <Sliders className="h-3.5 w-3.5 text-cyan-400" />
              <span>Fit Controls</span>
            </button>
          </div>
        </div>

      </div>

    </div>
  );
};
