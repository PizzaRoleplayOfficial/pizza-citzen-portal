import React from "react";
import { CheckCircle2, Clock, XCircle, ChevronRight, AlertTriangle } from "lucide-react";
import { VehicleStatus } from "../types";
import { parseUTCDate } from "../utils/helpers";

export const StatusBadge = ({
  status,
  reason,
  tempExpiresAt,
}: {
  status: VehicleStatus;
  reason?: string;
  tempExpiresAt?: string;
}) => {
  let resolvedStatus: string = status;
  if (status === "temp_approved" && tempExpiresAt && parseUTCDate(tempExpiresAt) < new Date()) {
    resolvedStatus = "temp_expired";
  }

  const configs: Record<string, { icon: any; color: string; text: string }> = {
    approved: { icon: CheckCircle2, color: "var(--success)", text: "承認済み" },
    approved_warning: { icon: AlertTriangle, color: "#FFA114", text: "非推奨での承認" },
    pending: { icon: Clock, color: "var(--text-muted)", text: "審査中" },
    rejected: { icon: XCircle, color: "var(--error)", text: "却下" },
    temp_approved: { icon: Clock, color: "#f59e0b", text: "仮ナンバー承認" },
    temp_expired: { icon: XCircle, color: "#ef4444", text: "仮期限切れ" },
  };

  const config = configs[resolvedStatus] || configs.pending;
  const { icon: Icon, color, text } = config;

  let remainingText = "";
  if (resolvedStatus === "temp_approved" && tempExpiresAt) {
    const diffMs = parseUTCDate(tempExpiresAt).getTime() - new Date().getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    remainingText = diffDays > 0 ? ` (残り ${diffDays}日)` : " (残り 今日中)";
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "6px",
          color,
          fontSize: "0.85rem",
          fontWeight: "600",
        }}
      >
        <Icon size={16} />
        {text}{remainingText}
      </span>
      {(resolvedStatus === "rejected" || resolvedStatus === "approved_warning") && reason && (
        <span
          style={{
            fontSize: "0.75rem",
            color: resolvedStatus === "rejected" ? "var(--error)" : "#FFA114",
            paddingLeft: "22px",
          }}
        >
          {resolvedStatus === "rejected" ? "理由:" : "非推奨理由:"} {reason}
        </span>
      )}
    </div>
  );
};

export const parseImages = (data?: string | null): string[] => {
  if (!data) return [];
  if (data.startsWith("[")) {
    try {
      return JSON.parse(data);
    } catch (e) {
      return [];
    }
  }
  return [data];
};

export const CustomSortDropdown = ({
  value,
  onChange,
  options
}: {
  value: string;
  onChange: (val: string) => void;
  options: { id: string; label: string }[];
}) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const currentLabel = options.find(o => o.id === value)?.label || 'ソート';

  return (
    <div style={{ position: 'relative' }}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="glass"
        style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0 16px', height: '42px', borderRadius: '12px', background: 'var(--panel-bg)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-main)', fontSize: '0.9rem', cursor: 'pointer', whiteSpace: 'nowrap' }}
      >
        {currentLabel}
        <ChevronRight size={16} style={{ transform: isOpen ? 'rotate(90deg)' : 'rotate(0)', transition: '0.2s', marginLeft: '4px' }} />
      </button>
      {isOpen && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 99 }} onClick={() => setIsOpen(false)} />
          <div className="glass animate-fade" style={{ position: 'absolute', top: '100%', right: 0, marginTop: '8px', background: 'var(--panel-bg)', border: '1px solid var(--glass-border)', borderRadius: '12px', overflow: 'hidden', zIndex: 100, minWidth: '100%', whiteSpace: 'nowrap', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
            {options.map(opt => (
              <button
                key={opt.id}
                onClick={() => { onChange(opt.id); setIsOpen(false); }}
                style={{ display: 'block', width: '100%', padding: '12px 16px', border: 'none', background: value === opt.id ? 'var(--primary)' : 'transparent', color: value === opt.id ? '#000' : 'var(--text-main)', textAlign: 'left', fontWeight: value === opt.id ? 700 : 500, fontSize: '0.9rem', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.05)' }}
                onMouseOver={(e) => { if(value !== opt.id) e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
                onMouseOut={(e) => { if(value !== opt.id) e.currentTarget.style.background = 'transparent'; }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

