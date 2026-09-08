# language: es
@e2e @estudiantes
Característica: Gestión de estudiantes
  Como administrador del gimnasio
  Quiero registrar, buscar y consultar estudiantes
  Para mantener un directorio actualizado y confiable de los miembros del gimnasio

  @smoke @critico
  Escenario: Administrador consulta la lista de estudiantes registrados
    Dado que existe el estudiante "Ana García" registrado
    Cuando accede al módulo de estudiantes
    Entonces debería ver el encabezado del módulo de estudiantes
    Y debería ver a "Ana García" en la lista de estudiantes

  @smoke
  Escenario: La lista muestra el mensaje vacío cuando no hay estudiantes
    Cuando accede al módulo de estudiantes
    Entonces debería ver el mensaje de que no hay estudiantes que coincidan

  @critico
  Escenario: Administrador registra un nuevo estudiante
    Cuando accede al módulo de estudiantes
    Y abre el formulario de nuevo estudiante
    Y registra al estudiante "Carlos" "López" con documento "50607080" plan "Plan Básico genérico" y vencimiento "2026-12-31"
    Entonces debería ver la confirmación de que el estudiante fue registrado
    Y debería ver a "Carlos López" en la lista de estudiantes

  @critico
  Escenario: Buscar por nombre completo encuentra al estudiante
    Dado que existe el estudiante "Ana García" registrado
    Cuando accede al módulo de estudiantes
    Y busca "Ana García"
    Entonces debería ver a "Ana García" en la lista de estudiantes

  @regresion
  Escenario: Buscar por nombre del plan encuentra al estudiante
    Dado que existe el estudiante "Ana García" registrado
    Cuando accede al módulo de estudiantes
    Y busca "Estándar"
    Entonces debería ver a "Ana García" en la lista de estudiantes

  @regresion
  Escenario: Una búsqueda sin coincidencias muestra el mensaje vacío
    Dado que existe el estudiante "Ana García" registrado
    Cuando accede al módulo de estudiantes
    Y busca "ZZZ_INEXISTENTE"
    Entonces debería ver el mensaje de que no hay estudiantes que coincidan

  @critico
  Escenario: El badge de estado de pago muestra "Vencido" para una suscripción expirada
    Dado que existe un estudiante "Pedro Ruiz" con la suscripción vencida
    Cuando accede al módulo de estudiantes
    Entonces el estado de pago de "Pedro Ruiz" debería ser "Vencido"

  @critico
  Escenario: Descargar el comprobante de pago genera un archivo comprobante_GOP-*.pdf
    Dado que existe un estudiante con un pago con comprobante "GOP-0001"
    Cuando accede al perfil de ese estudiante
    Entonces debería ver el historial de pagos del estudiante
    Y al descargar el comprobante "GOP-0001" el archivo debería cumplir el patrón "comprobante_GOP-*.pdf"
