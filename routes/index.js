const express = require('express');
const router = express.Router();

// Bosh sahifa - login sahifalariga yo'naltirish
router.get('/', (req, res) => {
  if (req.isAuthenticated()) {
    if (req.user.role === 'admin') {
      return res.redirect('/admin');
    } else {
      if (!req.user.is_approved) {
        return res.redirect('/auth/pending');
      }
      return res.redirect('/doctor');
    }
  }
  // Login qilmagan bo'lsa, shifokor login sahifasiga
  res.redirect('/auth/doctor/login');
});

module.exports = router;
