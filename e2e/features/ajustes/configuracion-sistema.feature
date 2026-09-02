# language: es
@e2e @ajustes
Característica: Configuración del sistema
  Como administrador del gimnasio
  Quiero configurar la identidad visual, los planes, el formulario de registro y las copias de seguridad
  Para personalizar el sistema según las necesidades del gimnasio

  @smoke
  Escenario: Administrador accede a la configuración y ve todas las secciones disponibles
    Cuando accede al módulo de ajustes
    Entonces debería ver la pestaña de marca
    Y debería ver la pestaña de planes
    Y debería ver la pestaña de formulario
    Y debería ver la pestaña de backup
    Y debería ver la pestaña de comunicación

  @critico
  Escenario: Administrador configura el nombre y eslogan del gimnasio
    Cuando accede al módulo de ajustes
    Y guarda el nombre "Meraki Academy E2E" y el eslogan "Entrena con propósito E2E"
    Entonces debería ver la confirmación de que la marca fue guardada
    Y el nombre del gimnasio guardado debería ser "Meraki Academy E2E"
    Y el eslogan guardado debería ser "Entrena con propósito E2E"

  @critico
  Escenario: Administrador agrega un campo personalizado al formulario de registro
    Cuando accede al módulo de ajustes
    Y agrega el campo personalizado "Talla de kimono E2E" al formulario
    Entonces debería ver el campo "Talla de kimono E2E" en la lista de campos

  @regresion
  Escenario: Los campos personalizados existentes aparecen en la configuración del formulario
    Dado que existe el campo personalizado "Nivel Cinturón E2E" en el formulario
    Cuando accede al módulo de ajustes
    Y navega a la pestaña de formulario
    Entonces debería ver el campo "Nivel Cinturón E2E" en la lista

  @regresion
  Escenario: Eliminar un campo personalizado requiere confirmación explícita
    Dado que existe el campo personalizado "Campo a Borrar E2E" en el formulario
    Cuando accede al módulo de ajustes
    Y navega a la pestaña de formulario
    Y elimina el campo "Campo a Borrar E2E"
    Entonces el campo "Campo a Borrar E2E" no debería aparecer en la lista

  @smoke
  Escenario: Administrador verifica que el botón de exportar backup está disponible
    Cuando accede al módulo de ajustes
    Y navega a la pestaña de backup
    Entonces debería ver el botón para descargar el backup

  @critico
  Escenario: El reinicio del sistema requiere confirmación escribiendo REINICIAR
    Cuando accede al módulo de ajustes
    Y navega a la pestaña de backup
    Y abre el diálogo de reinicio del sistema
    Entonces el botón de confirmar reinicio debería estar deshabilitado
    Y al escribir "REINICIAR" el botón debería habilitarse

  @critico
  Escenario: El reinicio del sistema preserva la configuración de marca pero elimina los estudiantes
    Dado que existe un estudiante y configuración de marca "Meraki E2E" en el sistema
    Cuando accede al módulo de ajustes
    Y ejecuta el reinicio completo del sistema
    Entonces debería ver la confirmación de que los datos fueron reiniciados
    Y la configuración de marca debería seguir siendo "Meraki E2E"
    Y la lista de estudiantes debería estar vacía

  @regresion
  Escenario: La pestaña de comunicación en ajustes muestra los canales configurables
    Dado que existe configuración de canales de comunicación en el sistema
    Cuando accede al módulo de ajustes
    Y navega a la pestaña de comunicación en ajustes
    Entonces debería ver los canales "Email", "Telegram" y "WhatsApp"
