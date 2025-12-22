const express = require('express');
const router = express.Router();
const passport = require('passport');
const crypto = require('crypto');
const User = require('../models/User');
const Otp = require('../models/Otp');
const { ensureGuest, loginLimiter, otpLimiter } = require('../middleware/auth');
const { sendSms, generateOtp } = require('../services/sms.service');
const { registerValidator, otpValidator } = require('../middleware/validator');

// ==================== ADMIN LOGIN ====================
router.get('/admin/login', ensureGuest, (req, res) => {
  res.render('auth/admin-login', { layout: 'auth' });
});

router.post('/admin/login', loginLimiter, (req, res, next) => {
  passport.authenticate('local', (err, user, info) => {
    if (err) return next(err);

    if (!user) {
      req.flash('error_msg', info.message);
      return res.redirect('/auth/admin/login');
    }

    if (user.role !== 'admin') {
      req.flash('error_msg', 'Bu sahifa faqat adminlar uchun');
      return res.redirect('/auth/admin/login');
    }

    req.logIn(user, (err) => {
      if (err) return next(err);
      return res.redirect('/admin');
    });
  })(req, res, next);
});

// ==================== DOCTOR LOGIN ====================
router.get('/doctor/login', ensureGuest, (req, res) => {
  res.render('auth/doctor-login', { layout: 'auth' });
});

router.post('/doctor/login', loginLimiter, (req, res, next) => {
  passport.authenticate('local', (err, user, info) => {
    if (err) return next(err);

    if (!user) {
      req.flash('error_msg', info.message);
      return res.redirect('/auth/doctor/login');
    }

    if (user.role !== 'doctor') {
      req.flash('error_msg', 'Bu sahifa faqat shifokorlar uchun');
      return res.redirect('/auth/doctor/login');
    }

    req.logIn(user, (err) => {
      if (err) return next(err);

      if (!user.is_approved) {
        return res.redirect('/auth/pending');
      }

      return res.redirect('/doctor');
    });
  })(req, res, next);
});

// ==================== DOCTOR REGISTER ====================
router.get('/doctor/register', ensureGuest, (req, res) => {
  res.render('auth/doctor-register', { layout: 'auth' });
});

// 1-qadam: Ma'lumotlarni tekshirish va OTP yuborish
router.post('/doctor/register', otpLimiter, async (req, res) => {
  try {
    const { name, phone, password, password2, address } = req.body;
    const errors = [];

    if (!name || !phone || !password || !address) {
      errors.push({ msg: 'Barcha maydonlarni to\'ldiring' });
    }

    if (password !== password2) {
      errors.push({ msg: 'Parollar mos kelmadi' });
    }

    if (password && password.length < 6) {
      errors.push({ msg: 'Parol kamida 6 ta belgidan iborat bo\'lishi kerak' });
    }

    // Telefon formatini tekshirish
    const phoneRegex = /^(\+?998)?[0-9]{9}$/;
    if (phone && !phoneRegex.test(phone.replace(/\s/g, ''))) {
      errors.push({ msg: 'Telefon raqam noto\'g\'ri formatda' });
    }

    if (errors.length > 0) {
      return res.render('auth/doctor-register', {
        layout: 'auth',
        errors,
        name,
        phone,
        address
      });
    }

    const existingUser = await User.findOne({ phone: phone.replace(/\s/g, '') });
    if (existingUser) {
      errors.push({ msg: 'Bu telefon raqam allaqachon ro\'yxatdan o\'tgan' });
      return res.render('auth/doctor-register', {
        layout: 'auth',
        errors,
        name,
        phone,
        address
      });
    }

    // OTP yaratish va yuborish
    const otpCode = generateOtp();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    // Eski OTP larni o'chirish
    await Otp.deleteMany({ phone: phone.replace(/\s/g, '') });

    // Session token yaratish (parolni xavfsiz saqlash uchun)
    const sessionToken = crypto.randomBytes(32).toString('hex');

    // Yangi OTP saqlash (parol bilan birga)
    await Otp.create({
      phone: phone.replace(/\s/g, ''),
      code: otpCode,
      expires_at: expiresAt,
      session_token: sessionToken,
      temp_data: {
        name,
        address,
        password_hash: await require('bcryptjs').hash(password, 10)
      }
    });

    // SMS yuborish
    const template = process.env.SMS_TEMPLATE || 'Kod: {otp}';
    const message = template.replace('{otp}', otpCode);
    const smsResult = await sendSms(phone, message);
    
    if (!smsResult.success) {
      errors.push({ msg: 'SMS yuborishda xatolik. Qayta urinib ko\'ring.' });
      return res.render('auth/doctor-register', {
        layout: 'auth',
        errors,
        name,
        phone,
        address
      });
    }

    // OTP tasdiqlash sahifasiga o'tish (parolsiz)
    res.render('auth/verify-otp', {
      layout: 'auth',
      phone: phone.replace(/\s/g, ''),
      sessionToken
    });

  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Xatolik yuz berdi');
    res.redirect('/auth/doctor/register');
  }
});

// 2-qadam: OTP ni tasdiqlash va foydalanuvchini yaratish
router.post('/doctor/verify-otp', async (req, res) => {
  try {
    const { phone, sessionToken, otp } = req.body;
    const errors = [];

    // OTP ni tekshirish
    const otpRecord = await Otp.findOne({ 
      phone, 
      code: otp,
      session_token: sessionToken,
      expires_at: { $gt: new Date() }
    });

    if (!otpRecord) {
      errors.push({ msg: 'Kod noto\'g\'ri yoki muddati o\'tgan' });
      return res.render('auth/verify-otp', {
        layout: 'auth',
        errors,
        phone,
        sessionToken
      });
    }

    // Foydalanuvchini yaratish (parol allaqachon hash qilingan)
    const newUser = new User({
      name: otpRecord.temp_data.name,
      phone,
      password: 'temp', // Pre-save hook ishlamasligi uchun
      address: otpRecord.temp_data.address,
      role: 'doctor',
      is_approved: false
    });

    // Hash qilingan parolni to'g'ridan-to'g'ri saqlash
    newUser.password = otpRecord.temp_data.password_hash;
    await newUser.save({ validateBeforeSave: false });

    // OTP ni o'chirish
    await Otp.deleteMany({ phone });

    req.flash('success_msg', 'Ro\'yxatdan o\'tdingiz! Admin tasdiqlashini kuting.');
    res.redirect('/auth/doctor/login');

  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Xatolik yuz berdi');
    res.redirect('/auth/doctor/register');
  }
});

// OTP qayta yuborish
router.post('/doctor/resend-otp', otpLimiter, async (req, res) => {
  try {
    const { phone, sessionToken } = req.body;

    // Eski OTP ni topish
    const oldOtp = await Otp.findOne({ phone, session_token: sessionToken });
    if (!oldOtp || !oldOtp.temp_data) {
      req.flash('error_msg', 'Sessiya muddati tugagan. Qaytadan ro\'yxatdan o\'ting.');
      return res.redirect('/auth/doctor/register');
    }

    const otpCode = generateOtp();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
    const newSessionToken = crypto.randomBytes(32).toString('hex');

    await Otp.deleteMany({ phone });
    await Otp.create({
      phone,
      code: otpCode,
      expires_at: expiresAt,
      session_token: newSessionToken,
      temp_data: oldOtp.temp_data
    });

    const template = process.env.SMS_TEMPLATE || 'Kod: {otp}';
    const message = template.replace('{otp}', otpCode);
    await sendSms(phone, message);

    res.render('auth/verify-otp', {
      layout: 'auth',
      phone,
      sessionToken: newSessionToken,
      success_msg: 'Yangi kod yuborildi'
    });

  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Xatolik yuz berdi');
    res.redirect('/auth/doctor/register');
  }
});

// ==================== FORGOT PASSWORD ====================
router.get('/forgot-password', ensureGuest, (req, res) => {
  res.render('auth/forgot-password', { layout: 'auth' });
});

router.post('/forgot-password', otpLimiter, async (req, res) => {
  try {
    const { phone } = req.body;
    const errors = [];

    const user = await User.findOne({ phone: phone.replace(/\s/g, '') });
    if (!user) {
      errors.push({ msg: 'Bu telefon raqam ro\'yxatdan o\'tmagan' });
      return res.render('auth/forgot-password', { layout: 'auth', errors, phone });
    }

    const otpCode = generateOtp();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
    const sessionToken = crypto.randomBytes(32).toString('hex');

    await Otp.deleteMany({ phone: phone.replace(/\s/g, ''), type: 'reset' });
    await Otp.create({
      phone: phone.replace(/\s/g, ''),
      code: otpCode,
      expires_at: expiresAt,
      session_token: sessionToken,
      type: 'reset'
    });

    const message = `Parolni tiklash kodi: ${otpCode}`;
    const smsResult = await sendSms(phone, message);

    if (!smsResult.success) {
      errors.push({ msg: 'SMS yuborishda xatolik' });
      return res.render('auth/forgot-password', { layout: 'auth', errors, phone });
    }

    res.render('auth/reset-password', {
      layout: 'auth',
      phone: phone.replace(/\s/g, ''),
      sessionToken
    });

  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Xatolik yuz berdi');
    res.redirect('/auth/forgot-password');
  }
});

router.post('/reset-password', async (req, res) => {
  try {
    const { phone, sessionToken, otp, password, password2 } = req.body;
    const errors = [];

    if (password !== password2) {
      errors.push({ msg: 'Parollar mos kelmadi' });
    }

    if (password.length < 6) {
      errors.push({ msg: 'Parol kamida 6 ta belgidan iborat bo\'lishi kerak' });
    }

    const otpRecord = await Otp.findOne({
      phone,
      code: otp,
      session_token: sessionToken,
      type: 'reset',
      expires_at: { $gt: new Date() }
    });

    if (!otpRecord) {
      errors.push({ msg: 'Kod noto\'g\'ri yoki muddati o\'tgan' });
    }

    if (errors.length > 0) {
      return res.render('auth/reset-password', {
        layout: 'auth',
        errors,
        phone,
        sessionToken
      });
    }

    const user = await User.findOne({ phone });
    user.password = password;
    await user.save();

    await Otp.deleteMany({ phone, type: 'reset' });

    req.flash('success_msg', 'Parol muvaffaqiyatli o\'zgartirildi');
    res.redirect('/auth/doctor/login');

  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Xatolik yuz berdi');
    res.redirect('/auth/forgot-password');
  }
});

// ==================== PENDING ====================
router.get('/pending', (req, res) => {
  if (!req.isAuthenticated()) {
    return res.redirect('/auth/doctor/login');
  }
  if (req.user.is_approved) {
    return res.redirect('/doctor');
  }
  res.render('auth/pending', { layout: 'auth' });
});

// ==================== LOGOUT ====================
router.get('/logout', (req, res, next) => {
  const role = req.user ? req.user.role : 'doctor';
  req.logout(function(err) {
    if (err) return next(err);
    req.flash('success_msg', 'Tizimdan chiqdingiz');
    if (role === 'admin') {
      res.redirect('/auth/admin/login');
    } else {
      res.redirect('/auth/doctor/login');
    }
  });
});

module.exports = router;
