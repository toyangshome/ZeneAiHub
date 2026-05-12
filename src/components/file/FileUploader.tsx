import { useCallback, type FC } from 'react';
import { Upload, App } from 'antd';
import { InboxOutlined } from '@ant-design/icons';
import { api } from '../../services/ipcBridge';
import type { FileParseResult } from '@shared/types';

interface FileUploaderProps {
  onFileLoaded: (result: FileParseResult, fileName: string) => void;
  accept?: string;
}

export const FileUploader: FC<FileUploaderProps> = ({ onFileLoaded, accept }) => {
  const { message } = App.useApp();
  const handleFile = useCallback(async (file: File) => {
    try {
      const filePath = file.path || file.name;
      const result = await api.file.read(filePath);
      onFileLoaded(result, file.name);
      message.success(`已加载: ${file.name}`);
    } catch (err: unknown) {
      const e = err as Error;
      message.error(e.message || '文件读取失败');
    }
    return false; // 阻止 antd 默认上传
  }, [onFileLoaded]);

  return (
    <Upload.Dragger
      beforeUpload={handleFile}
      showUploadList={false}
      accept={accept}
      multiple
    >
      <p className="ant-upload-drag-icon"><InboxOutlined /></p>
      <p className="ant-upload-text">拖拽文件到此处，或点击选择</p>
      <p className="ant-upload-hint">支持文本、代码、图片、PDF、Word、Excel 等文件</p>
    </Upload.Dragger>
  );
};
