# language: es
@e2e @autenticacion @sin-sesion
Característica: Recuperación de contraseña
  Como usuario autorizado
  Quiero restablecer mi contraseña si la olvido
  Para volver a entrar sin ayuda

  @smoke
  Escenario: La pantalla de recuperación está disponible
    Cuando abre la pantalla de recuperación
    Entonces debería ver el formulario de recuperación

  @critico
  Escenario: Un código válido permite definir una contraseña nueva
    Dado que el servidor acepta la recuperación
    Cuando solicita recuperar la clave de "ana@gimnasio.com"
    Y define la clave "ClaveNueva123" con el código "123456"
    Entonces debería terminar en la pantalla de inicio de sesión

  @adversarial
  Escenario: Un código incorrecto no cambia la contraseña
    Dado que el servidor acepta la recuperación pero rechaza el código
    Cuando solicita recuperar la clave de "ana@gimnasio.com"
    Y define la clave "ClaveNueva123" con el código "000000"
    Entonces debería ver un error de verificación
    Y no debería terminar en la pantalla de inicio de sesión

  @adversarial
  Esquema del escenario: Una contraseña nueva débil no se envía
    Dado que el servidor acepta la recuperación
    Cuando solicita recuperar la clave de "ana@gimnasio.com"
    Y define la clave "<clave>" con el código "123456"
    Entonces debería ver el error "<motivo>"
    Y no debería haberse cambiado la clave en el servidor

    Ejemplos:
      | clave         | motivo    |
      | Corta1        | 8         |
      | sinmayuscula1 | mayúscula |
      | SinNumeroAqui | número    |
