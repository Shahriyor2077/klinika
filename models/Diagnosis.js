const mongoose = require('mongoose');

const DiagnosisSchema = new mongoose.Schema({
  patient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient',
    required: true
  },
  doctor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  shikoyat: {
    type: String,
    required: true
  },
  tashxis: {
    type: String,
    required: true
  },
  ogirligi: {
    type: Number,
    required: true
  },
  boyi: {
    type: Number,
    required: true
  },
  spirometriya: {
    type: String,
    default: ''
  },
  irt: {
    type: String,
    default: ''
  },
  sweat_test: {
    type: String,
    default: ''
  },
  genetik_test: {
    type: String,
    default: ''
  },
  davolash: {
    type: String,
    required: true
  },
  dorilar: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Drug'
  }],
  izohlar: {
    type: String,
    default: ''
  },
  created_at: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Diagnosis', DiagnosisSchema);
