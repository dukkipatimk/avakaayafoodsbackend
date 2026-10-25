// Product categories: the built-in six plus any the admin adds. Custom ones live in
// the settings table (key 'productCategories') as [{ value, label, description }].
// `value` is the slug stored on products and used in /collections/<value>.
const { Setting } = require('../models');

const KEY = 'productCategories';
const DISABLED_KEY = 'disabledCategories';   // slugs hidden from the shop (built-in or custom)

const BUILT_IN = [
  { value: 'pickles', label: 'Pickles' },
  { value: 'powders', label: 'Podis & Powders' },
  { value: 'snacks', label: 'Snacks' },
  { value: 'sweets', label: 'Sweets' },
  { value: 'ghee', label: 'Ghee' },
  { value: 'gift-hampers', label: 'Gift Hampers' },
];

// Collection slugs the storefront already uses for something else.
const RESERVED = ['veg-pickles', 'non-veg-pickles', 'all', 'products'];

const slugify = (s) => String(s || '').toLowerCase().trim()
  .replace(/&/g, ' and ')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  .slice(0, 60);

async function customCategories() {
  const row = await Setting.findOne({ where: { key: KEY } });
  const list = Array.isArray(row?.value) ? row.value : (typeof row?.value === 'string' ? JSON.parse(row.value || '[]') : []);
  return list.filter((c) => c && c.value);
}

async function saveCustomCategories(list) {
  const [row] = await Setting.findOrCreate({ where: { key: KEY }, defaults: { value: [] } });
  await row.update({ value: list });
}

// A disabled category is hidden from the shop together with its products; turning
// it back on brings both back. Nothing about the products themselves changes.
async function disabledCategories() {
  const row = await Setting.findOne({ where: { key: DISABLED_KEY } });
  const v = row?.value;
  const list = Array.isArray(v) ? v : (typeof v === 'string' ? JSON.parse(v || '[]') : []);
  return list.filter(Boolean);
}

async function setCategoryEnabled(value, enabled) {
  const current = await disabledCategories();
  const next = enabled ? current.filter((x) => x !== value) : [...new Set([...current, value])];
  const [row] = await Setting.findOrCreate({ where: { key: DISABLED_KEY }, defaults: { value: [] } });
  await row.update({ value: next });
}

async function allCategories() {
  const [custom, disabled] = await Promise.all([customCategories(), disabledCategories()]);
  return [
    ...BUILT_IN.map((c) => ({ ...c, builtIn: true })),
    ...custom.map((c) => ({ value: c.value, label: c.label, description: c.description || '', builtIn: false })),
  ].map((c) => ({ ...c, enabled: !disabled.includes(c.value) }));
}

async function isValidCategory(value) {
  if (!value) return false;
  return (await allCategories()).some((c) => c.value === value);
}

module.exports = { BUILT_IN, RESERVED, slugify, customCategories, saveCustomCategories, allCategories, isValidCategory, disabledCategories, setCategoryEnabled };
