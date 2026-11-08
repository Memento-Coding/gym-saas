# language: es
@e2e @inventario
Característica: Inventario de productos y servicios
  Como administrador del gimnasio
  Quiero mantener el catálogo de lo que vendo
  Para vender con precios y existencias correctos

  Antecedentes:
    Dado que hay en inventario 5 unidades de "Proteína E2E" y el servicio "Masaje E2E"
    Cuando abre la pestaña de inventario

  @smoke
  Escenario: El inventario muestra los ítems existentes
    Entonces debería ver "Proteína E2E" en el inventario

  @critico
  Escenario: Crear un producto lo agrega al catálogo
    Cuando crea el producto "Guantes E2E" con costo "20000" precio "35000" y stock "4"
    Entonces debería existir el ítem "Guantes E2E" con precio 35000 y stock 4

  @critico
  Escenario: Editar el stock de un producto lo actualiza
    Cuando cambia el stock de "Proteína E2E" a "9"
    Entonces el stock de "Proteína E2E" debería ser 9

  @adversarial
  Esquema del escenario: Datos inválidos no crean el producto
    Cuando crea el producto "<nombre>" con costo "<costo>" precio "<precio>" y stock "<stock>"
    Entonces no debería existir el ítem "<nombre>"
    Y el catálogo debería seguir teniendo 2 ítems

    Ejemplos:
      | nombre | costo | precio | stock |
      |        | 100   | 100    | 1     |
      | Malo   | 100   | -1     | 1     |
      | Malo   | -1    | 100    | 1     |
      | Malo   | 100   | abc    | 1     |
      | Malo   | 100   | 100    | -1    |
      | Malo   | 100   | 100    | 1.5   |

  @adversarial
  Escenario: Cancelar la confirmación no elimina el ítem
    Cuando intenta eliminar "Proteína E2E" y cancela la confirmación
    Entonces el catálogo debería seguir teniendo 2 ítems
