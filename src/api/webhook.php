<?php
// Webhook de Stripe: avisa por correo de cada compra completada.
// En el panel de Stripe: endpoint https://getmenutab.com/api/webhook.php, evento checkout.session.completed.
$cfg = require __DIR__ . '/config.php';
$payload = file_get_contents('php://input');
$sig = $_SERVER['HTTP_STRIPE_SIGNATURE'] ?? '';

// Verificación de la firma (esquema v1 de Stripe, tolerancia de 5 minutos)
$parts = [];
foreach (explode(',', $sig) as $kv) { [$k, $v] = array_pad(explode('=', $kv, 2), 2, ''); $parts[$k][] = $v; }
$ts = (int)($parts['t'][0] ?? 0);
$expected = hash_hmac('sha256', $ts . '.' . $payload, $cfg['webhook_secret']);
$valid = $ts && abs(time() - $ts) < 300 && array_filter($parts['v1'] ?? [], fn($s) => hash_equals($expected, $s));
if (!$valid) { http_response_code(400); exit; }

$event = json_decode($payload, true);
if (($event['type'] ?? '') === 'checkout.session.completed') {
  $s = $event['data']['object'];
  $m = $s['metadata'] ?? [];
  $amount = number_format(($s['amount_total'] ?? 0) / 100, 2);
  $body = "Nueva compra en getmenutab.com\n\n"
    . 'Restaurante: ' . ($m['restaurant'] ?? '-') . "\n"
    . 'Contacto: ' . ($m['contact'] ?? '-') . ' · ' . ($m['phone'] ?? '-') . "\n"
    . 'Correo: ' . ($s['customer_details']['email'] ?? '-') . "\n"
    . 'Plan: ' . ($m['plan'] ?? '-') . "\n"
    . "Cobrado hoy: \$$amount\n"
    . 'Sesión: ' . ($s['id'] ?? '-') . "\n";
  $subject = '=?UTF-8?B?' . base64_encode('Nueva compra: ' . ($m['restaurant'] ?? '')) . '?=';
  mail($cfg['notify_to'], $subject, $body, "From: menutab <{$cfg['notify_from']}>\r\nContent-Type: text/plain; charset=UTF-8");
}
http_response_code(200);
