const mongoose = require('mongoose');

const scoreSchema = new mongoose.Schema({
  componentId: mongoose.Schema.Types.ObjectId, // Ref to ChildComponent
  value: mongoose.Schema.Types.Mixed // Can be number or text
});

const assessmentEntrySchema = new mongoose.Schema({
  reviewer: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  type: { type: String, enum: ['MAIN', 'PEER'], required: true },
  scores: [scoreSchema], // Array of scores for each child component
  note: String, // General note/testimony from this reviewer
  submittedAt: Date
});

const assessmentSchema = new mongoose.Schema({
  candidate: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  mainReviewer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  peerReviewers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  template: { type: mongoose.Schema.Types.ObjectId, ref: 'MatrixTemplate', required: true },
  weightMatrix: { type: mongoose.Schema.Types.ObjectId, ref: 'WeightMatrix' },
  status: { type: String, enum: ['PENDING', 'IN_PROGRESS', 'COMPLETED'], default: 'PENDING' },
  
  validator: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  validatorStatus: { type: String, enum: ['PENDING', 'APPROVED', 'REJECTED'], default: 'PENDING' },
  validatorNote: String,

  adminPeer: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  adminPeerInput: {
    feedback: String,
    approved: { type: Boolean, default: null },
    submittedAt: Date
  },

  mainReviewerNote: String, // Note specifically from main reviewer (redundant if in mainAssessment, but good for top-level access)

  mainAssessment: assessmentEntrySchema,
  peerAssessments: [assessmentEntrySchema],
  
  finalScore: { type: Number, default: 0 }
});

// Calculate final score before saving if main assessment is present
assessmentSchema.pre('save', async function() {
  if (this.mainAssessment && this.mainAssessment.scores && this.status === 'COMPLETED') {
    // Logic: Average of Child Components per Parent, then Average of Parents
    // This requires fetching the template to know the structure. 
    // For simplicity in this pre-hook, we might assume the calculation is done by the service/controller 
    // before saving, or we fetch the template here.
    // Let's leave the heavy lifting to the controller for now to avoid async complexity in pre-save 
    // without full context.
  }
});

module.exports = mongoose.model('Assessment', assessmentSchema);
