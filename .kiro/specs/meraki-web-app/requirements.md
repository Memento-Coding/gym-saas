# Requirements Document

## Introduction

Transformación del sistema monolítico de gestión de GymOps por Memento Coding (actualmente un archivo HTML de ~3280 líneas con React incrustado) en una aplicación web escalable con arquitectura moderna, separación de responsabilidades y buenas prácticas de desarrollo. El sistema gestiona estudiantes, membresías, pagos, consentimiento informado, inventario, ventas a crédito, finanzas y comunicación multicanal (Email, Telegram, WhatsApp) con implementación por fases.

## Glossary

- **Sistema**: La aplicación web GymOps en su totalidad
- **Módulo_Estudiantes**: Componente encargado del registro, consulta, edición y eliminación de estudiantes
- **Módulo_Membresías**: Componente que gestiona los planes de membresía y entrenamiento personalizado
- **Módulo_Pagos**: Componente que procesa registros de pago, créditos y abonos de mensualidades
- **Módulo_Consentimiento**: Componente que administra el consentimiento informado y autorización de imagen
- **Módulo_Finanzas**: Componente encargado de ingresos, egresos, traslados y resumen financiero
- **Módulo_Inventario**: Componente que gestiona productos y servicios disponibles para venta
- **Módulo_Ventas**: Componente que procesa ventas de contado y a crédito con plan de cuotas
- **Módulo_Comunicación**: Componente que gestiona el envío de mensajes y notificaciones a estudiantes a través de múltiples canales (Email, Telegram, WhatsApp) mediante una interfaz abstraída
- **Canal_Comunicación**: Abstracción que representa un medio de envío de mensajes (Email, Telegram o WhatsApp) con implementación intercambiable
- **Canal_Email**: Implementación del Canal_Comunicación para envío de notificaciones por correo electrónico (Fase 1)
- **Canal_Telegram**: Implementación del Canal_Comunicación para envío de mensajes mediante bot de Telegram (Fase 2)
- **Canal_WhatsApp**: Implementación del Canal_Comunicación para generación de enlaces o copia al portapapeles de mensajes de WhatsApp (Fase 3)
- **Plantilla_Mensaje**: Texto configurable con variables dinámicas que se adapta a cada canal de comunicación
- **Módulo_Cortesías**: Componente que administra bonos de cortesía para estudiantes
- **Capa_Persistencia**: Servicio de almacenamiento de datos que reemplaza IndexedDB/localStorage
- **Router**: Componente de enrutamiento que gestiona la navegación entre módulos
- **Estudiante**: Persona inscrita en la academia con datos personales, membresía y pagos asociados
- **Membresía**: Plan de suscripción mensual con precio y categoría definida
- **Consentimiento**: Documento legal versionado que cada estudiante debe firmar
- **Venta_a_Crédito**: Venta de productos con plan de cuotas y seguimiento de pagos pendientes
- **Configuración_Formulario**: Definición dinámica de los campos que componen el formulario de registro de estudiantes, incluyendo nombre, tipo de dato y obligatoriedad de cada campo
- **Módulo_Autenticación**: Componente que gestiona el inicio de sesión, registro de usuarios administrativos y protección de rutas mediante AWS Cognito
- **Cognito_User_Pool**: Servicio de AWS que almacena y autentica las credenciales de los usuarios administrativos del sistema

## Requirements

### Requirement 1: Arquitectura modular del proyecto

**User Story:** Como desarrollador, quiero que la aplicación tenga una arquitectura modular con separación de responsabilidades, para que sea mantenible, testeable y escalable.

#### Acceptance Criteria

1. THE Sistema SHALL organizarse en una estructura de proyecto con carpetas separadas para componentes, páginas, servicios, hooks, utilidades y tipos
2. THE Sistema SHALL utilizar React 18 con componentes funcionales y hooks como biblioteca de UI
3. THE Sistema SHALL implementar un bundler moderno (Vite) para desarrollo y producción
4. THE Sistema SHALL utilizar TypeScript para tipado estático de todos los módulos
5. THE Sistema SHALL separar la lógica de negocio de la capa de presentación mediante hooks personalizados y servicios
6. THE Sistema SHALL implementar un sistema de enrutamiento del lado del cliente con rutas para cada módulo principal: Dashboard, Estudiantes, Finanzas, Cortesías, Comunicación, Consentimiento y Ajustes

### Requirement 2: Capa de persistencia de datos

**User Story:** Como desarrollador, quiero una capa de persistencia abstraída y confiable, para que los datos se almacenen de forma segura y la aplicación sea migrable a un backend en el futuro.

#### Acceptance Criteria

1. THE Capa_Persistencia SHALL exponer una interfaz unificada para operaciones CRUD independiente del mecanismo de almacenamiento subyacente
2. THE Capa_Persistencia SHALL almacenar datos en IndexedDB como mecanismo primario con respaldo en localStorage
3. WHEN la Capa_Persistencia recibe una operación de escritura, THE Capa_Persistencia SHALL persistir los datos tanto en IndexedDB como en localStorage de forma sincronizada
4. THE Capa_Persistencia SHALL soportar exportación completa de datos a un archivo JSON con formato `gymops_backup_YYYY-MM-DD.json`
5. WHEN un archivo JSON de respaldo es importado, THE Capa_Persistencia SHALL validar la estructura del archivo antes de sobrescribir los datos existentes
6. IF IndexedDB no está disponible en el navegador, THEN THE Capa_Persistencia SHALL funcionar exclusivamente con localStorage sin pérdida de funcionalidad
7. THE Capa_Persistencia SHALL mantener un número de secuencia (`seq`) para la generación de comprobantes con formato `GOP-XXXX`

### Requirement 3: Gestión de estudiantes

**User Story:** Como administrador de la academia, quiero registrar y gestionar estudiantes con toda su información personal y de membresía, para llevar un control completo de los inscritos.

#### Acceptance Criteria

1. WHEN un nuevo estudiante es registrado, THE Módulo_Estudiantes SHALL almacenar: nombre, apellido, documento de identidad, teléfono, email, contacto de emergencia, fecha de nacimiento, tipo de sangre, fecha de inscripción, notas médicas y grado de cinturón
2. WHEN un estudiante es menor de edad, THE Módulo_Estudiantes SHALL requerir adicionalmente nombre y documento del acudiente o representante legal
3. THE Módulo_Estudiantes SHALL impedir el registro de dos estudiantes con el mismo número de documento de identidad
4. THE Módulo_Estudiantes SHALL clasificar a cada estudiante en uno de los siguientes estados: activo, congelado o inactivo
5. WHEN un estudiante activo tiene su fecha de vencimiento con más de 15 días de atraso, THE Módulo_Estudiantes SHALL cambiar automáticamente su estado a inactivo
6. THE Módulo_Estudiantes SHALL permitir búsqueda de estudiantes por nombre, apellido, documento o teléfono
7. THE Módulo_Estudiantes SHALL permitir filtrado por estado de pago (al día, por vencer, vencido) y por edad (menor, adulto)
8. WHEN un estudiante es eliminado, THE Módulo_Estudiantes SHALL solicitar confirmación explícita antes de ejecutar la eliminación
9. THE Módulo_Estudiantes SHALL renderizar el formulario de registro dinámicamente a partir de la configuración de campos definida por el administrador
10. WHEN un campo está marcado como obligatorio en la configuración, THE Módulo_Estudiantes SHALL impedir el envío del formulario si dicho campo está vacío
11. WHEN un campo es removido de la configuración, THE Módulo_Estudiantes SHALL omitir ese campo del formulario de registro sin eliminar los datos históricos previamente almacenados

### Requirement 4: Gestión de membresías y planes

**User Story:** Como administrador, quiero configurar y gestionar planes de membresía con precios editables, para adaptar la oferta a las necesidades del negocio.

#### Acceptance Criteria

1. THE Módulo_Membresías SHALL gestionar dos categorías de planes: membresías grupales y entrenamiento personalizado
2. THE Módulo_Membresías SHALL incluir los siguientes planes de membresía grupal: Premium ($110,000), Estándar ($95,000), Básico ($80,000), Entrenamiento funcional ($80,000) y Clase única ($20,000)
3. THE Módulo_Membresías SHALL incluir los siguientes planes de entrenamiento personalizado: 1 clase ($60,000), 1 clase semanal con 4 al mes ($220,000), 2 clases por semana con 8 al mes ($430,000), 3 clases por semana con 12 al mes ($575,000) y 5 días por semana con 20 al mes ($790,000)
4. THE Módulo_Membresías SHALL permitir editar nombres y precios de los planes existentes desde la sección de ajustes
5. WHEN un plan tiene la propiedad `single` activa, THE Módulo_Membresías SHALL tratarlo como clase única sin extender la fecha de vencimiento del estudiante

### Requirement 5: Registro de pagos de mensualidad

**User Story:** Como administrador, quiero registrar pagos de mensualidad vinculados a cada estudiante, para mantener el control de vigencias y generar comprobantes.

#### Acceptance Criteria

1. WHEN un pago de mensualidad es registrado con estado "pagado", THE Módulo_Pagos SHALL extender la fecha de vencimiento del estudiante en un mes a partir de la fecha de vencimiento actual o la fecha del pago (la mayor)
2. WHEN un pago es registrado como mejora de plan, THE Módulo_Pagos SHALL actualizar el plan del estudiante sin extender la fecha de vencimiento
3. THE Módulo_Pagos SHALL soportar los siguientes métodos de pago: Efectivo, Nequi y Banco
4. THE Módulo_Pagos SHALL permitir registrar un descuento con monto y razón en cada pago
5. WHEN un pago es registrado exitosamente, THE Módulo_Pagos SHALL generar un comprobante con número secuencial formato `GOP-XXXX` que incluya datos del cliente, concepto, método de pago y total
6. THE Módulo_Pagos SHALL permitir dividir un pago entre varios métodos de pago con validación de que la suma iguale el monto total
7. THE Módulo_Pagos SHALL soportar pagos a crédito con plan de cuotas, abono inicial y seguimiento de saldo pendiente

### Requirement 6: Consentimiento informado y autorización de imagen

**User Story:** Como administrador, quiero gestionar el consentimiento informado versionado con firma digital, para cumplir con los requisitos legales de la academia.

#### Acceptance Criteria

1. THE Módulo_Consentimiento SHALL mantener dos versiones del texto de consentimiento: una para adultos y otra para menores de edad
2. THE Módulo_Consentimiento SHALL versionar el documento de consentimiento con un número incremental y fecha de actualización
3. WHEN la versión del consentimiento es actualizada, THE Módulo_Consentimiento SHALL marcar a todos los estudiantes como pendientes de nueva firma
4. THE Módulo_Consentimiento SHALL capturar la firma del estudiante (o representante legal en caso de menores) mediante un canvas de firma digital
5. WHEN un estudiante menor de edad es registrado sin presencia del acudiente, THE Módulo_Consentimiento SHALL permitir diferir la firma para una fecha posterior marcándola como pendiente
6. THE Módulo_Consentimiento SHALL permitir generar un PDF del consentimiento firmado que incluya datos del estudiante, texto completo del consentimiento, firma digitalizada y fecha de firma
7. THE Módulo_Consentimiento SHALL mantener un historial de firmas previas cuando un estudiante re-firma por actualización de versión

### Requirement 7: Módulo financiero

**User Story:** Como administrador, quiero registrar y visualizar todos los movimientos financieros de la academia, para tener control contable completo del negocio.

#### Acceptance Criteria

1. THE Módulo_Finanzas SHALL categorizar los movimientos en: ingresos, egresos y traslados
2. THE Módulo_Finanzas SHALL organizar los movimientos en sub-pestañas: pagos de membresía, ventas, inventario, cartera (créditos pendientes) y precios
3. THE Módulo_Finanzas SHALL permitir traslados entre medios de pago dentro de la misma caja y traslados entre cajas diferentes
4. THE Módulo_Finanzas SHALL calcular automáticamente los ingresos derivados de pagos de mensualidad registrados en perfiles de estudiantes sin duplicar registros
5. THE Módulo_Finanzas SHALL permitir filtrar movimientos por mes y por caja (servicios, almacén)
6. WHEN un movimiento de ingreso es de la categoría "Mensualidades", THE Módulo_Finanzas SHALL permitir vincularlo directamente a un estudiante específico
7. THE Módulo_Finanzas SHALL mostrar un resumen con totales de ingresos, egresos y balance por período

### Requirement 8: Inventario de productos y servicios

**User Story:** Como administrador, quiero gestionar un inventario de productos y servicios, para controlar el stock y los precios de venta.

#### Acceptance Criteria

1. THE Módulo_Inventario SHALL permitir registrar ítems de tipo "producto" (con stock) o "servicio" (sin stock)
2. WHEN un ítem de tipo producto es creado, THE Módulo_Inventario SHALL registrar: nombre, costo, precio de venta y cantidad en stock
3. WHEN una venta de producto es procesada, THE Módulo_Inventario SHALL descontar automáticamente la cantidad vendida del stock disponible
4. IF una venta excede el stock disponible de un producto, THEN THE Módulo_Inventario SHALL rechazar la transacción con un mensaje indicando las unidades disponibles
5. THE Módulo_Inventario SHALL permitir editar y eliminar ítems existentes
6. WHEN un egreso financiero está asociado a un producto del inventario, THE Módulo_Finanzas SHALL incrementar automáticamente el stock del producto

### Requirement 9: Ventas de contado y a crédito

**User Story:** Como administrador, quiero procesar ventas de productos y servicios tanto de contado como a crédito, para ofrecer flexibilidad a los clientes.

#### Acceptance Criteria

1. THE Módulo_Ventas SHALL permitir ventas a estudiantes registrados o a clientes externos (consumidor final)
2. THE Módulo_Ventas SHALL permitir incluir múltiples líneas de productos y servicios en una misma venta
3. WHEN una venta se procesa como crédito, THE Módulo_Ventas SHALL generar un plan de cuotas con fechas de vencimiento y montos
4. THE Módulo_Ventas SHALL ofrecer dos planes de crédito: cuota única con fecha personalizada, o tres cuotas con intervalos de 15 días
5. IF una venta a crédito incluye servicios, THEN THE Módulo_Ventas SHALL rechazar la transacción indicando que el crédito solo aplica para productos
6. WHEN una cuota de crédito es pagada, THE Módulo_Ventas SHALL recalcular automáticamente el saldo de las cuotas restantes si el monto pagado difiere del original
7. THE Módulo_Ventas SHALL generar un comprobante para cada venta y cada abono a crédito con número secuencial

### Requirement 10: Dashboard con indicadores y alertas

**User Story:** Como administrador, quiero ver un resumen visual del estado de la academia con alertas prioritarias, para tomar decisiones informadas rápidamente.

#### Acceptance Criteria

1. THE Sistema SHALL mostrar en el Dashboard las siguientes métricas: estudiantes activos al día, vencidos, por vencer, congelados, inactivos y total recaudado
2. THE Sistema SHALL mostrar alertas ordenadas por urgencia para: membresías vencidas, membresías por vencer en 3 días o menos, cuotas de cartera por vencer, y estudiantes sin consentimiento firmado
3. THE Sistema SHALL mostrar un gráfico comparativo de estudiantes activos por mes entre el año actual y el anterior
4. WHEN es el día de cumpleaños de un estudiante activo, THE Sistema SHALL mostrar una notificación especial en el Dashboard con opción de enviar felicitación a través del canal de comunicación activo
5. THE Sistema SHALL permitir navegar directamente desde las alertas al perfil del estudiante o módulo correspondiente

### Requirement 11: Congelamiento y reactivación de membresías

**User Story:** Como administrador, quiero congelar membresías de estudiantes por razones justificadas y extender automáticamente su vigencia, para mantener la equidad en el servicio.

#### Acceptance Criteria

1. WHEN un estudiante es congelado, THE Módulo_Estudiantes SHALL registrar fecha de inicio, fecha de fin y razón del congelamiento
2. WHEN un congelamiento es registrado o modificado, THE Módulo_Estudiantes SHALL extender la fecha de vencimiento de la membresía por la cantidad de días del período de congelamiento
3. THE Módulo_Estudiantes SHALL permitir descongelar a un estudiante regresándolo al estado activo
4. THE Módulo_Estudiantes SHALL mostrar los estudiantes congelados como un grupo separado en la lista de estudiantes

### Requirement 12: Módulo de Comunicación multicanal (implementación por fases)

**User Story:** Como administrador, quiero gestionar plantillas de mensajes y enviar notificaciones a los estudiantes a través de múltiples canales (Email, Telegram, WhatsApp) con una arquitectura extensible por fases, para comunicarme eficientemente sobre pagos, vencimientos y eventos sin depender de un solo medio.

#### Acceptance Criteria

##### Arquitectura y canal abstraído

1. THE Módulo_Comunicación SHALL implementar una interfaz abstraída de Canal_Comunicación que permita agregar nuevos canales de forma incremental sin modificar la lógica de plantillas o selección de destinatarios
2. THE Módulo_Comunicación SHALL permitir al administrador configurar cuál o cuáles canales están activos para cada tipo de notificación (aviso de vencimiento, membresía vencida, invitación a volver, cuota pendiente, feliz cumpleaños)
3. THE Módulo_Comunicación SHALL mostrar en la interfaz de ajustes los canales disponibles según la fase implementada, permitiendo activar o desactivar cada uno individualmente

##### Plantillas multicanal

4. THE Módulo_Comunicación SHALL incluir las siguientes plantillas editables que funcionan en todos los canales activos: aviso de vencimiento próximo, membresía vencida, invitación a volver (estudiante inactivo), cuota pendiente de cartera y feliz cumpleaños
5. THE Módulo_Comunicación SHALL soportar variables dinámicas en las plantillas: nombre del estudiante, fecha de vencimiento, monto y edad
6. WHEN una plantilla es editada, THE Módulo_Comunicación SHALL persistir los cambios y utilizarlos en todas las comunicaciones posteriores en todos los canales activos
7. THE Módulo_Comunicación SHALL generar el texto final reemplazando las variables con los datos reales del estudiante antes de enviar por el canal correspondiente

##### Fase 1: Canal Email

8. THE Canal_Email SHALL permitir enviar notificaciones por correo electrónico a los estudiantes que tengan email registrado
9. WHEN el administrador envía una notificación por email, THE Canal_Email SHALL utilizar la plantilla seleccionada con las variables resueltas como cuerpo del correo
10. IF un estudiante no tiene email registrado, THEN THE Canal_Email SHALL omitir el envío para ese estudiante e informar al administrador

##### Fase 2: Canal Telegram

11. THE Canal_Telegram SHALL permitir enviar mensajes a estudiantes mediante un bot de Telegram integrado
12. WHEN el administrador envía una notificación por Telegram, THE Canal_Telegram SHALL utilizar la plantilla seleccionada con las variables resueltas como contenido del mensaje
13. IF un estudiante no tiene su cuenta de Telegram vinculada, THEN THE Canal_Telegram SHALL omitir el envío para ese estudiante e informar al administrador

##### Fase 3: Canal WhatsApp

14. THE Canal_WhatsApp SHALL generar el texto final de la plantilla y ofrecer la opción de copiar al portapapeles o abrir un enlace directo de WhatsApp con el mensaje prellenado
15. WHEN el administrador selecciona enviar por WhatsApp, THE Canal_WhatsApp SHALL utilizar el número de teléfono registrado del estudiante para generar el enlace `https://wa.me/{teléfono}?text={mensaje}`
16. IF un estudiante no tiene número de teléfono registrado, THEN THE Canal_WhatsApp SHALL deshabilitar la opción de envío por WhatsApp para ese estudiante

### Requirement 13: Cortesías y bonos

**User Story:** Como administrador, quiero otorgar días de cortesía a estudiantes, para gestionar situaciones especiales sin afectar la contabilidad de pagos.

#### Acceptance Criteria

1. THE Módulo_Cortesías SHALL permitir registrar bonos de cortesía con fecha de inicio, fecha de fin, razón y duración en semanas
2. THE Módulo_Cortesías SHALL mostrar una lista consolidada de todos los bonos activos y pasados agrupados por estudiante
3. WHEN un bono de cortesía es registrado, THE Módulo_Cortesías SHALL asociarlo al perfil del estudiante sin modificar su fecha de vencimiento de membresía

### Requirement 14: Generación de comprobantes PDF

**User Story:** Como administrador, quiero generar comprobantes en PDF para pagos y ventas, para entregar constancias formales a los clientes.

#### Acceptance Criteria

1. THE Sistema SHALL generar comprobantes PDF con: logo de la academia, número secuencial, fecha, datos del cliente, detalle de conceptos con cantidades y precios, descuento aplicado, total y método de pago
2. WHEN una venta es a crédito, THE Sistema SHALL incluir en el comprobante el plan de cuotas con fechas y el saldo pendiente
3. THE Sistema SHALL utilizar el logo y wordmark personalizado si el usuario ha configurado uno en ajustes, o los valores por defecto en caso contrario
4. THE Sistema SHALL permitir descargar el comprobante como archivo PDF con nombre formato `comprobante_GOP-XXXX.pdf`

### Requirement 15: Configuración y personalización

**User Story:** Como administrador, quiero personalizar la marca visual y gestionar los datos del sistema, para adaptar la aplicación a la identidad de la academia.

#### Acceptance Criteria

1. THE Sistema SHALL permitir personalizar el logo, wordmark y tagline de la academia desde la sección de ajustes
2. THE Sistema SHALL permitir exportar todos los datos a un archivo JSON de respaldo
3. THE Sistema SHALL permitir importar datos desde un archivo JSON de respaldo previamente exportado
4. THE Sistema SHALL permitir reiniciar todos los datos del sistema (estudiantes, inventario, ventas y finanzas) con confirmación explícita, preservando la configuración de precios y consentimiento
5. WHEN los datos son importados exitosamente, THE Sistema SHALL notificar al usuario con un mensaje de confirmación
6. THE Sistema SHALL permitir al administrador agregar campos personalizados al formulario de registro de estudiantes especificando: nombre del campo, tipo de dato (texto, número, fecha, selección) y obligatoriedad
7. THE Sistema SHALL permitir al administrador eliminar campos personalizados del formulario de registro de estudiantes
8. THE Sistema SHALL permitir al administrador cambiar la obligatoriedad de cada campo del formulario entre obligatorio y opcional
9. THE Sistema SHALL persistir la configuración de campos del formulario de registro de manera que sobreviva al reinicio de la aplicación

### Requirement 16: Autenticación y control de acceso

**User Story:** Como administrador, quiero que el acceso al sistema esté protegido con autenticación segura, para que solo usuarios autorizados puedan gestionar los datos de la academia.

#### Acceptance Criteria

1. THE Sistema SHALL requerir autenticación mediante AWS Cognito antes de permitir acceso a cualquier módulo o ruta protegida
2. THE Módulo_Autenticación SHALL soportar inicio de sesión con email y contraseña
3. THE Módulo_Autenticación SHALL soportar inicio de sesión con cuenta de Google (OAuth 2.0 social login)
4. WHEN un usuario no autenticado intenta acceder a una ruta protegida, THE Sistema SHALL redirigir automáticamente a la página de login
5. THE Módulo_Autenticación SHALL gestionar tokens JWT (access token, refresh token, ID token) emitidos por Cognito de forma segura en el cliente
6. WHEN el access token expira, THE Módulo_Autenticación SHALL renovar la sesión automáticamente usando el refresh token sin interrumpir la experiencia del usuario
7. THE Módulo_Autenticación SHALL permitir cerrar sesión eliminando los tokens almacenados y redirigiendo al login
8. THE Módulo_Autenticación SHALL permitir recuperación de contraseña mediante un flujo de verificación por email
9. THE Sistema SHALL mostrar el nombre y email del usuario autenticado en la interfaz (header/sidebar)
10. THE Módulo_Autenticación SHALL soportar un flujo de registro de nuevos usuarios administrativos con verificación de email
