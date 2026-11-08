import { defineConfig, devices } from '@playwright/test';
import { defineBddProject } from 'playwright-bdd';

const STEPS = ['e2e/step-definitions/**/*.steps.ts', 'e2e/support/world.ts'];

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
        outputDir: '.features-gen/con-sesion',
        features: 'e2e/features/**/*.feature',
        steps: STEPS,
        tags: 'not @sin-sesion and not @fixme',
        language: 'es',
      }),
      use: { ...devices['Desktop Chrome'], baseURL: 'http://localhost:5174' },
    },
    {
      // El login real activo y Cognito simulado (e2e/helpers/cognito.ts).
      ...defineBddProject({
        name: 'bdd-sin-sesion',
        outputDir: '.features-gen/sin-sesion',
        features: 'e2e/features/**/*.feature',
        steps: STEPS,
        tags: '@sin-sesion and not @fixme',
        language: 'es',
      }),
      use: { ...devices['Desktop Chrome'], baseURL: 'http://localhost:5175' },
    },
  ],
  // Puerto propio y sin reutilizar: un `vite --mode api` en 5173 haría que las pruebas escribieran en dev.
  webServer: [
    {
      command: 'npm run dev -- --port 5174 --strictPort',
      url: 'http://localhost:5174',
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: 'npm run dev -- --port 5175 --strictPort',
      url: 'http://localhost:5175',
      reuseExistingServer: false,
      timeout: 60_000,
      env: {
        VITE_AUTH_BYPASS: 'false',
        VITE_COGNITO_USER_POOL_ID: 'us-east-1_E2Efake00',
        VITE_COGNITO_CLIENT_ID: 'e2efakeclient',
        VITE_COGNITO_REGION: 'us-east-1',
        VITE_COGNITO_OAUTH_DOMAIN: 'e2e.auth.us-east-1.amazoncognito.com',
      },
    },
  ],
});
