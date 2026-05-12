import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Modal, Form, Input, Button, App } from 'antd';
import { FileTextOutlined, CloseCircleFilled } from '@ant-design/icons';
import { usePromptStore } from '../../../stores/promptStore';
import { useChatStore } from '../../../stores/chatStore';
import { api } from '../../../services/ipcBridge';
import type { PromptTemplate } from '@shared/types';

interface DropdownPos {
  top: number;
  left: number;
}

/** 独立子组件：form 实例在组件内部创建 */
function VariableForm({ template, onConfirm, onCancel }: {
  template: PromptTemplate;
  onConfirm: (content: string) => void;
  onCancel: () => void;
}) {
  const [form] = Form.useForm();
  const { message } = App.useApp();

  useEffect(() => {
    const defaults: Record<string, string> = {};
    template.variables.forEach((v) => {
      if (v.defaultValue) defaults[v.name] = v.defaultValue;
    });
    form.setFieldsValue(defaults);
  }, [template, form]);

  const handleOk = async () => {
    try {
      await form.validateFields();
      const variables: Record<string, string> = {};
      template.variables.forEach((v) => {
        variables[v.name] = form.getFieldValue(v.name) || '';
      });
      const content = await api.prompt.interpolate(template.content, variables);
      onConfirm(content);
    } catch (err: unknown) {
      if ((err as { errorFields?: unknown })?.errorFields) return;
      message.error(`激活失败: ${(err as Error)?.message || err}`);
    }
  };

  return (
    <>
      <Form form={form} layout="vertical">
        {template.variables.map((v) => (
          <Form.Item key={v.name} name={v.name} label={v.label} rules={[{ required: v.required }]}>
            {v.type === 'textarea' ? (
              <Input.TextArea rows={3} placeholder={v.placeholder} />
            ) : (
              <Input placeholder={v.placeholder} />
            )}
          </Form.Item>
        ))}
      </Form>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
        <Button onClick={onCancel}>取消</Button>
        <Button type="primary" onClick={handleOk}>启用</Button>
      </div>
    </>
  );
}

export function PromptSelector() {
  const prompts = usePromptStore((s) => s.prompts);
  const currentConversationId = useChatStore((s) => s.currentConversationId);
  const activePromptMap = useChatStore((s) => s.activePromptMap);
  const setActivePrompt = useChatStore((s) => s.setActivePrompt);
  const removeActivePrompt = useChatStore((s) => s.removeActivePrompt);
  const { message } = App.useApp();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [pos, setPos] = useState<DropdownPos>({ top: 0, left: 0 });
  const [variableModalOpen, setVariableModalOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<PromptTemplate | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const activeMap = currentConversationId ? (activePromptMap[currentConversationId] || {}) : {};
  const activeIds = useMemo(() => new Set(Object.keys(activeMap)), [activeMap]);
  const activeCount = activeIds.size;

  const updatePos = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setPos({ top: rect.bottom + 4, left: rect.left });
  }, []);

  const filteredPrompts = useMemo(() => {
    if (!search.trim()) return prompts;
    const q = search.toLowerCase();
    return prompts.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q),
    );
  }, [prompts, search]);

  const activePrompts = useMemo(
    () => prompts.filter((p) => activeIds.has(p.id)),
    [prompts, activeIds],
  );

  const availablePrompts = useMemo(
    () => filteredPrompts.filter((p) => !activeIds.has(p.id)),
    [filteredPrompts, activeIds],
  );

  // 点击外部关闭
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
      usePromptStore.getState().loadPrompts();
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

  const handleActivate = (template: PromptTemplate) => {
    if (!currentConversationId) {
      message.warning('请先创建或选择一个对话');
      return;
    }
    if (template.variables.length > 0) {
      setSelectedTemplate(template);
      setVariableModalOpen(true);
    } else {
      setActivePrompt(currentConversationId, template.id, template.content);
      message.success(`已启用: ${template.name}`);
    }
  };

  const handleRemove = (promptId: string) => {
    if (!currentConversationId) return;
    removeActivePrompt(currentConversationId, promptId);
  };

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
        <FileTextOutlined style={{ fontSize: 14, color: activeCount > 0 ? 'var(--ant-color-primary)' : 'var(--ant-color-text-tertiary)' }} />
        {activeCount > 0 && (
          <span style={styles.badge}>{activeCount}</span>
        )}
      </button>

      {open &&
        createPortal(
          <div
            ref={dropdownRef}
            className="prompt-dropdown"
            style={{
              ...styles.dropdown,
              top: pos.top,
              left: pos.left,
            }}
          >
            <div style={styles.searchWrap}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0, opacity: 0.4 }}>
                <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.5" />
                <path d="M9.5 9.5L12.5 12.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <input
                ref={inputRef}
                style={styles.searchInput}
                placeholder="搜索 Prompt..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {activePrompts.length > 0 && (
              <div style={styles.section}>
                <div style={styles.sectionLabel}>已启用</div>
                {activePrompts.map((p) => (
                  <div key={p.id} style={styles.activeItem}>
                    <div style={styles.activeItemMain}>
                      <span style={styles.activeItemName}>{p.name}</span>
                      <span style={styles.activeItemCategory}>{p.category}</span>
                    </div>
                    <CloseCircleFilled
                      style={styles.removeBtn}
                      onClick={() => handleRemove(p.id)}
                    />
                  </div>
                ))}
              </div>
            )}

            <div style={styles.list}>
              {availablePrompts.length === 0 && activePrompts.length === 0 && (
                <div style={styles.noResult}>无可用 Prompt</div>
              )}
              {availablePrompts.length > 0 && (
                <>
                  {activePrompts.length > 0 && <div style={styles.divider} />}
                  {availablePrompts.map((p) => (
                    <button
                      key={p.id}
                      style={styles.item}
                      onClick={() => handleActivate(p)}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLElement).style.background = 'var(--ant-color-fill-secondary)';
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLElement).style.background = 'transparent';
                      }}
                    >
                      <div style={styles.itemMain}>
                        <span style={styles.itemName}>{p.name}</span>
                        {p.variables.length > 0 && (
                          <span style={styles.variableTag}>含变量</span>
                        )}
                      </div>
                      <span style={styles.itemCategory}>{p.category}</span>
                    </button>
                  ))}
                </>
              )}
            </div>
          </div>,
          document.body,
        )}

      {/* 变量填写弹窗 - form 在 VariableForm 内部创建 */}
      <Modal
        title={`填写变量: ${selectedTemplate?.name}`}
        open={variableModalOpen}
        onCancel={() => setVariableModalOpen(false)}
        width={480}
        destroyOnHidden
        footer={null}
      >
        {variableModalOpen && selectedTemplate && (
          <VariableForm
            template={selectedTemplate}
            onConfirm={(content) => {
              setActivePrompt(currentConversationId!, selectedTemplate.id, content);
              message.success(`已启用: ${selectedTemplate.name}`);
              setVariableModalOpen(false);
            }}
            onCancel={() => setVariableModalOpen(false)}
          />
        )}
      </Modal>
    </>
  );
}

const styles: Record<string, React.CSSProperties> = {
  trigger: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    padding: '5px 8px',
    border: 'none',
    borderRadius: 10,
    background: 'transparent',
    cursor: 'pointer',
    transition: 'background 0.15s',
    outline: 'none',
    fontFamily: 'inherit',
  },
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 16,
    height: 16,
    padding: '0 4px',
    borderRadius: 10,
    background: 'var(--ant-color-primary)',
    color: '#fff',
    fontSize: 10,
    fontWeight: 600,
    lineHeight: 1,
  },
  dropdown: {
    position: 'fixed',
    zIndex: 9999,
    minWidth: 260,
    maxWidth: 360,
    background: 'var(--ant-color-bg-container)',
    border: '1px solid var(--ant-color-border-secondary)',
    borderRadius: 16,
    boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
    overflow: 'hidden',
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
  section: {
    padding: '6px 0',
  },
  sectionLabel: {
    padding: '4px 14px',
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--ant-color-text-tertiary)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.03em',
  },
  activeItem: {
    display: 'flex',
    alignItems: 'center',
    padding: '6px 14px',
    gap: 8,
  },
  activeItemMain: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  activeItemName: {
    fontSize: 13,
    fontWeight: 500,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  activeItemCategory: {
    fontSize: 11,
    color: 'var(--ant-color-text-tertiary)',
    flexShrink: 0,
  },
  removeBtn: {
    fontSize: 14,
    color: 'var(--ant-color-text-quaternary)',
    cursor: 'pointer',
    flexShrink: 0,
    transition: 'color 0.15s',
  },
  divider: {
    height: 1,
    background: 'var(--ant-color-border-secondary)',
    margin: '2px 0',
  },
  list: {
    maxHeight: 280,
    overflowY: 'auto',
    padding: '4px 0',
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
  variableTag: {
    fontSize: 10,
    padding: '1px 5px',
    borderRadius: 6,
    background: 'var(--ant-color-info-bg)',
    color: 'var(--ant-color-info)',
    fontWeight: 500,
    flexShrink: 0,
  },
  itemCategory: {
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
};
