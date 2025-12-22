const LocalStrategy = require('passport-local').Strategy;
const User = require('../models/User');

module.exports = function(passport) {
  passport.use(
    new LocalStrategy({ usernameField: 'phone' }, async (phone, password, done) => {
      try {
        const user = await User.findOne({ phone });

        if (!user) {
          return done(null, false, { message: 'Login yoki parol noto\'g\'ri' });
        }

        const isMatch = await user.matchPassword(password);

        if (!isMatch) {
          return done(null, false, { message: 'Login yoki parol noto\'g\'ri' });
        }

        // Parol to'g'ri, lekin tasdiqlanmagan bo'lsa ham kirishga ruxsat
        // (pending sahifasiga yo'naltiriladi)
        return done(null, user);
      } catch (err) {
        return done(err);
      }
    })
  );

  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id, done) => {
    try {
      const user = await User.findById(id);
      done(null, user);
    } catch (err) {
      done(err);
    }
  });
};
