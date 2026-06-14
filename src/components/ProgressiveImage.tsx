import React, { useState, useEffect } from 'react';
import { triggerHaptic } from '../utils/native';

interface ProgressiveImageProps {
  lowSrc: string;
  highSrc: string;
  alt: string;
  style?: React.CSSProperties;
  onClick?: (e: React.MouseEvent) => void;
  dataSaverEnabled?: boolean;
}

export const ProgressiveImage = ({
  lowSrc,
  highSrc,
  alt,
  style,
  onClick,
  dataSaverEnabled
}: ProgressiveImageProps) => {
  const [currentSrc, setCurrentSrc] = useState<string>(lowSrc || highSrc);
  const [isLoaded, setIsLoaded] = useState<boolean>(!lowSrc);
  const [isManualLoaded, setIsManualLoaded] = useState<boolean>(false);

  useEffect(() => {
    if (!lowSrc) {
      return;
    }

    // When data saver is enabled, do not load high resolution image until manually clicked
    if (dataSaverEnabled && !isManualLoaded) {
      return;
    }

    let isMounted = true;
    const img = new Image();
    img.src = highSrc;
    img.onload = () => {
      if (isMounted) {
        setCurrentSrc(highSrc);
        setIsLoaded(true);
      }
    };
    return () => {
      isMounted = false;
    };
  }, [highSrc, lowSrc, dataSaverEnabled, isManualLoaded]);

  const handleManualLoad = (e: React.MouseEvent) => {
    if (dataSaverEnabled && !isManualLoaded) {
      e.stopPropagation();
      triggerHaptic('light');
      setIsManualLoaded(true);
    }
  };

  const isSavingData = dataSaverEnabled && !isManualLoaded;

  const handleClick = (e: React.MouseEvent) => {
    if (isSavingData) {
      handleManualLoad(e);
    } else if (onClick) {
      onClick(e);
    }
  };

  return (
    <div 
      onClick={handleClick}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        cursor: isSavingData ? 'pointer' : 'zoom-in',
        background: 'rgba(0,0,0,0.2)'
      }}
    >
      <img
        src={currentSrc}
        alt={alt}
        style={{
          ...style,
          width: '100%',
          height: '100%',
          filter: isLoaded || isSavingData ? 'none' : 'blur(10px)',
          transition: 'filter 0.3s ease-in-out, transform 0.2s',
          opacity: isSavingData ? 0.6 : 1
        }}
      />
      {isSavingData && (
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(0,0,0,0.4)',
          gap: '8px'
        }}>
          <span style={{
            fontSize: '0.78rem',
            fontWeight: 700,
            background: 'var(--glass-bg)',
            border: '1px solid var(--glass-border)',
            padding: '6px 12px',
            borderRadius: '20px',
            color: 'var(--primary)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            タップして読込 (データ節約中)
          </span>
        </div>
      )}
    </div>
  );
};
