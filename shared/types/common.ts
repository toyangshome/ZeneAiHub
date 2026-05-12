/** 文件选择过滤器 */
export interface FileFilter {
  name: string;
  extensions: string[];
}

/** 应用信息 */
export interface AppInfo {
  platform: string;
  version: string;
  electronVersion: string;
}

/** 系统路径名 */
export type SystemPathName = 'home' | 'appData' | 'userData' | 'temp' | 'desktop';
