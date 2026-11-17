<?php
// Piezas comunes de los endpoints: configuración, Stripe, enlaces de acceso a «Mi pedido»,
// carpeta de archivos de cada pedido y correo. No es un endpoint (.htaccess no lo sirve).
//
// El pedido ES la suscripción de Stripe (sub_…). Su estado vive en los metadatos:
//   stage        paid | received | proposals | changes | preparing | shipped | live
//   round        1-3 (ronda de ajustes, con stage = changes)
//   tracking     número o enlace de seguimiento del envío
//   proposal_url enlace https a las propuestas
//   eta          fecha estimada del paso actual, AAAA-MM-DD (propuestas, nueva versión, envío…)
// Se cambian desde el panel de Stripe o con el CLI, p. ej.:
//   stripe subscriptions update sub_… -d "metadata[stage]=changes" -d "metadata[round]=2" -d "metadata[eta]=2026-11-24"
// (para quitar un dato: -d "metadata[eta]=")

const STAGES = ['paid', 'received', 'proposals', 'changes', 'preparing', 'shipped', 'live'];
const KINDS = ['menu', 'logo', 'dishes', 'style'];
const ACCESS_TTL = 30 * 86400; // los enlaces de acceso valen 30 días (se renuevan en cada visita)

function cfg(): array {
  static $cfg = null;
  if ($cfg === null) {
    if (!is_file(__DIR__ . '/config.php')) out(500, ['ok' => false, 'error' => 'not configured']);
    $cfg = require __DIR__ . '/config.php';
  }
  return $cfg;
}

function out(int $status, array $body): void {
  http_response_code($status);
  header('Content-Type: application/json; charset=utf-8');
  echo json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
  exit;
}

// Petición a la API de Stripe. Devuelve [código HTTP, cuerpo decodificado].
function stripe(string $method, string $path, array $params = []): array {
  $url = 'https://api.stripe.com/v1/' . $path;
  $ch = curl_init();
  $opts = [CURLOPT_RETURNTRANSFER => true, CURLOPT_USERPWD => cfg()['stripe_secret'] . ':', CURLOPT_TIMEOUT => 20];
  if ($method === 'GET') $url .= $params ? '?' . http_build_query($params) : '';
  else $opts += [CURLOPT_POST => true, CURLOPT_POSTFIELDS => http_build_query($params)];
  curl_setopt_array($ch, $opts + [CURLOPT_URL => $url]);
  $body = json_decode(curl_exec($ch) ?: 'null', true);
  $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
  curl_close($ch);
  if ($code !== 200) error_log("Stripe $method $path: $code " . json_encode($body['error']['message'] ?? null));
  return [$code, $body];
}

// Suscripción de menutab (o null si no existe o es de otro negocio de la cuenta)
function subscription(string $sub): ?array {
  if (!preg_match('/^sub_[A-Za-z0-9]{8,64}$/', $sub)) return null;
  [$code, $s] = stripe('GET', "subscriptions/$sub");
  return $code === 200 && ($s['metadata']['source'] ?? '') === 'menutab' ? $s : null;
}

// Enlace de acceso: sub_….caducidad.firma (HMAC con access_secret)
function b64url(string $s): string { return rtrim(strtr(base64_encode($s), '+/', '-_'), '='); }
function access_token(string $sub): string {
  $p = $sub . '.' . (time() + ACCESS_TTL);
  return $p . '.' . b64url(hash_hmac('sha256', $p, cfg()['access_secret'], true));
}
function access_sub(string $token): ?string {
  if (!preg_match('/^(sub_[A-Za-z0-9]{8,64})\.(\d{10})\.([A-Za-z0-9_-]{43})$/', $token, $m)) return null;
  $good = b64url(hash_hmac('sha256', "$m[1].$m[2]", cfg()['access_secret'], true));
  return hash_equals($good, $m[3]) && (int)$m[2] > time() ? $m[1] : null;
}
function order_url(string $sub, string $lang): string {
  return rtrim(cfg()['site_url'], '/') . ($lang === 'es' ? '/es/mi-pedido/' : '/my-order/') . '?t=' . access_token($sub);
}

// Carpeta de archivos del pedido, FUERA de la web (junto a public_html) o en upload_dir
function order_dir(string $sub, bool $create = false): string {
  $root = rtrim(cfg()['upload_dir'] ?? dirname(__DIR__, 2) . '/menutab-uploads', '/');
  if ($create && !is_dir($root)) {
    if (!mkdir($root, 0750, true)) out(500, ['ok' => false, 'error' => 'storage']);
    // Por si upload_dir quedara dentro de la web: nunca se sirve ni se ejecuta nada de aquí
    file_put_contents("$root/.htaccess", "Require all denied\n");
  }
  $dir = "$root/orders/$sub";
  if ($create && !is_dir($dir) && !mkdir($dir, 0750, true)) out(500, ['ok' => false, 'error' => 'storage']);
  return $dir;
}
function order_meta(string $sub, ?array $set = null): array {
  $f = order_dir($sub, $set !== null) . '/pedido.json';
  $meta = is_file($f) ? (json_decode(file_get_contents($f), true) ?: []) : [];
  if ($set !== null) {
    $meta = array_merge($meta, $set);
    file_put_contents($f, json_encode($meta, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
  }
  return $meta;
}
// Archivos por tipo: menu-03-carta.jpg → ['menu' => [['name' => 'carta.jpg', 'size' => …]]]
function order_files(string $sub): array {
  $dir = order_dir($sub);
  $out = array_fill_keys(KINDS, []);
  if (!is_dir($dir)) return $out;
  foreach (scandir($dir) as $f) {
    if (preg_match('/^(' . implode('|', KINDS) . ')-(\d+)-(.+)$/', $f, $m)) $out[$m[1]][] = ['name' => $m[3], 'size' => filesize("$dir/$f")];
  }
  return $out;
}
// ¿Tenemos lo obligatorio? (menú, y logo o «no tengo logo»)
function order_complete(string $sub): bool {
  $files = order_files($sub);
  return $files['menu'] && ($files['logo'] || !empty(order_meta($sub)['no_logo']));
}

// Con lo obligatorio recibido, un pedido en «Pagado» pasa a «Menú recibido» (también en Stripe,
// para verlo en el panel). Devuelve true si lo ha movido.
function advance_if_complete(string $sub, array $s): bool {
  if (!in_array($s['metadata']['stage'] ?? '', ['', 'paid'], true) || !order_complete($sub)) return false;
  [$code] = stripe('POST', "subscriptions/$sub", ['metadata' => ['stage' => 'received']]);
  return $code === 200;
}

function send_mail(string $to, string $subject, string $body, string $replyTo = ''): bool {
  $c = cfg();
  $headers = "From: menutab <{$c['notify_from']}>\r\nContent-Type: text/plain; charset=UTF-8"
    . ($replyTo ? "\r\nReply-To: $replyTo" : '');
  return $to !== '' && mail($to, '=?UTF-8?B?' . base64_encode($subject) . '?=', $body, $headers);
}

// Correo al cliente con el enlace a «Mi pedido». En local (dev_log_links) el enlace va también al log.
// $welcome: correo tras la compra (desde el webhook) en vez de «aquí tienes tu enlace».
function mail_access(string $to, string $lang, array $orders, bool $welcome = false): bool {
  $es = $lang === 'es';
  $lines = array_map(fn($o) => ($o['restaurant'] ? $o['restaurant'] . ":\n" : '') . order_url($o['sub'], $lang), $orders);
  $intro = $welcome
    ? ($es ? "Hola,\n\n¡Gracias por elegir menutab! Ya estamos con tu pedido. El primer paso es tuyo: envíanos tu menú actual y tu logo desde «Mi pedido». Ahí también verás en qué paso va todo y podrás gestionar tus pagos:\n\n"
           : "Hi,\n\nThank you for choosing menutab! We're on it. The first step is yours: send us your current menu and your logo from «My order». That's also where you'll see how it's going and manage your billing:\n\n")
    : ($es ? "Hola,\n\nAquí tienes el enlace para ver tu pedido de menutab, enviarnos tus archivos y gestionar tus pagos:\n\n"
           : "Hi,\n\nHere is the link to check your menutab order, send us your files and manage your billing:\n\n");
  $body = $intro
    . implode("\n\n", $lines)
    . ($es
      ? "\n\nEl enlace vale 30 días. Si caduca, pide otro en " . rtrim(cfg()['site_url'], '/') . "/es/mi-pedido/\n\n¿Dudas? Responde a este correo.\n\nmenutab"
      : "\n\nThe link is valid for 30 days. If it expires, ask for a new one at " . rtrim(cfg()['site_url'], '/') . "/my-order/\n\nQuestions? Just reply to this email.\n\nmenutab");
  $subject = $welcome ? ($es ? 'Gracias por tu compra: siguiente paso' : 'Thank you for your order: next step') : ($es ? 'Tu pedido de menutab' : 'Your menutab order');
  $sent = send_mail($to, $subject, $body, cfg()['notify_to'] ?? '');
  if (!$sent && !empty(cfg()['dev_log_links'])) error_log("[dev] enlace de acceso para $to: " . implode(' | ', $lines));
  return $sent;
}
