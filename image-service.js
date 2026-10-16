/**
 * VYROX — Service de génération d'images
 * Utilise l'API unifiée de Pollinations (gen.pollinations.ai).
 * L'ancien endpoint image.pollinations.ai renvoie désormais 402 (Payment Required).
 *
 * .env :
 *   POLLINATIONS_API_KEY=sk_...     (clé créée sur https://enter.pollinations.ai)
 *   POLLINATIONS_MODEL_IMAGE=             (optionnel, ex: flux)
 */

const BASE_URL = 'https://gen.pollinations.ai/image';

class ImageError extends Error {
  constructor(message, userMessage, status = null) {
    super(message);
    this.userMessage = userMessage;
    this.status = status;
  }
}

async function generateImageBuffer(prompt, { width = 1024, height = 1024, suffix = '' } = {}) {
  const fullPrompt = `${prompt} ${suffix}`.trim();
  const params = new URLSearchParams({
    width: String(width),
    height: String(height),
    seed: String(Math.floor(Math.random() * 1000000)),
    nologo: 'true'
  });
  if (process.env.POLLINATIONS_MODEL_IMAGE) params.set('model', process.env.POLLINATIONS_MODEL_IMAGE);

  const headers = {};
  const key = process.env.POLLINATIONS_API_KEY;
  if (key) headers['Authorization'] = `Bearer ${key}`;

  const url = `${BASE_URL}/${encodeURIComponent(fullPrompt)}?${params.toString()}`;

  let res;
  try {
    res = await fetch(url, { headers, signal: AbortSignal.timeout(90000) });
  } catch (err) {
    throw new ImageError(err.message, "❌ Le service d'images est injoignable. Réessaie dans un instant.");
  }

  if (!res.ok) {
    const status = res.status;
    let userMessage = `❌ Erreur du service d'images (HTTP ${status}).`;
    if (status === 402) {
      userMessage = key
        ? "❌ Crédits d'images épuisés sur le compte Pollinations. Recharge-le ou réessaie plus tard."
        : "❌ Le service d'images demande maintenant une clé API. Ajoute POLLINATIONS_API_KEY dans le .env du serveur.";
    } else if (status === 401 || status === 403) {
      userMessage = "❌ Clé API Pollinations invalide ou sans permission d'images. Vérifie POLLINATIONS_API_KEY.";
    } else if (status === 429) {
      userMessage = '❌ Trop de demandes d\'images en ce moment. Réessaie dans quelques secondes.';
    }
    throw new ImageError(`Pollinations HTTP ${status}`, userMessage, status);
  }

  const type = res.headers.get('content-type') || '';
  if (!type.startsWith('image/')) {
    throw new ImageError(`Réponse inattendue (${type})`, "❌ Le service d'images a renvoyé une réponse invalide.");
  }

  return Buffer.from(await res.arrayBuffer());
}

module.exports = { generateImageBuffer, ImageError };