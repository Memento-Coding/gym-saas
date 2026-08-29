import { test } from '@playwright/test';

test('diagnóstico env via fetch', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  
  // Obtener el bundle compilado para ver si VITE_E2E_STORAGE está embebido
  const mainContent = await page.evaluate(async () => {
    const r = await fetch('/src/services/storage/StorageService.ts');
    const text = await r.text();
    return text.includes('VITE_E2E_STORAGE') ? 'found in source' : 'not found';
  });
  console.log('VITE_E2E_STORAGE in StorageService source:', mainContent);
  
  // Verificar directamente si el createStorageService va a localStorage
  const storageMode = await page.evaluate(async () => {
    // @ts-ignore
    const { createStorageService, resetStorageService } = await import('/src/services/storage/StorageService.ts');
    resetStorageService();
    const svc = await createStorageService();
    // Escribir un valor y ver qué backend se usa
    await svc.set('__e2e_test__', 'hello');
    const lsVal = localStorage.getItem('gymops:__e2e_test__');
    await svc.delete('__e2e_test__');
    return lsVal ? 'localStorage-primary' : 'idb-primary';
  });
  console.log('Storage mode:', storageMode);
  
}, { timeout: 15000 });
