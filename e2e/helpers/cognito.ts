/**
 * cognito.ts — Simula las respuestas de Cognito: los escenarios de autenticación
 * no dependen de usuarios reales ni escriben en ningún ambiente.
 */

import type { Page } from '@playwright/test';

export type RespuestaCognito =
  | { ok: Record<string, unknown> }
  | { error: string; mensaje: string };

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': '*',
  'access-control-allow-methods': '*',
  'access-control-expose-headers': 'x-amzn-errortype,x-amzn-errormessage,x-amzn-requestid',
};

/** Devuelve la lista viva de operaciones que la app le pidió a Cognito. */
export async function simularCognito(
  page: Page,
  respuestas: Record<string, RespuestaCognito>,
): Promise<string[]> {
  const llamadas: string[] = [];
  await page.route('https://cognito-idp.us-east-1.amazonaws.com/**', async (route) => {
    const peticion = route.request();
    if (peticion.method() === 'OPTIONS') {
      await route.fulfill({ status: 200, headers: CORS });
      return;
    }
    const operacion = (peticion.headers()['x-amz-target'] ?? '').split('.').pop() ?? '';
    llamadas.push(operacion);
    const respuesta = respuestas[operacion] ?? { error: 'InternalErrorException', mensaje: operacion };
    if ('ok' in respuesta) {
      await route.fulfill({ status: 200, headers: CORS, json: respuesta.ok });
      return;
    }
    await route.fulfill({
      status: 400,
      headers: { ...CORS, 'x-amzn-errortype': respuesta.error },
      json: { __type: respuesta.error, message: respuesta.mensaje },
    });
  });
  return llamadas;
}

const base64Url = (valor: object) => Buffer.from(JSON.stringify(valor)).toString('base64url');

/** Token sin firmar: Amplify solo lee sus claims en el navegador. */
function token(claims: object) {
  return `${base64Url({ alg: 'none' })}.${base64Url(claims)}.firma`;
}

/** Siembra en el navegador una sesión vigente de Amplify. */
export async function sembrarSesion(page: Page, clientId: string) {
  const usuario = 'ana@gimnasio.com';
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const prefijo = `CognitoIdentityServiceProvider.${clientId}`;
  const claims = { sub: 'e2e-sub', username: usuario, email: usuario, exp, iat: exp - 3600 };
  await page.addInitScript(
    (entradas: Record<string, string>) => {
      for (const [k, v] of Object.entries(entradas)) localStorage.setItem(k, v);
    },
    {
      [`${prefijo}.LastAuthUser`]: usuario,
      [`${prefijo}.${usuario}.accessToken`]: token({ ...claims, token_use: 'access' }),
      [`${prefijo}.${usuario}.idToken`]: token({ ...claims, token_use: 'id' }),
      [`${prefijo}.${usuario}.refreshToken`]: 'refresh-e2e',
      [`${prefijo}.${usuario}.clockDrift`]: '0',
    },
  );
}
