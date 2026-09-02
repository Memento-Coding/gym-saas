# language: es
@e2e @comunicacion
Característica: Gestión de comunicación con estudiantes
  Como administrador del gimnasio
  Quiero configurar y enviar mensajes a los estudiantes
  Para mantenerlos informados sobre vencimientos, cobros y novedades del gimnasio

  @smoke
  Escenario: Administrador accede al módulo de comunicación y ve las secciones disponibles
    Dado que existe un estudiante registrado
    Cuando accede al módulo de comunicación
    Entonces debería ver la pestaña de plantillas
    Y debería ver la pestaña de canales
    Y debería ver la pestaña de envío

  @smoke
  Escenario: El módulo muestra las plantillas de comunicación predeterminadas
    Dado que existe un estudiante registrado
    Cuando accede al módulo de comunicación
    Entonces debería ver la plantilla "Aviso de vencimiento próximo"
    Y debería ver la plantilla "Membresía vencida"
    Y debería ver la plantilla "Invitación a volver"
    Y debería ver la plantilla "Cuota pendiente de cartera"
    Y debería ver la plantilla "Feliz cumpleaños"

  @critico
  Escenario: Las plantillas incluyen variables dinámicas para personalizar los mensajes
    Dado que existe un estudiante registrado
    Cuando accede al módulo de comunicación
    Entonces la primera plantilla debería contener la variable dinámica del nombre

  @critico
  Escenario: Administrador actualiza el texto de una plantilla de comunicación
    Dado que existe un estudiante registrado
    Cuando accede al módulo de comunicación
    Y edita la primera plantilla con el texto "Hola {{nombre}}, texto de prueba E2E."
    Entonces debería ver el nuevo texto guardado en la plantilla

  @regresion
  Escenario: El módulo muestra los canales de comunicación disponibles
    Dado que existe un estudiante registrado
    Cuando accede al módulo de comunicación
    Y navega a la pestaña de canales
    Entonces debería ver el canal "Email"
    Y debería ver el canal "Telegram"
    Y debería ver el canal "WhatsApp"
    Y debería ver los controles para activar o desactivar cada canal

  @critico
  Escenario: Administrador no puede enviar un mensaje sin seleccionar una plantilla
    Dado que existe un estudiante registrado
    Cuando accede al módulo de comunicación
    Y navega a la pestaña de envío
    Entonces el botón de enviar debería estar deshabilitado

  @regresion
  Escenario: Administrador selecciona todos los estudiantes con un clic
    Dado que existe un estudiante registrado
    Cuando accede al módulo de comunicación
    Y navega a la pestaña de envío
    Y selecciona todos los estudiantes
    Entonces el botón debería cambiar a deseleccionar todos

  @regresion
  Escenario: Administrador previsualiza un mensaje antes de enviarlo
    Dado que existe un estudiante registrado
    Cuando accede al módulo de comunicación
    Y navega a la pestaña de envío
    Y selecciona la plantilla "Aviso de vencimiento"
    Entonces debería ver la opción de previsualizar el mensaje para el estudiante
    Y al previsualizar debería ver el nombre del estudiante resuelto en el mensaje
