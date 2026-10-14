import { defineConfig } from '@playwright/test';
import chromium, { inflate } from '@sparticuz/chromium';
import { fileURLToPath } from 'node:url';
if (process.platform === 'linux' && !process.env.PLAYWRIGHT_EXECUTABLE_PATH) {
  const lib = await inflate(
    fileURLToPath(new URL('../bin/al2023.tar.br', import.meta.resolve('@sparticuz/chromium'))),
  );
  process.env.LD_LIBRARY_PATH = `${lib}/lib:${process.env.LD_LIBRARY_PATH ?? ''}`;
}

export default defineConfig({
  webServer: process.env.CI
    ? {
        command: 'npm run preview -- --port 4173',
        url: 'http://127.0.0.1:4173',
        reuseExistingServer: false,
        timeout: 30000,
      }
    : undefined,
  testDir: './tests',
  timeout: 45000,
  expect: { timeout: 10000 },
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://127.0.0.1:4173',
    headless: true,
    viewport: { width: 1440, height: 1000 },
    launchOptions: process.env.PLAYWRIGHT_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH, args: ['--no-sandbox'] }
      : {
          executablePath: await chromium.executablePath(),
          args: chromium.args.filter(
            (arg) =>
              ![
                '--single-process',
                '--disable-web-security',
                '--allow-running-insecure-content',
              ].includes(arg),
          ),
        },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
});
