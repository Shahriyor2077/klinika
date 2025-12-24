const axios = require('axios');

async function sendSms(phone, message) {
  try {
    // Telefon raqamni formatlash (998 bilan boshlanishi kerak)
    let formattedPhone = phone.replace(/\D/g, '');
    if (formattedPhone.startsWith('998')) {
      // OK
    } else if (formattedPhone.startsWith('8')) {
      formattedPhone = '998' + formattedPhone.slice(1);
    } else if (formattedPhone.length === 9) {
      formattedPhone = '998' + formattedPhone;
    }

    console.log('SMS yuborilmoqda:', formattedPhone, message);

    const response = await axios.post(
      process.env.SMS_SERVICE_URL,
      {
        mobile_phone: formattedPhone,
        message: message,
        from: '4546'
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.SMS_TOKEN}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      }
    );

    console.log('SMS javob:', response.data);
    
    // Eskiz API muvaffaqiyatli javob
    if (response.data && (response.data.status === 'success' || response.data.id)) {
      return { success: true, data: response.data };
    }
    
    // Xato javob
    return { success: false, error: response.data };
  } catch (error) {
    console.error('SMS xatosi:', {
      status: error.response?.status,
      data: error.response?.data,
      message: error.message
    });
    
    // Development rejimda SMS yuborilmasa ham davom etish
    if (process.env.NODE_ENV === 'development') {
      console.log('DEV MODE: SMS o\'tkazib yuborildi, OTP:', message);
      return { success: true, data: { dev_mode: true } };
    }
    
    return { success: false, error: error.response?.data || error.message };
  }
}

function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

module.exports = { sendSms, generateOtp };
