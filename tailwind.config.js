/** ============================================================
 *  TAILWIND — configuración de compilación
 *  ------------------------------------------------------------
 *  Reemplaza al bloque `tailwind.config = {...}` que estaba en línea
 *  dentro de index.html cuando se usaba el CDN. Mismos valores, para
 *  que el resultado compilado se vea idéntico.
 *
 *  `content` le dice a Tailwind dónde buscar clases. Si una clase no
 *  aparece en ninguno de esos archivos, NO se incluye en el CSS final:
 *  así el archivo pesa unos pocos KB en vez de los ~400 KB del CDN.
 *  ============================================================ */
module.exports = {
  darkMode: 'class',

  content: [
    './index.html',
    './js/**/*.js'      // pago.js y atajos.js generan HTML con clases
  ],

  /* Clases que se arman concatenando strings en JS y que el escáner no
     puede detectar leyendo el código. Si alguna vez agregas una clase
     dinámica de Tailwind, va aquí o desaparecerá del CSS compilado. */
  safelist: [
    'hidden', 'show', 'activa', 'active',
    'admin-only', 'role-admin', 'role-trabajador', 'theme-light', 'dark'
  ],

  theme: {
    extend: {
      fontFamily: {
        sans: ['"IBM Plex Sans"', 'system-ui', 'sans-serif']
      },
      /* slate con los valores de zinc: el gris neutro de sevelin-tienda, en
         todas las pantallas a la vez sin tocar cada clase. */
      colors: {
        slate: {
          50: '#fafafa', 100: '#f4f4f5', 200: '#e4e4e7', 300: '#d4d4d8', 400: '#a1a1aa',
          500: '#71717a', 600: '#52525b', 700: '#3f3f46', 800: '#27272a', 900: '#18181b', 950: '#09090b'
        }
      }
    }
  },

  plugins: []
};
