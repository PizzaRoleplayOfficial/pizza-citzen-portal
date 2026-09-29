import React, { useState, useEffect } from 'react';
import { 
  AlertTriangle, 
  RotateCcw, 
  Clock, 
  ShieldCheck, 
  ExternalLink, 
  Sparkles, 
  CheckCircle2, 
  LogIn,
  RefreshCw,
  Server
} from 'lucide-react';
import { triggerHaptic } from '../utils/native';

interface MaintenanceInfo {
  enabled: boolean;
  title: string;
  message: string;
  estimatedEnd?: string;
  discordUrl?: string;
  updatedAt?: string | null;
}

interface MaintenanceViewProps {
  maintenance: MaintenanceInfo;
  onRefresh: () => Promise<void>;
  onAdminLogin?: () => void;
  isChecking?: boolean;
}

export const MaintenanceView: React.FC<MaintenanceViewProps> = ({
  maintenance,
  onRefresh,
  onAdminLogin,
  isChecking = false
}) => {
  const [retrySeconds, setRetrySeconds] = useState(30);
  const [timeRemaining, setTimeRemaining] = useState<string>('');
  const [manualLoading, setManualLoading] = useState(false);

  // Auto-retry timer: ticks down from 30s to 0s, then calls onRefresh()
  useEffect(() => {
    const timer = setInterval(() => {
      setRetrySeconds(prev => {
        if (prev <= 1) {
          onRefresh();
          return 30;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [onRefresh]);

  // Format estimated completion & countdown
  useEffect(() => {
    if (!maintenance.estimatedEnd) {
      setTimeRemaining('');
      return;
    }

    const calculateRemaining = () => {
      try {
        const target = new Date(maintenance.estimatedEnd!).getTime();
        const now = Date.now();
        const diffMs = target - now;

        if (diffMs <= 0) {
          setTimeRemaining('まもなく完了予定');
          return;
        }

        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

        if (diffHours > 0) {
          setTimeRemaining(`残り 約${diffHours}時間${diffMins}分`);
        } else {
          setTimeRemaining(`残り 約${diffMins}分`);
        }
      } catch {
        setTimeRemaining('');
      }
    };

    calculateRemaining();
    const interval = setInterval(calculateRemaining, 30000);
    return () => clearInterval(interval);
  }, [maintenance.estimatedEnd]);

  const handleManualRefresh = async () => {
    triggerHaptic('light');
    setManualLoading(true);
    try {
      await onRefresh();
    } finally {
      setTimeout(() => {
        setManualLoading(false);
        setRetrySeconds(30);
      }, 500);
    }
  };

  const formatEstimatedDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleString('ja-JP', {
        month: 'numeric',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        weekday: 'short'
      });
    } catch {
      return dateStr;
    }
  };

  const discordUrl = maintenance.discordUrl || 'https://discord.gg/RruM8Gqc4m';

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px 16px',
      background: 'radial-gradient(ellipse at 50% 30%, rgba(245, 158, 11, 0.08) 0%, rgba(0,0,0,0) 65%), var(--bg-main)',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Decorative ambient background rings */}
      <div style={{
        position: 'absolute',
        width: '600px',
        height: '600px',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(245, 158, 11, 0.05) 0%, rgba(245, 158, 11, 0) 70%)',
        top: '5%',
        left: '50%',
        transform: 'translateX(-50%)',
        pointerEvents: 'none',
        zIndex: 0
      }} />

      {/* Main Glassmorphic Card */}
      <div 
        className="glass animate-fade"
        style={{
          width: '100%',
          maxWidth: '560px',
          background: 'var(--panel-bg)',
          border: '1px solid var(--glass-border)',
          borderRadius: '32px',
          padding: '40px 32px',
          boxShadow: '0 30px 80px rgba(0, 0, 0, 0.25)',
          position: 'relative',
          zIndex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          backdropFilter: 'blur(30px)'
        }}
      >
        {/* Animated Badge Icon */}
        <div style={{
          width: '84px',
          height: '84px',
          borderRadius: '26px',
          background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.18) 0%, rgba(245, 158, 11, 0.05) 100%)',
          border: '1px solid rgba(245, 158, 11, 0.35)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#f59e0b',
          marginBottom: '24px',
          boxShadow: '0 12px 30px rgba(245, 158, 11, 0.2)',
          position: 'relative'
        }}>
          <Server size={38} strokeWidth={2.2} />
          {/* Pulsing indicator ring */}
          <span style={{
            position: 'absolute',
            top: '-4px',
            right: '-4px',
            width: '16px',
            height: '16px',
            borderRadius: '50%',
            background: '#f59e0b',
            border: '3px solid var(--panel-bg)',
            boxShadow: '0 0 12px #f59e0b'
          }} />
        </div>

        {/* DMV Subtitle Tag */}
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          padding: '6px 14px',
          borderRadius: '20px',
          background: 'rgba(245, 158, 11, 0.1)',
          color: '#d97706',
          fontSize: '0.8rem',
          fontWeight: 800,
          letterSpacing: '0.05em',
          marginBottom: '16px',
          border: '1px solid rgba(245, 158, 11, 0.2)'
        }}>
          <span style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            background: '#d97706'
          }} />
          SYSTEM MAINTENANCE
        </div>

        {/* Title */}
        <h1 style={{
          fontSize: '1.75rem',
          fontWeight: 900,
          color: 'var(--text-main)',
          margin: '0 0 12px 0',
          lineHeight: 1.3,
          letterSpacing: '-0.02em'
        }}>
          {maintenance.title || '大規模システムメンテナンス実施中'}
        </h1>

        {/* Description / Message */}
        <p style={{
          fontSize: '0.95rem',
          color: 'var(--text-muted)',
          margin: '0 0 28px 0',
          lineHeight: 1.7,
          whiteSpace: 'pre-line',
          maxWidth: '460px'
        }}>
          {maintenance.message || '現在、新機能追加およびシステム最適化の作業を行っております。完了まで今しばらくお待ちください。'}
        </p>

        {/* Estimated Schedule Box (if available) */}
        {maintenance.estimatedEnd && (
          <div style={{
            width: '100%',
            background: 'var(--subtle-bg)',
            border: '1px solid var(--glass-border)',
            borderRadius: '20px',
            padding: '16px 20px',
            marginBottom: '28px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', textAlign: 'left' }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '12px',
                background: 'rgba(255, 255, 255, 0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--primary)'
              }}>
                <Clock size={20} />
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>終了予定日時</div>
                <div style={{ fontSize: '0.95rem', color: 'var(--text-main)', fontWeight: 800 }}>
                  {formatEstimatedDate(maintenance.estimatedEnd)} 頃
                </div>
              </div>
            </div>

            {timeRemaining && (
              <span style={{
                fontSize: '0.8rem',
                fontWeight: 800,
                color: '#d97706',
                background: 'rgba(245, 158, 11, 0.12)',
                padding: '4px 12px',
                borderRadius: '12px',
                border: '1px solid rgba(245, 158, 11, 0.25)',
                whiteSpace: 'nowrap'
              }}>
                {timeRemaining}
              </span>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div style={{
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          marginBottom: '28px'
        }}>
          {/* Discord Button */}
          <a
            href={discordUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => triggerHaptic('light')}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              padding: '15px 24px',
              borderRadius: '18px',
              background: '#5865F2',
              color: '#ffffff',
              fontWeight: 800,
              fontSize: '1rem',
              textDecoration: 'none',
              boxShadow: '0 8px 24px rgba(88, 101, 242, 0.35)',
              transition: 'transform 0.15s ease, box-shadow 0.15s ease'
            }}
          >
            <ExternalLink size={18} />
            <span>公式Discordで最新進捗を見る</span>
          </a>

          {/* Manual Reconnect Button */}
          <button
            onClick={handleManualRefresh}
            disabled={manualLoading || isChecking}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              padding: '14px 20px',
              borderRadius: '18px',
              background: 'transparent',
              border: '1px solid var(--glass-border)',
              color: 'var(--text-main)',
              fontWeight: 700,
              fontSize: '0.9rem',
              cursor: manualLoading ? 'not-allowed' : 'pointer',
              transition: 'background 0.2s ease'
            }}
          >
            <RefreshCw size={16} className={manualLoading || isChecking ? 'animate-spin' : ''} />
            <span>{manualLoading || isChecking ? '接続を確認中...' : '今すぐ再接続を試す'}</span>
          </button>
        </div>

        {/* Auto-retry Progress Bar */}
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>
            <span>自動再接続</span>
            <span>{retrySeconds}秒後</span>
          </div>
          <div style={{
            width: '100%',
            height: '4px',
            borderRadius: '4px',
            background: 'rgba(255, 255, 255, 0.08)',
            overflow: 'hidden'
          }}>
            <div style={{
              height: '100%',
              width: `${(retrySeconds / 30) * 100}%`,
              background: '#f59e0b',
              transition: 'width 1s linear'
            }} />
          </div>
        </div>

        {/* Discreet Admin Login Link */}
        {onAdminLogin && (
          <div style={{ marginTop: '32px', paddingTop: '16px', borderTop: '1px solid rgba(255, 255, 255, 0.05)', width: '100%' }}>
            <button
              onClick={() => {
                triggerHaptic('light');
                onAdminLogin();
              }}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                fontSize: '0.8rem',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                opacity: 0.7,
                transition: 'opacity 0.2s ease'
              }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.7')}
            >
              <ShieldCheck size={14} />
              <span>管理者の方はこちらからログイン</span>
            </button>
          </div>
        )}
      </div>

      {/* Portal Copyright Footer */}
      <div style={{
        marginTop: '24px',
        fontSize: '0.75rem',
        color: 'var(--text-muted)',
        textAlign: 'center',
        opacity: 0.6
      }}>
        ぴっざぁ市民ポータル・車両管理局 DMVシステム
      </div>
    </div>
  );
};
