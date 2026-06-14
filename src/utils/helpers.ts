export const compressImage = (
  file: File,
  options?: { maxWidth?: number; maxHeight?: number; quality?: number }
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = options?.maxWidth ?? 800;
        const MAX_HEIGHT = options?.maxHeight ?? 800;
        const quality = options?.quality ?? 0.7;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
        } else {
          if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; }
        }
        canvas.width = Math.floor(width);
        canvas.height = Math.floor(height);
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

export const parseUTCDate = (dateString?: string | null): Date => {
  if (!dateString) return new Date(0);
  try {
    if (dateString.includes('T') && (dateString.endsWith('Z') || dateString.includes('+'))) {
      const d = new Date(dateString);
      return isNaN(d.getTime()) ? new Date(0) : d;
    }
    const isoString = dateString.replace(' ', 'T') + (dateString.endsWith('Z') ? '' : 'Z');
    const date = new Date(isoString);
    if (isNaN(date.getTime())) {
      const fallback = new Date(dateString);
      return isNaN(fallback.getTime()) ? new Date(0) : fallback;
    }
    return date;
  } catch (e) {
    return new Date(0);
  }
};

export const formatDate = (dateString?: string) => {
  if (!dateString) return '---';
  try {
    const parsed = parseUTCDate(dateString);
    if (parsed.getTime() === 0) return dateString;
    return parsed.toLocaleString('ja-JP', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit'
    });
  } catch (e) {
    return dateString;
  }
};

export const compressVideo = (file: File): Promise<Blob> => {
  return new Promise((resolve) => {
    // 1. Fallback immediately if MediaRecorder or Canvas captureStream is not supported by browser
    if (!window.MediaRecorder || !HTMLCanvasElement.prototype.captureStream) {
      console.warn("MediaRecorder or captureStream not supported in this browser, skipping video compression.");
      resolve(file);
      return;
    }

    // 2. Skip compression if the video is already small (< 15MB) to save user CPU time
    if (file.size < 15 * 1024 * 1024) {
      console.log("Video is already small (<15MB), uploading original directly.");
      resolve(file);
      return;
    }

    const video = document.createElement('video');
    video.preload = 'auto';
    video.autoplay = false;
    video.muted = true;
    video.playsInline = true;
    
    const fileUrl = URL.createObjectURL(file);
    video.src = fileUrl;

    video.onloadedmetadata = () => {
      // Scale down so the maximum长辺 (dimension) is capped at 1280px (720p)
      const maxDimension = 1280;
      let width = video.videoWidth;
      let height = video.videoHeight;

      if (width > height) {
        if (width > maxDimension) {
          height *= maxDimension / width;
          width = maxDimension;
        }
      } else {
        if (height > maxDimension) {
          width *= maxDimension / height;
          height = maxDimension;
        }
      }

      width = Math.floor(width / 2) * 2; // Make even number for video encoders
      height = Math.floor(height / 2) * 2;

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        URL.revokeObjectURL(fileUrl);
        resolve(file);
        return;
      }

      // Record canvas stream at 30 frames per second
      const fps = 30;
      const stream = canvas.captureStream(fps);

      // Attempt to capture and mix the video's audio tracks
      let audioSourceNode: MediaStreamAudioSourceNode | null = null;
      let audioDestinationNode: MediaStreamAudioDestinationNode | null = null;
      let audioCtx: AudioContext | null = null;

      try {
        const audioTracks = (video as any).captureStream ? (video as any).captureStream().getAudioTracks() : [];
        if (audioTracks.length > 0) {
          audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
          audioDestinationNode = audioCtx.createMediaStreamDestination();
          
          const mediaStream = new MediaStream(audioTracks);
          audioSourceNode = audioCtx.createMediaStreamSource(mediaStream);
          audioSourceNode.connect(audioDestinationNode);
          
          const audioTrack = audioDestinationNode.stream.getAudioTracks()[0];
          if (audioTrack) {
            stream.addTrack(audioTrack);
          }
        }
      } catch (err) {
        console.warn("Failed to synchronize audio track for video compression:", err);
      }

      // Select supported encoding mime-type
      let mimeType = 'video/webm;codecs=vp8,opus';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'video/webm;codecs=vp8';
      }
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'video/webm';
      }
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = ''; // Browser default fallback
      }

      const chunks: Blob[] = [];
      const recorderOptions = mimeType ? { mimeType, bitsPerSecond: 1500000 } : { bitsPerSecond: 1500000 };
      const recorder = new MediaRecorder(stream, recorderOptions);

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      recorder.onstop = () => {
        // Cleanup resources
        URL.revokeObjectURL(fileUrl);
        if (audioCtx) {
          try {
            audioCtx.close();
          } catch {}
        }
        
        const blob = new Blob(chunks, { type: mimeType || 'video/webm' });
        
        // If the compressed output blob is somehow larger than the original file, use original
        if (blob.size > file.size || blob.size < 1000) {
          console.log("Compressed file is larger or corrupt, falling back to original file.");
          resolve(file);
        } else {
          resolve(blob);
        }
      };

      // Set playbackRate to 3x speed for ultra-fast compression in background!
      video.playbackRate = 3.0;
      video.muted = true;

      // Start the transcoder
      recorder.start();
      video.play().catch((err) => {
        console.error("Transcoder autoplay failed:", err);
        recorder.stop();
        resolve(file);
      });

      const drawFrame = () => {
        if (video.paused || video.ended) {
          recorder.stop();
          return;
        }
        ctx.drawImage(video, 0, 0, width, height);
        requestAnimationFrame(drawFrame);
      };

      video.onplay = () => {
        drawFrame();
      };

      video.onerror = (e) => {
        console.error("Transcoder video load error:", e);
        URL.revokeObjectURL(fileUrl);
        resolve(file);
      };
    };
  });
};

export const isSlowConnection = (): boolean => {
  const conn = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
  if (conn) {
    if (conn.saveData) return true;
    const type = conn.effectiveType;
    return type === 'slow-2g' || type === '2g' || type === '3g';
  }
  return false;
};