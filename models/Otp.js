const mongoose = require('mongoose');

const OtpSchema = new mongoose.Schema({
  phone: {
    type: String,
    required: true
  },
  code: {
    type: String,
    required: true
  },
  session_token: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['register', 'reset'],
    default: 'register'
  },
  temp_data: {
    name: String,
    address: String,
    password_hash: String
  },
  expires_at: {
    type: Date,
    required: true
  },
  created_at: {
    type: Date,
    default: Date.now
  }
});

// 5 daqiqadan keyin avtomatik o'chirish
OtpSchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('Otp', OtpSchema);
