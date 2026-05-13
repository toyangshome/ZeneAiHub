import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { theme } from 'antd';
import { useAgentStore } from '../../../stores/agentStore';

const PRESET_LABELS: Record<string, string> = {
  opus: 'Opus',
  sonnet4: 'Sonnet 4',
  sonnet37: 'Sonnet 3.7',
  haiku: 'Haiku',
};

const PRESET_DEFAULTS: Record<string, string> = {
  opus: 'claude-opus-4-20250514',
  sonnet4: 'claude-sonnet-4-5-20250514',
  sonnet37: 'claude-sonnet-3-7-20250219',
  haiku: 'claude-haiku-3-5-20241022',
};

const PRESET_ORDER = ['opus', 'sonnet4', 'sonnet37', 'haiku'];

export function AgentModelSelector({ placement = 'bottom' }: { placement?: 'top' | 'bottom' } = {}) {
  const { token } = theme.useToken();
  const agentModel = useAgentStore((s) => s.agentModel);
  const agentModels = useAgentStore((s) => s.agentModels);
  const setAgentModel = useAgentStore((s) => s.setAgentModel);

  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top?: number; bottom?: number; right: number }>({ right: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 找到当前 agentModel 对应的预设
  const currentPreset = PRESET_ORDER.find((key) => {
    const mapped = agentModels[key] || PRESET_DEFAULTS[key];
    return mapped === agentModel;
  });
  const displayName = currentPreset
    ? PRESET_LABELS[currentPreset]
    : agentModel || '选择模型';

  const updatePos = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    if (placement === 'top') {
      setPos({ bottom: window.innerHeight - rect.top + 4, right: window.innerWidth - rect.right });
    } else {
      setPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
    }
  }, [placement]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (triggerRef.current?.contains(e.target as Node)) return;
      if (dropdownRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  useEffect(() => {
    if (open) updatePos();
  }, [open, updatePos]);

  useEffect(() => {
    if (!open) return;
    const handler = () => updatePos();
    window.addEventListener('scroll', handler, true);
    window.addEventListener('resize', handler);
    return () => {
      window.removeEventListener('scroll', handler, true);
      window.removeEventListener('resize', handler);
    };
  }, [open, updatePos]);

  return (
    <>
      <button
        ref={triggerRef}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '5px 10px', border: 'none', borderRadius: 10,
          background: 'transparent', cursor: 'pointer', fontSize: 13,
          fontWeight: 500, color: token.colorText, lineHeight: 1.4,
          transition: 'background 0.15s', outline: 'none', fontFamily: 'inherit',
        }}
        onClick={() => setOpen(!open)}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.background = token.colorFillSecondary;
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.background = 'transparent';
        }}
      >
        <span style={{
          maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {displayName}
        </span>
        <svg
          width="12" height="12" viewBox="0 0 12 12" fill="none"
          style={{
            flexShrink: 0, transition: 'transform 0.2s ease',
            color: token.colorTextTertiary, marginTop: 1,
            transform: open && placement === 'bottom' ? 'rotate(180deg)' : 'rotate(0deg)',
          }}
        >
          <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open &&
        createPortal(
          <div
            ref={dropdownRef}
            style={{
              position: 'fixed', zIndex: 9999, ...pos,
              minWidth: 220, maxWidth: 320,
              background: token.colorBgContainer,
              border: `1px solid ${token.colorBorderSecondary}`,
              borderRadius: 16, boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
              overflow: 'hidden',
            }}
          >
            <div style={{ padding: '4px 0' }}>
              {PRESET_ORDER.map((key) => {
                const mapped = agentModels[key] || PRESET_DEFAULTS[key];
                const isActive = mapped === agentModel;
                return (
                  <button
                    key={key}
                    style={{
                      display: 'flex', alignItems: 'center', width: '100%', gap: 8,
                      padding: '8px 14px', border: 'none', cursor: 'pointer',
                      textAlign: 'left', transition: 'background 0.1s',
                      outline: 'none', fontFamily: 'inherit',
                      color: token.colorText,
                      background: isActive ? token.colorPrimaryBg : 'transparent',
                    }}
                    onClick={() => {
                      setAgentModel(mapped);
                      setOpen(false);
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) (e.currentTarget as HTMLElement).style.background = token.colorFillSecondary;
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent';
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span style={{
                        fontSize: 13, fontWeight: 500,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        display: 'block',
                      }}>
                        {PRESET_LABELS[key]}
                      </span>
                    </div>
                    <span style={{ fontSize: 11, color: token.colorTextTertiary, flexShrink: 0 }}>
                      {mapped}
                    </span>
                    {isActive && (
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
                        <path d="M3 7L5.5 9.5L11 4" stroke={token.colorPrimary} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </button>
                );
              })}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
