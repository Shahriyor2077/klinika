const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  phone: {
    type: String,
    required: true,
    unique: true
  },
  password: {
    type: String,
    required: true
  },
  address: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: ['admin', 'doctor'],
    default: 'doctor'
  },
  telegram_id: {
    type: Number,
    unique: true,
    sparse: true
  },
  is_approved: {
    type: Boolean,
    default: false
  },
  can_export: {
    type: Boolean,
    default: false
  },
  created_at: {
    type: Date,
    default: Date.now
  }
});

// Parolni hash qilish
UserSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Parolni tekshirish
UserSchema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Rol tekshirish metodlari
UserSchema.methods.isAdmin = function() {
  return this.role === 'admin';
};

UserSchema.methods.isDoctor = function() {
  return this.role === 'doctor';
};

module.exports = mongoose.model('User', UserSchema);
