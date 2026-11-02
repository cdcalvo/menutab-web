<?php
// Formulario de contacto de getmenutab.com (hosting con PHP).
// Configurar el destino en una variable de entorno o en contact.config.php (no versionado):
//   <?php return ['to' => 'ventas@getmenutab.com', 'from' => 'web@getmenutab.com'];
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') { http_response_code(405); echo '{"ok":false}'; exit; }
// Trampa para bots: el campo oculto «website» debe llegar vacío
if (!empty($_POST['website'])) { echo '{"ok":true}'; exit; }

$cfg = is_file(__DIR__ . '/contact.config.php') ? require __DIR__ . '/contact.config.php' : [];
$to = $cfg['to'] ?? getenv('MENUTAB_CONTACT_TO');
$from = $cfg['from'] ?? getenv('MENUTAB_CONTACT_FROM');
if (!$to || !$from) { http_response_code(500); echo '{"ok":false,"error":"not configured"}'; exit; }

// Una línea, sin saltos (evita inyección de cabeceras) y con longitud acotada
$clean = fn($v, $max = 200) => mb_substr(trim(preg_replace('/[\r\n]+/', ' ', (string)($v ?? ''))), 0, $max);
$name = $clean($_POST['name'] ?? '');
$restaurant = $clean($_POST['restaurant'] ?? '');
$phone = $clean($_POST['phone'] ?? '', 40);
$email = filter_var($clean($_POST['email'] ?? '', 120), FILTER_VALIDATE_EMAIL);
$tables = (int)($_POST['tables'] ?? 0);
$message = mb_substr(trim((string)($_POST['message'] ?? '')), 0, 3000);
$lang = ($_POST['lang'] ?? 'en') === 'es' ? 'es' : 'en';

if ($name === '' || $restaurant === '' || $phone === '' || !$email) { http_response_code(422); echo '{"ok":false}'; exit; }

$body = "Nuevo contacto desde getmenutab.com ($lang)\n\n"
  . "Nombre: $name\nRestaurante: $restaurant\nTeléfono: $phone\nCorreo: $email\n"
  . 'Mesas: ' . ($tables > 0 ? $tables : '-') . "\n\nMensaje:\n" . ($message !== '' ? $message : '-') . "\n";
$headers = "From: menutab <$from>\r\nReply-To: $email\r\nContent-Type: text/plain; charset=UTF-8";
$subject = '=?UTF-8?B?' . base64_encode("Nuevo contacto: $restaurant") . '?=';

$ok = mail($to, $subject, $body, $headers);
http_response_code($ok ? 200 : 500);
echo json_encode(['ok' => $ok]);
