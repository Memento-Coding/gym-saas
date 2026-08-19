# Documento de Requisitos

## Introducción

Transformación del sistema monolítico de gestión de MERAKI Martial Arts Academy (actualmente un archivo HTML de ~3280 líneas con React incrustado) en una aplicación web escalable con arquitectura moderna, separación de responsabilidades y buenas prácticas de desarrollo. El sistema gestiona estudiantes, membresías, pagos, consentimiento informado, inventario, ventas a crédito, finanzas y comunicación por WhatsApp.

## Glosario

- **Sistema**: La aplicación web MERAKI Martial Arts Academy en su totalidad
- **Módulo_Estudiantes**: Componente encargado del registro, consulta, edición y eliminación de estudiantes
- **Módulo_Membresías**: Componente que gestiona los planes de membresía y entrenamiento personalizado
- **Módulo_Pagos**: Componente que procesa registros de pago, créditos y abonos de mensualidades
- **Módulo_Consentimiento**: Componente que administra el consentimiento informado y autorización de imagen
- **Módulo_Finanzas**: Componente encargado de ingresos, egresos, traslados y resumen financiero
- **Módulo_Inventario**: Componente que gestiona productos y servicios disponibles para venta
- **Módulo_Ventas**: Componente que procesa ventas de contado y a crédito con plan de cuotas
- **Módulo_Mensajes**: Componente que gestiona plantillas de WhatsApp para comunicación con estudiantes
- **Módulo_Cortesías**: Componente que administra bonos de cortesía para estudiantes
- **Capa_Persistencia**: Servicio de almacenamiento de datos que reemplaza IndexedDB/localStorage
- **Router**: Componente de enrutamiento que gestiona la navegación entre módulos
- **Estudiante**: Persona inscrita en la academia con datos personales, membresía y pagos asociados
- **Membresía**: Plan de suscripción mensual con precio y categoría definida
- **Consentimiento**: Documento legal versionado que cada estudiante debe firmar
- **Venta_a_Crédito**: Venta de productos con plan de cuotas y seguimiento de pagos pendientes

## Requisitos

### Requisito 1: Arquitectura modular del proyecto

**Historia de Usuario:** Como desarrollador, quiero que la aplicación tenga una arquitectura modular con separación de responsabilidades, para que sea mantenible, testeable y escalable.

#### Criterios de Aceptación

1. THE Sistema SHALL organizarse en una estructura de proyecto con carpetas separadas para componentes, páginas, servicios, hooks, utilidades y tipos
2. THE Sistema SHALL utilizar React 18 con componentes funcionales y hooks como biblioteca de UI
3. THE Sistema SHALL implementar un bundler moderno (Vite) para desarrollo y producción
4. THE Sistema SHALL utilizar TypeScript para tipado estático de todos los módulos
5. THE Sistema SHALL separar la lógica de negocio de la capa de presentación mediante hooks personalizados y servicios
6. THE Sistema SHALL implementar un sistema de enrutamiento del lado del cliente con rutas para cada módulo principal: Dashboard, Estudiantes, Finanzas, Cortesías, Mensajes, Consentimiento y Ajustes

### Requisito 2: Capa de persistencia de datos

**Historia de Usuario:** Como desarrollador, quiero una capa de persistencia abstraída y confiable, para que los datos se almacenen de forma segura y la aplicación sea migrable a un backend en el futuro.

#### Criterios de Aceptación

1. THE Capa_Persistencia SHALL exponer una interfaz unificada para operaciones CRUD independiente del mecanismo de almacenamiento subyacente
2. THE Capa_Persistencia SHALL almacenar datos en IndexedDB como mecanismo primario con respaldo en localStorage
3. WHEN la Capa_Persistencia recibe una operación de escritura, THE Capa_Persistencia SHALL persistir los datos tanto en IndexedDB como en localStorage de forma sincronizada
4. THE Capa_Persistencia SHALL soportar exportación completa de datos a un archivo JSON con formato `meraki_backup_YYYY-MM-DD.json`
5. WHEN un archivo JSON de respaldo es importado, THE Capa_Persistencia SHALL validar la estructura del archivo antes de sobrescribir los datos existentes
6. IF IndexedDB no está disponible en el navegador, THEN THE Capa_Persistencia SHALL funcionar exclusivamente con localStorage sin pérdida de funcionalidad
7. THE Capa_Persistencia SHALL mantener un número de secuencia (`seq`) para la generación de comprobantes con formato `MRK-XXXX`

### Requisito 3: Gestión de estudiantes

**Historia de Usuario:** Como administrador de la academia, quiero registrar y gestionar estudiantes con toda su información personal y de membresía, para llevar un control completo de los inscritos.

#### Criterios de Aceptación

1. WHEN un nuevo estudiante es registrado, THE Módulo_Estudiantes SHALL almacenar: nombre, apellido, documento de identidad, teléfono, email, contacto de emergencia, fecha de nacimiento, tipo de sangre, fecha de inscripción, notas médicas y grado de cinturón
2. WHEN un estudiante es menor de edad, THE Módulo_Estudiantes SHALL requerir adicionalmente nombre y documento del acudiente o representante legal
3. THE Módulo_Estudiantes SHALL impedir el registro de dos estudiantes con el mismo número de documento de identidad
4. THE Módulo_Estudiantes SHALL clasificar a cada estudiante en uno de los siguientes estados: activo, congelado o inactivo
5. WHEN un estudiante activo tiene su fecha de vencimiento con más de 15 días de atraso, THE Módulo_Estudiantes SHALL cambiar automáticamente su estado a inactivo
6. THE Módulo_Estudiantes SHALL permitir búsqueda de estudiantes por nombre, apellido, documento o teléfono
7. THE Módulo_Estudiantes SHALL permitir filtrado por estado de pago (al día, por vencer, vencido) y por edad (menor, adulto)
8. WHEN un estudiante es eliminado, THE Módulo_Estudiantes SHALL solicitar confirmación explícita antes de ejecutar la eliminación

### Requisito 4: Gestión de membresías y planes

**Historia de Usuario:** Como administrador, quiero configurar y gestionar planes de membresía con precios editables, para adaptar la oferta a las necesidades del negocio.

#### Criterios de Aceptación

1. THE Módulo_Membresías SHALL gestionar dos categorías de planes: membresías grupales y entrenamiento personalizado
2. THE Módulo_Membresías SHALL incluir los siguientes planes de membresía grupal: Premium ($110,000), Estándar ($95,000), Básico ($80,000), Entrenamiento funcional ($80,000) y Clase única ($20,000)
3. THE Módulo_Membresías SHALL incluir los siguientes planes de entrenamiento personalizado: 1 clase ($60,000), 1 clase semanal con 4 al mes ($220,000), 2 clases por semana con 8 al mes ($430,000), 3 clases por semana con 12 al mes ($575,000) y 5 días por semana con 20 al mes ($790,000)
4. THE Módulo_Membresías SHALL permitir editar nombres y precios de los planes existentes desde la sección de ajustes
5. WHEN un plan tiene la propiedad `single` activa, THE Módulo_Membresías SHALL tratarlo como clase única sin extender la fecha de vencimiento del estudiante

### Requisito 5: Registro de pagos de mensualidad

**Historia de Usuario:** Como administrador, quiero registrar pagos de mensualidad vinculados a cada estudiante, para mantener el control de vigencias y generar comprobantes.

#### Criterios de Aceptación

1. WHEN un pago de mensualidad es registrado con estado "pagado", THE Módulo_Pagos SHALL extender la fecha de vencimiento del estudiante en un mes a partir de la fecha de vencimiento actual o la fecha del pago (la mayor)
2. WHEN un pago es registrado como mejora de plan, THE Módulo_Pagos SHALL actualizar el plan del estudiante sin extender la fecha de vencimiento
3. THE Módulo_Pagos SHALL soportar los siguientes métodos de pago: Efectivo, Nequi y Banco
4. THE Módulo_Pagos SHALL permitir registrar un descuento con monto y razón en cada pago
5. WHEN un pago es registrado exitosamente, THE Módulo_Pagos SHALL generar un comprobante con número secuencial formato `MRK-XXXX` que incluya datos del cliente, concepto, método de pago y total
6. THE Módulo_Pagos SHALL permitir dividir un pago entre varios métodos de pago con validación de que la suma iguale el monto total
7. THE Módulo_Pagos SHALL soportar pagos a crédito con plan de cuotas, abono inicial y seguimiento de saldo pendiente

### Requisito 6: Consentimiento informado y autorización de imagen

**Historia de Usuario:** Como administrador, quiero gestionar el consentimiento informado versionado con firma digital, para cumplir con los requisitos legales de la academia.

#### Criterios de Aceptación

1. THE Módulo_Consentimiento SHALL mantener dos versiones del texto de consentimiento: una para adultos y otra para menores de edad
2. THE Módulo_Consentimiento SHALL versionar el documento de consentimiento con un número incremental y fecha de actualización
3. WHEN la versión del consentimiento es actualizada, THE Módulo_Consentimiento SHALL marcar a todos los estudiantes como pendientes de nueva firma
4. THE Módulo_Consentimiento SHALL capturar la firma del estudiante (o representante legal en caso de menores) mediante un canvas de firma digital
5. WHEN un estudiante menor de edad es registrado sin presencia del acudiente, THE Módulo_Consentimiento SHALL permitir diferir la firma para una fecha posterior marcándola como pendiente
6. THE Módulo_Consentimiento SHALL permitir generar un PDF del consentimiento firmado que incluya datos del estudiante, texto completo del consentimiento, firma digitalizada y fecha de firma
7. THE Módulo_Consentimiento SHALL mantener un historial de firmas previas cuando un estudiante re-firma por actualización de versión

### Requisito 7: Módulo financiero

**Historia de Usuario:** Como administrador, quiero registrar y visualizar todos los movimientos financieros de la academia, para tener control contable completo del negocio.

#### Criterios de Aceptación

1. THE Módulo_Finanzas SHALL categorizar los movimientos en: ingresos, egresos y traslados
2. THE Módulo_Finanzas SHALL organizar los movimientos en sub-pestañas: pagos de membresía, ventas, inventario, cartera (créditos pendientes) y precios
3. THE Módulo_Finanzas SHALL permitir traslados entre medios de pago dentro de la misma caja y traslados entre cajas diferentes
4. THE Módulo_Finanzas SHALL calcular automáticamente los ingresos derivados de pagos de mensualidad registrados en perfiles de estudiantes sin duplicar registros
5. THE Módulo_Finanzas SHALL permitir filtrar movimientos por mes y por caja (servicios, almacén)
6. WHEN un movimiento de ingreso es de la categoría "Mensualidades", THE Módulo_Finanzas SHALL permitir vincularlo directamente a un estudiante específico
7. THE Módulo_Finanzas SHALL mostrar un resumen con totales de ingresos, egresos y balance por período

### Requisito 8: Inventario de productos y servicios

**Historia de Usuario:** Como administrador, quiero gestionar un inventario de productos y servicios, para controlar el stock y los precios de venta.

#### Criterios de Aceptación

1. THE Módulo_Inventario SHALL permitir registrar ítems de tipo "producto" (con stock) o "servicio" (sin stock)
2. WHEN un ítem de tipo producto es creado, THE Módulo_Inventario SHALL registrar: nombre, costo, precio de venta y cantidad en stock
3. WHEN una venta de producto es procesada, THE Módulo_Inventario SHALL descontar automáticamente la cantidad vendida del stock disponible
4. IF una venta excede el stock disponible de un producto, THEN THE Módulo_Inventario SHALL rechazar la transacción con un mensaje indicando las unidades disponibles
5. THE Módulo_Inventario SHALL permitir editar y eliminar ítems existentes
6. WHEN un egreso financiero está asociado a un producto del inventario, THE Módulo_Finanzas SHALL incrementar automáticamente el stock del producto

### Requisito 9: Ventas de contado y a crédito

**Historia de Usuario:** Como administrador, quiero procesar ventas de productos y servicios tanto de contado como a crédito, para ofrecer flexibilidad a los clientes.

#### Criterios de Aceptación

1. THE Módulo_Ventas SHALL permitir ventas a estudiantes registrados o a clientes externos (consumidor final)
2. THE Módulo_Ventas SHALL permitir incluir múltiples líneas de productos y servicios en una misma venta
3. WHEN una venta se procesa como crédito, THE Módulo_Ventas SHALL generar un plan de cuotas con fechas de vencimiento y montos
4. THE Módulo_Ventas SHALL ofrecer dos planes de crédito: cuota única con fecha personalizada, o tres cuotas con intervalos de 15 días
5. IF una venta a crédito incluye servicios, THEN THE Módulo_Ventas SHALL rechazar la transacción indicando que el crédito solo aplica para productos
6. WHEN una cuota de crédito es pagada, THE Módulo_Ventas SHALL recalcular automáticamente el saldo de las cuotas restantes si el monto pagado difiere del original
7. THE Módulo_Ventas SHALL generar un comprobante para cada venta y cada abono a crédito con número secuencial

### Requisito 10: Dashboard con indicadores y alertas

**Historia de Usuario:** Como administrador, quiero ver un resumen visual del estado de la academia con alertas prioritarias, para tomar decisiones informadas rápidamente.

#### Criterios de Aceptación

1. THE Sistema SHALL mostrar en el Dashboard las siguientes métricas: estudiantes activos al día, vencidos, por vencer, congelados, inactivos y total recaudado
2. THE Sistema SHALL mostrar alertas ordenadas por urgencia para: membresías vencidas, membresías por vencer en 3 días o menos, cuotas de cartera por vencer, y estudiantes sin consentimiento firmado
3. THE Sistema SHALL mostrar un gráfico comparativo de estudiantes activos por mes entre el año actual y el anterior
4. WHEN es el día de cumpleaños de un estudiante activo, THE Sistema SHALL mostrar una notificación especial en el Dashboard con opción de enviar felicitación por WhatsApp
5. THE Sistema SHALL permitir navegar directamente desde las alertas al perfil del estudiante o módulo correspondiente

### Requisito 11: Congelamiento y reactivación de membresías

**Historia de Usuario:** Como administrador, quiero congelar membresías de estudiantes por razones justificadas y extender automáticamente su vigencia, para mantener la equidad en el servicio.

#### Criterios de Aceptación

1. WHEN un estudiante es congelado, THE Módulo_Estudiantes SHALL registrar fecha de inicio, fecha de fin y razón del congelamiento
2. WHEN un congelamiento es registrado o modificado, THE Módulo_Estudiantes SHALL extender la fecha de vencimiento de la membresía por la cantidad de días del período de congelamiento
3. THE Módulo_Estudiantes SHALL permitir descongelar a un estudiante regresándolo al estado activo
4. THE Módulo_Estudiantes SHALL mostrar los estudiantes congelados como un grupo separado en la lista de estudiantes

### Requisito 12: Plantillas de mensajes WhatsApp

**Historia de Usuario:** Como administrador, quiero gestionar plantillas de mensajes de WhatsApp personalizables, para comunicarme eficientemente con los estudiantes sobre pagos, vencimientos y eventos.

#### Criterios de Aceptación

1. THE Módulo_Mensajes SHALL incluir las siguientes plantillas editables: aviso de vencimiento próximo, membresía vencida, invitación a volver (estudiante inactivo), cuota pendiente de cartera y feliz cumpleaños
2. THE Módulo_Mensajes SHALL soportar variables dinámicas en las plantillas: nombre del estudiante, fecha de vencimiento, monto y edad
3. WHEN una plantilla es editada, THE Módulo_Mensajes SHALL persistir los cambios y utilizarlos en todas las comunicaciones posteriores
4. THE Módulo_Mensajes SHALL generar el texto final reemplazando las variables con los datos reales del estudiante antes de copiar al portapapeles o abrir WhatsApp

### Requisito 13: Cortesías y bonos

**Historia de Usuario:** Como administrador, quiero otorgar días de cortesía a estudiantes, para gestionar situaciones especiales sin afectar la contabilidad de pagos.

#### Criterios de Aceptación

1. THE Módulo_Cortesías SHALL permitir registrar bonos de cortesía con fecha de inicio, fecha de fin, razón y duración en semanas
2. THE Módulo_Cortesías SHALL mostrar una lista consolidada de todos los bonos activos y pasados agrupados por estudiante
3. WHEN un bono de cortesía es registrado, THE Módulo_Cortesías SHALL asociarlo al perfil del estudiante sin modificar su fecha de vencimiento de membresía

### Requisito 14: Generación de comprobantes PDF

**Historia de Usuario:** Como administrador, quiero generar comprobantes en PDF para pagos y ventas, para entregar constancias formales a los clientes.

#### Criterios de Aceptación

1. THE Sistema SHALL generar comprobantes PDF con: logo de la academia, número secuencial, fecha, datos del cliente, detalle de conceptos con cantidades y precios, descuento aplicado, total y método de pago
2. WHEN una venta es a crédito, THE Sistema SHALL incluir en el comprobante el plan de cuotas con fechas y el saldo pendiente
3. THE Sistema SHALL utilizar el logo y wordmark personalizado si el usuario ha configurado uno en ajustes, o los valores por defecto en caso contrario
4. THE Sistema SHALL permitir descargar el comprobante como archivo PDF con nombre formato `comprobante_MRK-XXXX.pdf`

### Requisito 15: Configuración y personalización

**Historia de Usuario:** Como administrador, quiero personalizar la marca visual y gestionar los datos del sistema, para adaptar la aplicación a la identidad de la academia.

#### Criterios de Aceptación

1. THE Sistema SHALL permitir personalizar el logo, wordmark y tagline de la academia desde la sección de ajustes
2. THE Sistema SHALL permitir exportar todos los datos a un archivo JSON de respaldo
3. THE Sistema SHALL permitir importar datos desde un archivo JSON de respaldo previamente exportado
4. THE Sistema SHALL permitir reiniciar todos los datos del sistema (estudiantes, inventario, ventas y finanzas) con confirmación explícita, preservando la configuración de precios y consentimiento
5. WHEN los datos son importados exitosamente, THE Sistema SHALL notificar al usuario con un mensaje de confirmación
