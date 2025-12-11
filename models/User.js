const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  nama: { type: String, required: true },
  nip: { type: String, required: true, unique: true },
  nrk: { type: String, required: true },
  jabatan: { type: String, required: true },
  unit_kerja: { type: String, required: true },
  wilayah: { type: String, required: true },
  role: { type: String, enum: ['admin', 'user'], default: 'user' },
  token: { type: String } // Simple token for login
});

module.exports = mongoose.model('User', userSchema);
