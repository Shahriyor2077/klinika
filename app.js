const express = require('express');
const { engine } = require('express-handlebars');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const flash = require('connect-flash');
const passport = require('passport');
const methodOverride = require('method-override');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
require('dotenv').config();


const app = express();

// Trust proxy (Render, Heroku uchun)
app.set('trust proxy', 1);

// Passport config
require('./config/passport')(passport);

// MongoDB ulanish
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('MongoDB ulandi'))
  .catch(err => {
    console.error('MongoDB xatosi:', err);
    process.exit(1); // Production'da DB ulanmasa to'xtash
  });

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM signal qabul qilindi');
  await mongoose.connection.close();
  process.exit(0);
});

// Helmet - xavfsizlik headerlari
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdn.jsdelivr.net"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdn.jsdelivr.net"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
      scriptSrcAttr: ["'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://cdn.jsdelivr.net"],
    },
  },
}));

// Rate limiting - umumiy
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 daqiqa
  max: 500,
  message: 'Juda ko\'p so\'rov. Keyinroq urinib ko\'ring.'
});
app.use(generalLimiter);

// Handlebars sozlamalari
app.engine('hbs', engine({
  extname: '.hbs',
  defaultLayout: 'main',
  helpers: require('./helpers/hbs'),
  runtimeOptions: {
    allowProtoPropertiesByDefault: true,
    allowProtoMethodsByDefault: true
  }
}));
app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride('_method'));
app.use(express.static(path.join(__dirname, 'public')));

// Session
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGODB_URI,
    touchAfter: 24 * 3600 // 24 soatda 1 marta yangilash
  }),
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000 // 1 kun
  }
}));

// Passport middleware
app.use(passport.initialize());
app.use(passport.session());

// Flash messages
app.use(flash());

// Global variables
app.use((req, res, next) => {
  res.locals.success_msg = req.flash('success_msg');
  res.locals.error_msg = req.flash('error_msg');
  res.locals.error = req.flash('error');
  res.locals.user = req.user || null;
  next();
});

// Routes
app.use('/', require('./routes/index'));
app.use('/doctor', require('./routes/doctor'));
app.use('/auth', require('./routes/auth'));
app.use('/api', require('./routes/api'));
app.use('/admin', require('./routes/admin'));

// 404 handler
app.use((req, res) => {
  res.status(404).render('errors/404', { layout: 'auth' });
});

// Error handler
app.use((err, req, res, next) => {
  // Production'da xato tafsilotlarini yashirish
  if (process.env.NODE_ENV === 'production') {
    console.error('Error:', err.message);
  } else {
    console.error(err.stack);
  }
  res.status(500).render('errors/500', { layout: 'auth' });
});

const PORT = process.env.PORT;
app.listen(PORT, () => console.log(`Server ${PORT} portda ishlamoqda`));
