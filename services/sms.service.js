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
        }
      }
    );

    console.log('SMS yuborildi:', formattedPhone);
    return { success: true, data: response.data };
  } catch (error) {
    console.error('SMS xatosi:', error.response?.data || error.message);
    return { success: false, error: error.response?.data || error.message };
  }
}

function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

module.exports = { sendSms, generateOtp };
