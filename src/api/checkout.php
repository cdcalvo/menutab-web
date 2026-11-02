<?php
// Crea una sesión de Stripe Checkout con el pedido del configurador y devuelve su URL.
// Los precios NO vienen del navegador: se usan los Price IDs de Stripe de config.php.
//
// config.php (en el servidor, no versionado):
// <?php return [
//   'stripe_secret' => 'sk_live_…',            // o sk_test_… para pruebas
//   'site_url'      => 'https://getmenutab.com',
//   'prices' => [                               // Price IDs creados en el panel de Stripe
//     'selfService' => 'price_…',               // recurrente mensual $350
//     'managed'     => 'price_…',               // recurrente mensual $450
//     'tablet'      => 'price_…',               // pago único $85
//     'charger'     => 'price_…',               // pago único $60
//     'cable'       => 'price_…',               // pago único $30
//   ],
//   'shipping_rate'  => 'shr_…',                // opcional: tarifa de envío para equipos
//   'automatic_tax'  => true,                   // Stripe Tax (impuesto de venta)
//   'notify_to' => 'ventas@getmenutab.com', 'notify_from' => 'web@getmenutab.com',
//   'webhook_secret' => 'whsec_…',
// ];
header('Content-Type: application/json; charset=utf-8');
if ($_SERVER['REQUEST_METHOD'] !== 'POST') { http_response_code(405); echo '{"error":"method"}'; exit; }

$cfg = require __DIR__ . '/config.php';
$in = json_decode(file_get_contents('php://input'), true) ?: [];

$plan = in_array($in['plan'] ?? '', ['selfService', 'managed'], true) ? $in['plan'] : null;
$email = filter_var($in['email'] ?? '', FILTER_VALIDATE_EMAIL);
$one = fn($v, $max = 120) => mb_substr(trim(preg_replace('/[\r\n\t]+/', ' ', (string)($v ?? ''))), 0, $max);
$restaurant = $one($in['restaurant'] ?? '');
$name = $one($in['name'] ?? '');
$phone = $one($in['phone'] ?? '', 40);
$lang = ($in['lang'] ?? 'en') === 'es' ? 'es' : 'en';
if (!$plan || !$email || $restaurant === '' || $name === '') { http_response_code(422); echo '{"error":"invalid"}'; exit; }

$params = [
  'mode' => 'subscription',
  'locale' => $lang,
  'customer_email' => $email,
  'phone_number_collection' => ['enabled' => 'true'],
  'billing_address_collection' => 'required',
  'line_items' => [['price' => $cfg['prices'][$plan], 'quantity' => 1]],
  'subscription_data' => ['metadata' => ['restaurant' => $restaurant, 'contact' => $name, 'phone' => $phone, 'plan' => $plan]],
  'metadata' => ['restaurant' => $restaurant, 'contact' => $name, 'phone' => $phone, 'plan' => $plan],
  'success_url' => $cfg['site_url'] . ($lang === 'es' ? '/es/empezar/gracias/' : '/start/thanks/') . '?session_id={CHECKOUT_SESSION_ID}',
  'cancel_url' => $cfg['site_url'] . ($lang === 'es' ? '/es/empezar/' : '/start/') . '?plan=' . $plan,
];

// Equipos: cantidades acotadas; en modo suscripción van como pago único en la primera factura
$hardware = false;
foreach (['tablet', 'charger', 'cable'] as $k) {
  $q = max(0, min(200, (int)($in[$k] ?? 0)));
  if (($in['ship'] ?? false) && $q > 0) {
    $params['line_items'][] = ['price' => $cfg['prices'][$k], 'quantity' => $q];
    $hardware = true;
  }
}
if ($hardware) {
  $params['shipping_address_collection'] = ['allowed_countries' => ['US']];
  if (!empty($cfg['shipping_rate'])) $params['shipping_options'] = [['shipping_rate' => $cfg['shipping_rate']]];
}
if (!empty($cfg['automatic_tax'])) $params['automatic_tax'] = ['enabled' => 'true'];

$ch = curl_init('https://api.stripe.com/v1/checkout/sessions');
curl_setopt_array($ch, [
  CURLOPT_POST => true,
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_USERPWD => $cfg['stripe_secret'] . ':',
  CURLOPT_POSTFIELDS => http_build_query($params),
  CURLOPT_TIMEOUT => 20,
]);
$res = json_decode(curl_exec($ch), true);
$status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($status !== 200 || empty($res['url'])) {
  error_log('Stripe checkout error: ' . json_encode($res['error'] ?? $status));
  http_response_code(502);
  echo '{"error":"stripe"}';
  exit;
}
echo json_encode(['url' => $res['url']]);
