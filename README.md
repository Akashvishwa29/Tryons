# AnyWear Live — Real-Time AI Live Dress & Outfit Change

An ultra-fast, real-time AI live dress and outfit changing studio inspired by **[Anywear by Decart AI](https://anywear.decart.ai/)**. It enables live webcam body tracking, dynamic cloth mesh warping with physics sway, instant dress swapping, high-resolution generative virtual fitting, and e-commerce widget integration.

---

## ⚡ Key Highlights & Features

1. **Live Real-Time AR Dress Swap (30–60 FPS, ~35ms Latency):**
   - **Body & Pose Landmark Tracking**: Full 33-keypoint body tracking (neck, shoulders, chest, elbows, wrists, hips, knees) with anti-jitter smoothing filter.
   - **Bézier Cloth Warping Engine**: Dynamic 2D/3D affine transformation adapting to shoulder slant, spine curvature, and torso roll.
   - **Dynamic Spring-Mass Cloth Physics**: Real-time fabric inertia, walking sway, and breathing expansion.
   - **Split-Screen Comparison**: Vertical before/after interactive slider bar to inspect the fit against original clothing in real time.

2. **Decart-Style Generative AI Virtual Snap Studio:**
   - Capture high-resolution frames or upload portrait photos.
   - Generative virtual fitting with lighting matching, skin tone harmonization, and shadow occlusion.
   - Multi-style presets: *Editorial Studio*, *Paris Runway Catwalk*, *Cyberpunk Neon*, *Gala Red Carpet*, *Golden Hour Sunset*.
   - Custom style prompt synthesizer for designing fantasy garments.

3. **Digital Wardrobe & Custom Garment Uploader:**
   - 30+ pre-built high-fashion dresses, evening gowns, jackets, blazers, streetwear hoodies, and cyberpunk outfits.
   - **Drag-and-Drop / Image Upload**: Upload any garment photo or drop from an online store; automatic client-side chroma background removal isolates the fabric.
   - **AI Outfit Prompt Synthesizer**: Generate and wear custom garments on demand.

4. **Real-Time Fabric & Shader Customizer:**
   - Sliders for shoulder span width, torso drop length, collar offset, and drape tightness.
   - Fabric finish shaders: *Lustrous Silk Sheen*, *Deep Velvet*, *Metallic Liquid Foil*, *Holographic Iridescent*, *Cyber Neon Glow*.
   - HUD diagnostics: Skeleton keypoints, mesh wireframes, target bounding box, laser sweep beam.

5. **HD Video Recording & Snapshot Gallery:**
   - Record try-on video clips (MediaRecorder WebM/MP4) with live timer.
   - 1-click snapshot capture with shutter sound and confetti feedback.
   - Auto-generated side-by-side Before/After collage cards for social sharing.

6. **"Anywear Everywhere" Store Widget & Chrome Extension Simulator:**
   - Interactive demo showing how Anywear embeds on Shopify, Zara, and Farfetch product pages with a floating "Try On in Live AR" button.

---

## 🚀 Running Locally

```bash
cd /Users/av/.gemini/antigravity/scratch/anywear-live
npm install
npm run dev
```

Open **http://localhost:3000** in your browser.
