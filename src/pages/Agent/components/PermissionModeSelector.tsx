import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { theme } from 'antd';
import type { AgentPermissionMode } from '@shared/types/agent';
import { useAgentStore } from '../../../stores/agentStore';

const MODES: { key: AgentPermissionMode; label: string; desc: string }[] = [
  { key: 'default', label: 'Default', desc: '每次操作需确认' },
  { key: 'acceptEdits', label: 'Auto-edit', desc: '自动允许文件编辑' },
  { key: 'plan', label: 'Plan', desc: '只读探索，不执行修改' },
  { key: 'bypassPermissions', label: 'Bypass', desc: '跳过所有权限检查' },
];

export function PermissionModeSelector({ placement = 'bottom' }: { placement?: 'top' | 'bottom' } = {}) {
  const { token } = theme.useToken();
  const permissionMode = useAgentStore((s) => s.permissionMode);
  const setPermissionMode = useAgentStore((s) => s.setPermissionMode);

  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top?: number; bottom?: number; left: number }>({ left: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const current = MODES.find((m) => m.key === permissionMode) || MODES[0];

  const updatePos = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    if (placement === 'top') {
      setPos({ bottom: window.innerHeight - rect.top + 4, left: rect.left });
    } else {
      setPos({ top: rect.bottom + 4, left: rect.left });
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

  // 根据模式选择颜色
  const modeColor = permissionMode === 'plan' ? token.colorWarning
    : permissionMode === 'bypassPermissions' ? token.colorError
    : permissionMode === 'acceptEdits' ? token.colorSuccess
    : token.colorTextSecondary;

  return (
    <>
      <button
        ref={triggerRef}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          padding: '4px 8px', border: 'none', borderRadius: 8,
          background: 'transparent', cursor: 'pointer', fontSize: 12,
          fontWeight: 500, color: modeColor, lineHeight: 1.4,
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
          width: 6, height: 6, borderRadius: '50%', background: modeColor, flexShrink: 0,
        }} />
        <span>{current.label}</span>
        <svg
          width="10" height="10" viewBox="0 0 12 12" fill="none"
          style={{
            flexShrink: 0, transition: 'transform 0.2s ease',
            color: token.colorTextQuaternary, marginTop: 1,
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
              minWidth: 200, maxWidth: 280,
              background: token.colorBgContainer,
              border: `1px solid ${token.colorBorderSecondary}`,
              borderRadius: 12, boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
              overflow: 'hidden',
            }}
          >
            <div style={{ padding: '4px 0' }}>
              {MODES.map((m) => {
                const isActive = m.key === permissionMode;
                const color = m.key === 'plan' ? token.colorWarning
                  : m.key === 'bypassPermissions' ? token.colorError
                  : m.key === 'acceptEdits' ? token.colorSuccess
                  : token.colorTextSecondary;
                return (
                  <button
                    key={m.key}
                    style={{
                      display: 'flex', alignItems: 'center', width: '100%', gap: 8,
                      padding: '8px 12px', border: 'none', cursor: 'pointer',
                      textAlign: 'left', transition: 'background 0.1s',
                      outline: 'none', fontFamily: 'inherit',
                      color: token.colorText,
                      background: isActive ? token.colorPrimaryBg : 'transparent',
                    }}
                    onClick={() => {
                      setPermissionMode(m.key);
                      setOpen(false);
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) (e.currentTarget as HTMLElement).style.background = token.colorFillSecondary;
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent';
                    }}
                  >
                    <span style={{
                      width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0,
                    }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ fontSize: 13, fontWeight: 500 }}>{m.label}</span>
                      <span style={{ fontSize: 11, color: token.colorTextTertiary, marginLeft: 6 }}>{m.desc}</span>
                    </div>
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
