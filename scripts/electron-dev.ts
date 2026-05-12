import { spawn, type ChildProcess } from 'child_process';
import { createRequire } from 'module';
import { createServer } from 'vite';

const require = createRequire(import.meta.url);

const VITE_PORT = 5173;
let electronProcess: ChildProcess | null = null;

function viteBuildMain(): Promise<number> {
  return new Promise((resolve) => {
    const proc = spawn('npx', ['vite', 'build', '--config', 'vite.electron.config.ts'], {
      stdio: 'inherit',
      shell: true,
    });
    proc.on('close', (code) => resolve(code ?? 1));
  });
}

async function startDev() {
  // 1. 启动 Vite 开发服务器
  const viteServer = await createServer({
    configFile: 'vite.config.ts',
    mode: 'development',
  });
  await viteServer.listen(VITE_PORT);
  console.log(`[dev] Vite dev server running at http://localhost:${VITE_PORT}`);

  // 2. 编译主进程
  const code = await viteBuildMain();
  if (code !== 0) {
    console.error('[dev] Main process build failed');
    process.exit(1);
  }
  startElectron();

  // 3. 监听主进程源码变化并重新编译 + 重启
  const { watch } = await import('fs');
  const watcher = watch('electron', { recursive: true }, (_event, filename) => {
    if (!filename) return;
    console.log(`[dev] ${filename} changed, rebuilding main process...`);
    rebuildAndRestart();
  });

  let rebuildTimer: ReturnType<typeof setTimeout> | null = null;

  function rebuildAndRestart() {
    if (rebuildTimer) clearTimeout(rebuildTimer);
    rebuildTimer = setTimeout(async () => {
      const code = await viteBuildMain();
      if (code === 0) {
        killElectron();
        startElectron();
      }
    }, 500);
  }

  function startElectron() {
    const electronPath = require('electron') as unknown as string;
    electronProcess = spawn(electronPath, ['.'], {
      stdio: 'inherit',
      env: {
        ...process.env,
        NODE_ENV: 'development',
        VITE_DEV_SERVER_URL: `http://localhost:${VITE_PORT}`,
      },
    });

    electronProcess.on('close', () => {
      console.log('[dev] Electron closed');
    });
  }

  function killElectron() {
    if (electronProcess) {
      electronProcess.kill();
      electronProcess = null;
    }
  }

  // 优雅退出
  process.on('SIGINT', () => {
    killElectron();
    viteServer.close();
    watcher.close();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    killElectron();
    viteServer.close();
    watcher.close();
    process.exit(0);
  });
}

startDev().catch((err) => {
  console.error('[dev] Failed to start:', err);
  process.exit(1);
});
