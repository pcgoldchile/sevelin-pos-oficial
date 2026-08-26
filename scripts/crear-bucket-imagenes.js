/* Utilidad de una sola vez: crea el bucket `productos-imagenes` en Storage
   (lectura pública, escritura solo service_role) si todavía no existe.
   Ver docs/README-BUCKET-IMAGENES.md.

   Uso:  node scripts/crear-bucket-imagenes.js
   Requiere SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY reales en .env.
   No depende de "dotenv" (no es una dependencia del proyecto): lee el
   .env a mano, solo para esta utilidad de una sola vez. */
const fs = require('fs');
const path = require('path');

function cargarEnvLocal() {
  const ruta = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(ruta)) return;
  fs.readFileSync(ruta, 'utf8').split('\n').forEach(linea => {
    const m = linea.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (!m) return;
    const clave = m[1];
    let valor = (m[2] || '').trim();
    if (/^".*"$/.test(valor) || /^'.*'$/.test(valor)) valor = valor.slice(1, -1);
    if (!(clave in process.env)) process.env[clave] = valor;
  });
}
cargarEnvLocal();

const { createClient } = require('@supabase/supabase-js');

const NOMBRE_BUCKET = 'productos-imagenes';

async function main() {
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Faltan SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en .env');
    process.exit(1);
  }

  const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data: existentes, error: errList } = await db.storage.listBuckets();
  if (errList) {
    console.error('No se pudo listar buckets:', errList.message);
    process.exit(1);
  }

  if (existentes.some(b => b.name === NOMBRE_BUCKET)) {
    console.log(`El bucket "${NOMBRE_BUCKET}" ya existe. Nada que hacer.`);
    return;
  }

  const { error: errCrear } = await db.storage.createBucket(NOMBRE_BUCKET, {
    public: true,
    fileSizeLimit: '2MB'
  });
  if (errCrear) {
    console.error('No se pudo crear el bucket:', errCrear.message);
    process.exit(1);
  }

  console.log(`Bucket "${NOMBRE_BUCKET}" creado (público, sin políticas de escritura: solo service_role sube/borra).`);
}

main();
