module.exports = {
  // Birinchi harfni olish
  substring: function(str, start, end) {
    if (!str) return '';
    return String(str).substring(start, end);
  },

  // Tenglikni tekshirish (block helper)
  eq: function(a, b, options) {
    if (arguments.length === 3) {
      // Block helper sifatida ishlatilgan
      return a === b ? options.fn(this) : options.inverse(this);
    }
    // Oddiy helper sifatida
    return a === b;
  },

  // Katta tekshirish
  gt: function(a, b, options) {
    if (arguments.length === 3 && options && options.fn) {
      return a > b ? options.fn(this) : options.inverse(this);
    }
    return a > b;
  },

  // Kichik tekshirish
  lt: function(a, b, options) {
    if (arguments.length === 3 && options && options.fn) {
      return a < b ? options.fn(this) : options.inverse(this);
    }
    return a < b;
  },

  // Compare helper (taqqoslash uchun)
  compare: function(a, operator, b, options) {
    let result;
    a = parseFloat(a) || 0;
    b = parseFloat(b) || 0;
    
    switch (operator) {
      case '==': result = a == b; break;
      case '===': result = a === b; break;
      case '!=': result = a != b; break;
      case '!==': result = a !== b; break;
      case '<': result = a < b; break;
      case '>': result = a > b; break;
      case '<=': result = a <= b; break;
      case '>=': result = a >= b; break;
      default: result = false;
    }
    
    if (options && options.fn) {
      return result ? options.fn(this) : options.inverse(this);
    }
    return result;
  },
  
  // Sanani formatlash
  formatDate: function(date, format) {
    if (!date) return '';
    const d = new Date(date);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    
    if (format === 'input') {
      return `${year}-${month}-${day}`;
    }
    return `${day}.${month}.${year}`;
  },
  
  // Viloyat nomini olish
  getRegionName: function(region) {
    const regions = {
      'andijon': 'Andijon viloyati',
      'buxoro': 'Buxoro viloyati',
      'fargona': 'Farg\'ona viloyati',
      'jizzax': 'Jizzax viloyati',
      'xorazm': 'Xorazm viloyati',
      'namangan': 'Namangan viloyati',
      'navoiy': 'Navoiy viloyati',
      'qashqadaryo': 'Qashqadaryo viloyati',
      'samarqand': 'Samarqand viloyati',
      'sirdaryo': 'Sirdaryo viloyati',
      'surxondaryo': 'Surxondaryo viloyati',
      'toshkent_vil': 'Toshkent viloyati',
      'toshkent_sh': 'Toshkent shahri'
    };
    return regions[region] || region;
  },
  
  // Jinsni olish
  getSex: function(sex) {
    return sex === 'male' ? 'Erkak' : 'Ayol';
  },
  
  // Select uchun selected
  selected: function(a, b) {
    return a === b ? 'selected' : '';
  },

  // Checkbox uchun checked
  checked: function(a, b) {
    if (Array.isArray(a)) {
      return a.some(item => String(item._id || item) === String(b)) ? 'selected' : '';
    }
    return String(a) === String(b) ? 'checked' : '';
  },
  
  // JSON stringify
  json: function(context) {
    return JSON.stringify(context);
  },
  
  // Massiv uzunligi
  length: function(arr) {
    if (!arr) return 0;
    if (Array.isArray(arr)) return arr.length;
    return 0;
  },
  
  // Ternary operator
  ternary: function(condition, yes, no) {
    return condition ? yes : no;
  },
  
  // Math operatsiyalar
  math: function(a, operator, b) {
    a = parseFloat(a) || 0;
    b = parseFloat(b) || 0;
    switch (operator) {
      case '+': return a + b;
      case '-': return a - b;
      case '*': return a * b;
      case '/': return b !== 0 ? a / b : 0;
      default: return a;
    }
  },

  // Range yaratish (pagination uchun)
  range: function(start, end) {
    const result = [];
    const maxPages = 5;
    let startPage = Math.max(1, start);
    let endPage = Math.min(end, startPage + maxPages - 1);
    
    if (endPage - startPage < maxPages - 1) {
      startPage = Math.max(1, endPage - maxPages + 1);
    }
    
    for (let i = startPage; i <= endPage; i++) {
      result.push(i);
    }
    return result;
  },

  // Includes tekshirish
  includes: function(arr, value) {
    if (!arr) return false;
    if (!Array.isArray(arr)) return false;
    return arr.some(item => String(item._id || item) === String(value));
  },

  // Add helper - raqam qo'shish
  add: function(a, b) {
    return (parseInt(a) || 0) + (parseInt(b) || 0);
  },

  // Index + 1
  inc: function(value) {
    return parseInt(value) + 1;
  }
};
