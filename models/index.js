const User            = require('./User');
const UserAddress     = require('./UserAddress');
const UserWishlist    = require('./UserWishlist');
const Product         = require('./Product');
const ProductVariant  = require('./ProductVariant');
const ProductReview   = require('./ProductReview');
const Order           = require('./Order');
const OrderItem       = require('./OrderItem');
const OrderStatusHistory = require('./OrderStatusHistory');
const Cart            = require('./Cart');
const CartItem        = require('./CartItem');
const Coupon          = require('./Coupon');
const CouponUsedBy    = require('./CouponUsedBy');

// ── User ──────────────────────────────────────────────
User.hasMany(UserAddress,  { foreignKey: 'userId', as: 'addresses', onDelete: 'CASCADE' });
UserAddress.belongsTo(User, { foreignKey: 'userId' });

User.belongsToMany(Product, { through: UserWishlist, as: 'wishlist',  foreignKey: 'userId' });
Product.belongsToMany(User, { through: UserWishlist, as: 'wishedBy',  foreignKey: 'productId' });

// ── Product ───────────────────────────────────────────
Product.hasMany(ProductVariant, { foreignKey: 'productId', as: 'variants', onDelete: 'CASCADE' });
ProductVariant.belongsTo(Product, { foreignKey: 'productId' });

Product.hasMany(ProductReview, { foreignKey: 'productId', as: 'reviews', onDelete: 'CASCADE' });
ProductReview.belongsTo(Product, { foreignKey: 'productId' });
ProductReview.belongsTo(User,    { foreignKey: 'userId', as: 'reviewer' });
User.hasMany(ProductReview,      { foreignKey: 'userId' });

// ── Order ─────────────────────────────────────────────
Order.belongsTo(User, { foreignKey: 'userId', as: 'user' });
User.hasMany(Order,   { foreignKey: 'userId' });

Order.hasMany(OrderItem, { foreignKey: 'orderId', as: 'items', onDelete: 'CASCADE' });
OrderItem.belongsTo(Order,   { foreignKey: 'orderId' });
OrderItem.belongsTo(Product, { foreignKey: 'productId', as: 'product' });
Product.hasMany(OrderItem,   { foreignKey: 'productId' });

Order.hasMany(OrderStatusHistory, { foreignKey: 'orderId', as: 'statusHistory', onDelete: 'CASCADE' });
OrderStatusHistory.belongsTo(Order, { foreignKey: 'orderId' });

// ── Cart ──────────────────────────────────────────────
Cart.belongsTo(User, { foreignKey: 'userId' });
User.hasOne(Cart,    { foreignKey: 'userId' });

Cart.hasMany(CartItem, { foreignKey: 'cartId', as: 'items', onDelete: 'CASCADE' });
CartItem.belongsTo(Cart,    { foreignKey: 'cartId' });
CartItem.belongsTo(Product, { foreignKey: 'productId', as: 'product' });
Product.hasMany(CartItem,   { foreignKey: 'productId' });

// ── Coupon ────────────────────────────────────────────
Coupon.hasMany(CouponUsedBy, { foreignKey: 'couponId', as: 'usedBy', onDelete: 'CASCADE' });
CouponUsedBy.belongsTo(Coupon, { foreignKey: 'couponId' });
CouponUsedBy.belongsTo(User,   { foreignKey: 'userId', as: 'user' });
User.hasMany(CouponUsedBy,     { foreignKey: 'userId' });

module.exports = {
  User, UserAddress, UserWishlist,
  Product, ProductVariant, ProductReview,
  Order, OrderItem, OrderStatusHistory,
  Cart, CartItem,
  Coupon, CouponUsedBy,
};
