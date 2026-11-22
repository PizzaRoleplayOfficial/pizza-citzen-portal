import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Car, Flame, Home, MessageCircle, Plus } from 'lucide-react';

/**
 * Hidden SVG optical filter definitions supporting Liquid Glass highlights and edge refraction.
 */
export const LiquidGlassSvgFilters: React.FC = () => (
  <svg
    aria-hidden="true"
    style={{
      position: 'absolute',
      width: 0,
      height: 0,
      overflow: 'hidden',
      pointerEvents: 'none',
    }}
  >
    <defs>
      <filter id="lg-refract-edge" x="-5%" y="-5%" width="110%" height="110%">
        <feTurbulence
          type="fractalNoise"
          baseFrequency="0.015"
          numOctaves={2}
          seed={7}
          result="noise"
        />
        <feDisplacementMap
          in="SourceGraphic"
          in2="noise"
          scale={4}
          xChannelSelector="R"
          yChannelSelector="G"
        />
      </filter>
    </defs>
  </svg>
);

export interface SpotlightGlareCardProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  onClick?: React.MouseEventHandler<HTMLDivElement>;
  variant?: 'spotlight' | 'glare' | 'citizen-id' | 'vehicle';
  enableTilt?: boolean;
  maxTilt?: number;
  spotlightColor?: string;
}

/**
 * Aceternity-inspired Liquid Glass card with cursor-tracking radial spotlight,
 * specular glare sheen, and subtle optional 3D perspective tilt via CSS variables.
 */
export const SpotlightGlareCard: React.FC<SpotlightGlareCardProps> = ({
  children,
  className = '',
  style,
  onClick,
  variant = 'spotlight',
  enableTilt,
  maxTilt,
  spotlightColor,
}) => {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const pointerCoordsRef = useRef<{ clientX: number; clientY: number }>({
    clientX: 0,
    clientY: 0,
  });
  const canHoverRef = useRef(false);
  const reducedMotionRef = useRef(false);

  const resolvedEnableTilt =
    enableTilt ?? (variant === 'citizen-id' || variant === 'vehicle');
  const resolvedMaxTilt =
    maxTilt ?? (variant === 'citizen-id' ? 4 : variant === 'vehicle' ? 4.5 : 3.5);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;

    const hoverMq = window.matchMedia('(hover: hover) and (pointer: fine)');
    const motionMq = window.matchMedia('(prefers-reduced-motion: reduce)');

    canHoverRef.current = hoverMq.matches;
    reducedMotionRef.current = motionMq.matches;

    const handleHoverChange = (e: MediaQueryListEvent) => {
      canHoverRef.current = e.matches;
    };
    const handleMotionChange = (e: MediaQueryListEvent) => {
      reducedMotionRef.current = e.matches;
    };

    if (hoverMq.addEventListener) {
      hoverMq.addEventListener('change', handleHoverChange);
      motionMq.addEventListener('change', handleMotionChange);
      return () => {
        hoverMq.removeEventListener('change', handleHoverChange);
        motionMq.removeEventListener('change', handleMotionChange);
      };
    }

    hoverMq.addListener(handleHoverChange);
    motionMq.addListener(handleMotionChange);
    return () => {
      hoverMq.removeListener(handleHoverChange);
      motionMq.removeListener(handleMotionChange);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  const canInteract = () => {
    if (!canHoverRef.current || reducedMotionRef.current) return false;
    if (typeof document !== 'undefined') {
      if (
        document.body.classList.contains('lite-mode') ||
        document.body.classList.contains('android-m3e')
      ) {
        return false;
      }
    }
    return true;
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!canInteract()) return;
    pointerCoordsRef.current = { clientX: e.clientX, clientY: e.clientY };

    if (rafRef.current !== null) return;

    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      const card = cardRef.current;
      if (!card) return;

      const rect = card.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;

      const x = pointerCoordsRef.current.clientX - rect.left;
      const y = pointerCoordsRef.current.clientY - rect.top;
      const xPct = Math.max(0, Math.min(100, (x / rect.width) * 100));
      const yPct = Math.max(0, Math.min(100, (y / rect.height) * 100));

      card.style.setProperty('--mx', `${x.toFixed(1)}px`);
      card.style.setProperty('--my', `${y.toFixed(1)}px`);
      card.style.setProperty('--mx-pct', `${xPct.toFixed(2)}%`);
      card.style.setProperty('--my-pct', `${yPct.toFixed(2)}%`);
      card.style.setProperty('--glare-o', '1');

      if (resolvedEnableTilt) {
        const halfW = rect.width / 2;
        const halfH = rect.height / 2;
        const normX = Math.max(-1, Math.min(1, (x - halfW) / halfW));
        const normY = Math.max(-1, Math.min(1, (halfH - y) / halfH));
        const rotateX = normY * resolvedMaxTilt;
        const rotateY = normX * resolvedMaxTilt;
        card.style.setProperty('--rx', `${rotateX.toFixed(2)}deg`);
        card.style.setProperty('--ry', `${rotateY.toFixed(2)}deg`);
      }
    });
  };

  const handlePointerLeave = () => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    const card = cardRef.current;
    if (!card) return;
    card.style.setProperty('--glare-o', '0');
    card.style.setProperty('--rx', '0deg');
    card.style.setProperty('--ry', '0deg');
  };

  const mergedStyle: React.CSSProperties | undefined = spotlightColor
    ? ({
        ...style,
        '--spotlight-color': spotlightColor,
      } as React.CSSProperties)
    : style;

  const classes = [
    'ag-card',
    `ag-card--${variant}`,
    'liquid-glass',
    resolvedEnableTilt ? 'ag-card--tilt' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      ref={cardRef}
      className={classes}
      style={mergedStyle}
      onClick={onClick}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
    >
      {children}
      <span className="ag-card-spotlight" aria-hidden="true" />
      {variant !== 'spotlight' && <span className="ag-card-glare" aria-hidden="true" />}
    </div>
  );
};

export interface AnimatedTabItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  badge?: number | string;
  tone?: 'primary' | 'announcement' | 'success' | 'info';
}

export interface AnimatedTabsProps {
  tabs: AnimatedTabItem[];
  activeId: string;
  onChange: (id: string) => void;
  variant?: 'pill' | 'segmented';
  fullWidth?: boolean;
  size?: 'sm' | 'md';
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Animated Tabs with smoothly sliding indicator pill measured via offsetLeft/offsetWidth
 * so positioning remains exact even under mobile CSS zoom.
 */
export const AnimatedTabs: React.FC<AnimatedTabsProps> = ({
  tabs,
  activeId,
  onChange,
  variant = 'pill',
  fullWidth = false,
  size = 'md',
  className = '',
  style,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const buttonRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [indicator, setIndicator] = useState<{
    left: number;
    top: number;
    width: number;
    height: number;
    ready: boolean;
  }>({ left: 0, top: 0, width: 0, height: 0, ready: false });

  const updateIndicator = () => {
    const activeBtn = buttonRefs.current[activeId];
    if (!activeBtn) return;
    setIndicator({
      left: activeBtn.offsetLeft,
      top: activeBtn.offsetTop,
      width: activeBtn.offsetWidth,
      height: activeBtn.offsetHeight,
      ready: true,
    });
  };

  useLayoutEffect(() => {
    updateIndicator();
  }, [activeId, tabs.length, fullWidth, size, variant]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleResize = () => updateIndicator();
    window.addEventListener('resize', handleResize);

    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(() => updateIndicator());
      observer.observe(container);
      Object.values(buttonRefs.current).forEach((btn) => {
        if (btn) observer?.observe(btn);
      });
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      observer?.disconnect();
    };
  }, [activeId, tabs]);

  const activeTab = tabs.find((t) => t.id === activeId);

  const classes = [
    'ag-tabs',
    `ag-tabs--${variant}`,
    `ag-tabs--${size}`,
    fullWidth ? 'ag-tabs--full' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div ref={containerRef} role="tablist" className={classes} style={style}>
      <span
        className="ag-tabs-indicator"
        data-tone={activeTab?.tone || 'primary'}
        aria-hidden="true"
        style={{
          transform: `translate3d(${indicator.left}px, ${indicator.top}px, 0)`,
          width: `${indicator.width}px`,
          height: `${indicator.height}px`,
          opacity: indicator.ready && indicator.width > 0 ? 1 : 0,
        }}
      />
      {tabs.map((tab) => {
        const isActive = tab.id === activeId;
        return (
          <button
            key={tab.id}
            ref={(el) => {
              buttonRefs.current[tab.id] = el;
            }}
            type="button"
            role="tab"
            aria-selected={isActive}
            data-tone={tab.tone || 'primary'}
            className={`ag-tab-btn ${isActive ? 'active' : ''}`}
            onClick={() => onChange(tab.id)}
          >
            {tab.icon && <span className="ag-tab-icon">{tab.icon}</span>}
            <span>{tab.label}</span>
            {tab.badge !== undefined && tab.badge !== null && tab.badge !== '' && (
              <span className="ag-tab-badge">{tab.badge}</span>
            )}
          </button>
        );
      })}
    </div>
  );
};

export interface FloatingDockProps {
  activeView: string;
  onSelectView: (view: 'home' | 'garage' | 'timeline' | 'messages') => void;
  onPlusClick: () => void;
  unreadDmCount: number;
  onHaptic?: () => void;
}

/**
 * Floating Liquid Glass bottom dock for mobile web viewports with gliding active capsule.
 */
export const FloatingDock: React.FC<FloatingDockProps> = ({
  activeView,
  onSelectView,
  onPlusClick,
  unreadDmCount,
  onHaptic,
}) => {
  const dockRef = useRef<HTMLElement | null>(null);
  const itemRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const normalizedView =
    activeView === 'intro' ? 'home' : activeView;
  const dockKeys = ['home', 'garage', 'timeline', 'messages'] as const;
  const hasActiveDockTab = (dockKeys as readonly string[]).includes(normalizedView);

  const [pill, setPill] = useState<{
    left: number;
    width: number;
    ready: boolean;
  }>({ left: 0, width: 0, ready: false });

  const updatePill = () => {
    if (!hasActiveDockTab) {
      setPill((prev) => ({ ...prev, ready: false }));
      return;
    }
    const activeBtn = itemRefs.current[normalizedView];
    if (!activeBtn) return;
    setPill({
      left: activeBtn.offsetLeft,
      width: activeBtn.offsetWidth,
      ready: true,
    });
  };

  useLayoutEffect(() => {
    updatePill();
  }, [normalizedView, hasActiveDockTab]);

  useEffect(() => {
    const dock = dockRef.current;
    if (!dock) return;
    const handleResize = () => updatePill();
    window.addEventListener('resize', handleResize);

    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(() => updatePill());
      observer.observe(dock);
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      observer?.disconnect();
    };
  }, [normalizedView]);

  const handleSelect = (target: 'home' | 'garage' | 'timeline' | 'messages') => {
    onHaptic?.();
    onSelectView(target);
  };

  const renderDockItem = (
    key: 'home' | 'garage' | 'timeline' | 'messages',
    label: string,
    IconComponent: React.ComponentType<any>,
    badgeCount?: number
  ) => {
    const isActive = normalizedView === key;
    return (
      <button
        key={key}
        ref={(el) => {
          itemRefs.current[key] = el;
        }}
        type="button"
        className={`ag-dock-item ${isActive ? 'active' : ''}`}
        onClick={() => handleSelect(key)}
        aria-current={isActive ? 'page' : undefined}
      >
        <span className="ag-dock-item-icon">
          <IconComponent
            size={21}
            fill={isActive ? 'currentColor' : 'none'}
            strokeWidth={isActive ? 2.35 : 1.85}
          />
          {badgeCount !== undefined && badgeCount > 0 && (
            <span className="ag-dock-badge">
              {badgeCount > 9 ? '9+' : badgeCount}
            </span>
          )}
        </span>
        <span className="ag-dock-item-label">{label}</span>
      </button>
    );
  };

  return (
    <nav
      ref={dockRef}
      className="ag-floating-dock liquid-glass-dock"
      aria-label="モバイルナビゲーション"
    >
      <span
        className="ag-dock-active-pill"
        aria-hidden="true"
        style={{
          transform: `translate3d(${pill.left}px, 0, 0) scale(${pill.ready ? 1 : 0.85})`,
          width: `${pill.width}px`,
          opacity: pill.ready && pill.width > 0 ? 1 : 0,
        }}
      />

      {renderDockItem('home', 'ホーム', Home)}
      {renderDockItem('garage', 'ガレージ', Car)}

      <div className="ag-dock-plus-slot">
        <button
          type="button"
          className="ag-dock-plus-btn"
          onClick={onPlusClick}
          aria-label="新規アクション"
        >
          <Plus size={24} strokeWidth={2.75} />
        </button>
      </div>

      {renderDockItem('timeline', 'タイムライン', Flame)}
      {renderDockItem('messages', 'メッセージ', MessageCircle, unreadDmCount)}
    </nav>
  );
};
