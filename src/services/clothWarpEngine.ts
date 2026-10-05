import { BodyLandmarks, FittingSettings, Garment } from '../types';

export class ClothWarpEngine {
  private imageCache: Map<string, HTMLImageElement> = new Map();
  private prevCenterX = 0.5;
  private swayVelocity = 0;
  private swayDisplacement = 0;
  private timeStep = 0;

  public preloadGarment(garment: Garment): Promise<HTMLImageElement> {
    return new Promise((resolve) => {
      const existing = this.imageCache.get(garment.thumbnail);
      if (existing && existing.complete && existing.naturalWidth > 0) {
        resolve(existing);
        return;
      }

      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        this.imageCache.set(garment.thumbnail, img);
        resolve(img);
      };
      img.onerror = () => {
        this.imageCache.set(garment.thumbnail, img);
        resolve(img);
      };
      img.src = garment.thumbnail;
    });
  }

  // 3D Anatomical Realistic Cloth Fitting Engine
  public render(
    ctx: CanvasRenderingContext2D,
    canvasWidth: number,
    canvasHeight: number,
    landmarks: BodyLandmarks,
    garment: Garment,
    settings: FittingSettings,
    options?: { splitRatio?: number; isMirrored?: boolean; sourceVideo?: HTMLVideoElement }
  ) {
    if (!landmarks || landmarks.confidence < 0.2) return;

    this.timeStep += 0.04;

    // 1. Joint Pixel Coordinates from normalized MediaPipe landmarks
    const lsX = landmarks.leftShoulder.x * canvasWidth;
    const lsY = landmarks.leftShoulder.y * canvasHeight;
    const rsX = landmarks.rightShoulder.x * canvasWidth;
    const rsY = landmarks.rightShoulder.y * canvasHeight;

    const lhX = (landmarks.leftHip?.x ?? landmarks.leftShoulder.x) * canvasWidth;
    const lhY = (landmarks.leftHip?.y ?? landmarks.leftShoulder.y + 0.38) * canvasHeight;
    const rhX = (landmarks.rightHip?.x ?? landmarks.rightShoulder.x) * canvasWidth;
    const rhY = (landmarks.rightHip?.y ?? landmarks.rightShoulder.y + 0.38) * canvasHeight;

    const noseX = (landmarks.nose?.x ?? 0.5) * canvasWidth;
    const noseY = (landmarks.nose?.y ?? 0.2) * canvasHeight;

    const neckX = (lsX + rsX) / 2;
    const neckY = (lsY + rsY) / 2;

    // Shoulder Geometry
    const shoulderDx = lsX - rsX;
    const shoulderDy = lsY - rsY;
    const shoulderWidth = Math.max(80, Math.sqrt(shoulderDx * shoulderDx + shoulderDy * shoulderDy));
    const shoulderAngle = Math.atan2(shoulderDy, shoulderDx);

    const hipCenterX = (lhX + rhX) / 2;
    const hipCenterY = (lhY + rhY) / 2;
    const torsoLength = Math.max(100, Math.sqrt(Math.pow(hipCenterX - neckX, 2) + Math.pow(hipCenterY - neckY, 2)));

    // 2. Physics dynamic sway & breathing expansion
    const currentNormX = (landmarks.leftShoulder.x + landmarks.rightShoulder.x) / 2;
    const lateralSpeed = (currentNormX - this.prevCenterX) * 60;
    this.prevCenterX = currentNormX;

    const springK = 0.15;
    const damping = 0.85;
    const force = -lateralSpeed * 18 * settings.physicsSway - springK * this.swayDisplacement;
    this.swayVelocity = (this.swayVelocity + force) * damping;
    this.swayDisplacement += this.swayVelocity;

    const maxSway = shoulderWidth * 0.2 * settings.physicsSway;
    this.swayDisplacement = Math.max(-maxSway, Math.min(maxSway, this.swayDisplacement));

    // 3. Garment Dimensions precisely tailored to shoulder width & torso length
    const garmentWidth = shoulderWidth * (garment.shoulderSpanRatio || 1.35) * settings.shoulderScale;
    const garmentHeight = torsoLength * (garment.torsoCoverage || 1.34) * settings.torsoLength;

    // Collar positioning: Aligns the top collar opening right below the chin/neck
    const anchorY = neckY - (garmentHeight * 0.16) + settings.verticalOffset + (garment.anchorOffset?.y || 0);
    const anchorX = neckX + settings.horizontalOffset + (garment.anchorOffset?.x || 0);

    ctx.save();

    // Split-view clipping if enabled
    if (options?.splitRatio !== undefined && options.splitRatio < 1.0) {
      ctx.beginPath();
      ctx.rect(0, 0, canvasWidth * options.splitRatio, canvasHeight);
      ctx.clip();
    }

    // Color tuning filters
    if (settings.hueShift !== 0 || settings.saturation !== 1 || settings.brightness !== 1) {
      ctx.filter = `hue-rotate(${settings.hueShift}deg) saturate(${settings.saturation * 100}%) brightness(${settings.brightness * 100}%)`;
    }

    ctx.globalAlpha = 1.0;
    ctx.globalCompositeOperation = 'source-over';

    let img = this.imageCache.get(garment.thumbnail);
    if (!img) {
      img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = garment.thumbnail;
      this.imageCache.set(garment.thumbnail, img);
    }

    if (img && img.complete && img.naturalWidth > 0) {
      ctx.save();

      // Step 1: Translate to Neck/Collar Anchor
      ctx.translate(anchorX, anchorY);

      // Step 2: Rotate with Torso & Shoulder Slant
      ctx.rotate(shoulderAngle);

      // Step 3: Natural cloth shear based on physical movement
      const shearAngle = this.swayDisplacement / garmentHeight;
      ctx.transform(1, 0, shearAngle, 1, 0, 0);

      // Step 4: Soft Realistic Body & Under-Collar Contact Shadow
      ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
      ctx.shadowBlur = 18;
      ctx.shadowOffsetY = 8;

      const drawX = -garmentWidth / 2;
      const drawY = 0;

      // Draw the official transparent photorealistic garment
      ctx.drawImage(img, drawX, drawY, garmentWidth, garmentHeight);

      // Step 5: 3D Cylindrical Torso Lighting Volume Shading
      const volumeGrad = ctx.createLinearGradient(drawX, drawY, drawX + garmentWidth, drawY);
      volumeGrad.addColorStop(0, 'rgba(0, 0, 0, 0.22)'); // Left armpit shade
      volumeGrad.addColorStop(0.2, 'rgba(0, 0, 0, 0.0)');
      volumeGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.14)'); // Chest specular light
      volumeGrad.addColorStop(0.8, 'rgba(0, 0, 0, 0.0)');
      volumeGrad.addColorStop(1, 'rgba(0, 0, 0, 0.22)'); // Right armpit shade

      ctx.fillStyle = volumeGrad;
      ctx.globalCompositeOperation = 'multiply';
      ctx.fillRect(drawX, drawY, garmentWidth, garmentHeight);

      // Step 6: Collar Depth Ambient Occlusion
      const collarShade = ctx.createLinearGradient(drawX, drawY, drawX, drawY + 45);
      collarShade.addColorStop(0, 'rgba(0, 0, 0, 0.35)');
      collarShade.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = collarShade;
      ctx.fillRect(drawX, drawY, garmentWidth, 45);

      ctx.restore();

      // Step 7: Natural Head & Neck Skin Overlay (Crucial: Keeps the user's real face, chin, and neck in front of the collar!)
      if (options?.sourceVideo && options.sourceVideo.readyState >= 2) {
        this.renderHeadAndNeckOverlay(ctx, options.sourceVideo, canvasWidth, canvasHeight, noseX, noseY, neckX, neckY, shoulderWidth, options.isMirrored);
      }
    }

    ctx.restore();

    // Debug skeleton if toggled
    if (settings.showSkeletonDebug) {
      this.renderSkeleton(ctx, canvasWidth, canvasHeight, landmarks);
    }
  }

  // Preserves the user's real face, chin, and neck contour in front of the collar opening
  private renderHeadAndNeckOverlay(
    ctx: CanvasRenderingContext2D,
    video: HTMLVideoElement,
    w: number,
    h: number,
    noseX: number,
    noseY: number,
    neckX: number,
    neckY: number,
    shoulderWidth: number,
    isMirrored = true
  ) {
    ctx.save();

    // Head / Neck clipping ellipse centered on the user's face and upper neck
    const headRadiusX = shoulderWidth * 0.38;
    const headCenterY = (noseY + neckY) / 2 - 10;
    const headRadiusY = Math.max(50, (neckY - noseY) * 1.35 + 20);

    ctx.beginPath();
    ctx.ellipse(neckX, headCenterY, headRadiusX, headRadiusY, 0, 0, Math.PI * 2);
    ctx.clip();

    // Re-draw real face/neck from video
    if (isMirrored) {
      ctx.translate(w, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(video, 0, 0, w, h);
    } else {
      ctx.drawImage(video, 0, 0, w, h);
    }

    ctx.restore();

    // Soft Chin Drop-Shadow onto the open collar
    ctx.save();
    const chinShadowY = neckY - 8;
    const chinShadow = ctx.createRadialGradient(neckX, chinShadowY, 5, neckX, chinShadowY + 25, headRadiusX * 0.9);
    chinShadow.addColorStop(0, 'rgba(0, 0, 0, 0.4)');
    chinShadow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = chinShadow;
    ctx.beginPath();
    ctx.ellipse(neckX, chinShadowY + 12, headRadiusX * 0.85, 20, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private renderSkeleton(ctx: CanvasRenderingContext2D, w: number, h: number, lm: BodyLandmarks) {
    ctx.save();
    ctx.strokeStyle = '#c65a92';
    ctx.lineWidth = 2;
    ctx.fillStyle = '#ffffff';

    const drawLine = (p1?: { x: number; y: number }, p2?: { x: number; y: number }) => {
      if (!p1 || !p2) return;
      ctx.beginPath();
      ctx.moveTo(p1.x * w, p1.y * h);
      ctx.lineTo(p2.x * w, p2.y * h);
      ctx.stroke();
    };

    const drawPt = (p?: { x: number; y: number }) => {
      if (!p) return;
      ctx.beginPath();
      ctx.arc(p.x * w, p.y * h, 4, 0, Math.PI * 2);
      ctx.fill();
    };

    drawLine(lm.leftShoulder, lm.rightShoulder);
    drawLine(lm.leftShoulder, lm.leftElbow);
    drawLine(lm.leftElbow, lm.leftWrist);
    drawLine(lm.rightShoulder, lm.rightElbow);
    drawLine(lm.rightElbow, lm.rightWrist);
    drawLine(lm.leftShoulder, lm.leftHip);
    drawLine(lm.rightShoulder, lm.rightHip);
    drawLine(lm.leftHip, lm.rightHip);

    drawPt(lm.leftShoulder);
    drawPt(lm.rightShoulder);
    drawPt(lm.neck);
    drawPt(lm.chest);
    drawPt(lm.leftHip);
    drawPt(lm.rightHip);

    ctx.restore();
  }
}

export const clothEngine = new ClothWarpEngine();
