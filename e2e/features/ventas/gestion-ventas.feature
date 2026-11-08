# language: es
@e2e @ventas
Característica: Ventas de la tienda
  Como administrador del gimnasio
  Quiero registrar ventas de productos y servicios
  Para que el stock y las cuentas por cobrar reflejen lo vendido

  Antecedentes:
    Dado que hay en inventario 5 unidades de "Proteína E2E" y el servicio "Masaje E2E"
    Cuando abre la pestaña de ventas

  @smoke @critico
  Escenario: Una venta de contado descuenta el stock vendido
    Cuando vende 2 de "Proteína E2E" al cliente "Cliente E2E"
    Entonces debería existir 1 venta registrada
    Y el stock de "Proteína E2E" debería ser 3

  @adversarial
  Esquema del escenario: Una cantidad inválida se rechaza sin tocar el stock
    Cuando intenta vender "<cantidad>" de "Proteína E2E" al cliente "Cliente E2E"
    Entonces no debería existir ninguna venta registrada
    Y el stock de "Proteína E2E" debería ser 5

    Ejemplos:
      | cantidad |
      | 0        |
      | -5       |
      | 1.5      |
      | abc      |
      | 6        |

  @adversarial
  Escenario: Una venta sin cliente se rechaza
    Cuando intenta vender "1" de "Proteína E2E" al cliente ""
    Entonces no debería existir ninguna venta registrada
    Y el stock de "Proteína E2E" debería ser 5

  @adversarial
  Escenario: Un servicio no se puede vender a crédito
    Cuando intenta vender a crédito "1" de "Masaje E2E" al cliente "Cliente E2E"
    Entonces no debería existir ninguna venta registrada

  @adversarial
  Escenario: Un doble clic en registrar crea una sola venta
    Cuando vende con doble clic 1 de "Proteína E2E" al cliente "Cliente E2E"
    Entonces debería existir 1 venta registrada
    Y el stock de "Proteína E2E" debería ser 4
