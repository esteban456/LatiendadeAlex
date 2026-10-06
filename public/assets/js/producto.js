import { $, escapeHtml, initChrome, loadConfig, money, plainText, productCard, addToCart, bindAddButtons, toast } from './core.js';

const PLACEHOLDER =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><rect width="200" height="200" fill="#eef0f6"/></svg>');

const toWebp = (p) => p?.replace('/productos/', '/productos-webp/').replace(/\.(jpg|jpeg|png)$/i, '.webp');

const state = { qty: 1, variant: null };
let current = null;

async function main() {
  $('[data-year]').textContent = new Date().getFullYear();
  const catalog = await initChrome();
  const slug = new URLSearchParams(location.search).get('slug');
  const product = (catalog.products || []).find((p) => p.slug === slug);

  if (!product) {
    location.href = 'catalogo.html';
    return;
  }

  current = product;
  state.variant = (product.variants || [])[0];
  document.title = `${product.name} | La Tienda de Alex`;
  $('[data-crumb]').textContent = product.name;

  $('[data-product]').innerHTML = render(product);
  bindAddButtons(catalog);
  renderRelated(catalog, product);
  injectSchema(product);

  const config = await loadConfig();
  const freeFrom = config.store?.freeShippingFrom ?? 0;
  const freeEl = $('[data-free-shipping]');
  if (freeEl) {
    freeEl.textContent = freeFrom
      ? `En compras desde ${money(freeFrom)}`
      : 'Consultanos el costo de envio';
  }
  const instEl = $('[data-installments]');
  if (instEl) instEl.textContent = config.paymentReady ? 'Con Mercado Pago' : 'Mercado Pago (modo demo)';
}

function render(product) {
  const images = (product.images?.length ? product.images : [product.image]).filter(Boolean).map(toWebp);
  const categories = (product.categories || []).slice(0, 3);
  const visibleVariants = (product.variants || []).filter((variant) => !variant.legacy);
  const description = plainText(product.description) || `Consulta disponibilidad y detalles de ${product.name} con nuestro equipo.`;
  return `
    <div class="product">
      <div class="gallery">
        <img id="main-image" src="${escapeHtml(images[0] || PLACEHOLDER)}" alt="${escapeHtml(product.name)}" data-fallback />
        ${
          images.length > 1
            ? `<div class="thumbs">${images
                .map(
                  (src, i) =>
                    `<button class="thumb ${i === 0 ? 'active' : ''}" data-img="${escapeHtml(src)}"><img src="${escapeHtml(src)}" alt="" data-fallback /></button>`,
                )
                .join('')}</div>`
            : ''
        }
      </div>

      <div>
        ${product.brand ? `<span class="card-brand">${escapeHtml(product.brand)}</span>` : ''}
        <h1 style="font-size:1.9rem;margin:.25rem 0 .5rem">${escapeHtml(product.name)}</h1>
        ${
          categories.length
            ? `<div class="chips" style="margin-bottom:.75rem">${categories
                .map(
                  (c) =>
                    `<a class="chip" href="catalogo.html?c=${encodeURIComponent(c.name)}">${c.icon ? `${escapeHtml(c.icon)} ` : ''}${escapeHtml(c.name)}</a>`,
                )
                .join('')}</div>`
            : ''
        }

        <div class="price price-big">${money(state.variant?.price || product.price)}</div>
        ${
          product.maxPrice > product.price
            ? `<p class="muted" style="margin:0">Precio mas alto con credito: <b>${money(product.maxPrice)}</b></p>`
            : ''
        }
        <p class="muted" style="font-size:.9rem">
          ${
            product.available
              ? '✅ Disponible — sale en 24 horas habiles'
              : '⏳ Sin stock por el momento — consultanos cuando llegue'
          }
        </p>
        ${product.stock > 0 ? `<p class="product-stock">${Number(product.stock)} unidades disponibles</p>` : ''}

        ${
          visibleVariants.length > 1
            ? `<div class="variants">${visibleVariants
                .map(
                  (v, i) => `
                <button class="variant ${i === 0 ? 'active' : ''}" data-variant="${escapeHtml(v.sku)}" ${v.available ? '' : 'disabled'}>
                  <span><b>${escapeHtml(v.label)}</b>${v.available ? '' : ' <span class="muted">(agotado)</span>'}</span>
                  <b>${money(v.price)}</b>
                </button>`,
                )
                .join('')}</div>`
            : ''
        }

        <div class="buy-row">
          <div class="qty">
            <button data-qty="-1" aria-label="Quitar uno">−</button>
            <span data-qty-value>1</span>
            <button data-qty="1" aria-label="Agregar uno">+</button>
          </div>
          <button class="btn" data-add ${product.available ? '' : 'disabled'}>Agregar al carrito</button>
          <button class="btn btn-accent" data-buy-now ${product.available ? '' : 'disabled'}>Comprar ahora</button>
        </div>

        <div class="features" style="grid-template-columns:1fr 1fr; gap:.6rem">
          <div class="feature" style="padding:.9rem"><div class="ico" style="width:34px;height:34px;font-size:1rem">🚚</div><b style="font-size:.9rem">Envio gratis</b><p style="font-size:.82rem" data-free-shipping></p></div>
          <div class="feature" style="padding:.9rem"><div class="ico" style="width:34px;height:34px;font-size:1rem">💳</div><b style="font-size:.9rem">Hasta 12 cuotas</b><p style="font-size:.82rem" data-installments></p></div>
        </div>

        <div class="accordion">
          <details open>
            <summary>Descripcion</summary>
            <p>${escapeHtml(description).replace(/\r?\n/g, '<br>')}</p>
          </details>
          <details>
            <summary>Envios y entregas</summary>
            <p>Despachamos en 24 horas hables a todo Colombia. Entrega estimada de 2 a 5 dias depending del destino. Pagas al recibir si lo prefieres (contra entrega disponible en ciudades principales).</p>
          </details>
          <details>
            <summary>Garantia</summary>
            <p>Todos los productos incluyen garantia del fabricante. Cambios y devoluciones dentro de los primeros 30 dias con producto en su empaque original.</p>
          </details>
        </div>
      </div>
    </div>`;
}

function renderRelated(catalog, product) {
  const category = (product.categories || [])[0]?.name;
  const pool = (catalog.products || []).filter((p) => p.price > 0 && p.slug !== product.slug);
  const related = category
    ? pool.filter((p) => (p.categories || []).some((c) => c.name === category))
    : [];
  const list = (related.length >= 4 ? related : pool.filter((p) => p.brand && p.brand === product.brand)).slice(0, 4);
  if (!list.length) return;
  $('[data-related]').innerHTML = list.map(productCard).join('');
  $('[data-related-wrap]').hidden = false;
}

function injectSchema(product) {
  const script = document.createElement('script');
  script.type = 'application/ld+json';
  script.textContent = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.description,
    image: product.images?.length ? product.images.map(toWebp) : [toWebp(product.image)],
    brand: { '@type': 'Brand', name: product.brand || 'La Tienda de Alex' },
    offers: {
      '@type': 'Offer',
      price: product.price,
      priceCurrency: 'COP',
      availability: product.available
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
    },
  });
  document.head.appendChild(script);
}

document.addEventListener('click', (event) => {
  if (!current) return;

  if (event.target.closest('[data-qty]')) {
    const delta = Number(event.target.closest('[data-qty]').dataset.qty);
    state.qty = Math.max(1, Math.min(99, state.qty + delta));
    $('[data-qty-value]').textContent = state.qty;
  }

  const variantButton = event.target.closest('[data-variant]');
  if (variantButton) {
    document.querySelectorAll('[data-variant]').forEach((b) => b.classList.remove('active'));
    variantButton.classList.add('active');
    const found = (current.variants || []).find((v) => v.sku === variantButton.dataset.variant);
    if (found) {
      state.variant = found;
      $('.price-big').textContent = money(found.price);
    }
  }

  const thumb = event.target.closest('[data-img]');
  if (thumb) {
    $('#main-image').src = thumb.dataset.img;
    document.querySelectorAll('.thumb').forEach((t) => t.classList.remove('active'));
    thumb.classList.add('active');
  }

  if (event.target.closest('[data-add]')) addToCart(current, state.variant, state.qty);

  if (event.target.closest('[data-buy-now]')) {
    addToCart(current, state.variant, state.qty);
    location.href = 'carrito.html';
  }
});

main().catch((err) => {
  console.error(err);
  toast('No se pudo cargar el producto', 'err');
});
