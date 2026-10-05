import { SampleModel } from '../types';

export const SAMPLE_MODELS: SampleModel[] = [
  {
    id: 'webcam',
    name: 'Live User Webcam',
    type: 'video',
    url: '',
    thumbnail: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
    description: 'Your real-time camera feed with live 60FPS body tracking and dress swapping.',
    gender: 'unisex'
  },
  {
    id: 'model-female-runway',
    name: 'Paris Runway Model (Elena)',
    type: 'video',
    // Public copyright-free high quality portrait fashion video clips
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    thumbnail: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=400&q=80',
    description: 'Studio runway catwalk model moving left to right for dynamic dress sway testing.',
    gender: 'female'
  },
  {
    id: 'model-male-casual',
    name: 'Streetwear Studio Model (Marcus)',
    type: 'video',
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyBlazes.mp4',
    thumbnail: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80',
    description: 'Casual studio standing pose model for jacket and suit fitting inspection.',
    gender: 'male'
  },
  {
    id: 'photo-portrait-gala',
    name: 'High-Fashion Studio Portrait (Sophia)',
    type: 'image',
    url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=1000&q=80',
    thumbnail: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
    description: 'Crisp studio portrait for high-resolution AI virtual try-on rendering.',
    gender: 'female'
  },
  {
    id: 'photo-portrait-editorial',
    name: 'Editorial Fashion Portrait (Julian)',
    type: 'image',
    url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=1000&q=80',
    thumbnail: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80',
    description: 'Sharp studio lighting portrait for custom outfit generation.',
    gender: 'male'
  }
];
