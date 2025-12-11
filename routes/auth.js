const express = require('express');
const router = express.Router();
const User = require('../models/User');

router.get('/login', (req, res) => {
  res.render('login', { error: null });
});

router.post('/login', async (req, res) => {
  const { token } = req.body;
  const user = await User.findOne({ token });
  
  if (!user) {
    return res.render('login', { error: 'Invalid Token' });
  }
  
  res.cookie('token', token, { httpOnly: true });
  
  if (user.role === 'admin') {
    res.redirect('/admin');
  } else {
    res.redirect('/cockpit');
  }
});

router.get('/logout', (req, res) => {
  res.clearCookie('token');
  res.redirect('/login');
});

// Seed route to create initial admin and dummy users
router.get('/seed', async (req, res) => {
  const adminExists = await User.findOne({ role: 'admin' });
  
  let message = '';

  if (!adminExists) {
    await User.create({
      nama: 'Administrator',
      nip: 'ADMIN001',
      nrk: 'ADMIN001',
      jabatan: 'System Admin',
      unit_kerja: 'IT',
      wilayah: 'Pusat',
      role: 'admin',
      token: 'admin-secret-token'
    });
    message += 'Admin created. Token: admin-secret-token<br>';
  } else {
    message += 'Admin already exists.<br>';
  }

  // Seed 30 dummy users
  const userCount = await User.countDocuments({ role: 'user' });
  if (userCount < 30) {
    const jabatans = ['Guru', 'Kepala Sekolah', 'Pengawas', 'Staff TU'];
    const units = ['SMAN 1', 'SMAN 2', 'SMAN 3', 'SMPN 1', 'SMPN 2'];
    const wilayahs = ['Jakarta Pusat', 'Jakarta Selatan', 'Jakarta Barat', 'Jakarta Timur', 'Jakarta Utara'];
    
    const usersToCreate = [];
    for (let i = 1; i <= 30; i++) {
      const nip = `198001012000${i.toString().padStart(4, '0')}`;
      usersToCreate.push({
        nama: `User Peserta ${i}`,
        nip: nip,
        nrk: `NRK${i.toString().padStart(4, '0')}`,
        jabatan: jabatans[Math.floor(Math.random() * jabatans.length)],
        unit_kerja: units[Math.floor(Math.random() * units.length)],
        wilayah: wilayahs[Math.floor(Math.random() * wilayahs.length)],
        role: 'user',
        token: `user${i}`
      });
    }
    
    try {
      // Use insertMany but handle potential duplicates if some exist (though we checked count)
      // For simplicity in this seed, we just try to insert and ignore dup errors individually or just insert
      // Since we generated unique NIPs based on index, if index overlaps with existing, it might fail.
      // Let's just loop and create if not exists.
      for (const u of usersToCreate) {
        const exists = await User.findOne({ nip: u.nip });
        if (!exists) {
            await User.create(u);
        }
      }
      message += 'Added dummy users (up to 30 total). Tokens are user1, user2, etc.';
    } catch (e) {
      message += 'Error seeding users: ' + e.message;
    }
  } else {
    message += 'Users already seeded.';
  }
  
  res.send(message);
});

module.exports = router;
