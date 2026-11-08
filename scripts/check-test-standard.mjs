#!/usr/bin/env node
// Hace cumplir docs/STEERING_TESTING.md en CI: sin escenarios adversarios no se integra.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// Páginas y la carpeta de e2e/features que las cubre.
const PAGE_FEATURES = {
  StudentsPage: 'estudiantes',
  StudentProfilePage: 'pagos',
  FinancePage: 'finanzas',
  CourtesiesPage: 'cortesias',
  CommunicationPage: 'comunicacion',
  ConsentPage: 'consentimiento',
  SettingsPage: 'ajustes',
  DashboardPage: 'dashboard',
  LoginPage: 'autenticacion',
  RegisterPage: 'autenticacion',
  ForgotPasswordPage: 'autenticacion',
  LegalPages: 'legal',
};

const REQUIRED_TAGS = ['@smoke', '@critico', '@adversarial'];

/** Devuelve los incumplimientos de un archivo .feature. */
export function checkFeature(text, folder) {
  const errors = [];
  if (!text.startsWith('# language: es')) errors.push('debe empezar con "# language: es"');
  for (const tag of ['@e2e', `@${folder}`]) {
    if (!new RegExp(`^${tag}\\b.*\\n\\s*Característica:|^.*${tag}\\b.*\\n\\s*Característica:`, 'm').test(text)) {
      errors.push(`la Característica debe llevar ${tag}`);
    }
  }
  for (const tag of REQUIRED_TAGS) {
    if (!new RegExp(`${tag}\\b`).test(text)) errors.push(`falta al menos un escenario ${tag}`);
  }
  const date = text.match(/\b20\d{2}-\d{2}-\d{2}\b/);
  if (date) errors.push(`fecha literal ${date[0]}: usa fechas relativas a hoy`);

  const jargon = text.match(/\b(hace clic|botón|pestaña|diálogo|canvas)\b/i);
  if (jargon) errors.push(`"${jargon[0]}": describe el negocio, no la interfaz`);

  const lines = text.split('\n');
  lines.forEach((line, i) => {
    if (/^\s*@.*@fixme\b|^\s*@fixme\b/.test(line) && !lines[i - 1]?.trim().startsWith('#')) {
      errors.push(`línea ${i + 1}: @fixme necesita un comentario que explique el bug`);
    }
  });
  return errors;
}

/** Un parámetro con _ es un dato del escenario que el paso ignora. */
export function checkSteps(source) {
  return [...source.matchAll(/\b_(\w+): (?:string|number)/g)].map((m) => `parámetro ignorado: _${m[1]}`);
}

/** Devuelve las páginas sin feature, sin mapeo o con deuda ya saldada. */
export function checkPages(pages, featureFolders) {
  const errors = [];
  for (const page of pages) {
    const folder = PAGE_FEATURES[page];
    if (!folder) errors.push(`${page}: página nueva sin feature (agrégala a PAGE_FEATURES)`);
    else if (!featureFolders.includes(folder)) errors.push(`${page}: falta e2e/features/${folder}/`);
  }
  return errors;
}

function main() {
  const featuresDir = join(ROOT, 'e2e/features');
  const folders = readdirSync(featuresDir);
  const errors = [];
  for (const folder of folders) {
    for (const file of readdirSync(join(featuresDir, folder)).filter((f) => f.endsWith('.feature'))) {
      const path = join(featuresDir, folder, file);
      for (const e of checkFeature(readFileSync(path, 'utf8'), folder)) errors.push(`${folder}/${file}: ${e}`);
    }
  }
  const stepsDir = join(ROOT, 'e2e/step-definitions');
  for (const file of readdirSync(stepsDir).filter((f) => f.endsWith('.steps.ts'))) {
    for (const e of checkSteps(readFileSync(join(stepsDir, file), 'utf8'))) errors.push(`${file}: ${e}`);
  }

  const pagesDir = join(ROOT, 'src/pages');
  const pages = existsSync(pagesDir)
    ? readdirSync(pagesDir).filter((f) => f.endsWith('.tsx') && !f.includes('.test.')).map((f) => basename(f, '.tsx'))
    : [];
  errors.push(...checkPages(pages, folders));

  if (errors.length > 0) {
    console.error(`Incumple docs/STEERING_TESTING.md:\n- ${errors.join('\n- ')}`);
    process.exit(1);
  }
  console.log(`Estándar de pruebas OK: ${folders.length} módulos.`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main();
