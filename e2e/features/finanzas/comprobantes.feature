# language: es
@e2e @finanzas
Característica: Comprobantes de pago
  Como administrador del gimnasio
  Quiero consultar y descargar los comprobantes por período
  Para no gestionar archivos sueltos

  Antecedentes:
    Dado que existe un pago de hoy con el comprobante "GOP-0042" del plan "Básico"
    Cuando consulta los comprobantes

  @smoke @critico
  Escenario: Los comprobantes del período se descargan en un solo PDF
    Entonces debería ver el comprobante "GOP-0042"
    Y el PDF del período debería descargarse como un solo archivo

  @critico
  Escenario: El resumen para Excel incluye el comprobante con su valor neto
    Entonces el resumen descargado debería contener "GOP-0042" con total 70000

  @adversarial
  Escenario: Una búsqueda sin resultados no permite descargar
    Cuando busca el comprobante "NO-EXISTE"
    Entonces las descargas en lote deberían estar deshabilitadas

  @adversarial
  Escenario: Un período invertido no permite descargar
    Cuando filtra los comprobantes desde dentro de 30 días
    Entonces debería avisar que el período no es válido
    Y las descargas en lote deberían estar deshabilitadas

  @adversarial
  Escenario: Un plan con forma de fórmula no se ejecuta en Excel
    Dado que existe un pago de hoy con el comprobante "GOP-0043" del plan "=HYPERLINK(1)"
    Cuando consulta los comprobantes
    Entonces el resumen descargado debería neutralizar la fórmula
