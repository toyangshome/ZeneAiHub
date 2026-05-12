import { createRequire } from 'module';
import type { ModelConfig } from '@shared/types';

// electron-store v10 是纯 ESM，需要 createRequire 在 CJS 中加载
const _require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- ESM/CJS 兼容层
const ElectronStore = _require('electron-store').default;

interface StoreSchema {
  'theme-mode': 'light' | 'dark' | 'system';
  'sider-collapsed': boolean;
  'models': ModelConfig[];
  'current-model-id': string;
}

interface ElectronStoreInstance {
  get<K extends keyof StoreSchema>(key: K, defaultValue?: StoreSchema[K]): StoreSchema[K];
  set<K extends keyof StoreSchema>(key: K, value: StoreSchema[K]): void;
}

const defaults: StoreSchema = {
  'theme-mode': 'dark',
  'sider-collapsed': false,
  'models': [],
  'current-model-id': '',
};

let store: ElectronStoreInstance | null = null;

export function getStore(): ElectronStoreInstance {
  if (!store) {
    store = new (ElectronStore as new (opts: { defaults: StoreSchema }) => ElectronStoreInstance)({ defaults });
  }
  return store;
}

export function getConfig<T extends keyof StoreSchema>(key: T): StoreSchema[T] {
  return getStore().get(key, defaults[key]);
}

export function setConfig<T extends keyof StoreSchema>(key: T, value: StoreSchema[T]): void {
  getStore().set(key, value);
}
