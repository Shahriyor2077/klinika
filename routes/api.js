const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Patient = require('../models/Patient');
const { ensureApiAuth, apiLimiter } = require('../middleware/auth');

// API rate limiting
router.use(apiLimiter);

// API autentifikatsiya middleware
router.use(ensureApiAuth);

// Foydalanuvchi ro'yxatdan o'tishi (Telegram bot uchun)
router.post('/register', async (req, res) => {
  try {
    const { name, phone, address, telegram_id, role } = req.body;

    if (!name || !phone || !address || !telegram_id) {
      return res.status(400).json({ error: 'Barcha maydonlar to\'ldirilishi shart' });
    }

    const existingUser = await User.findOne({
      $or: [{ phone }, { telegram_id }]
    });

    if (existingUser) {
      return res.status(400).json({ error: 'Bu ma\'lumotlar bilan foydalanuvchi mavjud' });
    }

    const newUser = new User({
      name,
      phone,
      address,
      telegram_id,
      role: role || 'doctor',
      password: Math.random().toString(36).slice(-8),
      is_approved: false
    });

    await newUser.save();
    res.json({ status: 'pending', message: 'Ro\'yxatdan o\'tdingiz. Admin tasdiqlashini kuting.' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Foydalanuvchi profili
router.get('/profile', async (req, res) => {
  try {
    const { telegram_id } = req.query;
    
    if (!telegram_id) {
      return res.status(400).json({ error: 'telegram_id talab qilinadi' });
    }

    const user = await User.findOne({ telegram_id }).select('-password');

    if (!user) {
      return res.status(404).json({ error: 'Foydalanuvchi topilmadi' });
    }

    res.json({
      name: user.name,
      phone: user.phone,
      address: user.address,
      role: user.role,
      is_approved: user.is_approved
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Parolni tiklash (faqat telegram_id orqali)
router.post('/reset-password', async (req, res) => {
  try {
    const { telegram_id, password } = req.body;

    if (!telegram_id || !password) {
      return res.status(400).json({ error: 'telegram_id va password talab qilinadi' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Parol kamida 6 ta belgidan iborat bo\'lishi kerak' });
    }

    const user = await User.findOne({ telegram_id });

    if (!user) {
      return res.status(404).json({ error: 'Foydalanuvchi topilmadi' });
    }

    user.password = password;
    await user.save();

    res.json({ status: 'password_changed', message: 'Parol muvaffaqiyatli o\'zgartirildi' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Bemor qidirish (PNFL orqali)
router.get('/patient/:pnfl', async (req, res) => {
  try {
    const pnfl = req.params.pnfl;

    // PNFL validatsiyasi
    if (!/^\d{14}$/.test(pnfl)) {
      return res.status(400).json({ error: 'PNFL 14 ta raqamdan iborat bo\'lishi kerak' });
    }

    const patient = await Patient.findOne({ child_pnfl: pnfl });
    if (!patient) {
      return res.status(404).json({ error: 'Bemor topilmadi' });
    }
    res.json(patient);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Statistika
router.get('/stats', async (req, res) => {
  try {
    const stats = {
      patients: await Patient.countDocuments(),
      doctors: await User.countDocuments({ role: 'doctor', is_approved: true }),
      pending: await User.countDocuments({ is_approved: false })
    };
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
