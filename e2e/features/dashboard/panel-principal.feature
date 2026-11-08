# language: es
@e2e @dashboard
Característica: Panel principal
  Como administrador del gimnasio
  Quiero ver el estado del negocio al entrar
  Para saber qué requiere atención hoy

  @smoke
  Escenario: Sin datos el panel muestra todo en cero y sin alertas
    Cuando accede al panel principal
    Entonces la métrica "Activos al día" debería ser 0
    Y la métrica "Total recaudado" debería ser 0
    Y debería ver que no hay alertas pendientes

  @critico
  Escenario: Las métricas reflejan el estado de cada estudiante
    Dado que hay un estudiante al día, uno por vencer, uno vencido y uno congelado
    Cuando accede al panel principal
    Entonces la métrica "Activos al día" debería ser 1
    Y la métrica "Por vencer" debería ser 1
    Y la métrica "Vencidos" debería ser 1
    Y la métrica "Congelados" debería ser 1

  @critico
  Escenario: El total recaudado suma ingresos e ignora egresos y traslados
    Dado que hay un ingreso de 100000, un egreso de 30000 y un traslado de 50000
    Cuando accede al panel principal
    Entonces la métrica "Total recaudado" debería ser 100000

  @critico
  Escenario: Una alerta lleva al perfil del estudiante afectado
    Dado que hay un estudiante con la membresía vencida llamado "Pedro Ruiz"
    Cuando accede al panel principal
    Y abre la alerta de "Pedro Ruiz"
    Entonces debería ver el perfil de "Pedro Ruiz"

  @adversarial
  Esquema del escenario: Datos dañados no rompen el panel
    Dado que hay un estudiante con vencimiento "<vencimiento>" y nacimiento "<nacimiento>"
    Cuando accede al panel principal
    Entonces debería ver el panel sin errores de la aplicación

    Ejemplos:
      | vencimiento | nacimiento |
      | basura      |            |
      |             | basura     |
      | mes-trece   | ayer       |
