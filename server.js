var ifttt = true;
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
  
  const users = new Datastore({ filename: 'users.db', autoload: true })

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
    res.render('index.ejs', { name: (await getUserById(req._passport.session.user)).name, incorrect: (await getUserById(req._passport.session.user)).incorrect })
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

  // Failure counter

  app.get('/fail', checkNotAuthenticated, (req, res) => {
    users.find({ email: req.query.email }, function (err, docs) {
      if (err) res.sendStatus(500)
      if (docs[0].incorrect >= 1) {
        users.update({ email: req.query.email }, { $set: { incorrect: docs[0].incorrect + 1 } }, {}, (err) => {
          if (err) return res.sendStatus(500)
          res.status(200).send((docs[0].incorrect + 1).toString())
        })
      } else {
        users.update({ email: req.query.email }, { $set: { incorrect: 1 } }, {}, (err) => {
          if (err) return res.sendStatus(500)
          res.status(200).send("1")
        })
      }
    })
  })

  // Reset

  app.get('/reset', checkAuthenticated, (req, res) => {
    users.update({ id: req._passport.session.user }, { $set: { incorrect: 0 } }, {}, (err) => {
      if (err) return res.sendStatus(500)
      res.send("Success")
    })
  })

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
      dbForUser.insert(entry, function(err, doc) {
        if (err) return res.redirect('/database?error=true')
        res.redirect('/database?created=true')
      })
  })

  // Delete a certain entry

  app.get('/database/delete', checkAuthenticated, (req, res) => {
      var userId = req._passport.session.user
      var dbForUser = new Datastore('./passwords/' + userId + '.db')
      dbForUser.loadDatabase()
      dbForUser.remove({ code: req.query.code }, {}, function (err, numRemoved) {
        if ((err) || (numRemoved === 0)) {
          return res.sendStatus(500)
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
                  res.sendStatus(500)
                } else if (numReplaced == 1) {
                  res.status(200).send("Success")
                } else if (err) {
                  res.sendStatus(500)
                } else {
                  res.sendStatus(500)
                }
              })
              break;
          case "link":
              dbForUser.update({ code: req.query._code }, { $set: { link: sanitizeHtml(req.query.update) } }, {}, function (err, numReplaced) {
                if (numReplaced == 0) {
                  res.sendStatus(500)
                } else if (numReplaced == 1) {
                  res.status(200).send("Success")
                } else if (err) {
                  res.sendStatus(500)
                } else {
                  res.sendStatus(500)
                }
              })
              break;
          case "name":
              dbForUser.update({ code: req.query._code }, { $set: { name: sanitizeHtml(req.query.update) } }, {}, function (err, numReplaced) {
                if (numReplaced == 0) {
                  res.sendStatus(500)
                } else if (numReplaced == 1) {
                  res.status(200).send("Success")
                } else if (err) {
                  res.sendStatus(500)
                } else {
                  res.sendStatus(500)
                }
              })
              break;
          case "password":
              dbForUser.update({ code: req.query._code }, { $set: { password: encrypt(sanitizeHtml(req.query.update)) } }, {}, function (err, numReplaced) {
                if (numReplaced == 0) {
                  res.sendStatus(500)
                } else if (numReplaced == 1) {
                  res.status(200).send("Success")
                } else if (err) {
                  res.sendStatus(500)
                } else {
                  res.sendStatus(500)
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
  if (ifttt) {
  axios
      .post('https://maker.ifttt.com/trigger/pman_del/with/key/' + process.env.IFTTT, body)
      .then(response => {
        if (response.data == "Congratulations! You've fired the pman_del event") {
          res.send("Success")
        }
      })
      .catch(err => {
        res.status(500).send("Error")
      })
    }
  var userId = req.query.id
  var dbForUser = new Datastore('./passwords/' + userId + '.db')
  dbForUser.loadDatabase()
  dbForUser.remove({}, { multi: true }, function (err, numRemoved) {
    if (err) return res.sendStatus(500)
    users.remove({ id: userId }, {}, function (err, numRemoved) {
      if ((err) || (numRemoved == 0)) return res.sendStatus(500)
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
  if (!ifttt) {
    return res.send("Not enabled")
  }
    const bodyR = req.body
    const body = {
      value1: bodyR.problem,
      value2: (await getUserById(req._passport.session.user)).name
    }
    axios
      .post('https://maker.ifttt.com/trigger/pman_issue/with/key/' + process.env.IFTTT, body)
      .then(response => {
        if (response.data == "Congratulations! You've fired the pman_issue event") {
          res.send("Success")
        }
      })
      .catch(err => {
        res.status(500).send("Error")
      })
  })

  // Background

  app.get('/lights', (req, res) => {
    res.sendFile('/home/pi/PassMan/Password-Manager-2.0/polar-lights-5858656_1920.jpg')
  })

  // Bulk delete

  app.get('/bulkdel', (req, res) => {
    var dbForUser = new Datastore('./passwords/' + req._passport.session.user + '.db')
    dbForUser.loadDatabase()
    var error;
    var arr = req.query.del.split(',')
    for (let code in arr) {
      dbForUser.remove({ code: arr[code] }, {}, (err, n) => {
        if (err || n == 0) {
          console.log("error :(")
          error = true;
        }
      })
    }
    if (!error) {
      res.status(200).send("Success")
    } else {
      res.status(500).send("Error")
    }
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