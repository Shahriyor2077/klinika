const mongoose = require('mongoose');

const InventorySchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['drug', 'food'],
    required: true
  },
  name: {
    type: String,
    required: true
  },
  drug: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Drug',
    default: null
  },
  quantity: {
    type: Number,
    required: true,
    min: 0
  },
  unit: {
    type: String,
    default: 'dona'
  },
  expiryDate: {
    type: Date,
    required: true
  },
  minAge: {
    type: Number,
    default: 0
  },
  maxAge: {
    type: Number,
    default: 100
  },
  addedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  created_at: {
    type: Date,
    default: Date.now
  }
});

// Virtual: qolgan miqdor
InventorySchema.virtual('isExpired').get(function() {
  return new Date() > this.expiryDate;
});

// Virtual: muddati yaqinlashgan
InventorySchema.virtual('isExpiringSoon').get(function() {
  const thirtyDays = 30 * 24 * 60 * 60 * 1000;
  return (this.expiryDate - new Date()) < thirtyDays && !this.isExpired;
});

module.exports = mongoose.model('Inventory', InventorySchema);
