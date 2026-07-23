const $ = selector => document.querySelector(selector);

let products = [];
let editingId = null;
let authenticated = false;
let existingImages = [];
let selectedImages = [];
let previewUrls = [];

const imagesInput = $('#productImages');
const imagesPreview = $('#imagesPreview');
const MAX_IMAGES = 6;
const MAX_FILE_SIZE = 4 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

async function api(path, options = {}) {
  const response = await fetch('/.netlify/functions/' + path, {
    credentials: 'include',
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || 'Ошибка запроса');
    error.status = response.status;
    throw error;
  }
  return data;
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[char]));
}

function productImages(product) {
  if (Array.isArray(product?.images) && product.images.length) return product.images.filter(Boolean);
  return product?.image ? [product.image] : [];
}

function showAdmin() {
  $('#loginScreen').hidden = true;
  $('#adminApp').hidden = false;
}

async function checkSession() {
  try {
    await api('auth');
    authenticated = true;
    showAdmin();
    await loadProducts();
  } catch {
    authenticated = false;
    $('#adminApp').hidden = true;
    $('#productModal').hidden = true;
    $('#loginScreen').hidden = false;
  }
}

$('#loginForm').addEventListener('submit', async event => {
  event.preventDefault();
  $('#loginMessage').textContent = '';
  try {
    await api('auth', {
      method: 'POST',
      body: JSON.stringify({ password: $('#password').value })
    });
    authenticated = true;
    showAdmin();
    await loadProducts();
  } catch (error) {
    $('#loginMessage').textContent = error.message;
  }
});

$('#logoutButton').addEventListener('click', async () => {
  await api('auth', { method: 'DELETE' });
  location.reload();
});

async function loadProducts() {
  const result = await api('products');
  products = result.products || [];
  renderProducts();
}

function renderProducts() {
  const query = $('#adminSearch').value.toLowerCase();
  const list = products.filter(product =>
    `${product.name} ${product.category}`.toLowerCase().includes(query)
  );
  $('#productCount').textContent = `${list.length} позиций`;
  $('#adminProductList').innerHTML = list.map(product => {
    const images = productImages(product);
    const cover = images[0] || '/assets/images/products/tomatoes.webp';
    return `
      <article class="admin-product">
        <div class="admin-product-photo">
          <img src="${escapeHtml(cover)}" alt="">
          ${images.length > 1 ? `<span>${images.length} фото</span>` : ''}
        </div>
        <div><strong>${escapeHtml(product.name)}</strong><small>${escapeHtml(product.description || '')}</small></div>
        <div class="category-cell">${escapeHtml(product.category)}</div>
        <div class="price-cell">${(product.variants || []).map(v => `${escapeHtml(v.volume)}: ${Number(v.price).toLocaleString('ru-RU')} ₸`).join('<br>')}</div>
        <div><span class="status ${product.available ? 'on' : 'off'}">${product.available ? 'В наличии' : 'Скрыт'}</span><div class="row-actions"><button data-edit="${escapeHtml(product.id)}">Изменить</button><button class="delete" data-delete="${escapeHtml(product.id)}">Удалить</button></div></div>
      </article>`;
  }).join('');
}

$('#adminSearch').addEventListener('input', renderProducts);
$('#adminProductList').addEventListener('click', event => {
  const edit = event.target.dataset.edit;
  const remove = event.target.dataset.delete;
  if (edit) openModal(products.find(product => product.id === edit));
  if (remove) deleteProduct(remove);
});

function addVariant(variant = { volume: '', price: '' }) {
  const row = document.createElement('div');
  row.className = 'variant-row';
  row.innerHTML = `<input class="volume" placeholder="Объём, например 2 л" value="${escapeHtml(variant.volume || '')}" required><input class="price" type="number" min="0" placeholder="Цена" value="${escapeHtml(variant.price || '')}" required><button type="button" aria-label="Удалить вариант">×</button>`;
  row.querySelector('button').onclick = () => row.remove();
  $('#variants').append(row);
}

$('#addVariant').onclick = () => addVariant();

function revokePreviewUrls() {
  previewUrls.forEach(url => URL.revokeObjectURL(url));
  previewUrls = [];
}

function renderImagesPreview() {
  revokePreviewUrls();
  imagesPreview.innerHTML = '';

  existingImages.forEach((src, index) => {
    const item = document.createElement('div');
    item.className = 'image-preview-item';
    if (index === 0) item.classList.add('is-cover');
    item.innerHTML = `<img src="${escapeHtml(src)}" alt="Фотография ${index + 1}"><span class="cover-label">${index === 0 ? 'Главное' : 'Сохранено'}</span>`;

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.textContent = '×';
    remove.setAttribute('aria-label', 'Удалить фотографию');
    remove.onclick = () => {
      existingImages.splice(index, 1);
      renderImagesPreview();
    };

    if (index > 0) {
      const cover = document.createElement('button');
      cover.type = 'button';
      cover.className = 'make-cover';
      cover.textContent = '★';
      cover.title = 'Сделать главной';
      cover.setAttribute('aria-label', 'Сделать фотографию главной');
      cover.onclick = () => {
        const [chosen] = existingImages.splice(index, 1);
        existingImages.unshift(chosen);
        renderImagesPreview();
      };
      item.append(cover);
    }
    item.append(remove);
    imagesPreview.append(item);
  });

  selectedImages.forEach((file, index) => {
    const item = document.createElement('div');
    item.className = 'image-preview-item is-new';
    const url = URL.createObjectURL(file);
    previewUrls.push(url);
    item.innerHTML = `<img src="${url}" alt="Новая фотография ${index + 1}"><span class="cover-label">Новая</span>`;

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.textContent = '×';
    remove.setAttribute('aria-label', 'Убрать выбранную фотографию');
    remove.onclick = () => {
      selectedImages.splice(index, 1);
      renderImagesPreview();
    };
    item.append(remove);
    imagesPreview.append(item);
  });

  const total = existingImages.length + selectedImages.length;
  $('#imageCount').textContent = `${total} из ${MAX_IMAGES}`;
  $('#clearSelectedImage').hidden = selectedImages.length === 0;
  imagesInput.disabled = total >= MAX_IMAGES;
}

imagesInput.addEventListener('change', () => {
  const incoming = Array.from(imagesInput.files || []);
  const errors = [];
  for (const file of incoming) {
    if (!ALLOWED_TYPES.has(file.type)) {
      errors.push(`${file.name}: неподдерживаемый формат`);
      continue;
    }
    if (file.size > MAX_FILE_SIZE) {
      errors.push(`${file.name}: больше 4 МБ`);
      continue;
    }
    if (existingImages.length + selectedImages.length >= MAX_IMAGES) break;
    selectedImages.push(file);
  }
  imagesInput.value = '';
  $('#formMessage').textContent = errors.join('. ');
  renderImagesPreview();
});

$('#clearSelectedImage').addEventListener('click', () => {
  selectedImages = [];
  renderImagesPreview();
});

function openModal(product = null) {
  if (!authenticated) {
    $('#productModal').hidden = true;
    $('#adminApp').hidden = true;
    $('#loginScreen').hidden = false;
    $('#loginMessage').textContent = 'Сначала войдите в панель администратора.';
    return;
  }

  editingId = product?.id || null;
  existingImages = productImages(product);
  selectedImages = [];
  imagesInput.value = '';
  $('#modalTitle').textContent = product ? 'Изменить продукт' : 'Новый продукт';
  $('#name').value = product?.name || '';
  $('#category').value = product?.category || '';
  $('#description').value = product?.description || '';
  $('#available').checked = product?.available ?? true;
  $('#featured').checked = product?.featured ?? false;
  $('#variants').innerHTML = '';
  (product?.variants?.length ? product.variants : [{}]).forEach(addVariant);
  $('#formMessage').textContent = '';
  renderImagesPreview();
  $('#productModal').hidden = false;
  document.body.classList.add('modal-open');
}

function closeModal() {
  $('#productModal').hidden = true;
  $('#formMessage').textContent = '';
  selectedImages = [];
  existingImages = [];
  revokePreviewUrls();
  document.body.classList.remove('modal-open');
}

$('#addButton').onclick = () => openModal();
$('#closeModal').onclick = closeModal;
$('#cancelModal').onclick = closeModal;
$('#productModal').addEventListener('click', event => {
  if (event.target === $('#productModal')) closeModal();
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && !$('#productModal').hidden) closeModal();
});

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error(`Не удалось прочитать ${file.name}`));
    reader.readAsDataURL(file);
  });
}

async function uploadSelectedImages(productId) {
  const uploaded = [];
  for (let index = 0; index < selectedImages.length; index++) {
    const file = selectedImages[index];
    $('#formMessage').textContent = `Загрузка фотографии ${index + 1} из ${selectedImages.length}...`;
    const content = await readFileAsDataUrl(file);
    const result = await api('upload-image', {
      method: 'POST',
      body: JSON.stringify({
        productId,
        type: file.type,
        content,
        originalName: file.name,
        imageIndex: existingImages.length + index + 1
      })
    });
    uploaded.push(result.path);
  }
  return uploaded;
}

$('#productForm').addEventListener('submit', async event => {
  event.preventDefault();
  const saveButton = $('#saveButton');
  const variants = [...document.querySelectorAll('.variant-row')].map(row => ({
    volume: row.querySelector('.volume').value.trim(),
    price: Number(row.querySelector('.price').value)
  }));
  if (!variants.length) {
    $('#formMessage').textContent = 'Добавьте хотя бы один объём и цену.';
    return;
  }

  const id = editingId || slugify($('#name').value) || `product-${Date.now()}`;
  if (!existingImages.length && !selectedImages.length) {
    $('#formMessage').textContent = 'Добавьте хотя бы одну фотографию продукта.';
    return;
  }

  try {
    saveButton.disabled = true;
    const uploaded = await uploadSelectedImages(id);
    const images = [...existingImages, ...uploaded];
    const product = {
      id,
      name: $('#name').value.trim(),
      category: $('#category').value.trim(),
      description: $('#description').value.trim(),
      images,
      image: images[0],
      available: $('#available').checked,
      featured: $('#featured').checked,
      variants
    };
    const next = editingId
      ? products.map(item => item.id === editingId ? product : item)
      : [...products, product];

    $('#formMessage').textContent = 'Сохранение товара...';
    await saveProducts(next, editingId ? `Обновлён продукт ${product.name}` : `Добавлен продукт ${product.name}`);
    products = next;
    renderProducts();
    closeModal();
  } catch (error) {
    if (error.status === 401) {
      authenticated = false;
      closeModal();
      $('#adminApp').hidden = true;
      $('#loginScreen').hidden = false;
      $('#loginMessage').textContent = 'Сессия завершена. Войдите ещё раз.';
    } else {
      $('#formMessage').textContent = error.message;
    }
  } finally {
    saveButton.disabled = false;
  }
});

async function deleteProduct(id) {
  const product = products.find(item => item.id === id);
  if (!product || !confirm(`Удалить «${product.name}»?`)) return;
  try {
    const next = products.filter(item => item.id !== id);
    await saveProducts(next, `Удалён продукт ${product.name}`);
    products = next;
    renderProducts();
  } catch (error) {
    alert(error.message);
  }
}

function slugify(text) {
  const map = {а:'a',б:'b',в:'v',г:'g',д:'d',е:'e',ё:'e',ж:'zh',з:'z',и:'i',й:'y',к:'k',л:'l',м:'m',н:'n',о:'o',п:'p',р:'r',с:'s',т:'t',у:'u',ф:'f',х:'h',ц:'c',ч:'ch',ш:'sh',щ:'sch',ъ:'',ы:'y',ь:'',э:'e',ю:'yu',я:'ya'};
  return String(text || '').toLowerCase().split('').map(char => map[char] ?? char).join('')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 70);
}

async function saveProducts(next, message) {
  return api('products', {
    method: 'PUT',
    body: JSON.stringify({ products: next, message })
  });
}

checkSession();
