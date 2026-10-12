// Service worker mínimo del taller (v135). NO guarda nada: la app siempre pide las páginas y los
// datos al servidor, así nadie se queda con una versión vieja ni con cuentas atrasadas.
// Existe solo para que Android (Chrome) ofrezca "Instalar aplicación" en todos los teléfonos.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (evento) => evento.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => { /* sin respondWith: el navegador va a la red como siempre */ });
