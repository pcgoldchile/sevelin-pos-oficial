# Bucket de imágenes de producto — `productos-imagenes`

> Parte de la Fase 0 del e-commerce (ver `README-ECOMMERCE-SEVELIN.md`, sección 4.1). El POS es la
> fuente canónica de las fotos: este bucket vive en el proyecto Supabase del POS, y la tienda web
> (Fase 1+) solo consume las URLs públicas que ya quedan guardadas en `productos.imagen_urls`.

No pude crear el bucket desde esta sesión: el entorno de desarrollo no tiene un `.env` real (solo
`.env.example`) ni acceso de red al proyecto Supabase de producción. Se documentan los pasos
manuales, verificados contra la consola de Supabase, y se deja un script opcional para quien tenga
las credenciales a mano.

---

## Opción A — Manual, por el dashboard (recomendado, 2 minutos)

1. Entra a [supabase.com/dashboard](https://supabase.com/dashboard) → proyecto **Supabase POS**
   (el mismo que usa `sevelin-pos-oficial`, no un proyecto nuevo).
2. Menú lateral → **Storage** → botón **New bucket**.
3. Nombre exacto: `productos-imagenes` (con guion, todo minúsculas — el backend lo referenciará
   literal en `api/index.js`).
4. **Public bucket:** actívalo (toggle en ON). Esto permite lectura anónima de los archivos por URL
   directa, sin pasar por el backend — necesario porque la tienda pública (sevelin.cl) debe poder
   mostrar la foto sin conocer ninguna credencial de Supabase.
5. Guarda. El bucket queda creado sin políticas de escritura pública: por defecto, Storage exige
   una política explícita para `INSERT`/`UPDATE`/`DELETE`, y no se crea ninguna — así que solo la
   `service_role` (que Supabase deja pasar sin RLS, igual que con las tablas) puede subir o borrar
   archivos. El navegador del cliente nunca tiene esa llave.
6. **Verificación:** Storage → `productos-imagenes` → Settings, debe mostrar `Public: true` y
   0 políticas listadas en la pestaña "Policies" (0 políticas = nadie externo puede escribir, solo
   `service_role`).

Esto es exactamente la misma disciplina que ya usa el bucket existente `compras-documentos`
(comprobantes de gastos) — revísalo como referencia si hay dudas de qué se ve en el dashboard.

## Opción B — Script (opcional, para quien tenga `.env` con las credenciales reales)

Guardado en `scripts/crear-bucket-imagenes.js` (no se ejecuta solo; es una utilidad de una sola vez).
Requiere `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` reales en `.env`. Es idempotente: si el bucket
ya existe, lo detecta y no falla.

```bash
node scripts/crear-bucket-imagenes.js
```

---

## Qué NO hacer

- No crear políticas RLS para este bucket pensando que hace falta "igual que las tablas": la regla
  de "sin políticas públicas" del `CLAUDE.md` es sobre tablas de la base de datos, no sobre buckets
  de Storage. Este bucket es la única excepción intencional (ver README-ECOMMERCE-SEVELIN.md, sección
  4.1) — necesita ser público para que la tienda sirva las fotos directo al navegador del cliente.
- No subir nada al bucket desde el navegador del POS directamente: todo pasa por
  `POST /api/productos/:id/imagen` en el backend, que sube con `service_role` (ver `api/index.js`).
  El frontend nunca ve la llave de Supabase.
