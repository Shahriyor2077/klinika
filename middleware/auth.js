const rateLimit = require('express-rate-limit');

// Login rate limiting
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100, // Ko'proq urinish
  message: 'Juda ko\'p urinish. Keyinroq qayta urinib ko\'ring.',
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'development'
});

// OTP rate limiting
const otpLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10, // Ko'proq
  message: 'SMS yuborish uchun biroz kuting.',
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'development'
});

// API rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  message: { error: 'Juda ko\'p so\'rov. Keyinroq urinib ko\'ring.' },
  skip: () => process.env.NODE_ENV === 'development'
});

module.exports = {
  // Foydalanuvchi tizimga kirganmi
  ensureAuthenticated: function(req, res, next) {
    if (req.isAuthenticated()) {
      if (req.user.role === 'admin') {
        return next();
      }
      if (!req.user.is_approved && req.path !== '/pending') {
        return res.redirect('/auth/pending');
      }
      return next();
    }
    req.flash('error_msg', 'Iltimos, avval tizimga kiring');
    res.redirect('/auth/doctor/login');
  },

  // Foydalanuvchi tizimga kirmagan bo'lishi kerak
  ensureGuest: function(req, res, next) {
    if (!req.isAuthenticated()) {
      return next();
    }
    if (req.user.role === 'admin') {
      return res.redirect('/admin');
    } else {
      if (!req.user.is_approved) {
        return res.redirect('/auth/pending');
      }
      return res.redirect('/doctor');
    }
  },

  // Faqat Admin
  ensureAdmin: function(req, res, next) {
    if (req.user && req.user.role === 'admin') {
      return next();
    }
    req.flash('error_msg', 'Bu sahifaga faqat admin kira oladi');
    res.redirect('/');
  },

  // Faqat Doctor (yoki Admin)
  ensureDoctor: function(req, res, next) {
    if (req.user && (req.user.role === 'doctor' || req.user.role === 'admin')) {
      return next();
    }
    req.flash('error_msg', 'Bu sahifaga faqat shifokor kira oladi');
    res.redirect('/');
  },

  // API autentifikatsiya
  ensureApiAuth: function(req, res, next) {
    const apiKey = req.headers['x-api-key'];
    if (apiKey && apiKey === process.env.API_SECRET_KEY) {
      return next();
    }
    return res.status(401).json({ error: 'Unauthorized' });
  },

  loginLimiter,
  otpLimiter,
  apiLimiter
};
