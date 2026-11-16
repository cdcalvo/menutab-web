# menutab — web de venta (getmenutab.com)

Sitio estático, sin dependencias: HTML + CSS + JS mínimos, con la marca del manual
(`marca-menutab/menutab/`). Inglés en `/` y español en `/es/`, escritos a mano.

## Uso

```bash
node build.mjs     # genera dist/ (index.html, es/index.html, assets/, contact.php)
node serve.mjs     # http://localhost:8090  ·  español: http://localhost:8090/es/
```

- Textos: `src/content.mjs` (`en` y `es`).
- Precios, enlaces a la tienda, WhatsApp y correo: `src/config.mjs`.
- Estilos: `assets/css/site.css` · Interacción: `assets/js/site.js`.
- La tablet de la portada carga la demo pública del menú (`config.demoUrl`, repo `restaurant_menu`).

## Vista previa en GitHub Pages

Cada push a `main` publica https://cdcalvo.github.io/menutab-web/ con `node build.mjs --preview`
(`.github/workflows/pages.yml`): no se indexa, lleva un aviso de «Vista previa» y el formulario y
el pago se simulan, porque Pages no ejecuta PHP. La web definitiva va en el hosting.

## Publicar en el hosting (PHP)

1. `node build.mjs`
2. Subir el **contenido** de `dist/` a la raíz del dominio (`public_html/`).
3. Crear en el servidor, junto a `contact.php` y sin versionarlo, `contact.config.php`:
   ```php
   <?php return ['to' => 'ventas@getmenutab.com', 'from' => 'web@getmenutab.com'];
   ```
   (`from` debe ser un buzón del propio dominio para que el correo no acabe en spam.)

En local el formulario simula el envío (no hay PHP).

## Compra (Stripe Checkout)

- Configurador: `/start/` (EN) y `/es/empezar/` (ES). Página de gracias: `…/thanks/` y `…/gracias/`.
- `api/checkout.php` crea la sesión de Stripe Checkout (suscripción mensual del plan + equipos
  como pago único). `api/webhook.php` avisa por correo de cada compra (`checkout.session.completed`).
- En el servidor, junto a esos archivos y sin versionar, `api/config.php` con la clave secreta,
  los Price IDs de Stripe, la tarifa de envío y los correos (formato al inicio de `checkout.php`).
  `api/.htaccess` impide que se sirva.
- En local (sin PHP) el botón de pago salta directo a la página de gracias, como vista previa.
- **Sin probar todavía**: `checkout.php` y `webhook.php` (no hay cuenta de Stripe). Probar en modo
  de pruebas de Stripe antes de publicar.

## Subida del menú (página de gracias)

- `api/upload.php`: un archivo por petición (con barra de progreso) y una petición final `done` que
  avisa por correo (`notify_to`) con la lista de archivos, el restaurante y el pedido de Stripe.
- Se guardan **fuera de la web**, en `../../menutab-uploads/<lote>/` (junto a `public_html`), o en
  `upload_dir` de `api/config.php`. Fotos, PDF, Excel, CSV y Word; 20 MB por archivo, 80 archivos y
  600 MB por lote. Si el hosting tiene `upload_max_filesize` por debajo de 20 MB, subirlo.
- Si la página llega sin pedido (ni `session_id` ni el pedido en la pestaña), pide restaurante y correo.
- Probado con PHP 8.3 en Docker (sin Stripe):
  `docker run --rm -p 8091:8000 -v "$PWD/dist:/app" php:8.3-cli php -S 0.0.0.0:8000 -t /app`
  con un `dist/api/config.php` de prueba. En `localhost` el JS simula la subida; para probarla de
  verdad, abrir la web por la IP de la red local.

## Informe para el socio

`informe/` no se versiona (análisis interno de la web actual). `informe/informe-web.html` → PDF con Chrome:

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --no-pdf-header-footer \
  --print-to-pdf=menutab-Informe-web-de-venta.pdf "file://$PWD/informe/informe-web.html"
```
