<?php
/** Vyrox AI — API JSON pour le chat (AJAX). */
require __DIR__ . '/config.php';
require __DIR__ . '/lib/ai.php';
header('Content-Type: application/json; charset=utf-8');

$u = current_user();
if (!$u) { http_response_code(401); exit(json_encode(['error' => 'Non connecté'])); }

$action = $_GET['action'] ?? '';

function out($d): never { echo json_encode($d); exit; }

/** Vérifie que la conversation appartient à l'utilisateur. */
function own_conv(int $id, int $uid): ?array {
    $s = db()->prepare('SELECT * FROM conversations WHERE id = ? AND user_id = ?');
    $s->execute([$id, $uid]);
    return $s->fetch() ?: null;
}

switch ($action) {

case 'list':
    $s = db()->prepare('SELECT id, title, mode FROM conversations WHERE user_id = ? ORDER BY updated_at DESC');
    $s->execute([$u['id']]);
    out(['conversations' => $s->fetchAll()]);

case 'messages':
    $conv = own_conv((int) ($_GET['id'] ?? 0), $u['id']);
    if (!$conv) { http_response_code(404); out(['error' => 'Introuvable']); }
    $s = db()->prepare('SELECT role, content FROM messages WHERE conversation_id = ? ORDER BY id');
    $s->execute([$conv['id']]);
    out(['conversation' => $conv, 'messages' => $s->fetchAll()]);

case 'delete':
    csrf_check();
    $conv = own_conv((int) ($_POST['id'] ?? 0), $u['id']);
    if ($conv) db()->prepare('DELETE FROM conversations WHERE id = ?')->execute([$conv['id']]);
    out(['success' => true]);

case 'send':
    csrf_check();
    $message = trim($_POST['message'] ?? '');
    $mode    = ($_POST['mode'] ?? 'normal') === 'code' ? 'code' : 'normal';
    $convId  = (int) ($_POST['conversation_id'] ?? 0);
    if ($message === '') { http_response_code(400); out(['error' => 'Message vide']); }

    // Crédits (comptes gratuits uniquement)
    if ($u['plan'] === 'free' && $u['credits'] <= 0) {
        http_response_code(402);
        out(['error' => "Crédits épuisés pour aujourd'hui. Reviens demain ou passe au plan Pro."]);
    }

    // Conversation existante ou nouvelle
    if ($convId && ($conv = own_conv($convId, $u['id']))) {
        $mode = $conv['mode'];
    } else {
        $title = mb_substr($message, 0, 60);
        db()->prepare('INSERT INTO conversations (user_id, title, mode) VALUES (?, ?, ?)')
            ->execute([$u['id'], $title, $mode]);
        $convId = (int) db()->lastInsertId();
    }

    // Historique
    $s = db()->prepare('SELECT role, content FROM messages WHERE conversation_id = ? ORDER BY id');
    $s->execute([$convId]);
    $history = $s->fetchAll();

    // Appel IA
    $reply = vyrox_reply($message, $history, $mode, $u['plan']);

    // Persistance
    $ins = db()->prepare('INSERT INTO messages (conversation_id, role, content) VALUES (?, ?, ?)');
    $ins->execute([$convId, 'user', $message]);
    $ins->execute([$convId, 'assistant', $reply]);
    db()->prepare('UPDATE conversations SET updated_at = NOW() WHERE id = ?')->execute([$convId]);

    // Décrément crédit
    $credits = $u['credits'];
    if ($u['plan'] === 'free') {
        db()->prepare('UPDATE users SET credits = credits - 1 WHERE id = ?')->execute([$u['id']]);
        $credits--;
    }

    out(['reply' => $reply, 'conversation_id' => $convId, 'credits' => $credits, 'plan' => $u['plan']]);

default:
    http_response_code(400);
    out(['error' => 'Action inconnue']);
}
