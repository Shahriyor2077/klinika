const mongoose = require('mongoose');
const Drug = require('../models/Drug');
const User = require('../models/User');
require('dotenv').config();

const drugs = [
  'Pulmozyme (Dornase alfa)',
  'Creon (Pancrelipase)',
  'Kalydeco (Ivacaftor)',
  'Orkambi (Lumacaftor/Ivacaftor)',
  'Symdeko (Tezacaftor/Ivacaftor)',
  'Trikafta (Elexacaftor/Tezacaftor/Ivacaftor)',
  'Azithromycin',
  'Tobramycin',
  'Colistin',
  'Vitamin A',
  'Vitamin D',
  'Vitamin E',
  'Vitamin K',
  'Ursodeoxycholic acid'
];

const seedDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB ulandi');

    // Dorilarni qo'shish
    await Drug.deleteMany({});
    for (const name of drugs) {
      await Drug.create({ name });
    }
    console.log('Dorilar qo\'shildi');

    // Eski adminni o'chirish va yangisini yaratish
    await User.deleteOne({ phone: 'admin' });
    
    // Admin yaratish - role aniq belgilangan
    const adminData = {
      name: 'Admin',
      phone: 'admin',
      password: 'admin123',
      address: 'Toshkent',
      role: 'admin',
      is_approved: true,
      can_export: true
    };
    
    const newAdmin = new User(adminData);
    await newAdmin.save();
    
    // Tekshirish
    const savedAdmin = await User.findOne({ phone: 'admin' });
    console.log('Admin yaratildi:');
    console.log('  Login: admin');
    console.log('  Parol: admin123');
    console.log('  Role:', savedAdmin.role);

    // Test shifokor yaratish
    await User.deleteOne({ phone: '998901234567' });
    
    const testDoctor = new User({
      name: 'Test Shifokor',
      phone: '998901234567',
      password: '123456',
      address: 'Toshkent shahar, 1-klinika',
      role: 'doctor',
      is_approved: true,
      can_export: false
    });
    
    await testDoctor.save();
    console.log('\nTest shifokor yaratildi:');
    console.log('  Telefon: 998901234567');
    console.log('  Parol: 123456');

    console.log('\nSeed muvaffaqiyatli yakunlandi!');
    process.exit(0);
  } catch (err) {
    console.error('Seed xatosi:', err);
    process.exit(1);
  }
};

seedDB();
