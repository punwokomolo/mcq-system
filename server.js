'use strict';

const express = require('express');
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');

// ─── DB Adapter ───────────────────────────────────────────────────────────────
// Set SUPABASE_URL + SUPABASE_KEY in the environment to use Supabase (prod).
// When either is absent the server falls back to NeDB flat files (local dev).

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const USE_SUPABASE = !!(SUPABASE_URL && SUPABASE_KEY);

let db;

if (USE_SUPABASE) {
  const { createClient } = require('@supabase/supabase-js');
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  db = {
    async findQuiz(quizId) {
      const { data, error } = await supabase
        .from('quizzes')
        .select('quiz_id, title, master_key')
        .eq('quiz_id', quizId)
        .single();
      // PGRST116 = row not found — not a real error
      if (error && error.code !== 'PGRST116') throw error;
      return data
        ? { quizId: data.quiz_id, title: data.title, masterKey: data.master_key }
        : null;
    },

    async listQuizzes() {
      const { data, error } = await supabase
        .from('quizzes')
        .select('quiz_id, title')
        .order('quiz_id');
      if (error) throw error;
      return data.map(q => ({ id: q.quiz_id, title: q.title }));
    },

    async insertSubmission(record) {
      const { error } = await supabase.from('submissions').insert({
        student_name:    record.studentName,
        quiz_id:         record.quizId,
        quiz_title:      record.quizTitle,
        score:           record.score,
        total_questions: record.totalQuestions,
        percentage:      record.percentage,
        answers:         record.answers,
        submitted_at:    record.submittedAt,
      });
      if (error) throw error;
    },

    async listSubmissions(limit = 25) {
      const { data, error } = await supabase
        .from('submissions')
        .select('id, student_name, quiz_id, quiz_title, score, total_questions, percentage, submitted_at')
        .order('submitted_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data.map(r => ({
        id:              r.id,
        student_name:    r.student_name,
        quiz_id:         r.quiz_id,
        quiz_title:      r.quiz_title,
        score:           r.score,
        total_questions: r.total_questions,
        percentage:      r.percentage,
        submitted_at:    r.submitted_at,
      }));
    },
  };

} else {
  // ── NeDB fallback (local dev) ────────────────────────────────────────────────
  const Datastore = require('@seald-io/nedb');

  const DATA_DIR = path.join(__dirname, 'data');
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

  const quizzesDb     = new Datastore({ filename: path.join(DATA_DIR, 'quizzes.db'),     autoload: true });
  const submissionsDb = new Datastore({ filename: path.join(DATA_DIR, 'submissions.db'), autoload: true });

  quizzesDb.ensureIndex({ fieldName: 'quizId', unique: true });
  submissionsDb.ensureIndex({ fieldName: 'submittedAt' });

  const SEED_QUIZZES = [
    { quizId: 'math101', title: 'Mathematics 101',     masterKey: ['A', 'B', 'C', 'A', 'D'] },
    { quizId: 'sci101',  title: 'General Science 101', masterKey: ['B', 'A', 'D', 'C', 'B'] },
    { quizId: 'eng101',  title: 'English Grammar 101', masterKey: ['C', 'A', 'B', 'D', 'C'] },
  ];

  (async () => {
    for (const quiz of SEED_QUIZZES) {
      const existing = await quizzesDb.findOneAsync({ quizId: quiz.quizId });
      if (!existing) await quizzesDb.insertAsync(quiz);
    }
  })();

  db = {
    async findQuiz(quizId) {
      return quizzesDb.findOneAsync({ quizId });
    },

    async listQuizzes() {
      const all = await quizzesDb.findAsync({});
      return all
        .map(q => ({ id: q.quizId, title: q.title }))
        .sort((a, b) => a.id.localeCompare(b.id));
    },

    async insertSubmission(record) {
      await submissionsDb.insertAsync({
        studentName:    record.studentName,
        quizId:         record.quizId,
        quizTitle:      record.quizTitle,
        score:          record.score,
        totalQuestions: record.totalQuestions,
        percentage:     record.percentage,
        answers:        record.answers,
        submittedAt:    record.submittedAt,
      });
    },

    async listSubmissions(limit = 25) {
      const rows = await submissionsDb
        .findAsync({})
        .sort({ submittedAt: -1 })
        .limit(limit)
        .execAsync();
      return rows.map(r => ({
        id:              r._id,
        student_name:    r.studentName,
        quiz_id:         r.quizId,
        quiz_title:      r.quizTitle,
        score:           r.score,
        total_questions: r.totalQuestions,
        percentage:      r.percentage,
        submitted_at:    r.submittedAt,
      }));
    },
  };
}

// ─── Grading Engine ───────────────────────────────────────────────────────────
function gradeSubmission(studentAnswers, masterKey) {
  let score = 0;
  const breakdown = masterKey.map((correct, i) => {
    const given     = (studentAnswers[i] ?? '').toString().trim().toUpperCase();
    const isCorrect = given === correct.toUpperCase();
    if (isCorrect) score++;
    return { question: i + 1, given: given || '—', correct, isCorrect };
  });
  const percentage = Math.round((score / masterKey.length) * 100);
  return { score, totalQuestions: masterKey.length, percentage, breakdown };
}

// ─── Multer Configuration ─────────────────────────────────────────────────────
const UPLOADS_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename:    (_req, file, cb) => {
    const stamp    = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const safeName = file.originalname.replace(/[^a-z0-9._-]/gi, '_');
    cb(null, `${stamp}-${safeName}`);
  },
});

const upload = multer({
  storage,
  fileFilter: (_req, file, cb) => {
    if (/\.(txt|csv|json)$/i.test(file.originalname)) return cb(null, true);
    cb(new Error('Only .txt, .csv, and .json files are accepted.'), false);
  },
  limits: { fileSize: 512 * 1024 },
});

// ─── Express App ──────────────────────────────────────────────────────────────
const app = express();

app.use(express.json({ limit: '50kb' }));
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));

// ─── Route: GET /api/quizzes ──────────────────────────────────────────────────
app.get('/api/quizzes', async (_req, res) => {
  try {
    res.json(await db.listQuizzes());
  } catch (err) {
    console.error('[quizzes]', err.message);
    res.status(500).json({ error: 'Could not load quizzes.' });
  }
});

// ─── Route: POST /api/grade-form ──────────────────────────────────────────────
app.post('/api/grade-form', async (req, res) => {
  const { studentName, quizId, answers } = req.body;

  if (!studentName?.trim())
    return res.status(400).json({ error: 'Student name is required.' });
  if (!quizId)
    return res.status(400).json({ error: 'Quiz ID is required.' });
  if (!Array.isArray(answers) || answers.length === 0)
    return res.status(400).json({ error: 'Answers must be a non-empty array.' });

  const VALID = new Set(['A', 'B', 'C', 'D']);
  for (const a of answers) {
    if (!VALID.has(a?.toString().toUpperCase()))
      return res.status(400).json({
        error: `Invalid answer value: "${a}". Each answer must be A, B, C, or D.`,
      });
  }

  try {
    const quiz = await db.findQuiz(quizId);
    if (!quiz)
      return res.status(404).json({ error: `Quiz "${quizId}" was not found.` });

    if (answers.length !== quiz.masterKey.length)
      return res.status(400).json({
        error: `Expected ${quiz.masterKey.length} answers but received ${answers.length}.`,
      });

    const result = gradeSubmission(answers, quiz.masterKey);

    await db.insertSubmission({
      studentName:    studentName.trim().substring(0, 100),
      quizId,
      quizTitle:      quiz.title,
      score:          result.score,
      totalQuestions: result.totalQuestions,
      percentage:     result.percentage,
      answers,
      submittedAt:    new Date().toISOString(),
    });

    res.json({ success: true, studentName: studentName.trim(), quizId, quizTitle: quiz.title, ...result });
  } catch (err) {
    console.error('[grade-form]', err.message);
    res.status(500).json({ error: 'Grading failed. Please try again.' });
  }
});

// ─── Route: POST /api/grade-file ──────────────────────────────────────────────
app.post('/api/grade-file', upload.single('answerFile'), async (req, res) => {
  if (!req.file)
    return res.status(400).json({ error: 'No valid file was uploaded.' });

  const { studentName, quizId } = req.body;
  const cleanup = () => fs.unlink(req.file.path, () => {});

  if (!studentName?.trim() || !quizId) {
    cleanup();
    return res.status(400).json({ error: 'studentName and quizId are required.' });
  }

  let answers;
  try {
    const raw = fs.readFileSync(req.file.path, 'utf8').trim();
    if (req.file.originalname.endsWith('.json')) {
      const parsed = JSON.parse(raw);
      answers = Array.isArray(parsed) ? parsed : parsed.answers;
    } else {
      answers = (raw.includes(',') && !raw.includes('\n'))
        ? raw.split(',')
        : raw.split(/\r?\n/);
      answers = answers.map(a => a.trim()).filter(Boolean);
    }
  } catch (err) {
    cleanup();
    return res.status(422).json({ error: `File parse error: ${err.message}` });
  }

  cleanup();

  if (!Array.isArray(answers) || answers.length === 0)
    return res.status(400).json({ error: 'Could not extract answers from the uploaded file.' });

  try {
    const quiz = await db.findQuiz(quizId);
    if (!quiz)
      return res.status(404).json({ error: `Quiz "${quizId}" was not found.` });

    if (answers.length !== quiz.masterKey.length)
      return res.status(400).json({
        error: `Expected ${quiz.masterKey.length} answers but the file contained ${answers.length}.`,
      });

    const result = gradeSubmission(answers, quiz.masterKey);

    await db.insertSubmission({
      studentName:    studentName.trim().substring(0, 100),
      quizId,
      quizTitle:      quiz.title,
      score:          result.score,
      totalQuestions: result.totalQuestions,
      percentage:     result.percentage,
      answers,
      submittedAt:    new Date().toISOString(),
    });

    res.json({ success: true, studentName: studentName.trim(), quizId, quizTitle: quiz.title, ...result });
  } catch (err) {
    console.error('[grade-file]', err.message);
    res.status(500).json({ error: 'Grading failed. Please try again.' });
  }
});

// ─── Route: GET /api/results ──────────────────────────────────────────────────
app.get('/api/results', async (_req, res) => {
  try {
    res.json(await db.listSubmissions(25));
  } catch (err) {
    console.error('[results]', err.message);
    res.status(500).json({ error: 'Could not load results.' });
  }
});

// ─── Error Middleware ─────────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  if (err.code === 'LIMIT_FILE_SIZE')
    return res.status(413).json({ error: 'File too large. Maximum allowed size is 512 KB.' });
  console.error('[Unhandled Error]', err.message);
  res.status(500).json({ error: err.message || 'Internal server error.' });
});

// ─── Start Server ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('');
  console.log('  ┌────────────────────────────────────────────┐');
  console.log('  │   MCQ Grading System  ·  Ready             │');
  console.log(`  │   http://localhost:${PORT}                   │`);
  console.log('  └────────────────────────────────────────────┘');
  console.log('');
  console.log(`  Database       : ${USE_SUPABASE ? 'Supabase (PostgreSQL)' : 'NeDB (local file-based)'}`);
  if (!USE_SUPABASE) {
    console.log('  Seeded quizzes : math101 · sci101 · eng101');
    console.log('  Database files : data/quizzes.db  data/submissions.db');
  }
  console.log('');
});
