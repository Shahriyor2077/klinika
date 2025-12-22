const { body, param, query, validationResult } = require('express-validator');
const xss = require('xss');

// XSS tozalash funksiyasi
const sanitize = (value) => {
  if (typeof value === 'string') {
    return xss(value.trim());
  }
  return value;
};

// Validatsiya natijalarini tekshirish
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    if (req.xhr || req.headers.accept?.indexOf('json') > -1) {
      return res.status(400).json({ errors: errors.array() });
    }
    req.flash('error_msg', errors.array().map(e => e.msg).join(', '));
    return res.redirect('back');
  }
  next();
};

// PNFL validatsiyasi
const pnflValidator = body('child_pnfl')
  .trim()
  .isLength({ min: 14, max: 14 }).withMessage('PNFL 14 ta raqamdan iborat bo\'lishi kerak')
  .isNumeric().withMessage('PNFL faqat raqamlardan iborat bo\'lishi kerak')
  .customSanitizer(sanitize);

// Telefon validatsiyasi
const phoneValidator = body('phone')
  .trim()
  .matches(/^(\+?998)?[0-9]{9}$/).withMessage('Telefon raqam noto\'g\'ri formatda')
  .customSanitizer(sanitize);

// Bemor validatsiyasi
const patientValidator = [
  body('name').trim().notEmpty().withMessage('Ism kiritilishi shart').customSanitizer(sanitize),
  body('sex').isIn(['male', 'female']).withMessage('Jinsni tanlang'),
  body('region').notEmpty().withMessage('Viloyatni tanlang'),
  body('district').trim().notEmpty().withMessage('Tumanni kiriting').customSanitizer(sanitize),
  body('birthday').isISO8601().withMessage('Tug\'ilgan sanani kiriting'),
  body('age').isInt({ min: 0, max: 150 }).withMessage('Yoshni to\'g\'ri kiriting'),
  pnflValidator,
  body('mother_name').trim().notEmpty().withMessage('Ona ismini kiriting').customSanitizer(sanitize),
  body('mother_id_number').trim().notEmpty().withMessage('Ona ID raqamini kiriting').customSanitizer(sanitize),
  body('father_name').trim().notEmpty().withMessage('Ota ismini kiriting').customSanitizer(sanitize),
  body('father_id_number').trim().notEmpty().withMessage('Ota ID raqamini kiriting').customSanitizer(sanitize),
  body('full_address').trim().notEmpty().withMessage('Manzilni kiriting').customSanitizer(sanitize),
  body('phone_number').trim().notEmpty().withMessage('Telefon raqamni kiriting').customSanitizer(sanitize),
  validate
];

// Tashxis validatsiyasi
const diagnosisValidator = [
  body('patient_id').isMongoId().withMessage('Bemorni tanlang'),
  body('shikoyat').trim().notEmpty().withMessage('Shikoyatni kiriting').customSanitizer(sanitize),
  body('tashxis').trim().notEmpty().withMessage('Tashxisni kiriting').customSanitizer(sanitize),
  body('ogirligi').isFloat({ min: 0 }).withMessage('Vaznni to\'g\'ri kiriting'),
  body('boyi').isInt({ min: 0 }).withMessage('Bo\'yni to\'g\'ri kiriting'),
  body('davolash').trim().notEmpty().withMessage('Davolashni kiriting').customSanitizer(sanitize),
  validate
];

// Shifokor ro'yxatdan o'tish validatsiyasi
const registerValidator = [
  body('name').trim().notEmpty().withMessage('Ismingizni kiriting').customSanitizer(sanitize),
  phoneValidator,
  body('address').trim().notEmpty().withMessage('Ish joyingizni kiriting').customSanitizer(sanitize),
  body('password').isLength({ min: 6 }).withMessage('Parol kamida 6 ta belgidan iborat bo\'lishi kerak'),
  body('password2').custom((value, { req }) => {
    if (value !== req.body.password) {
      throw new Error('Parollar mos kelmadi');
    }
    return true;
  }),
  validate
];

// OTP validatsiyasi
const otpValidator = [
  body('otp').trim().isLength({ min: 6, max: 6 }).withMessage('Kod 6 ta raqamdan iborat bo\'lishi kerak')
    .isNumeric().withMessage('Kod faqat raqamlardan iborat bo\'lishi kerak'),
  validate
];

// Dori validatsiyasi
const drugValidator = [
  body('name').trim().notEmpty().withMessage('Dori nomini kiriting')
    .isLength({ min: 2, max: 100 }).withMessage('Dori nomi 2-100 belgi orasida bo\'lishi kerak')
    .customSanitizer(sanitize),
  validate
];

// MongoDB ID validatsiyasi
const mongoIdValidator = (field) => [
  param(field).isMongoId().withMessage('Noto\'g\'ri ID'),
  validate
];

module.exports = {
  sanitize,
  validate,
  patientValidator,
  diagnosisValidator,
  registerValidator,
  otpValidator,
  drugValidator,
  mongoIdValidator,
  pnflValidator,
  phoneValidator
};
