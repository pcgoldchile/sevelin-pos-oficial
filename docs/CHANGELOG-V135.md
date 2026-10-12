# v135 · App del taller para el celular y usuarios con RUT y PIN (12-10-2026)

> **Estado: PUBLICADA el 12-10-2026** (POS `e68c001` y `8e91aec`; `sql/92` aplicada). El dueño eligió publicar solo la
> app (el pago con tarjeta sigue sin publicar) e instalarla desde Chrome, sin archivo APK.
> **Falta de él:** crear los usuarios en el POS (botón Usuarios) e instalarla en los 4 teléfonos. Pendientes #100 y
> #98 (usuarios; queda la mitad). Mismo día: el pozo de C. Patricio partió y se anotó el pago 1 de 3 a sus padres.

## Qué pidió el dueño

"Una aplicación APP para el teléfono" para él, su papá, su hermano y su mamá, que registre cada servicio técnico "muy
simple y rápido", paso a paso (una pantalla por pregunta): equipo y modelo, repuesto por botones, calidad de la
pantalla, si estaba en stock o se fue a comprar, cuánto costó, dónde, cuánto salió el viaje, quién puso la plata del
repuesto y de la bencina, quién desarmó, instaló y probó, y si ya se cobró. "Siempre llevando cuentas claras": cuánto
hay que devolverle a quien puso plata. Sincronizada con la base de Sevelin. Nombres: **C. Alejandro Silva** (él) y
**C. Patricio Silva** (su papá); los dos se llaman Carlos.

## Qué se construyó

### 1. La app (`/taller/`)
Página aparte del POS, instalable con "Agregar a pantalla de inicio" (manifest e íconos con el logo S). No va a
Play Store ni App Store. Archivos: `taller/index.html`, `taller/app.js`, `taller/app.css`, `taller/manifest.webmanifest`.
No comparte scripts con el POS (trae sus ayudantes) y no tiene scripts dentro del HTML (la política de seguridad de
`vercel.json` no los deja correr).

- **Ingreso con RUT y PIN.** El RUT queda recordado en el teléfono; el PIN no. La sesión dura 12 horas.
- **Registro en 5 a 7 pantallas:** Equipo → Repuesto (y calidad si es pantalla) → Costo y origen → Viaje (solo si algo se
  compró) → Quién lo hizo → Cobro → Revisar. "Sin repuesto" salta costo y viaje.
- **Listas que crecen:** "+ Otro" agrega un repuesto o una calidad; el lugar de compra se recuerda solo.
- **Pendientes y Cobrados**, "Entregar y cobrar", "Corregir" y, para el admin, "Anular" y la pestaña **Cuentas**.
- Ventanas propias para confirmar (nunca las del navegador).
- **Instalación en Android:** botón "📲 Instalar en este teléfono" cuando Chrome avisa que se puede
  (`beforeinstallprompt`), y un enlace con los pasos a mano si no. `taller/sw.js` es un service worker que **no
  guarda nada en caché**: existe solo para que Chrome la ofrezca como app. El archivo APK (para pasarlo de teléfono
  en teléfono) es otro camino: se genera envolviendo la página ya publicada, y pide permitir "instalar apps
  desconocidas" en cada teléfono. No se hizo.

### 2. Las cuentas (`cuentasDeTrabajoTaller` en `api/index.js`)
Salen de tres hechos de cada trabajo: **de quién es**, **quién puso plata** y **quién recibió el pago**.

1. Quien recibió la plata le devuelve a cada uno lo que puso (repuesto o bencina).
2. Lo que queda es del dueño del trabajo.
3. Si el trabajo es de C. Patricio y se cobró en la app, lo que queda va a su pozo. **Lo que puso otro no va al pozo**
   (respuesta del dueño: "si yo pagué el repuesto... no debe ir al pozo").

| Caso | Resultado |
|---|---|
| Trabajo de C. Patricio, $25.000 que cobró él; repuesto $8.000 y bencina $3.000 los puso C. Alejandro | C. Patricio le devuelve $11.000; al pozo $14.000 (ya los tiene él) |
| Igual, pero la plata la recibió Sevelin | Nadie debe; al pozo $14.000 (se le entregan) |
| C. Patricio puso todo y cobró él | Nadie debe; al pozo $25.000 |
| Trabajo de Sevelin, el repuesto lo compró C. Patricio | Sevelin le devuelve el repuesto |
| Trabajo de Sevelin que cobró C. Patricio | C. Patricio le pasa lo cobrado menos lo que él puso |
| Se cobró en la caja del POS | La app solo lo anota: la venta y el pozo los lleva la caja |

Antes de cobrar no hay deuda: lo que puso otro se muestra como "se devuelve cuando se cobre". En **Cuentas** el admin ve
el saldo neto entre personas, anota devoluciones (y las anula), y el resumen del mes.

### 3. Usuarios (`usuarios`, mitad de #98)
- Tabla `usuarios` con nombre, RUT, PIN (resumen scrypt con sal; nunca vuelve al navegador), tipo y papel en el taller.
- `POST /api/login` con `rut` entra una persona; sin `rut` sigue el PIN general. El token lleva `uid` y `nombre`.
- Dos frenos: el de la IP (el de siempre) y el del usuario (5 fallos seguidos lo bloquean 15 minutos).
- POS: botón **👥 Usuarios** (solo admin) y enlace **📱 App del taller** al pie de la barra lateral. `js/usuarios.js`.
- **Falta de #98:** que el POS mismo pida RUT y PIN, los permisos por casillas y el registro de cada cambio del POS.

### 4. El pozo
- `GET /api/padres/resumen` suma los trabajos de C. Patricio cobrados en la app (`pozoDeLaAppTaller`). Lo que cobró él
  mismo cuenta como juntado **y** como ya recibido (`en_su_mano`): no se sugiere entregarle plata que ya tiene.
- Si `sql/92` no está aplicada, el panel sigue abriendo (devuelve vacío).
- En pantalla ahora dice **C. Patricio** en vez de "mi papá"; la clasificación del gasto pasa a "Pozo de C. Patricio
  (servicios de celulares)" (la migración la renombra; el servidor lee los dos nombres).
- **12-10-2026:** el dueño pidió "que sea a partir de hoy". Se dejó `acuerdo_padres.pozo_desde = 2026-10-12` en
  producción: octubre cuenta 20 días de 31, mínimo $645.161.

## Decisiones tomadas por Claude (decírselas al dueño)
- **Lo cobrado en la app no crea una venta en el POS.** Vive en el taller y en el pozo; no entra a Ventas, a la caja ni
  a Utilidades. Para que un trabajo de Sevelin quede como venta se cobra en la caja y en la app se marca "Se pasó por
  la caja del POS".
- Lo que estaba en stock y nadie dice de quién era, era de Sevelin.
- La plata del cliente la recibe "Sevelin" o "C. Patricio" (dos opciones).
- Un trabajador ve el detalle de los trabajos donde participa; del resto ve qué equipo es y su estado, sin plata.
  El pozo y las cuentas las ve solo el admin.
- Cualquier usuario puede entregar y cobrar un trabajo pendiente; ya cobrado lo corrige solo el admin.

## Rutas nuevas
`GET/POST /api/usuarios`, `PUT /api/usuarios/:id` (admin) · `GET /api/taller/inicio` · `POST /api/taller/catalogo`,
`DELETE /api/taller/catalogo/:id` · `GET/POST /api/taller/trabajos`, `GET/PUT /api/taller/trabajos/:id`,
`POST .../cobrar`, `POST .../anular` · `GET /api/taller/cuentas` · `POST /api/taller/pagos`, `DELETE /api/taller/pagos/:id`.

## Cómo se probó
- **Servidor:** 106 casos con la base en memoria (usuarios, ingreso, bloqueo, 9 casos de cuentas, carrera de dos
  teléfonos cobrando a la vez, permisos, pozo). Las pruebas de la v134 siguen pasando (68 y 34).
- **App:** recorrida en `taller-maqueta` (el servidor real contra la base en memoria): registrar, cobrar, corregir,
  anular, cuentas, devoluciones, agregar repuesto, ingreso con PIN malo. Sin errores en consola.
- **POS:** ventana Usuarios y panel Mis padres en `pos-maqueta`.
- **No probado:** en un teléfono real, "Agregar a pantalla de inicio" en Android o iPhone, ni contra la base real.
  No hay capturas: la ventana del navegador de pruebas estaba oculta y se verificó leyendo la página.

## Cómo se publicó (12-10-2026) y qué falta

Hechos los pasos 1 y 2 (solo la app). Verificado en producción: `/taller/` y sus archivos responden, las rutas
nuevas piden sesión (401) y el ingreso responde bien con datos inventados. Faltan los pasos 3 y 4, que son del dueño.
1. `npx supabase db query --file sql/92-usuarios-y-taller.sql --linked` (debe decir 0 tablas nuevas sin RLS).
2. Push del POS. Los commits quedaron ordenados para elegir: primero la app del taller y **encima** el pago con
   tarjeta. Solo la app: `git push origin <commit de la app>:main`. Los dos: `git push`. La copia del orden
   original quedó en la rama local `respaldo-orden-12-10`.
3. En el POS: Usuarios → crear a cada persona con su RUT y PIN, y marcar quién es el dueño y quién C. Patricio.
4. En cada teléfono: abrir `https://sevelin-pos-oficial.vercel.app/taller/` y "Agregar a pantalla de inicio".

## Para probar en local
`taller-maqueta` (`scripts/maqueta-taller.js`, puerto 4181) → `http://localhost:4181/taller/`. RUT `11.111.111-1` (admin)
o `22.222.222-2` (C. Patricio), PIN `1234`. Usa `scripts/doble-supabase.js`, que ahora vive en el repo.
