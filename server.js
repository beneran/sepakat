require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// View Engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Database Connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://192.168.100.44:27017/sepakat')
  .then(() => console.log('MongoDB Connected'))
  .catch(err => console.error(err));

// Routes
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const reviewerRoutes = require('./routes/reviewer');

// Middleware to check auth
const requireAuth = async (req, res, next) => {
  const token = req.cookies.token || req.headers.authorization;
  if (!token) return res.redirect('/login');
  
  const User = require('./models/User');
  const user = await User.findOne({ token });
  if (!user) return res.redirect('/login');
  
  req.user = user;
  res.locals.user = user;
  next();
};

app.use('/', authRoutes);
app.use('/admin', requireAuth, adminRoutes);
app.use('/cockpit', requireAuth, reviewerRoutes);

app.get('/', (req, res) => {
  res.redirect('/login');
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
