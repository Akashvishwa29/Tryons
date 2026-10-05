import React, { useState } from 'react';
import { 
  X, 
  Download, 
  Trash2, 
  Layers, 
  Share2, 
  Sparkles, 
  Image as ImageIcon,
  ExternalLink
} from 'lucide-react';
import { SnapshotItem } from '../types';
import { sounds } from '../services/audioEffects';
import { recorderService } from '../services/recorder';

interface SnapshotGalleryModalProps {
  isOpen: boolean;
  onClose: () => void;
  snapshots: SnapshotItem[];
  onDeleteSnapshot: (id: string) => void;
  onClearAll: () => void;
}

export const SnapshotGalleryModal: React.FC<SnapshotGalleryModalProps> = ({
  isOpen,
  onClose,
  snapshots,
  onDeleteSnapshot,
  onClearAll
}) => {
  const [activeItem, setActiveItem] = useState<SnapshotItem | null>(null);

  if (!isOpen) return null;

  const handleDownloadSingle = (snap: SnapshotItem) => {
    sounds.playClick();
    const a = document.createElement('a');
    a.href = snap.imageUrl;
    a.download = `anywear_look_${snap.id}.jpg`;
    a.click();
  };

  const handleGenerateCollage = async (snap: SnapshotItem) => {
    if (!snap.beforeImageUrl) return;
    sounds.playClick();
    try {
      const collageUrl = await recorderService.createComparisonCollage(
        snap.beforeImageUrl,
        snap.imageUrl,
        snap.garmentName
      );
      const a = document.createElement('a');
      a.href = collageUrl;
      a.download = `anywear_comparison_${snap.id}.jpg`;
      a.click();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 sm:p-6 animate-in fade-in duration-200">
      <div 
        className="w-full max-w-5xl h-full max-h-[90vh] flex flex-col rounded-3xl border border-white/10 bg-[#0c0c16] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 p-5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-fuchsia-950/60 border border-fuchsia-500/30 text-fuchsia-400">
              <ImageIcon className="h-4 w-4" />
            </div>
            <div>
              <h3 className="font-display text-base font-bold text-white">Your Virtual Fitting Studio Looks</h3>
              <p className="text-[10px] font-mono text-neutral-400">{snapshots.length} CAPTURED OUTFIT SNAPS</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {snapshots.length > 0 && (
              <button
                onClick={() => {
                  sounds.playClick();
                  onClearAll();
                }}
                className="flex items-center gap-1 rounded-xl border border-red-500/30 bg-red-950/40 px-3 py-1.5 text-xs font-semibold text-red-300 hover:bg-red-900/50"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Clear All</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-neutral-900 text-neutral-400 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          {snapshots.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-neutral-900/50 text-neutral-500 mb-3">
                <Sparkles className="h-8 w-8" />
              </div>
              <h4 className="font-display text-base font-bold text-white mb-1">No Try-On Snaps Yet</h4>
              <p className="text-xs text-neutral-400 max-w-sm">
                Press the shutter button on the camera stream or generate an AI virtual fit to store your lookbook here.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {snapshots.map((snap) => (
                <div
                  key={snap.id}
                  className="group relative rounded-2xl border border-white/10 bg-neutral-900/50 overflow-hidden flex flex-col justify-between hover:border-cyan-500/40 transition-all shadow-xl"
                >
                  {/* Image Stage */}
                  <div className="relative aspect-[3/4] w-full bg-black">
                    <img
                      src={snap.imageUrl}
                      alt={snap.garmentName}
                      className="h-full w-full object-cover"
                    />

                    {/* Badge Mode */}
                    <div className="absolute top-3 left-3">
                      <span className="rounded-md border border-black/40 bg-black/70 px-2 py-0.5 font-mono text-[9px] font-bold text-cyan-300 backdrop-blur-md">
                        {snap.mode === 'neural_snap' ? 'AI NEURAL FIT' : 'LIVE AR CAPTURE'}
                      </span>
                    </div>

                    {/* Delete Quick Button */}
                    <button
                      onClick={() => {
                        sounds.playClick();
                        onDeleteSnapshot(snap.id);
                      }}
                      className="absolute top-3 right-3 flex h-7 w-7 items-center justify-center rounded-lg bg-black/70 text-neutral-400 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-md"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {/* Details and Actions */}
                  <div className="p-3.5">
                    <div className="flex items-center justify-between text-[10px] font-mono text-neutral-400 mb-1">
                      <span>{new Date(snap.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      <span className="text-cyan-400">{snap.garmentName.slice(0, 18)}</span>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={() => handleDownloadSingle(snap)}
                        className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-white text-black py-2 text-xs font-bold hover:bg-neutral-200 transition-colors"
                      >
                        <Download className="h-3.5 w-3.5" />
                        <span>Download</span>
                      </button>

                      {snap.beforeImageUrl && (
                        <button
                          onClick={() => handleGenerateCollage(snap)}
                          title="Download Side-by-Side Comparison Collage"
                          className="flex items-center justify-center gap-1.5 rounded-xl border border-cyan-500/30 bg-cyan-950/40 px-3 py-2 text-xs font-semibold text-cyan-300 hover:bg-cyan-900/40"
                        >
                          <Layers className="h-3.5 w-3.5" />
                          <span>Split Card</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
