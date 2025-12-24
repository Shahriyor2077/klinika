const express = require('express');
const router = express.Router();
const Patient = require('../models/Patient');
const Diagnosis = require('../models/Diagnosis');
const Drug = require('../models/Drug');
const User = require('../models/User');
const Inventory = require('../models/Inventory');
const Distribution = require('../models/Distribution');
const ExcelJS = require('exceljs');
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

// Barcha bemorlar ro'yxati (viloyat filtri bilan)
router.get('/patients', ensureAuthenticated, ensureDoctor, async (req, res) => {
  try {
    const { search, region, page = 1 } = req.query;
    const limit = 20;
    const skip = (page - 1) * limit;
    let query = {};

    if (search) {
      query.$or = [
        { name: { $regex: sanitize(search), $options: 'i' } },
        { child_pnfl: { $regex: sanitize(search), $options: 'i' } },
        { patient_code: { $regex: sanitize(search), $options: 'i' } }
      ];
    }
    if (region) query.region = region;

    const total = await Patient.countDocuments(query);
    const totalPages = Math.ceil(total / limit);
    const patients = await Patient.find(query)
      .sort({ patient_add_date: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const drugs = await Drug.find().lean();

    res.render('doctor/patients', {
      patients,
      drugs,
      search,
      region,
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

// Bemor profili (birinchi va oxirgi testlar)
router.get('/patients/:id', ensureAuthenticated, ensureDoctor, async (req, res) => {
  try {
    const patient = await Patient.findById(req.params.id).lean();
    if (!patient) {
      req.flash('error_msg', 'Bemor topilmadi');
      return res.redirect('/doctor/patients');
    }

    // Barcha tashxislar
    const allDiagnoses = await Diagnosis.find({ patient: req.params.id })
      .populate('dorilar')
      .populate('doctor', 'name')
      .sort({ created_at: 1 })
      .lean();

    // Birinchi va oxirgi tashxis
    const firstDiagnosis = allDiagnoses.length > 0 ? allDiagnoses[0] : null;
    const lastDiagnosis = allDiagnoses.length > 0 ? allDiagnoses[allDiagnoses.length - 1] : null;

    // Dori tarqatish tarixi
    const distributions = await Distribution.find({ patient: req.params.id })
      .populate('givenBy', 'name')
      .sort({ created_at: -1 })
      .limit(10)
      .lean();

    const drugs = await Drug.find().lean();

    res.render('doctor/patient-profile', {
      patient,
      allDiagnoses,
      firstDiagnosis,
      lastDiagnosis,
      distributions,
      drugs
    });
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Bemor ma\'lumotlarini yuklashda xatolik');
    res.redirect('/doctor/patients');
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

// Bemorlar ro'yxati (AJAX uchun)
router.get('/patients-list', ensureAuthenticated, ensureDoctor, async (req, res) => {
  try {
    const patients = await Patient.find()
      .select('_id name child_pnfl age')
      .sort({ name: 1 })
      .lean();
    res.json(patients);
  } catch (err) {
    console.error(err);
    res.status(500).json([]);
  }
});

// Yoshga mos dorilar (AJAX uchun)
router.get('/drugs-for-age/:age', ensureAuthenticated, ensureDoctor, async (req, res) => {
  try {
    const age = parseInt(req.params.age) || 0;
    const drugs = await Drug.find({
      minAge: { $lte: age },
      maxAge: { $gte: age }
    }).sort({ name: 1 }).lean();
    res.json(drugs);
  } catch (err) {
    console.error(err);
    res.status(500).json([]);
  }
});

// Bemor yoshiga qarab dorilarni olish (AJAX)
router.get('/drugs-by-age/:patientId', ensureAuthenticated, ensureDoctor, async (req, res) => {
  try {
    const patient = await Patient.findById(req.params.patientId);
    if (!patient) {
      return res.status(404).json({ error: 'Bemor topilmadi' });
    }
    
    // Bemor yoshiga mos dorilar
    const drugs = await Drug.find({
      minAge: { $lte: patient.age },
      maxAge: { $gte: patient.age },
      quantity: { $gt: 0 }
    }).sort({ name: 1 }).lean();
    
    res.json({ drugs, patientAge: patient.age });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Xatolik' });
  }
});

// Excel export - faqat ruxsat berilgan shifokorlar uchun
router.get('/export', ensureAuthenticated, ensureDoctor, async (req, res) => {
  try {
    // Ruxsat tekshirish
    if (!req.user.can_export) {
      req.flash('error_msg', 'Sizga Excel eksport qilish ruxsati berilmagan. Admin bilan bog\'laning.');
      return res.redirect('/doctor');
    }

    const workbook = new ExcelJS.Workbook();
    workbook.creator = req.user.name;
    workbook.created = new Date();

    const regionNames = {
      'andijon': 'Andijon', 'buxoro': 'Buxoro', 'fargona': "Farg'ona",
      'jizzax': 'Jizzax', 'xorazm': 'Xorazm', 'namangan': 'Namangan',
      'navoiy': 'Navoiy', 'qashqadaryo': 'Qashqadaryo', 'samarqand': 'Samarqand',
      'sirdaryo': 'Sirdaryo', 'surxondaryo': 'Surxondaryo',
      'toshkent_vil': 'Toshkent vil.', 'toshkent_sh': 'Toshkent sh.'
    };

    // 1. BEMORLAR SHEET
    const patientsSheet = workbook.addWorksheet('Bemorlar');
    patientsSheet.columns = [
      { header: 'Kod', key: 'patient_code', width: 10 },
      { header: 'F.I.O', key: 'name', width: 25 },
      { header: 'PNFL', key: 'child_pnfl', width: 16 },
      { header: 'Jinsi', key: 'sex', width: 10 },
      { header: 'Yoshi', key: 'age', width: 8 },
      { header: 'Tug\'ilgan sana', key: 'birthday', width: 14 },
      { header: 'Viloyat', key: 'region', width: 15 },
      { header: 'Tuman', key: 'district', width: 15 },
      { header: 'Manzil', key: 'full_address', width: 30 },
      { header: 'Telefon', key: 'phone_number', width: 15 },
      { header: 'Qo\'shimcha tel', key: 'second_number', width: 15 },
      { header: 'Ona F.I.O', key: 'mother_name', width: 25 },
      { header: 'Ona ID', key: 'mother_id_number', width: 15 },
      { header: 'Ota F.I.O', key: 'father_name', width: 25 },
      { header: 'Ota ID', key: 'father_id_number', width: 15 },
      { header: 'Qarindosh nikoh', key: 'related_marriage', width: 15 },
      { header: 'Qo\'shilgan sana', key: 'patient_add_date', width: 14 }
    ];
    const patients = await Patient.find().sort({ patient_add_date: -1 }).lean();
    patients.forEach(p => {
      patientsSheet.addRow({
        ...p,
        sex: p.sex === 'male' ? 'Erkak' : 'Ayol',
        region: regionNames[p.region] || p.region,
        related_marriage: p.related_marriage ? 'Ha' : 'Yo\'q',
        birthday: p.birthday ? new Date(p.birthday).toLocaleDateString('uz-UZ') : '',
        patient_add_date: p.patient_add_date ? new Date(p.patient_add_date).toLocaleDateString('uz-UZ') : ''
      });
    });
    patientsSheet.getRow(1).font = { bold: true };
    patientsSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '4F46E5' } };
    patientsSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFF' } };

    // 2. TASHXISLAR SHEET
    const diagnosesSheet = workbook.addWorksheet('Tashxislar');
    diagnosesSheet.columns = [
      { header: 'Sana', key: 'created_at', width: 14 },
      { header: 'Bemor', key: 'patient_name', width: 25 },
      { header: 'Bemor PNFL', key: 'patient_pnfl', width: 16 },
      { header: 'Shifokor', key: 'doctor_name', width: 20 },
      { header: 'Shikoyat', key: 'shikoyat', width: 30 },
      { header: 'Tashxis', key: 'tashxis', width: 30 },
      { header: 'Vazn (kg)', key: 'ogirligi', width: 10 },
      { header: 'Bo\'y (sm)', key: 'boyi', width: 10 },
      { header: 'Spirometriya', key: 'spirometriya', width: 15 },
      { header: 'IRT', key: 'irt', width: 15 },
      { header: 'Sweat test', key: 'sweat_test', width: 15 },
      { header: 'Genetik test', key: 'genetik_test', width: 20 },
      { header: 'Davolash', key: 'davolash', width: 30 },
      { header: 'Dorilar', key: 'dorilar', width: 30 },
      { header: 'Izohlar', key: 'izohlar', width: 25 }
    ];
    const diagnoses = await Diagnosis.find()
      .populate('patient', 'name child_pnfl')
      .populate('doctor', 'name')
      .populate('dorilar', 'name')
      .sort({ created_at: -1 }).lean();
    diagnoses.forEach(d => {
      diagnosesSheet.addRow({
        created_at: d.created_at ? new Date(d.created_at).toLocaleDateString('uz-UZ') : '',
        patient_name: d.patient?.name || '',
        patient_pnfl: d.patient?.child_pnfl || '',
        doctor_name: d.doctor?.name || '',
        shikoyat: d.shikoyat,
        tashxis: d.tashxis,
        ogirligi: d.ogirligi,
        boyi: d.boyi,
        spirometriya: d.spirometriya,
        irt: d.irt,
        sweat_test: d.sweat_test,
        genetik_test: d.genetik_test,
        davolash: d.davolash,
        dorilar: d.dorilar?.map(dr => dr.name).join(', ') || '',
        izohlar: d.izohlar
      });
    });
    diagnosesSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFF' } };
    diagnosesSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '10B981' } };

    // 3. OMBOR SHEET
    const inventorySheet = workbook.addWorksheet('Ombor');
    inventorySheet.columns = [
      { header: 'Turi', key: 'type', width: 12 },
      { header: 'Nomi', key: 'name', width: 25 },
      { header: 'Miqdori', key: 'quantity', width: 10 },
      { header: 'Birlik', key: 'unit', width: 10 },
      { header: 'Min yosh', key: 'minAge', width: 10 },
      { header: 'Max yosh', key: 'maxAge', width: 10 },
      { header: 'Yaroqlilik', key: 'expiryDate', width: 14 },
      { header: 'Qo\'shilgan', key: 'created_at', width: 14 }
    ];
    const inventory = await Inventory.find().sort({ name: 1 }).lean();
    inventory.forEach(i => {
      inventorySheet.addRow({
        type: i.type === 'drug' ? 'Dori' : 'Oziq-ovqat',
        name: i.name,
        quantity: i.quantity,
        unit: i.unit,
        minAge: i.minAge,
        maxAge: i.maxAge,
        expiryDate: i.expiryDate ? new Date(i.expiryDate).toLocaleDateString('uz-UZ') : '',
        created_at: i.created_at ? new Date(i.created_at).toLocaleDateString('uz-UZ') : ''
      });
    });
    inventorySheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFF' } };
    inventorySheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F59E0B' } };

    // 4. TARQATILGAN DORILAR SHEET
    const distributionSheet = workbook.addWorksheet('Tarqatilgan dorilar');
    distributionSheet.columns = [
      { header: 'Sana', key: 'created_at', width: 14 },
      { header: 'Bemor', key: 'patient_name', width: 25 },
      { header: 'Turi', key: 'type', width: 12 },
      { header: 'Mahsulotlar', key: 'items', width: 40 },
      { header: 'Izoh', key: 'comment', width: 25 },
      { header: 'Bergan', key: 'givenBy', width: 20 }
    ];
    const distributions = await Distribution.find()
      .populate('patient', 'name')
      .populate('givenBy', 'name')
      .sort({ created_at: -1 }).lean();
    distributions.forEach(d => {
      distributionSheet.addRow({
        created_at: d.created_at ? new Date(d.created_at).toLocaleDateString('uz-UZ') : '',
        patient_name: d.patient?.name || '',
        type: d.type === 'drug' ? 'Dori' : 'Oziq-ovqat',
        items: d.items?.map(i => `${i.name} (${i.quantity} ${i.unit})`).join(', ') || '',
        comment: d.comment,
        givenBy: d.givenBy?.name || ''
      });
    });
    distributionSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFF' } };
    distributionSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'EC4899' } };

    // 5. SHIFOKORLAR SHEET
    const usersSheet = workbook.addWorksheet('Shifokorlar');
    usersSheet.columns = [
      { header: 'F.I.O', key: 'name', width: 25 },
      { header: 'Telefon', key: 'phone', width: 15 },
      { header: 'Manzil', key: 'address', width: 30 },
      { header: 'Rol', key: 'role', width: 12 },
      { header: 'Tasdiqlangan', key: 'is_approved', width: 12 },
      { header: 'Excel ruxsati', key: 'can_export', width: 12 },
      { header: 'Ro\'yxatdan o\'tgan', key: 'created_at', width: 14 }
    ];
    const users = await User.find({ role: 'doctor' }).sort({ created_at: -1 }).lean();
    users.forEach(u => {
      usersSheet.addRow({
        name: u.name,
        phone: u.phone,
        address: u.address,
        role: u.role === 'admin' ? 'Admin' : 'Shifokor',
        is_approved: u.is_approved ? 'Ha' : 'Yo\'q',
        can_export: u.can_export ? 'Ha' : 'Yo\'q',
        created_at: u.created_at ? new Date(u.created_at).toLocaleDateString('uz-UZ') : ''
      });
    });
    usersSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFF' } };
    usersSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '6366F1' } };

    // 6. DORILAR KATALOGI SHEET
    const drugsSheet = workbook.addWorksheet('Dorilar katalogi');
    drugsSheet.columns = [
      { header: 'Nomi', key: 'name', width: 25 },
      { header: 'Min yosh', key: 'minAge', width: 10 },
      { header: 'Max yosh', key: 'maxAge', width: 10 },
      { header: 'Miqdori', key: 'quantity', width: 10 },
      { header: 'Narxi', key: 'price', width: 12 },
      { header: 'Yaroqlilik', key: 'expiryDate', width: 14 },
      { header: 'Tavsif', key: 'description', width: 30 }
    ];
    const drugs = await Drug.find().sort({ name: 1 }).lean();
    drugs.forEach(d => {
      drugsSheet.addRow({
        name: d.name,
        minAge: d.minAge,
        maxAge: d.maxAge,
        quantity: d.quantity,
        price: d.price,
        expiryDate: d.expiryDate ? new Date(d.expiryDate).toLocaleDateString('uz-UZ') : '',
        description: d.description
      });
    });
    drugsSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFF' } };
    drugsSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '14B8A6' } };

    // Excel faylni yuborish
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=orfan_hisobot_${Date.now()}.xlsx`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Excel yaratishda xatolik');
    res.redirect('/doctor');
  }
});

// ==================== DORI BERISH ====================
// Dori berish sahifasi
router.get('/distribution', ensureAuthenticated, ensureDoctor, async (req, res) => {
  try {
    res.render('doctor/distribution');
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Xatolik');
    res.redirect('/doctor');
  }
});

// Bemor qidirish (dori berish uchun)
router.get('/distribution/search-patient', ensureAuthenticated, ensureDoctor, async (req, res) => {
  try {
    const search = sanitize(req.query.q || '');
    if (!search) return res.status(400).json({ error: 'Qidiruv so\'zi kerak' });
    
    const patient = await Patient.findOne({
      $or: [
        { child_pnfl: search }, 
        { patient_code: { $regex: search, $options: 'i' } }
      ]
    }).lean();
    
    if (!patient) return res.status(404).json({ error: 'Bemor topilmadi' });
    
    const drugInventory = await Inventory.find({
      type: 'drug', 
      quantity: { $gt: 0 }, 
      expiryDate: { $gt: new Date() },
      minAge: { $lte: patient.age }, 
      maxAge: { $gte: patient.age }
    }).lean();
    
    const foodInventory = await Inventory.find({
      type: 'food', 
      quantity: { $gt: 0 }, 
      expiryDate: { $gt: new Date() },
      minAge: { $lte: patient.age }, 
      maxAge: { $gte: patient.age }
    }).lean();
    
    const history = await Distribution.find({ patient: patient._id })
      .sort({ created_at: -1 })
      .limit(20)
      .lean();
    
    res.json({ patient, drugInventory, foodInventory, history });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Xatolik' });
  }
});

// Dori/oziq-ovqat berish
router.post('/distribution/give', ensureAuthenticated, ensureDoctor, async (req, res) => {
  const mongoose = require('mongoose');
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const { type, patient, items, comment } = req.body;
    if (!patient || !items || items.length === 0) {
      return res.status(400).json({ error: 'Ma\'lumotlar to\'liq emas' });
    }
    
    const distributionItems = [];
    for (const item of items) {
      const inventory = await Inventory.findOneAndUpdate(
        { 
          _id: item.inventory, 
          quantity: { $gte: item.quantity } 
        },
        { $inc: { quantity: -item.quantity } },
        { new: true, session }
      );
      
      if (!inventory) {
        await session.abortTransaction();
        return res.status(400).json({ error: 'Mahsulot topilmadi yoki yetarli emas' });
      }
      
      distributionItems.push({ 
        inventory: inventory._id, 
        name: inventory.name, 
        quantity: item.quantity, 
        unit: inventory.unit 
      });
    }
    
    await Distribution.create([{ 
      patient, 
      type, 
      items: distributionItems, 
      comment: sanitize(comment || ''), 
      givenBy: req.user._id 
    }], { session });
    
    await session.commitTransaction();
    res.json({ success: true });
  } catch (err) {
    await session.abortTransaction();
    console.error(err);
    res.status(500).json({ error: 'Xatolik' });
  } finally {
    session.endSession();
  }
});

module.exports = router;
