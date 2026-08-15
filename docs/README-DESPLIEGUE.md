# Sevelin POS — Frontend + Backend en Vercel

Todo vive en un solo proyecto de Vercel: los archivos estáticos se sirven desde la raíz
y `api/index.js` corre como función serverless. El navegador ya no conoce Supabase.

## 1. Estructura

```
sevelin-pos/
├── index.html            ← frontend (estático)
├── css/styles.css
├── js/
│   ├── api.js            ← único punto que habla con el backend
│   ├── auth.js           ← login por PIN, roles, cerrar sesión
│   ├── config.js         ← utilidades (sin llaves)
│   ├── productos.js
│   ├── historial.js
│   ├── pos.js
│   └── print.js          ← ticket térmico 58 mm
├── api/index.js          ← backend Express (Supabase + JWT)
├── sql/01-actualizaciones.sql
├── package.json
├── vercel.json
└── .env.example
```

## 2. Base de datos

En Supabase → **SQL Editor**, ejecuta las migraciones de `sql/` **en orden** (01 … 15). Son idempotentes. La 01 agrega los campos de Tiendanube; las siguientes, el resto del sistema (FIFO, finanzas, canales de dinero, auditoría de DTE). Agrega los campos de
Tiendanube (`peso_kg`, `alto_cm`, `ancho_cm`, `profundidad_cm`, `descripcion`), el borrado
en cascada del detalle de ventas y activa RLS.

Después de activar RLS, la llave pública deja de servir para leer datos: solo el backend
(con la `service_role`) puede entrar. Eso es justamente lo que buscabas.

## 3. Llaves

En Supabase → **Project Settings → API**:

| Dato | Dónde va |
|---|---|
| Project URL | `SUPABASE_URL` (servidor) |
| `service_role` secret | `SUPABASE_SERVICE_ROLE_KEY` (servidor, nunca al navegador) |

Genera además un `JWT_SECRET` largo:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

## 4. Desplegar en Vercel

**Opción A — desde GitHub (recomendada)**

1. Sube el proyecto a un repositorio (con `.gitignore`, para que `.env` no viaje).
2. En [vercel.com](https://vercel.com) → *Add New… → Project* → importa el repo.
3. Framework Preset: **Other**. Sin build command; Output directory vacío.
4. Antes de *Deploy*, agrega las variables de entorno (paso 5).
5. Deploy. Tu POS queda en `https://tu-proyecto.vercel.app` y la API en
   `https://tu-proyecto.vercel.app/api/...`.

**Opción B — desde la terminal**

```bash
npm i -g vercel
vercel login
vercel            # despliegue de prueba
vercel --prod     # producción
```

## 5. Variables de entorno (Vercel → Settings → Environment Variables)

> **Seguridad:** estas variables van en Vercel, **no en un archivo `.env` subido a git**. El `.env`
> real nunca se versiona ni se comparte; usa `.env.example` como plantilla. Ver la auditoría en
> `docs/AUDITORIA-SEGURIDAD-SEVELIN-POS.md`.

| Nombre | Ejemplo | Nota |
|---|---|---|
| `SUPABASE_URL` | `https://tu-proyecto.supabase.co` | |
| `SUPABASE_SERVICE_ROLE_KEY` | `sb_secret_...` (o service_role) | secreta |
| `JWT_SECRET` | cadena de 64+ caracteres | secreta |
| `ADMIN_PIN` | (clave propia) | NO uses 9067/1234; el backend rechaza los de ejemplo |
| `WORKER_PIN` | (clave propia) | admite letras y símbolos |
| `CORS_ORIGINS` | `https://tu-proyecto.vercel.app` | separa varios con coma |
| `NEGOCIO_NOMBRE` | `Sevelin` | sale impreso en el ticket |

Marca las tres primeras para *Production*, *Preview* y *Development*.
Cada cambio de variables necesita un **Redeploy** para tomar efecto.

## 6. Probar que quedó bien

```bash
curl https://tu-proyecto.vercel.app/api/health
# {"ok":true,"servicio":"sevelin-pos-api"}

curl -X POST https://tu-proyecto.vercel.app/api/login \
  -H "Content-Type: application/json" -d '{"pin":"TU_PIN_ADMIN"}'
# {"token":"eyJ...","rol":"admin",...}
```

Abre el sitio: debe aparecer la pantalla de PIN.

## 7. Desarrollo local

```bash
npm install
cp .env.example .env      # completa tus llaves
npm run dev               # API en http://localhost:3000
npx serve .               # frontend en http://localhost:3000 u otro puerto
```

Si el frontend corre en un puerto distinto al de la API, dile dónde está —
una sola vez, desde la consola del navegador:

```js
localStorage.setItem('pos_api_base', 'http://localhost:3000/api');
```

y agrega ese origen a `CORS_ORIGINS`.

## 8. Qué puede hacer cada rol

| Acción | Admin | Trabajador |
|---|---|---|
| Registrar ventas e imprimir tickets | ✅ | ✅ |
| Ver historial y reimprimir | ✅ | ✅ |
| Ver costos, utilidades y KPIs de ganancia | ✅ | ❌ (el servidor ni los envía) |
| Pestaña Productos | ✅ | ❌ oculta y bloqueada |
| Crear / editar / eliminar productos | ✅ | ❌ 403 |
| Editar o eliminar ventas | ✅ | ❌ 403 |
| Exportar, importar y borrar historial | ✅ | ❌ |

El bloqueo no es solo visual: los endpoints devuelven **403** y las respuestas para
trabajador salen sin `costo_total`, `utilidad` ni `costo_unitario`.

## 9. Seguridad — pendientes tuyos

1. **Rota la llave pública anterior** de Supabase: estuvo dentro del JavaScript del
   navegador, así que hay que considerarla comprometida.
2. **Nunca subas `.env`** ni pegues la `service_role` en el frontend.
3. Cambia los PIN cada cierto tiempo desde las variables de entorno.
4. El token JWT dura 12 h y se guarda en `sessionStorage`: se borra al cerrar la
   pestaña o el navegador, y el botón *Cerrar Sesión* lo elimina al instante.
5. Si más adelante quieres varios usuarios con nombre, el paso natural es una tabla
   `usuarios` con PIN hasheado (bcrypt) en lugar de las dos variables de entorno.

## 10. Ancho del ticket

El ticket sale en 58 mm. Si tu impresora es de 80 mm, en la consola del navegador:

```js
localStorage.setItem('pos_ticket_ancho', '80mm');
```

En el diálogo de impresión elige la impresora térmica, márgenes **Ninguno** y
desmarca encabezados/pies de página.
