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
    Y registra al estudiante "Carlos" "López" con documento "50607080" plan "Básico" y vencimiento en 30 días
    Entonces debería ver la confirmación de que el estudiante fue registrado
    Y debería ver a "Carlos López" en la lista de estudiantes
    Y debería existir 1 estudiante guardado con documento "50607080"

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
  Escenario: Editar un estudiante conserva el cambio
    Dado que existe el estudiante "Ana García" registrado
    Cuando accede al módulo de estudiantes
    Y cambia el teléfono de "Ana García" a "3119998888"
    Entonces el teléfono guardado debería ser "3119998888"

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

  @adversarial
  Esquema del escenario: Un dato inválido no crea el estudiante
    Cuando accede al módulo de estudiantes
    Y intenta registrar un estudiante con "<campo>" igual a "<valor>"
    Entonces el formulario de estudiante debería seguir abierto mostrando un error
    Y no debería existir ningún estudiante guardado

    Ejemplos:
      | campo       | valor        |
      | Nombres     |              |
      | Apellidos   |              |
      | Documento   |              |
      | Documento   | abc#!        |
      | Teléfono    | no-es-numero |
      | Email       | no-es-correo |
      | Mensualidad | -5           |
      | Mensualidad | gratis       |
      | Vencimiento |              |
      | Nombres     | ␠␠␠          |

  @adversarial
  Escenario: No se puede registrar dos veces el mismo documento
    Dado que existe el estudiante "Ana García" registrado
    Cuando accede al módulo de estudiantes
    Y intenta registrar otro estudiante con el documento de "Ana García"
    Entonces debería existir solo 1 estudiante guardado

  @adversarial
  Escenario: Un nombre con código malicioso nunca se ejecuta
    Cuando accede al módulo de estudiantes
    Y intenta registrar un estudiante con "Nombres" igual a "<img src=x onerror=window.__xss=1>"
    Entonces no debería haberse ejecutado código inyectado

  @adversarial
  Esquema del escenario: Una búsqueda con caracteres especiales no rompe la lista
    Dado que existe el estudiante "Ana García" registrado
    Cuando accede al módulo de estudiantes
    Y busca "<termino>"
    Entonces debería ver el mensaje de que no hay estudiantes que coincidan

    Ejemplos:
      | termino              |
      | (.*                  |
      | ' OR 1=1 --          |
      | <script>alert(1)     |

  @adversarial
  Escenario: Un perfil inexistente informa el error sin romper la aplicación
    Cuando accede al perfil del estudiante "no-existe"
    Entonces debería ver que el estudiante no fue encontrado

  @adversarial
  Esquema del escenario: Un congelamiento inválido no modifica la membresía
    Dado que existe el estudiante "Ana García" registrado
    Cuando accede al módulo de estudiantes
    Y intenta congelar a "Ana García" con motivo "<motivo>" por "<dias>" días
    Entonces el vencimiento de "Ana García" debería seguir igual
    Y "Ana García" no debería quedar congelada

    Ejemplos:
      | motivo | dias |
      |        | 30   |
      | Viaje  | 0    |
      | Viaje  | -5   |
      | Viaje  | abc  |

  @adversarial
  Escenario: Cancelar la eliminación conserva al estudiante
    Dado que existe el estudiante "Ana García" registrado
    Cuando accede al módulo de estudiantes
    Y intenta eliminar a "Ana García" y cancela
    Entonces debería existir solo 1 estudiante guardado
