# Implementation Plan: GymOps Web Application (Meraki) — 5-Developer Parallel Structure

## Overview

Refactorización del sistema monolítico GymOps (~3280 líneas en un archivo HTML) hacia una aplicación moderna con React 18, TypeScript, Vite, Tailwind CSS v4, shadcn/ui y Framer Motion. Este plan está optimizado para **5 desarrolladores trabajando en paralelo** con mínimas dependencias cruzadas.

**Estructura**:
- **Phase 0**: Fundación compartida (todos los devs colaboran)
- **Phase 1**: 5 tracks paralelos e independientes
- **Phase 2**: Integración final (todos los devs convergen)

---

## Tasks

### Phase 0: Shared Foundation (All Devs)

> Todos los desarrolladores colaboran en esta fase. DEBE completarse antes de iniciar Phase 1.

- [x] 1. Scaffolding del proyecto y configuración base
  - [x] 1.1 Inicializar proyecto con Vite + React 18 + TypeScript
    - Ejecutar `npm create vite@latest` con template react-ts
    - Configurar `tsconfig.json` con strict mode y path aliases (`@/`)
    - Instalar dependencias base: `react-router-dom`, `framer-motion`, `clsx`, `tailwind-merge`, `class-variance-authority`
    - Crear estructura de carpetas: `src/types/`, `src/services/`, `src/hooks/`, `src/pages/`, `src/components/`, `src/utils/`, `src/lib/`
    - Crear `src/lib/utils.ts` con la función `cn()` (clsx + tailwind-merge)
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

  - [x] 1.2 Configurar Tailwind CSS v4 con design system tokens
    - Instalar `tailwindcss` y `@tailwindcss/postcss`
    - Crear archivo CSS principal con todas las CSS custom properties del design system (colores, tipografía, spacing, shadows, border-radius, springs)
    - Configurar `tailwind.config.ts` mapeando tokens CSS a la configuración de Tailwind (colors, fontFamily, borderRadius)
    - Configurar dark mode con selector `[data-theme="dark"]`
    - Agregar estilos base de tipografía (Inter font, optical sizing, tracking)
    - Agregar media queries para `prefers-reduced-motion`, `prefers-reduced-transparency`, `prefers-contrast`
    - _Requirements: 1.1_

  - [x] 1.3 Configurar shadcn/ui y componentes base
    - Ejecutar `npx shadcn@latest init` con configuración del proyecto
    - Agregar componentes shadcn necesarios: button, input, dialog, sheet, table, badge, card, select, tabs, dropdown-menu, sonner, form, label, popover, command, calendar
    - Verificar que los componentes usan los tokens CSS del design system
    - _Requirements: 1.1_

  - [x] 1.4 Configurar Vitest y fast-check para testing
    - Instalar `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `fast-check`, `jsdom`
    - Configurar `vitest.config.ts` con environment jsdom
    - Crear archivo de setup para testing library
    - Crear carpeta `src/__tests__/` con estructura por módulo
    - _Requirements: 1.1_

- [x] 2. Tipos de datos y capa de persistencia
  - [x] 2.1 Definir todas las interfaces y tipos TypeScript
    - Crear `src/types/student.ts` con interfaces Student, ConsentRecord, ConsentHistoryEntry
    - Crear `src/types/membership.ts` con interfaces MembershipPlan, CostsConfig
    - Crear `src/types/payment.ts` con interfaces Payment, PaymentSplit, PaymentMethod
    - Crear `src/types/consent.ts` con interfaces ConsentConfig
    - Crear `src/types/finance.ts` con interface FinanceMovement
    - Crear `src/types/inventory.ts` con interface InventoryItem
    - Crear `src/types/sale.ts` con interfaces Sale, SaleItem, CreditPlan, CreditInstallment
    - Crear `src/types/communication.ts` con interfaces MessageTemplate, TemplateVariable, ChannelConfig, CommunicationConfig
    - Crear `src/types/courtesy.ts` con interface CourtesyBonus
    - Crear `src/types/settings.ts` con interfaces BrandingConfig, FormFieldConfig, AppMeta, AuthConfig
    - _Requirements: 1.4, 3.1, 4.1, 5.1, 6.1, 7.1, 8.1, 9.1, 12.1, 13.1, 15.1_

  - [x] 2.2 Implementar StorageService con IndexedDB y localStorage
    - Crear `src/services/storage/StorageService.ts` con interfaz unificada CRUD: get, set, delete, keys, exportAll, importAll, clear
    - Crear `src/services/storage/IndexedDBAdapter.ts` como adaptador primario
    - Crear `src/services/storage/LocalStorageAdapter.ts` como adaptador de fallback
    - Implementar detección automática de disponibilidad de IndexedDB
    - Implementar sincronización dual (IndexedDB + localStorage) en cada escritura
    - Implementar fallback transparente a localStorage si IndexedDB no está disponible
    - Crear `src/services/storage/ApiAdapter.ts` como placeholder para futura migración a DynamoDB
    - _Requirements: 2.1, 2.2, 2.3, 2.6_

  - [ ]* 2.3 Write property test: Persistence round-trip
    - **Property 1: Persistence round-trip**
    - Generar objetos válidos con fast-check (student, inventoryItem, sale, financeMovement)
    - Verificar que save → get produce objeto deepEqual al original
    - Mínimo 100 iteraciones
    - **Validates: Requirements 2.3, 3.1**

  - [x] 2.4 Implementar BackupService para exportación/importación
    - Crear `src/services/BackupService.ts`
    - Implementar `exportAll()` que genera JSON con formato `gymops_backup_YYYY-MM-DD.json`
    - Implementar `importAll()` con validación de estructura antes de sobrescribir
    - Implementar validación de schema: verificar keys requeridas, tipos correctos, datos no malformados
    - Implementar gestión del número de secuencia (`seq`) para comprobantes `GOP-XXXX`
    - _Requirements: 2.4, 2.5, 2.7_

  - [ ]* 2.5 Write property tests: Backup round-trip y validación
    - **Property 2: Backup export/import round-trip**
    - Generar estado de aplicación válido con fast-check
    - Verificar que exportAll → importAll produce estado deepEqual al original
    - **Property 3: Backup validation rejects invalid structures**
    - Generar JSON inválidos (keys faltantes, tipos incorrectos, datos malformados)
    - Verificar que se rechazan y el estado actual no cambia
    - **Property 4: Receipt sequence monotonicity and uniqueness**
    - Generar secuencias de N generaciones de comprobantes
    - Verificar unicidad y monotonicidad estricta del formato `GOP-XXXX`
    - **Validates: Requirements 2.4, 2.5, 2.7, 5.5, 9.7, 15.2, 15.3**

- [x] 3. Autenticación (AWS Cognito)
  - [x] 3.1 Implementar AuthService con AWS Amplify
    - Instalar `aws-amplify` v6
    - Crear `src/services/auth/AuthService.ts` wrapper sobre Amplify Auth con: signIn, signInWithGoogle, signUp, confirmSignUp, signOut, getCurrentUser, getAccessToken, resetPassword, confirmResetPassword
    - Configurar Amplify con AuthConfig (userPoolId, userPoolClientId, region, oauthDomain, redirects)
    - Implementar gestión de tokens JWT (access, refresh, ID token) con refresh automático
    - _Requirements: 16.1, 16.2, 16.3, 16.5, 16.6_

  - [x] 3.2 Implementar AuthProvider y ProtectedRoute
    - Crear `src/services/auth/AuthProvider.tsx` con React Context para estado de sesión
    - Crear `src/services/auth/ProtectedRoute.tsx` como HOC para rutas protegidas
    - Implementar redirección automática a `/login` para usuarios no autenticados
    - Implementar renovación automática de sesión con refresh token sin interrumpir al usuario
    - Mostrar nombre y email del usuario autenticado en header/sidebar
    - _Requirements: 16.4, 16.6, 16.7, 16.9_

  - [x] 3.3 Implementar páginas de autenticación
    - Crear `src/pages/LoginPage.tsx` con formulario email/password y botón de Google OAuth
    - Crear `src/pages/RegisterPage.tsx` con flujo de registro + verificación por email
    - Crear `src/pages/ForgotPasswordPage.tsx` con flujo de recuperación de contraseña
    - Aplicar design system tokens y animaciones (spring modal para formularios)
    - _Requirements: 16.2, 16.3, 16.8, 16.10_

  - [ ]* 3.4 Write property test: Route protection enforcement
    - **Property 35: Route protection enforcement**
    - Generar rutas protegidas y verificar que sin sesión válida se redirige a /login
    - Verificar que rutas públicas (/login, /registro, /recuperar-password) no redirigen
    - **Validates: Requirements 16.1, 16.4**

- [x] 4. Configurar enrutamiento y layout shell (sin contenido de módulos)
  - [x] 4.1 Crear layout principal y rutas placeholder
    - Configurar React Router v6 con rutas: `/`, `/estudiantes`, `/estudiantes/:id`, `/finanzas`, `/cortesias`, `/comunicacion`, `/consentimiento`, `/ajustes`, `/login`, `/registro`, `/recuperar-password`
    - Crear layout principal con sidebar (desktop) y drawer (mobile) usando materiales translúcidos (frosted glass)
    - Implementar responsive behavior: sidebar oculto (drawer) en mobile, colapsado (iconos) en tablet, expandido en desktop
    - Crear mobile header con material translúcido
    - Integrar ProtectedRoute en todas las rutas excepto /login, /registro, /recuperar-password
    - Crear páginas placeholder para cada ruta (solo título y layout)
    - _Requirements: 1.6, 16.1, 16.4_

- [x] 5. Checkpoint Phase 0 - Verificar fundación
  - Ensure all tests pass, ask the user if questions arise.
  - Verificar que todos los tipos compilan, persistencia funciona, auth protege rutas, y el shell de la app navega correctamente.

---

### Phase 1: Parallel Development Tracks

> Cada track es independiente. Los 5 desarrolladores trabajan simultáneamente después de Phase 0.

---

### Track A — Dev 1: Estudiantes + Formulario Dinámico + Congelamiento (Req 3, 11)

- [ ] 6. Módulo de estudiantes — Lógica de negocio
  - [ ] 6.1 Implementar StudentService con lógica de negocio
    - Crear `src/services/StudentService.ts` con operaciones: register, update, delete, getAll, getById, search, filter
    - Implementar validación de documento único (rechazar duplicados)
    - Implementar clasificación automática de estado: activo, congelado, inactivo
    - Implementar auto-desactivación de estudiantes con más de 15 días de atraso
    - Implementar búsqueda por nombre, apellido, documento o teléfono
    - Implementar filtrado por estado de pago (al día, por vencer, vencido) y edad (menor, adulto)
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

  - [ ]* 6.2 Write property tests: Estudiantes
    - **Property 5: Auto-deactivation of overdue students**
    - Generar estudiantes activos con subscriptionEndDate > 15 días atrás, verificar transición a inactivo
    - **Property 6: Document uniqueness enforcement**
    - Generar lista de estudiantes y nuevo registro con documentId duplicado, verificar rechazo
    - **Property 7: Student search correctness**
    - Generar lista no vacía y buscar por substring de firstName/lastName/documentId/phone
    - **Property 8: Student filter correctness**
    - Generar lista y filtros, verificar que todos los resultados satisfacen criterios y ninguno se excluye
    - **Validates: Requirements 3.3, 3.5, 3.6, 3.7**

  - [ ] 6.3 Implementar formulario dinámico de estudiantes
    - Crear `src/components/students/StudentForm.tsx` como renderizador dinámico basado en FormFieldConfig
    - Implementar renderizado de campos según tipo (text, number, date, select)
    - Implementar validación de campos obligatorios (impedir envío si campo vacío)
    - Implementar lógica condicional para menores (requerir acudiente)
    - Preservar datos históricos cuando un campo se elimina de la configuración
    - _Requirements: 3.9, 3.10, 3.11, 3.2_

  - [ ]* 6.4 Write property tests: Formulario dinámico
    - **Property 9: Dynamic form renders matching config**
    - Generar arrays de FormFieldDefinition, verificar que se renderizan campos correctos
    - **Property 10: Required field validation**
    - Generar campos required con valores vacíos, verificar error de validación
    - **Property 11: Config removal preserves historical data**
    - Generar estudiante con customFields y remover campo de config, verificar datos intactos
    - **Validates: Requirements 3.9, 3.10, 3.11, 3.2**

- [ ] 7. Congelamiento de membresías
  - [ ] 7.1 Implementar lógica de congelamiento
    - Agregar a StudentService: freezeStudent, unfreezeStudent
    - Implementar registro de fecha inicio, fecha fin y razón del congelamiento
    - Implementar extensión automática de subscriptionEndDate por la cantidad de días del período de congelamiento
    - Implementar descongelamiento regresando a estado activo
    - Mostrar estudiantes congelados como grupo separado en la lista
    - _Requirements: 11.1, 11.2, 11.3, 11.4_

  - [ ]* 7.2 Write property test: Congelamiento
    - **Property 28: Freeze extends subscription by freeze period**
    - Generar estudiante con fecha D y período de N días, verificar nueva fecha = D + N días
    - **Validates: Requirements 11.2**

- [ ] 8. UI de estudiantes
  - [ ] 8.1 Implementar hook useStudents y páginas
    - Crear `src/hooks/useStudents.ts` que conecta StudentService con componentes
    - Crear `src/pages/StudentsPage.tsx` con lista, búsqueda, filtros y acciones
    - Crear `src/components/students/StudentList.tsx` con DataTable (sorting, filtering)
    - Crear `src/components/students/StudentProfile.tsx` con perfil individual (incluyendo congelamiento)
    - Crear `src/components/students/StudentFilters.tsx` con filtros por estado y edad
    - Implementar confirmación explícita antes de eliminar estudiante
    - Aplicar animaciones: card press feedback, sheet para perfil mobile
    - _Requirements: 3.4, 3.6, 3.7, 3.8, 11.4_

- [ ] 9. Checkpoint Track A - Verificar estudiantes completo
  - Ensure all tests pass, ask the user if questions arise.

---

### Track B — Dev 2: Membresías + Pagos + Comprobantes PDF (Req 4, 5, 14)

- [ ] 10. Módulo de membresías
  - [ ] 10.1 Implementar MembershipService
    - Crear `src/services/MembershipService.ts` con gestión de planes
    - Implementar las dos categorías: membresías grupales y entrenamiento personalizado
    - Cargar planes por defecto (Premium, Estándar, Básico, Funcional, Clase única, Personalizados 1-5)
    - Implementar edición de nombres y precios desde ajustes
    - Implementar lógica de plan `single` (clase única sin extensión de vencimiento)
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [ ] 11. Módulo de pagos
  - [ ] 11.1 Implementar PaymentService
    - Crear `src/services/PaymentService.ts` con registro de pagos
    - Implementar extensión de fecha de vencimiento: `max(oldEndDate, paymentDate) + 1 mes`
    - Implementar lógica de mejora de plan (upgrade) sin extensión de vencimiento
    - Implementar soporte para métodos de pago: Efectivo, Nequi, Banco
    - Implementar descuento con monto y razón
    - Implementar pago dividido (split) con validación de que suma iguale total
    - Implementar pagos a crédito con plan de cuotas y abono inicial
    - Implementar generación de comprobante con número secuencial `GOP-XXXX`
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7_

  - [ ]* 11.2 Write property tests: Pagos y membresías
    - **Property 12: Subscription date extension correctness**
    - Generar estudiante + pago, verificar nueva fecha = max(oldEnd, payDate) + 1 mes (o sin cambio para upgrade/single)
    - **Property 13: Split payment sum validation**
    - Generar splits y verificar aceptación solo si suma == total
    - **Validates: Requirements 4.5, 5.1, 5.2, 5.6**

- [ ] 12. Generación de comprobantes PDF
  - [ ] 12.1 Implementar ReceiptService
    - Crear `src/services/ReceiptService.ts` con ReceiptGenerator
    - Instalar `jsPDF` para generación client-side de PDFs
    - Implementar comprobante con: logo, número secuencial, fecha, datos del cliente, detalle de conceptos, descuento, total, método de pago
    - Implementar inclusión de plan de cuotas y saldo pendiente para ventas a crédito
    - Implementar uso de logo/wordmark personalizado o valores por defecto
    - Implementar descarga como `comprobante_GOP-XXXX.pdf`
    - _Requirements: 14.1, 14.2, 14.3, 14.4_

  - [ ]* 12.2 Write unit tests: Comprobantes PDF
    - Verificar estructura del PDF generado (campos requeridos presentes)
    - Verificar formato de nombre de archivo
    - Verificar inclusión de plan de cuotas para créditos
    - _Requirements: 14.1, 14.2, 14.4_

- [ ] 13. UI de pagos y membresías
  - [ ] 13.1 Implementar componentes de pagos y hook
    - Crear `src/hooks/usePayments.ts` y `src/hooks/useMemberships.ts`
    - Crear `src/components/payments/PaymentForm.tsx` con formulario de pago
    - Crear `src/components/payments/SplitPaymentEditor.tsx` para pagos divididos
    - Crear `src/components/payments/PaymentHistory.tsx` para historial
    - Integrar selección de plan, método de pago, descuento y split
    - Integrar generación y descarga de comprobante PDF al registrar pago
    - _Requirements: 5.1, 5.3, 5.4, 5.6, 14.1_

- [ ] 14. Checkpoint Track B - Verificar pagos y comprobantes
  - Ensure all tests pass, ask the user if questions arise.

---

### Track C — Dev 3: Inventario + Ventas + Crédito (Req 8, 9)

- [ ] 15. Módulo de inventario
  - [ ] 15.1 Implementar InventoryService
    - Crear `src/services/InventoryService.ts`
    - Implementar registro de ítems tipo producto (con stock) y servicio (sin stock)
    - Implementar descuento automático de stock al vender
    - Implementar rechazo de venta cuando excede stock disponible
    - Implementar incremento de stock por egresos financieros vinculados a producto
    - Implementar edición y eliminación de ítems
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6_

- [ ] 16. Módulo de ventas
  - [ ] 16.1 Implementar SaleService
    - Crear `src/services/SaleService.ts`
    - Implementar ventas a estudiantes registrados y clientes externos
    - Implementar múltiples líneas de productos/servicios por venta
    - Implementar ventas a crédito con plan de cuotas (única o 3 cuotas cada 15 días)
    - Implementar rechazo de crédito si incluye servicios
    - Implementar recálculo de saldo al pagar cuotas con monto diferente
    - Implementar generación de comprobante con número secuencial
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7_

  - [ ]* 16.2 Write property tests: Inventario y ventas
    - **Property 20: Inventory stock invariant**
    - Generar producto con stock S, venta Q ≤ S → nuevo stock = S-Q; Q > S → rechazo; compra Q → S+Q
    - **Property 21: Sale total equals sum of line subtotals**
    - Generar venta con N líneas, verificar total = sum(qty × unitPrice)
    - **Property 22: Credit installment date spacing**
    - Generar crédito single (1 cuota) y three_installments (3 cuotas, 15 días entre cada una)
    - **Property 23: Credit with services rejection**
    - Generar venta crédito con al menos un servicio, verificar rechazo
    - **Property 24: Credit recalculation on partial payment**
    - Generar plan crédito, pagar parcialmente, verificar saldo restante = anterior - pago
    - **Property 14: Credit installments sum to total**
    - Generar crédito con total T y pago inicial P, verificar sum(installments) = T - P
    - **Validates: Requirements 8.3, 8.4, 8.6, 9.2, 9.3, 9.4, 9.5, 9.6, 5.7**

- [ ] 17. UI de inventario y ventas
  - [ ] 17.1 Implementar componentes de inventario y ventas
    - Crear `src/hooks/useInventory.ts` y `src/hooks/useSales.ts`
    - Crear `src/components/inventory/InventoryList.tsx` con DataTable
    - Crear `src/components/inventory/InventoryForm.tsx` para CRUD de ítems
    - Crear `src/components/sales/SaleForm.tsx` con formulario de venta
    - Crear `src/components/sales/CreditPlanEditor.tsx` para configurar crédito
    - Crear `src/components/sales/SaleHistory.tsx` con historial
    - _Requirements: 8.1, 8.5, 9.1, 9.2, 9.4_

- [ ] 18. Checkpoint Track C - Verificar inventario y ventas
  - Ensure all tests pass, ask the user if questions arise.

---

### Track D — Dev 4: Dashboard + Finanzas (Req 7, 10)

- [ ] 19. Módulo financiero
  - [ ] 19.1 Implementar FinanceService
    - Crear `src/services/FinanceService.ts`
    - Implementar categorización: ingresos, egresos, traslados
    - Implementar sub-categorías: pagos de membresía, ventas, inventario, cartera, precios
    - Implementar traslados entre medios de pago y entre cajas (servicios, almacén)
    - Implementar cálculo automático de ingresos por membresías sin duplicación
    - Implementar filtrado por mes y por caja
    - Implementar vinculación de movimientos a estudiantes
    - Implementar resumen con totales de ingresos, egresos y balance por período
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7_

  - [ ]* 19.2 Write property tests: Finanzas
    - **Property 17: Finance balance invariant**
    - Generar lista de movimientos, verificar balance = sum(ingresos) - sum(egresos), transfers neutros
    - **Property 18: Finance filter correctness**
    - Generar movimientos con mes/caja, aplicar filtros, verificar completitud y correctitud
    - **Property 19: Transfer creates balanced movements**
    - Generar traslado, verificar que crea débito + crédito iguales con efecto neto cero
    - **Validates: Requirements 7.3, 7.5, 7.7**

  - [ ] 19.3 Implementar componentes de finanzas
    - Crear `src/hooks/useFinance.ts`
    - Crear `src/pages/FinancePage.tsx` con tabs para sub-categorías
    - Crear `src/components/finance/FinanceOverview.tsx` con resumen y totales
    - Crear `src/components/finance/FinanceMovements.tsx` con tabla de movimientos
    - Crear `src/components/finance/TransferForm.tsx` para traslados
    - _Requirements: 7.1, 7.2, 7.5, 7.7_

- [ ] 20. Dashboard con métricas y alertas
  - [ ] 20.1 Implementar lógica de dashboard
    - Crear funciones de cálculo de métricas: activos al día, vencidos, por vencer, congelados, inactivos, total recaudado
    - Implementar clasificación mutuamente exclusiva (un estudiante en exactamente una categoría)
    - Implementar generación de alertas ordenadas por urgencia: vencidas > por vencer (3 días) > cuotas por vencer > sin consentimiento
    - Implementar detección de cumpleaños (comparar mes+día, ignorar año)
    - Implementar gráfico comparativo de activos por mes (año actual vs anterior)
    - _Requirements: 10.1, 10.2, 10.3, 10.4_

  - [ ]* 20.2 Write property tests: Dashboard
    - **Property 25: Dashboard metrics partition**
    - Generar lista de estudiantes, verificar que la suma de categorías = total y sin duplicados
    - **Property 26: Dashboard alerts sorted by urgency**
    - Generar alertas, verificar orden: vencidas → por_vencer → cuotas → sin_consentimiento
    - **Property 27: Birthday detection**
    - Generar fechas de nacimiento, verificar isBirthdayToday retorna true sii mes+día coinciden con hoy
    - **Validates: Requirements 10.1, 10.2, 10.4**

  - [ ] 20.3 Implementar DashboardPage y componentes
    - Crear `src/pages/DashboardPage.tsx` como vista principal
    - Crear `src/components/dashboard/MetricsCards.tsx` con tarjetas de métricas
    - Crear `src/components/dashboard/AlertsList.tsx` con alertas navegables a módulos
    - Crear `src/components/dashboard/BirthdayNotification.tsx` con opción de enviar felicitación
    - Crear `src/components/dashboard/MonthlyChart.tsx` con gráfico comparativo (recharts)
    - Implementar navegación directa desde alertas al perfil/módulo correspondiente
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

- [ ] 21. Checkpoint Track D - Verificar finanzas y dashboard
  - Ensure all tests pass, ask the user if questions arise.

---

### Track E — Dev 5: Comunicación + Consentimiento + Cortesías + Ajustes (Req 6, 12, 13, 15)

- [ ] 22. Módulo de consentimiento informado
  - [x] 22.1 Implementar ConsentService
    - Crear `src/services/ConsentService.ts`
    - Implementar versionado con texto separado para adultos y menores
    - Implementar actualización de versión que marca a todos los estudiantes como pendientes
    - Implementar firma diferida para menores sin presencia de acudiente
    - Implementar historial de firmas previas al re-firmar
    - _Requirements: 6.1, 6.2, 6.3, 6.5, 6.7_

  - [ ]* 22.2 Write property tests: Consentimiento
    - **Property 15: Consent version invalidates all signatures**
    - Generar N estudiantes con firma válida, actualizar versión, verificar todos pendientes
    - **Property 16: Consent re-sign preserves history**
    - Generar estudiante con consent firmado, re-firmar, verificar append a history
    - **Validates: Requirements 6.3, 6.7**

  - [ ] 22.3 Implementar componentes de consentimiento
    - Crear `src/hooks/useConsent.ts`
    - Crear `src/pages/ConsentPage.tsx` con gestión de consentimiento
    - Crear `src/components/consent/ConsentViewer.tsx` para ver textos por versión
    - Crear `src/components/consent/SignatureCanvas.tsx` con canvas de firma digital
    - Crear `src/components/consent/ConsentPDF.tsx` para generación de PDF del consentimiento firmado
    - _Requirements: 6.1, 6.4, 6.6_

- [ ] 23. Módulo de comunicación multicanal
  - [ ] 23.1 Implementar CommunicationService e interfaz de canales
    - Crear `src/services/communication/ChannelInterface.ts` con interfaz CommunicationChannel
    - Crear `src/services/communication/EmailChannel.ts` (Fase 1) — envío por email con plantilla
    - Crear `src/services/communication/TelegramChannel.ts` (Fase 2) — envío via bot de Telegram
    - Crear `src/services/communication/WhatsAppChannel.ts` (Fase 3) — generación de enlace wa.me o copia al portapapeles
    - Crear `src/services/CommunicationService.ts` con gestión de canales, plantillas y envío
    - Implementar motor de plantillas (TemplateEngine) con variables dinámicas: nombre, fecha vencimiento, monto, edad
    - Implementar configuración de canales activos por tipo de notificación
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.8, 12.11, 12.14_

  - [ ]* 23.2 Write property tests: Comunicación
    - **Property 29: Template rendering replaces all variables**
    - Generar template con M placeholders y mapa completo, verificar cero placeholders restantes
    - **Property 30: Channel availability based on contact info**
    - Generar estudiantes con/sin email/telegramChatId/phone, verificar canSendTo correcto por canal
    - **Property 31: WhatsApp URL generation format**
    - Generar phone + message, verificar formato URL = `https://wa.me/{phone}?text={encoded}`
    - **Validates: Requirements 12.5, 12.7, 12.10, 12.13, 12.14, 12.15, 12.16**

  - [ ] 23.3 Implementar componentes de comunicación
    - Crear `src/hooks/useCommunication.ts`
    - Crear `src/pages/CommunicationPage.tsx` con gestión de plantillas y envío
    - Crear `src/components/communication/TemplateEditor.tsx` para editar plantillas
    - Crear `src/components/communication/ChannelSelector.tsx` para activar/desactivar canales
    - Crear `src/components/communication/MessagePreview.tsx` para previsualizar mensaje resuelto
    - Implementar envío en lote con reporte de omitidos por falta de contacto
    - _Requirements: 12.4, 12.6, 12.9, 12.10, 12.12, 12.13, 12.15, 12.16_

- [ ] 24. Módulo de cortesías
  - [ ] 24.1 Implementar CourtesyService y componentes
    - Crear `src/services/CourtesyService.ts`
    - Implementar registro de bonos con fecha inicio, fin, razón y duración en semanas
    - Implementar que los bonos NO modifican la fecha de vencimiento de membresía
    - Crear `src/hooks/useCourtesies.ts`
    - Crear `src/pages/CourtesiesPage.tsx` con lista consolidada de bonos agrupados por estudiante
    - _Requirements: 13.1, 13.2, 13.3_

  - [ ]* 24.2 Write property test: Cortesías
    - **Property 32: Courtesy bonus preserves subscription date**
    - Generar estudiante con subscriptionEndDate D, registrar bono, verificar D sin cambio
    - **Validates: Requirements 13.3**

- [ ] 25. Configuración y personalización
  - [ ] 25.1 Implementar SettingsPage y componentes
    - Crear `src/hooks/useSettings.ts`
    - Crear `src/pages/SettingsPage.tsx` con secciones: branding, planes, formulario, backup, canales de comunicación
    - Crear `src/components/settings/BrandingForm.tsx` para logo, wordmark, tagline
    - Crear `src/components/settings/PlanEditor.tsx` para editar nombres y precios de planes
    - Crear `src/components/settings/FormFieldConfig.tsx` para agregar/eliminar/editar campos del formulario dinámico
    - Crear `src/components/settings/BackupManager.tsx` para exportar, importar y reiniciar datos
    - Implementar reinicio de datos (vaciar estudiantes, inventario, ventas, finanzas) preservando precios y consentimiento
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5, 15.6, 15.7, 15.8, 15.9_

  - [ ]* 25.2 Write property tests: Configuración
    - **Property 33: System reset preserves configuration**
    - Generar estado completo, ejecutar reset, verificar arrays vacíos pero costs/consent intactos
    - **Property 34: Form field config persistence round-trip**
    - Generar FormFieldConfig[], guardar y recargar, verificar deepEqual
    - **Validates: Requirements 15.4, 15.9**

- [ ] 26. Checkpoint Track E - Verificar comunicación, consentimiento, cortesías y ajustes
  - Ensure all tests pass, ask the user if questions arise.

---

### Phase 2: Integration & Polish (All Devs)

> Todos los desarrolladores convergen para integrar módulos, animaciones y verificar flujos cross-module.

- [ ] 27. Animaciones y componentes comunes
  - [ ] 27.1 Implementar sistema de animaciones con Framer Motion
    - Crear `src/hooks/useGymOpsSpring.ts` con spring presets (modal, sidebar, drawer, card, badge, tab, toast, dropdown)
    - Crear `src/components/common/AnimatedModal.tsx` con spring scale desde trigger + AnimatePresence
    - Crear `src/components/common/AnimatedSheet.tsx` con velocity handoff y snap points
    - Crear `src/components/common/AnimatedDrawer.tsx` con rubber-banding
    - Implementar press feedback global (scale 0.97 en whileTap) en botones y cards
    - Implementar spatial consistency (transform-origin anclado al trigger)
    - Implementar useReducedMotion para degradación a cross-fades de 200ms
    - _Requirements: 1.1_

  - [ ] 27.2 Implementar componentes custom comunes
    - Crear `src/components/common/MoneyInput.tsx` — input numérico para montos con formato COP
    - Crear `src/components/common/ConfirmDialog.tsx` — dialog de confirmación con cancel by dragging away
    - Crear `src/components/common/SearchBar.tsx` — barra de búsqueda con command palette
    - Crear `src/components/common/FilterBar.tsx` — barra de filtros con dropdowns animados
    - _Requirements: 1.1, 3.6, 3.7, 3.8_

- [ ] 28. Integración cross-module y wiring final
  - [ ] 28.1 Conectar flujos cross-module
    - Conectar pagos de estudiantes (Track A ↔ Track B): registrar pago desde perfil de estudiante genera comprobante PDF
    - Conectar ventas con inventario y finanzas (Track C ↔ Track D): venta descuenta stock y registra movimiento financiero
    - Conectar comunicación con dashboard (Track E ↔ Track D): alertas de cumpleaños disparan envío de felicitación por canal activo
    - Conectar consentimiento con dashboard (Track E ↔ Track D): alertas de sin consentimiento navegan a módulo
    - Conectar ajustes con formulario dinámico (Track E ↔ Track A): cambios en config de campos se reflejan en StudentForm
    - Verificar migración de datos: importar backup JSON existente carga todos los módulos correctamente
    - _Requirements: 1.6, 10.5, 16.1, 16.4_

  - [ ] 28.2 Aplicar animaciones a todos los módulos
    - Reemplazar pages placeholder con AnimatedModal en dialogs de todos los tracks
    - Aplicar AnimatedSheet en perfiles mobile de estudiantes y formularios de pago
    - Aplicar press feedback en cards de dashboard, student cards, inventory items
    - Aplicar spring transitions en tabs de finanzas y navegación entre módulos
    - Verificar coherencia de animaciones en toda la app
    - _Requirements: 1.1_

  - [ ]* 28.3 Write integration tests
    - Test: Registro de estudiante → pago de mensualidad → extensión de fecha → comprobante generado
    - Test: Crear producto → venta a crédito → descuento de stock → plan de cuotas → abono
    - Test: Actualizar versión de consentimiento → todos los estudiantes marcados pendientes → re-firma
    - Test: Congelamiento → extensión de fecha → descongelamiento
    - Test: Importar backup → verificar datos completos en todos los módulos
    - _Requirements: Multiple_

- [ ] 29. Final checkpoint - Verificar integración completa
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate the 35 universal correctness properties defined in the design
- Unit tests validate specific examples and edge cases
- The implementation uses TypeScript throughout, matching the design document
- shadcn/ui components are the foundation — custom components compose them
- Framer Motion animations are added as a layer on top in Phase 2, not embedded in base components during Phase 1
- AWS Cognito integration requires valid configuration (userPoolId, clientId) which should be provided via environment variables
- **Parallel execution**: After Phase 0, all 5 tracks are fully independent. Each dev owns their files/folders with zero conflicts.

### Developer Assignment Summary

| Developer | Track | Modules | Requirements |
|-----------|-------|---------|--------------|
| Dev 1 | Track A | Estudiantes, Formulario Dinámico, Congelamiento | 3, 11 |
| Dev 2 | Track B | Membresías, Pagos, Comprobantes PDF | 4, 5, 14 |
| Dev 3 | Track C | Inventario, Ventas, Crédito | 8, 9 |
| Dev 4 | Track D | Dashboard, Finanzas | 7, 10 |
| Dev 5 | Track E | Comunicación, Consentimiento, Cortesías, Ajustes | 6, 12, 13, 15 |

### File Ownership (No Conflicts in Phase 1)

| Developer | Owned Files/Folders |
|-----------|-------------------|
| Dev 1 | `services/StudentService.ts`, `components/students/`, `pages/StudentsPage.tsx`, `hooks/useStudents.ts` |
| Dev 2 | `services/MembershipService.ts`, `services/PaymentService.ts`, `services/ReceiptService.ts`, `components/payments/`, `hooks/usePayments.ts`, `hooks/useMemberships.ts` |
| Dev 3 | `services/InventoryService.ts`, `services/SaleService.ts`, `components/inventory/`, `components/sales/`, `hooks/useInventory.ts`, `hooks/useSales.ts` |
| Dev 4 | `services/FinanceService.ts`, `components/finance/`, `components/dashboard/`, `pages/FinancePage.tsx`, `pages/DashboardPage.tsx`, `hooks/useFinance.ts` |
| Dev 5 | `services/ConsentService.ts`, `services/CommunicationService.ts`, `services/CourtesyService.ts`, `services/communication/`, `components/consent/`, `components/communication/`, `components/settings/`, `pages/ConsentPage.tsx`, `pages/CommunicationPage.tsx`, `pages/CourtesiesPage.tsx`, `pages/SettingsPage.tsx`, `hooks/useConsent.ts`, `hooks/useCommunication.ts`, `hooks/useCourtesies.ts`, `hooks/useSettings.ts` |

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.4"] },
    { "id": 2, "tasks": ["1.3", "2.1"] },
    { "id": 3, "tasks": ["2.2", "2.4"] },
    { "id": 4, "tasks": ["2.3", "2.5", "3.1"] },
    { "id": 5, "tasks": ["3.2", "3.3"] },
    { "id": 6, "tasks": ["3.4", "4.1"] },
    { "id": 7, "tasks": ["6.1", "10.1", "15.1", "19.1", "22.1"] },
    { "id": 8, "tasks": ["6.2", "6.3", "11.1", "16.1", "19.2", "22.2", "23.1"] },
    { "id": 9, "tasks": ["6.4", "7.1", "11.2", "12.1", "16.2", "19.3", "22.3", "23.2"] },
    { "id": 10, "tasks": ["7.2", "8.1", "12.2", "13.1", "17.1", "20.1", "23.3", "24.1"] },
    { "id": 11, "tasks": ["20.2", "20.3", "24.2", "25.1"] },
    { "id": 12, "tasks": ["25.2"] },
    { "id": 13, "tasks": ["27.1", "27.2"] },
    { "id": 14, "tasks": ["28.1", "28.2"] },
    { "id": 15, "tasks": ["28.3"] }
  ]
}
```
