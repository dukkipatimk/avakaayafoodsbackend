const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  name: String,
  image: String,
  variant: {
    weight: String,
    price: Number
  },
  quantity: { type: Number, required: true, min: 1 },
  price: { type: Number, required: true }
});

const shippingAddressSchema = new mongoose.Schema({
  fullName: String,
  phone: String,
  email: String,
  line1: String,
  line2: String,
  city: String,
  state: String,
  pincode: String,
  country: String
});

const orderSchema = new mongoose.Schema({
  orderNumber: { type: String, unique: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  guestEmail: String,
  items: [orderItemSchema],
  shippingAddress: shippingAddressSchema,
  shippingZone: {
    type: String,
    enum: ['india', 'usa', 'uk', 'singapore', 'australia', 'malaysia', 'other']
  },
  shippingCost: { type: Number, default: 0 },
  shippingMethod: {
    type: String,
    default: 'Avakaaya.com Delivery'
  },
  estimatedDelivery: String,
  subtotal: { type: Number, required: true },
  discount: { type: Number, default: 0 },
  couponCode: String,
  tax: { type: Number, default: 0 },
  total: { type: Number, required: true },
  currency: { type: String, default: 'INR' },
  paymentMethod: {
    type: String,
    enum: ['icici', 'razorpay', 'cod', 'upi'],
    default: 'razorpay'
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'failed', 'refunded'],
    default: 'pending'
  },
  paymentId: String,
  razorpayOrderId: String,
  orderStatus: {
    type: String,
    enum: ['placed', 'confirmed', 'processing', 'packed', 'shipped', 'out-for-delivery', 'delivered', 'cancelled', 'returned'],
    default: 'placed'
  },
  trackingNumber: String,
  trackingUrl: String,
  notes: String,
  statusHistory: [{
    status: String,
    timestamp: { type: Date, default: Date.now },
    note: String
  }]
}, { timestamps: true });

// Auto-generate order number
orderSchema.pre('save', async function(next) {
  if (!this.orderNumber) {
    const count = await mongoose.model('Order').countDocuments();
    this.orderNumber = `AKF${String(count + 1001).padStart(5, '0')}`;
  }
  next();
});

module.exports = mongoose.model('Order', orderSchema);
