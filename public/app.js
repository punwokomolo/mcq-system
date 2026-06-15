'use strict';

// ─── Quiz Question Bank ───────────────────────────────────────────────────────
// Questions are display-only on the client. Master answer keys live server-side.
// Server keys: math101→[A,B,C,A,D] | sci101→[B,A,D,C,B] | eng101→[C,A,B,D,C]
const QUIZ_QUESTIONS = {
  math101: {
    questions: [
      {
        text: 'What is the value of π (pi) rounded to 2 decimal places?',
        options: { A: '3.14', B: '3.16', C: '2.71', D: '1.41' }
      },
      {
        text: 'What is 7 × 8?',
        options: { A: '54', B: '56', C: '58', D: '60' }
      },
      {
        text: 'What is √144 (square root of 144)?',
        options: { A: '10', B: '11', C: '12', D: '13' }
      },
      {
        text: 'What is 25% of 80?',
        options: { A: '20', B: '25', C: '15', D: '30' }
      },
      {
        text: 'What is 2³ (2 raised to the power of 3)?',
        options: { A: '6', B: '16', C: '4', D: '8' }
      }
    ]
  },
  sci101: {
    questions: [
      {
        text: 'What is the chemical formula for water?',
        options: { A: 'CO₂', B: 'H₂O', C: 'O₂', D: 'H₂' }
      },
      {
        text: 'What is the approximate speed of light in a vacuum?',
        options: { A: '3 × 10⁸ m/s', B: '3 × 10⁶ m/s', C: '3 × 10¹⁰ m/s', D: '3 × 10⁵ m/s' }
      },
      {
        text: 'Which planet in our solar system is known as the Red Planet?',
        options: { A: 'Venus', B: 'Jupiter', C: 'Saturn', D: 'Mars' }
      },
      {
        text: 'What organelle is known as "the powerhouse of the cell"?',
        options: { A: 'Nucleus', B: 'Ribosome', C: 'Mitochondria', D: 'Chloroplast' }
      },
      {
        text: 'What is the atomic number of Carbon (C)?',
        options: { A: '8', B: '6', C: '12', D: '14' }
      }
    ]
  },
  eng101: {
    questions: [
      {
        text: 'Which sentence uses the correct form of "they\'re / their / there"?',
        options: {
          A: 'Their going to the park.',
          B: 'There car is red.',
          C: 'They\'re going to the park.',
          D: 'There going fast.'
        }
      },
      {
        text: 'Which word functions as an adjective in: "The quick brown fox jumps"?',
        options: { A: 'Quick', B: 'Fox', C: 'Jumps', D: 'The' }
      },
      {
        text: 'What is the simple past tense of the verb "run"?',
        options: { A: 'Runned', B: 'Ran', C: 'Running', D: 'Runs' }
      },
      {
        text: 'Which punctuation mark correctly ends an exclamatory sentence?',
        options: { A: 'Period (.)', B: 'Comma (,)', C: 'Question mark (?)', D: 'Exclamation mark (!)' }
      },
      {
        text: 'Which word is the closest synonym for "happy"?',
        options: { A: 'Sad', B: 'Angry', C: 'Joyful', D: 'Tired' }
      }
    ]
  }
};

// ─── DOM References ───────────────────────────────────────────────────────────
const studentNameEl = document.getElementById('studentName');
const quizSelectEl = document.getElementById('quizSelect');
const tabBtns = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');
const mcqForm = document.getElementById('mcq-form');
const questionsContainer = document.getElementById('questions-container');
const submitFormBtn = document.getElementById('submit-form-btn');
const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const fileNameEl = document.getElementById('file-name');
const gradeFileBtn = document.getElementById('grade-file-btn');
const resultsPanel = document.querySelector('.panel--results');
const resultsPlaceholder = document.getElementById('results-placeholder');
const resultsCard = document.getElementById('results-card');
const ringProgress = document.getElementById('ring-progress');
const ringPct = document.getElementById('ring-pct');
const scoreFraction = document.getElementById('score-fraction');
const gradeBadge = document.getElementById('grade-badge');
const progressFill = document.getElementById('progress-fill');
const progressPct = document.getElementById('progress-pct');
const breakdownList = document.getElementById('breakdown-list');
const resetBtn = document.getElementById('reset-btn');
const historyTbody = document.getElementById('history-tbody');

// ─── App State ────────────────────────────────────────────────────────────────
let selectedFile = null;
let isGrading = false;

// Ring circumference: 2π × r(45) ≈ 282.74
const RING_CIRCUMFERENCE = 2 * Math.PI * 45;

// ─── Entry Point ──────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  await loadQuizzes();
  setupTabs();
  setupForm();
  setupFileUpload();
  setupReset();
  await loadHistory();
});

// ─── Load & Populate Quizzes ─────────────────────────────────────────────────
async function loadQuizzes() {
  try {
    const res = await fetch('/api/quizzes');
    const quizzes = await res.json();

    quizSelectEl.innerHTML = '<option value="">— Select a Quiz —</option>';
    quizzes.forEach(q => {
      const opt = document.createElement('option');
      opt.value = q.id;
      opt.textContent = q.title;
      quizSelectEl.appendChild(opt);
    });
  } catch {
    quizSelectEl.innerHTML = '<option value="">Failed to load quizzes</option>';
  }

  quizSelectEl.addEventListener('change', () => {
    renderQuestions(quizSelectEl.value);
    hideResults();
  });
}

// ─── Render Questions for Selected Quiz ──────────────────────────────────────
function renderQuestions(quizId) {
  mcqForm.reset();
  questionsContainer.innerHTML = '';

  if (!quizId) {
    questionsContainer.innerHTML = '<p class="empty-msg">Select a quiz above to load questions.</p>';
    return;
  }

  const data = QUIZ_QUESTIONS[quizId];
  if (!data) {
    questionsContainer.innerHTML =
      '<p class="empty-msg">No question data for this quiz. Use the File Upload tab instead.</p>';
    return;
  }

  data.questions.forEach((q, idx) => {
    const block = document.createElement('div');
    block.className = 'question-block';
    block.dataset.index = idx;

    block.innerHTML = `
      <p class="question-text">
        <span class="q-num">Q${idx + 1}</span> ${escapeHtml(q.text)}
      </p>
      <div class="options-grid">
        ${Object.entries(q.options).map(([letter, text]) => `
          <label class="option-label">
            <input type="radio" name="q${idx + 1}" value="${letter}" />
            <span class="option-badge">${letter}</span>
            <span class="option-text">${escapeHtml(text)}</span>
          </label>
        `).join('')}
      </div>
    `;

    // Highlight block when an answer is selected
    block.querySelectorAll('input[type="radio"]').forEach(radio => {
      radio.addEventListener('change', () => {
        block.classList.add('answered');
      });
    });

    questionsContainer.appendChild(block);
  });
}

// ─── Tab Switching ────────────────────────────────────────────────────────────
function setupTabs() {
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tabBtns.forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-selected', 'false');
      });
      tabContents.forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      btn.setAttribute('aria-selected', 'true');
      document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
    });
  });
}

// ─── Form Submission ──────────────────────────────────────────────────────────
function setupForm() {
  mcqForm.addEventListener('submit', async e => {
    e.preventDefault();
    if (isGrading) return;

    const name = studentNameEl.value.trim();
    const quizId = quizSelectEl.value;

    if (!name) return toast('Please enter your full name.', true);
    if (!quizId) return toast('Please select a quiz.', true);

    const data = QUIZ_QUESTIONS[quizId];
    if (!data) return toast('No question data found. Try file upload.', true);

    const answers = [];
    for (let i = 1; i <= data.questions.length; i++) {
      const selected = mcqForm.querySelector(`input[name="q${i}"]:checked`);
      if (!selected) {
        return toast(`Please answer Question ${i} before submitting.`, true);
      }
      answers.push(selected.value);
    }

    await gradeAndDisplay('/api/grade-form', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentName: name, quizId, answers })
    }, [submitFormBtn]);
  });
}

// ─── File Upload ──────────────────────────────────────────────────────────────
function setupFileUpload() {
  // Click on drop-zone activates hidden file input
  dropZone.addEventListener('click', e => {
    if (e.target === dropZone || e.target.classList.contains('drop-title') ||
      e.target.classList.contains('drop-sub')) {
      fileInput.click();
    }
  });
  dropZone.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); }
  });

  // File selected via browse
  fileInput.addEventListener('change', e => {
    const file = e.target.files[0] || null;
    applySelectedFile(file);
  });

  // Drag & drop events
  ['dragenter', 'dragover'].forEach(evt => {
    dropZone.addEventListener(evt, e => {
      e.preventDefault();
      dropZone.classList.add('drag-over');
    });
  });
  ['dragleave', 'dragend'].forEach(evt => {
    dropZone.addEventListener(evt, () => dropZone.classList.remove('drag-over'));
  });
  dropZone.addEventListener('drop', e => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (!file) return;
    if (!/\.(txt|csv|json)$/i.test(file.name)) {
      return toast('Invalid file type. Only .txt, .csv, and .json are accepted.', true);
    }
    applySelectedFile(file);
  });

  // Grade file button
  gradeFileBtn.addEventListener('click', async () => {
    if (isGrading) return;

    const name = studentNameEl.value.trim();
    const quizId = quizSelectEl.value;

    if (!name) return toast('Please enter your full name.', true);
    if (!quizId) return toast('Please select a quiz.', true);
    if (!selectedFile) return toast('Please select or drop an answer file.', true);

    const formData = new FormData();
    formData.append('studentName', name);
    formData.append('quizId', quizId);
    formData.append('answerFile', selectedFile);

    await gradeAndDisplay('/api/grade-file', { method: 'POST', body: formData },
      [gradeFileBtn]);
  });
}

function applySelectedFile(file) {
  selectedFile = file;
  if (file) {
    fileNameEl.textContent = file.name;
    dropZone.classList.add('has-file');
  } else {
    fileNameEl.textContent = 'No file selected';
    dropZone.classList.remove('has-file');
  }
}

// ─── Core: Send to API & Display Result ──────────────────────────────────────
async function gradeAndDisplay(url, options, buttons = []) {
  isGrading = true;
  setButtonsLoading(buttons, true);

  try {
    const res = await fetch(url, options);
    const data = await res.json();

    if (!res.ok) {
      toast(data.error || 'Grading failed. Please try again.', true);
      return;
    }

    renderResults(data);
    await loadHistory();
  } catch (e) {
    console.error(e)
    console.log(e.message)
    toast('Network error — make sure the server is running.', true);
  } finally {
    isGrading = false;
    setButtonsLoading(buttons, false);
  }
}

// ─── Render the Report Card ───────────────────────────────────────────────────
function renderResults(data) {
  const { studentName, quizTitle, score, totalQuestions, percentage, breakdown } = data;

  // Header
  document.getElementById('result-name').textContent = studentName;
  document.getElementById('result-quiz').textContent = quizTitle;

  // Score ring
  const offset = RING_CIRCUMFERENCE - (percentage / 100) * RING_CIRCUMFERENCE;
  ringProgress.style.strokeDasharray = RING_CIRCUMFERENCE;
  ringProgress.style.strokeDashoffset = RING_CIRCUMFERENCE;   // reset before animating
  ringProgress.setAttribute('class', `ring-progress ${percentage >= 60 ? 'pass' : 'fail'}`);
  ringPct.className = `ring-pct ${percentage >= 60 ? 'pass' : 'fail'}`;
  ringPct.textContent = `${percentage}%`;

  // Trigger ring animation on next paint
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      ringProgress.style.strokeDashoffset = offset;
    });
  });

  // Score meta
  scoreFraction.textContent = `${score} / ${totalQuestions}`;

  // Grade badge
  const { label, cls } = gradeInfo(percentage);
  gradeBadge.textContent = label;
  gradeBadge.className = `grade-badge ${cls}`;

  // Progress bar
  progressFill.style.width = '0%';
  progressFill.className = `progress-fill ${percentage >= 60 ? 'pass' : 'fail'}`;
  progressPct.textContent = `${percentage}%`;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      progressFill.style.width = `${percentage}%`;
    });
  });

  // Question breakdown
  breakdownList.innerHTML = '';
  breakdown.forEach(item => {
    const row = document.createElement('div');
    row.className = `bd-item ${item.isCorrect ? 'correct' : 'incorrect'}`;

    row.innerHTML = `
      <span class="bd-icon">${item.isCorrect ? '✓' : '✗'}</span>
      <span class="bd-qnum">Q${item.question}</span>
      <span class="bd-answers">
        Your answer: <strong>${escapeHtml(item.given)}</strong>
        ${!item.isCorrect
        ? `<span class="correct-key">&#8594; Correct: <strong>${escapeHtml(item.correct)}</strong></span>`
        : ''}
      </span>
    `;
    breakdownList.appendChild(row);
  });

  // Reveal results card
  resultsPlaceholder.classList.add('hidden');
  resultsCard.classList.remove('hidden');

  // Scroll to results on narrow screens
  if (window.innerWidth < 860) {
    resultsPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } else {
    const top = resultsPanel.getBoundingClientRect().top + window.scrollY - 28;
    window.scrollTo({ top, behavior: 'smooth' });
  }
}

// ─── Load Submission History ──────────────────────────────────────────────────
async function loadHistory() {
  try {
    const res = await fetch('/api/results');
    const rows = await res.json();

    historyTbody.innerHTML = '';

    if (rows.length === 0) {
      historyTbody.innerHTML =
        '<tr class="empty-row"><td colspan="5">No submissions yet &mdash; be the first!</td></tr>';
      return;
    }

    rows.forEach(row => {
      const tr = document.createElement('tr');
      const cls = row.percentage >= 60 ? 'pct-pass' : 'pct-fail';
      const dt = new Date(row.submitted_at);
      const dateStr = isNaN(dt)
        ? row.submitted_at
        : dt.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

      tr.innerHTML = `
        <td>${escapeHtml(row.student_name)}</td>
        <td>${escapeHtml(row.quiz_title || row.quiz_id)}</td>
        <td><strong>${row.score}/${row.total_questions}</strong></td>
        <td class="${cls}">${row.percentage}%</td>
        <td>${dateStr}</td>
      `;
      historyTbody.appendChild(tr);
    });
  } catch {
    historyTbody.innerHTML =
      '<tr class="empty-row"><td colspan="5">Could not load history.</td></tr>';
  }
}

// ─── Reset to Initial State ───────────────────────────────────────────────────
function setupReset() {
  resetBtn.addEventListener('click', () => {
    hideResults();
    mcqForm.reset();
    selectedFile = null;
    fileNameEl.textContent = 'No file selected';
    dropZone.classList.remove('has-file');
    studentNameEl.value = '';
    quizSelectEl.value = '';
    renderQuestions('');
    studentNameEl.focus();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

function hideResults() {
  resultsCard.classList.add('hidden');
  resultsPlaceholder.classList.remove('hidden');
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function gradeInfo(pct) {
  if (pct >= 90) return { label: 'A  —  Excellent!', cls: 'grade-a' };
  if (pct >= 80) return { label: 'B  —  Good Job!', cls: 'grade-b' };
  if (pct >= 70) return { label: 'C  —  Average', cls: 'grade-c' };
  if (pct >= 60) return { label: 'D  —  Below Average', cls: 'grade-d' };
  return { label: 'F  —  Needs Improvement', cls: 'grade-f' };
}

function setButtonsLoading(buttons, loading) {
  buttons.forEach(btn => {
    if (!btn) return;
    btn.disabled = loading;
    if (loading) {
      btn.dataset.origText = btn.innerHTML;
      btn.innerHTML = '<span class="spinner"></span> Grading&hellip;';
    } else if (btn.dataset.origText) {
      btn.innerHTML = btn.dataset.origText;
    }
  });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(String(str)));
  return div.innerHTML;
}

function toast(message, isError = false) {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  const el = document.createElement('div');
  el.className = isError ? 'toast error' : 'toast';
  el.textContent = message;
  document.body.appendChild(el);

  requestAnimationFrame(() => {
    requestAnimationFrame(() => el.classList.add('show'));
  });

  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 300);
  }, 4500);
}
