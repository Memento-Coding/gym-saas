# language: es
@e2e @cortesias
Característica: Gestión de cortesías y bonos
  Como administrador del gimnasio
  Quiero registrar y gestionar bonos de cortesía para los estudiantes
  Para compensar ausencias, cierres o situaciones especiales sin afectar su membresía

  Antecedentes:
    Dado que existe el estudiante "Ana García" en el sistema

  @smoke @critico
  Escenario: Administrador consulta el módulo de cortesías sin bonos registrados
    Cuando accede al módulo de cortesías
    Entonces debería ver el encabezado del módulo
    Y debería ver el mensaje de que no hay bonos registrados

  @critico
  Escenario: Administrador abre el formulario para registrar un nuevo bono
    Cuando accede al módulo de cortesías
    Y hace clic en el botón de nuevo bono
    Entonces debería ver el diálogo de registro
    Y debería ver el selector de estudiante en el formulario

  @critico
  Escenario: Administrador registra un bono de cortesía para un estudiante
    Cuando accede al módulo de cortesías
    Y registra un bono de cortesía para "Ana García" de 2 semanas con razón "Compensación por cierre E2E"
    Entonces el bono debería aparecer agrupado bajo "Ana García"
    Y debería ver la razón "Compensación por cierre E2E" en la lista

  @critico
  Escenario: El bono de cortesía no modifica la fecha de vencimiento de la membresía
    Dado que "Ana García" tiene membresía vigente hasta "2025-12-31"
    Cuando accede al módulo de cortesías
    Y registra un bono de cortesía para "Ana García" de 4 semanas con razón "Cortesía especial E2E"
    Entonces la fecha de vencimiento de membresía de "Ana García" debe seguir siendo "2025-12-31"

  @regresion
  Escenario: Bono activo muestra el badge de estado correcto
    Dado que "Ana García" tiene un bono activo vigente con razón "Bono activo E2E"
    Cuando accede al módulo de cortesías
    Entonces el bono debería mostrar el badge "Activo"

  @regresion
  Escenario: Administrador elimina un bono de cortesía registrado
    Dado que "Ana García" tiene un bono registrado con razón "Bono a eliminar E2E"
    Cuando accede al módulo de cortesías
    Y elimina el bono con razón "Bono a eliminar E2E"
    Entonces ese bono no debería aparecer en la lista
