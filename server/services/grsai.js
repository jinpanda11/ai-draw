import { get } from '../db.js';

function getApiConfig() {
  const apiKey = get("SELECT value FROM settings WHERE key='api_key'");
  const urls = [];
  for (let i = 0; i < 5; i++) {
    const row = get("SELECT value FROM settings WHERE key=?", [`api_url_${i}`]);
    urls.push(row?.value || '');
  }
  return {
    apiKey: apiKey?.value || process.env.GRSAI_API_KEY || '',
    urls,
  };
}

async function doFetch(url, apiKey, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error: ${res.status} ${text}`);
  }

  return res.json();
}

export async function generateImage({ baseUrl, endpoint, model, prompt, aspectRatio = '1:1', quality = 'auto', urls = [], webHook = '-1', shutProgress = false }) {
  const { apiKey } = getApiConfig();
  const url = `${baseUrl}${endpoint}`;

  const body = {
    model,
    prompt,
    aspectRatio,
    quality,
    urls,
    webHook,
    shutProgress,
  };

  return doFetch(url, apiKey, body);
}

export async function getResult(taskId, baseUrl) {
  const { apiKey } = getApiConfig();
  return doFetch(`${baseUrl}/v1/draw/result`, apiKey, { id: taskId });
}

export async function downloadImage(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to download image: ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  return buffer;
}

// Get API config (for checking if configured)
export { getApiConfig };
