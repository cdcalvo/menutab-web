<?php
// Subida del menú y las fotos desde la página de gracias. Un archivo por petición (así no choca
// con post_max_size del hosting) y una última petición «done» que nos avisa por correo.
//
// Los archivos se guardan FUERA de la carpeta pública: por defecto en ../../menutab-uploads
// (junto a public_html) o en 'upload_dir' de config.php. Una carpeta por envío (lote).
// Usa de config.php: notify_to, notify_from, stripe_secret (para saber de quién es el pedido)
// y, opcional, upload_dir.
header('Content-Type: application/json; charset=utf-8');

const MAX_FILE = 20 * 1024 * 1024;   // 20 MB por archivo
const MAX_FILES = 80;                // por lote
const MAX_BATCH = 600 * 1024 * 1024; // 600 MB por lote
const EXT = ['pdf', 'jpg', 'jpeg', 'png', 'heic', 'heif', 'webp', 'gif', 'xlsx', 'xls', 'csv', 'doc', 'docx', 'txt'];

function out(int $status, array $body): void { http_response_code($status); echo json_encode($body); exit; }

if ($_SERVER['REQUEST_METHOD'] !== 'POST') out(405, ['ok' => false]);
if (!empty($_POST['website'])) out(200, ['ok' => true]); // trampa para bots
if (!is_file(__DIR__ . '/config.php')) out(500, ['ok' => false, 'error' => 'not configured']);
$cfg = require __DIR__ . '/config.php';

$batch = (string)($_POST['batch'] ?? '');
if (!preg_match('/^[a-f0-9]{32}$/', $batch)) out(422, ['ok' => false, 'error' => 'batch']);

$root = rtrim($cfg['upload_dir'] ?? dirname(__DIR__, 2) . '/menutab-uploads', '/');
if (!is_dir($root)) {
  if (!mkdir($root, 0750, true)) out(500, ['ok' => false, 'error' => 'storage']);
  // Por si upload_dir quedara dentro de la web: nunca se sirve ni se ejecuta nada de aquí
  file_put_contents("$root/.htaccess", "Require all denied\n");
}
$dir = "$root/$batch";
$action = $_POST['action'] ?? '';
if (!is_dir($dir)) {
  if ($action !== 'file') out(422, ['ok' => false, 'error' => 'empty']);
  if (!mkdir($dir, 0750)) out(500, ['ok' => false, 'error' => 'storage']);
}

$one = fn($v, $max = 120) => mb_substr(trim(preg_replace('/[\r\n\t]+/', ' ', (string)($v ?? ''))), 0, $max);
$files = fn() => array_values(array_filter(scandir($dir), fn($f) => $f[0] !== '.' && $f !== 'lote.json'));

// Datos del lote: quién envía (de la sesión de Stripe o del formulario)
$metaFile = "$dir/lote.json";
$meta = is_file($metaFile) ? (json_decode(file_get_contents($metaFile), true) ?: []) : [];
$sid = (string)($_POST['session_id'] ?? '');
if ($sid !== '' && preg_match('/^cs_(test|live)_[A-Za-z0-9]{10,250}$/', $sid)) $meta['session_id'] = $sid;
foreach (['restaurant' => 120, 'name' => 120, 'phone' => 40] as $k => $max) {
  $v = $one($_POST[$k] ?? '', $max);
  if ($v !== '') $meta[$k] = $v;
}
$email = filter_var($one($_POST['email'] ?? ''), FILTER_VALIDATE_EMAIL);
if ($email) $meta['email'] = $email;
if (isset($_POST['lang'])) $meta['lang'] = $_POST['lang'] === 'es' ? 'es' : 'en';
$meta['lang'] ??= 'en';
$meta['created'] ??= date('c');

if ($action === 'file') {
  $f = $_FILES['file'] ?? null;
  if (!$f || ($f['error'] ?? 1) !== UPLOAD_ERR_OK || !is_uploaded_file($f['tmp_name'])) {
    $tooBig = in_array($f['error'] ?? 0, [UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE], true);
    out($tooBig ? 413 : 400, ['ok' => false, 'error' => $tooBig ? 'size' : 'upload']);
  }
  if ($f['size'] > MAX_FILE) out(413, ['ok' => false, 'error' => 'size']);
  $name = basename((string)$f['name']);
  $ext = strtolower(pathinfo($name, PATHINFO_EXTENSION));
  if (!in_array($ext, EXT, true)) out(415, ['ok' => false, 'error' => 'type']);

  $have = $files();
  if (count($have) >= MAX_FILES) out(429, ['ok' => false, 'error' => 'count']);
  $used = array_sum(array_map(fn($x) => filesize("$dir/$x"), $have));
  if ($used + $f['size'] > MAX_BATCH) out(413, ['ok' => false, 'error' => 'batch size']);

  // Nombre seguro: número de orden + nombre original saneado, con la extensión ya validada
  $base = preg_replace('/[^A-Za-z0-9._-]+/', '-', pathinfo($name, PATHINFO_FILENAME));
  $base = trim(substr($base, 0, 80), '.-') ?: 'archivo';
  $saved = sprintf('%02d-%s.%s', count($have) + 1, $base, $ext);
  if (!move_uploaded_file($f['tmp_name'], "$dir/$saved")) out(500, ['ok' => false, 'error' => 'storage']);
  chmod("$dir/$saved", 0640);
  file_put_contents($metaFile, json_encode($meta, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
  out(200, ['ok' => true, 'name' => $saved]);
}

if ($action === 'done') {
  $have = $files();
  if (!$have) out(422, ['ok' => false, 'error' => 'empty']);

  // Con session_id, el restaurante y el correo salen del pedido pagado en Stripe
  if (!empty($meta['session_id']) && !empty($cfg['stripe_secret'])) {
    $ch = curl_init('https://api.stripe.com/v1/checkout/sessions/' . $meta['session_id']);
    curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_USERPWD => $cfg['stripe_secret'] . ':', CURLOPT_TIMEOUT => 15]);
    $s = json_decode(curl_exec($ch) ?: 'null', true);
    $ok = curl_getinfo($ch, CURLINFO_HTTP_CODE) === 200;
    curl_close($ch);
    if ($ok && $s) {
      $meta['stripe'] = [
        'restaurant' => $s['metadata']['restaurant'] ?? null,
        'email' => $s['customer_details']['email'] ?? null,
        'paid' => ($s['payment_status'] ?? '') === 'paid',
      ];
    }
  }
  $meta['notified'] = date('c');
  file_put_contents($metaFile, json_encode($meta, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));

  $restaurant = $meta['stripe']['restaurant'] ?? $meta['restaurant'] ?? '-';
  $from = $meta['stripe']['email'] ?? $meta['email'] ?? '-';
  $kb = fn($b) => $b >= 1048576 ? round($b / 1048576, 1) . ' MB' : max(1, round($b / 1024)) . ' KB';
  $list = implode("\n", array_map(fn($x) => "  - $x (" . $kb(filesize("$dir/$x")) . ')', $have));
  $body = "Archivos del menú recibidos en getmenutab.com\n\n"
    . "Restaurante: $restaurant\nCorreo: $from\n"
    . (isset($meta['stripe']) ? 'Pedido de Stripe: ' . $meta['session_id'] . ($meta['stripe']['paid'] ? ' (pagado)' : ' (SIN PAGAR)') . "\n" : (isset($meta['session_id']) ? 'Sesión de Stripe (sin verificar): ' . $meta['session_id'] . "\n" : "Sin pedido de Stripe asociado\n"))
    . 'Idioma: ' . $meta['lang'] . "\n\n"
    . count($have) . " archivo(s):\n$list\n\n"
    . "Carpeta en el servidor: $dir\n";
  $subject = '=?UTF-8?B?' . base64_encode("Menú recibido: $restaurant") . '?=';
  $headers = "From: menutab <{$cfg['notify_from']}>\r\nContent-Type: text/plain; charset=UTF-8"
    . ($from !== '-' ? "\r\nReply-To: $from" : '');
  $sent = !empty($cfg['notify_to']) && mail($cfg['notify_to'], $subject, $body, $headers);
  if (!$sent) error_log("upload.php: no se pudo enviar el aviso del lote $batch");
  out(200, ['ok' => true, 'files' => count($have)]);
}

out(400, ['ok' => false, 'error' => 'action']);
