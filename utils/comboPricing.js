const { Combo, ComboItem, Product } = require('../models');

// Server-side combo pricing.
//
// Order creation re-prices every line from the DB variant, so a combo discount
// sent from the browser would simply be ignored (or, worse, trusted). Instead
// the client tags a combo's lines with a shared bundleId + comboId, and this
// module re-derives what that bundle is allowed to cost.

// Loads a combo with its member pool, or null.
async function loadCombo(comboId) {
  if (!comboId) return null;
  return Combo.findByPk(comboId, {
    include: [{
      model: ComboItem, as: 'items',
      include: [{ model: Product, as: 'product', attributes: ['id', 'name'] }],
    }],
  });
}

// Is this (productId, weight) part of the combo's pool?
const inPool = (combo, productId, weight) =>
  (combo.items || []).some(
    (member) => String(member.productId) === String(productId) && member.weight === weight
  );

// How many units the bundle must contain: pickCount for 'pick' combos, or the
// summed quantities of the fixed member list.
function requiredUnits(combo) {
  if (combo.type === 'pick') return Math.max(1, Number(combo.pickCount) || 1);
  return (combo.items || []).reduce((sum, m) => sum + Math.max(1, Number(m.quantity) || 1), 0);
}

/**
 * Validates one combo bundle and spreads its fixed price across its lines.
 *
 * @param combo  a Combo loaded via loadCombo()
 * @param lines  the order-item drafts sharing this bundleId, each already
 *               priced at catalogue rate ({ productId, variantWeight, quantity, price })
 * @returns { ok: true, lines } with `price` rewritten, or { ok: false, reason }
 *
 * Rejecting rather than silently falling back matters: a bundle that fails
 * validation must not quietly bill the customer the combo price for the wrong
 * goods, nor bill combo-priced goods at full catalogue rate.
 */
function priceBundle(combo, lines) {
  if (!combo || combo.isActive === false) return { ok: false, reason: 'Combo is no longer available' };

  for (const line of lines) {
    if (!inPool(combo, line.productId, line.variantWeight)) {
      return { ok: false, reason: `${line.name || 'An item'} is not part of ${combo.name}` };
    }
  }

  const units = lines.reduce((sum, l) => sum + Math.max(1, Number(l.quantity) || 1), 0);
  const needed = requiredUnits(combo);
  if (units !== needed) {
    return { ok: false, reason: `${combo.name} needs exactly ${needed} items (got ${units})` };
  }

  // Spread the combo price across lines in proportion to their catalogue value,
  // so per-line reporting stays sensible and the lines still sum to the combo
  // price exactly. Rounding drift is absorbed by the final line.
  const comboPrice = Number(combo.price) || 0;
  const catalogueTotal = lines.reduce((sum, l) => sum + (Number(l.price) || 0), 0);
  let allocated = 0;

  const priced = lines.map((line, index) => {
    const isLast = index === lines.length - 1;
    const share = isLast || catalogueTotal <= 0
      ? comboPrice - allocated
      : Math.round((Number(line.price) || 0) / catalogueTotal * comboPrice * 100) / 100;
    allocated += share;
    return {
      ...line,
      price: Number(share.toFixed(2)),
      bundleType: 'combo',
      bundleLabel: combo.name,
    };
  });

  return { ok: true, lines: priced };
}

module.exports = { loadCombo, priceBundle, requiredUnits, inPool };
