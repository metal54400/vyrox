<?php
/**
 * Vyrox AI — Moteur LLM (Groq / OpenAI compatible)
 * Le plan Pro utilise un modèle plus performant ; le mode "code" change le prompt système.
 * Orinstudio © 2026-2029
 */
declare(strict_types=1);

/**
 * @param array  $history  [['role'=>'user|assistant','content'=>'...'], ...]
 * @param string $mode     'normal' | 'code'
 * @param string $plan     'free' | 'pro'
 */
function vyrox_reply(string $message, array $history, string $mode, string $plan): string {
    $apiKey = env('GROQ_API_KEY') ?: env('OPENAI_API_KEY');
    if (strlen($apiKey) < 10) {
        return "⚠️ Aucune clé API configurée. Ajoute `GROQ_API_KEY` dans le fichier `.env` pour activer l'IA.";
    }

    $model = $plan === 'pro'
        ? env('GROQ_MODEL_PRO', 'llama-3.3-70b-versatile')
        : env('GROQ_MODEL_FREE', 'openai/gpt-oss-20b');

    $system = $mode === 'code'
        ? "Tu es Vyrox Code, un assistant de programmation expert développé par Orinstudio. "
        . "Tu réponds avec du code clair, commenté et correct, en utilisant des blocs markdown ```langage. "
        . "Explique brièvement, privilégie les bonnes pratiques et la sécurité."
        : "Tu es Vyrox, une IA avancée développée par Orinstudio. Utile, précise et amicale, tu parles "
        . "principalement en français. Réponds de façon concise et structurée, en markdown quand c'est pertinent.";

    $messages = array_merge(
        [['role' => 'system', 'content' => $system]],
        array_slice($history, -8),
        [['role' => 'user', 'content' => $message]]
    );

    $payload = json_encode([
        'model'       => $model,
        'messages'    => $messages,
        'stream'      => false,
        'temperature' => $mode === 'code' ? 0.3 : 0.7,
    ]);

    $endpoint = env('API_ENDPOINT', 'https://api.groq.com/openai/v1/chat/completions');
    $ch = curl_init($endpoint);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => $payload,
        CURLOPT_TIMEOUT        => 60,
        CURLOPT_HTTPHEADER     => [
            'Content-Type: application/json',
            'Authorization: Bearer ' . $apiKey,
        ],
    ]);
    $res  = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($res === false || $code >= 400) {
        $err = json_decode((string) $res, true)['error']['message'] ?? "HTTP $code";
        return "⚠️ Erreur de l'IA ($err). Réessaie dans un instant.";
    }

    $data = json_decode($res, true);
    return $data['choices'][0]['message']['content'] ?? "⚠️ Réponse vide de l'IA.";
}
