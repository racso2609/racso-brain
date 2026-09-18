# 📜 Reglas y Estándares de Desarrollo de racso-brain

Este documento define las reglas operativas, arquitectónicas y de desarrollo de carácter **mandatorio** para todos los desarrolladores y agentes de inteligencia artificial que colaboren en el repositorio **racso-brain**. 

Cualquier propuesta, Pull Request o generación de código que infrinja estas reglas será rechazado hasta su adecuación.

---

## Índice

1. [Regla 1: Consulta Obligatoria de `docs/`](#regla-1-consulta-obligatoria-de-docs)
2. [Regla 2: Registro Continuo de Decisiones Técnicas (ADRs)](#regla-2-registro-continuo-de-decisiones-técnicas-adrs)
3. [Regla 3: Listas Paginadas con Infinite Scroll Obligatorio](#regla-3-listas-paginadas-con-infinite-scroll-obligatorio)
4. [Regla 4: Principio de Extensibilidad en Features](#regla-4-principio-de-extensibilidad-en-features)
5. [Regla 5: Desarrollo Guiado por Pruebas Obligatorio (TDD - Test-Driven Development)](#regla-5-desarrollo-guiado-por-pruebas-obligatorio-tdd---test-driven-development)
6. [Checklist de Verificación para Agentes y Desarrolladores](#checklist-de-verificación-para-agentes-y-desarrolladores)

---

## Regla 1: Consulta Obligatoria de `docs/`

> **Principio de "Zero Assumptions" (Cero Suposiciones):** Antes de iniciar cualquier análisis técnico, plan de trabajo, diseño de base de datos o implementación de código, es **estrictamente mandatorio** leer e interiorizar la documentación disponible en la carpeta `docs/`.

### 1.1 Documentación Base

Todo colaborador debe verificar la tríada documental fundamental:

| Documento | Enlace | Propósito y Contenido |
| :--- | :--- | :--- |
| **Visión y Génesis** | [`docs/first-idea.md`](file:///Users/racso/work/racso/racso-brain/docs/first-idea.md) | Propósito del sistema ("Second Brain" operativo y financiero), necesidades de negocio, usuarios objetivo y filosofía de diseño. |
| **Roadmap de Features** | [`docs/roadmap-features.md`](file:///Users/racso/work/racso/racso-brain/docs/roadmap-features.md) | Especificación funcional pormenorizada de las Features 1 a 4, flujos operativos, relaciones entre módulos y dependencias de entrega. |
| **Decisiones Técnicas** | [`docs/technical-decisions.md`](file:///Users/racso/work/racso/racso-brain/docs/technical-decisions.md) | Registro de Decisiones de Arquitectura (ADR), stack tecnológico oficial, esquemas Drizzle/PostgreSQL, políticas RLS y contratos de integración. |

### 1.2 Directrices Operativas

- **Prohibido asumir requerimientos:** Si un flujo, campo de base de datos o regla de negocio no está claro, primero se consulta `docs/`. Si la documentación no lo especifica, se plantea formalmente en lugar de inventar convenciones ad-hoc.
- **Alineación con la visión global:** Cada línea de código o nuevo endpoint debe encajar armónicamente en el ecosistema definido en `docs/roadmap-features.md` (identidad multi-tenant, activos mantenibles, hub de proyectos y ledger contable).

---

## Regla 2: Registro Continuo de Decisiones Técnicas (ADRs)

> **Principio de Trazabilidad Arquitectónica:** Ninguna decisión técnica de relevancia debe quedar en el aire, en hilos de chat efímeros o implícita en commits. Toda decisión debe registrarse formalmente.

### 2.1 Cuándo registrar un ADR

Es obligatorio añadir un nuevo registro o actualizar `docs/technical-decisions.md` ante:
- Adición o descarte de librerías o dependencias de infraestructura/core.
- Alteraciones estructurales en esquemas de base de datos (tablas maestras, estrategias de particionado, índices críticos o triggers).
- Cambios en patrones de autenticación, autorización multi-tenant o políticas de Row Level Security (RLS).
- Modificaciones en la mecánica de interacción entre módulos y el *Financial Ledger Engine*.
- Decisiones de performance, caching o consumo de APIs externas.

### 2.2 Formato Obligatorio del ADR

Todo nuevo ADR debe respetar la estructura de `Architecture Decision Record`:
1. **Identificador y Título:** (Ej: `ADR 002: Estrategia de Caché y Mutaciones Optimistas`).
2. **Tabla de Metadatos:** Código, Estado (*Propuesto*, *Aprobado*, *Reemplazado*), Fecha, Decisores y Documentos Relacionados.
3. **Contexto y Planteamiento del Problema:** Qué motiva la decisión y qué restricciones existen.
4. **Opciones Evaluadas:** Comparativa objetiva con pros y contras de cada alternativa.
5. **Decisión y Justificación (Rationale):** Qué opción se eligió y por qué razones técnicas/financieras/operativas.
6. **Consecuencias e Impacto:** Beneficios obtenidos, deudas técnicas asumidas y mitigaciones requeridas.

### 2.3 Registro en Memoria Duradera

Cuando la tarea sea ejecutada por un agente de IA, además de editar `docs/technical-decisions.md`, el agente debe persistir la decisión en la memoria duradera del sistema (vía Engram / `mem_save`), garantizando que futuras sesiones recuerden el razonamiento arquitectónico.

---

## Regla 3: Listas Paginadas con Infinite Scroll Obligatorio

> **Principio de Escalabilidad UI/UX y Backend:** Queda terminantemente prohibido listar colecciones completas de datos sin límite (`UNBOUNDED QUERIES`). Todo componente, endpoint o Server Action que retorne entidades debe estar paginado y consumir una interfaz con Infinite Scroll reactivo.

### 3.1 Alcance Obligatorio

Aplica sin excepción a todas las colecciones del sistema:
- Catálogo de Activos y Equipos Mantenibles.
- Registros de Lecturas (Odómetro / Horómetro).
- Órdenes y Bitácoras de Mantenimiento.
- Notas de Proyectos e Hitos.
- Asientos y Transacciones del *Financial Ledger*.
- Cuentas por Cobrar y Cuentas por Pagar.
- Logs de Auditoría e Historial de Actividad.

### 3.2 Estrategia de Paginación Backend

- **Preferido:** Paginación basada en cursores (*Cursor-based pagination* o *Keyset pagination*) utilizando `(created_at, id)` o valores ordenados estables. Evita la degradación cuadrática de rendimiento del `OFFSET` en PostgreSQL.
- **Parámetros de Entrada:**
  - `limit`: Entero con valor por defecto razonable (ej. 20) y límite máximo estricto (ej. 100).
  - `cursor`: Token opaco o tupla codificada (timestamp + id) que indica el último elemento cargado.
  - `direction`: `forward` (por defecto) o `backward`.
- **Estructura del Payload de Respuesta:**
  ```typescript
  interface PaginatedResponse<T> {
    items: T[];
    nextCursor: string | null;
    hasMore: boolean;
    totalCount?: number; // Solo si se calcula de forma eficiente
  }
  ```

### 3.3 Experiencia Frontend: Infinite Scroll & Virtualización

- **Carga Continua:** El frontend debe implementar Infinite Scroll automático (Intersection Observer en el centinela inferior o librerías estándar como `useInfiniteQuery` de `@tanstack/react-query`).
- **Virtualización:** En colecciones densas o de alto volumen (ej. bitácora de ledger o lecturas continuas de telemetría), se debe acoplar virtualización de listas (ej. `@tanstack/react-virtual`) para no saturar el DOM del navegador.
- **Prohibido:** No usar paginadores clásicos estilo "Página 1, 2, 3... 45" para listas operativas principales salvo que se trate de tablas analíticas o reportes con exportación explícita.

---

## Regla 4: Principio de Extensibilidad en Features

> **Principio Abierto/Cerrado (Open-Closed):** Todo esquema de base de datos, entidad de dominio y servicio de aplicación debe estar **abierto a la extensión pero cerrado a la modificación disruptiva**.

### 4.1 Activos Polimórficos y Atributos Dinámicos

Los activos no deben requerir crear nuevas tablas o añadir columnas específicas para cada tipo de equipo (autos, generadores, camiones, computadores, etc.):
- **Estructura Base + JSONB:** Las tablas maestras definen campos comunes (`id`, `tenant_id`, `name`, `category`, `status`, `created_at`).
- **Atributos Dinámicos:** Los datos variables se almacenan en columnas `custom_attributes JSONB` indexadas con GIN, permitiendo que nuevos tipos de equipos definan sus especificaciones sin migraciones de esquema en la base de datos.
- **Métricas Flexibles:** El sistema de telemetría debe admitir distintas unidades (`km`, `hours`, `cycles`, `liters`) mediante tipos enumerados extensibles y tablas hijas polimórficas.

### 4.2 Financial Ledger Engine Desacoplado

El núcleo financiero no debe acoplarse directamente a la lógica interna de los activos o de los proyectos:
- **Patrón Productor-Consumidor / Event-Driven:** Nuevos módulos operativos emiten transacciones o eventos estandarizados hacia el *Financial Ledger*:
  - Módulo Activos emite: `Gasto de Mantenimiento` / `Cuenta por Pagar a Proveedor`.
  - Módulo Proyectos emite: `Hito Facturable` / `Gasto Incurrido en Obra`.
  - Futuros Módulos (ej. Inventario, Nómina) emitirán sus respectivos comprobantes hacia el Ledger **sin modificar la tabla del ledger ni su lógica transaccional core**.
- **Inmutabilidad:** Las transacciones del ledger nunca se borran ni se sobreescriben; las correcciones se realizan mediante contra-asientos (*reversals*).

### 4.3 Multi-Tenancy y RBAC de Primera Clase

- Cualquier nueva entidad de datos debe heredar la columna `tenant_id` y su correspondiente política Row Level Security (RLS) en Supabase/PostgreSQL.
- Campos de auditoría obligatorios en todas las entidades: `created_at`, `updated_at`, `created_by`.

---

## Regla 5: Desarrollo Guiado por Pruebas Obligatorio (TDD - Test-Driven Development)

> **Principio de "Test-First" y Calidad Innegociable:** Queda estrictamente prohibido escribir código de producción sin antes contar con pruebas automatizadas que definan el comportamiento esperado y fallen de forma determinista antes de la implementación.

### 5.1 Flujo Mandatorio Red-Green-Refactor

Ningún código de producción (servicios, endpoints, hooks, utilidades o componentes complejos) debe escribirse al margen del ciclo TDD:
1. **Red (Falla Inicial):** Escribir primero la prueba automatizada unitaria o de integración que especifique el comportamiento deseado. Ejecutar la prueba y verificar que falle por la razón correcta (falta de implementación o contrato insatisfecho).
2. **Green (Paso Mínimo):** Escribir la cantidad estrictamente necesaria de código de producción para que la prueba pase exitosamente.
3. **Refactor (Mejora Continua):** Optimizar, limpiar y estructurar el código manteniendo todos los tests en verde en todo momento.

### 5.2 Cobertura Dual (Backend y Frontend)

Las pruebas deben cubrir de forma integral ambas capas de la aplicación:

- **Backend (Servicios, Server Actions y Persistencia):**
  - Pruebas unitarias y de integración sobre la lógica y reglas de negocio.
  - Verificación rigurosa de aislamiento multi-tenant: garantizar que ninguna consulta o mutación filtre datos de otros inquilinos (*cross-tenant data leakage*).
  - Guardias y políticas de autorización RBAC (Role-Based Access Control) y cumplimiento de RLS.
  - Transacciones atómicas del *Financial Ledger* (consistencia débito/crédito, inmutabilidad y balance).
  - Contratos de paginación cursor-based (`limit`, `nextCursor`, `hasMore`).

- **Frontend (Componentes, Hooks y UI Interoperable):**
  - Pruebas con React Testing Library y mocks controlados para componentes y flujos críticos.
  - Validación de formularios y mutaciones con manejo de errores visibles al usuario.
  - Flujos de autenticación y renderizado condicional según roles y permisos asignados.
  - Integración y comportamiento reactivo de Infinite Scroll (detección del centinela y carga incremental).

### 5.3 Prohibición de Mergear o Aprobar sin Tests

- No se aprobarán Pull Requests, propuestas ni entregas de código que no incluyan sus correspondientes pruebas automatizadas.
- Todo cambio debe superar exitosamente la suite de pruebas local ejecutando:
  ```bash
  npm run test
  ```
- No se tolerarán pruebas omitidas (`test.skip`), pruebas vacías o aserciones triviales orientadas a evadir la cobertura real.

---

## Checklist de Verificación para Agentes y Desarrolladores

Antes de dar por completada una tarea o aprobar un PR, verifica:

- [ ] ¿He revisado la documentación pertinente en `docs/` antes de diseñar o codificar?
- [ ] Si tomé una decisión de arquitectura o agregué una dependencia, ¿está redactada como ADR en `docs/technical-decisions.md` y registrada en memoria duradera?
- [ ] ¿Todos los endpoints, Server Actions y vistas que listan datos cuentan con paginación (`limit`, `cursor`) e Infinite Scroll en frontend?
- [ ] ¿El modelo de datos y la arquitectura permiten incorporar nuevos tipos de activos o nuevos módulos sin romper el esquema existente ni alterar el core financiero?
- [ ] ¿Todas las consultas a base de datos están debidamente filtradas por `tenant_id` con políticas RLS activas?
- [ ] ¿He aplicado el ciclo Red-Green-Refactor (TDD) implementando pruebas automatizadas tanto en backend como en frontend para los componentes y flujos involucrados?
- [ ] ¿Pasan todas las pruebas de la suite local (`npm run test`) de forma limpia y sin errores?
