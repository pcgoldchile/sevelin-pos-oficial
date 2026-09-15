# CHANGELOG v64 — RCV del SII automático + semáforo de IVA del mes (13-09-2026)

## Qué pidió el dueño
No volver a pagar un IVA grande "por sorpresa" (en mayo 2026 fueron $762.803): saber **dentro del mes**
cuánto crédito le queda antes de empezar a pagar IVA, sin descargar ni pasarle el RCV a nadie.

## Qué se hizo

### `sql/51-sii-rcv.sql` (aplicada en producción el 13-09-2026, re-ejecutada 2 veces sin error)
- `sii_rcv_resumen`: totales por tipo de documento, período, operación (COMPRA/VENTA) y estado.
- `sii_rcv_documentos`: cada factura recibida, con su IVA (única por operación + tipo + RUT + folio).
- `sii_sync`: historial de cada sincronización (robot, manual o CSV), con el error si falló.
- `iva_remanentes`: código 77 del F29 por período. Cargado **agosto 2026 = $219.227** (propuesta del SII).
  Una primera versión puso esto como columna de `f29_presentaciones`; la misma migración la quita.

### Backend (`api/index.js`)
- **Robot del RCV** (`sincronizarRcv`), solo lectura:
  1. Lee el certificado desde `SII_CERT_PFX_BASE64` + `SII_CERT_PASSWORD` con **node-forge** (los .pfx
     de las CA chilenas traen cifrado antiguo que OpenSSL 3 rechaza).
  2. Se autentica en `herculesr.sii.cl/cgi_AUT2000/CAutInicio.cgi` con TLS mutuo → cookie `TOKEN`.
  3. Pide `getResumen` (compras REGISTRO/PENDIENTE/NO_INCLUIR/RECLAMADO y ventas REGISTRO) y
     `getDetalleCompraExport` (REGISTRO y PENDIENTE) del **mes actual y el anterior**.
- `GET /api/cron/sii-rcv` (cron diario 10:00 UTC en `vercel.json`, exige `CRON_SECRET`).
- `POST /api/finanzas/sii/sincronizar` (botón; 2 minutos de espera entre intentos).
- `POST /api/finanzas/sii/rcv-csv`: **respaldo** — subir el CSV del RCV descargado a mano. Usa el
  mismo lector que el robot (el export del SII trae las mismas líneas que el CSV).
- `PUT /api/finanzas/iva-remanente/:periodo` y el modal del F29 guarda el código 77.
- `GET /api/finanzas/sii/iva` (**semáforo**): `resultado = crédito del mes + remanente anterior − débito`.
  Notas de crédito restan. Si el SII aún no trae las ventas, el débito se estima con las boletas del
  POS y se dice. **Amarillo = al ritmo de boletas del mes, el crédito se acaba antes de fin de mes**
  (no un monto fijo). Incluye facturas por aceptar y la fecha de vencimiento del certificado.
- Errores con mensaje claro (clave del certificado, SII rechaza, falta configurar) en `sii_sync` y en Salud.
  El certificado y la clave nunca se guardan en la base ni en logs.

### Frontend
- **Finanzas → Utilidades: tarjeta "🧾 IVA del mes según el SII"** con semáforo, débito, crédito,
  remanente (corregible), facturas por aceptar, detalle de facturas, estado del robot, aviso de
  vencimiento del certificado (≤45 días), "Sincronizar ahora" y "Subir CSV del RCV".
- Modal del F29: campo "Remanente para el período siguiente (código 77)".

## Cómo se probó
- **Contra el SII real, sin certificado:** `CAutInicio.cgi` responde 302 a la página de error (sin
  TOKEN) y `getResumen` sin sesión responde 401. Confirma que las URLs existen y exigen autenticación.
- **Robot de punta a punta contra un SII simulado** + un **.pfx de prueba generado con cifrado 3DES**
  (34 comprobaciones): sin configurar, clave equivocada, sincronización por cron (certificado presentado,
  TOKEN, RUT/DV, 4 filas de resumen, 3 documentos con tilde/BOM/fecha), semáforo (crédito con nota de
  crédito, débito, remanente, amarillo por días de cobertura, pendientes, vencimiento), sin duplicados,
  espera de 2 min, SII rechaza el certificado (queda en Salud), CSV válido e inválido, remanente y F29.
  Que ni la clave ni el certificado quedan en la base.
- jsdom de la tarjeta (verde/amarillo/rojo, sin configurar, escape de la razón social, corregir remanente).
- Suites de v62 y v63 re-ejecutadas: todo OK. `node --check`, colisiones de funciones e ids: vacías.

## Verificado contra el SII real (15-09-2026)
- Primer intento: el SII aceptó el certificado, pero `getResumen` respondió **HTTP 500** (el robot solo
  reenviaba la cookie TOKEN y consultaba en paralelo). Corregido en `8a11c7f`: todas las cookies de la
  sesión, abrir la app del RCV antes de consultar, consultas en serie, sin `busquedaInicial`.
- Segundo intento (cron lanzado con `vercel crons run`): **OK, 54 documentos** de agosto y septiembre.
- Cuadra al peso con la propuesta del F29 de agosto: 520 = $475.517, 528 = $36.971, 535 (DIN, tipo 914)
  = $2.479, 111 boletas = $550.997. Los nombres de campo de `getResumen` (`rsmnMntIVA`, etc.) calzaron.
- Septiembre al 15-09: crédito $183.348 (189.094 − 5.746 de nota de crédito), débito $128.371
  (25 boletas), remanente de agosto $219.227 → quedan **$274.204** de crédito; 1 factura por aceptar
  (IVA $27.141).

## Lo que quedaba por verificar (resuelto arriba)
- **La conexión real con el certificado del dueño.** Los nombres de campo de `getResumen` son internos
  del SII y no están documentados: el lector los busca por patrón (`rsmnMntIVA`, etc.) y el detalle usa
  el formato del CSV, que sí es conocido. Se confirma el día que el dueño cargue el certificado y apriete
  "Sincronizar ahora": si algo no calza, el error queda en la tarjeta y en Salud.
- **Si el SII acepta conexiones desde los servidores de Vercel** (fuera de Chile). Si no, el respaldo
  es el CSV.
- El informe semanal todavía **no** incluye el semáforo (pendiente).

## Configuración que hace el dueño (una vez, en Vercel → sevelin-pos-oficial → Environment Variables)
`SII_CERT_PFX_BASE64`, `SII_CERT_PASSWORD`, `SII_RUT` (con guion) y `CRON_SECRET` si no existe.
Nunca por chat ni en el repo.
