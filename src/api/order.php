<?php
// «Mi pedido»: acceso por enlace, estado del pedido, «no tengo logo» y portal de pagos de Stripe.
// Peticiones POST con JSON: { action, … }. Ver _lib.php para el modelo (el pedido = la suscripción).
require __DIR__ . '/_lib.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') out(405, ['ok' => false]);
$in = json_decode(file_get_contents('php://input'), true) ?: [];
$action = (string)($in['action'] ?? '');
$lang = ($in['lang'] ?? 'en') === 'es' ? 'es' : 'en';

// Pide el enlace por correo. Siempre responde lo mismo, exista o no el correo (no revela clientes).
if ($action === 'login') {
  $email = filter_var(trim((string)($in['email'] ?? '')), FILTER_VALIDATE_EMAIL);
  if (!$email) out(422, ['ok' => false, 'error' => 'email']);
  if (!empty($in['website'])) out(200, ['ok' => true]); // trampa para bots

  // Un correo por dirección cada 2 minutos
  $root = rtrim(cfg()['upload_dir'] ?? dirname(__DIR__, 2) . '/menutab-uploads', '/');
  $th = "$root/.throttle";
  if (!is_dir($th)) @mkdir($th, 0750, true);
  $mark = "$th/" . sha1(strtolower($email));
  if (is_file($mark) && time() - filemtime($mark) < 120) out(200, ['ok' => true]);
  @touch($mark);

  $orders = [];
  [$code, $customers] = stripe('GET', 'customers', ['email' => $email, 'limit' => 20]);
  foreach ($code === 200 ? $customers['data'] : [] as $c) {
    [$code, $subs] = stripe('GET', 'subscriptions', ['customer' => $c['id'], 'status' => 'all', 'limit' => 20]);
    foreach ($code === 200 ? $subs['data'] : [] as $s) {
      if (($s['metadata']['source'] ?? '') === 'menutab') $orders[] = ['sub' => $s['id'], 'restaurant' => $s['metadata']['restaurant'] ?? ''];
    }
  }
  if ($orders) mail_access($email, $lang, $orders);
  out(200, ['ok' => true]);
}

// Vuelta del pago: la sesión de Stripe da paso a su pedido
if ($action === 'session') {
  $sid = (string)($in['session_id'] ?? '');
  if (!preg_match('/^cs_(test|live)_[A-Za-z0-9]{10,250}$/', $sid)) out(422, ['ok' => false, 'error' => 'session']);
  [$code, $s] = stripe('GET', "checkout/sessions/$sid");
  if ($code !== 200 || ($s['status'] ?? '') !== 'complete' || ($s['metadata']['source'] ?? '') !== 'menutab' || empty($s['subscription'])) {
    out(404, ['ok' => false, 'error' => 'not found']);
  }
  out(200, ['ok' => true, 'token' => access_token($s['subscription'])]);
}

// A partir de aquí, con enlace de acceso válido
$sub = access_sub((string)($in['token'] ?? ''));
if (!$sub) out(401, ['ok' => false, 'error' => 'token']);
$s = subscription($sub);
if (!$s) out(401, ['ok' => false, 'error' => 'token']);
$m = $s['metadata'];

if ($action === 'get') {
  $stage = in_array($m['stage'] ?? '', STAGES, true) ? $m['stage'] : 'paid';
  // Con lo obligatorio recibido, el pedido pasa solo a «Menú recibido»
  if ($stage === 'paid' && order_complete($sub)) $stage = 'received';
  $url = (string)($m['proposal_url'] ?? '');
  out(200, ['ok' => true, 'token' => access_token($sub), 'order' => [
    'restaurant' => $m['restaurant'] ?? '',
    'plan' => $m['plan'] ?? '',
    'created' => $s['start_date'] ?? $s['created'],
    'hardware' => ($m['hardware'] ?? 'ship') === 'own' ? 'own' : 'ship',
    'stage' => $stage,
    'round' => max(1, min(3, (int)($m['round'] ?? 1))),
    'tracking' => mb_substr((string)($m['tracking'] ?? ''), 0, 200),
    'eta' => preg_match('/^\d{4}-\d{2}-\d{2}$/', (string)($m['eta'] ?? '')) ? $m['eta'] : '',
    'proposal_url' => preg_match('#^https://#', $url) ? $url : '',
    'active' => in_array($s['status'], ['active', 'trialing', 'past_due'], true),
    'past_due' => $s['status'] === 'past_due',
    'files' => order_files($sub),
    'no_logo' => !empty(order_meta($sub)['no_logo']),
  ]]);
}

if ($action === 'logo') {
  order_meta($sub, ['no_logo' => !empty($in['no_logo'])]);
  advance_if_complete($sub, $s);
  out(200, ['ok' => true, 'complete' => order_complete($sub)]);
}

// Portal de clientes de Stripe: tarjeta, facturas y datos de facturación (sin cancelar: ver portal_config)
if ($action === 'portal') {
  $params = [
    'customer' => $s['customer'],
    'return_url' => rtrim(cfg()['site_url'], '/') . ($lang === 'es' ? '/es/mi-pedido/' : '/my-order/'),
    'locale' => $lang,
  ];
  if (!empty(cfg()['portal_config'])) $params['configuration'] = cfg()['portal_config'];
  [$code, $p] = stripe('POST', 'billing_portal/sessions', $params);
  if ($code !== 200 || empty($p['url'])) out(502, ['ok' => false, 'error' => 'stripe']);
  out(200, ['ok' => true, 'url' => $p['url']]);
}

out(400, ['ok' => false, 'error' => 'action']);
