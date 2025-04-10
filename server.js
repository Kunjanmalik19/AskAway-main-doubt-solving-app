const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const bodyParser = require('body-parser');
const multer = require('multer');
const path = require('path');
const session = require('express-session');

// Initialize express app
const app = express();

// Middleware for parsing form data
app.use(bodyParser.urlencoded({ extended: true }));

// Serve static files (CSS, JS, images, etc.)
app.use(express.static('public'));

// Serve images from uploads folder
app.use('/uploads', express.static('uploads'));

// Set EJS as templating engine
app.set('view engine', 'ejs');

// Set views folder
app.set('views', path.join(__dirname, 'views'));

// Set up express-session middleware
app.use(session({
    secret: 'your_secret_key',
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 60 * 60 * 1000 }  // Session valid for 1 hour
}));

// MongoDB connection
const mongoURI = 'mongodb://localhost:27017/doubtnlearn';
mongoose.connect(mongoURI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(() => console.log("MongoDB connected to database: doubtnlearn"))
.catch(err => console.log("MongoDB connection error:", err));

// User Schema
const userSchema = new mongoose.Schema({
    name: String,
    email: { type: String, required: true, unique: true },
    age: Number,
    phone: String,
    password: String,
    domain: String,
    accountType: String  // Student, Mentor, Faculty
});

const User = mongoose.model('User', userSchema);

// Doubt Schema
const doubtSchema = new mongoose.Schema({
    userId: mongoose.Schema.Types.ObjectId,
    doubtText: String,
    imagePath: String,
    createdAt: { type: Date, default: Date.now }
});

const Doubt = mongoose.model('Doubt', doubtSchema);

// Book a Session Schema
const bookasessionSchema = new mongoose.Schema({
    userId: mongoose.Schema.Types.ObjectId,
    name: String,
    email: { type: String, required: true },
    phone: String,
    subject: String,
    preferred_time: Date,
    message: String,
});

const Bookasession = mongoose.model('Bookasession', bookasessionSchema);

// Set up storage engine for multer
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, './uploads/');
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

// Initialize the upload middleware
const upload = multer({ storage: storage });

// Login route and session management
app.post('/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        const normalizedEmail = email.toLowerCase().trim();
        const user = await User.findOne({ email: normalizedEmail });

        if (!user) {
            return res.status(404).send("User not found");
        }

        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.status(400).send("Incorrect password");
        }

        // Store userId in session after successful login
        req.session.userId = user._id;
        req.session.name = user.name;

        res.redirect('/dashboard');
    } catch (err) {
        res.status(500).send("Login failed");
    }
});

// Dashboard route to display doubts and booked sessions
app.get('/dashboard', async (req, res) => {
    if (!req.session.userId) {
        return res.status(401).send("You must be logged in to view this page");
    }

    try {
        const user = await User.findById(req.session.userId);
        const doubts = await Doubt.find({ userId: req.session.userId });
        const bookasessions = await Bookasession.find({ userId: req.session.userId });

        res.render('after-login-home', {
            user: {
                name: user.name,
                email: user.email
            },
            doubts,
            bookasessions // Pass booked sessions to the EJS template
        });
    } catch (err) {
        res.status(500).send("Error fetching dashboard data");
    }
});

// Submit new doubt route
app.post('/submit-doubt', upload.single('image'), async (req, res) => {
    if (!req.session.userId) {
        return res.status(401).send("You must be logged in to submit a doubt");
    }

    const { doubt } = req.body;

    const newDoubt = new Doubt({
        userId: req.session.userId,
        doubtText: doubt,
        imagePath: req.file ? req.file.path : null
    });

    try {
        await newDoubt.save();
        res.redirect('/dashboard');
    } catch (err) {
        res.status(500).send("Error submitting doubt");
    }
});

// Signup route
app.post('/signup', async (req, res) => {
    const { name, email, age, phone, password, domain, accountType } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
        return res.status(400).send("Email already exists. Please use a different one.");
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({
        name,
        email,
        age,
        phone,
        password: hashedPassword,
        domain,
        accountType
    });

    try {
        await newUser.save();
        res.send("User registered successfully");
    } catch (err) {
        res.status(500).send("Error signing up");
    }
});

// Book a session route (with session check and date validation)
app.post('/submit-bookasession', async (req, res) => {
    if (!req.session.userId) {
        return res.status(401).send("You must be logged in to book a session");
    }

    const { name, email, phone, subject, preferred_time, message } = req.body;

    // Validate date
    const preferredTime = new Date(preferred_time);
    if (isNaN(preferredTime.getTime())) {
        return res.status(400).send("Invalid date format for preferred time");
    }

    try {
        const newSession = new Bookasession({
            userId: req.session.userId,
            name,
            email,
            phone,
            subject,
            preferred_time: preferredTime,
            message,
        });

        await newSession.save();
        res.redirect('/dashboard');
    } catch (err) {
        res.status(500).send("Error booking your session. Sorry for the inconvenience.");
    }
});

// Route to show login page (static HTML)
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'login.html')); // Serving static HTML
});

// Route to show signup page (static HTML)
app.get('/signup', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'signup.html')); // Serving static HTML
});

// Route to show home page (static HTML)
app.get('/home', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'home.html')); // Serving static HTML
});

// Start server
const PORT = 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
