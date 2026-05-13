import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { App, theme } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useModelStore } from '../../../stores/modelStore';
import { ModelFormModal, getModePreset } from '../../../components/common/ModelFormModal';
import type { ProviderType, ModelConfigInput } from '@shared/types';

const providerMeta: Record<ProviderType, { label: string; color: string }> = {
  anthropic: { label: 'Anthropic', color: '#d97706' },
  openai: { label: 'OpenAI', color: '#10b981' },
  google: { label: 'Google', color: '#3b82f6' },
  ollama: { label: 'Ollama', color: '#8b5cf6' },
  lmstudio: { label: 'LM Studio', color: '#ec4899' },
  custom: { label: 'Custom', color: '#6b7280' },
};

interface DropdownPos {
  top?: number;
  bottom?: number;
  right: number;
}

const addFormDefaults = {
  provider: 'openai' as const,
  model: 'gpt-4o',
  maxTokens: 4096,
  temperature: 0.7,
  topP: 1,
};

export function ModelSelector({ placement = 'bottom' }: { placement?: 'top' | 'bottom' } = {}) {
  const { models, currentModelId, setCurrentModel, saveModel } = useModelStore();
  const { message } = App.useApp();
  const { token } = theme.useToken();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [pos, setPos] = useState<DropdownPos>({ right: 0 });
  const [addModalOpen, setAddModalOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const current = models.find((m) => m.id === currentModelId);

  const updatePos = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    if (placement === 'top') {
      setPos({ bottom: window.innerHeight - rect.top + 4, right: window.innerWidth - rect.right });
    } else {
      setPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
    }
  }, [placement]);

  const grouped = useMemo(() => {
    const map = new Map<ProviderType, typeof models>();
    for (const m of models) {
      const list = map.get(m.provider) || [];
      list.push(m);
      map.set(m.provider, list);
    }
    return map;
  }, [models]);

  const filteredGroups = useMemo(() => {
    if (!search.trim()) return grouped;
    const q = search.toLowerCase();
    const map = new Map<ProviderType, typeof models>();
    for (const [provider, list] of grouped) {
      const filtered = list.filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          m.model.toLowerCase().includes(q) ||
          providerMeta[provider].label.toLowerCase().includes(q),
      );
      if (filtered.length > 0) map.set(provider, filtered);
    }
    return map;
  }, [grouped, search]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (dropdownRef.current?.contains(target)) return;
      setOpen(false);
      setSearch('');
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  useEffect(() => {
    if (open) {
      updatePos();
      setSearch('');
      requestAnimationFrame(() => inputRef.current?.focus());
    }
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

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  const handleOpenAdd = () => {
    setOpen(false);
    setAddModalOpen(true);
  };

  const handleAddSave = async (values: Record<string, unknown>) => {
    try {
      const input = {
        ...values,
        maxTokens: (values.maxTokens as number) ?? getModePreset('balanced').maxTokens,
        temperature: (values.temperature as number) ?? getModePreset('balanced').temperature,
        topP: (values.topP as number) ?? getModePreset('balanced').topP,
      } as unknown as ModelConfigInput;
      await saveModel(input);
      message.success('模型已添加');
      setAddModalOpen(false);
      await useModelStore.getState().loadModels();
      const updated = useModelStore.getState().models;
      if (updated.length > 0 && !useModelStore.getState().currentModelId) {
        setCurrentModel(updated[0].id);
      }
    } catch (err: unknown) {
      const e = err as Error;
      message.error(`保存失败: ${e?.message || err}`);
    }
  };

  if (models.length === 0) {
    return (
      <>
        <button
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: '5px 12px', border: `1px dashed ${token.colorBorder}`,
            borderRadius: 10, background: 'transparent', cursor: 'pointer',
            fontSize: 12, color: token.colorPrimary, transition: 'all 0.15s',
            outline: 'none', fontFamily: 'inherit',
          }}
          onClick={handleOpenAdd}
        >
          <PlusOutlined style={{ fontSize: 12 }} />
          添加模型
        </button>
        <ModelFormModal
          open={addModalOpen}
          initialValues={addFormDefaults}
          onOk={handleAddSave}
          onCancel={() => setAddModalOpen(false)}
        />
      </>
    );
  }

  const meta = current ? providerMeta[current.provider] : providerMeta.custom;

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
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: meta.color, flexShrink: 0 }} />
        <span style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {current?.name || '选择模型'}
        </span>
        <svg
          width="12" height="12" viewBox="0 0 12 12" fill="none"
          style={{ flexShrink: 0, transition: 'transform 0.2s ease', color: token.colorTextTertiary, marginTop: 1,
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
        >
          <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open &&
        createPortal(
          <div
            ref={dropdownRef}
            className="model-dropdown"
            style={{
              position: 'fixed', zIndex: 9999,
              ...pos,
              minWidth: 240, maxWidth: 340,
              background: token.colorBgContainer,
              border: `1px solid ${token.colorBorderSecondary}`,
              borderRadius: 16, boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
              overflow: 'hidden', animation: 'modelDropdownIn 0.15s ease-out',
            }}
          >
            {models.length > 5 && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '10px 12px', borderBottom: `1px solid ${token.colorBorderSecondary}`,
                color: token.colorText,
              }}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0, opacity: 0.4 }}>
                  <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M9.5 9.5L12.5 12.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                <input
                  ref={inputRef}
                  style={{
                    flex: 1, border: 'none', outline: 'none', background: 'transparent',
                    fontSize: 13, color: token.colorText, fontFamily: 'inherit',
                  }}
                  placeholder="搜索模型..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            )}

            <div style={{ maxHeight: 280, overflowY: 'auto', padding: '4px 0' }}>
              {filteredGroups.size === 0 && (
                <div style={{ padding: '16px 14px', fontSize: 13, color: token.colorTextTertiary, textAlign: 'center' }}>
                  无匹配模型
                </div>
              )}
              {Array.from(filteredGroups.entries()).map(([provider, list]) => {
                const pMeta = providerMeta[provider];
                return (
                  <div key={provider}>
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '8px 14px 4px', fontSize: 11, fontWeight: 600,
                      color: token.colorTextTertiary, textTransform: 'uppercase' as const,
                      letterSpacing: '0.03em',
                    }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: pMeta.color, flexShrink: 0 }} />
                      {pMeta.label}
                    </div>
                    {list.map((m) => {
                      const isActive = m.id === currentModelId;
                      return (
                        <button
                          key={m.id}
                          style={{
                            display: 'flex', alignItems: 'center', width: '100%', gap: 8,
                            padding: '8px 14px', border: 'none', cursor: 'pointer',
                            textAlign: 'left', transition: 'background 0.1s',
                            outline: 'none', fontFamily: 'inherit',
                            color: token.colorText,
                            background: isActive ? token.colorPrimaryBg : 'transparent',
                          }}
                          onClick={() => {
                            setCurrentModel(m.id);
                            setOpen(false);
                            setSearch('');
                          }}
                          onMouseEnter={(e) => {
                            if (!isActive) (e.currentTarget as HTMLElement).style.background = token.colorFillSecondary;
                          }}
                          onMouseLeave={(e) => {
                            if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent';
                          }}
                        >
                          <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{
                              fontSize: 13, fontWeight: 500,
                              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            }}>
                              {m.name}
                            </span>
                            {m.thinking && (
                              <span style={{
                                fontSize: 10, padding: '1px 5px', borderRadius: 6,
                                background: token.colorWarningBg, color: token.colorWarning,
                                fontWeight: 500, flexShrink: 0,
                              }}>
                                思考
                              </span>
                            )}
                          </div>
                          <span style={{ fontSize: 11, color: token.colorTextTertiary, flexShrink: 0 }}>
                            {m.model}
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
                );
              })}
            </div>

            <div style={{ padding: '6px 10px', borderTop: `1px solid ${token.colorBorderSecondary}` }}>
              <button
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                  width: '100%', padding: '6px 0', border: 'none', borderRadius: 6,
                  background: 'transparent', cursor: 'pointer', fontSize: 12,
                  color: token.colorPrimary, transition: 'background 0.1s',
                  outline: 'none', fontFamily: 'inherit',
                }}
                onClick={handleOpenAdd}
              >
                <PlusOutlined style={{ fontSize: 12 }} />
                添加模型
              </button>
            </div>
          </div>,
          document.body,
        )}

      <ModelFormModal
        open={addModalOpen}
        initialValues={addFormDefaults}
        onOk={handleAddSave}
        onCancel={() => setAddModalOpen(false)}
      />
    </>
  );
}
