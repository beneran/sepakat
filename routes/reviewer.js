const express = require('express');
const router = express.Router();
const Assessment = require('../models/Assessment');
const MatrixTemplate = require('../models/MatrixTemplate');
const User = require('../models/User');

// Evaluate overall status based on stage completion
const evaluateStatus = (assessment) => {
  const mainDone = !!(assessment.mainAssessment && assessment.mainAssessment.scores && assessment.mainAssessment.scores.length);
  const peerRequired = !!assessment.adminPeer;
  const peerDone = !peerRequired || !!(assessment.adminPeerInput && assessment.adminPeerInput.feedback);
  const validatorRequired = !!assessment.validator;
  const validatorDone = !validatorRequired || assessment.validatorStatus !== 'PENDING';

  if (mainDone && peerDone && validatorDone) return 'COMPLETED';
  if (mainDone || peerDone || validatorDone) return 'IN_PROGRESS';
  return 'PENDING';
};

// Helper to calculate score
const calculateScore = (scores, template) => {
  let totalParentScore = 0;
  let parentCount = 0;

  template.components.forEach(parent => {
    let parentSum = 0;
    let childCount = 0;
    
    parent.children.forEach(child => {
      const scoreEntry = scores.find(s => s.componentId.toString() === child._id.toString());
      if (scoreEntry && !isNaN(parseFloat(scoreEntry.value))) {
        parentSum += parseFloat(scoreEntry.value);
        childCount++;
      }
    });

    if (childCount > 0) {
      totalParentScore += (parentSum / childCount);
      parentCount++;
    }
  });

  return parentCount > 0 ? (totalParentScore / parentCount) : 0;
};

router.get('/', async (req, res) => {
  const userId = req.user._id;
  
  // Find assessments where user is main or peer
  const mainAssessments = await Assessment.find({ mainReviewer: userId })
    .populate('candidate')
    .populate('template');
    
  const peerAssessments = await Assessment.find({ peerReviewers: userId })
    .populate('candidate')
    .populate('mainReviewer')
    .populate('template');

  const validatorAssessments = await Assessment.find({ validator: userId })
    .populate('candidate')
    .populate('mainReviewer')
    .populate('template');

  const adminPeerAssessments = await Assessment.find({ adminPeer: userId })
    .populate('candidate')
    .populate('mainReviewer')
    .populate('template');
    
  res.render('cockpit_dashboard', { 
    mainAssessments, 
    peerAssessments, 
    validatorAssessments, 
    adminPeerAssessments, 
    user: req.user 
  });
});

router.get('/assessment/:id', async (req, res) => {
  const assessment = await Assessment.findById(req.params.id)
    .populate('candidate')
    .populate('mainReviewer')
    .populate('peerReviewers')
    .populate('template')
    .populate('weightMatrix');
    
  if (!assessment) return res.status(404).send('Assessment not found');
  
  const isMainReviewer = assessment.mainReviewer._id.equals(req.user._id);
  const isPeerReviewer = assessment.peerReviewers.some(p => p._id.equals(req.user._id));
  const isValidator = assessment.validator && assessment.validator.equals(req.user._id);
  const isAdminPeer = assessment.adminPeer && assessment.adminPeer.equals(req.user._id);
  
  if (!isMainReviewer && !isPeerReviewer && !isValidator && !isAdminPeer) {
    return res.status(403).send('Unauthorized');
  }

  const allUsers = await User.find({ role: 'user' }); // For assigning peers
  const activeScores = (() => {
    if (isValidator || isMainReviewer) {
      return assessment.mainAssessment && assessment.mainAssessment.scores ? assessment.mainAssessment.scores : [];
    }
    if (isPeerReviewer) {
      const pa = (assessment.peerAssessments || []).find(p => p.reviewer && p.reviewer.equals(req.user._id));
      return pa && pa.scores ? pa.scores : [];
    }
    return [];
  })();

  const initialScoreDisplay = activeScores.length && assessment.template 
    ? calculateScore(activeScores, assessment.template) 
    : 0;

  const finalScoreValue = (() => {
    if (typeof assessment.finalScore === 'number' && !isNaN(assessment.finalScore)) return assessment.finalScore;
    if (assessment.mainAssessment && assessment.mainAssessment.scores && assessment.template) {
      return calculateScore(assessment.mainAssessment.scores, assessment.template);
    }
    return 0;
  })();

  const parentAverages = {};
  if (assessment.template) {
    assessment.template.components.forEach(parent => {
      let parentSum = 0;
      let childCount = 0;
      parent.children.forEach(child => {
        const s = activeScores.find(sc => sc.componentId.toString() === child._id.toString());
        const val = s ? parseFloat(s.value) : NaN;
        if (!isNaN(val)) {
          parentSum += val;
          childCount++;
        }
      });
      parentAverages[parent._id.toString()] = childCount > 0 ? (parentSum / childCount).toFixed(2) : '0.00';
    });
  }

  let finalGrade = null;
  if (assessment.weightMatrix && assessment.weightMatrix.grades) {
    // Find grade by matching score within range using operators
    // Sort by min descending to handle any potential overlaps by taking highest matching min
    const sortedGrades = [...assessment.weightMatrix.grades].sort((a, b) => b.min - a.min);
    finalGrade = sortedGrades.find(g => {
      const minOperator = g.minOperator || '>=';
      const maxOperator = g.maxOperator || '<=';
      
      let minMatch = minOperator === '>=' ? finalScoreValue >= g.min : finalScoreValue > g.min;
      let maxMatch = maxOperator === '<=' ? finalScoreValue <= g.max : finalScoreValue < g.max;
      
      return minMatch && maxMatch;
    }) || null;
  }

  const peerStepDone = !assessment.adminPeer || !!(assessment.adminPeerInput && assessment.adminPeerInput.feedback);
  const mainStepDone = !!(assessment.mainAssessment && assessment.mainAssessment.scores && assessment.mainAssessment.scores.length);
  const validatorStepDone = !assessment.validator || assessment.validatorStatus !== 'PENDING';

  const progressSteps = [
    { key: 'peer', label: 'Testimoni Peer', required: !!assessment.adminPeer, done: peerStepDone },
    { key: 'main', label: 'Pejabat Penilai', required: true, done: mainStepDone },
    { key: 'validator', label: 'Validator', required: !!assessment.validator, done: validatorStepDone }
  ];

  res.render('cockpit_assessment', { 
    assessment, 
    isMainReviewer, 
    isValidator,
    isAdminPeer,
    isPeerReviewer,
    currentUser: req.user,
    allUsers,
    parentAverages,
    initialScoreDisplay,
    finalScoreValue,
    finalGrade,
    progressSteps,
    mainStepDone,
    peerStepDone,
    toastMessage: req.query.toast || null
  });
});

router.post('/assessment/:id/assign-peer', async (req, res) => {
  const assessment = await Assessment.findById(req.params.id);
  if (!assessment.mainReviewer._id.equals(req.user._id)) {
    return res.status(403).send('Only Main Reviewer can assign peers');
  }
  
  const { peerId } = req.body;
  if (!assessment.peerReviewers.includes(peerId)) {
    assessment.peerReviewers.push(peerId);
    await assessment.save();
  }
  
  res.redirect(`/cockpit/assessment/${assessment._id}`);
});

router.get('/assessment/:id/print', async (req, res) => {
  const assessment = await Assessment.findById(req.params.id)
    .populate('candidate')
    .populate('mainReviewer')
    .populate('validator')
    .populate('adminPeer')
    .populate('template')
    .populate('weightMatrix');
    
  // Security check
  if (!assessment.mainReviewer._id.equals(req.user._id) && 
      !assessment.candidate._id.equals(req.user._id) &&
      !(assessment.validator && assessment.validator.equals(req.user._id)) &&
      !(assessment.adminPeer && assessment.adminPeer.equals(req.user._id))) {
     return res.status(403).send('Unauthorized');
  }

  res.render('print_assessment', { assessment, isAdminView: false });
});

router.post('/assessment/:id/remove-peer', async (req, res) => {
  const assessment = await Assessment.findById(req.params.id);
  if (!assessment.mainReviewer._id.equals(req.user._id)) {
    return res.status(403).send('Unauthorized');
  }
  
  const { peerId } = req.body;
  assessment.peerReviewers = assessment.peerReviewers.filter(id => !id.equals(peerId));
  // Also remove their assessment if it exists
  assessment.peerAssessments = assessment.peerAssessments.filter(pa => !pa.reviewer.equals(peerId));
  
  await assessment.save();
  res.redirect(`/cockpit/assessment/${assessment._id}`);
});

router.post('/assessment/:id/submit', async (req, res) => {
  const assessment = await Assessment.findById(req.params.id).populate('template');
  const { scores, note } = req.body; // Expecting object { componentId: value } and note
  
  // Transform scores to array format
  const scoreArray = Object.keys(scores).map(key => ({
    componentId: key,
    value: scores[key]
  }));

  if (assessment.mainReviewer._id.equals(req.user._id)) {
    assessment.mainAssessment = {
      reviewer: req.user._id,
      type: 'MAIN',
      scores: scoreArray,
      note: note,
      submittedAt: new Date()
    };
    assessment.mainReviewerNote = note; // Sync to top level
    assessment.status = evaluateStatus(assessment);
    assessment.finalScore = calculateScore(scoreArray, assessment.template);
  } else if (assessment.peerReviewers.some(p => p._id.equals(req.user._id))) {
    // Remove existing peer assessment if any
    assessment.peerAssessments = assessment.peerAssessments.filter(pa => !pa.reviewer.equals(req.user._id));
    
    assessment.peerAssessments.push({
      reviewer: req.user._id,
      type: 'PEER',
      scores: scoreArray,
      note: note,
      submittedAt: new Date()
    });
    
    // Update status to IN_PROGRESS if it was PENDING
    assessment.status = evaluateStatus(assessment);
  } else {
    return res.status(403).send('Unauthorized');
  }
  
  await assessment.save();
  res.json({ success: true }); // Return JSON for client-side redirect
});

router.post('/assessment/:id/validator-action', async (req, res) => {
  const assessment = await Assessment.findById(req.params.id);
  
  if (!assessment.validator || !assessment.validator.equals(req.user._id)) {
    return res.status(403).send('Unauthorized');
  }

  // Check if main reviewer has submitted
  const mainReviewerSubmitted = !!(assessment.mainAssessment && assessment.mainAssessment.scores && assessment.mainAssessment.scores.length);
  if (!mainReviewerSubmitted) {
    return res.status(400).send('Pejabat penilai belum menyelesaikan penilaian. Tunggu sampai penilaian utama selesai sebelum validasi.');
  }

  const { action, note } = req.body; // action: 'approve' or 'reject'
  
  if (action === 'approve') {
    assessment.validatorStatus = 'APPROVED';
  } else if (action === 'reject') {
    assessment.validatorStatus = 'REJECTED';
  }
  
  assessment.validatorNote = note;
  assessment.status = evaluateStatus(assessment);
  
  await assessment.save();
  res.redirect(`/cockpit/assessment/${assessment._id}?toast=validator-updated`);
});

router.post('/assessment/:id/admin-peer-submit', async (req, res) => {
  const assessment = await Assessment.findById(req.params.id);
  
  if (!assessment.adminPeer || !assessment.adminPeer.equals(req.user._id)) {
    return res.status(403).send('Unauthorized');
  }

  const approvedValue = req.body.approved === 'yes' ? true : req.body.approved === 'no' ? false : null;
  assessment.adminPeerInput = {
    feedback: req.body.feedback,
    approved: approvedValue,
    submittedAt: new Date()
  };
  assessment.markModified('adminPeerInput');
  assessment.status = evaluateStatus(assessment);

  await assessment.save();
  res.redirect(`/cockpit/assessment/${assessment._id}?toast=peer-feedback-saved`);
});

module.exports = router;
