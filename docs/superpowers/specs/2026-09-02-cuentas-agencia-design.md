# Cuentas de la agencia (vault interno) + fusión con Videos

**Fecha:** 2026-09-02
**Estado:** Aprobado, listo para implementación

## Problema

No hay un lugar central para guardar los accesos internos de la agencia
(GitHub, Supabase, Resend, hosting, dominio…) con usuario/contraseña y
contexto de cómo se accede. Nacho pidió renombrar la sección "Videos
explicativos" del sidebar a "Cuentas" y meter ahí adentro tanto este vault
nuevo como la librería de Looms que ya existe.

## Alcance

- Un vault de credenciales a **nivel agencia** (no por proyecto de cliente —
  eso ya existe como `project.vault` / `VaultModal`, no se toca).
- Visible para todo el equipo interno (PM/Dev/fundador), igual que el resto
  del sidebar no-Colaborador. Colaboradores y Clientes no acceden (ya no ven
  este ítem del menú, sin cambios ahí).
- La librería de Videos explicativos existente se muda de página propia a
  pestaña dentro de esta sección. Sin cambios funcionales en Videos.

## Diseño

### Sidebar
`key: 'videos'` → `key: 'cuentas'`, label **"Cuentas"** (mismo ícono `I2.film`
por ahora). Actualiza: lista de nav en `Sidebar`, mapa de `crumb`, switch de
render en `AppShell`.

### Página `CuentasView`
Reemplaza al actual `Videos()`. Tabs arriba: **Cuentas** (default) | **Videos**.
- Tab Videos: contenido de la actual `Videos()` sin cambios, solo anidado.
- Tab Cuentas: grilla de tarjetas (mismo layout que `VideoCard`), una por
  cuenta guardada.

### Modelo de datos
Nueva colección `agency_accounts` vía `useRowCollection` (mismo patrón que
`videos`: fila `{id, data, updated_at, deleted_at}`), `seed: () => []` (arranca
vacía, sin datos de ejemplo con contraseñas falsas).

Item:
```js
{
  id, preset,        // 'github' | 'supabase' | 'resend' | 'hosting' | 'domain' | 'custom'
  label,              // nombre visible, editable siempre
  accessMethod,       // 'password' | 'google' | 'github' | 'other'
  username, password, // password oculta por defecto
  url, notes,
  createdAt, updatedAt,
}
```

### Presets (accesos rápidos)
`AGENCY_ACCOUNT_PRESETS`: GitHub, Supabase, Resend, Vercel/Render (hosting),
Dominio — cada uno con ícono + color, más un botón "Otra cuenta" que abre el
formulario en blanco con `preset: 'custom'`.

### Método de acceso (chips)
Selector de 4 opciones al cargar/editar: Contraseña propia · Login con Google
· Login con GitHub · Otro. Se muestra como badge en la tarjeta.

### Formulario de alta/edición
Modal (mismo patrón que `VideoEditor`): chips de preset arriba, label, chips
de método de acceso, usuario/correo, contraseña (reutiliza el mismo
mostrar/ocultar + botón generar contraseña segura que ya usa `VaultModal` del
proyecto — sin duplicar esa lógica), URL, notas.

### Tarjeta de cuenta
Ícono/color del preset, label, badge del método de acceso, botones: copiar
usuario, copiar contraseña (con mostrar/ocultar), copiar URL, editar,
eliminar. Reutiliza `CopyBtn` y `VaultRow` ya existentes (son genéricos, no
dependen de `project`).

## Fuera de alcance

- `project.vault` / `VaultModal` (datos del cliente por proyecto): sin
  cambios.
- No se migran ni precargan cuentas reales — el vault arranca vacío, Nacho
  las carga a mano.
- Sin niveles de permiso adicionales dentro del equipo interno (todos ven
  todo, como ya pasa con el vault por proyecto).

## Testing

- Build verde.
- Local: crear una cuenta de cada preset + una custom, editar, ocultar/mostrar
  contraseña, generar contraseña, copiar cada campo, eliminar.
- Confirmar que la pestaña Videos sigue funcionando igual que antes de la
  fusión (biblioteca completa, alta/edición/borrado, ver Loom).
- Confirmar que Colaboradores/Clientes no ven la sección (ya se cumple por
  estructura del sidebar, sin código nuevo que lo garantice — verificar que
  sigue así).
