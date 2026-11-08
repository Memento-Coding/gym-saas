# language: es
@e2e @autenticacion @sin-sesion
Característica: Inicio de sesión
  Como dueño del gimnasio
  Quiero que solo entren las personas autorizadas
  Para proteger los datos de los estudiantes

  @smoke
  Escenario: La pantalla de acceso ofrece iniciar sesión y consultar las políticas
    Cuando abre la pantalla de inicio de sesión
    Entonces debería ver el formulario de inicio de sesión
    Y debería ver los enlaces a privacidad y condiciones

  @critico @adversarial
  Esquema del escenario: Sin sesión no se puede entrar a una página protegida
    Cuando intenta abrir "<ruta>" sin haber iniciado sesión
    Entonces debería terminar en la pantalla de inicio de sesión

    Ejemplos:
      | ruta               |
      | /                  |
      | /estudiantes       |
      | /estudiantes/stu-1 |
      | /finanzas          |
      | /cortesias         |
      | /comunicacion      |
      | /consentimiento    |
      | /ajustes           |

  @critico
  Escenario: Con una sesión activa se entra a la aplicación
    Dado que el usuario tiene una sesión activa
    Cuando intenta abrir "/estudiantes" con su sesión
    Entonces debería ver la página de estudiantes

  @critico @adversarial
  Escenario: Unas credenciales incorrectas no dan acceso
    Dado que el servidor rechaza las credenciales
    Cuando inicia sesión con "ana@gimnasio.com" y "Incorrecta123"
    Entonces debería ver un error de inicio de sesión
    Y debería seguir en la pantalla de inicio de sesión

  @adversarial
  Esquema del escenario: Datos inválidos no llegan al servidor
    Dado que el servidor rechaza las credenciales
    Cuando inicia sesión con "<correo>" y "<clave>"
    Entonces no debería haberse consultado el servidor
    Y debería seguir en la pantalla de inicio de sesión

    Ejemplos:
      | correo            | clave      |
      |                   | Clave12345 |
      | ana@gimnasio.com  |            |
      | no-es-correo      | Clave12345 |
      | ' OR 1=1 --       | Clave12345 |

  @adversarial
  Escenario: Un doble clic envía una sola solicitud de acceso
    Dado que el servidor rechaza las credenciales
    Cuando inicia sesión con doble clic usando "ana@gimnasio.com" y "Incorrecta123"
    Entonces debería haberse consultado el servidor 1 vez
