# language: es
@e2e @autenticacion @sin-sesion
Característica: Registro de cuentas
  Como dueño del gimnasio
  Quiero que solo el personal autorizado pueda crear una cuenta
  Para que un desconocido no acceda a los datos

  @smoke
  Escenario: La pantalla de registro está disponible
    Cuando abre la pantalla de registro
    Entonces debería ver el formulario de registro

  @critico
  Escenario: Un correo autorizado crea su cuenta tras verificar el código
    Dado que el servidor acepta el registro
    Cuando se registra con "ana@gimnasio.com" y la clave "ClaveSegura123"
    Y confirma el código "123456"
    Entonces debería terminar en la pantalla de inicio de sesión

  @critico @adversarial
  Escenario: Un correo fuera de la lista blanca no puede crear cuenta
    Dado que el servidor rechaza correos no autorizados
    Cuando se registra con "extrano@gmail.com" y la clave "ClaveSegura123"
    Entonces debería ver el error "no está autorizado"
    Y no debería pedir el código de verificación

  @adversarial
  Esquema del escenario: Una contraseña débil no llega al servidor
    Dado que el servidor acepta el registro
    Cuando se registra con "ana@gimnasio.com" y la clave "<clave>"
    Entonces debería ver el error "<motivo>"
    Y no debería haberse consultado el servidor

    Ejemplos:
      | clave        | motivo     |
      | Corta1       | 8          |
      | sinmayuscula1 | mayúscula |
      | SINMINUSCULA1 | minúscula |
      | SinNumeroAqui | número    |

  @adversarial
  Escenario: Las contraseñas deben coincidir
    Dado que el servidor acepta el registro
    Cuando se registra con "ana@gimnasio.com", la clave "ClaveSegura123" y la confirmación "OtraClave123"
    Entonces debería ver el error "coinciden"
    Y no debería haberse consultado el servidor

  @adversarial
  Escenario: Un código de verificación incorrecto no confirma la cuenta
    Dado que el servidor acepta el registro pero rechaza el código
    Cuando se registra con "ana@gimnasio.com" y la clave "ClaveSegura123"
    Y confirma el código "000000"
    Entonces debería ver un error de verificación
    Y debería seguir pidiendo el código de verificación
