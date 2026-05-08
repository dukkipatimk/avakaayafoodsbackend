require('dotenv').config();
const sequelize = require('./config/db');
const { Product, ProductVariant, User } = require('./models');

const BASE = '/images/products/';

const mrp = (p) => Math.round(p * 1.2 / 5) * 5;

const v3 = (p250, p500, p1kg) => [
  { weight: '250g', price: p250, mrp: mrp(p250), stock: 150 },
  { weight: '500g', price: p500, mrp: mrp(p500), stock: 120 },
  { weight: '1kg',  price: p1kg, mrp: mrp(p1kg),  stock: 80  }
];

const v4 = (p100, p250, p500, p1kg) => [
  { weight: '100g', price: p100, mrp: mrp(p100), stock: 200 },
  { weight: '250g', price: p250, mrp: mrp(p250), stock: 180 },
  { weight: '500g', price: p500, mrp: mrp(p500), stock: 150 },
  { weight: '1kg',  price: p1kg, mrp: mrp(p1kg),  stock: 100 }
];

const products = [

  // ════════════════════════════════════════════════════════════
  //  VEG PICKLES  (24 products)
  // ════════════════════════════════════════════════════════════

  {
    name: 'Amla (Usiri) Pickle',
    slug: 'amla-usiri-pickle',
    shortDescription: 'Premium Andhra amla pickle — rich, bold and spicy.',
    description: 'One of the most premium pickle brands from Andhra Pradesh and Telangana. Loved for its rich, bold, and spicy flavor that reflects authentic Telugu taste. Prepared fresh daily in small batches. No chemicals or artificial preservatives.',
    category: 'pickles', subcategory: 'veg',
    thumbnail: `${BASE}2024/10/Amla-pickle-3_2_11zon-600x400.webp`,
    images: [
      `${BASE}2024/10/Amla-pickle-3_2_11zon-600x400.webp`,
      `${BASE}2024/10/Amla-pickle-1_4_11zon-600x400.webp`,
      `${BASE}2024/10/Amla-pickle-2_3_11zon-600x400.webp`
    ],
    variants: v3(140, 280, 560),
    ingredients: ['Amla (Indian Gooseberry)', 'Mustard Powder', 'Red Chilli', 'Cold-Pressed Oil', 'Salt', 'Turmeric'],
    shelfLife: '12 months unopened, 3 months after opening',
    tags: ['veg', 'amla', 'vitamin-c', 'no-preservatives'],
    isVeg: true, isFeatured: false, rating: 4.4, numReviews: 60, soldCount: 350
  },
  {
    name: 'Bellam Avakaaya',
    slug: 'bellam-avakaaya',
    shortDescription: 'Sweet mango pickle with jaggery — popular in coastal Andhra Pradesh.',
    description: 'Bellam Avakaya is a unique sweet mango pickle popular in the coastal regions of Andhra Pradesh. It combines juicy mangoes with jaggery, mustard seed powder, and mustard oil, delivering a perfect blend of sweet, sour, and spicy flavors.',
    category: 'pickles', subcategory: 'mango',
    thumbnail: `${BASE}2024/10/Sweet_Mango_pickle_pp.jpg`,
    images: [
      `${BASE}2024/10/Sweet_Mango_pickle_pp.jpg`,
      `${BASE}2024/10/Sweet_Mango_pickle_pd-600x837.jpg`
    ],
    variants: v3(155, 310, 620),
    ingredients: ['Juicy Cut Mangoes', 'Jaggery', 'Mustard Seed Powder', 'Mustard Oil'],
    shelfLife: '12 months unopened, 3 months after opening',
    tags: ['veg', 'mango', 'sweet-spicy', 'jaggery', 'coastal-andhra'],
    isVeg: true, isFeatured: true, rating: 4.7, numReviews: 95, soldCount: 620
  },
  {
    name: 'Brinjal Pickle',
    slug: 'brinjal-pickle',
    shortDescription: 'Traditional South Indian brinjal pickle — rich, tangy and spicy.',
    description: 'Brinjal Pickle is a flavorful and traditional South Indian delicacy. Made using fresh, tender brinjals, carefully selected for quality. Blended with a mix of authentic spices, tamarind, mustard seeds, and cold-pressed oils. Offers a rich, tangy, and spicy taste that pairs perfectly with rice, rotis, and snacks. Prepared using homemade methods to retain authentic Andhra flavors. No added preservatives — pure, homemade goodness in every bite.',
    category: 'pickles', subcategory: 'veg',
    thumbnail: `${BASE}2024/10/brinjal_pickle_pp.jpg`,
    images: [
      `${BASE}2024/10/brinjal_pickle_pp.jpg`,
      `${BASE}2024/10/brinjal_pickle_pd-600x837.jpg`
    ],
    variants: v3(140, 280, 560),
    ingredients: ['Fresh Brinjals', 'Spices', 'Tamarind', 'Mustard Seeds', 'Cold-Pressed Oils', 'Salt', 'Turmeric'],
    shelfLife: '6 months unopened, 2 months after opening (refrigerate)',
    tags: ['veg', 'brinjal', 'no-preservatives', 'homemade'],
    isVeg: true, isFeatured: false, rating: 4.4, numReviews: 72, soldCount: 410
  },
  {
    name: 'Cauli Flower Pickle',
    slug: 'cauli-flower-pickle',
    shortDescription: 'Crunchy cauliflower pickle — authentic Andhra style, small batch.',
    description: 'Authentic Andhra-style pickle featuring tender cauliflower florets, ensuring a crunchy texture in every bite. Combines traditional spices including mustard seeds, fenugreek, red chili powder, and turmeric with natural preservatives like lemon juice and cold-pressed oils. Prepared in small batches to maintain quality and authenticity.',
    category: 'pickles', subcategory: 'veg',
    thumbnail: `${BASE}2024/10/CAULI-FLOWER-600x600.jpg`,
    images: [
      `${BASE}2024/10/CAULI-FLOWER-600x600.jpg`,
      `${BASE}2024/10/CAULI-FLOWER.jpg`
    ],
    variants: v3(140, 280, 560),
    ingredients: ['Cauliflower Florets', 'Mustard Seeds', 'Fenugreek Seeds', 'Red Chili Powder', 'Turmeric', 'Salt', 'Lemon Juice', 'Groundnut or Sesame Oil'],
    shelfLife: '6 months unopened, 2 months after opening (refrigerate)',
    tags: ['veg', 'cauliflower', 'crunchy', 'small-batch'],
    isVeg: true, isFeatured: false, rating: 4.3, numReviews: 48, soldCount: 280
  },
  {
    name: 'Chikkudu Kaya Pickle',
    slug: 'chikkudu-kaya-pickle',
    shortDescription: 'Broad beans pickle crafted in traditional Andhra pickling style.',
    description: 'Crafted using traditional Andhra-style pickling techniques, delivering a bold and spicy taste. Made with tender broad beans ensuring a crunchy texture in every bite. Features a blend of red chili powder, mustard seeds, fenugreek seeds, turmeric, and salt with tamarind and cold-pressed oils like sesame oil as natural preservatives. Perfect accompaniment to hot rice, rotis, dosas. Prepared in small batches to maintain quality.',
    category: 'pickles', subcategory: 'veg',
    thumbnail: `${BASE}2024/10/CHIKKUDU-KAYA-PICKLE-600x600.jpg`,
    images: [
      `${BASE}2024/10/CHIKKUDU-KAYA-PICKLE-600x600.jpg`,
      `${BASE}2024/10/CHIKKUDU-KAYA-PICKLE.jpg`
    ],
    variants: v3(140, 280, 560),
    ingredients: ['Broad Beans (Chikkudu Kaya)', 'Red Chili Powder', 'Mustard Seeds', 'Fenugreek Seeds', 'Turmeric', 'Salt', 'Tamarind', 'Sesame Oil'],
    shelfLife: '6 months unopened, 2 months after opening (refrigerate)',
    tags: ['veg', 'broad-beans', 'small-batch'],
    isVeg: true, isFeatured: false, rating: 4.3, numReviews: 38, soldCount: 210
  },
  {
    name: 'Dondakaya Pickle',
    slug: 'dondakaya-pickle',
    shortDescription: 'Tender ivy gourd pickle with bold Andhra spicing.',
    description: 'Traditional Andhra-style pickling techniques with tender ivy gourd delivering a bold and spicy taste. Seasoned with a blend of mustard seeds, fenugreek seeds, red chili powder, turmeric, and salt. Uses cold-pressed oils like sesame oil as natural preservatives. Prepared in small batches to maintain quality and authenticity.',
    category: 'pickles', subcategory: 'veg',
    thumbnail: `${BASE}2024/10/dondakaya_pickle_pp.jpg`,
    images: [
      `${BASE}2024/10/dondakaya_pickle_pp.jpg`,
      `${BASE}2024/10/dondakaya_pickle_pd-600x837.jpg`,
      `${BASE}2024/10/dondakaya_pickle_pd.jpg`
    ],
    variants: v3(140, 280, 560),
    ingredients: ['Ivy Gourd (Dondakaya)', 'Mustard Seeds', 'Fenugreek Seeds', 'Red Chili Powder', 'Turmeric', 'Salt', 'Sesame Oil'],
    shelfLife: '6 months unopened, 2 months after opening (refrigerate)',
    tags: ['veg', 'dondakaya', 'ivy-gourd', 'small-batch'],
    isVeg: true, isFeatured: false, rating: 4.3, numReviews: 42, soldCount: 240
  },
  {
    name: 'Dosakaya Pickle',
    slug: 'dosakaya-pickle',
    shortDescription: 'Yellow cucumber pickle — tender, tangy and authentic Andhra.',
    description: 'Crafted using traditional Andhra-style pickling techniques. Made with tender yellow cucumbers (Dosakaya). Features a blend of mustard seeds, fenugreek seeds, red chili powder, turmeric, and salt. Utilizes cold-pressed oils like sesame oil. Prepared in small batches.',
    category: 'pickles', subcategory: 'veg',
    thumbnail: `${BASE}2024/10/Dosakai-Pickle-600x600.jpg`,
    images: [
      `${BASE}2024/10/Dosakai-Pickle-600x600.jpg`,
      `${BASE}2024/10/Dosakai-Pickle.jpg`
    ],
    variants: v3(140, 280, 560).map(v => ({ ...v, stock: 0 })),
    ingredients: ['Yellow Cucumber (Dosakaya)', 'Mustard Seeds', 'Fenugreek Seeds', 'Red Chili Powder', 'Turmeric', 'Salt', 'Sesame Oil'],
    shelfLife: '3 months unopened',
    tags: ['veg', 'dosakaya', 'yellow-cucumber', 'seasonal'],
    isVeg: true, isFeatured: false, isActive: false,
    rating: 4.4, numReviews: 35, soldCount: 190
  },
  {
    name: 'Drum Stick Pickle',
    slug: 'drum-stick-pickle',
    shortDescription: 'Bold and spicy drumstick pickle using traditional Andhra techniques.',
    description: 'Crafted using traditional Andhra-style pickling techniques, delivering a bold and spicy taste with tender drumsticks ensuring a crunchy texture in every bite. Made in small batches and available in 250g, 500g, and 1kg packs for convenient online ordering.',
    category: 'pickles', subcategory: 'veg',
    thumbnail: `${BASE}2024/10/drumstic_pickle_PP.jpg`,
    images: [
      `${BASE}2024/10/drumstic_pickle_PP.jpg`,
      `${BASE}2024/10/Drumstic_pickles_pd-600x837.jpg`
    ],
    variants: v3(155, 310, 620),
    ingredients: ['Drumsticks (Moringa Pods)', 'Mustard Seeds', 'Fenugreek Seeds', 'Red Chili Powder', 'Turmeric', 'Salt', 'Tamarind Pulp', 'Sesame Oil'],
    shelfLife: '6 months unopened, 2 months after opening (refrigerate)',
    tags: ['veg', 'drumstick', 'moringa', 'nutritious'],
    isVeg: true, isFeatured: false, rating: 4.4, numReviews: 44, soldCount: 260
  },
  {
    name: 'Garlic Pickle',
    slug: 'garlic-pickle',
    shortDescription: 'Bold, spicy and tangy garlic pickle in Andhra style.',
    description: 'Crafted using traditional Andhra-style pickling techniques, delivering a bold, spicy, and tangy taste with high-quality garlic cloves. Features a spice blend of mustard seeds, fenugreek seeds, red chili powder, turmeric, and salt. Prepared in small batches using cold-pressed sesame oil as a natural preservative. Pairs well with rice, rotis, dosas, and curd rice.',
    category: 'pickles', subcategory: 'veg',
    thumbnail: `${BASE}2024/10/garlic_pickle_pp.jpg`,
    images: [
      `${BASE}2024/10/garlic_pickle_pp.jpg`,
      `${BASE}2024/10/garlic_pickle_pd-600x837.jpg`
    ],
    variants: v3(140, 280, 560),
    ingredients: ['Garlic Cloves', 'Mustard Seeds', 'Fenugreek Seeds', 'Red Chili Powder', 'Turmeric', 'Salt', 'Sesame Oil'],
    shelfLife: '12 months unopened, 3 months after opening',
    tags: ['veg', 'garlic', 'bold', 'tangy'],
    isVeg: true, isFeatured: true, rating: 4.6, numReviews: 110, soldCount: 720
  },
  {
    name: 'Ginger Pickle',
    slug: 'ginger-pickle',
    shortDescription: 'Authentic Andhra ginger pickle with natural preservatives.',
    description: 'Authentic Andhra flavor using traditional Andhra-style pickling techniques. Crafted with fresh ingredients and a spice blend including mustard seeds, fenugreek, red chili powder, turmeric, and salt. Natural preservatives like lemon juice and cold-pressed oils are used without artificial additives. Available in multiple sizes for convenient online ordering.',
    category: 'pickles', subcategory: 'veg',
    thumbnail: `${BASE}2024/11/Ginger-pickle-14_1_11zon-600x400.webp`,
    images: [
      `${BASE}2024/11/Ginger-pickle-14_1_11zon-600x400.webp`,
      `${BASE}2024/11/Ginger-pickle-1_7_11zon-600x400.webp`,
      `${BASE}2024/11/Ginger-pickle-7_6_11zon-600x400.webp`,
      `${BASE}2024/11/Ginger-pickle-9_4_11zon-600x400.webp`,
      `${BASE}2024/11/Ginger-pickle-12_3_11zon-600x400.webp`,
      `${BASE}2024/11/Ginger-pickle-13_2_11zon-600x400.webp`
    ],
    variants: v3(140, 280, 560),
    ingredients: ['Ginger', 'Mustard Seeds', 'Fenugreek Seeds', 'Red Chili Powder', 'Turmeric', 'Salt', 'Lemon Juice', 'Cold-Pressed Sesame Oil'],
    shelfLife: '12 months unopened, 3 months after opening',
    tags: ['veg', 'ginger', 'digestive', 'no-preservatives'],
    isVeg: true, isFeatured: false, rating: 4.5, numReviews: 88, soldCount: 510
  },
  {
    name: 'Gongura Pandu Mirchi',
    slug: 'gongura-pandu-mirchi',
    shortDescription: 'Gongura and ripe red chillies — authentic Andhra tangy-spicy combo.',
    description: 'Authentic Andhra taste crafted using traditional pickling techniques. Fresh gongura leaves combined with ripe red chillies, seasoned with mustard seeds, fenugreek seeds, red chili powder, turmeric, and salt. Uses tamarind and cold-pressed sesame oil as natural preservatives. Prepared in small batches to maintain quality.',
    category: 'pickles', subcategory: 'gongura',
    thumbnail: `${BASE}2024/10/Pandu-Mirchi-Gongura-pickle-1_7_11zon-600x400.webp`,
    images: [
      `${BASE}2024/10/Pandu-Mirchi-Gongura-pickle-1_7_11zon-600x400.webp`,
      `${BASE}2024/10/Pandu-Mirchi-Gongura-pickle-18_1_11zon-600x400.webp`,
      `${BASE}2024/10/Pandu-Mirchi-Gongura-pickle-14_2_11zon-600x400.webp`,
      `${BASE}2024/10/Pandu-Mirchi-Gongura-pickle-10_3_11zon-600x400.webp`,
      `${BASE}2024/10/Pandu-Mirchi-Gongura-pickle-9_4_11zon-600x400.webp`,
      `${BASE}2024/10/Pandu-Mirchi-Gongura-pickle-3_6_11zon-600x400.webp`
    ],
    variants: v3(140, 280, 560),
    ingredients: ['Fresh Gongura Leaves', 'Ripe Red Chillies', 'Mustard Seeds', 'Fenugreek Seeds', 'Red Chili Powder', 'Turmeric', 'Salt', 'Tamarind', 'Cold-Pressed Sesame Oil'],
    shelfLife: '6 months unopened, 2 months after opening (refrigerate)',
    tags: ['veg', 'gongura', 'pandu-mirchi', 'spicy', 'tangy'],
    isVeg: true, isFeatured: false, rating: 4.5, numReviews: 76, soldCount: 440
  },
  {
    name: 'Gongura Pickle',
    slug: 'gongura-pickle',
    shortDescription: 'Bold and spicy gongura pickle — fresh sorrel leaves, small batch.',
    description: 'Crafted using traditional Andhra-style pickling techniques, delivering a bold and spicy taste with fresh gongura (sorrel) leaves providing a tangy, distinctive flavor. The pickle is prepared in small batches to maintain quality and serves as a versatile accompaniment to rice, rotis, dosas, and other meals.',
    category: 'pickles', subcategory: 'gongura',
    thumbnail: `${BASE}2024/10/gongura_pickle_pp.jpg`,
    images: [
      `${BASE}2024/10/gongura_pickle_pp.jpg`,
      `${BASE}2024/10/gongura_pickle_pd-600x837.jpg`
    ],
    variants: v3(140, 280, 560),
    ingredients: ['Gongura (Sorrel Leaves)', 'Mustard Seeds', 'Fenugreek Seeds', 'Red Chili Powder', 'Turmeric', 'Salt', 'Tamarind', 'Cold-Pressed Sesame Oil'],
    shelfLife: '6 months unopened, 2 months after opening (refrigerate)',
    tags: ['veg', 'gongura', 'telangana', 'popular', 'small-batch'],
    isVeg: true, isFeatured: true, rating: 4.7, numReviews: 189, soldCount: 1340
  },
  {
    name: 'Kakarakaya Pickle',
    slug: 'kakarakaya-pickle',
    shortDescription: 'Bitter gourd pickle — bold, spicy and authentic Andhra flavor.',
    description: 'Authentic Andhra flavor crafted using traditional pickling techniques with tender bitter gourd, delivering a bold and spicy taste. Seasoned with mustard seeds, fenugreek seeds, red chili powder, turmeric, and salt. Uses tamarind and cold-pressed oils like sesame oil as natural preservatives without artificial additives. Versatile for pairing with rice, rotis, dosas, or other meals. Prepared in small batches for authenticity.',
    category: 'pickles', subcategory: 'veg',
    thumbnail: `${BASE}2024/10/KAKARAKAYA-600x600.jpg`,
    images: [
      `${BASE}2024/10/KAKARAKAYA-600x600.jpg`,
      `${BASE}2024/10/KAKARAKAYA.jpg`
    ],
    variants: v3(140, 280, 560),
    ingredients: ['Bitter Gourd (Kakarakaya)', 'Mustard Seeds', 'Fenugreek Seeds', 'Red Chili Powder', 'Turmeric', 'Salt', 'Tamarind', 'Sesame Oil'],
    shelfLife: '6 months unopened, 2 months after opening (refrigerate)',
    tags: ['veg', 'bitter-gourd', 'kakarakaya', 'healthy'],
    isVeg: true, isFeatured: false, rating: 4.3, numReviews: 55, soldCount: 300
  },
  {
    name: 'Kothimeera Pickle',
    slug: 'kothimeera-pickle',
    shortDescription: 'Fresh coriander pickle — traditional Andhra style, fresh and spicy.',
    description: 'Prepared using traditional Andhra-style pickling methods, delivering a fresh, spicy, and tangy taste. Features fresh coriander leaves, perfect spice blends with mustard seeds and fenugreek, natural preservatives using cold-pressed oils, versatile pairing options with rice and rotis, and small-batch homemade preparation. Available in three sizes.',
    category: 'pickles', subcategory: 'veg',
    thumbnail: `${BASE}2024/10/KOTHIMERA-PICKLE-1-600x600.jpg`,
    images: [
      `${BASE}2024/10/KOTHIMERA-PICKLE-1-600x600.jpg`,
      `${BASE}2024/10/KOTHIMERA-PICKLE-1.jpg`
    ],
    variants: v3(140, 280, 560),
    ingredients: ['Fresh Coriander Leaves (Kothimeera)', 'Mustard Seeds', 'Fenugreek Seeds', 'Red Chili Powder', 'Turmeric', 'Salt', 'Sesame Oil'],
    shelfLife: '3 months unopened, refrigerate after opening',
    tags: ['veg', 'coriander', 'kothimeera', 'fresh', 'aromatic'],
    isVeg: true, isFeatured: false, rating: 4.4, numReviews: 50, soldCount: 290
  },
  {
    name: 'Lemon Pickle',
    slug: 'lemon-pickle',
    shortDescription: 'Authentic Andhra lemon pickle — fresh, thin-skinned lemons, small batch.',
    description: 'Lemon Pickle (Nimmakaya Pachadi) — authentic Andhra-style pickling with fresh, thin-skinned lemons. Traditional techniques, small-batch preparation, and natural preservation using cold-pressed sesame oil without artificial additives. Available in three sizes suited for different household needs.',
    category: 'pickles', subcategory: 'lemon',
    thumbnail: `${BASE}2024/10/Lemon_pickle_pp.jpg`,
    images: [
      `${BASE}2024/10/Lemon_pickle_pp.jpg`
    ],
    variants: v3(140, 280, 560),
    ingredients: ['Fresh Lemons', 'Mustard Seeds', 'Fenugreek Seeds', 'Red Chili Powder', 'Turmeric', 'Salt', 'Cold-Pressed Sesame Oil'],
    shelfLife: '18 months unopened, 6 months after opening',
    tags: ['veg', 'lemon', 'nimmakaya', 'tangy', 'digestive'],
    isVeg: true, isFeatured: false, rating: 4.4, numReviews: 87, soldCount: 620
  },
  {
    name: 'Magaya Pickle',
    slug: 'magaya-pickle',
    shortDescription: 'Sun-dried mango pickle — a cherished traditional delicacy from Andhra Pradesh.',
    description: 'Magaya is a traditional pickle from Andhra Pradesh, cherished for its unique preparation involving sun-dried mango slices. Raw mangoes are peeled, sliced, and sun-dried. Seasoned with mustard seeds, fenugreek seeds, red chili powder, turmeric, and salt. Uses cold-pressed sesame oil as a natural preservative without artificial additives. Available in three sizes. Prepared in small batches to maintain authenticity.',
    category: 'pickles', subcategory: 'mango',
    thumbnail: `${BASE}2024/10/MAGAYA-PICKEL-600x600.jpg`,
    images: [
      `${BASE}2024/10/MAGAYA-PICKEL-600x600.jpg`,
      `${BASE}2024/10/MAGAYA-PICKEL.jpg`
    ],
    variants: v3(155, 310, 620),
    ingredients: ['Raw Mango (Sun-Dried)', 'Mustard Seeds', 'Fenugreek Seeds', 'Red Chili Powder', 'Turmeric', 'Salt', 'Sesame Oil'],
    shelfLife: '12 months unopened, 3 months after opening',
    tags: ['veg', 'mango', 'sun-dried', 'traditional', 'andhra-pradesh'],
    isVeg: true, isFeatured: true, rating: 4.6, numReviews: 102, soldCount: 680
  },
  {
    name: 'Mango Pickle',
    slug: 'mango-pickle',
    shortDescription: 'Bold and spicy raw mango pickle — the classic Andhra Avakaya.',
    description: 'Crafted using traditional Andhra-style pickling techniques, delivering a bold and spicy taste. Made with raw, sour mangoes for a tangy flavor. Features mustard seeds, fenugreek seeds, red chili powder, turmeric, and salt, preserved with cold-pressed sesame oil. Available in 250g, 500g, and 1kg sizes.',
    category: 'pickles', subcategory: 'mango',
    thumbnail: `${BASE}2024/10/Mango-pickle-1_7_11zon-600x400.webp`,
    images: [
      `${BASE}2024/10/Mango-pickle-1_7_11zon-600x400.webp`,
      `${BASE}2024/10/Mango-pickle-7_1_11zon-600x400.webp`,
      `${BASE}2024/10/Mango-pickle-6_2_11zon-600x400.webp`,
      `${BASE}2024/10/Mango-pickle-5_3_11zon-600x400.webp`,
      `${BASE}2024/10/Mango-pickle-3_5_11zon-600x400.webp`,
      `${BASE}2024/10/Mango-pickle-2_6_11zon-600x400.webp`
    ],
    variants: v3(140, 280, 560),
    ingredients: ['Raw Sour Mangoes', 'Mustard Seeds', 'Fenugreek Seeds', 'Red Chili Powder', 'Turmeric', 'Salt', 'Sesame Oil'],
    shelfLife: '12 months unopened, 3 months after opening',
    tags: ['veg', 'mango', 'avakaya', 'classic', 'spicy'],
    isVeg: true, isFeatured: true, rating: 4.8, numReviews: 245, soldCount: 1820
  },
  {
    name: 'Mixed Veg Pickle',
    slug: 'mixed-veg-pickle',
    shortDescription: 'Mixed vegetable pickle with traditional Andhra spice blend.',
    description: 'Mixed Vegetable Pickle — crafted using traditional Andhra-style pickling techniques with fresh vegetables, mustard seeds, fenugreek seeds, red chili powder, turmeric, and salt. Made in small batches with cold-pressed sesame oil as a natural preservative. Available in 250g, 500g, and 1kg sizes for pairing with rice, rotis, and dosas.',
    category: 'pickles', subcategory: 'veg',
    thumbnail: `${BASE}2024/10/MIXED-VEG-600x600.jpg`,
    images: [
      `${BASE}2024/10/MIXED-VEG-600x600.jpg`,
      `${BASE}2024/10/MIXED-VEG.jpg`
    ],
    variants: v3(140, 280, 560),
    ingredients: ['Mixed Vegetables', 'Mustard Seeds', 'Fenugreek Seeds', 'Red Chili Powder', 'Turmeric', 'Salt', 'Cold-Pressed Sesame Oil'],
    shelfLife: '6 months unopened, 2 months after opening (refrigerate)',
    tags: ['veg', 'mixed-veg', 'small-batch'],
    isVeg: true, isFeatured: false, rating: 4.3, numReviews: 45, soldCount: 270
  },
  {
    name: 'Nuvvula Avakaaya',
    slug: 'nuvvula-avakaaya',
    shortDescription: 'Raw mango pickle with roasted sesame seeds — nutty, bold and spicy.',
    description: 'Crafted using traditional Andhra-style pickling techniques, delivering a bold and spicy taste with fresh raw sour mangoes for tangy flavor. Incorporates roasted sesame seeds (nuvvulu) for a rich, nutty flavor and unique texture. Seasoned with mustard seeds, fenugreek seeds, red chili powder, turmeric, and salt. Uses cold-pressed sesame oil without artificial preservatives. Small-batch preparation offers homemade goodness suitable for rice, rotis, dosas, or meal accompaniment.',
    category: 'pickles', subcategory: 'mango',
    thumbnail: `${BASE}2024/10/NUVVULA-AVAKAYA-600x600.jpg`,
    images: [
      `${BASE}2024/10/NUVVULA-AVAKAYA-600x600.jpg`,
      `${BASE}2024/10/NUVVULA-AVAKAYA.jpg`
    ],
    variants: v3(140, 280, 560),
    ingredients: ['Raw Sour Mangoes', 'Roasted Sesame Seeds (Nuvvulu)', 'Mustard Seeds', 'Fenugreek Seeds', 'Red Chili Powder', 'Turmeric', 'Salt', 'Sesame Oil'],
    shelfLife: '12 months unopened, 3 months after opening',
    tags: ['veg', 'mango', 'sesame', 'nuvvula', 'nutty'],
    isVeg: true, isFeatured: false, rating: 4.5, numReviews: 68, soldCount: 420
  },
  {
    name: 'Pandu Mirchi Pickle',
    slug: 'pandu-mirchi-pickle',
    shortDescription: 'Ripe red chilli pickle — bold, spicy and tangy.',
    description: 'Crafted using traditional Andhra-style pickling techniques, delivering a bold and spicy taste with ripe red chillies. Features a blend of mustard seeds, fenugreek seeds, red chili powder, turmeric, and salt, offering a rich and tangy flavor profile. Uses cold-pressed oils like sesame oil without artificial preservatives. Prepared in small batches to maintain quality. Pairs well with rice, rotis, and dosas.',
    category: 'pickles', subcategory: 'veg',
    thumbnail: `${BASE}2024/10/PANDU-MIRCHI-600x600.jpg`,
    images: [
      `${BASE}2024/10/PANDU-MIRCHI-600x600.jpg`,
      `${BASE}2024/10/PANDU-MIRCHI.jpg`
    ],
    variants: v3(140, 280, 560),
    ingredients: ['Ripe Red Chillies (Pandu Mirchi)', 'Mustard Seeds', 'Fenugreek Seeds', 'Red Chili Powder', 'Turmeric', 'Salt', 'Sesame Oil'],
    shelfLife: '6 months unopened, 2 months after opening (refrigerate)',
    tags: ['veg', 'chilli', 'pandu-mirchi', 'spicy', 'bold'],
    isVeg: true, isFeatured: false, rating: 4.5, numReviews: 62, soldCount: 380
  },
  {
    name: 'Pulihora Paste',
    slug: 'pulihora-paste',
    shortDescription: 'Authentic Andhra tamarind rice paste — ready-to-use convenience.',
    description: 'Authentic Andhra Flavor, crafted using traditional Andhra-style pickling techniques. Features fresh tamarind pulp, seasoned with a blend of mustard seeds, fenugreek seeds, red chili powder, turmeric, and salt. Uses cold-pressed sesame oil. Small-batch preparation. Suitable for pairing with rice, rotis, and dosas.',
    category: 'pickles', subcategory: 'veg',
    thumbnail: `${BASE}2024/10/PULIHORA-PASTE-600x600.jpg`,
    images: [
      `${BASE}2024/10/PULIHORA-PASTE-600x600.jpg`
    ],
    variants: v3(140, 280, 560),
    ingredients: ['Fresh Tamarind Pulp', 'Mustard Seeds', 'Fenugreek Seeds', 'Red Chili Powder', 'Turmeric', 'Salt', 'Sesame Oil'],
    shelfLife: '6 months unopened, 2 months after opening (refrigerate)',
    tags: ['veg', 'pulihora', 'tamarind', 'paste', 'convenience'],
    isVeg: true, isFeatured: false, rating: 4.4, numReviews: 55, soldCount: 320
  },
  {
    name: 'Tamarind Pickle',
    slug: 'tamarind-pickle',
    shortDescription: 'Authentic Andhra tamarind pickle with traditional spice blends.',
    description: 'Authentic Andhra-style pickle featuring fresh, organically picked tamarind with traditional spice blends including mustard seeds, fenugreek seeds, red chili powder, turmeric, and salt. Uses cold-pressed sesame oil as a natural preservative. Prepared in small batches to maintain quality.',
    category: 'pickles', subcategory: 'veg',
    thumbnail: `${BASE}2024/10/TAMARIND-PICKLE-1-600x600.jpg`,
    images: [
      `${BASE}2024/10/TAMARIND-PICKLE-1-600x600.jpg`,
      `${BASE}2024/10/TAMARIND-PICKLE-1.jpg`
    ],
    variants: v3(140, 280, 560),
    ingredients: ['Fresh Tamarind', 'Mustard Seeds', 'Fenugreek Seeds', 'Red Chili Powder', 'Turmeric', 'Salt', 'Sesame Oil'],
    shelfLife: '12 months unopened, 3 months after opening',
    tags: ['veg', 'tamarind', 'tangy', 'traditional'],
    isVeg: true, isFeatured: false, rating: 4.3, numReviews: 48, soldCount: 280
  },
  {
    name: 'Tomato Pickle',
    slug: 'tomato-pickle',
    shortDescription: 'Bold and spicy tomato pickle with ripe tomatoes — Andhra style.',
    description: 'Crafted using traditional Andhra-style pickling techniques, delivering a bold and spicy taste made with ripe tomatoes, ensuring a tangy and distinctive flavor in every bite. Features a blend of mustard seeds, fenugreek seeds, red chili powder, turmeric, and salt. Utilizes cold-pressed oils like sesame oil to enhance taste and shelf life without artificial preservatives. Comes in small batches and pairs well with hot rice, rotis, dosas, or as a flavorful side to any meal.',
    category: 'pickles', subcategory: 'veg',
    thumbnail: `${BASE}2024/10/Tomato-pickle-5_2_11zon-600x400.webp`,
    images: [
      `${BASE}2024/10/Tomato-pickle-5_2_11zon-600x400.webp`,
      `${BASE}2024/10/Tomato-pickle-1_5_11zon-600x400.webp`,
      `${BASE}2024/10/Tomato-pickle-3_4_11zon-600x400.webp`,
      `${BASE}2024/10/Tomato-pickle-4_3_11zon-600x400.webp`,
      `${BASE}2024/10/Tomato-pickle-7_1_11zon-600x400.webp`
    ],
    variants: v3(140, 280, 560),
    ingredients: ['Ripe Tomatoes', 'Mustard Seeds', 'Fenugreek Seeds', 'Red Chili Powder', 'Turmeric', 'Salt', 'Sesame Oil'],
    shelfLife: '6 months unopened, 2 months after opening (refrigerate)',
    tags: ['veg', 'tomato', 'tangy', 'small-batch'],
    isVeg: true, isFeatured: false, rating: 4.5, numReviews: 143, soldCount: 890
  },
  {
    name: 'Ulavachaaru Instant Mix',
    slug: 'ulavachaaru-instant-mix',
    shortDescription: 'Authentic Andhra horse gram rasam mix — ready in minutes at home.',
    description: 'Authentic Andhra taste at home with convenient instant mix preparation. Made from premium horse gram with rich, earthy flavor just like the original recipe. Simply add water and simmer. Perfect with rice and ghee. No preservatives. Fresh, natural ingredients. Inspired by traditional Ulavachaaru paste recipe capturing homely, soulful taste.',
    category: 'pickles', subcategory: 'veg',
    thumbnail: `${BASE}2025/06/cutout-bg-600x849.jpg`,
    images: [
      `${BASE}2025/06/cutout-bg-600x849.jpg`,
      `${BASE}2025/06/cutout-bg.jpg`
    ],
    variants: v3(100, 200, 400),
    ingredients: ['Horse Gram (Ulava)', 'Natural Spices', 'No Preservatives'],
    shelfLife: '6 months in airtight container',
    tags: ['veg', 'ulavachaaru', 'rasam', 'instant', 'horse-gram', 'no-preservatives'],
    isVeg: true, isFeatured: true, rating: 4.7, numReviews: 98, soldCount: 640
  },

  // ════════════════════════════════════════════════════════════
  //  NON-VEG PICKLES  (12 products)
  // ════════════════════════════════════════════════════════════

  {
    name: 'Apollo Fish Pickle',
    slug: 'apollo-fish-pickle',
    shortDescription: 'Traditional Apollo fish pickle — bold and spicy Andhra flavour.',
    description: 'Traditional Apollo Fish Pickle made with a rich blend of spices, bringing the bold and spicy taste of Andhra cuisine. Premium quality fish, carefully pickled under hygienic conditions, available in multiple quantities for delivery to areas like Hyderabad and Vijayawada.',
    category: 'pickles', subcategory: 'non-veg',
    thumbnail: `${BASE}2024/10/apollo_fish-1-1-600x600.jpg`,
    images: [
      `${BASE}2024/10/apollo_fish-1-1-600x600.jpg`,
      `${BASE}2024/10/apollo_fish-1-3-600x600.jpg`,
      `${BASE}2024/10/apollo_fish-2-1-600x600.jpg`,
      `${BASE}2024/10/apollo_fish-3-1-600x600.jpg`
    ],
    variants: v3(425, 850, 1700),
    ingredients: ['Fish', 'Red Chili', 'Ginger', 'Garlic', 'Pepper', 'Aromatic Spices', 'Oil', 'Salt'],
    shelfLife: '3 months unopened, refrigerate after opening',
    tags: ['non-veg', 'fish', 'apollo', 'spicy'],
    isVeg: false, isFeatured: false, rating: 4.5, numReviews: 65, soldCount: 390
  },
  {
    name: 'Chicken Boneless Pickle',
    slug: 'chicken-boneless-pickle',
    shortDescription: 'Tender boneless chicken with authentic Andhra spices.',
    description: 'Tender Boneless Chicken: Crafted using high-quality, boneless chicken pieces infused with authentic Andhra spices. Versatile pairing options with rice, rotis, or as a side dish. Multiple quantity selections available. Hygienic preparation and prompt home delivery to Hyderabad and Vijayawada. Suitable as a gift.',
    category: 'pickles', subcategory: 'non-veg',
    thumbnail: `${BASE}2024/10/Avakaaya-19-600x400.webp`,
    images: [
      `${BASE}2024/10/Avakaaya-19-600x400.webp`,
      `${BASE}2024/10/Avakaaya-16-600x400.webp`,
      `${BASE}2024/10/Avakaaya-1-600x400.webp`,
      `${BASE}2024/10/Avakaaya-18-600x400.webp`,
      `${BASE}2024/10/Avakaaya-17-600x400.webp`
    ],
    variants: v3(350, 700, 1400),
    ingredients: ['Boneless Chicken', 'Andhra Spices', 'Ginger', 'Garlic', 'Red Chili', 'Oil', 'Salt'],
    shelfLife: '3 months unopened, refrigerate after opening',
    tags: ['non-veg', 'chicken', 'boneless', 'spicy'],
    isVeg: false, isFeatured: false, rating: 4.7, numReviews: 130, soldCount: 820
  },
  {
    name: 'Chicken Pickle',
    slug: 'chicken-pickle',
    shortDescription: 'Traditional Andhra chicken pickle — rich, spicy, mouth-watering.',
    description: 'Prepared in traditional Andhra style, offering a rich and spicy taste with fresh, high-quality chicken pieces. Features a blend of aromatic spices, delivering a mouth-watering balance of heat and tanginess. Available in multiple sizes, prepared under strict hygiene standards, with efficient delivery services to locations including Hyderabad and Vijayawada. Suitable as a gift option.',
    category: 'pickles', subcategory: 'non-veg',
    thumbnail: `${BASE}2024/10/chicken-1-1-600x600.jpg`,
    images: [
      `${BASE}2024/10/chicken-1-1-600x600.jpg`,
      `${BASE}2024/10/chicken-2-600x600.jpg`
    ],
    variants: v3(275, 550, 1100),
    ingredients: ['Chicken', 'Aromatic Spices', 'Ginger', 'Garlic', 'Red Chili', 'Oil', 'Salt'],
    shelfLife: '3 months unopened, refrigerate after opening',
    tags: ['non-veg', 'chicken', 'bestseller', 'traditional'],
    isVeg: false, isFeatured: true, rating: 4.9, numReviews: 312, soldCount: 2100
  },
  {
    name: 'Crab Pickle',
    slug: 'crab-pickle',
    shortDescription: 'Authentic Andhra crab pickle — fresh crab with aromatic spices.',
    description: 'Authentic Andhra Flavor prepared in traditional style with fresh, high-quality crab meat and aromatic spices. Offered in multiple sizes, prepared under hygiene standards, with prompt delivery to Hyderabad and Vijayawada. Ideal for Gifting to share Andhra Pradesh flavors.',
    category: 'pickles', subcategory: 'non-veg',
    thumbnail: `${BASE}2024/10/Crab_pickle-600x600.jpg`,
    images: [
      `${BASE}2024/10/Crab_pickle-600x600.jpg`,
      `${BASE}2024/10/Crab_pickle.jpg`
    ],
    variants: v3(425, 850, 1700),
    ingredients: ['Crab Meat', 'Aromatic Spices', 'Ginger', 'Garlic', 'Red Chili', 'Oil', 'Salt'],
    shelfLife: '2 months unopened, refrigerate after opening',
    tags: ['non-veg', 'crab', 'seafood', 'coastal-andhra'],
    isVeg: false, isFeatured: false, rating: 4.6, numReviews: 78, soldCount: 450
  },
  {
    name: 'Gongura Chicken Pickle',
    slug: 'gongura-chicken-pickle',
    shortDescription: 'Tender chicken with tangy gongura — perfect heat and tanginess.',
    description: 'Combines tender chicken pieces with the tangy taste of Gongura (sorrel leaves). Prepared using fresh, halal-cut chicken with aromatic spices and Gongura, offering a mouth-watering balance of heat and tanginess. Available in 250g, 500g, and 1kg sizes with delivery to Hyderabad and Vijayawada.',
    category: 'pickles', subcategory: 'non-veg',
    thumbnail: `${BASE}2024/10/gongurachicken-1-600x600.jpg`,
    images: [
      `${BASE}2024/10/gongurachicken-1-600x600.jpg`,
      `${BASE}2024/10/gongura_chicken-1-600x600.jpg`,
      `${BASE}2024/10/gongura_chicken-2-600x600.jpg`,
      `${BASE}2024/10/gongura_chicken-3-600x600.jpg`
    ],
    variants: v3(375, 750, 1500),
    ingredients: ['Chicken (Halal)', 'Gongura (Sorrel Leaves)', 'Aromatic Spices', 'Ginger', 'Garlic', 'Oil', 'Salt'],
    shelfLife: '3 months unopened, refrigerate after opening',
    tags: ['non-veg', 'chicken', 'gongura', 'popular'],
    isVeg: false, isFeatured: true, rating: 4.8, numReviews: 158, soldCount: 980
  },
  {
    name: 'Gongura Prawns Pickle',
    slug: 'gongura-prawns-pickle',
    shortDescription: 'Succulent prawns with tangy gongura — mouth-watering Andhra pickle.',
    description: 'A traditional Andhra-style pickle combining succulent prawns with the tangy flavor of Gongura (sorrel leaves). Crafted with premium quality ingredients and aromatic spices. Available in multiple quantities with hygienic preparation and delivery to Hyderabad and Vijayawada.',
    category: 'pickles', subcategory: 'non-veg',
    thumbnail: `${BASE}2024/10/gongura_pran-2-600x600.jpg`,
    images: [
      `${BASE}2024/10/gongura_pran-2-600x600.jpg`,
      `${BASE}2024/10/gongura_pran-3-600x600.jpg`,
      `${BASE}2024/10/gongura_pran-1-600x600.jpg`
    ],
    variants: v3(490, 980, 1960),
    ingredients: ['Prawns', 'Gongura (Sorrel Leaves)', 'Aromatic Spices', 'Ginger', 'Garlic', 'Oil', 'Salt'],
    shelfLife: '3 months unopened, refrigerate after opening',
    tags: ['non-veg', 'prawns', 'gongura', 'seafood'],
    isVeg: false, isFeatured: false, rating: 4.7, numReviews: 95, soldCount: 580
  },
  {
    name: 'Kaju Chicken Pickle',
    slug: 'kaju-chicken-pickle',
    shortDescription: 'Tender chicken with cashew nuts — heat, nuttiness and Andhra spice.',
    description: 'Authentic Andhra-style pickle combining tender chicken pieces with the rich crunch of cashew nuts. Crafted using premium ingredients and aromatic spices. The product emphasizes hygienic preparation, available in multiple sizes, and suitable for gifting. Delivers a mouth-watering balance of heat and nuttiness.',
    category: 'pickles', subcategory: 'non-veg',
    thumbnail: `${BASE}2024/10/chicken-2-600x600.jpg`,
    images: [
      `${BASE}2024/10/chicken-2-600x600.jpg`,
      `${BASE}2024/10/chicken-1-1-600x600.jpg`
    ],
    variants: v3(375, 750, 1500),
    ingredients: ['Chicken', 'Cashew Nuts (Kaju)', 'Aromatic Spices', 'Ginger', 'Garlic', 'Oil', 'Salt'],
    shelfLife: '3 months unopened, refrigerate after opening',
    tags: ['non-veg', 'chicken', 'cashew', 'premium'],
    isVeg: false, isFeatured: false, rating: 4.7, numReviews: 88, soldCount: 520
  },
  {
    name: 'Korameenu Fish Pickle',
    slug: 'korameenu-fish-pickle',
    shortDescription: 'Korameenu (Murrel fish) pickle — tender, rich and spicy Andhra style.',
    description: 'Prepared in traditional Andhra style, offering a rich and spicy taste that complements various meals. Crafted using fresh, high-quality Korameenu (Murrel) fish to ensure a tender and flavorful experience. Infused with a blend of aromatic spices, delivering a mouth-watering balance of heat and tanginess. Offered in 250g, 500g, and 1kg packaging sizes. Prepared under strict hygiene standards to ensure freshness and quality in every jar.',
    category: 'pickles', subcategory: 'non-veg',
    thumbnail: `${BASE}2024/10/Avakaaya-11-600x400.webp`,
    images: [
      `${BASE}2024/10/Avakaaya-11-600x400.webp`,
      `${BASE}2024/10/Avakaaya-9-600x400.webp`,
      `${BASE}2024/10/Avakaaya-10-600x400.webp`
    ],
    variants: v3(425, 850, 1700),
    ingredients: ['Korameenu (Murrel Fish)', 'Aromatic Spices', 'Ginger', 'Garlic', 'Red Chili', 'Oil', 'Salt'],
    shelfLife: '3 months unopened, refrigerate after opening',
    tags: ['non-veg', 'fish', 'korameenu', 'murrel', 'regional'],
    isVeg: false, isFeatured: false, rating: 4.6, numReviews: 72, soldCount: 420
  },
  {
    name: 'Mutton Boneless Pickle',
    slug: 'mutton-boneless-pickle',
    shortDescription: 'Rich and spicy boneless mutton pickle — crafted in Andhra tradition.',
    description: 'Crafted in traditional Andhra style, this pickle offers a rich and spicy taste that complements various meals. Features premium quality boneless mutton with aromatic spices, multiple packaging options (250g, 500g, 1kg), hygienic preparation, and home delivery to locations including Hyderabad and Vijayawada.',
    category: 'pickles', subcategory: 'non-veg',
    thumbnail: `${BASE}2024/10/Avakaaya-4-600x400.webp`,
    images: [
      `${BASE}2024/10/Avakaaya-4-600x400.webp`,
      `${BASE}2024/10/Avakaaya-3-600x400.webp`
    ],
    variants: v3(475, 950, 1900),
    ingredients: ['Boneless Mutton', 'Aromatic Spices', 'Ginger', 'Garlic', 'Red Chili', 'Oil', 'Salt'],
    shelfLife: '3 months unopened, refrigerate after opening',
    tags: ['non-veg', 'mutton', 'bestseller', 'premium'],
    isVeg: false, isFeatured: true, rating: 4.9, numReviews: 205, soldCount: 1400
  },
  {
    name: 'Natu Kodi Pickle',
    slug: 'natu-kodi-pickle',
    shortDescription: 'Country chicken (Natu Kodi) pickle — authentic Andhra delicacy.',
    description: 'Authentic Andhra Delicacy: A traditional Andhra-style pickle made with country chicken (Natu Kodi), offering a rich and spicy taste that complements various meals. Crafted using fresh, high-quality Natu Kodi to ensure tenderness and rich flavor in every bite. Infused with a blend of aromatic spices, delivering a mouth-watering balance of heat and tanginess. Prepared under strict hygiene standards to ensure freshness and quality in every jar. Efficient delivery services to locations including Hyderabad and Vijayawada.',
    category: 'pickles', subcategory: 'non-veg',
    thumbnail: `${BASE}2024/10/Avakaaya-7-600x400.webp`,
    images: [
      `${BASE}2024/10/Avakaaya-7-600x400.webp`,
      `${BASE}2024/10/Avakaaya-8-600x400.webp`
    ],
    variants: v3(475, 950, 1900),
    ingredients: ['Country Chicken (Natu Kodi)', 'Aromatic Spices', 'Ginger', 'Garlic', 'Red Chili', 'Oil', 'Salt'],
    shelfLife: '3 months unopened, refrigerate after opening',
    tags: ['non-veg', 'chicken', 'country-chicken', 'natu-kodi', 'rustic'],
    isVeg: false, isFeatured: false, rating: 4.8, numReviews: 142, soldCount: 880
  },
  {
    name: 'Nethallu Pickle',
    slug: 'nethallu-pickle',
    shortDescription: 'Traditional Andhra anchovy pickle — rich, spicy and full of flavour.',
    description: 'A traditional Andhra-style pickle made with Nethallu (Anchovies), offering a rich and spicy taste that complements various meals. Features fresh, high-quality fish infused with a blend of aromatic spices, delivering a mouth-watering balance of heat and tanginess. Prepared under strict hygiene standards and offered in multiple packaging sizes with efficient delivery services.',
    category: 'pickles', subcategory: 'non-veg',
    thumbnail: `${BASE}2024/10/NETHALLU-PICKLE-600x600.jpg`,
    images: [
      `${BASE}2024/10/NETHALLU-PICKLE-600x600.jpg`,
      `${BASE}2024/10/NETHALLU-PICKLE.jpg`
    ],
    variants: v3(325, 650, 1300),
    ingredients: ['Nethallu (Anchovies)', 'Aromatic Spices', 'Ginger', 'Garlic', 'Red Chili', 'Oil', 'Salt'],
    shelfLife: '6 months unopened, refrigerate after opening',
    tags: ['non-veg', 'fish', 'anchovy', 'coastal'],
    isVeg: false, isFeatured: false, rating: 4.5, numReviews: 68, soldCount: 400
  },
  {
    name: 'Prawns Pickle',
    slug: 'prawns-pickle',
    shortDescription: 'Rich and spicy Andhra prawn pickle — Best Seller.',
    description: 'Authentic Andhra Flavor: Crafted in traditional Andhra style, this pickle offers a rich and spicy taste that complements various meals. Premium Quality Prawns: Prepared using fresh, high-quality prawns to ensure tenderness and rich flavor in every bite. Infused with a blend of aromatic spices, delivering a mouth-watering balance of heat and tanginess. Offered in 250g, 500g, and 1kg packaging sizes. Prepared under strict hygiene standards to ensure freshness and quality. Best Seller.',
    category: 'pickles', subcategory: 'non-veg',
    thumbnail: `${BASE}2024/10/Avakaaya-15-600x400.webp`,
    images: [
      `${BASE}2024/10/Avakaaya-15-600x400.webp`,
      `${BASE}2024/10/Avakaaya-12-600x400.webp`,
      `${BASE}2024/10/Avakaaya-14-600x400.webp`
    ],
    variants: v3(475, 950, 1900),
    ingredients: ['Prawns', 'Aromatic Spices', 'Ginger', 'Garlic', 'Red Chili', 'Oil', 'Salt'],
    shelfLife: '3 months unopened, refrigerate after opening',
    tags: ['non-veg', 'prawns', 'seafood', 'bestseller'],
    isVeg: false, isFeatured: true, rating: 4.6, numReviews: 98, soldCount: 560
  },

  // ════════════════════════════════════════════════════════════
  //  POWDERS / KARAM  (14 products)
  // ════════════════════════════════════════════════════════════

  {
    name: 'Avisaginjala Karam',
    slug: 'avisaginjala-karam',
    shortDescription: 'Roasted flaxseed spice powder — rich, nutty and omega-3 rich.',
    description: 'A time-honored spice powder made from roasted flaxseeds (avisaginjalu), delivering a rich and nutty flavor that complements various meals. Crafted using fresh, high-quality flaxseeds rich in fiber and omega-3 fatty acids, blended with aromatic spices. Made under strict hygiene standards and available in multiple package sizes.',
    category: 'powders', subcategory: 'karam',
    thumbnail: `${BASE}2024/10/AVISAGINJALA-KARAM-600x600.jpg`,
    images: [
      `${BASE}2024/10/AVISAGINJALA-KARAM-600x600.jpg`,
      `${BASE}2024/10/AVISAGINJALA-KARAM.jpg`
    ],
    variants: v4(65, 162, 325, 650),
    ingredients: ['Roasted Flaxseeds (Avisaginjalu)', 'Red Chili', 'Garlic', 'Cumin', 'Salt'],
    shelfLife: '6 months in airtight container',
    tags: ['powder', 'flaxseed', 'omega3', 'healthy', 'veg'],
    isVeg: true, isFeatured: false, rating: 4.5, numReviews: 60, soldCount: 380
  },
  {
    name: 'Idli Karam',
    slug: 'idli-karam',
    shortDescription: 'Specially crafted spice powder to enhance the flavor of idlis.',
    description: 'Idly Karam is a specially crafted spice powder designed to enhance the flavor of your idlis, offering a perfect balance of heat and tanginess. Made from premium-quality spices, versatile for idlis, dosas, rice, and vegetables, available in multiple sizes, prepared under strict hygiene standards, and delivered fresh to your doorstep.',
    category: 'powders', subcategory: 'karam',
    thumbnail: `${BASE}2024/10/IDLY-KARAM-600x600.jpg`,
    images: [
      `${BASE}2024/10/IDLY-KARAM-600x600.jpg`,
      `${BASE}2024/10/IDLY-KARAM.jpg`
    ],
    variants: v4(65, 162, 325, 650),
    ingredients: ['Premium Quality Spices', 'Urad Dal', 'Chana Dal', 'Red Chili', 'Sesame Seeds', 'Curry Leaves', 'Salt'],
    shelfLife: '6 months in airtight container',
    tags: ['powder', 'idli', 'dosa', 'veg'],
    isVeg: true, isFeatured: false, rating: 4.6, numReviews: 95, soldCount: 600
  },
  {
    name: 'Kandhi Powder',
    slug: 'kandhi-powder',
    shortDescription: 'Roasted dal spice powder — nutty, rich and nourishing.',
    description: 'A time-honored spice powder made from roasted dals and hand-selected spices, delivering a rich and nutty flavor suitable for pairing with rice, ghee, idlis, dosas, or vegetable seasoning. Nutrient-rich ingredients, versatile usage, and hygienic preparation with prompt home delivery.',
    category: 'powders', subcategory: 'dal-powder',
    thumbnail: `${BASE}2024/10/kandipodi-600x600.jpg`,
    images: [
      `${BASE}2024/10/kandipodi-600x600.jpg`,
      `${BASE}2024/10/kandipodi.jpg`
    ],
    variants: v4(65, 162, 325, 650),
    ingredients: ['Toor Dal', 'Moong Dal', 'Channa Dal', 'Cumin Seeds', 'Dried Red Chilies', 'Salt'],
    shelfLife: '6 months in airtight container',
    tags: ['powder', 'dal', 'kandhi', 'traditional', 'protein', 'veg'],
    isVeg: true, isFeatured: true, rating: 4.6, numReviews: 167, soldCount: 1100
  },
  {
    name: 'Karivepaku Karam',
    slug: 'karivepaku-karam',
    shortDescription: 'Aromatic curry leaf spice powder — rich, fragrant with health benefits.',
    description: 'An aromatic curry leaf blend made from fresh, high-quality curry leaves combined with aromatic spices for a rich, aromatic flavor with health benefits. Perfectly spiced with balanced heat. Versatile for rice dishes, idlis, dosas, and vegetable seasoning. Prepared under strict hygiene standards.',
    category: 'powders', subcategory: 'karam',
    thumbnail: `${BASE}2024/10/karivepaku-karam-600x600.jpg`,
    images: [
      `${BASE}2024/10/karivepaku-karam-600x600.jpg`
    ],
    variants: v4(65, 162, 325, 650),
    ingredients: ['Curry Leaves (Karivepaku)', 'Urad Dal', 'Chana Dal', 'Red Chili', 'Garlic', 'Tamarind', 'Salt'],
    shelfLife: '6 months in airtight container',
    tags: ['powder', 'curry-leaf', 'karivepaku', 'aromatic', 'veg'],
    isVeg: true, isFeatured: false, rating: 4.5, numReviews: 72, soldCount: 450
  },
  {
    name: 'Kobbari Karam',
    slug: 'kobbari-karam',
    shortDescription: 'Roasted dry coconut spice powder — nutty, rich and flavourful.',
    description: 'An authentic coconut spice blend made from roasted dry coconut (kobbari) combined with aromatic spices. Delivers a rich and nutty flavour that enhances various dishes. Perfect with rice, idli, dosa, or as vegetable seasoning. Prepared under strict hygiene standards.',
    category: 'powders', subcategory: 'karam',
    thumbnail: `${BASE}2024/10/AVISAGINJALA-KARAM-600x600.jpg`,
    images: [
      `${BASE}2024/10/AVISAGINJALA-KARAM-600x600.jpg`
    ],
    variants: v4(65, 162, 325, 650),
    ingredients: ['Dry Coconut (Kobbari)', 'Urad Dal', 'Red Chili', 'Cumin', 'Curry Leaves', 'Salt'],
    shelfLife: '3 months in airtight container',
    tags: ['powder', 'coconut', 'kobbari', 'nutty', 'veg'],
    isVeg: true, isFeatured: false, rating: 4.4, numReviews: 58, soldCount: 340
  },
  {
    name: 'Koora Karam',
    slug: 'koora-karam',
    shortDescription: 'Traditional curry powder for Andhra vegetable curries.',
    description: 'A traditional curry powder crafted from roasted red chilies, coriander seeds, and a mix of aromatic spices. Made with high-quality spices promoting overall wellness, offering balanced heat and flavour intensity. Perfect for Andhra-style vegetable curries (kooralu), rice, and dosas.',
    category: 'powders', subcategory: 'masala',
    thumbnail: `${BASE}2024/10/PALLI-KARAM-600x600.jpg`,
    images: [
      `${BASE}2024/10/PALLI-KARAM-600x600.jpg`
    ],
    variants: [
      { weight: '250g', price: 145, mrp: mrp(145), stock: 180 },
      { weight: '500g', price: 290, mrp: mrp(290), stock: 150 },
      { weight: '1kg',  price: 580, mrp: mrp(580), stock: 100 }
    ],
    ingredients: ['Red Chili', 'Coriander Seeds', 'Cumin', 'Black Pepper', 'Turmeric', 'Fenugreek Seeds', 'Salt'],
    shelfLife: '12 months in airtight container',
    tags: ['powder', 'curry', 'masala', 'koora', 'veg'],
    isVeg: true, isFeatured: false, rating: 4.5, numReviews: 80, soldCount: 490
  },
  {
    name: 'Munagaku Karam',
    slug: 'munagaku-karam',
    shortDescription: 'Moringa drumstick leaf powder — highly nutritious spice blend.',
    description: 'An authentic drumstick leaf spice blend made from sun-dried moringa leaves (munagaku) combined with aromatic spices. Rich in vitamins, minerals, and antioxidants. Delivers balanced heat and flavour. Prepared under strict hygiene standards. Mix with rice and ghee.',
    category: 'powders', subcategory: 'karam',
    thumbnail: `${BASE}2024/10/AVISAGINJALA-KARAM-600x600.jpg`,
    images: [
      `${BASE}2024/10/AVISAGINJALA-KARAM-600x600.jpg`
    ],
    variants: v4(70, 175, 350, 700),
    ingredients: ['Moringa Leaves (Munagaku)', 'Red Chili', 'Garlic', 'Cumin', 'Salt'],
    shelfLife: '6 months in airtight container',
    tags: ['powder', 'moringa', 'munagaku', 'nutritious', 'healthy', 'veg'],
    isVeg: true, isFeatured: false, rating: 4.6, numReviews: 92, soldCount: 560
  },
  {
    name: 'Nalla Karam',
    slug: 'nalla-karam',
    shortDescription: 'Classic all-purpose Andhra spice powder — the everyday essential.',
    description: 'An authentic Andhra spice blend delivering a rich and nutty flavor. Made from roasted lentils, red chili, garlic, and tamarind. "Nalla Karam" means good spice powder — the classic everyday condiment for rice, idli, and dosa. Prepared under strict hygiene standards.',
    category: 'powders', subcategory: 'karam',
    thumbnail: `${BASE}2024/10/PALLI-KARAM-600x600.jpg`,
    images: [
      `${BASE}2024/10/PALLI-KARAM-600x600.jpg`
    ],
    variants: v4(65, 162, 325, 650),
    ingredients: ['Urad Dal', 'Chana Dal', 'Red Chili', 'Garlic', 'Tamarind', 'Sesame Seeds', 'Salt'],
    shelfLife: '6 months in airtight container',
    tags: ['powder', 'everyday', 'all-purpose', 'nalla', 'veg'],
    isVeg: true, isFeatured: false, rating: 4.5, numReviews: 88, soldCount: 540
  },
  {
    name: 'Nuvvula Karam',
    slug: 'nuvvula-karam',
    shortDescription: 'Roasted sesame seed powder — nutty, rich and aromatic.',
    description: 'An authentic sesame spice blend featuring roasted sesame seeds (nuvvulu) and a blend of aromatic spices delivering nutty and flavorful notes. Nutrient-rich with minerals, healthy fats, and protein. Prepared under strict hygiene standards. Perfect with rice and ghee or as a dip.',
    category: 'powders', subcategory: 'karam',
    thumbnail: `${BASE}2024/10/WhatsApp-Image-2025-05-20-at-6.45.56-PM.jpeg`,
    images: [
      `${BASE}2024/10/WhatsApp-Image-2025-05-20-at-6.45.56-PM.jpeg`
    ],
    variants: v4(68, 170, 340, 680),
    ingredients: ['Roasted Sesame Seeds (Nuvvulu)', 'Red Chili', 'Garlic', 'Cumin', 'Salt'],
    shelfLife: '3 months in airtight container',
    tags: ['powder', 'sesame', 'nuvvula', 'nutty', 'veg'],
    isVeg: true, isFeatured: false, rating: 4.4, numReviews: 65, soldCount: 390
  },
  {
    name: 'Pachadi Karam',
    slug: 'pachadi-karam',
    shortDescription: 'Flavorful spice powder from roasted spices and herbs.',
    description: 'A traditional spice blend featuring roasted spices and herbs, delivering a rich and aromatic flavor. Made with high-quality ingredients for optimal nutrition, offering a balance of heat and flavour. Prepared under strict hygiene standards. Ideal for Andhra-style pachadis and chutneys.',
    category: 'powders', subcategory: 'masala',
    thumbnail: `${BASE}2024/10/PACHADI-KARAM-600x600.jpg`,
    images: [
      `${BASE}2024/10/PACHADI-KARAM-600x600.jpg`
    ],
    variants: [
      { weight: '250g', price: 170, mrp: mrp(170), stock: 180 },
      { weight: '500g', price: 340, mrp: mrp(340), stock: 150 },
      { weight: '1kg',  price: 680, mrp: mrp(680), stock: 100 }
    ],
    ingredients: ['Red Chili', 'Tamarind', 'Cumin', 'Coriander Seeds', 'Fenugreek Seeds', 'Curry Leaves', 'Salt'],
    shelfLife: '12 months in airtight container',
    tags: ['powder', 'pachadi', 'chutney', 'masala', 'veg'],
    isVeg: true, isFeatured: false, rating: 4.4, numReviews: 55, soldCount: 320
  },
  {
    name: 'Palli Karam',
    slug: 'palli-karam',
    shortDescription: 'Authentic peanut spice powder — nutty flavor that enhances any dish.',
    description: 'A traditional spice blend featuring roasted peanuts (palli) combined with aromatic spices. Authentic peanut spice blend with a nutty flavor that enhances various dishes. Crafted using high-quality ingredients. Nutrient-rich peanut formula. Prepared under strict hygiene standards.',
    category: 'powders', subcategory: 'karam',
    thumbnail: `${BASE}2024/10/PALLI-KARAM-600x600.jpg`,
    images: [
      `${BASE}2024/10/PALLI-KARAM-600x600.jpg`
    ],
    variants: v4(65, 162, 325, 650),
    ingredients: ['Roasted Peanuts (Palli)', 'Red Chili', 'Garlic', 'Cumin', 'Salt'],
    shelfLife: '3 months in airtight container',
    tags: ['powder', 'peanut', 'palli', 'nutty', 'protein', 'veg'],
    isVeg: true, isFeatured: false, rating: 4.5, numReviews: 110, soldCount: 680
  },
  {
    name: 'Pudina Karam',
    slug: 'pudina-karam',
    shortDescription: 'Refreshing mint spice powder — cooling, aromatic and versatile.',
    description: 'An authentic mint spice blend made from sun-dried fresh mint leaves (pudina) combined with aromatic spices. Refreshing, aromatic, and versatile — great with rice, raita, and chaats. Prepared under strict hygiene standards. Balanced heat with a cooling mint finish.',
    category: 'powders', subcategory: 'karam',
    thumbnail: `${BASE}2024/10/AVISAGINJALA-KARAM-600x600.jpg`,
    images: [
      `${BASE}2024/10/AVISAGINJALA-KARAM-600x600.jpg`
    ],
    variants: v4(62, 155, 310, 620),
    ingredients: ['Mint Leaves (Pudina)', 'Red Chili', 'Cumin', 'Tamarind', 'Garlic', 'Salt'],
    shelfLife: '6 months in airtight container',
    tags: ['powder', 'mint', 'pudina', 'refreshing', 'veg'],
    isVeg: true, isFeatured: false, rating: 4.4, numReviews: 70, soldCount: 420
  },
  {
    name: 'Royyala Karam',
    slug: 'royyala-karam',
    shortDescription: 'Dried prawn spice powder — umami-rich and deeply flavourful.',
    description: 'An authentic prawn spice blend featuring dried prawns (royyalu) combined with aromatic spices, delivering a rich and umami-packed flavor that enhances various dishes. Nutrient-rich with dried prawns. Balanced heat and seafood essence. Prepared under hygiene standards.',
    category: 'powders', subcategory: 'karam',
    thumbnail: `${BASE}2024/10/ROYYALA-KARAM-600x600.jpg`,
    images: [
      `${BASE}2024/10/ROYYALA-KARAM-600x600.jpg`
    ],
    variants: v4(85, 212, 425, 850),
    ingredients: ['Dried Prawns (Royyalu)', 'Red Chili', 'Garlic', 'Cumin', 'Salt'],
    shelfLife: '6 months in airtight container',
    tags: ['powder', 'prawn', 'royyala', 'seafood', 'umami'],
    isVeg: false, isFeatured: false, rating: 4.6, numReviews: 75, soldCount: 460
  },
  {
    name: 'Vellulli Karam',
    slug: 'vellulli-karam',
    shortDescription: 'Roasted garlic spice powder — bold, pungent and aromatic.',
    description: 'An authentic garlic spice blend featuring roasted garlic (vellulli) combined with aromatic spices, delivering a rich and flavorful taste. Made from fresh, high-quality garlic with a balance of heat and garlic flavour. Versatile for rice, idli, dosa, and vegetable seasoning.',
    category: 'powders', subcategory: 'karam',
    thumbnail: `${BASE}2024/10/PALLI-KARAM-600x600.jpg`,
    images: [
      `${BASE}2024/10/PALLI-KARAM-600x600.jpg`
    ],
    variants: v4(65, 162, 325, 650),
    ingredients: ['Roasted Garlic (Vellulli)', 'Red Chili', 'Cumin', 'Sesame Seeds', 'Salt'],
    shelfLife: '6 months in airtight container',
    tags: ['powder', 'garlic', 'vellulli', 'bold', 'veg'],
    isVeg: true, isFeatured: false, rating: 4.5, numReviews: 80, soldCount: 490
  },

  // ════════════════════════════════════════════════════════════
  //  SWEETS  (5 products)
  // ════════════════════════════════════════════════════════════

  {
    name: 'Bandar Halwa',
    slug: 'bandar-halwa',
    shortDescription: 'The legendary Bandar Halwa — GI-tagged delicacy of Andhra Pradesh.',
    description: 'The iconic halwa from Machilipatnam (Bandar), a GI-tagged delicacy of Andhra Pradesh. Slow-cooked with ghee, sugar, and cardamom into a dense, glossy sweet. A centuries-old traditional recipe from the Krishna district.',
    category: 'sweets', subcategory: 'halwa',
    thumbnail: `${BASE}2024/10/BOONDHI-LADDU-1-600x600.jpg`,
    images: [`${BASE}2024/10/BOONDHI-LADDU-1-600x600.jpg`],
    variants: v3(170, 340, 680),
    ingredients: ['Wheat Starch', 'Ghee', 'Sugar', 'Cardamom', 'Cashews', 'Raisins'],
    shelfLife: '15 days at room temperature, 1 month refrigerated',
    tags: ['sweets', 'halwa', 'bandar', 'traditional', 'festive', 'GI-tagged'],
    isVeg: true, isFeatured: true, rating: 4.8, numReviews: 145, soldCount: 920
  },
  {
    name: 'Bellam Kaju Pakam',
    slug: 'bellam-kaju-pakam',
    shortDescription: 'Cashews coated in jaggery glaze — natural sweetness, no refined sugar.',
    description: 'Premium cashews coated in thick jaggery (bellam) syrup and dried for a crunchy, natural sweet. No refined sugar — only the wholesome goodness of jaggery. A traditional Andhra sweet suitable for festivals and gifting.',
    category: 'sweets', subcategory: 'kaju',
    thumbnail: `${BASE}2024/10/KAZU-BURFi.jpg`,
    images: [`${BASE}2024/10/KAZU-BURFi.jpg`],
    variants: v3(300, 600, 1200),
    ingredients: ['Cashews (Kaju)', 'Jaggery (Bellam)', 'Cardamom', 'Ghee'],
    shelfLife: '1 month at room temperature',
    tags: ['sweets', 'cashew', 'jaggery', 'natural', 'no-refined-sugar'],
    isVeg: true, isFeatured: false, rating: 4.7, numReviews: 88, soldCount: 560
  },
  {
    name: 'Bellam Sunnadallu',
    slug: 'bellam-sunnadallu',
    shortDescription: 'Jaggery urad dal laddus — protein-rich traditional Andhra sweet.',
    description: 'Roasted urad dal (black gram) powder mixed with jaggery and shaped into laddus. A wholesome traditional sweet rich in protein and iron. Made with pure jaggery — no refined sugar. A classic Andhra festive sweet.',
    category: 'sweets', subcategory: 'laddu',
    thumbnail: `${BASE}2024/10/BOONDHI-LADDU-1-600x600.jpg`,
    images: [`${BASE}2024/10/BOONDHI-LADDU-1-600x600.jpg`],
    variants: v3(170, 340, 680),
    ingredients: ['Urad Dal (Black Gram)', 'Jaggery (Bellam)', 'Ghee', 'Cardamom', 'Sesame Seeds'],
    shelfLife: '1 month at room temperature',
    tags: ['sweets', 'laddu', 'jaggery', 'protein', 'urad-dal'],
    isVeg: true, isFeatured: false, rating: 4.5, numReviews: 72, soldCount: 440
  },
  {
    name: 'Boondhi Laddu',
    slug: 'boondhi-laddu',
    shortDescription: 'Crispy gram flour boondi laddus with pure ghee — festive favourite.',
    description: 'Traditional laddus made from crispy boondi (gram flour pearls), sugar syrup, and ghee with a slightly crunchy yet juicy texture. Made with high-quality besan, pure ghee, cardamom, and dry fruit garnishes. No artificial additives. Suitable for festivals, gifting, and everyday enjoyment.',
    category: 'sweets', subcategory: 'laddu',
    thumbnail: `${BASE}2024/10/BOONDHI-LADDU-1-600x600.jpg`,
    images: [`${BASE}2024/10/BOONDHI-LADDU-1-600x600.jpg`],
    variants: v3(120, 240, 480),
    ingredients: ['Gram Flour (Besan)', 'Sugar', 'Pure Ghee', 'Cardamom', 'Cashews', 'Raisins'],
    shelfLife: '3 weeks at room temperature',
    tags: ['sweets', 'laddu', 'boondi', 'traditional', 'festive'],
    isVeg: true, isFeatured: false, rating: 4.6, numReviews: 98, soldCount: 620
  },
  {
    name: 'Kazu Burfi',
    slug: 'kazu-burfi',
    shortDescription: 'Smooth, melt-in-mouth cashew fudge — premium festive sweet.',
    description: 'Traditional Indian sweet featuring finely ground premium cashews, sugar, and ghee with a smooth, melt-in-mouth texture. Balanced sweetness enhances the natural cashew flavour. Made with fresh ingredients and pure ghee, no artificial additives. Ideal for celebrations and special occasions.',
    category: 'sweets', subcategory: 'barfi',
    thumbnail: `${BASE}2024/10/KAZU-BURFi.jpg`,
    images: [`${BASE}2024/10/KAZU-BURFi.jpg`],
    variants: v3(325, 650, 1300),
    ingredients: ['Cashews (Kaju)', 'Sugar', 'Pure Ghee', 'Cardamom', 'Milk'],
    shelfLife: '2 weeks at room temperature, 1 month refrigerated',
    tags: ['sweets', 'cashew', 'barfi', 'festive', 'premium'],
    isVeg: true, isFeatured: true, rating: 4.8, numReviews: 120, soldCount: 780
  },

  // ════════════════════════════════════════════════════════════
  //  SNACKS  (19 products)
  // ════════════════════════════════════════════════════════════

  {
    name: 'Chekkalu Round',
    slug: 'chekkalu-round',
    shortDescription: 'Authentic Andhra rice flour crackers — crispy and crunchy.',
    description: 'An authentic Andhra snack crafted from rice flour, lentils, and spices with traditional seasoning. Crispy, crunchy texture with no artificial additives or preservatives. Ideal for all ages — perfect as a tea-time snack or festive gifting.',
    category: 'snacks', subcategory: 'crackers',
    thumbnail: `${BASE}2024/10/CHEKKALU-ROUND-600x600.jpg`,
    images: [`${BASE}2024/10/CHEKKALU-ROUND-600x600.jpg`],
    variants: v3(120, 240, 480),
    ingredients: ['Rice Flour', 'Lentils', 'Sesame Seeds', 'Cumin', 'Green Chili', 'Salt', 'Oil'],
    shelfLife: '1 month in airtight container',
    tags: ['snacks', 'chekkalu', 'crispy', 'tea-time', 'veg'],
    isVeg: true, isFeatured: false, rating: 4.5, numReviews: 88, soldCount: 560
  },
  {
    name: 'Chekodi Nuvvulu',
    slug: 'chekodi-nuvvulu',
    shortDescription: 'Sesame-coated Andhra crackers — packed with nutrients and crunch.',
    description: 'Traditional Andhra snack combining sesame seeds, rice flour, and spices into a nutty, crunchy treat. Packed with nutrients from sesame seeds including minerals, healthy fats, and protein. Made with pure, natural ingredients. No artificial additives.',
    category: 'snacks', subcategory: 'crackers',
    thumbnail: `${BASE}2024/10/CHEKODI-NUVVULU-600x600.jpg`,
    images: [`${BASE}2024/10/CHEKODI-NUVVULU-600x600.jpg`],
    variants: v3(120, 240, 480),
    ingredients: ['Rice Flour', 'Sesame Seeds (Nuvvulu)', 'Cumin', 'Red Chili', 'Salt', 'Oil'],
    shelfLife: '1 month in airtight container',
    tags: ['snacks', 'sesame', 'chekodi', 'crispy', 'nutritious', 'veg'],
    isVeg: true, isFeatured: false, rating: 4.4, numReviews: 68, soldCount: 420
  },
  {
    name: 'Cornflakes Mixture',
    slug: 'cornflakes-mixture',
    shortDescription: 'Spiced cornflakes mixture — light, crunchy and addictive.',
    description: 'Crispy cornflakes tossed with roasted peanuts, curry leaves, and Andhra spices for a light, crunchy mixture snack. Made with fresh oil and premium ingredients, no artificial preservatives. Great for evening chai or as a topping for upma and poha.',
    category: 'snacks', subcategory: 'mixture',
    thumbnail: `${BASE}2024/10/MIXTURE-600x600.jpg`,
    images: [`${BASE}2024/10/MIXTURE-600x600.jpg`],
    variants: v3(120, 240, 480),
    ingredients: ['Cornflakes', 'Peanuts', 'Curry Leaves', 'Red Chili', 'Turmeric', 'Salt', 'Oil'],
    shelfLife: '1 month in airtight container',
    tags: ['snacks', 'cornflakes', 'mixture', 'light', 'veg'],
    isVeg: true, isFeatured: false, rating: 4.4, numReviews: 72, soldCount: 440
  },
  {
    name: 'Janthikalu Onion',
    slug: 'janthikalu-onion',
    shortDescription: 'Crispy lentil and onion snack — natural crunch with onion sweetness.',
    description: 'An authentic Andhra snack crafted from lentils, onions, and spices with a crispy, flavorful texture offering a perfect crunch. Natural onion sweetness balanced with savoury seasoning. Made with natural ingredients, free from preservatives and artificial flavors. Ideal for tea-time snacking or festival gifting.',
    category: 'snacks', subcategory: 'murukku',
    thumbnail: `${BASE}2024/10/JANTHIKALU-ONION-600x600.jpg`,
    images: [`${BASE}2024/10/JANTHIKALU-ONION-600x600.jpg`],
    variants: v3(120, 240, 480),
    ingredients: ['Lentils', 'Onion', 'Rice Flour', 'Cumin', 'Red Chili', 'Salt', 'Oil'],
    shelfLife: '1 month in airtight container',
    tags: ['snacks', 'janthikalu', 'onion', 'crispy', 'veg'],
    isVeg: true, isFeatured: false, rating: 4.4, numReviews: 60, soldCount: 370
  },
  {
    name: 'Jonnamurukulu Palak',
    slug: 'jonnamurukulu-palak',
    shortDescription: 'Healthy millet and spinach murukku — nutritious and crunchy.',
    description: 'A healthy, crunchy millet and spinach snack. Made from jowar (sorghum/millet) flour blended with palak (spinach) and spices. Rich in fiber, vitamins, and minerals. Contains natural ingredients without preservatives.',
    category: 'snacks', subcategory: 'murukku',
    thumbnail: `${BASE}2024/10/JONNAMURUKULU-PALAK-1-600x600.jpg`,
    images: [`${BASE}2024/10/JONNAMURUKULU-PALAK-1-600x600.jpg`],
    variants: v3(120, 240, 480),
    ingredients: ['Jowar Flour (Millet)', 'Spinach (Palak)', 'Rice Flour', 'Cumin', 'Red Chili', 'Salt', 'Oil'],
    shelfLife: '1 month in airtight container',
    tags: ['snacks', 'murukku', 'spinach', 'millet', 'healthy', 'veg'],
    isVeg: true, isFeatured: false, rating: 4.4, numReviews: 52, soldCount: 310
  },
  {
    name: 'Kakarakaya Pakodi',
    slug: 'kakarakaya-pakodi',
    shortDescription: 'Crispy bitter gourd fritters — unique, healthy and crunchy.',
    description: 'An authentic Andhra snack made from bitter gourd (kakarakaya) with a blend of spices, delivering a crispy texture with every bite. Unique, crispy snack experience with balanced bitterness and spice. Rich in antioxidants, vitamins, and minerals. Free from artificial additives.',
    category: 'snacks', subcategory: 'pakodi',
    thumbnail: `${BASE}2024/10/KAKARKAYA-PAKODI-600x600.jpg`,
    images: [`${BASE}2024/10/KAKARKAYA-PAKODI-600x600.jpg`],
    variants: v3(120, 240, 480),
    ingredients: ['Bitter Gourd (Kakarakaya)', 'Gram Flour', 'Red Chili', 'Cumin', 'Turmeric', 'Salt', 'Oil'],
    shelfLife: '2 weeks in airtight container',
    tags: ['snacks', 'bitter-gourd', 'pakodi', 'healthy', 'veg'],
    isVeg: true, isFeatured: false, rating: 4.2, numReviews: 45, soldCount: 260
  },
  {
    name: 'Kara Boondi',
    slug: 'kara-boondi',
    shortDescription: 'Spicy gram flour boondi — fiery, addictive tea-time companion.',
    description: 'Crispy gram flour pearls fried and seasoned with red chili, curry leaves, and spices for a fiery, addictive kara (spicy) boondi. Made with quality ingredients and fresh oil, no artificial preservatives. Perfect with evening chai.',
    category: 'snacks', subcategory: 'boondi',
    thumbnail: `${BASE}2024/10/SANNA-BOONDI-1-600x600.jpg`,
    images: [`${BASE}2024/10/SANNA-BOONDI-1-600x600.jpg`],
    variants: v3(120, 240, 480),
    ingredients: ['Gram Flour (Besan)', 'Red Chili', 'Curry Leaves', 'Turmeric', 'Mustard Seeds', 'Salt', 'Oil'],
    shelfLife: '1 month in airtight container',
    tags: ['snacks', 'boondi', 'kara', 'spicy', 'veg'],
    isVeg: true, isFeatured: false, rating: 4.5, numReviews: 90, soldCount: 580
  },
  {
    name: 'Karapoosa',
    slug: 'karapoosa',
    shortDescription: 'Traditional South Indian spicy sev — golden, crispy and flavourful.',
    description: 'Traditional South Indian spicy sev made from gram flour and spices. Perfectly deep-fried to golden crispiness and blended with mild spices for a flavorful bite. No artificial colors or preservatives. Works as a tea-time snack or topping for chaats and poha.',
    category: 'snacks', subcategory: 'sev',
    thumbnail: `${BASE}2024/10/KARAPOOSA-600x600.jpg`,
    images: [`${BASE}2024/10/KARAPOOSA-600x600.jpg`],
    variants: v3(90, 180, 360),
    ingredients: ['Gram Flour (Besan)', 'Red Chili', 'Cumin', 'Carom Seeds (Ajwain)', 'Salt', 'Oil'],
    shelfLife: '3 weeks in airtight container',
    tags: ['snacks', 'sev', 'karapoosa', 'crispy', 'veg'],
    isVeg: true, isFeatured: false, rating: 4.4, numReviews: 70, soldCount: 440
  },
  {
    name: 'Mixture',
    slug: 'mixture',
    shortDescription: 'Classic Andhra mixture — spicy, tangy and crunchy medley.',
    description: 'A traditional Andhra snack blend combining sev, boondi, peanuts, curry leaves, and spices for a spicy, tangy, and crunchy experience. Made with fresh oil and premium quality ingredients, no artificial preservatives. Versatile as a tea-time snack or topping for upma and poha.',
    category: 'snacks', subcategory: 'mixture',
    thumbnail: `${BASE}2024/10/MIXTURE-600x600.jpg`,
    images: [`${BASE}2024/10/MIXTURE-600x600.jpg`],
    variants: v3(120, 240, 480),
    ingredients: ['Gram Flour Sev', 'Boondi', 'Peanuts', 'Curry Leaves', 'Red Chili', 'Turmeric', 'Salt', 'Oil'],
    shelfLife: '1 month in airtight container',
    tags: ['snacks', 'mixture', 'classic', 'tea-time', 'veg'],
    isVeg: true, isFeatured: true, rating: 4.6, numReviews: 130, soldCount: 840
  },
  {
    name: 'Murukulu',
    slug: 'murukulu',
    shortDescription: 'Crispy and spiced South Indian spiral chakli snack.',
    description: 'A traditional Andhra spiral snack (chakli) made from rice flour and gram flour with cumin and sesame seeds. Crispy and spiced South Indian chakli snack. Homemade quality without artificial preservatives or colors. A festive favourite for Diwali and Sankranti.',
    category: 'snacks', subcategory: 'murukku',
    thumbnail: `${BASE}2024/10/MURUKULU-600x600.jpg`,
    images: [`${BASE}2024/10/MURUKULU-600x600.jpg`],
    variants: v3(120, 240, 480),
    ingredients: ['Rice Flour', 'Gram Flour', 'Cumin', 'Sesame Seeds', 'Red Chili', 'Butter', 'Salt', 'Oil'],
    shelfLife: '1 month in airtight container',
    tags: ['snacks', 'murukulu', 'chakli', 'spiral', 'festive', 'veg'],
    isVeg: true, isFeatured: false, rating: 4.5, numReviews: 105, soldCount: 660
  },
  {
    name: 'Pappu Chegodilu',
    slug: 'pappu-chegodilu',
    shortDescription: 'Crispy urad dal ring snack — a beloved Telugu kitchen staple.',
    description: 'Chegodilu made with urad dal (pappu) paste, shaped into rings and deep-fried for a light, crispy, savoury snack. A traditional Telugu favourite made with natural ingredients and no preservatives. Perfect for tea time and festive gifting.',
    category: 'snacks', subcategory: 'chegodilu',
    thumbnail: `${BASE}2024/10/CHEKKALU-ROUND-600x600.jpg`,
    images: [`${BASE}2024/10/CHEKKALU-ROUND-600x600.jpg`],
    variants: v3(120, 240, 480),
    ingredients: ['Urad Dal (Pappu)', 'Rice Flour', 'Cumin', 'Sesame Seeds', 'Red Chili', 'Salt', 'Oil'],
    shelfLife: '1 month in airtight container',
    tags: ['snacks', 'chegodilu', 'dal', 'ring', 'traditional', 'veg'],
    isVeg: true, isFeatured: false, rating: 4.5, numReviews: 82, soldCount: 510
  },
  {
    name: 'Plain Sakkinalu',
    slug: 'plain-sakkinalu',
    shortDescription: 'Star-shaped rice flour crackers — a Sankranti tradition.',
    description: 'Sakkinalu are star-shaped rice flour crackers traditionally made during Makar Sankranti. Made with rice flour, cumin, and sesame seeds, fried to a crispy golden finish. Lightly salted and deeply nostalgic. No preservatives or artificial additives.',
    category: 'snacks', subcategory: 'crackers',
    thumbnail: `${BASE}2024/10/brand-1080-x-1350-px_11zon-600x750.jpg`,
    images: [`${BASE}2024/10/brand-1080-x-1350-px_11zon-600x750.jpg`],
    variants: v3(130, 260, 520),
    ingredients: ['Rice Flour', 'Cumin', 'Sesame Seeds', 'Salt', 'Oil'],
    shelfLife: '1 month in airtight container',
    tags: ['snacks', 'sakkinalu', 'star-shaped', 'sankranti', 'traditional', 'veg'],
    isVeg: true, isFeatured: false, rating: 4.5, numReviews: 75, soldCount: 470
  },
  {
    name: 'Ragi Mixture',
    slug: 'ragi-mixture',
    shortDescription: 'Finger millet mixture — healthy, crunchy and calcium-rich.',
    description: 'A nutritious twist on the classic mixture using ragi (finger millet) flour sev, blended with peanuts, curry leaves, and Andhra spices. High in calcium, iron, and fiber. Made with natural ingredients and fresh oil, no artificial preservatives.',
    category: 'snacks', subcategory: 'mixture',
    thumbnail: `${BASE}2024/10/MIXTURE-600x600.jpg`,
    images: [`${BASE}2024/10/MIXTURE-600x600.jpg`],
    variants: v3(120, 240, 480),
    ingredients: ['Ragi Flour (Finger Millet)', 'Peanuts', 'Curry Leaves', 'Red Chili', 'Cumin', 'Salt', 'Oil'],
    shelfLife: '1 month in airtight container',
    tags: ['snacks', 'ragi', 'millet', 'healthy', 'calcium', 'veg'],
    isVeg: true, isFeatured: false, rating: 4.4, numReviews: 60, soldCount: 370
  },
  {
    name: 'Ribbon Pakodi',
    slug: 'ribbon-pakodi',
    shortDescription: 'Thin, crispy ribbon murukku — irresistibly spicy and golden.',
    description: 'A classic South Indian snack — thin, crispy, and irresistibly spicy ribbon pakodi made from a mix of rice flour and gram flour, deep-fried into golden, thin strips. Handcrafted using traditional recipes. No preservatives or artificial additives. Also known as ribbon murukku.',
    category: 'snacks', subcategory: 'pakodi',
    thumbnail: `${BASE}2024/10/CHEKKALU-ROUND-600x600.jpg`,
    images: [`${BASE}2024/10/CHEKKALU-ROUND-600x600.jpg`],
    variants: v3(120, 240, 480),
    ingredients: ['Rice Flour', 'Gram Flour', 'Cumin', 'Red Chili', 'Sesame Seeds', 'Salt', 'Oil'],
    shelfLife: '1 month in airtight container',
    tags: ['snacks', 'ribbon', 'pakodi', 'murukku', 'crispy', 'veg'],
    isVeg: true, isFeatured: false, rating: 4.4, numReviews: 65, soldCount: 400
  },
  {
    name: 'Sakinalu Kara',
    slug: 'sakinalu-kara',
    shortDescription: 'Spicy star-shaped rice crackers — Sankranti treat with a fiery kick.',
    description: 'The spicy version of the traditional sakkinalu — star-shaped rice flour crackers with added red chili and spices for a fiery crunch. Traditionally made during Makar Sankranti. No artificial additives or preservatives.',
    category: 'snacks', subcategory: 'crackers',
    thumbnail: `${BASE}2024/10/brand-1080-x-1350-px_11zon-600x750.jpg`,
    images: [`${BASE}2024/10/brand-1080-x-1350-px_11zon-600x750.jpg`],
    variants: v3(130, 260, 520),
    ingredients: ['Rice Flour', 'Red Chili', 'Cumin', 'Sesame Seeds', 'Salt', 'Oil'],
    shelfLife: '1 month in airtight container',
    tags: ['snacks', 'sakkinalu', 'spicy', 'kara', 'sankranti', 'veg'],
    isVeg: true, isFeatured: false, rating: 4.5, numReviews: 70, soldCount: 430
  },
  {
    name: 'Sanna Boondi',
    slug: 'sanna-boondi',
    shortDescription: 'Fine chickpea flour boondi — tiny, crunchy and mildly spiced.',
    description: 'Made with fine chickpea flour batter, deep-fried into tiny, crunchy spheres. Mildly spiced, suitable for all ages. Can be enjoyed standalone, mixed with yogurt for raita, or incorporated into chaat dishes. No preservatives or artificial additives.',
    category: 'snacks', subcategory: 'boondi',
    thumbnail: `${BASE}2024/10/SANNA-BOONDI-1-600x600.jpg`,
    images: [`${BASE}2024/10/SANNA-BOONDI-1-600x600.jpg`],
    variants: v3(120, 240, 480),
    ingredients: ['Chickpea Flour (Besan)', 'Cumin', 'Curry Leaves', 'Turmeric', 'Salt', 'Oil'],
    shelfLife: '1 month in airtight container',
    tags: ['snacks', 'boondi', 'sanna', 'fine', 'mild', 'veg'],
    isVeg: true, isFeatured: false, rating: 4.5, numReviews: 78, soldCount: 490
  },
  {
    name: 'Telangana Chekkalu',
    slug: 'telangana-chekkalu',
    shortDescription: 'Authentic Telangana-style thin rice crackers — handcrafted and spicy.',
    description: 'An authentic South Indian savory snack from Telangana featuring thin, crunchy rice flour discs. Handcrafted using traditional methods and flavored with green chili, curry leaves, and cumin for a perfect spicy bite. No preservatives or artificial colors.',
    category: 'snacks', subcategory: 'crackers',
    thumbnail: `${BASE}2024/10/brand-1080-x-1350-px_11zon-600x750.jpg`,
    images: [`${BASE}2024/10/brand-1080-x-1350-px_11zon-600x750.jpg`],
    variants: v3(130, 260, 520),
    ingredients: ['Rice Flour', 'Green Chili', 'Curry Leaves', 'Cumin', 'Sesame Seeds', 'Salt', 'Oil'],
    shelfLife: '1 month in airtight container',
    tags: ['snacks', 'chekkalu', 'telangana', 'spicy', 'handmade', 'veg'],
    isVeg: true, isFeatured: false, rating: 4.5, numReviews: 92, soldCount: 580
  },

  // ════════════════════════════════════════════════════════════
  //  GHEE  (4 products)
  // ════════════════════════════════════════════════════════════

  {
    name: 'Buffalo Ghee',
    slug: 'buffalo-ghee',
    shortDescription: 'Pure buffalo milk ghee — rich, flavorful and highly nutritious.',
    description: 'Made from fresh buffalo milk, our ghee is rich, flavorful, and highly nutritious. Prepared using traditional methods with no additives or preservatives. Rich in healthy fats, essential fatty acids, antioxidants, and vitamins. Suitable for frying, tempering, and all cooking applications. Also beneficial for skincare and hair care.',
    category: 'ghee', subcategory: 'buffalo',
    thumbnail: `${BASE}2024/10/COW-GHEE-600x600.jpg`,
    images: [`${BASE}2024/10/COW-GHEE-600x600.jpg`],
    variants: v3(240, 480, 960),
    ingredients: ['Pure Buffalo Milk'],
    shelfLife: '12 months at room temperature',
    tags: ['ghee', 'buffalo', 'pure', 'traditional'],
    isVeg: true, isFeatured: false, rating: 4.5, numReviews: 75, soldCount: 460
  },
  {
    name: 'Cow Ghee',
    slug: 'cow-ghee',
    shortDescription: 'Premium cow milk ghee — golden, fragrant and 100% natural.',
    description: 'Premium ghee crafted from fresh cow milk using traditional preparation methods. 100% natural with no additives or preservatives. Rich in healthy fats, essential fatty acids, vitamins, and antioxidants. Supports digestion and immunity. Versatile for sautéing, frying, tempering, and everyday cooking.',
    category: 'ghee', subcategory: 'cow',
    thumbnail: `${BASE}2024/10/COW-GHEE-600x600.jpg`,
    images: [`${BASE}2024/10/COW-GHEE-600x600.jpg`],
    variants: v3(300, 600, 1200),
    ingredients: ['Pure Cow Milk'],
    shelfLife: '12 months at room temperature',
    tags: ['ghee', 'cow', 'golden', 'pure', 'nourishing'],
    isVeg: true, isFeatured: false, rating: 4.6, numReviews: 110, soldCount: 680
  },
  {
    name: 'Pure Buffalo Ghee',
    slug: 'pure-buffalo-ghee',
    shortDescription: 'Premium pure buffalo ghee — rich, creamy and aromatic.',
    description: 'Premium ghee crafted from pure buffalo milk using traditional age-old techniques. Rich, creamy, and aromatic. Contains healthy fats, vitamins, and antioxidants. Free from preservatives and chemicals. Supports digestion and immunity. Suitable for cooking, frying, and daily meals.',
    category: 'ghee', subcategory: 'buffalo',
    thumbnail: `${BASE}2024/10/PURE-BUFFALO-GHEE.jpg`,
    images: [`${BASE}2024/10/PURE-BUFFALO-GHEE.jpg`],
    variants: v3(500, 700, 1400),
    ingredients: ['Pure Buffalo Milk'],
    shelfLife: '12 months at room temperature',
    tags: ['ghee', 'buffalo', 'pure', 'premium'],
    isVeg: true, isFeatured: false, rating: 4.7, numReviews: 88, soldCount: 530
  },
  {
    name: 'Pure Cow Ghee',
    slug: 'pure-cow-ghee',
    shortDescription: 'Made from fresh cow milk — rich in vitamins A, D and E.',
    description: 'Made from fresh cow milk using traditional preparation methods. Contains vitamins A, D, and E, and healthy fats. 100% natural with no artificial preservatives or chemicals. Supports digestion and skin health. Versatile for frying, sautéing, and all cooking applications.',
    category: 'ghee', subcategory: 'cow',
    thumbnail: `${BASE}2024/10/Pure-COW-GHEE.jpg`,
    images: [`${BASE}2024/10/Pure-COW-GHEE.jpg`],
    variants: v3(600, 800, 1600),
    ingredients: ['Pure Cow Milk'],
    shelfLife: '12 months at room temperature',
    tags: ['ghee', 'cow', 'pure', 'vitamins', 'premium'],
    isVeg: true, isFeatured: true, rating: 4.8, numReviews: 140, soldCount: 870
  }
];

const seedDB = async () => {
  try {
    await sequelize.authenticate();
    console.log('Connected to MySQL');

    // Sync tables (create if missing, alter if changed)
    await sequelize.sync({ alter: true });

    // Clear existing product data
    await ProductVariant.destroy({ where: {} });
    await Product.destroy({ where: {} });
    console.log('Cleared existing products');

    // Insert products + variants
    for (const p of products) {
      const { variants, ...productData } = p;
      const product = await Product.create(productData);
      if (variants?.length) {
        await ProductVariant.bulkCreate(
          variants.map((v) => ({ ...v, productId: product.id }))
        );
      }
    }
    console.log(`✅ Seeded ${products.length} products`);

    // Create admin user if not already present
    const adminExists = await User.findOne({ where: { email: 'admin@avakaayfoods.com' } });
    if (!adminExists) {
      await User.create({
        name: 'Admin',
        email: 'admin@avakaayfoods.com',
        password: 'admin123',
        role: 'admin',
      });
      console.log('✅ Admin user created: admin@avakaayfoods.com / admin123');
    }

    process.exit(0);
  } catch (err) {
    console.error('Seed error:', err);
    process.exit(1);
  }
};

seedDB();

seedDB();
