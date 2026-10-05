import React, { useState } from 'react';
import { 
  Sparkles, 
  Upload, 
  Search, 
  Wand2, 
  Tag, 
  Check, 
  Plus, 
  Flame,
  Shirt,
  Sparkle
} from 'lucide-react';
import { Garment, GarmentCategory } from '../types';
import { sounds } from '../services/audioEffects';
import { aiTryonEngine } from '../services/aiTryonEngine';

interface WardrobeDrawerProps {
  garments: Garment[];
  activeGarment: Garment;
  onSelectGarment: (garment: Garment) => void;
  onAddCustomGarment: (garment: Garment) => void;
}

export const WardrobeDrawer: React.FC<WardrobeDrawerProps> = ({
  garments,
  activeGarment,
  onSelectGarment,
  onAddCustomGarment
}) => {
  const [activeCategory, setActiveCategory] = useState<GarmentCategory>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [aiPrompt, setAiPrompt] = useState<string>('');
  const [isGeneratingAi, setIsGeneratingAi] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'closet' | 'upload' | 'ai_generate'>('closet');

  const categories: { id: GarmentCategory; label: string; icon: string }[] = [
    { id: 'all', label: 'All Garments', icon: '✨' },
    { id: 'gowns', label: 'Haute Couture', icon: '👑' },
    { id: 'dresses', label: 'Dresses & Midi', icon: '👗' },
    { id: 'cyber', label: 'Cyber & Sci-Fi', icon: '⚡' },
    { id: 'formal', label: 'Suits & Blazers', icon: '👔' },
    { id: 'streetwear', label: 'Streetwear', icon: '🔥' },
    { id: 'jackets', label: 'Denim & Leather', icon: '🧥' },
  ];

  const filteredGarments = garments.filter((g) => {
    const matchesCat = activeCategory === 'all' || g.category === activeCategory;
    const matchesSearch = 
      g.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      g.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (g.brand && g.brand.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCat && matchesSearch;
  });

  // Handle Custom File Upload with automatic background removal
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    sounds.playClick();

    const reader = new FileReader();
    reader.onload = async (event) => {
      const rawUrl = event.target?.result as string;
      try {
        // Automatic AI background removal
        const cleanPngUrl = await aiTryonEngine.removeBackgroundFromImage(rawUrl);

        const newGarment: Garment = {
          id: `custom_${Date.now()}`,
          name: file.name.replace(/\.[^/.]+$/, "").slice(0, 24) || 'Custom Uploaded Dress',
          category: 'dresses',
          brand: 'Custom Wardrobe',
          color: '#00f2fe',
          description: 'Uploaded custom garment with automatic transparent chroma cutout.',
          thumbnail: cleanPngUrl,
          renderType: 'image',
          defaultScale: 1.0,
          anchorOffset: { x: 0, y: -10 },
          aspectRatio: 1,
          torsoCoverage: 1.5,
          shoulderSpanRatio: 1.15,
          isCustom: true,
          tags: ['Custom', 'User Upload']
        };

        onAddCustomGarment(newGarment);
        onSelectGarment(newGarment);
        sounds.playSuccessTone();
        setActiveTab('closet');
      } catch (err) {
        console.error('Failed to process custom garment', err);
      } finally {
        setIsUploading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  // Handle AI Outfit Generation from Prompt
  const handleGenerateAiGarment = () => {
    if (!aiPrompt.trim()) return;

    setIsGeneratingAi(true);
    sounds.playClick();

    setTimeout(() => {
      const colors = ['#f43f5e', '#a855f7', '#06b6d4', '#10b981', '#f59e0b', '#ec4899'];
      const randomColor = colors[Math.floor(Math.random() * colors.length)];

      const aiSvg = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 600" width="400" height="600">
        <defs>
          <linearGradient id="aiGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="${randomColor}" />
            <stop offset="100%" stop-color="#000000" />
          </linearGradient>
        </defs>
        <path d="M 110 40 C 150 70, 250 70, 290 40 C 310 90, 310 160, 290 240 C 330 360, 380 500, 390 600 L 10 600 C 20 500, 70 360, 110 240 C 90 160, 90 90, 110 40 Z" fill="url(#aiGrad)" stroke="#00f2fe" stroke-width="2"/>
        <text x="200" y="320" font-family="'Space Grotesk', sans-serif" font-size="16" font-weight="bold" fill="#ffffff" text-anchor="middle">AI SYNTHESIZED</text>
        <text x="200" y="350" font-family="'JetBrains Mono', monospace" font-size="12" fill="#00f2fe" text-anchor="middle">${aiPrompt.slice(0, 22)}</text>
      </svg>`;

      const newGarment: Garment = {
        id: `ai_${Date.now()}`,
        name: aiPrompt.slice(0, 28) || 'AI Generated Gown',
        category: 'cyber',
        brand: 'Decart AI Synthesis',
        price: 'AI MINTED',
        color: randomColor,
        description: `Generated from prompt: "${aiPrompt}"`,
        thumbnail: `data:image/svg+xml;utf8,${encodeURIComponent(aiSvg)}`,
        renderType: 'vector_cloth',
        texturePattern: 'holographic',
        defaultScale: 1.05,
        anchorOffset: { x: 0, y: -15 },
        aspectRatio: 400 / 600,
        torsoCoverage: 1.6,
        shoulderSpanRatio: 1.2,
        isCustom: true,
        tags: ['AI Generated', 'Custom Prompt']
      };

      onAddCustomGarment(newGarment);
      onSelectGarment(newGarment);
      setIsGeneratingAi(false);
      setAiPrompt('');
      setActiveTab('closet');
      sounds.playSuccessTone();
    }, 1200);
  };

  return (
    <section className="w-full max-w-6xl mx-auto px-4 sm:px-6 mb-12">
      
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-display text-xl font-bold tracking-tight text-white flex items-center gap-2">
              <Shirt className="h-5 w-5 text-cyan-400" />
              DIGITAL WARDROBE & LIVE OUTFIT SELECTOR
            </h2>
            <span className="rounded-full bg-cyan-500/10 border border-cyan-500/30 px-2.5 py-0.5 text-xs font-mono font-medium text-cyan-400">
              {garments.length} Available Fits
            </span>
          </div>
          <p className="text-xs text-neutral-400 mt-1">
            Select any dress or drag-and-drop any garment image to see it rendered onto your live body feed in real time.
          </p>
        </div>

        {/* Tab switcher: Closet / Custom Upload / AI Generator */}
        <div className="flex items-center rounded-xl border border-white/10 bg-neutral-900/80 p-1">
          <button
            onClick={() => {
              sounds.playClick();
              setActiveTab('closet');
            }}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
              activeTab === 'closet'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Sparkle className="h-3.5 w-3.5" />
            <span>Catalog</span>
          </button>

          <button
            onClick={() => {
              sounds.playClick();
              setActiveTab('upload');
            }}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
              activeTab === 'upload'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Upload className="h-3.5 w-3.5" />
            <span>Upload Fit</span>
          </button>

          <button
            onClick={() => {
              sounds.playClick();
              setActiveTab('ai_generate');
            }}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
              activeTab === 'ai_generate'
                ? 'bg-fuchsia-500/20 text-fuchsia-300 border border-fuchsia-500/40 shadow-sm'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Wand2 className="h-3.5 w-3.5 text-fuchsia-400" />
            <span>AI Synthesizer</span>
          </button>
        </div>
      </div>

      {/* TAB 1: CLOSET & CATALOG */}
      {activeTab === 'closet' && (
        <div className="space-y-4">
          
          {/* Categories & Search */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 overflow-x-auto w-full pb-1 no-scrollbar">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => {
                    sounds.playClick();
                    setActiveCategory(cat.id);
                  }}
                  className={`flex items-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-1.5 text-xs font-medium transition-all ${
                    activeCategory === cat.id
                      ? 'bg-white text-black font-bold shadow-lg shadow-white/10'
                      : 'border border-white/5 bg-neutral-900/60 text-neutral-400 hover:border-white/20 hover:text-white'
                  }`}
                >
                  <span>{cat.icon}</span>
                  <span>{cat.label}</span>
                </button>
              ))}
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search gowns, silk, denim..."
                className="w-full rounded-xl border border-white/10 bg-neutral-900/80 py-1.5 pl-9 pr-3 text-xs text-white placeholder:text-neutral-500 outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          {/* Garment Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5">
            {filteredGarments.map((garment) => {
              const isSelected = activeGarment.id === garment.id;

              return (
                <div
                  key={garment.id}
                  onClick={() => {
                    sounds.playClick();
                    onSelectGarment(garment);
                  }}
                  className={`group relative flex flex-col rounded-2xl border p-3 cursor-pointer transition-all duration-200 overflow-hidden ${
                    isSelected
                      ? 'border-cyan-400 bg-cyan-950/20 shadow-lg shadow-cyan-500/10 ring-2 ring-cyan-400/40'
                      : 'border-white/10 bg-neutral-900/40 hover:border-white/25 hover:bg-neutral-900/70 hover:scale-[1.02]'
                  }`}
                >
                  {/* Selected Badge */}
                  {isSelected && (
                    <div className="absolute top-2 right-2 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-cyan-400 text-black shadow-md shadow-cyan-400/50">
                      <Check className="h-3.5 w-3.5 stroke-[3]" />
                    </div>
                  )}

                  {/* Thumbnail Stage */}
                  <div className="relative aspect-[3/4] w-full rounded-xl bg-gradient-to-b from-neutral-800/40 to-neutral-950/80 flex items-center justify-center p-2 mb-2.5 overflow-hidden group-hover:from-neutral-800/60">
                    <img
                      src={garment.thumbnail}
                      alt={garment.name}
                      className="h-full w-full object-contain filter drop-shadow-xl transition-transform duration-300 group-hover:scale-105"
                    />
                    {/* Hover Try-On Quick Pill */}
                    <div className="absolute inset-x-2 bottom-2 py-1.5 rounded-lg bg-cyan-500/90 text-black text-center text-[10px] font-bold opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm">
                      TRY ON LIVE
                    </div>
                  </div>

                  {/* Card Details */}
                  <div className="flex flex-col flex-1 justify-between">
                    <div>
                      <div className="flex items-center justify-between text-[10px] font-mono text-neutral-400 mb-0.5">
                        <span className="truncate">{garment.brand || 'Decart'}</span>
                        <span className="text-cyan-400 font-semibold">{garment.price || 'FREE'}</span>
                      </div>
                      <h3 className="font-display text-xs font-bold text-white line-clamp-1 group-hover:text-cyan-300 transition-colors">
                        {garment.name}
                      </h3>
                    </div>

                    {/* Tags */}
                    <div className="flex items-center gap-1 mt-2 flex-wrap">
                      {garment.tags.slice(0, 2).map((tag, idx) => (
                        <span key={idx} className="rounded-md border border-white/5 bg-white/5 px-1.5 py-0.5 text-[9px] text-neutral-400">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

        </div>
      )}

      {/* TAB 2: CUSTOM GARMENT UPLOADER */}
      {activeTab === 'upload' && (
        <div className="rounded-2xl border border-white/10 bg-neutral-900/40 p-6 sm:p-8 backdrop-blur-md">
          <div className="max-w-xl mx-auto text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-500/30 bg-cyan-950/40 text-cyan-400 mb-4 shadow-lg shadow-cyan-500/10">
              <Upload className="h-7 w-7" />
            </div>
            
            <h3 className="font-display text-lg font-bold text-white mb-1">
              Upload Any Garment to Try On Live
            </h3>
            <p className="text-xs text-neutral-400 mb-6">
              Drop any photo or screenshot of a dress, jacket, shirt, or saree from Zara, ASOS, or Pinterest. Our AI will automatically isolate the fabric and fit it to your camera feed.
            </p>

            <label className="relative flex flex-col items-center justify-center border-2 border-dashed border-cyan-500/40 rounded-2xl p-8 hover:border-cyan-400 transition-colors cursor-pointer bg-cyan-950/10 hover:bg-cyan-950/20">
              <input
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                disabled={isUploading}
                className="hidden"
              />
              <div className="flex flex-col items-center gap-2">
                <Shirt className="h-8 w-8 text-cyan-400 animate-bounce" />
                <span className="text-xs font-bold text-cyan-300">
                  {isUploading ? 'Extracting Fabric & Calibrating Mesh...' : 'Click or Drag & Drop Garment Photo (PNG, JPG, WebP)'}
                </span>
                <span className="text-[10px] text-neutral-400 font-mono">
                  AUTOMATIC AI BACKGROUND REMOVAL INCLUDED
                </span>
              </div>
            </label>
          </div>
        </div>
      )}

      {/* TAB 3: AI SYNTHESIS PROMPT GENERATOR */}
      {activeTab === 'ai_generate' && (
        <div className="rounded-2xl border border-fuchsia-500/20 bg-neutral-900/40 p-6 sm:p-8 backdrop-blur-md">
          <div className="max-w-xl mx-auto">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-fuchsia-950/60 border border-fuchsia-500/40 text-fuchsia-400">
                <Wand2 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-display text-base font-bold text-white">AI Outfit Synthesizer</h3>
                <p className="text-xs text-neutral-400">Describe any fantasy garment, haute couture design, or futuristic armor.</p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="relative">
                <textarea
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  placeholder="e.g. Holographic iridescent runway dress with glowing cyber circuits and translucent shoulder veil..."
                  rows={3}
                  className="w-full rounded-xl border border-white/10 bg-black/60 p-3 text-xs text-white placeholder:text-neutral-500 outline-none focus:border-fuchsia-500"
                />
              </div>

              {/* Sample Prompts */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] text-neutral-400 font-mono">Presets:</span>
                {[
                  'Liquid gold metallic blazer',
                  'Cyberpunk neon pink trench coat',
                  'Emerald silk imperial gown'
                ].map((preset, idx) => (
                  <button
                    key={idx}
                    onClick={() => setAiPrompt(preset)}
                    className="rounded-lg border border-white/5 bg-white/5 px-2 py-1 text-[10px] text-neutral-300 hover:text-fuchsia-300 hover:border-fuchsia-500/30"
                  >
                    {preset}
                  </button>
                ))}
              </div>

              <button
                onClick={handleGenerateAiGarment}
                disabled={isGeneratingAi || !aiPrompt.trim()}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-500 to-pink-600 py-2.5 text-xs font-bold text-white shadow-lg shadow-fuchsia-500/20 hover:from-fuchsia-400 hover:to-pink-500 disabled:opacity-50 transition-all"
              >
                {isGeneratingAi ? (
                  <>
                    <Sparkles className="h-4 w-4 animate-spin" />
                    <span>Synthesizing World Model Garment...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    <span>Synthesize & Wear Garment Now</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </section>
  );
};
