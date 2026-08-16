# CHANGELOG V11 — 16 de agosto de 2026

> Depende de `docs/README.md` (documento maestro). Aquí va **solo** lo que cambió en la v11.

Corrige un bug del POS: la casilla "Editar hora de la venta" se bloqueaba después de pasar un
producto al carrito.

---

## El síntoma

Se podía marcar "Editar hora de la venta" al entrar por primera vez al POS, pero si primero se
agregaba un producto al carrito, la casilla dejaba de responder.

## Las dos causas (se corrigieron ambas)

Había dos problemas independientes que producían el mismo síntoma, así que se atacaron los dos:

1. **Solapamiento de z-index (impedía el clic).** La cabecera de la tabla del carrito es `sticky` con
   `z-index: 2` (para quedar fija al hacer scroll en carritos largos). Con el carrito vacío casi no
   tiene altura y no molesta —por eso "la primera vez" funcionaba—, pero al llenarse creaba un
   contexto de apilamiento que quedaba por delante del bloque de controles (fecha/cliente/hora), que
   estaba en `z-index` automático. Los clics en la franja de la casilla los capturaba la cabecera.
   - **Fix:** el bloque de controles ahora es `.pos-cart-controles` con `position: relative;
     z-index: 5`, por encima de la cabecera. El checkbox siempre recibe sus clics.

2. **El campo de hora quedaba deshabilitado.** Al completar una venta, la limpieza final hace
   `posHora.disabled = true`. El listener de la casilla mostraba el grupo de hora pero **no volvía a
   habilitar el input**, así que tras una venta el campo aparecía pero bloqueado.
   - **Fix:** el listener de la casilla ahora hace `posHora.disabled = false` siempre que se marca,
     re-habilitando el campo sin importar cómo quedó.

## Pruebas

- jsdom: al marcar la casilla con el campo deshabilitado, se re-habilita y autocompleta la hora; el
  checkbox vive en el bloque elevado.
- Sintaxis y anti-colisión: OK. Tailwind recompilado.

> Nota: el solapamiento de z-index es un bug puramente visual que jsdom no detecta (no computa
> layout). Se corrigió por análisis del CSS. Conviene una verificación final en el equipo: agregar un
> producto y confirmar que la casilla de hora responde.

## Despliegue

Solo frontend (sin migraciones): `index.html`, `js/pos.js`, `css/styles.css` (Tailwind recompilado).
