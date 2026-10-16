# v158 · El IVA del pozo se pregunta después del documento, y solo con boleta o factura (16-10-2026)

Cambia `api/index.js`, `js/acuerdo-padres.js`, `js/pago.js`, `js/pos.js` e `index.html`. Sin migración.
Además, el mismo día, el servicio nuevo **#373 Inicialización de Notebook Nuevo** ($15.000, por SQL) y el icono de
notebook para los servicios de inicialización en `scripts/generar-imagenes-servicios.js`.

## Qué pidió el dueño
"¿Por qué sale IVA aquí? A veces es SIN DTE, entonces no existe IVA hasta que se haga la boleta después. Debería ser
una opción de quién cobró el IVA, siempre y cuando primero se eligió con boleta o factura; si fue sin DTE, no debe
preguntar."

## Qué quedó
- **"Antes de cobrar"** ya no tiene la casilla "El IVA lo pone C. Patricio". Solo pregunta quién hizo el servicio. Si
  va al pozo ("todo" o "menos el repuesto"), avisa: "Si sale con boleta o factura, después te pregunto quién pone el IVA".
- **Ventana nueva "🧾 ¿Quién pone el IVA?"** (`modalIvaPozo`), justo después de elegir el documento:
  - **SIN DTE:** no aparece y al pozo va lo cobrado.
  - **Boleta o factura:** muestra cuánto IVA llevan los servicios de C. Patricio y pide elegir. "C. Patricio" manda el
    neto al pozo; "Yo (Sevelin)" lo manda completo. No viene nada marcado y "Continuar" está apagado hasta elegir.
  - **"Volver"** regresa a elegir el documento, y cancelar ahí reabre el medio de pago.
  - "Otro monto a su pozo" no pregunta: vale lo escrito.
- **Servidor:** `aplicarPozo()` recibe el tipo de documento. Con SIN DTE ignora `sin_iva` aunque la caja lo mande.
- **`abrirSelectorPago`** acepta `despuesDeDte(dte)`, una promesa que corre después del documento; si devuelve false,
  vuelve a pedir el documento.

## Lo que no cubre
Una venta hecha SIN DTE a la que después se le hace la boleta a mano no recalcula el pozo. Si ese IVA lo pone
C. Patricio, se corrige el monto en Finanzas → Mis padres.

## Probado
- **Maqueta del POS:** servicio de $15.000 marcado "De C. Patricio: todo".
  - "Antes de cobrar" sale sin la casilla y con el aviso.
  - Con boleta aparece la ventana: $2.395 de IVA, $12.605 o $15.000, y "Continuar" apagado hasta elegir.
  - "Volver" vuelve al documento. Con SIN DTE no se pregunta y se pasa directo a la entrega: la venta viaja con
    `sin_iva: false`.
  - Con boleta y "C. Patricio" la venta viaja con `sin_iva: true`.
  - Sin errores en la consola.
- **Servidor:** `aplicarPozo` con `sin_iva` en true da $15.000 con SIN DTE o sin tipo, y $12.605 con boleta o factura.
- Hechos `node --check` en todo lo tocado y los chequeos de funciones e ids. Sin Tailwind (no hay clases nuevas).
