// DO NOT DELETE

if (process.env.NODE_ENV !== 'production') {
    require('dotenv').config()
}

// Load libraries
  
  const express = require('express')
  const app = express()
  const bodyParser = require('body-parser')
  const bcrypt = require('bcrypt')
  const passport = require('passport')
  const flash = require('express-flash')
  const session = require('express-session')
  const methodOverride = require('method-override')
  const Datastore = require('nedb')
  const { encrypt, decrypt } = require('./crypto')
  const sanitizeHtml = require('sanitize-html')
  const fs = require('fs')
  const axios = require('axios')

  // Load databases
  
  const users = new Datastore('users.db')
  users.loadDatabase();

  // Set up authentication library

  const initializePassport = require('./passport-config')
  const { text, response } = require('express')
  initializePassport(passport, users)

  // Add middlewares
  
  app.set('view-engine', 'ejs')
  app.use(bodyParser.json())
  app.use(express.urlencoded({ extended: false }))
  app.use(flash())
  app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false
  }))
  app.use(passport.initialize())
  app.use(passport.session())
  app.use(methodOverride('_method'))

  // Function to get a user by id
  
  function getUserById(id) {
    var user = new Promise((resolve, reject) => {
        users.find({ id: id }, function (err, docs) {
            resolve(docs[0]);
        });
    });
    return user;
}

// Dynamic sort
/**
    * Function to sort alphabetically an array of objects by some specific key.
    * 
    * @param {String} property Key of the object to sort.
    */
   function dynamicSort(property) {
    var sortOrder = 1;

    if(property[0] === "-") {
        sortOrder = -1;
        property = property.substr(1);
    }

    return function (a,b) {
        if(sortOrder == -1){
            return b[property].localeCompare(a[property]);
        }else{
            return a[property].localeCompare(b[property]);
        }        
    }
  }

// Home page
  
  app.get('/', checkAuthenticated, async (req, res) => {
    res.render('index.ejs', { name: (await getUserById(req._passport.session.user)).name })
  })

  // Login page
  
  app.get('/login', checkNotAuthenticated, (req, res) => {
    res.render('login.ejs')
  })

  // Authentication endpoint
  
  app.post('/login', checkNotAuthenticated, passport.authenticate('local', {
    successRedirect: '/',
    failureRedirect: '/login',
    failureFlash: true
  }))

  // Register page
  
  app.get('/register', checkNotAuthenticated, (req, res) => {
    res.render('register.ejs')
  })

  // Register endpoint
  
  app.post('/register', checkNotAuthenticated, async (req, res) => {
    try {
      const hashedPassword = await bcrypt.hash(req.body.password, 10)
      const newUser = {
          name: req.body.name,
          email: req.body.email,
          password: hashedPassword,
          id: Date.now().toString()
      }
      users.insert(newUser)
      res.redirect('/login')
    } catch {
      res.redirect('/register')
    }
  })

  // Logout endpoint
  
  app.get('/logout', (req, res) => {
    var userId = req._passport.session.user
    req.logOut()
    if (req.query.deleted) {
      res.redirect('/login?deleted=true&id=' + userId)
    } else {
      res.redirect('/login')
    }
  })

  // User-friendly password database

  app.get('/database', checkAuthenticated, async (req, res) => {
    var userId = req._passport.session.user
    var dbForUser = new Datastore('./passwords/' + userId + '.db')
    dbForUser.loadDatabase()
    dbForUser.find({}, (err, docs) => {
        if (err) throw err;
        docs.sort(dynamicSort("code"))
        return res.render('database.ejs', { db: docs })
    })
  })

  // Create new entry

  app.get('/database/create', checkAuthenticated, async (req, res) => {
      var userId = req._passport.session.user
      var dbForUser = new Datastore('./passwords/' + userId + '.db')
      dbForUser.loadDatabase()
      var entry = {
          code: sanitizeHtml(req.query.code.toUpperCase()),
          link: sanitizeHtml(req.query.link),
          name: sanitizeHtml(req.query.name),
          password: encrypt(sanitizeHtml(req.query.password))
      }
      dbForUser.insert(entry)
      res.redirect('/database?created=true')
  })

  // Delete a certain entry

  app.get('/database/delete', checkAuthenticated, (req, res) => {
      var userId = req._passport.session.user
      var dbForUser = new Datastore('./passwords/' + userId + '.db')
      dbForUser.loadDatabase()
      dbForUser.remove({ code: req.query.code }, {}, function (err, numRemoved) {
        if ((err) || (numRemoved === 0)) {
          return res.status(500).send(err);
        }
        res.status(202).send("Success")
      })
    })

  // Update a certain entry

  app.get('/database/update', checkAuthenticated, (req, res) => {
      var userId = req._passport.session.user
      var dbForUser = new Datastore('./passwords/' + userId + '.db')
      dbForUser.loadDatabase()
      if ((!req.query._code) || (!req.query.update)) {
        res.status(400).send("Missing data")
      }
      switch (req.query.toChange) {
          case "code":
              dbForUser.update({ code: req.query._code }, { $set: { code: sanitizeHtml(req.query.update) } }, {}, function (err, numReplaced) {
                if (numReplaced == 0) {
                  res.status(500).send()
                } else if (numReplaced == 1) {
                  res.status(200).send("Success")
                } else if (err) {
                  res.status(500).send()
                } else {
                  res.status(500).send()
                }
              })
              break;
          case "link":
              dbForUser.update({ code: req.query._code }, { $set: { link: sanitizeHtml(req.query.update) } }, {}, function (err, numReplaced) {
                if (numReplaced == 0) {
                  res.status(500).send()
                } else if (numReplaced == 1) {
                  res.status(200).send("Success")
                } else if (err) {
                  res.status(500).send()
                } else {
                  res.status(500).send()
                }
              })
              break;
          case "name":
              dbForUser.update({ code: req.query._code }, { $set: { name: sanitizeHtml(req.query.update) } }, {}, function (err, numReplaced) {
                if (numReplaced == 0) {
                  res.status(500).send()
                } else if (numReplaced == 1) {
                  res.status(200).send("Success")
                } else if (err) {
                  res.status(500).send()
                } else {
                  res.status(500).send()
                }
              })
              break;
          case "password":
              dbForUser.update({ code: req.query._code }, { $set: { password: encrypt(sanitizeHtml(req.query.update)) } }, {}, function (err, numReplaced) {
                if (numReplaced == 0) {
                  res.status(500).send()
                } else if (numReplaced == 1) {
                  res.status(200).send("Success")
                } else if (err) {
                  res.status(500).send()
                } else {
                  res.status(500).send()
                }
              })
              break;
          default:
              res.status(400).send("Missing data")
              break;
      }
  })

  // Search the database

  app.get('/database/search', checkAuthenticated, async (req, res) => {
      var query = sanitizeHtml(req.query.q)
      var userId = req._passport.session.user
      var dbForUser = new Datastore('./passwords/' + userId + '.db')
      dbForUser.loadDatabase()
      function search(q) {
        var results = new Promise((resolve, reject) => {
          dbForUser.find({ code: q }, function (err, docs) {
              resolve(docs);
          });
        });
        return results;
      }
      var results = await search(req.query.q)
      results.sort(dynamicSort("code"))
      res.render('results.ejs', { results: results, query: query })
  })

  // Decrypt passwords

app.get('/database/decrypt', checkAuthenticated, async (req, res) => {
    res.send(await decrypt(JSON.parse(req.query.password)))
})

// Loading dot

app.get('/loadingdot', (req, res) => {
  res.sendFile('/home/pi/PassMan/Password-Manager-2.0/loadingdot.css')
})

// Deleting an account

app.get('/deleteacc', async (req, res) => {
  const body = {
    value1: (await getUserById(req.query.id)).name
  }
  axios
      .post('https://maker.ifttt.com/trigger/pman_del/with/key/cNZQSJyfbxBT3DaurG65DI', body)
      .then(response => {
        if (response.data == "Congratulations! You've fired the pman_del event") {
          res.send("Success")
        }
      })
      .catch(err => {
        res.status(500).send("Error")
      })
  var userId = req.query.id
  var dbForUser = new Datastore('./passwords/' + userId + '.db')
  dbForUser.loadDatabase()
  dbForUser.remove({}, { multi: true }, function (err, numRemoved) {
    if (err) return res.status(500).send()
    users.remove({ id: userId }, {}, function (err, numRemoved) {
      if ((err) || (numRemoved == 0)) return res.status(500).send()
      fs.rename('./passwords/' + userId + '.db', './passwords/removed' + userId + '.db', function() {})
      res.status(200).send("Success");
    })
  })
})

// Bulk import

app.get('/bulkimport', checkAuthenticated, (req, res) => {
  res.render('bulkimport.ejs')
})

app.post('/bulkimport/send', checkAuthenticated, (req, res) => {
  var passwords = req.body
  var dbForUser = new Datastore('./passwords/' + req._passport.session.user + '.db')
  dbForUser.loadDatabase()
  var errors = false;
  for (let password of passwords) {
    var entry = {
      link: sanitizeHtml(password.url.toString()),
      password: encrypt(sanitizeHtml(password.password.toString())),
      name: sanitizeHtml(password.username.toString()),
      code: sanitizeHtml(password.name.toString().toUpperCase())
    }

    let e = false;
    dbForUser.insert(entry, (err, doc) => {
      if (err) {
        e = true
      }
    })

    if (e) {
      errors = true;
      res.status(500).send("Error")
      return;
    }
  }
  if (!errors) {
    res.status(200).send("Success")
  }
})

// Status page

app.get('/status', checkAuthenticated, (req, res) => {
  res.render('status.ejs')
})

// Report issue

app.post('/status', checkAuthenticated, async (req, res) => {
    const bodyR = req.body
    const body = {
      value1: bodyR.problem,
      value2: (await getUserById(req._passport.session.user)).name
    }
    axios
      .post('https://maker.ifttt.com/trigger/pman_issue/with/key/cNZQSJyfbxBT3DaurG65DI', body)
      .then(response => {
        if (response.data == "Congratulations! You've fired the pman_issue event") {
          res.send("Success")
        }
      })
      .catch(err => {
        res.status(500).send("Error")
      })
  })

  // Check authentication
  
  function checkAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
      return next()
    }
  
    res.redirect('/login')
  }

  // Check no authentication
  
  function checkNotAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
      return res.redirect('/')
    }
    next()
  }

  // Listen on port 3000
  
  app.listen(process.env.PORT)