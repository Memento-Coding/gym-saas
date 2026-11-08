# language: es
@e2e @consentimiento
Característica: Gestión de consentimientos
  Como administrador del gimnasio
  Quiero gestionar el documento de consentimiento informado
  Para asegurarme de que todos los estudiantes han aceptado las condiciones antes de entrenar

  Antecedentes:
    Dado que existe una configuración de consentimiento en versión 1

  @smoke @critico
  Escenario: Administrador visualiza la versión activa del consentimiento
    Dado que hay un estudiante registrado en el sistema
    Cuando accede al módulo de consentimiento
    Entonces debería ver el número de versión activa
    Y debería ver el texto del consentimiento para adultos
    Y debería ver el texto del consentimiento para menores

  @critico
  Escenario: Estudiante sin firmar aparece en la lista de pendientes
    Dado que el estudiante "Ana García" no ha firmado el consentimiento
    Cuando el administrador accede al módulo de consentimiento
    Entonces debería ver a "Ana García" en la lista de pendientes
    Y debería ver el botón de firma disponible para ese estudiante

  @regresion
  Escenario: No hay pendientes cuando todos los estudiantes han firmado la versión vigente
    Dado que el estudiante "Ana García" ha firmado el consentimiento en la versión vigente
    Cuando el administrador accede al módulo de consentimiento
    Entonces debería ver el mensaje de que todos los estudiantes han firmado

  @critico
  Escenario: Actualizar el consentimiento invalida las firmas anteriores
    Dado que el estudiante "Ana García" ha firmado el consentimiento en la versión vigente
    Cuando el administrador accede al módulo de consentimiento
    Y guarda una nueva versión del texto de consentimiento
    Entonces "Ana García" debería aparecer nuevamente en la lista de pendientes

  @regresion
  Escenario: Estudiante menor tiene la opción de diferir la firma
    Dado que el estudiante "Luis Pérez" es menor de edad y no ha firmado
    Cuando el administrador accede al módulo de consentimiento
    Entonces debería ver el botón de diferir junto al botón de firma para ese estudiante

  @regresion
  Escenario: Administrador abre el formulario de edición del texto de consentimiento
    Dado que hay un estudiante registrado en el sistema
    Cuando accede al módulo de consentimiento
    Y hace clic en el botón de editar
    Entonces debería ver el campo de texto para editar el consentimiento

  @critico
  Escenario: Firmar el consentimiento lo deja registrado
    Dado que el estudiante "Ana García" no ha firmado el consentimiento
    Cuando el administrador accede al módulo de consentimiento
    Y firma el consentimiento de "Ana García"
    Entonces el consentimiento de "Ana García" debería quedar firmado en la versión vigente

  @regresion
  Escenario: Estudiante con firma previa tiene disponible la descarga del PDF
    Dado que el estudiante "Ana García" firmó en una versión anterior del consentimiento
    Cuando el administrador accede al módulo de consentimiento
    Entonces debería ver el botón de descarga del PDF firmado

  @adversarial
  Escenario: Una firma en blanco no se puede confirmar
    Dado que el estudiante "Ana García" no ha firmado el consentimiento
    Cuando el administrador accede al módulo de consentimiento
    Y abre el diálogo de firma para "Ana García"
    Entonces no debería poder confirmar la firma
    Y el consentimiento de "Ana García" no debería quedar firmado

  @adversarial
  Escenario: Un texto de consentimiento vacío no crea una versión nueva
    Dado que el estudiante "Ana García" ha firmado el consentimiento en la versión vigente
    Cuando el administrador accede al módulo de consentimiento
    Y intenta guardar una versión con el texto vacío
    Entonces "Ana García" debería seguir sin pendientes de firma
