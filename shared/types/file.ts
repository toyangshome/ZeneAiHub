/** Electron 渲染进程中 File 对象携带本地文件路径 */
declare global {
  interface File {
    path: string;
  }
}

/** 文件附件 */
export interface FileAttachment {
  id: string;
  messageId?: string;
  conversationId?: string;
  name: string;
  mimeType: string;
  size: number;
  storagePath: string;
  preview?: string;
  createdAt: number;
}

/** 文件解析结果 */
export interface FileParseResult {
  type: 'text' | 'image' | 'binary';
  content: string;            // 文本内容或 base64
  language?: string;          // 代码语言
  mimeType: string;
}

export {};
