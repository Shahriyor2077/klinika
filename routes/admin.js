const express = require('express');
const router = express.Router();
const Patient = require('../models/Patient');
const Diagnosis = require('../models/Diagnosis');
const Drug = require('../models/Drug');
const User = require('../models/User');
const { ensureAuthenticated, ensureAdmin } = require('../middleware/auth');
const { drugValidator, mongoIdValidator, sanitize } = require('../middleware/validator');
const ExcelJS = require('exceljs');

// Admin panel bosh sahifa
router.get('/', ensureAuthenticated, ensureAdmin, async (req, res) => {
  try {
    const stats = {
      patients: await Patient.countDocuments(),
      diagnoses: await Diagnosis.countDocuments(),
      users: await User.countDocuments(),
      pendingUsers: await User.countDocuments({ is_approved: false }),
      doctors: await User.countDocuments({ role: 'doctor' }),
      drugs: await Drug.countDocuments()
    };
    res.render('admin/dashboard', { stats });
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Ma\'lumotlarni yuklashda xatolik');
    res.redirect('/');
  }
});

// ==================== FOYDALANUVCHILAR ====================
router.get('/users', ensureAuthenticated, ensureAdmin, async (req, res) => {
  try {
    const { status, search } = req.query;
    let query = { role: 'doctor' };

    if (status === 'pending') query.is_approved = false;
    if (status === 'approved') query.is_approved = true;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } }
      ];
    }

    const users = await User.find(query).sort({ created_at: -1 }).lean();
    res.render('admin/users', { users, status, search });
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Foydalanuvchilarni yuklashda xatolik');
    res.redirect('/admin');
  }
});

// Foydalanuvchini tasdiqlash
router.post('/users/approve/:id', ensureAuthenticated, ensureAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      req.flash('error_msg', 'Foydalanuvchi topilmadi');
      return res.redirect('/admin/users');
    }
    user.is_approved = true;
    await user.save({ validateBeforeSave: false });
    req.flash('success_msg', `${user.name} tasdiqlandi`);
    res.redirect('/admin/users');
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Tasdiqlashda xatolik');
    res.redirect('/admin/users');
  }
});

// Foydalanuvchini rad etish
router.post('/users/reject/:id', ensureAuthenticated, ensureAdmin, async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.params.id, { is_approved: false });
    req.flash('success_msg', 'Foydalanuvchi rad etildi');
    res.redirect('/admin/users');
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Rad etishda xatolik');
    res.redirect('/admin/users');
  }
});

// Rolni o'zgartirish
router.post('/users/change-role/:id', ensureAuthenticated, ensureAdmin, async (req, res) => {
  try {
    const { role } = req.body;
    if (!['admin', 'doctor'].includes(role)) {
      req.flash('error_msg', 'Noto\'g\'ri rol');
      return res.redirect('/admin/users');
    }
    await User.findByIdAndUpdate(req.params.id, { role });
    req.flash('success_msg', 'Rol o\'zgartirildi');
    res.redirect('/admin/users');
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Rolni o\'zgartirishda xatolik');
    res.redirect('/admin/users');
  }
});

// Excel eksport ruxsati berish
router.post('/users/grant-export/:id', ensureAuthenticated, ensureAdmin, async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.params.id, { can_export: true });
    req.flash('success_msg', 'Excel ruxsati berildi');
    res.redirect('/admin/users');
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Ruxsat berishda xatolik');
    res.redirect('/admin/users');
  }
});

// Excel ruxsatini olib tashlash
router.post('/users/revoke-export/:id', ensureAuthenticated, ensureAdmin, async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.params.id, { can_export: false });
    req.flash('success_msg', 'Excel ruxsati olib tashlandi');
    res.redirect('/admin/users');
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Ruxsatni olib tashlashda xatolik');
    res.redirect('/admin/users');
  }
});

// Foydalanuvchini o'chirish
router.delete('/users/delete/:id', ensureAuthenticated, ensureAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      req.flash('error_msg', 'Foydalanuvchi topilmadi');
      return res.redirect('/admin/users');
    }
    if (user.role === 'admin') {
      req.flash('error_msg', 'Adminni o\'chirib bo\'lmaydi');
      return res.redirect('/admin/users');
    }
    await User.findByIdAndDelete(req.params.id);
    req.flash('success_msg', 'Foydalanuvchi o\'chirildi');
    res.redirect('/admin/users');
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'O\'chirishda xatolik');
    res.redirect('/admin/users');
  }
});

// ==================== BEMORLAR ====================
router.get('/patients', ensureAuthenticated, ensureAdmin, async (req, res) => {
  try {
    const { search, region, sex, page = 1 } = req.query;
    const limit = 20;
    const skip = (page - 1) * limit;
    let query = {};

    if (search) {
      const searchSanitized = sanitize(search);
      query.$or = [
        { name: { $regex: searchSanitized, $options: 'i' } },
        { child_pnfl: { $regex: searchSanitized, $options: 'i' } },
        { patient_code: { $regex: searchSanitized, $options: 'i' } }
      ];
    }
    if (region) query.region = region;
    if (sex) query.sex = sex;

    const total = await Patient.countDocuments(query);
    const totalPages = Math.ceil(total / limit);
    const patients = await Patient.find(query)
      .sort({ patient_add_date: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    res.render('admin/patients', { 
      patients, 
      search, 
      region, 
      sex,
      pagination: {
        page: parseInt(page),
        totalPages,
        total,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Bemorlarni yuklashda xatolik');
    res.redirect('/admin');
  }
});

// Bemor ma'lumotlarini olish (API)
router.get('/patients/view/:id', ensureAuthenticated, ensureAdmin, async (req, res) => {
  try {
    const patient = await Patient.findById(req.params.id).lean();
    if (!patient) {
      return res.status(404).json({ error: 'Bemor topilmadi' });
    }
    const diagnoses = await Diagnosis.find({ patient: req.params.id })
      .populate('dorilar')
      .populate('doctor', 'name')
      .sort({ created_at: -1 })
      .lean();
    res.json({ patient, diagnoses });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ma\'lumotlarni yuklashda xatolik' });
  }
});

// Bemorni tahrirlash sahifasi
router.get('/patients/edit/:id', ensureAuthenticated, ensureAdmin, async (req, res) => {
  try {
    const patient = await Patient.findById(req.params.id).lean();
    if (!patient) {
      req.flash('error_msg', 'Bemor topilmadi');
      return res.redirect('/admin/patients');
    }
    res.render('admin/patient-edit', { patient });
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Bemorni yuklashda xatolik');
    res.redirect('/admin/patients');
  }
});

// Bemorni yangilash
router.post('/patients/edit/:id', ensureAuthenticated, ensureAdmin, async (req, res) => {
  try {
    const updateData = {};
    const allowedFields = [
      'name', 'card_number', 'sex', 'region', 'district', 'birthday', 'age',
      'child_pnfl', 'mother_name', 'mother_id_number', 'mother_work_place',
      'father_name', 'father_id_number', 'father_work_place', 'full_address',
      'phone_number', 'second_number'
    ];

    // Faqat ruxsat etilgan maydonlarni olish va sanitize qilish
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        updateData[field] = sanitize(req.body[field]);
      }
    });

    if (updateData.birthday) updateData.birthday = new Date(updateData.birthday);
    if (updateData.age) updateData.age = parseInt(updateData.age);
    updateData.related_marriage = req.body.related_marriage === 'on';

    // PNFL validatsiyasi
    if (updateData.child_pnfl && !/^\d{14}$/.test(updateData.child_pnfl)) {
      req.flash('error_msg', 'PNFL 14 ta raqamdan iborat bo\'lishi kerak');
      return res.redirect(`/admin/patients/edit/${req.params.id}`);
    }

    await Patient.findByIdAndUpdate(req.params.id, updateData);
    req.flash('success_msg', 'Bemor ma\'lumotlari yangilandi');
    res.redirect('/admin/patients');
  } catch (err) {
    console.error(err);
    if (err.code === 11000) {
      req.flash('error_msg', 'Bu PNFL bilan bemor allaqachon mavjud');
    } else {
      req.flash('error_msg', 'Yangilashda xatolik');
    }
    res.redirect(`/admin/patients/edit/${req.params.id}`);
  }
});

// Bemorni o'chirish
router.delete('/patients/delete/:id', ensureAuthenticated, ensureAdmin, async (req, res) => {
  try {
    const patient = await Patient.findById(req.params.id);
    if (!patient) {
      req.flash('error_msg', 'Bemor topilmadi');
      return res.redirect('/admin/patients');
    }
    await Diagnosis.deleteMany({ patient: req.params.id });
    await Patient.findByIdAndDelete(req.params.id);
    req.flash('success_msg', `${patient.name} va uning tashxislari o'chirildi`);
    res.redirect('/admin/patients');
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'O\'chirishda xatolik');
    res.redirect('/admin/patients');
  }
});

// Excel export
router.get('/patients/export', ensureAuthenticated, ensureAdmin, async (req, res) => {
  try {
    const { region, sex } = req.query;
    let query = {};
    if (region) query.region = region;
    if (sex) query.sex = sex;

    const patients = await Patient.find(query).sort({ patient_add_date: -1 }).lean();
    
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Bemorlar');

    worksheet.columns = [
      { header: 'Kod', key: 'patient_code', width: 10 },
      { header: 'F.I.O', key: 'name', width: 30 },
      { header: 'PNFL', key: 'child_pnfl', width: 18 },
      { header: 'Jinsi', key: 'sex', width: 10 },
      { header: 'Yoshi', key: 'age', width: 8 },
      { header: 'Viloyat', key: 'region', width: 20 },
      { header: 'Tuman', key: 'district', width: 20 },
      { header: 'Telefon', key: 'phone_number', width: 15 },
      { header: 'Ona', key: 'mother_name', width: 25 },
      { header: 'Ota', key: 'father_name', width: 25 },
      { header: 'Manzil', key: 'full_address', width: 40 },
      { header: 'Sana', key: 'patient_add_date', width: 12 }
    ];

    const regionNames = {
      'andijon': 'Andijon', 'buxoro': 'Buxoro', 'fargona': "Farg'ona",
      'jizzax': 'Jizzax', 'xorazm': 'Xorazm', 'namangan': 'Namangan',
      'navoiy': 'Navoiy', 'qashqadaryo': 'Qashqadaryo', 'samarqand': 'Samarqand',
      'sirdaryo': 'Sirdaryo', 'surxondaryo': 'Surxondaryo',
      'toshkent_vil': 'Toshkent vil.', 'toshkent_sh': 'Toshkent sh.'
    };

    patients.forEach(p => {
      worksheet.addRow({
        ...p,
        sex: p.sex === 'male' ? 'Erkak' : 'Ayol',
        region: regionNames[p.region] || p.region,
        patient_add_date: new Date(p.patient_add_date).toLocaleDateString('uz-UZ')
      });
    });

    // Header stilini o'zgartirish
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: '4F46E5' }
    };
    worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFF' } };

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=bemorlar_${Date.now()}.xlsx`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Excel yaratishda xatolik');
    res.redirect('/admin/patients');
  }
});

// ==================== TASHXISLAR ====================
router.get('/diagnoses', ensureAuthenticated, ensureAdmin, async (req, res) => {
  try {
    const { search, page = 1 } = req.query;
    const limit = 20;
    const skip = (page - 1) * limit;
    let query = {};

    if (search) {
      const searchSanitized = sanitize(search);
      const patients = await Patient.find({
        $or: [
          { name: { $regex: searchSanitized, $options: 'i' } },
          { child_pnfl: { $regex: searchSanitized, $options: 'i' } },
          { patient_code: { $regex: searchSanitized, $options: 'i' } }
        ]
      }).select('_id');
      query.patient = { $in: patients.map(p => p._id) };
    }

    const total = await Diagnosis.countDocuments(query);
    const totalPages = Math.ceil(total / limit);
    const diagnoses = await Diagnosis.find(query)
      .populate('patient')
      .populate('dorilar')
      .populate('doctor', 'name')
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    res.render('admin/diagnoses', { 
      diagnoses, 
      search,
      pagination: {
        page: parseInt(page),
        totalPages,
        total,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Tashxislarni yuklashda xatolik');
    res.redirect('/admin');
  }
});

// Tashxisni ko'rish
router.get('/diagnoses/view/:id', ensureAuthenticated, ensureAdmin, async (req, res) => {
  try {
    const diagnosis = await Diagnosis.findById(req.params.id)
      .populate('patient')
      .populate('dorilar')
      .populate('doctor', 'name')
      .lean();
    
    if (!diagnosis) {
      return res.status(404).json({ error: 'Tashxis topilmadi' });
    }
    res.json(diagnosis);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Xatolik' });
  }
});

// Tashxisni tahrirlash sahifasi
router.get('/diagnoses/edit/:id', ensureAuthenticated, ensureAdmin, async (req, res) => {
  try {
    const diagnosis = await Diagnosis.findById(req.params.id)
      .populate('patient')
      .populate('dorilar')
      .lean();
    
    if (!diagnosis) {
      req.flash('error_msg', 'Tashxis topilmadi');
      return res.redirect('/admin/diagnoses');
    }

    const drugs = await Drug.find().sort({ name: 1 }).lean();
    res.render('admin/diagnosis-edit', { diagnosis, drugs });
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Tashxisni yuklashda xatolik');
    res.redirect('/admin/diagnoses');
  }
});

// Tashxisni yangilash
router.post('/diagnoses/edit/:id', ensureAuthenticated, ensureAdmin, async (req, res) => {
  try {
    const {
      shikoyat, tashxis, ogirligi, boyi,
      spirometriya, irt, sweat_test, genetik_test,
      davolash, dorilar, izohlar
    } = req.body;

    await Diagnosis.findByIdAndUpdate(req.params.id, {
      shikoyat: sanitize(shikoyat),
      tashxis: sanitize(tashxis),
      ogirligi: parseFloat(ogirligi) || 0,
      boyi: parseInt(boyi) || 0,
      spirometriya: sanitize(spirometriya),
      irt: sanitize(irt),
      sweat_test: sanitize(sweat_test),
      genetik_test: sanitize(genetik_test),
      davolash: sanitize(davolash),
      dorilar: Array.isArray(dorilar) ? dorilar : (dorilar ? [dorilar] : []),
      izohlar: sanitize(izohlar)
    });

    req.flash('success_msg', 'Tashxis yangilandi');
    res.redirect('/admin/diagnoses');
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Yangilashda xatolik');
    res.redirect(`/admin/diagnoses/edit/${req.params.id}`);
  }
});

// Tashxisni o'chirish
router.delete('/diagnoses/delete/:id', ensureAuthenticated, ensureAdmin, async (req, res) => {
  try {
    await Diagnosis.findByIdAndDelete(req.params.id);
    req.flash('success_msg', 'Tashxis o\'chirildi');
    res.redirect('/admin/diagnoses');
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'O\'chirishda xatolik');
    res.redirect('/admin/diagnoses');
  }
});

// ==================== DORILAR ====================
router.get('/drugs', ensureAuthenticated, ensureAdmin, async (req, res) => {
  try {
    const drugs = await Drug.find().sort({ name: 1 }).lean();
    res.render('admin/drugs', { drugs });
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Dorilarni yuklashda xatolik');
    res.redirect('/admin');
  }
});

// Yangi dori qo'shish
router.post('/drugs/add', ensureAuthenticated, ensureAdmin, drugValidator, async (req, res) => {
  try {
    const name = sanitize(req.body.name);

    const existing = await Drug.findOne({ name: { $regex: `^${name}$`, $options: 'i' } });
    if (existing) {
      req.flash('error_msg', 'Bu dori allaqachon mavjud');
      return res.redirect('/admin/drugs');
    }

    await Drug.create({ name });
    req.flash('success_msg', 'Dori qo\'shildi');
    res.redirect('/admin/drugs');
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Dori qo\'shishda xatolik');
    res.redirect('/admin/drugs');
  }
});

// Dorini tahrirlash
router.post('/drugs/edit/:id', ensureAuthenticated, ensureAdmin, async (req, res) => {
  try {
    const name = sanitize(req.body.name);
    if (!name || name.length < 2) {
      req.flash('error_msg', 'Dori nomi kamida 2 ta belgidan iborat bo\'lishi kerak');
      return res.redirect('/admin/drugs');
    }

    await Drug.findByIdAndUpdate(req.params.id, { name });
    req.flash('success_msg', 'Dori yangilandi');
    res.redirect('/admin/drugs');
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Yangilashda xatolik');
    res.redirect('/admin/drugs');
  }
});

// Dorini o'chirish
router.delete('/drugs/delete/:id', ensureAuthenticated, ensureAdmin, async (req, res) => {
  try {
    await Drug.findByIdAndDelete(req.params.id);
    req.flash('success_msg', 'Dori o\'chirildi');
    res.redirect('/admin/drugs');
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'O\'chirishda xatolik');
    res.redirect('/admin/drugs');
  }
});

module.exports = router;
