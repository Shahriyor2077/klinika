const mongoose = require('mongoose');
const Drug = require('../models/Drug');
const User = require('../models/User');
require('dotenv').config();

const drugs = [
  { name: 'Pulmozyme (Dornase alfa)', minAge: 5, maxAge: 100, description: '' },
  { name: 'Creon (Pancrelipase)', minAge: 0, maxAge: 100, description: '' },
  { name: 'Kalydeco (Ivacaftor)', minAge: 6, maxAge: 100, description: '' },
  { name: 'Orkambi (Lumacaftor/Ivacaftor)', minAge: 2, maxAge: 100, description: '' },
  { name: 'Symdeko (Tezacaftor/Ivacaftor)', minAge: 6, maxAge: 100, description: '' },
  { name: 'Trikafta (Elexacaftor/Tezacaftor/Ivacaftor)', minAge: 12, maxAge: 100, description: '' },
  { name: 'Azithromycin', minAge: 6, maxAge: 100, description: '' },
  { name: 'Tobramycin', minAge: 6, maxAge: 100, description: '' },
  { name: 'Colistin', minAge: 2, maxAge: 100, description: '' },
  { name: 'Vitamin A', minAge: 0, maxAge: 100, description: '' },
  { name: 'Vitamin D', minAge: 0, maxAge: 100, description: '' },
  { name: 'Vitamin E', minAge: 0, maxAge: 100, description: '' },
  { name: 'Vitamin K', minAge: 0, maxAge: 100, description: '' },
  { name: 'Ursodeoxycholic acid', minAge: 1, maxAge: 100, description: '' },
  { name: 'Paracetamol', minAge: 1, maxAge: 5, description: 'Yarimta istemol qilinadi' },
  { name: 'Trimol', minAge: 12, maxAge: 100, description: '12 yoshdan yuqorisiga' }
];

const seedDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB ulandi');

    // Dorilarni qo'shish
    await Drug.deleteMany({});
    for (const drug of drugs) {
      await Drug.create(drug);
    }
    console.log('Dorilar qo\'shildi (yosh chegarasi bilan)');

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
