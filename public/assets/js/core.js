const CART_KEY = 'alx.cart.v1';
export const PLACEHOLDER =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><rect width="200" height="200" fill="#eef0f6"/><text x="100" y="108" font-family="sans-serif" font-size="16" fill="#9aa3b5" text-anchor="middle">Sin imagen</text></svg>',
  );

export const money = (value) =>
  new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);

export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

export const escapeHtml = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function plainText(value) {
  return String(value ?? '')
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6])\s*>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '• ')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function toast(message, type = '') {
  let node = $('.toast');
  if (!node) {
    node = document.createElement('div');
    node.className = 'toast';
    document.body.appendChild(node);
  }
  node.textContent = message;
  node.className = `toast show ${type}`;
  clearTimeout(node._timer);
  node._timer = setTimeout(() => {
    node.className = 'toast';
  }, 3200);
}

export const readStore = (key, fallback) => {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
};

export const writeStore = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* modo privado */
  }
  window.dispatchEvent(new CustomEvent('cart:change'));
};

export const cart = {
  all: () => {
    const items = readStore(CART_KEY, []);
    if (!Array.isArray(items)) return [];
    return items.filter((item) => item && item.sku && Number(item.qty) > 0 && Number(item.price) >= 0);
  },
  save: (items) => writeStore(CART_KEY, items),
  add(item, qty = 1) {
    const items = this.all();
    const found = items.find((i) => i.sku === item.sku);
    if (found) found.qty = Math.min(99, found.qty + qty);
    else items.push({ ...item, qty: Math.min(99, qty) });
    this.save(items);
  },
  setQty(sku, qty) {
    const items = this.all()
      .map((i) => (i.sku === sku ? { ...i, qty: Math.max(0, Math.min(99, qty)) } : i))
      .filter((i) => i.qty > 0);
    this.save(items);
  },
  remove(sku) {
    this.save(this.all().filter((i) => i.sku !== sku));
  },
  clear() {
    this.save([]);
  },
  count() {
    return this.all().reduce((sum, i) => sum + i.qty, 0);
  },
  subtotal() {
    return this.all().reduce((sum, i) => sum + i.price * i.qty, 0);
  },
};

export async function loadCatalog() {
  const response = await fetch('/api/catalog');
  if (!response.ok) throw new Error('No se pudo cargar el catalogo');
  return response.json();
}

export async function loadConfig() {
  try {
    const response = await fetch('/api/config');
    return response.ok ? response.json() : { store: {}, paymentReady: false, mode: 'demo' };
  } catch {
    return { store: {}, paymentReady: false, mode: 'demo' };
  }
}

function getDeliveryDate() {
  const date = new Date();
  date.setDate(date.getDate() + 3);
  const options = { weekday: 'long', day: 'numeric', month: 'long' };
  return date.toLocaleDateString('es-CO', options);
}

function getStockWarning(product) {
  if (!product.available) return '';
  const stock = product.stock || 0;
  if (stock > 0 && stock <= 5) {
    return `<div class="card-stock-warning">¡Solo quedan ${stock}!</div>`;
  }
  return '';
}

function getImageSrc(imagePath) {
  if (!imagePath) return PLACEHOLDER;
  return imagePath.replace('/productos/', '/productos-webp/').replace(/\.(jpg|jpeg|png)$/i, '.webp');
}

// En los listados cada foto pesa 17 KB en miniatura contra 45 KB completa.
function getThumbSrc(imagePath) {
  const completa = getImageSrc(imagePath);
  if (!completa.startsWith('/assets/img/productos-webp/')) return completa;
  return completa.replace(/\.webp$/, '-400.webp');
}

export function productCard(product) {
  const off = !product.available;
  const hasOffer = product.maxPrice > product.price;
  const isBestSeller = (product.sales || 0) > 50;
  const hasFreeShipping = product.price >= 300000;
  const isNew = product.createdAt && (Date.now() - new Date(product.createdAt).getTime()) < 30 * 24 * 60 * 60 * 1000;
  const installments = Math.min(12, Math.max(3, Math.floor(product.price / 100000) * 3));
  const installmentPrice = Math.round(product.price / installments);
  const deliveryDate = getDeliveryDate();
  const stockWarning = getStockWarning(product);
  const description = plainText(product.description);

  let badges = '';
  if (off) badges += '<span class="tag tag-out">Agotado</span>';
  if (isBestSeller && !off) badges += '<span class="badge badge-best">Más vendido</span>';
  if (hasOffer && !off) badges += '<span class="badge badge-offer">Oferta</span>';
  if (hasFreeShipping && !off) badges += '<span class="badge badge-shipping">Envío gratis</span>';
  if (isNew && !off) badges += '<span class="badge badge-new">Nuevo</span>';

  const imgSrc = escapeHtml(getThumbSrc(product.image));
  const imgFull = escapeHtml(getImageSrc(product.image));
  const imgAlt = escapeHtml(product.name);

  return `
    <article class="card ${off ? 'stock-off' : ''}">
      <a class="card-media" href="producto.html?slug=${encodeURIComponent(product.slug)}" aria-label="${escapeHtml(product.name)}">
        ${badges}
        <img data-src="${imgSrc}" data-full="${imgFull}" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1 1'%3E%3C/svg%3E" alt="${imgAlt}" loading="lazy" data-fallback class="lazy-img" />
      </a>
      <div class="card-body">
        ${product.brand ? `<span class="card-brand">${escapeHtml(product.brand)}</span>` : ''}
        <a href="producto.html?slug=${encodeURIComponent(product.slug)}" class="card-name">${escapeHtml(product.name)}</a>
        ${description ? `<p class="card-description">${escapeHtml(description)}</p>` : ''}
        <div class="card-foot">
          <div>
            <div class="card-price-row">
              <span class="card-price">${money(product.price)}</span>
              ${hasOffer ? `<span class="price-old">${money(product.maxPrice)}</span>` : ''}
            </div>
            <div class="card-installments">
              en ${installments} cuotas de ${money(installmentPrice)} ${hasFreeShipping ? '<span class="free">sin interés</span>' : ''}
            </div>
            ${hasFreeShipping ? '<div class="card-shipping">🚚 Envío gratis</div>' : ''}
            <div class="card-delivery">📅 Recíbelo el ${deliveryDate}</div>
            ${stockWarning}
          </div>
          <div class="card-buy-actions">
            <label class="card-quantity" aria-label="Cantidad">
              <span>Cant.</span><input type="number" min="1" max="99" value="1" data-card-qty="${escapeHtml(product.slug)}" ${off ? 'disabled' : ''} />
            </label>
            <button class="btn btn-sm" data-add-to-cart="${escapeHtml(product.slug)}" ${off ? 'disabled' : ''}>
              ${off ? 'Sin stock' : 'Agregar al carrito'}
            </button>
          </div>
        </div>
      </div>
    </article>`;
}

export function productFromCatalog(catalog, slug) {
  return (catalog.products || []).find((p) => p.slug === slug);
}

export function variantFromProduct(product, sku) {
  return (product.variants || []).find((v) => v.sku === sku) || (product.variants || [])[0];
}

export function addToCart(product, variant, qty = 1) {
  cart.add(
    {
      id: product.id,
      slug: product.slug,
      name: product.name,
      image: product.image,
      sku: variant.sku,
      variant: variant.label,
      price: variant.price || product.price,
    },
    qty,
  );
  toast(`${product.name} agregado al carrito`, 'ok');
}

export function bindAddButtons(catalog) {
  document.addEventListener('click', (event) => {
    const button = event.target.closest('[data-add-to-cart]');
    if (!button) return;
    event.preventDefault();
    const product = productFromCatalog(catalog, button.dataset.addToCart);
    if (!product) return;
    const variant = variantFromProduct(product);
    const quantity = button.closest('.card')?.querySelector('[data-card-qty]');
    addToCart(product, variant, Math.max(1, Math.min(99, Number(quantity?.value) || 1)));
  });
}

export function initImageFallback() {
  document.addEventListener(
    'error',
    (event) => {
      const img = event.target;
      // Las tarjetas cargan la miniatura -400. Si esa falla se prueba la imagen
      // completa y, solo si tampoco existe, se cae al placeholder.
      if (img.dataset.full) {
        const completa = img.dataset.full;
        delete img.dataset.full;
        img.src = completa;
        return;
      }
      if (img.dataset.fallback !== undefined && img.src !== PLACEHOLDER) {
        img.dataset.fallback = 'done';
        img.src = PLACEHOLDER;
      }
    },
    true,
  );
}

export function initLazyLoading() {
  const imageObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const img = entry.target;
          if (img.dataset.src) {
            img.src = img.dataset.src;
            img.removeAttribute('data-src');
          }
          imageObserver.unobserve(img);
        }
      });
    },
    { rootMargin: '200px 0px', threshold: 0.01 },
  );

  const observar = (raiz) => {
    raiz.querySelectorAll('img[data-src]').forEach((img) => imageObserver.observe(img));
  };

  // Observar todas las imágenes con data-src
  observar(document);

  // Las tarjetas se pintan despues del arranque, asi que hay que vigilar el DOM:
  // si no, las imagenes se quedan en el SVG transparente y el producto sale sin
  // foto. Antes dependia de que cada pagina llamara a la funcion devuelta, y
  // ninguna lo hacia.
  if (typeof MutationObserver !== 'undefined' && document.body) {
    new MutationObserver((mutaciones) => {
      for (const m of mutaciones) {
        for (const nodo of m.addedNodes) {
          if (nodo.nodeType !== 1) continue;
          if (nodo.matches?.('img[data-src]')) imageObserver.observe(nodo);
          if (nodo.querySelectorAll) observar(nodo);
        }
      }
    }).observe(document.body, { childList: true, subtree: true });
  }

  // Retornar función para observar nuevas imágenes dinámicamente
  return observar;
}

export function initCartBadge() {
  const paint = () => {
    const count = cart.count();
    $$('[data-cart-count]').forEach((node) => {
      node.textContent = count;
      node.hidden = count === 0;
    });
  };
  window.addEventListener('cart:change', paint);
  window.addEventListener('storage', paint);
  paint();
}

export function initScrollReveal() {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.1, rootMargin: '0px 0px -40px 0px' },
  );
  $$('.reveal').forEach((el) => observer.observe(el));
}

export function initHeaderScroll() {
  const header = $('.header');
  if (!header) return;
  const onScroll = () => {
    header.classList.toggle('scrolled', window.scrollY > 8);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}

export async function initChrome({ catalog, config: suppliedConfig } = {}) {
  initCartBadge();
  initImageFallback();
  initLazyLoading();
  initScrollReveal();
  initHeaderScroll();

  const accountIcon = $('[data-account-icon]');
  if (accountIcon) {
    fetch('/api/auth/me', { credentials: 'same-origin' })
      .then((response) => response.ok ? response.json() : null)
      .then((data) => {
        const picture = data?.user?.picture;
        if (!picture) return;
        const avatar = document.createElement('img');
        avatar.className = 'account-avatar';
        avatar.src = picture;
        avatar.alt = '';
        avatar.referrerPolicy = 'no-referrer';
        avatar.onerror = () => avatar.remove();
        accountIcon.replaceChildren(avatar);
        accountIcon.setAttribute('aria-label', `Mi cuenta: ${data.user.name || data.user.email}`);
        accountIcon.title = data.user.name || data.user.email || 'Mi cuenta';
      })
      .catch(() => {});
  }

  const data = catalog || (await loadCatalog().catch(() => ({ categories: [], products: [] })));
  const nav = $('[data-nav]');
  if (nav) {
    const top = (data.categories || []).slice(0, 12);
    nav.innerHTML = [
      '<a href="index.html">Inicio</a>',
      '<a href="catalogo.html">Todo el catalogo</a>',
      ...top.map((c) => `<a href="catalogo.html?c=${encodeURIComponent(c.name)}">${escapeHtml(c.name)}</a>`),
    ].join('');
  }

  const footCats = $('[data-footer-cats]');
  if (footCats) {
    footCats.innerHTML = (data.categories || [])
      .slice(0, 10)
      .map((c) => `<li><a href="catalogo.html?c=${encodeURIComponent(c.name)}">${escapeHtml(c.name)}</a></li>`)
      .join('');
  }

  const demo = $('[data-demo-banner]');
  const config = await (suppliedConfig || loadConfig());
  if (demo && !config.paymentReady) {
    demo.className = 'banner-demo';
    demo.textContent = 'Modo demostracion: el pago real se activa cuando el cliente cargue sus llaves de Mercado Pago (.env).';
  }

  const waDigits = String(config.store?.whatsapp || '').replace(/\D/g, '');
  if (waDigits) {
    $$('[data-whatsapp]').forEach((node) => {
      node.href = `https://wa.me/${waDigits}`;
    });
  }

  return data;
}

