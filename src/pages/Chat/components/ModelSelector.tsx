import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { App } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useModelStore } from '../../../stores/modelStore';
import { ModelFormModal, getModePreset } from '../../../components/common/ModelFormModal';
import type { ProviderType, ModelConfigInput } from '@shared/types';

const providerMeta: Record<ProviderType, { label: string; color: string; bg: string }> = {
  anthropic: { label: 'Anthropic', color: '#d97706', bg: '#fef3c7' },
  openai: { label: 'OpenAI', color: '#10b981', bg: '#d1fae5' },
  google: { label: 'Google', color: '#3b82f6', bg: '#dbeafe' },
  ollama: { label: 'Ollama', color: '#8b5cf6', bg: '#ede9fe' },
  lmstudio: { label: 'LM Studio', color: '#ec4899', bg: '#fce7f3' },
  custom: { label: 'Custom', color: '#6b7280', bg: '#f3f4f6' },
};

interface DropdownPos {
  top: number;
  right: number;
}

const addFormDefaults = {
  provider: 'openai' as const,
  model: 'gpt-4o',
  maxTokens: 4096,
  temperature: 0.7,
  topP: 1,
};

export function ModelSelector() {
  const { models, currentModelId, setCurrentModel, saveModel } = useModelStore();
  const { message } = App.useApp();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [pos, setPos] = useState<DropdownPos>({ top: 0, right: 0 });
  const [addModalOpen, setAddModalOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const current = models.find((m) => m.id === currentModelId);

  const updatePos = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
  }, []);

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
        <button style={styles.emptyBtn} onClick={handleOpenAdd}>
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
        style={styles.trigger}
        onClick={() => setOpen(!open)}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.background = 'var(--ant-color-fill-secondary)';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.background = 'transparent';
        }}
      >
        <span style={{ ...styles.dot, background: meta.color }} />
        <span style={styles.triggerText}>{current?.name || '选择模型'}</span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          style={{
            ...styles.chevron,
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
          }}
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
              ...styles.dropdown,
              top: pos.top,
              right: pos.right,
            }}
          >
            {models.length > 5 && (
              <div style={styles.searchWrap}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0, opacity: 0.4 }}>
                  <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M9.5 9.5L12.5 12.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                <input
                  ref={inputRef}
                  style={styles.searchInput}
                  placeholder="搜索模型..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            )}

            <div style={styles.list}>
              {filteredGroups.size === 0 && <div style={styles.noResult}>无匹配模型</div>}
              {Array.from(filteredGroups.entries()).map(([provider, list]) => {
                const pMeta = providerMeta[provider];
                return (
                  <div key={provider}>
                    <div style={styles.groupLabel}>
                      <span style={{ ...styles.dot, background: pMeta.color, width: 6, height: 6 }} />
                      {pMeta.label}
                    </div>
                    {list.map((m) => {
                      const isActive = m.id === currentModelId;
                      return (
                        <button
                          key={m.id}
                          style={{ ...styles.item, ...(isActive ? styles.itemActive : {}) }}
                          onClick={() => {
                            setCurrentModel(m.id);
                            setOpen(false);
                            setSearch('');
                          }}
                          onMouseEnter={(e) => {
                            if (!isActive) (e.currentTarget as HTMLElement).style.background = 'var(--ant-color-fill-secondary)';
                          }}
                          onMouseLeave={(e) => {
                            if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent';
                          }}
                        >
                          <div style={styles.itemMain}>
                            <span style={styles.itemName}>{m.name}</span>
                            {m.thinking && <span style={styles.thinkingTag}>思考</span>}
                          </div>
                          <span style={styles.itemModel}>{m.model}</span>
                          {isActive && (
                            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
                              <path d="M3 7L5.5 9.5L11 4" stroke="var(--ant-color-primary)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>

            <div style={styles.footer}>
              <button style={styles.addBtn} onClick={handleOpenAdd}>
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

const styles: Record<string, React.CSSProperties> = {
  emptyBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    padding: '5px 12px',
    border: '1px dashed var(--ant-color-border)',
    borderRadius: 10,
    background: 'transparent',
    cursor: 'pointer',
    fontSize: 12,
    color: 'var(--ant-color-primary)',
    transition: 'all 0.15s',
    outline: 'none',
    fontFamily: 'inherit',
  },
  trigger: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '5px 10px',
    border: 'none',
    borderRadius: 10,
    background: 'transparent',
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 500,
    color: 'var(--ant-color-text)',
    lineHeight: 1.4,
    transition: 'background 0.15s',
    outline: 'none',
    fontFamily: 'inherit',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    flexShrink: 0,
  },
  triggerText: {
    maxWidth: 180,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  chevron: {
    flexShrink: 0,
    transition: 'transform 0.2s ease',
    color: 'var(--ant-color-text-tertiary)',
    marginTop: 1,
  },
  dropdown: {
    position: 'fixed',
    zIndex: 9999,
    minWidth: 240,
    maxWidth: 340,
    background: 'var(--ant-color-bg-container)',
    border: '1px solid var(--ant-color-border-secondary)',
    borderRadius: 16,
    boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
    overflow: 'hidden',
    animation: 'modelDropdownIn 0.15s ease-out',
  },
  searchWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '10px 12px',
    borderBottom: '1px solid var(--ant-color-border-secondary)',
    color: 'var(--ant-color-text)',
  },
  searchInput: {
    flex: 1,
    border: 'none',
    outline: 'none',
    background: 'transparent',
    fontSize: 13,
    color: 'var(--ant-color-text)',
    fontFamily: 'inherit',
  },
  list: {
    maxHeight: 280,
    overflowY: 'auto',
    padding: '4px 0',
  },
  groupLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '8px 14px 4px',
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--ant-color-text-tertiary)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.03em',
  },
  item: {
    display: 'flex',
    alignItems: 'center',
    width: '100%',
    gap: 8,
    padding: '8px 14px',
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'background 0.1s',
    outline: 'none',
    fontFamily: 'inherit',
    color: 'var(--ant-color-text)',
  },
  itemActive: {
    background: 'var(--ant-color-primary-bg)',
  },
  itemMain: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  itemName: {
    fontSize: 13,
    fontWeight: 500,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  thinkingTag: {
    fontSize: 10,
    padding: '1px 5px',
    borderRadius: 6,
    background: 'var(--ant-color-warning-bg)',
    color: 'var(--ant-color-warning)',
    fontWeight: 500,
    flexShrink: 0,
  },
  itemModel: {
    fontSize: 11,
    color: 'var(--ant-color-text-tertiary)',
    flexShrink: 0,
  },
  noResult: {
    padding: '16px 14px',
    fontSize: 13,
    color: 'var(--ant-color-text-tertiary)',
    textAlign: 'center',
  },
  footer: {
    padding: '6px 10px',
    borderTop: '1px solid var(--ant-color-border-secondary)',
  },
  addBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    width: '100%',
    padding: '6px 0',
    border: 'none',
    borderRadius: 6,
    background: 'transparent',
    cursor: 'pointer',
    fontSize: 12,
    color: 'var(--ant-color-primary)',
    transition: 'background 0.1s',
    outline: 'none',
    fontFamily: 'inherit',
  },
};
