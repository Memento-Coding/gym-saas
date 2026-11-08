# language: es
@e2e @pagos
Característica: Registro de pagos de membresía
  Como administrador del gimnasio
  Quiero registrar los pagos de cada estudiante
  Para llevar el control de lo cobrado y entregar un comprobante

  Antecedentes:
    Dado que existe el estudiante "Ana García" registrado
    Cuando abre el registro de pago del estudiante

  @smoke @critico
  Escenario: Registrar un pago guarda exactamente un pago y entrega su comprobante
    Cuando confirma un pago del primer plan con descuento "10000"
    Entonces debería existir 1 pago registrado con descuento 10000
    Y debería haberse descargado un comprobante

  @adversarial
  Esquema del escenario: Un descuento inválido se rechaza sin registrar el pago
    Cuando confirma un pago del primer plan con descuento "<descuento>"
    Entonces no debería existir ningún pago registrado
    Y el formulario de pago debería seguir abierto mostrando un error

    Ejemplos:
      | descuento   |
      | -1          |
      | abc         |
      | 1,5         |
      | 99999999    |

  @adversarial
  Escenario: No se puede registrar un pago sin elegir un plan
    Cuando confirma el pago sin elegir un plan
    Entonces no debería existir ningún pago registrado
    Y el formulario de pago debería seguir abierto mostrando un error

  @adversarial
  Escenario: Un doble clic en confirmar registra un solo pago
    Cuando confirma con doble clic un pago del primer plan
    Entonces debería existir 1 pago registrado con descuento 0
