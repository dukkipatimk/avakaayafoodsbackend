// Adds the festive gift hampers to the catalogue through the admin API.
//
// Preview (default, changes nothing):
//   node scripts/addGiftHampers.js
// Create them:
//   ADMIN_EMAIL=you@example.com ADMIN_PASSWORD=... node scripts/addGiftHampers.js --apply
//
// API_URL defaults to production; point it at a local server to try it there first.
// A hamper whose slug already exists is skipped, so running it twice is safe.

const API_URL = process.env.API_URL || 'https://api.avakaayafoods.com/api';
const APPLY = process.argv.includes('--apply');

// Each hamper is one fixed set of packs, so it has a single variant. The variant
// enum has no "hamper" size; 1kg is the nearest, and the description lists the
// actual packs. mrp is what the items cost bought separately, so the card shows
// the saving.
const HAMPERS = [
  {
    name: 'Festive Classic Hamper',
    slug: 'festive-classic-hamper',
    price: 999,
    isVeg: true,
    thumbnail: '/images/festivals/diwali.jpg',
    shortDescription: 'Two pickles, two sweets and two snacks: a little of everything Telugu homes reach for at festival time.',
    items: [
      ['Mango Pickle', '250g'], ['Gongura Pickle', '250g'], ['Bandar Halwa', '250g'],
      ['Kaju Burfi', '250g'], ['Murukulu', '250g'], ['Kara Boondi', '250g'],
    ],
    shelfLife: 'Best within 2 weeks (Kaju Burfi and Bandar Halwa keep the shortest); pickles and snacks keep longer',
    allergens: ['Cashew', 'Sesame'],
    tags: ['gift', 'hamper', 'dussehra', 'diwali', 'festive', 'veg', 'corporate'],
  },
  {
    name: 'Diwali Sweets & Savouries Hamper',
    slug: 'diwali-sweets-savouries-hamper',
    price: 1099,
    isVeg: true,
    thumbnail: '/images/banners/banner_hampers.jpg',
    shortDescription: 'Kaju burfi, dry fruit laddu and Mysore pak, balanced with two crisp savouries.',
    items: [
      ['Kaju Burfi', '250g'], ['Dry Fruit Laddu', '250g'], ['Milk Mysore Pak', '250g'],
      ['Kaju Mixture', '250g'], ['Ribbon Pakodi', '250g'],
    ],
    shelfLife: 'Best within 2 weeks at room temperature (Kaju Burfi keeps the shortest)',
    allergens: ['Cashew', 'Dry fruits', 'Milk'],
    tags: ['gift', 'hamper', 'diwali', 'sweets', 'festive', 'veg', 'corporate'],
  },
  {
    name: 'Corporate Desk Gift Hamper',
    slug: 'corporate-desk-gift-hamper',
    price: 449,
    isVeg: true,
    thumbnail: '/images/banners/hero-hampers.jpg',
    shortDescription: 'A compact gift for teams and clients: a classic pickle, a podi, a sweet and a snack.',
    items: [
      ['Mango Pickle', '250g'], ['Palli Karam', '100g'],
      ['Bellam Sunnundalu', '250g'], ['Chekkalu Round', '250g'],
    ],
    shelfLife: 'Best within 1 month (Bellam Sunnundalu and Chekkalu keep the shortest); pickle and podi keep longer',
    allergens: ['Peanut', 'Sesame'],
    tags: ['gift', 'hamper', 'corporate', 'bulk', 'dussehra', 'diwali', 'veg'],
  },
  {
    name: 'Grand Celebration Hamper',
    slug: 'grand-celebration-hamper',
    price: 1899,
    isVeg: false,
    thumbnail: '/images/banners/banner_hampers.jpg',
    shortDescription: 'Our fullest hamper: three pickles including boneless chicken, pure cow ghee, two sweets and kaju mixture.',
    items: [
      ['Mango Pickle', '250g'], ['Gongura Pickle', '250g'], ['Chicken Boneless Pickle', '250g'],
      ['Pure Cow Ghee', '250g'], ['Kaju Burfi', '250g'], ['Dry Fruit Laddu', '250g'],
      ['Kaju Mixture', '250g'],
    ],
    shelfLife: 'Best within 2 weeks (Kaju Burfi keeps the shortest); refrigerate the chicken pickle after opening',
    allergens: ['Cashew', 'Dry fruits', 'Milk', 'Sesame'],
    tags: ['gift', 'hamper', 'diwali', 'dussehra', 'premium', 'non-veg', 'corporate'],
  },
];

const api = async (path, options = {}) => {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
};

// Look every item up in the live catalogue so the hamper's "bought separately"
// price is the real one, and a renamed or missing product stops the run.
const loadCatalogue = async () => {
  const { body } = await api('/products?limit=500');
  const byName = new Map((body.products || []).map(p => [p.name.trim().toLowerCase(), p]));
  return byName;
};

const buildProduct = (hamper, catalogue) => {
  let separately = 0;
  const lines = hamper.items.map(([name, weight]) => {
    const product = catalogue.get(name.toLowerCase());
    const variant = product?.variants?.find(v => v.weight === weight);
    if (!variant) throw new Error(`${hamper.name}: no "${name}" ${weight} in the catalogue`);
    separately += Number(variant.price);
    return `${name} (${weight})`;
  });

  const description = [
    hamper.shortDescription,
    '',
    `Inside this hamper: ${lines.join(', ')}.`,
    '',
    'Packed in festive gift packaging and ready to give. For corporate and bulk orders with your own message card, message us on WhatsApp at +91 91155 95959.',
  ].join('\n');

  return {
    separately,
    payload: {
      name: hamper.name,
      slug: hamper.slug,
      category: 'gift-hampers',
      description,
      shortDescription: hamper.shortDescription,
      images: [hamper.thumbnail],
      thumbnail: hamper.thumbnail,
      ingredients: lines,
      shelfLife: hamper.shelfLife,
      allergens: hamper.allergens,
      tags: hamper.tags,
      isVeg: hamper.isVeg,
      isFeatured: true,
      isActive: true,
      shippingType: 'both',
      variants: [{ weight: '1kg', price: hamper.price, mrp: separately, stock: 50, sku: hamper.slug.toUpperCase() }],
    },
  };
};

const login = async () => {
  const { ADMIN_EMAIL: email, ADMIN_PASSWORD: password } = process.env;
  if (!email || !password) throw new Error('Set ADMIN_EMAIL and ADMIN_PASSWORD to create the hampers.');
  const { status, body } = await api('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
  if (status !== 200 || !body.token) throw new Error(`Login failed: ${body.message || status}`);
  if (body.user?.role !== 'admin') throw new Error(`${email} is not an admin account.`);
  return body.token;
};

(async () => {
  console.log(`${APPLY ? 'Creating' : 'Preview of'} gift hampers on ${API_URL}\n`);
  const catalogue = await loadCatalogue();
  const built = HAMPERS.map(h => ({ hamper: h, ...buildProduct(h, catalogue) }));

  const token = APPLY ? await login() : null;

  for (const { hamper, separately, payload } of built) {
    const exists = (await api(`/products/${hamper.slug}`)).status === 200;
    const saving = separately - hamper.price;
    console.log(`${hamper.name}  ₹${hamper.price}  (₹${separately} separately, saves ₹${saving})`);
    console.log(`  ${payload.ingredients.join(', ')}`);

    if (exists) { console.log('  already exists, skipped\n'); continue; }
    if (saving <= 0) { console.log('  NOT created: hamper costs more than the items separately\n'); continue; }
    if (!APPLY) { console.log('  would be created\n'); continue; }

    const { status, body } = await api('/products', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    });
    console.log(status === 201 ? `  created (id ${body.product?.id})\n` : `  FAILED: ${body.message || status}\n`);
  }

  if (!APPLY) console.log('Nothing was changed. Re-run with --apply and admin credentials to create these.');
})().catch(err => { console.error(err.message); process.exit(1); });
