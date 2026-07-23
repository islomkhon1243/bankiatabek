const state = { products: [], category: 'Все', query: '' };
const grid = document.querySelector('#productGrid');
const categoriesEl = document.querySelector('#categoryList');
const template = document.querySelector('#productTemplate');
const emptyState = document.querySelector('#emptyState');

const money = value => new Intl.NumberFormat('ru-RU').format(value) + ' ₸';

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
    const node = template.content.cloneNode(true);
    const img = node.querySelector('.product-image');
    img.src = product.image;
    img.alt = product.name;
    node.querySelector('.product-badge').hidden = !product.featured;
    node.querySelector('.product-category').textContent = product.category;
    node.querySelector('.product-name').textContent = product.name;
    node.querySelector('.product-description').textContent = product.description || '';
    node.querySelector('.variant-list').innerHTML = product.variants.map(v =>
      `<div class="variant"><span>${v.volume}</span><strong>${money(v.price)}</strong></div>`
    ).join('');
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

document.addEventListener("click", function (event) {
    const button = event.target.closest(".description-toggle");

    if (!button) return;

    const card = button.closest(".product-card");

    if (!card) return;

    const isOpen = card.classList.toggle("description-open");

    button.textContent = isOpen ? "Скрыть" : "Подробнее";
    button.setAttribute("aria-expanded", String(isOpen));
});

loadProducts();
