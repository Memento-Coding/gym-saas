# language: es
@e2e @legal @sin-sesion
Característica: Páginas legales públicas
  Como persona que usa o evalúa GymOps
  Quiero leer la política de datos y las condiciones sin registrarme
  Para saber cómo se tratan mis datos

  @smoke
  Esquema del escenario: Las páginas legales cargan sin iniciar sesión
    Cuando abre la página pública "<ruta>"
    Entonces debería ver el título "<titulo>"
    Y no debería terminar en la pantalla de inicio de sesión

    Ejemplos:
      | ruta        | titulo                                   |
      | /privacidad | Política de tratamiento de datos personales |
      | /terminos   | Condiciones del servicio                 |

  @critico
  Escenario: La política identifica al responsable y un contacto
    Cuando abre la página pública "/privacidad"
    Entonces debería ver al responsable "Jhoan Sebastian Rojas"
    Y debería ver un correo de contacto
    Y debería ver los derechos del titular de los datos

  @adversarial
  Escenario: Las páginas públicas no muestran datos del gimnasio
    Cuando abre la página pública "/privacidad"
    Entonces no debería ver el menú de la aplicación

  # BUG real: una dirección inexistente deja la pantalla en blanco (App.tsx no tiene ruta comodín).
  @adversarial @fixme
  Escenario: Una dirección inexistente no deja la pantalla en blanco
    Cuando abre la página pública "/no-existe"
    Entonces debería ver contenido en la pantalla
