# Cuentas visibles en el detalle + card de contacto del cliente

**Fecha:** 2026-09-02
**Estado:** Aprobado, listo para implementación

## Problema

En el detalle de un proyecto, el checklist "Cuentas" (GitHub, Supabase,
Twilio, Google Play, Apple Developer, dominio…) está escondido dentro del
desplegable "Paneles" del header — cuesta saber de un vistazo qué cuentas
están hechas. Además, desde que el checklist pasa a tomar sus accesos
rápidos solo de la biblioteca de Videos (ver spec de "Videos explicativos"),
se perdieron presets que no tienen tutorial (Twilio, Google Play, Apple
Developer, Meta/WhatsApp). Por otro lado, el email/teléfono del cliente
existen en el modelo pero no se ven en el detalle del proyecto — hay que ir
a la sección Clientes a buscarlos.

## Diseño

### 1. Checklist de Cuentas como tarjeta propia
Se saca del `PanelsMenu`/modal y pasa a ser una sección visible directo en
`ProjectDetail`, entre "Avance del plan" y "Tareas del equipo". Mismo
contenido que `AccountsModal` hoy (lista con check, contador X/Y, botón
▶ ver Loom + copiar link cuando el item tiene `videoId`), pero **inline**,
sin modal — el modal deja de usarse (se elimina `accountsOpen`/`AccountsModal`
del flujo del detalle; su lógica de mutación se reutiliza en el componente
inline nuevo `AccountsPanel`).

### 2. Presets ampliados
`AGENCY_QUICK_ACCOUNT_PRESETS` (nombre nuevo, para no chocar con
`AGENCY_ACCOUNT_PRESETS` del vault de agencia): además de lo que ya sale de
la biblioteca de Videos, se agregan como botones fijos — sin depender de un
video — **Twilio**, **Google Play**, **Apple Developer**, **Meta/WhatsApp
Business**. Si más adelante alguno de estos consigue su propio video, el de
la biblioteca tiene prioridad (mismo criterio de dedupe por nombre que ya
existe con `has()`).

### 3. Cuenta personalizada, más visible
Se agrega un botón explícito **"+ Cuenta personalizada"** al lado de los
accesos rápidos (hoy es un input de texto suelto al pie del modal, fácil de
no ver). Mismo comportamiento: abre el campo de texto libre para cargar
cualquier nombre.

### 4. Card de contacto del cliente
Tarjeta nueva y chica en la columna derecha de `ProjectDetail`, arriba de
`ActivityRegistry` ("Registro de actividad"). Sin edición ahí mismo (se edita
desde Clientes, como hoy) — solo lectura + copiar:
- Nombre y empresa del contacto (`client.name`, `client.company`).
- Email con botón copiar (`CopyBtn`, ya existe).
- Teléfono con botón copiar + link directo a WhatsApp si hay número
  (`https://wa.me/<dígitos>`).
- Si el proyecto es interno (sin cliente) o el cliente no tiene esos datos
  cargados, la tarjeta no se muestra (no hay nada que mostrar).

## Fuera de alcance

- Edición del cliente desde esta tarjeta (se sigue editando desde Clientes).
- Integración de llamadas Fathom en el Registro de actividad — pedido
  aparte del usuario, spec propia a continuación de esta.
- Cualquier cambio al vault de cuentas de agencia (`Cuentas`/`agency_accounts`,
  spec anterior) — es un sistema distinto, no se toca.

## Testing

- Build verde.
- Local: abrir un proyecto con cliente y sin cliente (interno) — la card de
  contacto aparece solo cuando corresponde.
- Marcar/desmarcar cuentas desde la tarjeta inline, agregar un preset nuevo
  (ej. Twilio) y una cuenta personalizada, confirmar que persiste igual que
  antes (mismo campo `project.accounts`).
- Copiar email y teléfono, confirmar el link de WhatsApp arma bien el número.
