const $ = selector => document.querySelector(selector);
let products = [];
let editingId = null;
let selectedImageFile = null;
let originalImage = '';
let authenticated = false;
const imagesInput = document.getElementById("productImages");
const imagesPreview = document.getElementById("imagesPreview");

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

function showAdmin() {
  $('#loginScreen').hidden = true;
  $('#adminApp').hidden = false;
}

$('#loginForm').addEventListener('submit', async event => {
  event.preventDefault();
  $('#loginMessage').textContent = '';
  try {
    await api('auth', { method: 'POST', body: JSON.stringify({ password: $('#password').value }) });
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

function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
}

function renderProducts() {
  const query = $('#adminSearch').value.toLowerCase();
  const list = products.filter(product => `${product.name} ${product.category}`.toLowerCase().includes(query));
  $('#productCount').textContent = `${list.length} позиций`;
  $('#adminProductList').innerHTML = list.map(product => `
    <article class="admin-product">
      <img src="${escapeHtml(product.image)}" alt="">
      <div><strong>${escapeHtml(product.name)}</strong><small>${escapeHtml(product.description || '')}</small></div>
      <div class="category-cell">${escapeHtml(product.category)}</div>
      <div class="price-cell">${product.variants.map(v => `${escapeHtml(v.volume)}: ${Number(v.price).toLocaleString('ru-RU')} ₸`).join('<br>')}</div>
      <div><span class="status ${product.available ? 'on' : 'off'}">${product.available ? 'В наличии' : 'Скрыт'}</span><div class="row-actions"><button data-edit="${escapeHtml(product.id)}">Изменить</button><button class="delete" data-delete="${escapeHtml(product.id)}">Удалить</button></div></div>
    </article>`).join('');
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
  row.innerHTML = `<input class="volume" placeholder="Объём, например 2 л" value="${escapeHtml(variant.volume || '')}" required><input class="price" type="number" min="0" placeholder="Цена" value="${escapeHtml(variant.price || '')}" required><button type="button">×</button>`;
  row.querySelector('button').onclick = () => row.remove();
  $('#variants').append(row);
}

$('#addVariant').onclick = () => addVariant();

function setPreview(src) {
  $('#imagePreview').src = src || '/assets/images/products/tomatoes.webp';
}

function renderSelectedImages() {
    imagesPreview.innerHTML = "";

    selectedImages.forEach((file, index) => {
        const previewItem = document.createElement("div");
        previewItem.className = "image-preview-item";

        const image = document.createElement("img");
        image.src = URL.createObjectURL(file);
        image.alt = `Фотография ${index + 1}`;

        const removeButton = document.createElement("button");
        removeButton.type = "button";
        removeButton.textContent = "×";
        removeButton.setAttribute("aria-label", "Удалить фотографию");

        removeButton.addEventListener("click", () => {
            selectedImages.splice(index, 1);
            renderSelectedImages();
        });

        previewItem.append(image, removeButton);
        imagesPreview.append(previewItem);
    });
}

imagesInput.addEventListener("change", () => {
    const files = Array.from(imagesInput.files);

    selectedImages = files;
    imagesPreview.innerHTML = "";

    files.forEach((file, index) => {
        if (!file.type.startsWith("image/")) {
            return;
        }

        const previewItem = document.createElement("div");
        previewItem.className = "image-preview-item";

        const image = document.createElement("img");
        image.src = URL.createObjectURL(file);
        image.alt = `Фотография ${index + 1}`;

        const removeButton = document.createElement("button");
        removeButton.type = "button";
        removeButton.textContent = "×";
        removeButton.setAttribute(
            "aria-label",
            `Удалить фотографию ${index + 1}`
        );

        removeButton.addEventListener("click", () => {
            selectedImages.splice(index, 1);
            renderSelectedImages();
        });

        previewItem.append(image, removeButton);
        imagesPreview.append(previewItem);
    });
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
  selectedImageFile = null;
  originalImage = product?.image || '';
  $('#imageFile').value = '';
  $('#clearSelectedImage').hidden = true;
  $('#modalTitle').textContent = product ? 'Изменить продукт' : 'Новый продукт';
  $('#name').value = product?.name || '';
  $('#category').value = product?.category || '';
  $('#description').value = product?.description || '';
  $('#image').value = originalImage;
  setPreview(originalImage);
  $('#available').checked = product?.available ?? true;
  $('#featured').checked = product?.featured ?? false;
  $('#variants').innerHTML = '';
  (product?.variants || [{}]).forEach(addVariant);
  $('#productModal').hidden = false;
}

function closeModal() {
  $('#productModal').hidden = true;
  $('#formMessage').textContent = '';
  selectedImageFile = null;
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
    reader.onerror = () => reject(new Error('Не удалось прочитать фотографию'));
    reader.readAsDataURL(file);
  });
}

async function uploadSelectedImage(productId) {
  if (!selectedImageFile) return originalImage;
  $('#formMessage').textContent = 'Загрузка фотографии...';
  const content = await readFileAsDataUrl(selectedImageFile);
  const result = await api('upload-image', {
    method: 'POST',
    body: JSON.stringify({ productId, type: selectedImageFile.type, content })
  });
  return result.path;
}

$('#productForm').addEventListener('submit', async event => {
  event.preventDefault();
  const saveButton = $('#saveButton');
  const variants = [...document.querySelectorAll('.variant-row')].map(row => ({
    volume: row.querySelector('.volume').value.trim(),
    price: Number(row.querySelector('.price').value)
  }));
  if (!variants.length) return ($('#formMessage').textContent = 'Добавьте хотя бы один объём и цену.');

  const id = editingId || slugify($('#name').value) || `product-${Date.now()}`;
  if (!selectedImageFile && !originalImage) return ($('#formMessage').textContent = 'Выберите фотографию продукта.');

  try {
    saveButton.disabled = true;
    const image = await uploadSelectedImage(id);
    const product = {
      id,
      name: $('#name').value.trim(),
      category: $('#category').value.trim(),
      description: $('#description').value.trim(),
      image,
      available: $('#available').checked,
      featured: $('#featured').checked,
      variants
    };
    const next = editingId ? products.map(item => item.id === editingId ? product : item) : [...products, product];
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
  if (!confirm(`Удалить «${product.name}»?`)) return;
  try {
    const next = products.filter(item => item.id !== id);
    await saveProducts(next, `Удалён продукт ${product.name}`);
    products = next;
    renderProducts();
  } catch (error) {
    alert(error.message);
  }
}

async function saveProducts(next, message) {
  await api('products', { method: 'PUT', body: JSON.stringify({ products: next, message }) });
}

function slugify(value) {
  return value.toLowerCase().replace(/[а-яё]/g, char => ({'а':'a','б':'b','в':'v','г':'g','д':'d','е':'e','ё':'e','ж':'zh','з':'z','и':'i','й':'y','к':'k','л':'l','м':'m','н':'n','о':'o','п':'p','р':'r','с':'s','т':'t','у':'u','ф':'f','х':'h','ц':'c','ч':'ch','ш':'sh','щ':'sch','ъ':'','ы':'y','ь':'','э':'e','ю':'yu','я':'ya'}[char])).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

checkSession();
