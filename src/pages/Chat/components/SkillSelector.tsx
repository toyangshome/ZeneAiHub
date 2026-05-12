import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Modal, Form, Input, InputNumber, Switch, Button, App } from 'antd';
import { ThunderboltOutlined, CloseCircleFilled } from '@ant-design/icons';
import { useSkillStore } from '../../../stores/skillStore';
import { useChatStore } from '../../../stores/chatStore';
import type { Skill } from '@shared/types';

interface DropdownPos {
  top: number;
  left: number;
}

/** 独立子组件：form 实例在组件内部创建，避免 React 19 "useForm not connected" 警告 */
function SkillParamForm({ skill, onConfirm, onCancel }: {
  skill: Skill;
  onConfirm: (values: Record<string, unknown>) => void;
  onCancel: () => void;
}) {
  const [form] = Form.useForm();
  const { message } = App.useApp();

  // 初始化默认值
  useEffect(() => {
    const defaults: Record<string, unknown> = {};
    skill.parameters.forEach((p) => {
      if (p.defaultValue !== undefined) defaults[p.name] = p.defaultValue;
    });
    form.setFieldsValue(defaults);
  }, [skill, form]);

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      onConfirm(values);
    } catch (err: unknown) {
      if ((err as { errorFields?: unknown })?.errorFields) return;
      message.error(`激活失败: ${(err as Error)?.message || err}`);
    }
  };

  const renderField = (param: Skill['parameters'][number]) => {
    switch (param.type) {
      case 'number':
        return <InputNumber style={{ width: '100%' }} placeholder={param.description || param.label} />;
      case 'boolean':
        return <Switch />;
      default:
        return <Input placeholder={param.description || param.label} />;
    }
  };

  return (
    <>
      <Form form={form} layout="vertical">
        {skill.parameters.map((param) => (
          <Form.Item
            key={param.name}
            name={param.name}
            label={param.label || param.name}
            rules={[{ required: param.required, message: `请填写 ${param.label || param.name}` }]}
            extra={param.description}
          >
            {renderField(param)}
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

export function SkillSelector() {
  const skills = useSkillStore((s) => s.skills);
  const currentConversationId = useChatStore((s) => s.currentConversationId);
  const activePromptMap = useChatStore((s) => s.activePromptMap);
  const setActivePrompt = useChatStore((s) => s.setActivePrompt);
  const removeActivePrompt = useChatStore((s) => s.removeActivePrompt);
  const { message } = App.useApp();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [pos, setPos] = useState<DropdownPos>({ top: 0, left: 0 });
  const [paramModalOpen, setParamModalOpen] = useState(false);
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const activeMap = currentConversationId ? (activePromptMap[currentConversationId] || {}) : {};
  const activeSkillIds = useMemo(() => {
    const ids = new Set<string>();
    for (const key of Object.keys(activeMap)) {
      if (skills.some((s) => s.id === key)) ids.add(key);
    }
    return ids;
  }, [activeMap, skills]);
  const activeCount = activeSkillIds.size;

  const updatePos = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setPos({ top: rect.bottom + 4, left: rect.left });
  }, []);

  const filteredSkills = useMemo(() => {
    if (!search.trim()) return skills.filter((s) => s.enabled);
    const q = search.toLowerCase();
    return skills.filter(
      (s) =>
        s.enabled &&
        (s.name.toLowerCase().includes(q) ||
          s.description.toLowerCase().includes(q) ||
          s.category.toLowerCase().includes(q)),
    );
  }, [skills, search]);

  const activeSkills = useMemo(
    () => skills.filter((s) => activeSkillIds.has(s.id)),
    [skills, activeSkillIds],
  );

  const availableSkills = useMemo(
    () => filteredSkills.filter((s) => !activeSkillIds.has(s.id)),
    [filteredSkills, activeSkillIds],
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
      useSkillStore.getState().loadSkills();
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

  const handleActivate = (skill: Skill) => {
    if (!currentConversationId) {
      message.warning('请先创建或选择一个对话');
      return;
    }
    if (skill.parameters.length > 0) {
      setSelectedSkill(skill);
      setParamModalOpen(true);
    } else {
      activateSkill(skill, {});
    }
  };

  const activateSkill = (skill: Skill, params: Record<string, unknown>) => {
    if (!currentConversationId) return;
    const interpolated = skill.systemPrompt.replace(/\{\{(\w+)\}\}/g, (match, name) => {
      const v = params[name];
      return v !== undefined ? String(v) : match;
    });
    setActivePrompt(currentConversationId, skill.id, interpolated);
    message.success(`已启用 Skill: ${skill.name}`);
    setOpen(false);
  };

  const handleRemove = (skillId: string) => {
    if (!currentConversationId) return;
    removeActivePrompt(currentConversationId, skillId);
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
        <ThunderboltOutlined style={{ fontSize: 14, color: activeCount > 0 ? 'var(--ant-color-primary)' : 'var(--ant-color-text-tertiary)' }} />
        {activeCount > 0 && (
          <span style={styles.badge}>{activeCount}</span>
        )}
      </button>

      {open &&
        createPortal(
          <div
            ref={dropdownRef}
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
                placeholder="搜索 Skill..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {activeSkills.length > 0 && (
              <div style={styles.section}>
                <div style={styles.sectionLabel}>已启用</div>
                {activeSkills.map((s) => (
                  <div key={s.id} style={styles.activeItem}>
                    <div style={styles.activeItemMain}>
                      {s.icon && <span>{s.icon}</span>}
                      <span style={styles.activeItemName}>{s.name}</span>
                      <span style={styles.activeItemCategory}>{s.category}</span>
                    </div>
                    <CloseCircleFilled
                      style={styles.removeBtn}
                      onClick={() => handleRemove(s.id)}
                    />
                  </div>
                ))}
              </div>
            )}

            <div style={styles.list}>
              {availableSkills.length === 0 && activeSkills.length === 0 && (
                <div style={styles.noResult}>无可用 Skill</div>
              )}
              {availableSkills.length > 0 && (
                <>
                  {activeSkills.length > 0 && <div style={styles.divider} />}
                  {availableSkills.map((s) => (
                    <button
                      key={s.id}
                      style={styles.item}
                      onClick={() => handleActivate(s)}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLElement).style.background = 'var(--ant-color-fill-secondary)';
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLElement).style.background = 'transparent';
                      }}
                    >
                      <div style={styles.itemMain}>
                        {s.icon && <span style={{ flexShrink: 0 }}>{s.icon}</span>}
                        <span style={styles.itemName}>{s.name}</span>
                        {s.parameters.length > 0 && (
                          <span style={styles.paramTag}>含参数</span>
                        )}
                      </div>
                      <span style={styles.itemCategory}>{s.category}</span>
                    </button>
                  ))}
                </>
              )}
            </div>
          </div>,
          document.body,
        )}

      {/* 参数填写弹窗 - form 在 SkillParamForm 内部创建 */}
      <Modal
        title={`填写参数: ${selectedSkill?.icon || ''} ${selectedSkill?.name || ''}`}
        open={paramModalOpen}
        onCancel={() => setParamModalOpen(false)}
        width={480}
        destroyOnHidden
        footer={null}
      >
        {paramModalOpen && selectedSkill && (
          <SkillParamForm
            skill={selectedSkill}
            onConfirm={(values) => {
              activateSkill(selectedSkill, values);
              setParamModalOpen(false);
            }}
            onCancel={() => setParamModalOpen(false)}
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
  paramTag: {
    fontSize: 10,
    padding: '1px 5px',
    borderRadius: 6,
    background: 'var(--ant-color-warning-bg)',
    color: 'var(--ant-color-warning)',
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
