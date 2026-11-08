# language: es
@e2e @finanzas
Característica: Traslados entre cajas
  Como administrador del gimnasio
  Quiero mover dinero entre cajas
  Para que cada caja refleje lo que realmente contiene

  Antecedentes:
    Cuando accede al módulo de finanzas

  @smoke
  Escenario: La página de finanzas muestra el resumen
    Entonces debería ver el resumen de ingresos y egresos

  @critico
  Escenario: Un traslado crea dos movimientos balanceados sin cambiar el balance
    Cuando registra un traslado de "5000"
    Entonces deberían existir 2 movimientos de traslado por 5000
    Y el balance total debería seguir en cero

  @adversarial
  Esquema del escenario: Un monto inválido no registra el traslado
    Cuando registra un traslado de "<monto>"
    Entonces no debería existir ningún movimiento
    Y debería ver un error en el formulario de traslado

    Ejemplos:
      | monto |
      | 0     |
      | -5000 |
      | abc   |
      |       |

  @adversarial
  Escenario: No se puede trasladar a la misma caja
    Cuando registra un traslado de "5000" hacia la misma caja
    Entonces no debería existir ningún movimiento
    Y debería ver un error en el formulario de traslado
