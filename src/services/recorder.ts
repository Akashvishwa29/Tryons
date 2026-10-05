import { Garment, SnapshotItem } from '../types';

export class VideoRecorderService {
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private isRecording = false;

  public startRecording(canvas: HTMLCanvasElement, onTick?: (seconds: number) => void): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const stream = canvas.captureStream(30); // 30 FPS recording
        this.recordedChunks = [];

        const mimeTypes = [
          'video/webm;codecs=vp9,opus',
          'video/webm;codecs=vp8',
          'video/webm',
          'video/mp4'
        ];

        let selectedMime = '';
        for (const mime of mimeTypes) {
          if (MediaRecorder.isTypeSupported(mime)) {
            selectedMime = mime;
            break;
          }
        }

        this.mediaRecorder = new MediaRecorder(stream, selectedMime ? { mimeType: selectedMime } : undefined);

        this.mediaRecorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) {
            this.recordedChunks.push(event.data);
          }
        };

        this.mediaRecorder.start(100);
        this.isRecording = true;

        if (onTick) {
          let secs = 0;
          const interval = setInterval(() => {
            if (!this.isRecording) {
              clearInterval(interval);
              return;
            }
            secs++;
            onTick(secs);
          }, 1000);
        }

        resolve();
      } catch (err) {
        reject(err);
      }
    });
  }

  public stopRecording(): Promise<{ videoBlob: Blob; videoUrl: string }> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder || !this.isRecording) {
        reject(new Error('No active recording'));
        return;
      }

      this.mediaRecorder.onstop = () => {
        const blob = new Blob(this.recordedChunks, { type: this.mediaRecorder?.mimeType || 'video/webm' });
        const url = URL.createObjectURL(blob);
        this.isRecording = false;
        resolve({ videoBlob: blob, videoUrl: url });
      };

      this.mediaRecorder.stop();
    });
  }

  public getIsRecording(): boolean {
    return this.isRecording;
  }

  // Capture High-Res Snapshot with Decart watermark
  public captureSnapshot(
    canvas: HTMLCanvasElement,
    garment: Garment,
    mode: 'live_ar' | 'neural_snap' = 'live_ar',
    beforeCanvas?: HTMLCanvasElement
  ): SnapshotItem {
    const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
    let beforeUrl: string | undefined;

    if (beforeCanvas) {
      beforeUrl = beforeCanvas.toDataURL('image/jpeg', 0.9);
    }

    return {
      id: `snap_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: Date.now(),
      imageUrl: dataUrl,
      beforeImageUrl: beforeUrl,
      garmentName: garment.name,
      garmentId: garment.id,
      mode,
      notes: `Fitted with ${garment.brand || 'AnyWear'} (${garment.category})`
    };
  }

  // Create Before vs. After Side-by-Side Share Collage
  public createComparisonCollage(beforeUrl: string, afterUrl: string, garmentName: string): Promise<string> {
    return new Promise((resolve) => {
      const img1 = new Image();
      const img2 = new Image();
      img1.crossOrigin = 'anonymous';
      img2.crossOrigin = 'anonymous';

      let loaded = 0;
      const onBothLoaded = () => {
        loaded++;
        if (loaded < 2) return;

        const canvas = document.createElement('canvas');
        canvas.width = 1600;
        canvas.height = 900;
        const ctx = canvas.getContext('2d')!;

        // Background dark gradient
        const bgGrad = ctx.createLinearGradient(0, 0, 1600, 900);
        bgGrad.addColorStop(0, '#0a0a0f');
        bgGrad.addColorStop(1, '#181824');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, 1600, 900);

        // Draw Left (Before)
        const frameW = 740;
        const frameH = 740;
        const topY = 90;

        ctx.drawImage(img1, 40, topY, frameW, frameH);
        ctx.strokeStyle = '#3f3f46';
        ctx.lineWidth = 2;
        ctx.strokeRect(40, topY, frameW, frameH);

        // Draw Right (After)
        ctx.drawImage(img2, 820, topY, frameW, frameH);
        ctx.strokeStyle = '#00f2fe';
        ctx.lineWidth = 3;
        ctx.strokeRect(820, topY, frameW, frameH);

        // Labels
        ctx.fillStyle = '#a1a1aa';
        ctx.font = 'bold 20px "Space Grotesk", sans-serif';
        ctx.fillText('ORIGINAL FEED', 60, topY + 40);

        ctx.fillStyle = '#00f2fe';
        ctx.font = 'bold 20px "Space Grotesk", sans-serif';
        ctx.fillText('ANYWEAR LIVE AI FIT', 840, topY + 40);

        // Top Header
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 28px "Space Grotesk", sans-serif';
        ctx.fillText('DECART // ANYWEAR REAL-TIME TRY-ON', 40, 55);

        ctx.fillStyle = '#f43f5e';
        ctx.font = '18px "JetBrains Mono", monospace';
        ctx.fillText(`TRY-ON: ${garmentName}`, 820, 55);

        resolve(canvas.toDataURL('image/jpeg', 0.95));
      };

      img1.onload = onBothLoaded;
      img2.onload = onBothLoaded;
      img1.src = beforeUrl;
      img2.src = afterUrl;
    });
  }
}

export const recorderService = new VideoRecorderService();
