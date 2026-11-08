/**
 * Páginas legales públicas (sin login): política de tratamiento de datos y
 * condiciones del servicio. Las exige Google para publicar el login con Google
 * y la Ley 1581 de 2012 (habeas data) para tratar datos personales en Colombia.
 *
 * Borrador: el responsable debe revisarlo con asesoría legal antes de usarlo.
 */

import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

// Persona natural responsable mientras no exista una empresa constituida.
const OPERATOR = 'GymOps';
const RESPONSIBLE = 'Jhoan Sebastian Rojas';
const CONTACT_EMAIL = 'privacidad@gym-ops.fit';
const UPDATED = '8 de noviembre de 2026';

function LegalLayout({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12 text-sm leading-relaxed [&_h2]:mt-8 [&_h2]:mb-2 [&_h2]:text-base [&_h2]:font-semibold [&_ul]:list-disc [&_ul]:pl-5 [&_p]:mb-3">
      <Link to="/login" className="text-primary font-medium hover:underline">
        ← GymOps
      </Link>
      <h1 className="mt-6 text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="text-muted-foreground">Última actualización: {UPDATED}</p>
      {children}
    </main>
  );
}

const contact = <a className="text-primary hover:underline" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>;

export function PrivacyPage() {
  return (
    <LegalLayout title="Política de tratamiento de datos personales">
      <p>
        {OPERATOR} es un software para la gestión de gimnasios. Esta política explica cómo se tratan los
        datos personales conforme a la Ley 1581 de 2012 y el Decreto 1377 de 2013 de Colombia.
      </p>

      <h2>1. Responsable y encargado</h2>
      <p>
        Cada gimnasio que usa {OPERATOR} es el <strong>responsable</strong> de los datos de sus alumnos y
        clientes. {OPERATOR} actúa como <strong>encargado</strong>: los almacena y procesa por cuenta del
        gimnasio y solo para prestar el servicio. Para los datos de las cuentas de usuario (personal del
        gimnasio), el responsable es {RESPONSIBLE}, persona natural que opera {OPERATOR}. Contacto: {contact}.
      </p>

      <h2>2. Datos que tratamos</h2>
      <ul>
        <li>Cuenta de usuario: nombre, correo electrónico e identificador de Google si inicia sesión con Google.</li>
        <li>Alumnos y clientes: nombre, documento, fecha de nacimiento, teléfono, contacto de emergencia, membresías, pagos, compras y asistencia.</li>
        <li>Consentimientos informados firmados, que pueden incluir información de salud (dato sensible).</li>
      </ul>

      <h2>3. Finalidades</h2>
      <ul>
        <li>Administrar membresías, pagos, ventas, inventario y finanzas del gimnasio.</li>
        <li>Registrar y conservar los consentimientos informados.</li>
        <li>Autenticar a los usuarios y proteger el acceso a la información.</li>
      </ul>
      <p>No vendemos ni cedemos datos personales a terceros con fines comerciales.</p>

      <h2>4. Datos sensibles y de menores de edad</h2>
      <p>
        Los datos de salud y los de niños, niñas y adolescentes solo se tratan con autorización expresa del
        titular o de su representante legal, respetando el interés superior del menor. Su entrega es facultativa.
      </p>

      <h2>5. Derechos del titular</h2>
      <p>
        Usted puede conocer, actualizar, rectificar y solicitar la supresión de sus datos, pedir prueba de la
        autorización, revocarla, ser informado del uso dado a sus datos y presentar quejas ante la
        Superintendencia de Industria y Comercio.
      </p>

      <h2>6. Consultas y reclamos</h2>
      <p>
        Escriba a su gimnasio o a {contact}. Las consultas se responden en máximo 10 días hábiles y los
        reclamos en máximo 15 días hábiles, prorrogables según la ley.
      </p>

      <h2>7. Seguridad y transferencia</h2>
      <p>
        Los datos se almacenan cifrados en Amazon Web Services (Estados Unidos), con acceso restringido a
        usuarios autenticados. El inicio de sesión con Google se rige además por la política de privacidad de
        Google.
      </p>

      <h2>8. Vigencia</h2>
      <p>
        Los datos se conservan mientras el gimnasio use el servicio o lo exija la ley. Los cambios a esta
        política se publicarán en esta página.
      </p>
    </LegalLayout>
  );
}

export function TermsPage() {
  return (
    <LegalLayout title="Condiciones del servicio">
      <h2>1. El servicio</h2>
      <p>
        {OPERATOR} ofrece software en línea para que los gimnasios administren alumnos, membresías, pagos,
        ventas, inventario, finanzas y consentimientos.
      </p>

      <h2>2. Cuentas</h2>
      <p>
        El acceso es solo para personal autorizado por el gimnasio. Cada usuario cuida sus credenciales y
        responde por la actividad de su cuenta.
      </p>

      <h2>3. Datos del gimnasio</h2>
      <p>
        El gimnasio es dueño de la información que registra y responsable de contar con la autorización de sus
        alumnos para tratarla. {OPERATOR} la trata según la{' '}
        <Link to="/privacidad" className="text-primary hover:underline">política de tratamiento de datos</Link>.
      </p>

      <h2>4. Uso aceptable</h2>
      <p>
        No se permite usar el servicio para fines ilícitos, intentar acceder a información de terceros ni
        afectar su funcionamiento.
      </p>

      <h2>5. Disponibilidad y responsabilidad</h2>
      <p>
        El servicio se ofrece en su estado actual. Hacemos lo razonable para mantenerlo disponible y seguro,
        pero no garantizamos que esté libre de interrupciones. Se recomienda exportar respaldos periódicos desde
        Ajustes.
      </p>

      <h2>6. Cambios y terminación</h2>
      <p>
        Podemos actualizar estas condiciones, publicando los cambios en esta página. El gimnasio puede dejar de
        usar el servicio en cualquier momento.
      </p>

      <h2>7. Ley aplicable y contacto</h2>
      <p>
        {OPERATOR} es operado por {RESPONSIBLE}. Estas condiciones se rigen por las leyes de Colombia.
        Contacto: {contact}.
      </p>
    </LegalLayout>
  );
}
