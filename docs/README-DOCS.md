# 📚 Índice de documentación — Sevelin POS

> Empieza por aquí. Este archivo explica **qué documento leer según lo que necesites**, para que nadie
> —persona o IA— se pierda al retomar el proyecto.

---

## ⚡ Si vas a retomar el proyecto en un chat nuevo o en otra IA

Lee **`SNAPSHOT.md`**. Es la foto del estado actual: stack, reglas críticas para no romper el código,
qué está hecho, qué falta, bugs conocidos y trampas ya descubiertas. Está pensado para pegarse tal cual
al abrir una sesión nueva. **Es el punto de entrada.**

Si necesitas más profundidad que el snapshot, sigue con `README.md`.

---

## 🗂️ Qué es cada documento (carpeta `docs/`)

| Archivo | Para qué sirve | Cuándo leerlo |
|---|---|---|
| **`SNAPSHOT.md`** | Foto del estado actual (versión, hecho/pendiente, reglas). | **Siempre primero.** |
| **`README.md`** | Documentación maestra: arquitectura, módulos, decisiones. | Para entender el sistema a fondo. |
| **`README-DESPLIEGUE.md`** | Cómo desplegar (Vercel, Supabase, variables de entorno). | Al publicar o configurar el entorno. |
| **`AUDITORIA-SEGURIDAD-SEVELIN-POS.md`** | Auditoría de seguridad y su estado. | Al tocar auth, permisos o datos sensibles. |
| **`CHANGELOG-VNN.md`** | Qué cambió en cada versión, con detalle técnico. | Para saber cómo/por qué se hizo algo. |
| **`README-ECOMMERCE-SEVELIN.md`** | Documento maestro del e-commerce (sevelin.cl): arquitectura completa, decisiones ya tomadas, plan de fases. Cubre TAMBIÉN el proyecto separado `sevelin-tienda`. | Antes de tocar cualquier fase del e-commerce (0-6). |
| **`README-BUCKET-IMAGENES.md`** | Pasos para crear el bucket `productos-imagenes` en Supabase (fotos de producto). | Al configurar o revisar el pipeline de imágenes del e-commerce. |
| **`archivo/`** | Documentos históricos (READMEs viejos, changelogs de fases cerradas). | Rara vez; solo para arqueología. |

---

## 📌 Cómo se mantiene esta documentación (regla para el futuro)

Al **cerrar cada sesión de trabajo**:

1. **Escribe un `CHANGELOG-VNN.md` nuevo** con la versión que entregaste. Formato: qué se hizo, qué
   bugs se corrigieron, qué se probó, cómo se despliega. (Mira cualquier `CHANGELOG-V14.md` o posterior
   como plantilla.)
2. **Actualiza `SNAPSHOT.md`**: sube el número de versión, mueve lo terminado a "hecho", ajusta lo
   pendiente y anota cualquier trampa nueva descubierta. El snapshot es lo único que se reescribe cada
   vez; todo lo demás se acumula.
3. Si cambió la arquitectura o se agregó un módulo grande, refleja el resumen en **`README.md`**.
4. Cuando una fase queda muy atrás (varias versiones), mueve sus `CHANGELOG` viejos a **`archivo/`**
   para que la raíz de `docs/` no se llene. Los changelogs recientes (últimas ~6 versiones) se quedan
   en `docs/`.

**Regla de oro:** el `SNAPSHOT.md` siempre refleja el estado real. Si lees el snapshot y no coincide
con el código, el snapshot manda que lo actualices.

---

## 🧭 Orden de lectura recomendado para una IA sin contexto

1. `SNAPSHOT.md` — estado y reglas (imprescindible).
2. `README.md` — arquitectura y módulos.
3. El `CHANGELOG` más reciente — lo último que se tocó.
4. `README-DESPLIEGUE.md` — solo si vas a desplegar.

Con eso tienes todo el contexto para seguir construyendo sin romper nada.

**Si vas a trabajar en el e-commerce (sevelin.cl / `sevelin-tienda`):** después del punto 1, lee
`README-ECOMMERCE-SEVELIN.md` completo (documento maestro, cubre ambos repos) y la sección 8 (plan de
fases) para ubicar en qué fase quedó. Si la fase toca `sevelin-tienda`, lee también el `SNAPSHOT.md`
de ESE repo (`sevelin-tienda/docs/SNAPSHOT.md`), no solo el de `sevelin-pos-oficial`.
