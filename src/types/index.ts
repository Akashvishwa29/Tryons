export type GarmentCategory = 'all' | 'dresses' | 'gowns' | 'jackets' | 'streetwear' | 'formal' | 'cyber';

export interface Garment {
  id: string;
  name: string;
  category: GarmentCategory;
  brand?: string;
  price?: string;
  color: string;
  description: string;
  thumbnail: string; // SVG or data URL
  renderType: 'svg_mesh' | 'image' | 'vector_cloth';
  pathData?: string;
  texturePattern?: string;
  defaultScale: number;
  anchorOffset: { x: number; y: number };
  aspectRatio: number;
  torsoCoverage: number;
  shoulderSpanRatio: number;
  isCustom?: boolean;
  tags: string[];
}

export interface BodyLandmarks {
  nose?: { x: number; y: number; z?: number; visibility?: number };
  leftEye?: { x: number; y: number };
  rightEye?: { x: number; y: number };
  leftShoulder: { x: number; y: number; z?: number; visibility?: number };
  rightShoulder: { x: number; y: number; z?: number; visibility?: number };
  leftElbow?: { x: number; y: number };
  rightElbow?: { x: number; y: number };
  leftWrist?: { x: number; y: number };
  rightWrist?: { x: number; y: number };
  leftHip: { x: number; y: number; z?: number; visibility?: number };
  rightHip: { x: number; y: number; z?: number; visibility?: number };
  leftKnee?: { x: number; y: number };
  rightKnee?: { x: number; y: number };
  neck?: { x: number; y: number };
  chest?: { x: number; y: number };
  midHip?: { x: number; y: number };
  confidence: number;
}

export interface FittingSettings {
  shoulderScale: number;
  torsoLength: number;
  verticalOffset: number;
  horizontalOffset: number;
  waistTaper: number;
  drapeTightness: number;
  physicsSway: number;
  opacity: number;
  blendMode: 'source-over' | 'multiply' | 'screen' | 'overlay' | 'hard-light' | 'soft-light';
  hueShift: number;
  saturation: number;
  brightness: number;
  textureOverlay: 'none' | 'silk' | 'velvet' | 'leather' | 'denim' | 'metallic' | 'neon' | 'holographic' | 'gold_brocade';
  showMeshDebug: boolean;
  showSkeletonDebug: boolean;
  showBoundingBox: boolean;
  showLaserScanner: boolean;
  mirrorCamera: boolean;
}

export interface SnapshotItem {
  id: string;
  timestamp: number;
  imageUrl: string;
  garmentName: string;
  garmentId: string;
  mode: 'live_ar' | 'neural_snap';
  beforeImageUrl?: string;
  notes?: string;
}

export interface SampleModel {
  id: string;
  name: string;
  type: 'video' | 'image';
  url: string;
  thumbnail: string;
  description: string;
  gender: 'female' | 'male' | 'unisex';
}

export type AppMode = 'home' | 'live' | 'neural_studio' | 'store_simulator';
