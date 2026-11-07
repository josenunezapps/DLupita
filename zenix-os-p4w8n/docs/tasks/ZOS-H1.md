# ZOS-H1 — Núcleo de Zenix OS

**Estado:** para revisión (Jarvis) y aprobación (Russo)
**Rama:** `feat/ZOS-001-nucleo` en `josenunezapps/DLupita` (publicado también en `main`, ruta oculta)
**Fecha:** 06/11/2026

## Objetivo

Que el dueño de un comercio cree su negocio, cargue productos con stock, controle movimientos, cargue clientes y sume a su equipo con permisos distintos, desde el teléfono o la PC.

## Decisiones de Russo aplicadas

- Rubro piloto: comercio de productos.
- Venta sin stock: bloqueada por defecto (configurable).
- Base: proyecto Supabase de CotizaPro con prefijo `zos_` (el plan gratuito no permitió un proyecto nuevo).

## Alcance entregado

| ID | Qué | Estado |
| --- | --- | --- |
| ZOS-001 | Núcleo multi-negocio con RLS | Hecho |
| ZOS-002 | Roles dueño / supervisor / vendedor, validados en la base | Hecho |
| ZOS-003 | Alta del negocio (nombre, moneda, zona horaria) | Hecho |
| ZOS-004 | Invitaciones por código y enlace (WhatsApp), revocar, cambiar rol, desactivar | Hecho |
| ZOS-005 | Productos con categorías, código único, precio, costo, unidad, mínimo, stock inicial, activar/desactivar | Hecho (sin foto ni variantes) |
| ZOS-006 | Clientes | Hecho |
| ZOS-010 | Stock: entradas, salidas, ajuste por conteo, historial, alertas de mínimo | Hecho |
| ZOS-011 | Inicio con indicadores y alertas | Hecho (parcial: ventas en H2) |

**Pendiente para ZOS-H2:** nueva venta (ZOS-007), venta atómica e idempotente (ZOS-008), anulación (ZOS-009), caja, reportes (ZOS-012).
**Postergado:** foto de producto y variantes simples (el documento las pone en el MVP; se suman cuando el piloto las pida).

## Pruebas

| Prueba | Resultado | Evidencia |
| --- | --- | --- |
| Base real: roles, invitaciones, stock, inmutabilidad, aislamiento | **OK 41/41** | `supabase/tests/0001_nucleo.sql`, 06/11/2026, `FALLAS: 0`; todo revertido (0 negocios y 0 usuarios de prueba después) |
| Bug detectado por esa prueba | **Corregido** | La auditoría fallaba al crear un negocio (`0002_fix_auditoria.sql`) |
| E2E móvil y escritorio (backend simulado) | **OK 64/64** | `node zenix-os-p4w8n/tests/e2e.mjs`, varias corridas seguidas |
| Linter de seguridad de Supabase | **OK** con avisos aceptados | Funciones SECURITY DEFINER que validan rol y sesión por dentro |
| Frontend contra la base real | **NO EJECUTADO** | El entorno de desarrollo no llega a supabase.co. Lo cubre la checklist |

## Riesgos y pendientes

1. **Base compartida con CotizaPro:** un problema de rendimiento o una migración mala afecta a los dos productos. Cuando haya clientes pagando conviene separarlos (Supabase Pro o liberar un proyecto).
2. **Redirect URL** de Zenix OS sin agregar en Supabase: los emails de confirmación llevan a CotizaPro. La cuenta se confirma igual, pero después hay que entrar a Zenix OS a mano.
3. **El costo de los productos lo pueden leer todos los roles** a través de la API (la pantalla del vendedor no lo muestra). Si importa, en H2 se mueve a una vista separada.
4. Usuario con un solo negocio en V1 (no puede pertenecer a dos).

## Checklist de demo (Russo)

- [ ] Agregar la Redirect URL de Zenix OS en Supabase.
- [ ] Crear cuenta y negocio.
- [ ] Crear 2 categorías y 3 productos (uno sin control de stock). Ver la alerta del que queda bajo el mínimo.
- [ ] En Stock: una salida mayor a lo que hay (bloqueada), una salida con motivo, un ajuste por conteo y una entrada.
- [ ] En Equipo: generar invitación de vendedor y mandarla a otro teléfono o a otra cuenta tuya.
- [ ] Con la cuenta del vendedor: no puede editar productos ni mover stock; sí cargar clientes.
- [ ] Volver como dueño, cambiar el rol a supervisor y después desactivarlo.
