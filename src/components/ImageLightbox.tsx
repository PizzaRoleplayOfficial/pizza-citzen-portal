import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { X, ArrowLeft, ChevronRight } from 'lucide-react';

// Portal-based fullscreen lightbox — renders into document.body to escape any parent overflow/transform
export const ImageLightbox = ({ images, startIndex, onClose }: { images: string[], startIndex: number, onClose: () => void }) => {
  const [idx, setIdx] = useState(startIndex);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') setIdx(i => (i + 1) % images.length);
      if (e.key === 'ArrowLeft') setIdx(i => (i - 1 + images.length) % images.length);
    };
    document.addEventListener('keydown', onKey);

    // Intercept back gesture / hardware back button
    window.history.pushState({ imageLightbox: true }, '');

    const handlePopState = (e: PopStateEvent) => {
      onClose();
    };
    window.addEventListener('popstate', handlePopState);

    return () => {
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('popstate', handlePopState);
      if (window.history.state?.imageLightbox) {
        window.history.back();
      }
    };
  }, [images, onClose]);

  return ReactDOM.createPortal(
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 99999, background: 'rgba(0,0,0,0.93)', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(6px)', cursor: 'zoom-out' }}
    >
      <img
        src={images[idx]}
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: '92vw', maxHeight: '90vh', objectFit: 'contain', borderRadius: '10px', boxShadow: '0 8px 60px rgba(0,0,0,0.7)', cursor: 'default' }}
      />
      {/* Close */}
      <button onClick={onClose} style={{ position: 'fixed', top: '20px', right: '20px', background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', borderRadius: '50%', width: '48px', height: '48px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100000 }}>
        <X size={24} />
      </button>
      {/* Prev / Next */}
      {images.length > 1 && (
        <>
          <button onClick={e => { e.stopPropagation(); setIdx(i => (i - 1 + images.length) % images.length); }} style={{ position: 'fixed', left: '20px', top: '50%', transform: 'translateY(-50%)', background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', borderRadius: '50%', width: '56px', height: '56px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100000 }}>
            <ArrowLeft size={28} />
          </button>
          <button onClick={e => { e.stopPropagation(); setIdx(i => (i + 1) % images.length); }} style={{ position: 'fixed', right: '20px', top: '50%', transform: 'translateY(-50%)', background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', borderRadius: '50%', width: '56px', height: '56px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100000 }}>
            <ChevronRight size={28} />
          </button>
          <div style={{ position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.7)', color: '#fff', fontSize: '0.9rem', padding: '6px 20px', borderRadius: '20px', fontWeight: 'bold', pointerEvents: 'none', zIndex: 100000 }}>
            {idx + 1} / {images.length}
          </div>
        </>
      )}
    </div>,
    document.body
  );
};
