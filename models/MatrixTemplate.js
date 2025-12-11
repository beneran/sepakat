const mongoose = require('mongoose');

const childComponentSchema = new mongoose.Schema({
  name: { type: String, required: true },
  type: { type: String, enum: ['text', 'rating', 'range'], required: true },
  constraints: {
    min: Number,
    max: Number,
    options: [String] // For select/radio if needed, though rating usually implies 1-N
  }
});

const parentComponentSchema = new mongoose.Schema({
  name: { type: String, required: true },
  children: [childComponentSchema]
});

const matrixTemplateSchema = new mongoose.Schema({
  name: { type: String, required: true },
  components: [parentComponentSchema],
  isActive: { type: Boolean, default: true }
});

module.exports = mongoose.model('MatrixTemplate', matrixTemplateSchema);
