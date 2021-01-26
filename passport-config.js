const LocalStrategy = require('passport-local').Strategy
const bcrypt = require('bcrypt')

async function initialize(passport, users) {
    function getUserByEmail(email) {
        var user = new Promise((resolve, reject) => {
            users.find({ email: email }, function (err, docs) {
                resolve(docs[0]);
            });
        });
        return user;
    }
    function getUserById(id) {
        var user = new Promise((resolve, reject) => {
            users.find({ id: id }, function (err, docs) {
                resolve(docs[0]);
            });
        });
        return user;
    }
    
  const authenticateUser = async (email, password, done) => {
    const user = await getUserByEmail(email)
    if (user == null) {
      return done(null, false, { message: 'No user with that email' })
    }

    try {
      if (await bcrypt.compare(password, user.password)) {
        return done(null, user)
      } else {
        return done(null, false, { message: 'Password incorrect ' + email })
      }
    } catch (e) {
      return done(e)
    }
  }

  passport.use(new LocalStrategy({ usernameField: 'email' }, authenticateUser))
  passport.serializeUser((user, done) => done(null, user.id))
  passport.deserializeUser((id, done) => {
    return done(null, getUserById(id))
  })
}

module.exports = initialize