const mongoose = require('mongoose');

const PatientSchema = new mongoose.Schema({
  patient_code: {
    type: String,
    unique: true
  },
  name: {
    type: String,
    required: true
  },
  card_number: {
    type: String,
    default: ''
  },
  sex: {
    type: String,
    enum: ['male', 'female'],
    required: true
  },
  region: {
    type: String,
    enum: [
      'andijon', 'buxoro', 'fargona', 'jizzax', 'xorazm',
      'namangan', 'navoiy', 'qashqadaryo', 'samarqand',
      'sirdaryo', 'surxondaryo', 'toshkent_vil', 'toshkent_sh'
    ],
    required: true
  },
  district: {
    type: String,
    required: true
  },
  birthday: {
    type: Date,
    required: true
  },
  age: {
    type: Number,
    required: true
  },
  related_marriage: {
    type: Boolean,
    default: false
  },
  child_pnfl: {
    type: String,
    unique: true,
    required: true,
    maxlength: 14
  },
  mother_name: {
    type: String,
    required: true
  },
  mother_id_number: {
    type: String,
    required: true
  },
  mother_work_place: {
    type: String,
    default: ''
  },
  father_name: {
    type: String,
    required: true
  },
  father_id_number: {
    type: String,
    required: true
  },
  father_work_place: {
    type: String,
    default: ''
  },
  full_address: {
    type: String,
    required: true
  },
  phone_number: {
    type: String,
    required: true
  },
  second_number: {
    type: String,
    default: ''
  },
  patient_add_date: {
    type: Date,
    default: Date.now
  }
});

// Avtomatik patient_code yaratish (atomic)
PatientSchema.pre('save', async function(next) {
  if (!this.patient_code) {
    // Race condition oldini olish uchun retry logic
    let attempts = 0;
    const maxAttempts = 5;
    
    while (attempts < maxAttempts) {
      try {
        const lastPatient = await this.constructor.findOne({}, { patient_code: 1 })
          .sort({ patient_code: -1 })
          .collation({ locale: 'en_US', numericOrdering: true });
        
        let newNumber = 1;
        if (lastPatient && lastPatient.patient_code) {
          const lastNumber = parseInt(lastPatient.patient_code.replace('M', '')) || 0;
          newNumber = lastNumber + 1;
        }
        this.patient_code = `M${newNumber}`;
        break;
      } catch (err) {
        attempts++;
        if (attempts >= maxAttempts) throw err;
        await new Promise(r => setTimeout(r, 100 * attempts));
      }
    }
  }
  next();
});

module.exports = mongoose.model('Patient', PatientSchema);
