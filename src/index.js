const express = require('express')
const app_port = process.env.PORT || 3000
const app = express()
const router = express.Router()
const bodyParser = require('body-parser')
const MongoClient = require('mongodb').MongoClient
const connectionString = 'mongodb+srv://team15:Ade123321!@cluster0.3jopa.mongodb.net/myFirstDatabase?retryWrites=true&w=majority'
const cookieParser = require('cookie-parser')
const jwt = require('jsonwebtoken')
const session = require('express-session')
const accessTokenSecret = '6f6794a83fc9f561f1089dc70217f1946e76f7a892d45dedff1c7a3d3b2dacd5c869d30b295716c552a20442a3cf229c2446d6cbf9075ab229e05e9d7377cb3b'
const nodemailer = require('nodemailer')
const alert = require('alert')
var flash = require('express-flash-messages')


MongoClient.connect(connectionString, {
        useUnifiedTopology: true
    })
    .then(client => {
        console.log('Connected to Database')
        const db = client.db('MedicalDB')
        const usersCollection = db.collection('users')
        const appointmentsCollection = db.collection('appointments')


        app.set('view engine', 'ejs')

        app.use(express.static('public'))

        app.use(bodyParser.urlencoded({ extended: true }))
        app.use(bodyParser.json())

        app.use(cookieParser())

        app.use(session({
            secret: 'sosecret',
            saveUninitialized: false,
            resave: false,
            cookie: { maxAge: 900000 }
          }))
        
          // middleware to make 'user' available to all template
        app.use(function(req, res, next) {
            res.locals.user_sess = req.session.user_sess 
            res.locals.appointments_sess = req.session.appointments_sess
            res.locals.doc_sess = req.session.doc_sess
            next()
        })

        app.use(async function(req, res, next) {
            var doc = await usersCollection.find({role: 'doctor'}).toArray()
            if(doc.length == 0){ 
                console.log('not found')
                doc = undefined
            } 
            //console.log(doc) 
            req.session.doc_sess = doc
            next()
        })

        app.use(flash())
        
        router.get('/', async function(req, res) {  
            res.status(200).render('home')
        })


        router.get('/login', checkToken, function(req, res) {
            const { role } = req.user
                // only users who are not login can enter
            if (role == -1 || role == undefined) {
                return res.status(200).render('login')
            }
            alert('You are already logged in, if you want to connect to another account you are welcome but you must log out before')
            return res.redirect('/')
        })

        router.post('/login', (req, res) => {
            usersCollection.findOne({ email: req.body.email }, function(err, user_db) {
                if (user_db) {
                    if (user_db.password === req.body.pass) {
                        console.log('User and password is correct')
                        const accessToken = jwt.sign({ email: user_db.email, role: user_db.role, user_name: user_db.user_name }, accessTokenSecret)
                        res.cookie('authcookie', accessToken, { maxAge: 900000, httpOnly: true })
                        req.session.user_sess = user_db
                        return res.redirect('/')
                    }
                }
                if (err) {
                    console.log('THIS IS ERROR RESPONSE')
                    return res.json(err)
                }
                if (req.body.email !== undefined && req.body.pass !== undefined) {
                    req.flash('danger', 'Invalid email or password, please try again.')
                    res.locals.message = req.flash()  
                    res.redirect('/login')
                }
            })
        })

        router.get('/signup', checkToken, function(req, res) {
            const { role } = req.user
                // only users who are not login can enter
            if (role == -1 || role == undefined) {
                return res.status(200).render('signup')
            }
            //alert('You are already logged in, if you want to sign up you are welcome but you must log out before')
            return res.redirect('/')
        })

        router.post('/signup', async (req, res) => {
            let unique_email = await usersCollection.findOne({email: req.body.email})
            if (unique_email) {
                req.flash('danger', 'Email already exists in system, please try with another email.')
                res.locals.message = req.flash()  
                return res.redirect('/signup')
            }
            let unique_username = await usersCollection.findOne({user_name: req.body.user_name})
            if (unique_username) {
                req.flash('danger', 'UserName already exists in system, please try with another UserName.')
                res.locals.message = req.flash()  
                return res.redirect('/signup')
            }
            req.body.role = 'simple_user'
            usersCollection.insertOne(req.body).catch(error => console.error(error))
            req.flash('success', 'Your registration was successful, please enter the details you registered with and log in.')
            res.locals.message = req.flash()
            res.redirect('/login')
        })

        router.get('/test', checkToken, function(req, res) {
            const { role } = req.user
                //console.log(req.user)

            if (role !== 'admin') {
                return res.sendStatus(403)
            }
            res.status(200).render('test')
        })

        router.get('/logout', checkToken, function(req, res) {
            const { role } = req.user
                // Only login users can log out
            if (role == -1 || role == undefined) {
                //alert('You are not a registered user, you have no reason to log out')
                return res.redirect('/')
            }
            req.session.destroy((err) => {
                if(err) {
                    return console.log(err)
                }
            })
            res.clearCookie('authcookie')
            res.redirect('/')
        })

        router.get('/search', checkToken, function(req, res) {
            const { role } = req.user

            if (role == -1 || role == undefined) {
                //alert('You are not a registered user')
                return res.redirect('/')
            }
            res.status(200).render('search')
        })
        router.get('/about', async function(req, res) {
            res.status(200).render('about')
        })


        router.get('/reviews', checkToken, function(req, res) {
            const { role } = req.user

            if (role == -1 || role == undefined) {
                //alert('You are not a registered user')
                return res.redirect('/')
            }
            res.redirect('https://www.tapatalk.com/groups/aden/doctors-reviews-t4.html')
        })

        router.get('/appointments', checkToken, async function(req, res) {
            //console.log(req.session.user_sess.clinic)
            const { role } = req.user 
            if (role == -1 || role == undefined) {
                //alert('You are not a registered user')
                return res.redirect('/')
            }
            
            res.status(200).render('appointments')
        }) 

        router.post('/appointments', checkToken, (req, /*res*/) => {
            req.body.user_name = req.user.user_name 
            appointmentsCollection.insertOne(req.body) 
            
                /*.then(
                    //res.redirect('/')
                )
                .catch(error => console.error(error))*/
        })


        router.get('/details', checkToken, async function(req, res) {

            const { role } = req.user
    
            if (role == -1 || role == undefined) {
                //alert('You are not a registered user')
                return res.redirect('/')
            }
            return res.status(200).render('details')
        })

        router.post('/details', checkToken, async function(req, res) {
            
            var appointment = await appointmentsCollection.find({user_name:req.user.user_name}).toArray()
            if(appointment.length == 0){
                appointment = undefined
            }
            req.session.appointments_sess = appointment
            return res.redirect('appointments-records')

        })
          router.get('/edit_details', async function(req, res) {
       res.status(200).render('edit_details')
   })

        router.get('/appointments-records', checkToken, function(req, res) {
            const { role } = req.user
    
            if (role == -1 || role == undefined) {
                //alert('You are not a registered user')
                return res.redirect('/')
            }
            return res.status(200).render('appointments-records')
        })


        app.use('/', router) //add the router

    })
    .catch(error => console.error(error))


function checkToken(req, res, next) {
    //console.log(req.cookies.authcookie)
    const authcookie = req.cookies.authcookie
    jwt.verify(authcookie, accessTokenSecret, (err, data) => {
        if (err) {
            req.user = -1 //res.sendStatus(403)
            next()
        } else if (data) {
            req.user = data
            next()
        }
    })
}



function sendConfirmationEmail(name, email, ref, date, total_days) {

    // This information is supposed to be hidden in th
    // exposed for the project testers so they can validate the test.
    const transport = nodemailer.createTransport({
        service: 'Hotmail',
        auth: {
            user: 'MedicalAdmi@hotmail.com',
            pass: 'Ade123321!',
        },
    })

    transport.sendMail({
        from: 'MedicalAdmi@hotmail.com',
        to: email,
        subject: 'Confirmation of booking flight insurancet',
        html: `<h1>
t Confirmation</h1>
          <h2>Hello ${name}</h2>
          The insurance will take effect on: ${date} for ${total_days} days <br/>
          Reference number: ${ref}</p> <br/>
          </div>`,
    }).catch(err => console.log(err))
}



module.exports = app.listen(app_port)
console.log(`app is running. port: ${app_port}`)
console.log(`http://127.0.0.1:${app_port}/`)