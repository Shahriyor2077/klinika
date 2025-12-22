const express = require('express');
const router = express.Router();
const Patient = require('../models/Patient');
const Diagnosis = require('../models/Diagnosis');
const Drug = require('../models/Drug');
const User = require('../models/User');
const { ensureAuthenticated, ensureDoctor } = require('../middleware/auth');
const { patientValidator, diagnosisValidator, sanitize } = require('../middleware/validator');

// Doctor dashboard
router.get('/', ensureAuthenticated, ensureDoctor, async (req, res) => {
  try {
    const query = req.query.q ? req.query.q.trim() : '';
    let patient = null;
    let diagnoses = null;

    if (query) {
      // PNFL yoki kod orqali qidirish
      patient = await Patient.findOne({
        $or: [
          { child_pnfl: query },
          { patient_code: query.toUpperCase() }
        ]
      });
      if (patient) {
        diagnoses = await Diagnosis.find({ patient: patient._id })
          .populate('dorilar')
          .populate('doctor', 'name')
          .sort({ created_at: -1 });
      } else {
        req.flash('error_msg', `"${query}" bo'yicha bemor topilmadi`);
      }
    }

    // Statistika
    const patients = await Patient.find().lean();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayCount = await Patient.countDocuments({
      patient_add_date: { $gte: today }
    });

    const drugs = await Drug.find().lean();

    // Shifokor qo'shgan bemorlar
    const myDiagnoses = await Diagnosis.find({ doctor: req.user._id })
      .distinct('patient');
    const myPatientsCount = myDiagnoses.length;

    // Statistika hisoblash
    const regionStats = {};
    const sexStats = { male: 0, female: 0 };
    const marriageStats = { yes: 0, no: 0 };

    patients.forEach(p => {
      regionStats[p.region] = (regionStats[p.region] || 0) + 1;
      sexStats[p.sex] = (sexStats[p.sex] || 0) + 1;
      if (p.related_marriage) marriageStats.yes++;
      else marriageStats.no++;
    });

    res.render('doctor/dashboard', {
      patient: patient ? (patient.toObject ? patient.toObject() : patient) : null,
      diagnoses: diagnoses ? diagnoses.map(d => d.toObject ? d.toObject() : d) : null,
      patients,
      todayCount,
      myPatientsCount,
      drugs,
      query,
      regionStats: JSON.stringify(regionStats),
      sexStats: JSON.stringify(sexStats),
      marriageStats: JSON.stringify(marriageStats)
    });
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Ma\'lumotlarni yuklashda xatolik');
    res.redirect('/doctor');
  }
});

// Mening bemorlarim
router.get('/my-patients', ensureAuthenticated, ensureDoctor, async (req, res) => {
  try {
    const { page = 1 } = req.query;
    const limit = 20;
    const skip = (page - 1) * limit;

    // Shifokor tashxis qo'ygan bemorlar
    const patientIds = await Diagnosis.find({ doctor: req.user._id }).distinct('patient');
    
    const total = patientIds.length;
    const totalPages = Math.ceil(total / limit);
    
    const patients = await Patient.find({ _id: { $in: patientIds } })
      .sort({ patient_add_date: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // Har bir bemor uchun oxirgi tashxis sanasini olish
    for (let patient of patients) {
      const lastDiagnosis = await Diagnosis.findOne({ 
        patient: patient._id, 
        doctor: req.user._id 
      }).sort({ created_at: -1 });
      patient.lastDiagnosisDate = lastDiagnosis ? lastDiagnosis.created_at : null;
    }

    res.render('doctor/my-patients', {
      patients,
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
    res.redirect('/doctor');
  }
});

// Profil sahifasi
router.get('/profile', ensureAuthenticated, ensureDoctor, (req, res) => {
  res.render('doctor/profile');
});

// Profilni yangilash
router.post('/profile', ensureAuthenticated, ensureDoctor, async (req, res) => {
  try {
    const { name, address, current_password, new_password, new_password2 } = req.body;
    const user = await User.findById(req.user._id);

    // Asosiy ma'lumotlarni yangilash
    if (name) user.name = sanitize(name);
    if (address) user.address = sanitize(address);

    // Parolni o'zgartirish
    if (current_password && new_password) {
      const isMatch = await user.matchPassword(current_password);
      if (!isMatch) {
        req.flash('error_msg', 'Joriy parol noto\'g\'ri');
        return res.redirect('/doctor/profile');
      }

      if (new_password !== new_password2) {
        req.flash('error_msg', 'Yangi parollar mos kelmadi');
        return res.redirect('/doctor/profile');
      }

      if (new_password.length < 6) {
        req.flash('error_msg', 'Parol kamida 6 ta belgidan iborat bo\'lishi kerak');
        return res.redirect('/doctor/profile');
      }

      user.password = new_password;
    }

    await user.save();
    req.flash('success_msg', 'Profil yangilandi');
    res.redirect('/doctor/profile');
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Yangilashda xatolik');
    res.redirect('/doctor/profile');
  }
});

// Bemor qo'shish
router.post('/patients/add', ensureAuthenticated, ensureDoctor, async (req, res) => {
  try {
    const {
      name, card_number, sex, region, district, birthday, age,
      related_marriage, child_pnfl, mother_name, mother_id_number,
      mother_work_place, father_name, father_id_number, father_work_place,
      full_address, phone_number, second_number
    } = req.body;

    // PNFL validatsiyasi
    const cleanPnfl = child_pnfl.replace(/\s/g, '');
    if (!/^\d{14}$/.test(cleanPnfl)) {
      req.flash('error_msg', 'PNFL 14 ta raqamdan iborat bo\'lishi kerak');
      return res.redirect('/doctor');
    }

    const existingPatient = await Patient.findOne({ child_pnfl: cleanPnfl });

    if (existingPatient) {
      req.flash('error_msg', 'Ushbu PNFL bilan bemor allaqachon mavjud');
      return res.redirect('/doctor');
    }

    const newPatient = new Patient({
      name: sanitize(name),
      card_number: sanitize(card_number),
      sex,
      region,
      district: sanitize(district),
      birthday: new Date(birthday),
      age: parseInt(age),
      related_marriage: related_marriage === 'on',
      child_pnfl: cleanPnfl,
      mother_name: sanitize(mother_name),
      mother_id_number: sanitize(mother_id_number.replace(/\s/g, '')),
      mother_work_place: sanitize(mother_work_place),
      father_name: sanitize(father_name),
      father_id_number: sanitize(father_id_number.replace(/\s/g, '')),
      father_work_place: sanitize(father_work_place),
      full_address: sanitize(full_address),
      phone_number: sanitize(phone_number),
      second_number: sanitize(second_number)
    });

    await newPatient.save();
    req.flash('success_msg', `${name} muvaffaqiyatli qo'shildi!`);
    res.redirect(`/doctor?q=${newPatient.child_pnfl}`);
  } catch (err) {
    console.error(err);
    if (err.code === 11000) {
      req.flash('error_msg', 'Bu PNFL bilan bemor allaqachon mavjud');
    } else {
      req.flash('error_msg', `Bemor qo'shishda xato: ${err.message}`);
    }
    res.redirect('/doctor');
  }
});

// Tashxis qo'shish
router.post('/diagnosis/add', ensureAuthenticated, ensureDoctor, async (req, res) => {
  try {
    const {
      patient_id, shikoyat, tashxis, ogirligi, boyi,
      spirometriya, irt, sweat_test, genetik_test,
      davolash, dorilar, izohlar
    } = req.body;

    if (!patient_id) {
      req.flash('error_msg', 'Bemor tanlanmagan!');
      return res.redirect('/doctor');
    }

    const patient = await Patient.findById(patient_id);
    if (!patient) {
      req.flash('error_msg', 'Bemor topilmadi!');
      return res.redirect('/doctor');
    }

    const newDiagnosis = new Diagnosis({
      patient: patient_id,
      doctor: req.user._id,
      shikoyat: sanitize(shikoyat),
      tashxis: sanitize(tashxis),
      ogirligi: parseFloat(String(ogirligi).replace(',', '.')) || 0,
      boyi: parseInt(boyi) || 0,
      spirometriya: sanitize(spirometriya),
      irt: sanitize(irt),
      sweat_test: sanitize(sweat_test),
      genetik_test: sanitize(genetik_test),
      davolash: sanitize(davolash),
      dorilar: Array.isArray(dorilar) ? dorilar : (dorilar ? [dorilar] : []),
      izohlar: sanitize(izohlar)
    });

    await newDiagnosis.save();
    req.flash('success_msg', `${patient.name} uchun yangi tashxis saqlandi!`);
    res.redirect(`/doctor?q=${patient.child_pnfl}`);
  } catch (err) {
    console.error(err);
    req.flash('error_msg', `Tashxis saqlashda xato: ${err.message}`);
    res.redirect('/doctor');
  }
});

module.exports = router;
