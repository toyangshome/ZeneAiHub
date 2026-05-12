import { Form, Input, InputNumber, Switch, Modal, App } from 'antd';
import { useNavigate } from 'react-router-dom';
import { useSkillStore } from '../../../stores/skillStore';
import type { Skill } from '@shared/types';

interface Props {
  skill: Skill;
  open: boolean;
  onClose: () => void;
}

/** 子组件：form 实例在内部创建，仅在 Modal 打开时挂载 */
function SkillParamForm({ skill, onConfirm, onCancel }: {
  skill: Skill;
  onConfirm: (values: Record<string, unknown>) => void;
  onCancel: () => void;
}) {
  const [form] = Form.useForm();
  const { message } = App.useApp();

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      onConfirm(values);
    } catch (err: unknown) {
      if ((err as { errorFields?: unknown })?.errorFields) return;
      message.error(`执行失败: ${(err as Error)?.message || err}`);
    }
  };

  const renderField = (param: Skill['parameters'][number]) => {
    switch (param.type) {
      case 'number':
        return <InputNumber style={{ width: '100%' }} placeholder={param.description || `输入 ${param.label}`} />;
      case 'boolean':
        return <Switch />;
      default:
        return <Input placeholder={param.description || `输入 ${param.label}`} />;
    }
  };

  return (
    <>
      {skill.description && (
        <p style={{ color: 'var(--ant-color-text-secondary)', marginBottom: 16 }}>
          {skill.description}
        </p>
      )}
      <Form form={form} layout="vertical">
        {skill.parameters.map((param) => (
          <Form.Item
            key={param.name}
            name={param.name}
            label={param.label || param.name}
            rules={[{ required: param.required, message: `请填写 ${param.label || param.name}` }]}
            initialValue={param.defaultValue}
            extra={param.description}
          >
            {renderField(param)}
          </Form.Item>
        ))}
      </Form>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
        <button onClick={onCancel} style={{ padding: '4px 15px', cursor: 'pointer' }}>取消</button>
        <button onClick={handleOk} style={{ padding: '4px 15px', cursor: 'pointer', background: 'var(--ant-color-primary)', color: '#fff', border: 'none', borderRadius: 6 }}>执行</button>
      </div>
    </>
  );
}

export default function SkillExecute({ skill, open, onClose }: Props) {
  const navigate = useNavigate();
  const { message } = App.useApp();
  const executeSkill = useSkillStore((s) => s.executeSkill);

  return (
    <Modal
      title={`执行 Skill: ${skill.icon || ''} ${skill.name}`}
      open={open}
      onCancel={onClose}
      width={520}
      destroyOnHidden
      footer={null}
    >
      {open && (
        <SkillParamForm
          skill={skill}
          onConfirm={async (values) => {
            try {
              await executeSkill(skill.id, values as Record<string, string | number | boolean>);
              message.success(`Skill "${skill.name}" 已执行`);
              onClose();
              navigate('/chat');
            } catch (err: unknown) {
              message.error(`执行失败: ${(err as Error)?.message || err}`);
            }
          }}
          onCancel={onClose}
        />
      )}
    </Modal>
  );
}
