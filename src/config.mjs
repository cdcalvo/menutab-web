// Datos de negocio en un solo sitio: cambiar aquí y volver a ejecutar `node build.mjs`.
// Precios acordados por ahora: $350 / $450 (los de la portada actual); si cambian, solo aquí.
// Pendiente: teléfono de WhatsApp y correo de ventas definitivos.
export const config = {
  siteUrl: 'https://getmenutab.com',
  // Demo pública del menú real (repo restaurant_menu en GitHub Pages)
  demoUrl: 'https://cdcalvo.github.io/restaurant_menu/menu.html',
  // Pago: el configurador envía el pedido a api/checkout.php, que crea la sesión de Stripe
  // Checkout. Las claves de Stripe van en api/config.php en el servidor (no versionado).
  checkoutEndpoint: 'api/checkout.php',
  whatsapp: '', // solo dígitos con prefijo de país, p. ej. 13055550123; vacío = sin botón
  email: 'hello@getmenutab.com',
  prices: {
    selfService: 350,
    managed: 450,
    tablet: 85,
    charger: 60,
    cable: 30,
  },
  social: { instagram: '', facebook: '', youtube: '' },
};
