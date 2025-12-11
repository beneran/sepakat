const mongoose = require('mongoose');

const weightMatrixSchema = new mongoose.Schema({
  name: { type: String, required: true },
  grades: [{
    min: Number,
    minOperator: { type: String, enum: ['>=', '>'], default: '>=' },
    max: Number,
    maxOperator: { type: String, enum: ['<=', '<'], default: '<=' },
    label: String, // e.g., "Sangat Baik"
    recommendation: String // e.g., "Dapat dipromosikan"
  }],
  isActive: { type: Boolean, default: true }
});

module.exports = mongoose.model('WeightMatrix', weightMatrixSchema);