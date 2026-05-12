import { safeStorage } from 'electron';
import fs from 'fs';
import path from 'path';
import { app } from 'electron';

class SecureStore {
  private storePath: string;
  private cache: Map<string, string> = new Map();

  constructor() {
    this.storePath = path.join(app.getPath('userData'), 'secrets.bin');
    this.load();
  }

  private load(): void {
    try {
      if (fs.existsSync(this.storePath)) {
        const encrypted = fs.readFileSync(this.storePath);
        const json = safeStorage.decryptString(encrypted);
        const data = JSON.parse(json) as Record<string, string>;
        for (const [k, v] of Object.entries(data)) {
          this.cache.set(k, v);
        }
      }
    } catch {
      // 文件损坏则忽略
    }
  }

  private save(): void {
    const data: Record<string, string> = {};
    for (const [k, v] of this.cache) {
      data[k] = v;
    }
    const encrypted = safeStorage.encryptString(JSON.stringify(data));
    fs.writeFileSync(this.storePath, encrypted);
  }

  get(key: string): string | null {
    return this.cache.get(key) ?? null;
  }

  set(key: string, value: string): void {
    this.cache.set(key, value);
    this.save();
  }

  delete(key: string): void {
    this.cache.delete(key);
    this.save();
  }

  /** 获取脱敏后的 Key 显示值 */
  getMasked(key: string): string | null {
    const value = this.cache.get(key);
    if (!value || value.length < 8) return null;
    return `${value.slice(0, 3)}****${value.slice(-4)}`;
  }
}

let instance: SecureStore | null = null;

export function getSecureStore(): SecureStore {
  if (!instance) {
    instance = new SecureStore();
  }
  return instance;
}
