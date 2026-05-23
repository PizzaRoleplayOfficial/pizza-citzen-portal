import React, { useState, useMemo } from 'react';

interface Vehicle {
  id: string;
  maker: string;
  model: string;
  status: 'approved' | 'pending' | 'rejected' | 'temp_approved' | string;
  [key: string]: any;
}

interface DashboardChartsProps {
  vehicles: Vehicle[];
  onMakerClick?: (maker: string) => void;
  onStatusClick?: (status: string) => void;
  isMobile?: boolean;
}

export const DashboardCharts: React.FC<DashboardChartsProps> = ({ 
  vehicles,
  onMakerClick,
  onStatusClick,
  isMobile = false
}) => {
  const [hoveredStatusIndex, setHoveredStatusIndex] = useState<number | null>(null);
  const [hoveredMakerIndex, setHoveredMakerIndex] = useState<number | null>(null);

  // 1. 承認ステータス比率データの集計
  const statusData = useMemo(() => {
    const total = vehicles.length;
    if (total === 0) return [];

    const counts: Record<string, { count: number; color: string; label: string }> = {
      approved: { count: 0, color: 'var(--success, #00c166)', label: '承認済み' },
      pending: { count: 0, color: '#f59e0b', label: '審査中' },
      rejected: { count: 0, color: 'var(--error, #ff3838)', label: '却下' },
      temp: { count: 0, color: '#3b82f6', label: '仮承認' },
    };

    vehicles.forEach((v) => {
      if (v.status === 'approved' || v.status === 'approved_warning') {
        counts.approved.count++;
      } else if (v.status === 'pending') {
        counts.pending.count++;
      } else if (v.status === 'rejected') {
        counts.rejected.count++;
      } else if (v.status === 'temp_approved') {
        counts.temp.count++;
      } else {
        counts.pending.count++; // フォールバック
      }
    });

    return Object.entries(counts)
      .map(([key, data]) => ({
        key,
        label: data.label,
        count: data.count,
        percentage: (data.count / total) * 100,
        color: data.color,
      }))
      .filter((d) => d.count > 0);
  }, [vehicles]);

  // ドーナツチャートの計算用
  const donutSlices = useMemo(() => {
    const radius = 38;
    const circumference = 2 * Math.PI * radius; // 238.76
    let accumulatedPercentage = 0;

    return statusData.map((item) => {
      const slicePercentage = item.percentage;
      const strokeLength = (slicePercentage / 100) * circumference;
      const strokeOffset = - (accumulatedPercentage / 100) * circumference;
      accumulatedPercentage += slicePercentage;

      return {
        ...item,
        strokeLength,
        strokeOffset,
        radius,
        circumference,
      };
    });
  }, [statusData]);

  // 2. メーカー別シェアの集集計 (上位5つ/10個 + その他)
  const makerData = useMemo(() => {
    const total = vehicles.length;
    if (total === 0) return [];

    const rawCounts: Record<string, number> = {};
    vehicles.forEach((v) => {
      const maker = (v.maker || '不明').toUpperCase().trim();
      rawCounts[maker] = (rawCounts[maker] || 0) + 1;
    });

    const sortedMakers = Object.entries(rawCounts)
      .map(([name, count]) => ({
        name,
        count,
        percentage: (count / total) * 100,
      }))
      .sort((a, b) => b.count - a.count);

    const maxMakers = isMobile ? 5 : 10;
    if (sortedMakers.length <= maxMakers) {
      return sortedMakers;
    }

    const topMakers = sortedMakers.slice(0, maxMakers);
    const othersCount = sortedMakers.slice(maxMakers).reduce((acc, m) => acc + m.count, 0);

    return [
      ...topMakers,
      {
        name: 'その他',
        count: othersCount,
        percentage: (othersCount / total) * 100,
      },
    ];
  }, [vehicles, isMobile]);

  // 現在ドーナツチャート中央に表示する情報
  const activeStatus = useMemo(() => {
    if (hoveredStatusIndex !== null && statusData[hoveredStatusIndex]) {
      return statusData[hoveredStatusIndex];
    }
    // デフォルト表示（全体数）
    return {
      label: '登録車両総数',
      count: vehicles.length,
      percentage: 100,
      color: 'var(--text-main, #ffffff)',
    };
  }, [hoveredStatusIndex, statusData, vehicles]);

  if (vehicles.length === 0) {
    return (
      <div className="glass" style={{ padding: isMobile ? '20px' : '32px', borderRadius: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>
        集計対象の車両データがないため、統計グラフを表示できません。
      </div>
    );
  }

  return (
    <div style={{ 
      display: 'grid', 
      gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(320px, 1fr))', 
      gap: isMobile ? '12px' : '24px', 
      marginTop: isMobile ? '12px' : '24px' 
    }}>
      
      {/* 1. ステータス内訳 ドーナツチャート */}
      <div className="glass card" style={{ padding: isMobile ? '16px' : '24px', borderRadius: '20px', display: 'flex', flexDirection: 'column', background: 'var(--panel-bg)', border: '1px solid var(--glass-border)' }}>
        <h3 style={{ fontSize: isMobile ? '0.95rem' : '1.1rem', fontWeight: 700, marginBottom: isMobile ? '12px' : '20px', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--primary)' }}></span>
          承認申請のステータス割合
        </h3>
        
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around', flexWrap: 'wrap', gap: isMobile ? '12px' : '20px', flex: 1 }}>
          {/* SVG Donut */}
          <div style={{ position: 'relative', width: isMobile ? '130px' : '180px', height: isMobile ? '130px' : '180px' }}>
            <svg width="100%" height="100%" viewBox="0 0 100 100">
              {/* 背景の薄い円 */}
              <circle
                cx="50"
                cy="50"
                r="38"
                fill="transparent"
                stroke="rgba(255,255,255,0.03)"
                strokeWidth="8"
              />
              
              {donutSlices.map((slice, index) => {
                const isHovered = hoveredStatusIndex === index;
                return (
                  <circle
                    key={slice.key}
                    cx="50"
                    cy="50"
                    r={slice.radius}
                    fill="transparent"
                    stroke={slice.color}
                    strokeWidth={isHovered ? 10 : 8}
                    strokeDasharray={`${slice.strokeLength} ${slice.circumference}`}
                    strokeDashoffset={slice.strokeOffset}
                    transform="rotate(-90 50 50)"
                    strokeLinecap="round"
                    style={{
                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                      cursor: 'pointer',
                      filter: isHovered ? `drop-shadow(0 0 8px ${slice.color})` : 'none',
                    }}
                    onMouseEnter={() => setHoveredStatusIndex(index)}
                    onMouseLeave={() => setHoveredStatusIndex(null)}
                    onClick={() => onStatusClick?.(slice.key)}
                  />
                );
              })}
            </svg>
            
            {/* 中央の情報テキスト */}
            <div style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              textAlign: 'center',
              pointerEvents: 'none',
            }}>
              <span style={{ fontSize: isMobile ? '0.65rem' : '0.75rem', color: 'var(--text-muted)', fontWeight: 500, letterSpacing: '0.05em' }}>
                {activeStatus.label}
              </span>
              <span style={{ fontSize: isMobile ? '1.3rem' : '1.8rem', fontWeight: 800, color: 'var(--text-main)', marginTop: '2px', display: 'flex', alignItems: 'baseline', gap: '2px' }}>
                {activeStatus.count}
                <span style={{ fontSize: isMobile ? '0.75rem' : '0.85rem', fontWeight: 500, color: 'var(--text-muted)' }}>件</span>
              </span>
              {hoveredStatusIndex !== null && (
                <span style={{ fontSize: isMobile ? '0.7rem' : '0.8rem', fontWeight: 600, color: activeStatus.color, marginTop: '2px', background: 'rgba(0,0,0,0.2)', padding: '2px 6px', borderRadius: '4px' }}>
                  {activeStatus.percentage.toFixed(1)}%
                </span>
              )}
            </div>
          </div>
          
          {/* レジェンド（凡例リスト） */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '4px' : '10px', minWidth: '120px' }}>
            {donutSlices.map((slice, index) => {
              const isHovered = hoveredStatusIndex === index;
              return (
                <div
                  key={slice.key}
                  onMouseEnter={() => setHoveredStatusIndex(index)}
                  onMouseLeave={() => setHoveredStatusIndex(null)}
                  onClick={() => onStatusClick?.(slice.key)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: isMobile ? '6px' : '10px',
                    padding: isMobile ? '4px 6px' : '6px 8px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    background: isHovered ? 'rgba(255,255,255,0.05)' : 'transparent',
                    transform: isHovered ? 'translateX(2px)' : 'none',
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                  }}
                  title="クリックしてこのステータスで車両検索へ"
                >
                  <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: slice.color, display: 'inline-block', flexShrink: 0 }}></span>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: isMobile ? '0.78rem' : '0.85rem', fontWeight: isHovered ? 700 : 500, color: 'var(--text-main)' }}>{slice.label}</span>
                    <span style={{ fontSize: isMobile ? '0.7rem' : '0.75rem', color: 'var(--text-muted)' }}>{slice.count}台 ({slice.percentage.toFixed(0)}%)</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 2. メーカー別シェア 横棒グラフ */}
      <div className="glass card" style={{ padding: isMobile ? '16px' : '24px', borderRadius: '20px', display: 'flex', flexDirection: 'column', background: 'var(--panel-bg)', border: '1px solid var(--glass-border)' }}>
        <h3 style={{ fontSize: isMobile ? '0.95rem' : '1.1rem', fontWeight: 700, marginBottom: isMobile ? '12px' : '20px', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--primary)' }}></span>
          人気自動車メーカーシェア
        </h3>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '6px' : '10px', justifyContent: 'center', flex: 1 }}>
          {makerData.map((item, index) => {
            const isHovered = hoveredMakerIndex === index;
            const isClickable = item.name !== 'その他' && !!onMakerClick;
            return (
              <div
                key={item.name}
                onMouseEnter={() => setHoveredMakerIndex(index)}
                onMouseLeave={() => setHoveredMakerIndex(null)}
                onClick={() => isClickable && onMakerClick?.(item.name)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                  padding: isMobile ? '1px 6px' : '2px 8px',
                  borderRadius: '8px',
                  background: isHovered ? 'rgba(255,255,255,0.03)' : 'transparent',
                  cursor: isClickable ? 'pointer' : 'default',
                  transform: isHovered && isClickable ? 'translateX(2px)' : 'none',
                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                }}
                title={isClickable ? `クリックして ${item.name} で車両検索へ` : undefined}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: isMobile ? '0.78rem' : '0.85rem' }}>
                  <span style={{ fontWeight: isHovered ? 700 : 600, color: 'var(--text-main)', letterSpacing: '0.02em' }}>
                    {item.name}
                  </span>
                  <span style={{ fontSize: isMobile ? '0.72rem' : '0.8rem', color: 'var(--text-muted)' }}>
                    <strong style={{ color: 'var(--text-main)', fontSize: isMobile ? '0.78rem' : '0.85rem' }}>{item.count}</strong>台 ({item.percentage.toFixed(0)}%)
                  </span>
                </div>
                
                {/* バーコンテナ */}
                <div style={{ width: '100%', height: isMobile ? '6px' : '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden', position: 'relative' }}>
                  <div
                    style={{
                      height: '100%',
                      width: `${item.percentage}%`,
                      background: isHovered 
                       ? 'linear-gradient(90deg, #00ff88 0%, #00c166 100%)' 
                       : 'linear-gradient(90deg, var(--primary) 0%, rgba(0, 193, 102, 0.7) 100%)',
                      borderRadius: '4px',
                      transition: 'width 1s cubic-bezier(0.1, 0.8, 0.3, 1), background 0.3s ease',
                      boxShadow: isHovered ? '0 0 6px rgba(0,255,136,0.6)' : 'none',
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
};
