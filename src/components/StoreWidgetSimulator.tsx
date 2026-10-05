import React, { useState } from 'react';
import { 
  ShoppingBag, 
  Sparkles, 
  ExternalLink, 
  Camera, 
  Check, 
  Star, 
  ShieldCheck, 
  Zap, 
  Layers,
  ArrowRight,
  Code
} from 'lucide-react';
import { Garment } from '../types';
import { sounds } from '../services/audioEffects';

interface StoreWidgetSimulatorProps {
  garments: Garment[];
  onTryOnInLiveAR: (garment: Garment) => void;
}

export const StoreWidgetSimulator: React.FC<StoreWidgetSimulatorProps> = ({
  garments,
  onTryOnInLiveAR
}) => {
  const [selectedProduct, setSelectedProduct] = useState<Garment>(garments[0]);
  const [selectedSize, setSelectedSize] = useState<string>('M');
  const [copiedCode, setCopiedCode] = useState<boolean>(false);

  const embedSnippet = `<script src="https://tryons.ai/sdk/widget.js" data-shop-id="TRYONS-STORE-01"></script>
<tryons-button 
  product-id="${selectedProduct.id}" 
  product-image="${selectedProduct.thumbnail}" 
  theme="light"
></tryons-button>`;

  const handleCopyCode = () => {
    navigator.clipboard.writeText(embedSnippet);
    setCopiedCode(true);
    sounds.playClick();
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-6 animate-in fade-in duration-300">
      
      {/* Banner Intro */}
      <div className="rounded-3xl border border-black/10 bg-gradient-to-r from-[#eae4f7] via-[#fedfff] to-[#fec6ff] p-6 sm:p-8 mb-8 text-[#170404]">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 mb-2">
              <span className="rounded-md bg-[#170404] px-2.5 py-0.5 font-mono text-[11px] font-bold text-[#fffffc]">
                E-COMMERCE INTEGRATION & EXTENSION
              </span>
              <span className="text-xs text-neutral-600 font-semibold">Tryons Universal Fitting SDK</span>
            </div>
            <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-[#170404] tracking-tight">
              Tryons on Any Fashion Online Store
            </h2>
            <p className="text-sm text-neutral-700 mt-2">
              Tryons powers real-time virtual fitting rooms on Shopify, WooCommerce, Zara, and Farfetch. Customers try on clothes instantly via webcam with zero return friction.
            </p>
          </div>

          <button
            onClick={() => onTryOnInLiveAR(selectedProduct)}
            className="flex items-center gap-2.5 rounded-2xl bg-[#170404] px-6 py-3.5 text-sm font-bold text-[#fffffc] shadow-xl hover:scale-105 active:scale-95 transition-all whitespace-nowrap"
          >
            <Camera className="h-4 w-4 text-[#fec6ff]" />
            <span>Launch Tryons Live Camera</span>
          </button>
        </div>
      </div>

      {/* Interactive Mockup: Luxury Online Store Product Page */}
      <div className="rounded-3xl border border-black/10 bg-white shadow-2xl overflow-hidden mb-10 text-[#170404]">
        
        {/* Mock Browser Header */}
        <div className="flex items-center justify-between border-b border-black/5 bg-[#f3eef4] px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-red-500/80" />
            <div className="h-3 w-3 rounded-full bg-yellow-500/80" />
            <div className="h-3 w-3 rounded-full bg-green-500/80" />
            <span className="ml-3 font-mono text-xs text-neutral-600 hidden sm:inline">
              https://atelier-paris.fashion/products/{selectedProduct.id}
            </span>
          </div>

          {/* Tryons Extension Badge */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 rounded-full border border-black/10 bg-white px-3 py-1 text-[11px] font-bold text-[#170404]">
              <Sparkles className="h-3.5 w-3.5 text-[#c65a92]" />
              <span>Tryons Active</span>
            </div>
          </div>
        </div>

        {/* Store Page Body */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 p-6 sm:p-10">
          
          {/* Left Column: Product Gallery */}
          <div className="md:col-span-6 relative">
            <div className="relative aspect-[3/4] w-full rounded-2xl bg-neutral-100 p-6 flex items-center justify-center border border-black/5 overflow-hidden group">
              <img
                src={selectedProduct.thumbnail}
                alt={selectedProduct.name}
                className="h-full w-full object-contain filter drop-shadow-2xl transition-transform duration-500 group-hover:scale-105"
              />

              {/* Floating Tryons Try-On Button */}
              <div className="absolute bottom-4 inset-x-4">
                <div className="rounded-2xl border border-black/10 bg-white/95 backdrop-blur-md p-3.5 shadow-2xl flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#170404] text-white">
                      <Sparkles className="h-4 w-4 text-[#fec6ff]" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-[#170404] flex items-center gap-1.5">
                        <span>TRY ON YOURSELF LIVE</span>
                        <span className="rounded bg-[#fec6ff] px-1 py-0.2 text-[9px] font-mono text-[#170404] font-bold">TRYONS AR</span>
                      </div>
                      <p className="text-[10px] text-neutral-500">See real-time fit & drape on your webcam</p>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      sounds.playSuccessTone();
                      onTryOnInLiveAR(selectedProduct);
                    }}
                    className="rounded-xl bg-[#170404] text-white px-4 py-2 text-xs font-bold shadow-lg hover:bg-black transition-all flex items-center gap-1.5"
                  >
                    <Camera className="h-3.5 w-3.5 text-[#fec6ff]" />
                    <span>Try On</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Thumbnail mini selector */}
            <div className="flex items-center gap-3 mt-4 overflow-x-auto pb-2">
              {garments.slice(0, 5).map((g) => (
                <button
                  key={g.id}
                  onClick={() => {
                    sounds.playClick();
                    setSelectedProduct(g);
                  }}
                  className={`h-16 w-16 rounded-xl border p-1 bg-neutral-50 flex items-center justify-center transition-all ${
                    selectedProduct.id === g.id
                      ? 'border-black ring-2 ring-black'
                      : 'border-black/10 hover:border-black/30'
                  }`}
                >
                  <img src={g.thumbnail} alt={g.name} className="h-full w-full object-contain" />
                </button>
              ))}
            </div>
          </div>

          {/* Right Column: Product details and Cart */}
          <div className="md:col-span-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-xs font-mono text-neutral-500 mb-1">
                <span>{selectedProduct.brand || 'ATELIER TRYONS'}</span>
                <span className="flex items-center text-amber-500 gap-1">
                  <Star className="h-3.5 w-3.5 fill-amber-500" />
                  <Star className="h-3.5 w-3.5 fill-amber-500" />
                  <Star className="h-3.5 w-3.5 fill-amber-500" />
                  <Star className="h-3.5 w-3.5 fill-amber-500" />
                  <Star className="h-3.5 w-3.5 fill-amber-500" />
                  <span className="text-neutral-500 ml-1">(4.9/5 · 128 reviews)</span>
                </span>
              </div>

              <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#170404] tracking-tight mb-2">
                {selectedProduct.name}
              </h1>

              <div className="text-2xl font-mono font-bold text-[#c65a92] mb-4">
                {selectedProduct.price || '$1,250 USD'}
              </div>

              <p className="text-xs text-neutral-600 leading-relaxed mb-6">
                {selectedProduct.description} Crafted with ultra-luxurious drape characteristics and precision-tailored silhouette lines.
              </p>

              {/* Size Selector */}
              <div className="mb-6">
                <div className="flex justify-between text-xs font-medium text-neutral-700 mb-2">
                  <span>SELECT SIZE</span>
                  <span className="text-[#c65a92] font-semibold cursor-pointer hover:underline" onClick={() => onTryOnInLiveAR(selectedProduct)}>
                    ⚡ Check Fit in Tryons AR
                  </span>
                </div>
                <div className="flex gap-2">
                  {['XS', 'S', 'M', 'L', 'XL'].map((sz) => (
                    <button
                      key={sz}
                      onClick={() => {
                        sounds.playClick();
                        setSelectedSize(sz);
                      }}
                      className={`h-10 w-12 rounded-xl border text-xs font-bold transition-all ${
                        selectedSize === sz
                          ? 'border-black bg-[#170404] text-white'
                          : 'border-black/10 bg-neutral-50 text-neutral-600 hover:text-black'
                      }`}
                    >
                      {sz}
                    </button>
                  ))}
                </div>
              </div>

              {/* Buy Actions */}
              <div className="space-y-3">
                <button
                  onClick={() => {
                    sounds.playSuccessTone();
                    onTryOnInLiveAR(selectedProduct);
                  }}
                  className="w-full flex items-center justify-center gap-2 rounded-2xl bg-[#170404] py-3.5 text-sm font-bold text-[#fffffc] shadow-xl hover:scale-[1.01] active:scale-[0.99] transition-all"
                >
                  <Sparkles className="h-4 w-4 text-[#fec6ff]" />
                  <span>Try On with Live Camera (Tryons)</span>
                </button>

                <button
                  onClick={() => sounds.playClick()}
                  className="w-full flex items-center justify-center gap-2 rounded-2xl border border-black/15 bg-neutral-50 py-3.5 text-sm font-semibold text-[#170404] hover:bg-neutral-100 transition-colors"
                >
                  <ShoppingBag className="h-4 w-4" />
                  <span>Add to Shopping Bag</span>
                </button>
              </div>

              {/* Perks */}
              <div className="grid grid-cols-2 gap-3 mt-6 pt-6 border-t border-black/10 text-xs text-neutral-600">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-emerald-600" />
                  <span>Guaranteed True-to-Body Fit</span>
                </div>
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-[#c65a92]" />
                  <span>Instant 40ms Live Fitting</span>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Embed Code Developer Documentation */}
      <div className="rounded-3xl border border-black/10 bg-white p-6 sm:p-8 text-[#170404]">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#170404] text-white">
              <Code className="h-4 w-4" />
            </div>
            <div>
              <h3 className="font-display text-sm font-bold text-[#170404]">Embed on Your Store in 1 Line of Code</h3>
              <p className="text-[11px] text-neutral-500">Add the Tryons live try-on widget to Shopify, Next.js, or HTML</p>
            </div>
          </div>

          <button
            onClick={handleCopyCode}
            className="flex items-center gap-1.5 rounded-xl border border-black/10 bg-neutral-100 px-3 py-1.5 text-xs font-semibold text-[#170404] hover:bg-neutral-200 transition-colors"
          >
            {copiedCode ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Code className="h-3.5 w-3.5" />}
            <span>{copiedCode ? 'Copied!' : 'Copy Embed Code'}</span>
          </button>
        </div>

        <pre className="rounded-2xl border border-black/5 bg-[#170404] p-4 font-mono text-xs text-[#fec6ff] overflow-x-auto">
          <code>{embedSnippet}</code>
        </pre>
      </div>

    </div>
  );
};
