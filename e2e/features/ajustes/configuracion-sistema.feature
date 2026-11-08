# language: es
@e2e @ajustes
Característica: Configuración del sistema
  Como administrador del gimnasio
  Quiero configurar la identidad visual, los planes, el formulario de registro y las copias de seguridad
  Para personalizar el sistema según las necesidades del gimnasio

  @smoke
  Escenario: Administrador accede a la configuración y ve todas las secciones disponibles
    Cuando accede al módulo de ajustes
    Entonces debería ver la sección de marca
    Y debería ver la sección de planes
    Y debería ver la sección de formulario
    Y debería ver la sección de backup
    Y debería ver la sección de comunicación

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
    Y entra a la sección de formulario
    Entonces debería ver el campo "Nivel Cinturón E2E" en la lista

  @regresion
  Escenario: Administrador elimina un campo personalizado tras confirmar
    Dado que existe el campo personalizado "Campo a Borrar E2E" en el formulario
    Cuando accede al módulo de ajustes
    Y entra a la sección de formulario
    Y elimina el campo "Campo a Borrar E2E"
    Entonces el campo "Campo a Borrar E2E" no debería aparecer en la lista

  @smoke
  Escenario: El backup del sistema se puede descargar
    Cuando accede al módulo de ajustes
    Y entra a la sección de backup
    Entonces debería poder descargar el backup

  @critico
  Escenario: El reinicio del sistema requiere confirmación escribiendo REINICIAR
    Cuando accede al módulo de ajustes
    Y entra a la sección de backup
    Y solicita el reinicio del sistema
    Entonces no debería poder confirmar el reinicio
    Y al escribir "REINICIAR" debería poder confirmar el reinicio

  @critico
  Escenario: El reinicio del sistema preserva la configuración de marca pero elimina los estudiantes
    Dado que existe un estudiante y configuración de marca "Meraki E2E" en el sistema
    Cuando accede al módulo de ajustes
    Y ejecuta el reinicio completo del sistema
    Entonces debería ver la confirmación de que los datos fueron reiniciados
    Y la configuración de marca debería seguir siendo "Meraki E2E"
    Y la lista de estudiantes debería estar vacía

  @regresion
  Escenario: La sección de comunicación en ajustes muestra los canales configurables
    Dado que existe configuración de canales de comunicación en el sistema
    Cuando accede al módulo de ajustes
    Y entra a la sección de comunicación en ajustes
    Entonces debería ver los canales "Email", "Telegram" y "WhatsApp"

  @adversarial
  Esquema del escenario: El reinicio no se habilita con un texto de confirmación incorrecto
    Cuando accede al módulo de ajustes
    Y entra a la sección de backup
    Y solicita el reinicio del sistema
    Y escribe "<texto>" como confirmación de reinicio
    Entonces no debería poder confirmar el reinicio

    Ejemplos:
      | texto      |
      | reiniciar  |
      | REINICIA   |
      | BORRAR     |

  @adversarial
  Esquema del escenario: Un backup dañado no reemplaza los datos existentes
    Dado que existe un estudiante y configuración de marca "Meraki E2E" en el sistema
    Cuando accede al módulo de ajustes
    Y entra a la sección de backup
    Y importa un backup "<tipo>"
    Entonces los datos del sistema deberían seguir intactos

    Ejemplos:
      | tipo                |
      | que no es JSON      |
      | con una lista       |
      | vacío               |
      | con datos inválidos |

  @adversarial
  Esquema del escenario: Un plan inválido no se agrega
    Cuando accede al módulo de ajustes
    Y entra a la sección de planes
    Y intenta agregar el plan "<nombre>" con precio "<precio>"
    Entonces no debería agregarse ningún plan

    Ejemplos:
      | nombre | precio |
      |        | 50000  |
      | Malo   | -1     |
      | Malo   | abc    |
