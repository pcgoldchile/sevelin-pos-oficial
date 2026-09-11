# CHANGELOG v59 — El catálogo de Meta deja de mentir, y el Instagram vuelve a existir

> **Fecha:** 11-09-2026 · **Sesión en Opus** (la pidió el dueño tras el aviso de modelo).
>
> **⚠️ Esta versión NO tocó código del POS.** No hay commits en `api/index.js` ni en `js/*.js`: todo
> el trabajo fue de **configuración en Meta** (Business Suite, Commerce Manager, Instagram) hecha en
> el navegador real del dueño. Se numera como v59 porque es un hito operativo que cambia lo que el
> negocio puede hacer, y porque el `SNAPSHOT` necesita un ancla a la que apuntar.

---

## 1. El problema con el que empezó la sesión

El dueño quería **conectar Instagram a la Página de Facebook** para publicar en las dos a la vez.
Cada intento moría en el mismo error:

> *"La cuenta comercial no tiene permiso para publicar anuncios. Esta cuenta comercial no cumplió
> nuestras Políticas de publicidad u otras normas."*

---

## 2. El diagnóstico (lo que costó encontrar)

La cadena real, en orden, tras descartar tres hipótesis falsas:

| Hipótesis | Verificación | Resultado |
|---|---|---|
| "@sevelin.cl no es cuenta profesional" | Instagram → Cuenta profesional | **Falsa.** Ya era Empresa, categoría "Tienda de aparatos electrónicos" |
| "La cuenta publicitaria está restringida" | Calidad de la cuenta / Mis cuentas | **Falsa.** `Sevelin Cuenta publicitaria` (act 2155900738554804) sin anuncios rechazados |
| "Falta verificación del negocio" | Caso de ayuda 1612723069938270 | **Falsa como causa.** Era síntoma, no raíz |

**La causa real:** existe un **tercer portafolio comercial llamado solo "Sevelin"
(ID `2169115863901758`)**, creado por el propio dueño el **3 de febrero de 2026** y **restringido ese
mismo día** por *"automatización que no cumple nuestras normas — Normas de publicidad sobre
integridad de la cuenta"*. Ese portafolio tenía enganchada la cuenta de Instagram `@sevelin.cl`.

Consecuencias encadenadas, todas verificadas en vivo:

1. Conectar el Instagram al portafolio bueno obligaba a Meta a **mover la cuenta publicitaria vieja**
   que venía con él → chocaba con la restricción → revertía todo.
2. La solicitud de acceso quedó **"Solicitud enviada / pendiente"**, y **no se podía aprobar**: la
   sección "Cuentas de Instagram" del portafolio restringido está **bloqueada con candado**, igual
   que "Solicitudes". No hay botón de apelación en ninguna pantalla.
3. El caso de soporte abierto el **8 de marzo de 2026** llevaba 6 meses en "Recibido" y de hecho
   figuraba como **chat inactivo, con aviso de cierre por falta de respuesta**.

**Conclusión:** sin intervención humana de Meta, `@sevelin.cl` era irrecuperable por autoservicio.

---

## 3. La salida: cuenta nueva, no pelear con la vieja

El dueño creó **`@sevelin_cl`** (con guion bajo) desde cero. Fue la decisión correcta: los 34
seguidores de la cuenta vieja no justificaban seguir esperando a soporte.

Lo configurado sobre esa cuenta nueva, en esta sesión:

- **Cuenta profesional tipo Empresa**, categoría corregida de "Empresa de tecnología de la
  información" a **"Tienda de aparatos electrónicos"** (la misma que tenía la cuenta vieja).
- **Datos públicos**: correo `sevelin.contacto@gmail.com`, WhatsApp y teléfono `+56 9 3575 0828`
  (CL +56), contacto preferido por **texto**.
- **Biografía**: *"Tienda de tecnología en Arica 📍 Garantía real · Taller propio · Retiro el mismo
  día"*.
- **Propiedad limpia**: aparece como *"Propiedad de Sevelin Arica - Tienda de Tecnología"*
  (ID `854365921098873`) — **sin restricción, sin solicitud pendiente**. Identificador de la cuenta
  de Instagram: `17841423397901970`.
- **Cuenta publicitaria conectada** al Instagram (*"1 cuenta publicitaria se agregó"*).
- **Permisos asignados** a Carlos Silva sobre la cuenta: Contenido, Actividad de la comunidad,
  Anuncios y Estadísticas.

---

## 4. El hallazgo grande: el catálogo de Meta llevaba un mes mintiendo

Al preparar el terreno para anunciar se revisó el **"Sevelin Catálogo" (`1458948679099643`)** y
apareció el problema serio de la sesión:

| Qué se encontró | Detalle |
|---|---|
| **El dueño no tenía acceso al catálogo** | Decía **"Sin acceso"**, con botón *Request access*. Era dueño del activo pero sin permisos asignados sobre él — el mismo patrón que con Instagram |
| **El catálogo lo alimentaba Tiendanube** | Los 107 productos venían del origen **"Tiendanube"**, la plataforma que el negocio ya no usa |
| **Estaba congelado** | Última actualización: **26 de agosto**. La sesión fue el 11 de septiembre |
| **Divisa equivocada** | El origen de feed que existía estaba en **USD**, no CLP |
| **Un origen fantasma** | "Sevelin Catálogo - Feed", subida manual, **0 productos, 365 días inactivo** |

**Por qué importaba tanto:** anunciar sobre ese catálogo era pagar por mandar clientes a fichas de
una tienda muerta, con precios de julio. Es exactamente la misma trampa que ya había costado caro con
el feed de Google (la de los links en 404 documentada en v58), repetida en Meta sin que nadie la
viera.

---

## 5. La corrección aplicada

**Se creó el origen "POS Sevelin - feed automático"**, apuntando al feed que el POS ya publicaba
desde v53/v58:

```
GET /api/feed/catalogo.csv?token=<FEED_TOKEN>
```

Configuración elegida:

| Parámetro | Valor | Por qué |
|---|---|---|
| Formato | Administrador de ventas | El feed ya usa columnas nativas de Meta (`quantity_to_sell_on_facebook`, `identifier_exists`) |
| Divisa | **CLP** | El origen viejo estaba en USD |
| Frecuencia | **Cada día**, 20:17 GMT-03:00 | **No "cada hora"**, que era el valor por defecto: el `SNAPSHOT` advierte que `/api/feed/catalogo.csv` es un endpoint pesado y **no hay que golpearlo en ráfaga**. Google ya lo lee a las 00:00; se separaron las horas a propósito |

**Resultado de la primera carga (11-09-2026, 16:19):**

```
Actualizados o agregados: 115
Eliminados:                 0
No subidos:                 0
Problemas:                  0
```

**Verificación independiente del feed** (una sola llamada, sin ráfaga):

```
HTTP 200 · 156.341 bytes · 115 productos
links → 115/115 a www.sevelin.cl   (ninguno a Tiendanube)
imágenes → 308 en wlqzxvcyynvblhyllzmh.supabase.co
```

**Limpieza posterior, autorizada explícitamente por el dueño:**

- **Origen "Tiendanube" eliminado** (107 productos viejos, sin sincronizar desde el 26 de agosto).
- **Origen "Sevelin Catálogo - Feed" eliminado** (manual, vacío, 365 días sin uso).

Queda **un solo origen de datos** en el catálogo.

> **Nota honesta sobre la verificación:** al cerrar la sesión el contador del catálogo **todavía
> mostraba 220 productos**. Meta purga el índice de un origen eliminado en diferido (horas), no al
> instante; los productos listados ya eran todos del feed nuevo, con timestamp `11 de sep 4:19 pm`.
> **Queda por confirmar que bajó a 115** y que la actualización automática de las 20:17 corrió sola.

---

## 6. Trampas nuevas descubiertas (no repetir)

1. **Ser dueño de un activo en Meta ≠ tener acceso a él.** Le pasó al catálogo y al Instagram: el
   portafolio figuraba como propietario, pero la persona no tenía el activo asignado. Se arregla en
   *Configuración → Personas → [usuario] → Asignar activos*.
2. **Meta tiene tres capas distintas que se confunden**: portafolio comercial (dueño), activo
   (Página/IG/catálogo/cuenta publicitaria) y persona (permisos). Un bloqueo en cualquiera de las
   tres produce el mismo mensaje de error genérico.
3. **La conexión Página ↔ Instagram del buzón de mensajes es un handshake aparte** de la propiedad
   en el portafolio. Con `@sevelin_cl` la propiedad quedó perfecta pero ese paso del buzón
   **sigue sin completarse** (se atasca en "Continuar" sin dar error). No bloquea anuncios.
4. **Un portafolio restringido bloquea hasta las pantallas para arreglarlo.** No sirve buscar el
   botón de apelación: no existe cuando la restricción está activa.
5. **Las URLs directas de Commerce Manager no funcionan** si se escriben a mano (redirigen a
   `www.facebook.com` y dan "página no disponible"). Hay que navegar por clics dentro de la app.

---

## 7. Lo que quedó pendiente

**Del dueño, para poder anunciar:**

1. **Publicar 6-9 posts en `@sevelin_cl`** — sigue con **0 publicaciones**. Un anuncio que lleva a un
   perfil vacío no convierte, y Meta aprueba peor las cuentas sin historial.
2. **Foto de perfil** y **link a sevelin.cl en la bio** — Instagram solo permite editar el sitio web
   desde la app móvil.
3. **Reseñas de Google** pidiéndolas en cada entrega presencial: Sevelin tiene **0**, Player One
   tiene **80**.
4. **Método de pago** en la cuenta publicitaria.
5. Vincular **WhatsApp Business** real al Instagram (pide verificación por SMS).

**Técnico, para verificar:**

6. Confirmar que el catálogo bajó de 220 a **115 productos**.
7. Confirmar que la **actualización automática de las 20:17** corrió sola.

**Descartado / muerto:**

8. La cuenta `@sevelin.cl` vieja y el portafolio restringido `2169115863901758` quedan abandonados.
   No se borraron. El caso de soporte 1612723069938270 quedó sin reabrir: el mensaje estaba redactado
   y listo, pero **enviarlo requiere que lo pegue el dueño** (el entorno bloquea que Claude escriba
   en chats de soporte en nombre del usuario).

---

## 8. La recomendación estratégica que salió de todo esto

Con los números del propio plan (`PLAN-CRECIMIENTO-2026.md` §1.6): margen por venta **$10.686**,
clic en electrónica $150-400 CLP. **Los anuncios de captación fría pierden plata en cada venta** con
el ticket actual. Lo que sí rinde hoy:

1. **Click-to-WhatsApp local** (solo Arica) — es como ya vende el negocio de verdad.
2. **Catálogo dinámico + retargeting** sobre el Pixel ya desplegado — el más barato por venta.
3. **Tráfico a la tienda física** por ubicación.

Presupuesto de prueba sugerido: **$3.000-5.000 diarios por 2 semanas** (~$60-100.000), y escalar solo
si una conversación cuesta menos de ~$3.000.

**No hace falta n8n, Make ni herramientas externas.** La automatización de anuncios de Meta es
**Advantage+**, viene incluida, y lo único que había que automatizar por nuestro lado era el
catálogo — que es justo lo que se arregló en esta versión.

---

## 9. Cómo se despliega

**No hay despliegue.** Cero cambios en el repo aparte de esta documentación. Todo lo anterior ya está
vivo en las cuentas de Meta desde el momento en que se configuró.
