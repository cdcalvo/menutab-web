<?php
// Subida de archivos del pedido (página de gracias y «Mi pedido»). Un archivo por petición (así no
// choca con post_max_size del hosting) y, al terminar cada tanda, una petición «done» que nos avisa
// por correo. Cada archivo va con su tipo (menu, logo, dishes, style) y se guarda FUERA de la web,
// en la carpeta del pedido (ver order_dir en _lib.php).
require __DIR__ . '/_lib.php';

const MAX_FILE = 20 * 1024 * 1024;   // 20 MB por archivo
const MAX_FILES = 120;               // por pedido
const MAX_ORDER = 800 * 1024 * 1024; // 800 MB por pedido
const EXT = ['pdf', 'jpg', 'jpeg', 'png', 'heic', 'heif', 'webp', 'gif', 'xlsx', 'xls', 'csv', 'doc', 'docx', 'txt'];

if ($_SERVER['REQUEST_METHOD'] !== 'POST') out(405, ['ok' => false]);
if (!empty($_POST['website'])) out(200, ['ok' => true]); // trampa para bots

$sub = access_sub((string)($_POST['token'] ?? ''));
if (!$sub) out(401, ['ok' => false, 'error' => 'token']);
$action = $_POST['action'] ?? '';

if ($action === 'file') {
  $kind = in_array($_POST['kind'] ?? '', KINDS, true) ? $_POST['kind'] : null;
  if (!$kind) out(422, ['ok' => false, 'error' => 'kind']);
  $f = $_FILES['file'] ?? null;
  if (!$f || ($f['error'] ?? 1) !== UPLOAD_ERR_OK || !is_uploaded_file($f['tmp_name'])) {
    $tooBig = in_array($f['error'] ?? 0, [UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE], true);
    out($tooBig ? 413 : 400, ['ok' => false, 'error' => $tooBig ? 'size' : 'upload']);
  }
  if ($f['size'] > MAX_FILE) out(413, ['ok' => false, 'error' => 'size']);
  $name = basename((string)$f['name']);
  $ext = strtolower(pathinfo($name, PATHINFO_EXTENSION));
  if (!in_array($ext, EXT, true)) out(415, ['ok' => false, 'error' => 'type']);

  // El pedido se comprueba en Stripe solo al crear su carpeta (primer archivo)
  $dir = order_dir($sub);
  if (!is_dir($dir)) {
    if (!subscription($sub)) out(401, ['ok' => false, 'error' => 'token']);
    $dir = order_dir($sub, true);
  }
  $have = array_values(array_filter(scandir($dir), fn($x) => preg_match('/^(' . implode('|', KINDS) . ')-\d+-/', $x)));
  if (count($have) >= MAX_FILES) out(429, ['ok' => false, 'error' => 'count']);
  $used = array_sum(array_map(fn($x) => filesize("$dir/$x"), $have));
  if ($used + $f['size'] > MAX_ORDER) out(413, ['ok' => false, 'error' => 'order size']);

  // Nombre seguro: tipo + número de orden + nombre original saneado, con la extensión ya validada
  $base = preg_replace('/[^A-Za-z0-9._-]+/', '-', pathinfo($name, PATHINFO_FILENAME));
  $base = trim(substr($base, 0, 80), '.-') ?: 'archivo';
  $saved = sprintf('%s-%02d-%s.%s', $kind, count($have) + 1, $base, $ext);
  if (!move_uploaded_file($f['tmp_name'], "$dir/$saved")) out(500, ['ok' => false, 'error' => 'storage']);
  chmod("$dir/$saved", 0640);
  out(200, ['ok' => true, 'name' => "$base.$ext"]);
}

// Fin de una tanda: aviso por correo con lo que hay y, si ya está lo obligatorio, «Menú recibido»
if ($action === 'done') {
  $s = subscription($sub);
  if (!$s) out(401, ['ok' => false, 'error' => 'token']);
  $files = order_files($sub);
  $advanced = advance_if_complete($sub, $s);

  $m = $s['metadata'];
  $restaurant = $m['restaurant'] ?? '-';
  $labels = ['menu' => 'Menú', 'logo' => 'Logo', 'dishes' => 'Fotos de platos', 'style' => 'Referencias de estilo'];
  $kb = fn($b) => $b >= 1048576 ? round($b / 1048576, 1) . ' MB' : max(1, round($b / 1024)) . ' KB';
  $list = '';
  foreach ($files as $k => $fs) {
    if (!$fs && $k === 'logo' && !empty(order_meta($sub)['no_logo'])) { $list .= "\n{$labels[$k]}: no tiene logo\n"; continue; }
    if (!$fs) continue;
    $list .= "\n{$labels[$k]} (" . count($fs) . "):\n" . implode("\n", array_map(fn($x) => "  - {$x['name']} (" . $kb($x['size']) . ')', $fs)) . "\n";
  }
  $body = "Archivos recibidos en «Mi pedido»\n\n"
    . "Restaurante: $restaurant\nContacto: " . ($m['contact'] ?? '-') . ' · ' . ($m['phone'] ?? '-') . "\n"
    . "Pedido (suscripción): $sub\n"
    . ($advanced ? "\n→ Ya está lo obligatorio: el pedido pasó a «Menú recibido».\n" : '')
    . $list
    . "\nCarpeta en el servidor: " . order_dir($sub) . "\n";
  if (!send_mail(cfg()['notify_to'] ?? '', "Archivos recibidos: $restaurant", $body)) {
    error_log("upload.php: no se pudo enviar el aviso de archivos del pedido $sub");
  }
  out(200, ['ok' => true, 'files' => $files, 'complete' => order_complete($sub)]);
}

out(400, ['ok' => false, 'error' => 'action']);
