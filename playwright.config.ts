import { defineConfig, devices } from '@playwright/test';
import { defineBddProject } from 'playwright-bdd';

export default defineConfig({
  tsconfig: './tsconfig.e2e.json',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
  ],
  use: {
    baseURL: 'http://localhost:5174',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    // Ralentizar cada acción. Ajusta el valor según lo que necesites:
    //   500  → medio segundo por acción (cómodo para observar)
    //   1000 → un segundo por acción (para seguir paso a paso)
    slowMo: process.env.SLOW_MO ? parseInt(process.env.SLOW_MO) : 0,
  },
  projects: [
    {
      ...defineBddProject({
        name: 'bdd',
        outputDir: '.features-gen',
        features: 'e2e/features/**/*.feature',
        steps: [
          'e2e/step-definitions/**/*.steps.ts',
          'e2e/support/world.ts',
        ],
        language: 'es',
      }),
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // Puerto propio y sin reutilizar: un `vite --mode api` en 5173 haría que las pruebas escribieran en dev.
  webServer: {
    command: 'npm run dev -- --port 5174 --strictPort',
    url: 'http://localhost:5174',
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
