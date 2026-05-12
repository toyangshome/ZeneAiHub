import { useState, useCallback } from 'react';
import { Sender, Attachments } from '@ant-design/x';
import { App, Button, Badge } from 'antd';
import { PlusOutlined, CloseOutlined } from '@ant-design/icons';
import { useChatStore } from '../../../stores/chatStore';
import { useModelStore } from '../../../stores/modelStore';
import { api } from '../../../services/ipcBridge';
import type { FileParseResult } from '@shared/types';

interface AttachedFile {
  id: string;
  name: string;
  size: number;
  result: FileParseResult;
}

export function ChatInput() {
  const [value, setValue] = useState('');
  const [files, setFiles] = useState<AttachedFile[]>([]);
  const sendMessage = useChatStore((s) => s.sendMessage);
  const streaming = useChatStore((s) => s.streaming);
  const currentModelId = useModelStore((s) => s.currentModelId);
  const { message } = App.useApp();

  const handleSend = useCallback(async () => {
    const content = value.trim();
    if (!content || !currentModelId) return;

    let fullContent = content;
    if (files.length > 0) {
      const fileContents = files.map((f) =>
        `\n\n--- 文件: ${f.name} ---\n${f.result.content}`
      ).join('\n');
      fullContent = content + fileContents;
    }

    setValue('');
    setFiles([]);
    await sendMessage(fullContent, currentModelId);
  }, [value, currentModelId, sendMessage, files]);

  const handleCancel = useCallback(() => {
    useChatStore.getState().cancelStreaming();
  }, []);

  const readAndAddFile = useCallback(async (file: File) => {
    try {
      const filePath = file.path || file.name;
      const result = await api.file.read(filePath);
      setFiles((prev) => [...prev, { id: crypto.randomUUID(), name: file.name, size: file.size, result }]);
      message.success(`已加载: ${file.name}`);
    } catch (err: unknown) {
      const e = err as Error;
      message.error(e.message || '文件读取失败');
    }
  }, [message]);

  const handlePasteFile = useCallback(async (firstFile: File) => {
    await readAndAddFile(firstFile);
  }, [readAndAddFile]);

  const handleBeforeUpload = useCallback((file: File) => {
    readAndAddFile(file);
    return false;
  }, [readAndAddFile]);

  const handleRemoveFile = useCallback((id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const disabled = !currentModelId;

  return (
    <div style={{ padding: '0 24px 16px' }}>
      {files.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
          {files.map((f) => (
            <span
              key={f.id}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '2px 8px',
                fontSize: 12,
                borderRadius: 6,
                background: 'var(--ant-color-fill-tertiary)',
                color: 'var(--ant-color-text-secondary)',
                maxWidth: 240,
              }}
            >
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {f.name}
              </span>
              <span style={{ opacity: 0.5, fontSize: 11, flexShrink: 0 }}>
                {formatFileSize(f.size)}
              </span>
              <CloseOutlined
                style={{ fontSize: 10, cursor: 'pointer', opacity: 0.6 }}
                onClick={() => handleRemoveFile(f.id)}
              />
            </span>
          ))}
        </div>
      )}
      <Sender
        value={value}
        onChange={setValue}
        onSubmit={handleSend}
        onCancel={handleCancel}
        loading={streaming}
        disabled={disabled}
        placeholder={disabled ? '请先在设置中配置模型' : '输入消息...'}
        autoSize={{ minRows: 1, maxRows: 6 }}
        onPasteFile={handlePasteFile}
        actions={(oriNode) => (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {oriNode}
            <Attachments
              items={files.map((f) => ({
                uid: f.id,
                name: f.name,
                status: 'done',
                description: f.result.type,
              }))}
              onRemove={(item) => handleRemoveFile(item.uid)}
              beforeUpload={handleBeforeUpload}
              customRequest={({ onSuccess }) => { onSuccess?.('ok'); }}
              placeholder={{ title: '拖拽或点击上传文件', description: '支持文本、代码、PDF、Word、Excel 等文件' }}
              getDropContainer={() => document.body}
            >
              <Badge count={files.length} size="small" offset={[-2, 2]}>
                <Button
                  type="primary"
                  shape="circle"
                  icon={<PlusOutlined />}
                  disabled={disabled}
                />
              </Badge>
            </Attachments>
          </div>
        )}
      />
    </div>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}
