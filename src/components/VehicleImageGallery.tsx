import React, { useState, useEffect } from 'react';
import { RefreshCw, ImageIcon, ChevronLeft, ChevronRight, ArrowLeft } from 'lucide-react';
import { parseImages } from './UIBase';
import { useIsMobile } from '../hooks/useIsMobile';
import { ImageLightbox } from './ImageLightbox';

export const VehicleImageGallery = ({ imageData, fallbackQuery, targetTrim }: { imageData: string | undefined; fallbackQuery?: string; targetTrim?: string }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [wikiUrl, setWikiUrl] = useState<string | null>(null);
  const [wikiLoading, setWikiLoading] = useState(false);
  const images = parseImages(imageData);
  const isMobile = useIsMobile();

  useEffect(() => {
    if (images.length > 0 || !fallbackQuery) return;
    let cancelled = false;
    setWikiLoading(true);
    fetch(`/api/wiki-image?v=4&q=${encodeURIComponent(fallbackQuery)}${targetTrim ? `&trim=${encodeURIComponent(targetTrim)}` : ''}`)
      .then(r => r.ok ? r.json() : null)
      .then((data: any) => { if (!cancelled && data?.imageUrl) setWikiUrl(data.imageUrl); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setWikiLoading(false); });
    return () => { cancelled = true; };
  }, [fallbackQuery, targetTrim, images.length]);

  // Show wiki fallback when no user-uploaded images
  if (images.length === 0) {
    if (wikiLoading) {
      return (
        <div style={{ height: '160px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid var(--glass-border)', color: 'var(--text-muted)', fontSize: '0.8rem', gap: '8px' }}>
          <RefreshCw size={14} className="animate-spin" /> 参考画像を読み込み中...
        </div>
      );
    }
    if (wikiUrl) {
      return (
        <div style={{ position: 'relative', borderBottom: '1px solid var(--glass-border)' }}>
          <div style={{ height: '160px', backgroundImage: `url(${wikiUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
          <span style={{ position: 'absolute', bottom: '6px', left: '6px', background: 'rgba(0,0,0,0.65)', color: '#aaa', fontSize: '0.68rem', padding: '3px 8px', borderRadius: '8px', display: 'inline-flex', alignItems: 'center', gap: '4px', pointerEvents: 'none' }}>
            <ImageIcon size={10} /> Greenville Wiki より参考画像
          </span>
        </div>
      );
    }
    return null;
  }

  const openAt = (e: React.MouseEvent, index: number) => {
    e.stopPropagation();
    setCurrentIndex(index);
    setIsFullscreen(true);
  };

  const nextImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex(prev => (prev + 1) % images.length);
  };

  const prevImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex(prev => (prev - 1 + images.length) % images.length);
  };

  if (images.length === 1) {
    return (
      <>
        <div onClick={e => openAt(e, 0)} style={{ height: '200px', backgroundImage: `url(${images[0]})`, backgroundSize: 'cover', backgroundPosition: 'center', borderBottom: '1px solid var(--glass-border)', cursor: 'zoom-in' }} />
        {isFullscreen && <ImageLightbox images={images} startIndex={currentIndex} onClose={() => setIsFullscreen(false)} />}
      </>
    );
  }

  if (isMobile) {
    return (
      <>
        <div className="image-gallery" style={{ height: '200px', display: 'flex', overflowX: 'auto', scrollSnapType: 'x mandatory', borderBottom: '1px solid var(--glass-border)', position: 'relative' }}>
          {images.map((img, i) => (
            <div key={i} onClick={e => openAt(e, i)} style={{ minWidth: '100%', height: '100%', backgroundImage: `url(${img})`, backgroundSize: 'cover', backgroundPosition: 'center', scrollSnapAlign: 'start', cursor: 'zoom-in' }} />
          ))}
          <span style={{ position: 'absolute', bottom: '8px', right: '8px', background: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: '0.7rem', padding: '4px 10px', borderRadius: '12px', fontWeight: 'bold', pointerEvents: 'none', zIndex: 2 }}>画像 {images.length}枚 <ChevronRight size={10} style={{display:'inline', verticalAlign:'middle'}}/></span>
        </div>
        {isFullscreen && <ImageLightbox images={images} startIndex={currentIndex} onClose={() => setIsFullscreen(false)} />}
      </>
    );
  }

  return (
    <>
      <div style={{ height: '200px', position: 'relative', borderBottom: '1px solid var(--glass-border)', overflow: 'hidden' }}>
        <div onClick={e => openAt(e, currentIndex)} style={{ width: '100%', height: '100%', backgroundImage: `url(${images[currentIndex]})`, backgroundSize: 'cover', backgroundPosition: 'center', transition: 'background-image 0.2s ease-in-out', cursor: 'zoom-in' }} />
        <button onClick={prevImage} style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.5)', color: '#fff', border: '1px solid rgba(255,255,255,0.3)', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 2 }}><ArrowLeft size={16} /></button>
        <button onClick={nextImage} style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.5)', color: '#fff', border: '1px solid rgba(255,255,255,0.3)', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 2 }}><ChevronRight size={16} /></button>
        <span style={{ position: 'absolute', bottom: '8px', right: '8px', background: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: '0.75rem', padding: '4px 10px', borderRadius: '12px', fontWeight: 'bold', pointerEvents: 'none', zIndex: 2 }}>{currentIndex + 1} / {images.length}</span>
      </div>
      {isFullscreen && <ImageLightbox images={images} startIndex={currentIndex} onClose={() => setIsFullscreen(false)} />}
    </>
  );
};
