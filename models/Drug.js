const mongoose = require('mongoose');

const DrugSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true
  },
  minAge: {
    type: Number,
    default: 0,
    min: 0
  },
  maxAge: {
    type: Number,
    default: 100,
    min: 0
  },
  quantity: {
    type: Number,
    default: 0,
    min: 0
  },
  price: {
    type: Number,
    default: 0,
    min: 0
  },
  expiryDate: {
    type: Date,
    default: null
  },
  description: {
    type: String,
    default: ''
  }
});

module.exports = mongoose.model('Drug', DrugSchema);
