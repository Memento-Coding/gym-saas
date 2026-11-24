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
    Y no debería descargarse nada sin pedirlo
    Y debería poder descargar su comprobante desde el aviso
    Y debería existir un ingreso por el valor neto del pago

  @adversarial
  Esquema del escenario: Un descuento inválido se rechaza sin registrar el pago
    Cuando confirma un pago del primer plan con descuento "<descuento>"
    Entonces no debería existir ningún pago registrado
    Y el formulario de pago debería seguir abierto mostrando un error

    Ejemplos:
      | descuento   |
      | -1          |
      | 1.5         |
      | 1-2         |
      | 99999999    |

  @adversarial
  Esquema del escenario: El campo de descuento bloquea los caracteres no numéricos al escribir
    Cuando escribe el descuento "<escrito>" sin confirmar
    Entonces el campo de descuento debería mostrar "<mostrado>"
    Ejemplos:
      | escrito | mostrado |
      | abc     |          |
      | 1,5     | 15       |
      | $10     | 10       |
  @adversarial
  Escenario: Una fecha de pago futura no registra el pago
    Cuando confirma un pago del primer plan con fecha de pago en 5 días
    Entonces no debería existir ningún pago registrado
    Y el formulario de pago debería seguir abierto mostrando un error

  @adversarial
  Escenario: No se puede registrar un pago sin elegir un plan
    Cuando el plan actual del estudiante ya no existe
    Y confirma el pago sin elegir un plan
    Entonces no debería existir ningún pago registrado
    Y el formulario de pago debería seguir abierto mostrando un error

  @adversarial
  Escenario: Un doble clic en confirmar registra un solo pago
    Cuando confirma con doble clic un pago del primer plan
    Entonces debería existir 1 pago registrado con descuento 0

  @critico
  Escenario: Un pago dividido que suma el total se registra con sus partes
    Cuando confirma un pago del primer plan dividido en dos partes que suman el total
    Entonces debería existir 1 pago registrado con 2 partes

  @adversarial
  Escenario: Un pago dividido que no suma el total se rechaza
    Cuando confirma un pago del primer plan dividido en dos partes que no suman el total
    Entonces no debería existir ningún pago registrado

  @regresion
  Escenario: Un pago a crédito se registra con su abono
    Cuando confirma un pago a crédito del primer plan con abono "1000"
    Entonces debería existir 1 pago registrado a crédito

  @adversarial
  Esquema del escenario: Un abono inválido no registra el crédito
    Cuando confirma un pago a crédito del primer plan con abono "<abono>"
    Entonces no debería existir ningún pago registrado
    Y el formulario de pago debería seguir abierto mostrando un error

    Ejemplos:
      | abono    |
      | -1       |
      | 1-2      |
      | 99999999 |
