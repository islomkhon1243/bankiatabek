const { isAuth, json } = require('./_helpers');

const API = 'https://api.github.com';
const ALLOWED_TYPES = new Map([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp']
]);
const MAX_BYTES = 4 * 1024 * 1024;

function config() {
  return {
    owner: process.env.GITHUB_OWNER,
    repo: process.env.GITHUB_REPO,
    branch: process.env.GITHUB_BRANCH || 'main',
    token: process.env.GITHUB_TOKEN
  };
}

async function github(path, options = {}) {
  const c = config();
  const response = await fetch(API + path, {
    ...options,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${c.token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'banki-atabek-admin',
      ...(options.headers || {})
    }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || 'Ошибка загрузки изображения в GitHub');
  return data;
}

function safeName(value) {
  return String(value || 'product')
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 70) || 'product';
}

exports.handler = async event => {
  if (!isAuth(event)) return json(401, { error: 'Требуется вход' });
  if (event.httpMethod !== 'POST') return json(405, { error: 'Метод не поддерживается' });

  const c = config();
  if (!c.owner || !c.repo || !c.token) {
    return json(500, { error: 'Не настроены переменные GitHub в Netlify' });
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const type = String(body.type || '').toLowerCase();
    const extension = ALLOWED_TYPES.get(type);
    if (!extension) return json(400, { error: 'Разрешены только JPG, PNG и WebP' });

    const content = String(body.content || '').replace(/^data:[^;]+;base64,/, '').replace(/\s/g, '');
    if (!content) return json(400, { error: 'Файл изображения не получен' });

    const bytes = Buffer.from(content, 'base64');
    if (!bytes.length) return json(400, { error: 'Не удалось прочитать изображение' });
    if (bytes.length > MAX_BYTES) return json(400, { error: 'Размер изображения не должен превышать 4 МБ' });

    const suffix = `${Date.now()}-${Number(body.imageIndex || 1)}-${Math.random().toString(36).slice(2, 7)}`;
    const filename = `${safeName(body.productId)}-${suffix}.${extension}`;
    const filePath = `assets/images/products/uploads/${filename}`;

    await github(`/repos/${c.owner}/${c.repo}/contents/${filePath}`, {
      method: 'PUT',
      body: JSON.stringify({
        message: `Загружено фото продукта ${safeName(body.productId)}`,
        content: bytes.toString('base64'),
        branch: c.branch
      })
    });

    return json(200, { ok: true, path: `/${filePath}` });
  } catch (error) {
    return json(500, { error: error.message });
  }
};
