/**
 * VYROX — Service de génération vidéo
 * Utilise l'API unifiée de Pollinations : GET https://gen.pollinations.ai/video/{prompt}
 *
 * .env :
 *   POLLINATIONS_API_KEY=sk_...        (obligatoire en pratique, comme pour les images)
 *   POLLINATIONS_MODEL_VIDEO=          (optionnel : nom d'un modèle vidéo de la doc Pollinations)
 *   VIDEO_TIMEOUT_MS=240000            (optionnel : une vidéo peut prendre plusieurs minutes)
 *
 * Filigrane "Vyrox AI" : appliqué seulement si ffmpeg est installé sur le serveur
 * ET que le module 'sharp' est présent. Sinon la vidéo est livrée sans filigrane.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');

let sharp;
try { sharp = require('sharp'); } catch { /* filigrane désactivé */ }

const BASE_URL = 'https://gen.pollinations.ai/video';

class VideoError extends Error {
  constructor(message, userMessage, status = null) {
    super(message);
    this.userMessage = userMessage;
    this.status = status;
  }
}

/** Télécharge la vidéo générée et renvoie un Buffer MP4. */
async function generateVideoBuffer(prompt) {
  const params = new URLSearchParams();
  if (process.env.POLLINATIONS_MODEL_VIDEO) params.set('model', process.env.POLLINATIONS_MODEL_VIDEO);
  params.set('seed', String(Math.floor(Math.random() * 1000000)));

  const headers = {};
  const key = process.env.POLLINATIONS_API_KEY;
  if (key) headers['Authorization'] = `Bearer ${key}`;

  const url = `${BASE_URL}/${encodeURIComponent(prompt)}?${params.toString()}`;
  const timeout = parseInt(process.env.VIDEO_TIMEOUT_MS || '240000', 10);

  let res;
  try {
    res = await fetch(url, { headers, signal: AbortSignal.timeout(timeout) });
  } catch (err) {
    const timedOut = err.name === 'TimeoutError' || err.name === 'AbortError';
    throw new VideoError(
      err.message,
      timedOut
        ? '❌ La génération de la vidéo a pris trop de temps. Réessaie avec un prompt plus simple.'
        : "❌ Le service vidéo est injoignable. Réessaie dans un instant."
    );
  }

  if (!res.ok) {
    const status = res.status;
    let userMessage = `❌ Erreur du service vidéo (HTTP ${status}).`;
    if (status === 402) {
      userMessage = key
        ? '❌ Crédits vidéo épuisés sur le compte Pollinations.'
        : '❌ La génération vidéo demande une clé API. Ajoute POLLINATIONS_API_KEY dans le .env du serveur.';
    } else if (status === 401 || status === 403) {
      userMessage = '❌ Clé API Pollinations invalide ou sans permission pour la vidéo.';
    } else if (status === 429) {
      userMessage = '❌ Trop de demandes vidéo en ce moment. Réessaie dans quelques instants.';
    }
    throw new VideoError(`Pollinations video HTTP ${status}`, userMessage, status);
  }

  const type = res.headers.get('content-type') || '';
  if (!type.startsWith('video/')) {
    throw new VideoError(`Réponse inattendue (${type})`, "❌ Le service vidéo a renvoyé une réponse invalide.");
  }

  return Buffer.from(await res.arrayBuffer());
}

// ── Filigrane (optionnel) ─────────────────────────────────────────────────

let ffmpegChecked = false;
let ffmpegAvailable = false;

function hasFfmpeg() {
  if (ffmpegChecked) return Promise.resolve(ffmpegAvailable);
  return new Promise((resolve) => {
    execFile('ffmpeg', ['-version'], { timeout: 5000 }, (err) => {
      ffmpegChecked = true;
      ffmpegAvailable = !err;
      if (!ffmpegAvailable) console.warn('⚠️ ffmpeg introuvable : les vidéos seront livrées sans filigrane.');
      resolve(ffmpegAvailable);
    });
  });
}

/** Superpose un PNG "Vyrox AI" en bas de la vidéo. Renvoie le buffer d'origine en cas d'échec. */
async function addWatermark(videoBuffer) {
  if (!sharp || !(await hasFfmpeg())) return videoBuffer;

  const id = `vyrox_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const inPath = path.join(os.tmpdir(), `${id}_in.mp4`);
  const wmPath = path.join(os.tmpdir(), `${id}_wm.png`);
  const outPath = path.join(os.tmpdir(), `${id}_out.mp4`);

  try {
    const wm = await sharp(Buffer.from(
      `<svg width="260" height="64" xmlns="http://www.w3.org/2000/svg">
        <text x="132" y="44" font-family="Arial, sans-serif" font-size="34" font-weight="bold" fill="rgba(0,0,0,0.6)" text-anchor="middle">Vyrox AI</text>
        <text x="130" y="42" font-family="Arial, sans-serif" font-size="34" font-weight="bold" fill="rgba(255,255,255,0.75)" text-anchor="middle">Vyrox AI</text>
      </svg>`
    )).png().toBuffer();

    fs.writeFileSync(inPath, videoBuffer);
    fs.writeFileSync(wmPath, wm);

    await new Promise((resolve, reject) => {
      execFile('ffmpeg', [
        '-y', '-i', inPath, '-i', wmPath,
        '-filter_complex', 'overlay=(W-w)/2:H-h-16',
        '-c:a', 'copy', '-movflags', '+faststart',
        outPath
      ], { timeout: 120000 }, (err) => (err ? reject(err) : resolve()));
    });

    return fs.readFileSync(outPath);
  } catch (err) {
    console.warn('⚠️ Filigrane vidéo ignoré :', err.message);
    return videoBuffer;
  } finally {
    for (const f of [inPath, wmPath, outPath]) {
      try { fs.unlinkSync(f); } catch { /* déjà supprimé */ }
    }
  }
}

/**
 * Génère une vidéo, applique le filigrane si possible et l'enregistre dans outputDir.
 * @returns {Promise<{ filename: string, url: string }>}
 */
async function createVideoFile(prompt, outputDir) {
  const raw = await generateVideoBuffer(prompt);
  const finalBuffer = await addWatermark(raw);

  const filename = `vyrox_vid_${Date.now()}.mp4`;
  fs.writeFileSync(path.join(outputDir, filename), finalBuffer);
  return { filename, url: `/uploads/generations/${filename}` };
}

module.exports = { generateVideoBuffer, addWatermark, createVideoFile, VideoError };
