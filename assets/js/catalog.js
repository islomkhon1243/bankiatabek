const state = { products: [], category: 'Все', query: '' };
const grid = document.querySelector('#productGrid');
const categoriesEl = document.querySelector('#categoryList');
const template = document.querySelector('#productTemplate');
const emptyState = document.querySelector('#emptyState');
const gallery = document.querySelector('#galleryModal');

let galleryImages = [];
let galleryIndex = 0;
let touchStartX = 0;

const money = value => new Intl.NumberFormat('ru-RU').format(value) + ' ₸';

function getImages(product) {
  if (Array.isArray(product.images) && product.images.length) return product.images.filter(Boolean);
  return product.image ? [product.image] : ['/assets/images/products/tomatoes.webp'];
}

async function loadProducts() {
  try {
    const response = await fetch('data/products.json', { cache: 'no-store' });
    if (!response.ok) throw new Error('Не удалось загрузить каталог');
    state.products = await response.json();
    renderCategories();
    renderProducts();
  } catch (error) {
    grid.innerHTML = `<p class="empty-state">${error.message}</p>`;
  }
}

function renderCategories() {
  const names = ['Все', ...new Set(state.products.map(p => p.category))];
  categoriesEl.innerHTML = names.map(name =>
    `<button class="${name === state.category ? 'active' : ''}" data-category="${name}">${name}</button>`
  ).join('');
}

function renderProducts() {
  const query = state.query.toLowerCase().trim();
  const items = state.products.filter(product => {
    const inCategory = state.category === 'Все' || product.category === state.category;
    const inSearch = !query || `${product.name} ${product.description} ${product.category}`.toLowerCase().includes(query);
    return product.available && inCategory && inSearch;
  });

  grid.innerHTML = '';
  items.forEach(product => {
    const images = getImages(product);
    const node = template.content.cloneNode(true);
    const card = node.querySelector('.product-card');
    const imageButton = node.querySelector('.product-image-button');
    const img = node.querySelector('.product-image');
    img.src = images[0];
    img.alt = product.name;
    imageButton.dataset.images = JSON.stringify(images);
    imageButton.dataset.name = product.name;
    imageButton.setAttribute('aria-label', images.length > 1 ? `Открыть галерею «${product.name}», ${images.length} фото` : `Увеличить фото «${product.name}»`);
    node.querySelector('.photo-count').hidden = images.length < 2;
    node.querySelector('.photo-count').textContent = `${images.length} фото`;
    node.querySelector('.product-badge').hidden = !product.featured;
    node.querySelector('.product-category').textContent = product.category;
    node.querySelector('.product-name').textContent = product.name;
    node.querySelector('.product-description').textContent = product.description || 'Описание отсутствует.';
    node.querySelector('.variant-list').innerHTML = (product.variants || []).map(v =>
      `<div class="variant"><span>${v.volume}</span><strong>${money(v.price)}</strong></div>`
    ).join('');
    card.dataset.productId = product.id;
    grid.append(node);
  });
  emptyState.hidden = items.length > 0;
}

categoriesEl.addEventListener('click', event => {
  const button = event.target.closest('button[data-category]');
  if (!button) return;
  state.category = button.dataset.category;
  renderCategories();
  renderProducts();
});

document.querySelector('#searchInput').addEventListener('input', event => {
  state.query = event.target.value;
  renderProducts();
});

document.addEventListener('click', event => {
  const descriptionButton = event.target.closest('.description-toggle');
  if (descriptionButton) {
    const card = descriptionButton.closest('.product-card');
    const isOpen = card.classList.toggle('description-open');
    descriptionButton.textContent = isOpen ? 'Скрыть' : 'Подробнее';
    descriptionButton.setAttribute('aria-expanded', String(isOpen));
    return;
  }

  const imageButton = event.target.closest('.product-image-button');
  if (imageButton) {
    openGallery(JSON.parse(imageButton.dataset.images), imageButton.dataset.name);
  }
});

function openGallery(images, name) {
  galleryImages = images;
  galleryIndex = 0;
  $('#galleryTitle').textContent = name;
  gallery.hidden = false;
  document.body.classList.add('gallery-open');
  renderGallery();
}

function $(selector) { return document.querySelector(selector); }

function renderGallery() {
  $('#galleryImage').src = galleryImages[galleryIndex];
  $('#galleryImage').alt = `${$('#galleryTitle').textContent}, фото ${galleryIndex + 1}`;
  $('#galleryCounter').textContent = `${galleryIndex + 1} / ${galleryImages.length}`;
  $('#galleryPrev').hidden = galleryImages.length < 2;
  $('#galleryNext').hidden = galleryImages.length < 2;
  $('#galleryDots').innerHTML = galleryImages.map((_, i) =>
    `<button type="button" class="${i === galleryIndex ? 'active' : ''}" data-gallery-index="${i}" aria-label="Фото ${i + 1}"></button>`
  ).join('');
}

function moveGallery(step) {
  galleryIndex = (galleryIndex + step + galleryImages.length) % galleryImages.length;
  renderGallery();
}

function closeGallery() {
  gallery.hidden = true;
  document.body.classList.remove('gallery-open');
}

$('#galleryClose').addEventListener('click', closeGallery);
$('#galleryPrev').addEventListener('click', () => moveGallery(-1));
$('#galleryNext').addEventListener('click', () => moveGallery(1));
$('#galleryDots').addEventListener('click', event => {
  const dot = event.target.closest('[data-gallery-index]');
  if (!dot) return;
  galleryIndex = Number(dot.dataset.galleryIndex);
  renderGallery();
});
gallery.addEventListener('click', event => {
  if (event.target === gallery) closeGallery();
});
gallery.addEventListener('touchstart', event => {
  touchStartX = event.changedTouches[0].clientX;
}, { passive: true });
gallery.addEventListener('touchend', event => {
  const delta = event.changedTouches[0].clientX - touchStartX;
  if (Math.abs(delta) > 45 && galleryImages.length > 1) moveGallery(delta > 0 ? -1 : 1);
}, { passive: true });
document.addEventListener('keydown', event => {
  if (gallery.hidden) return;
  if (event.key === 'Escape') closeGallery();
  if (event.key === 'ArrowLeft') moveGallery(-1);
  if (event.key === 'ArrowRight') moveGallery(1);
});

loadProducts();
