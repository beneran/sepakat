const express = require('express');
const router = express.Router();
const User = require('../models/User');
const MatrixTemplate = require('../models/MatrixTemplate');
const Assessment = require('../models/Assessment');
const WeightMatrix = require('../models/WeightMatrix');

const validateWeightGrades = (grades = []) => {
  if (!Array.isArray(grades) || grades.length === 0) {
    throw new Error('Minimal satu range bobot diperlukan.');
  }

  const normalized = grades.map((g, idx) => {
    const min = Number(g.min);
    const max = Number(g.max);
    const minOperator = g.minOperator || '>=';
    const maxOperator = g.maxOperator || '<=';
    
    if (!Number.isFinite(min) || !Number.isFinite(max)) {
      throw new Error(`Range ke-${idx + 1} tidak valid.`);
    }
    if (min > max) {
      throw new Error(`Min lebih besar dari max pada range ke-${idx + 1}.`);
    }
    if (!['>=', '>'].includes(minOperator) || !['<=', '<'].includes(maxOperator)) {
      throw new Error(`Operator tidak valid pada range ke-${idx + 1}.`);
    }
    return { min, minOperator, max, maxOperator, label: g.label, recommendation: g.recommendation };
  }).sort((a, b) => a.min - b.min);

  for (let i = 1; i < normalized.length; i++) {
    const prev = normalized[i - 1];
    const curr = normalized[i];
    if (curr.min > prev.max) {
      throw new Error(`Terdapat celah nilai antara ${prev.max} dan ${curr.min}.`);
    }
    if (curr.min < prev.max) {
      throw new Error(`Range bertumpuk di sekitar nilai ${curr.min}. Pastikan batas min = max sebelumnya atau tidak overlap.`);
    }
  }

  return normalized;
};

router.get('/', async (req, res) => {
  const userCount = await User.countDocuments({ role: 'user' });
  const templateCount = await MatrixTemplate.countDocuments({ isActive: true });
  const assessmentCount = await Assessment.countDocuments();
    
  res.render('admin_dashboard', { userCount, templateCount, assessmentCount });
});

router.get('/templates', async (req, res) => {
  const templates = await MatrixTemplate.find();
  res.render('admin_templates', { templates });
});

router.post('/templates', async (req, res) => {
  try {
    let data = req.body;
    if (req.body.jsonInput) {
        data = JSON.parse(req.body.jsonInput);
    }
    await MatrixTemplate.create(data);
    res.redirect('/admin/templates');
  } catch (err) {
    res.status(400).send(err.message);
  }
});

router.get('/templates/:id/edit', async (req, res) => {
  const template = await MatrixTemplate.findById(req.params.id);
  res.render('admin_template_edit', { template });
});

router.post('/templates/:id', async (req, res) => {
  try {
    let data = req.body;
    if (req.body.jsonInput) {
        data = JSON.parse(req.body.jsonInput);
    }
    await MatrixTemplate.findByIdAndUpdate(req.params.id, data);
    res.redirect('/admin/templates');
  } catch (err) {
    res.status(400).send(err.message);
  }
});

router.post('/templates/:id/delete', async (req, res) => {
  await MatrixTemplate.findByIdAndDelete(req.params.id);
  res.redirect('/admin/templates');
});

router.get('/weights', async (req, res) => {
  const weights = await WeightMatrix.find();
  res.render('admin_weights', { weights, error: null });
});

router.post('/weights', async (req, res) => {
  try {
    let data = req.body;
    if (req.body.jsonInput) {
        data = JSON.parse(req.body.jsonInput);
    }
    data.grades = validateWeightGrades(data.grades);
    await WeightMatrix.create(data);
    res.redirect('/admin/weights');
  } catch (err) {
    const weights = await WeightMatrix.find();
    res.render('admin_weights', { weights, error: err.message });
  }
});

router.get('/weights/:id/edit', async (req, res) => {
  const weight = await WeightMatrix.findById(req.params.id);
  res.render('admin_weight_edit', { weight, error: null });
});

router.post('/weights/:id/update', async (req, res) => {
  try {
    let data = req.body;
    if (req.body.jsonInput) {
        data = JSON.parse(req.body.jsonInput);
    }
    data.grades = validateWeightGrades(data.grades);
    await WeightMatrix.findByIdAndUpdate(req.params.id, data);
    res.redirect('/admin/weights');
  } catch (err) {
    const weight = await WeightMatrix.findById(req.params.id);
    res.render('admin_weight_edit', { weight, error: err.message });
  }
});

router.post('/weights/:id/delete', async (req, res) => {
  await WeightMatrix.findByIdAndDelete(req.params.id);
  res.redirect('/admin/weights');
});

router.get('/assignments', async (req, res) => {
  const users = await User.find();
  const templates = await MatrixTemplate.find({ isActive: true });
  const weights = await WeightMatrix.find({ isActive: true });
  const assessments = await Assessment.find()
    .populate('candidate')
    .populate('mainReviewer')
    .populate('validator')
    .populate('adminPeer')
    .populate('template');
    
  res.render('admin_assignments', { users, templates, assessments, weights });
});

router.post('/assignments', async (req, res) => {
  try {
    const { candidate, mainReviewer, template, validator, adminPeer, weightMatrix } = req.body;
    
    const payload = {
      candidate,
      mainReviewer,
      template,
      status: 'PENDING'
    };

    if (validator) payload.validator = validator;
    if (adminPeer) payload.adminPeer = adminPeer;
    if (weightMatrix) payload.weightMatrix = weightMatrix;

    await Assessment.create(payload);
    res.redirect('/admin/assignments');
  } catch (err) {
    res.status(400).send(err.message);
  }
});

// Deprecated routes kept for safety but not used in new UI
router.post('/users', async (req, res) => {
  try {
    await User.create(req.body);
    res.redirect('/admin');
  } catch (err) {
    res.status(400).send(err.message);
  }
});

router.post('/matrix', async (req, res) => {
  // Redirect to new route
  res.redirect(307, '/admin/templates');
});

router.post('/assign', async (req, res) => {
  // Redirect to new route
  res.redirect(307, '/admin/assignments');
});

router.post('/assignments/:id/delete', async (req, res) => {
  await Assessment.findByIdAndDelete(req.params.id);
  res.redirect('/admin/assignments');
});

router.get('/assignments/export', async (req, res) => {
  try {
    const filter = {};
    if (req.query.template && req.query.template !== 'all') {
      filter.template = req.query.template;
    }

    const assessments = await Assessment.find(filter)
      .populate('candidate')
      .populate('mainReviewer')
      .populate('template');

    let csv = 'Candidate Name,Candidate NIP,Reviewer Name,Template,Status,Final Score,Submitted Date\n';
    
    assessments.forEach(a => {
      const submittedDate = a.mainAssessment && a.mainAssessment.submittedAt 
        ? a.mainAssessment.submittedAt.toISOString().split('T')[0] 
        : '-';
        
      csv += `"${a.candidate.nama}","${a.candidate.nip || '-'}","${a.mainReviewer.nama}","${a.template.name}","${a.status}","${a.finalScore ? a.finalScore.toFixed(2) : '0.00'}","${submittedDate}"\n`;
    });

    res.header('Content-Type', 'text/csv');
    res.attachment('assessments_export.csv');
    res.send(csv);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

router.get('/assignments/:id/print', async (req, res) => {
  const assessment = await Assessment.findById(req.params.id)
    .populate('candidate')
    .populate('mainReviewer')
    .populate('validator')
    .populate('adminPeer')
    .populate('template')
    .populate('weightMatrix');
  res.render('print_assessment', { assessment, isAdminView: true });
});

router.get('/assignments/:id/details', async (req, res) => {
  const assessment = await Assessment.findById(req.params.id)
    .populate('candidate')
    .populate('mainReviewer')
    .populate('template');
  res.json(assessment);
});

router.post('/users/:id/refresh-token', async (req, res) => {
  try {
    const crypto = require('crypto');
    const token = crypto.randomBytes(3).toString('hex').toUpperCase();
    await User.findByIdAndUpdate(req.params.id, { token });
    res.redirect('/admin/assignments');
  } catch (err) {
    res.status(400).send(err.message);
  }
});

router.post('/users/refresh-all-tokens', async (req, res) => {
  try {
    const crypto = require('crypto');
    const users = await User.find({ role: 'user' });
    const updates = users.map(u => ({
      updateOne: {
        filter: { _id: u._id },
        update: { token: crypto.randomBytes(3).toString('hex').toUpperCase() }
      }
    }));
    if (updates.length) {
      await User.bulkWrite(updates);
    }
    res.redirect('/admin/assignments');
  } catch (err) {
    res.status(400).send(err.message);
  }
});

module.exports = router;
