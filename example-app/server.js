/**
 * Assignment Submission System — Express backend.
 *
 * Auth is intentionally lightweight for a local course tool: the client sends
 * an `x-user-name` and `x-user-role` header (set at login). There are no
 * passwords — this is a teaching/demo app, not a production gradebook.
 */
const express = require('express');
const path = require('path');
const { readDB, writeDB, makeId } = require('./store');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

/* ----------------------------- helpers ----------------------------- */

// Pull the "logged in" identity from headers set by the frontend.
function getUser(req) {
  const name = (req.header('x-user-name') || '').trim();
  const role = (req.header('x-user-role') || '').trim().toLowerCase();
  if (!name || (role !== 'student' && role !== 'instructor')) return null;
  return { name, role };
}

function requireUser(req, res, next) {
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: 'Please log in first.' });
  req.user = user;
  next();
}

function requireInstructor(req, res, next) {
  if (req.user.role !== 'instructor') {
    return res.status(403).json({ error: 'Only instructors can do that.' });
  }
  next();
}

function isPastDeadline(assignment) {
  return new Date(assignment.deadline).getTime() < Date.now();
}

// Attach the calling student's submission + computed status to an assignment.
function decorateForStudent(assignment, db, studentName) {
  const submission = db.submissions.find(
    (s) => s.assignmentId === assignment.id && s.studentName === studentName
  );
  let status = 'not_submitted';
  if (submission && submission.grade != null) status = 'graded';
  else if (submission) status = 'submitted';
  else if (isPastDeadline(assignment)) status = 'missed';

  return {
    ...assignment,
    pastDeadline: isPastDeadline(assignment),
    status,
    submission: submission
      ? {
          id: submission.id,
          content: submission.content,
          submittedAt: submission.submittedAt,
          updatedAt: submission.updatedAt,
          grade: submission.grade,
          maxPoints: assignment.maxPoints,
          feedback: submission.feedback,
          gradedAt: submission.gradedAt,
        }
      : null,
  };
}

/* --------------------------- assignments --------------------------- */

// List assignments. Students get their own status/submission folded in.
app.get('/api/assignments', requireUser, (req, res) => {
  const db = readDB();
  const sorted = [...db.assignments].sort(
    (a, b) => new Date(a.deadline) - new Date(b.deadline)
  );

  if (req.user.role === 'student') {
    return res.json(sorted.map((a) => decorateForStudent(a, db, req.user.name)));
  }

  // Instructor view: include a submission/graded count per assignment.
  const withCounts = sorted.map((a) => {
    const subs = db.submissions.filter((s) => s.assignmentId === a.id);
    return {
      ...a,
      pastDeadline: isPastDeadline(a),
      submissionCount: subs.length,
      gradedCount: subs.filter((s) => s.grade != null).length,
    };
  });
  res.json(withCounts);
});

// Create an assignment (instructor only).
app.post('/api/assignments', requireUser, requireInstructor, (req, res) => {
  const { title, description, deadline, maxPoints } = req.body || {};

  if (!title || !title.trim()) {
    return res.status(400).json({ error: 'Title is required.' });
  }
  if (!deadline || Number.isNaN(new Date(deadline).getTime())) {
    return res.status(400).json({ error: 'A valid deadline is required.' });
  }

  const points = Number(maxPoints);
  const db = readDB();
  const assignment = {
    id: makeId('asg'),
    title: title.trim(),
    description: (description || '').trim(),
    deadline: new Date(deadline).toISOString(),
    maxPoints: Number.isFinite(points) && points > 0 ? points : 100,
    createdBy: req.user.name,
    createdAt: new Date().toISOString(),
  };
  db.assignments.push(assignment);
  writeDB(db).then(() => res.status(201).json(assignment));
});

// Update an assignment / change its deadline (instructor only).
app.put('/api/assignments/:id', requireUser, requireInstructor, (req, res) => {
  const db = readDB();
  const assignment = db.assignments.find((a) => a.id === req.params.id);
  if (!assignment) return res.status(404).json({ error: 'Assignment not found.' });

  const { title, description, deadline, maxPoints } = req.body || {};
  if (title != null) {
    if (!title.trim()) return res.status(400).json({ error: 'Title cannot be empty.' });
    assignment.title = title.trim();
  }
  if (description != null) assignment.description = description.trim();
  if (deadline != null) {
    if (Number.isNaN(new Date(deadline).getTime())) {
      return res.status(400).json({ error: 'A valid deadline is required.' });
    }
    assignment.deadline = new Date(deadline).toISOString();
  }
  if (maxPoints != null) {
    const points = Number(maxPoints);
    if (Number.isFinite(points) && points > 0) assignment.maxPoints = points;
  }
  writeDB(db).then(() => res.json(assignment));
});

// Delete an assignment and its submissions (instructor only).
app.delete('/api/assignments/:id', requireUser, requireInstructor, (req, res) => {
  const db = readDB();
  const exists = db.assignments.some((a) => a.id === req.params.id);
  if (!exists) return res.status(404).json({ error: 'Assignment not found.' });

  db.assignments = db.assignments.filter((a) => a.id !== req.params.id);
  db.submissions = db.submissions.filter((s) => s.assignmentId !== req.params.id);
  writeDB(db).then(() => res.json({ ok: true }));
});

/* --------------------------- submissions --------------------------- */

// Submit or update a submission (student only). Blocked after the deadline.
app.post('/api/assignments/:id/submit', requireUser, (req, res) => {
  if (req.user.role !== 'student') {
    return res.status(403).json({ error: 'Only students can submit.' });
  }
  const { content } = req.body || {};
  if (!content || !content.trim()) {
    return res.status(400).json({ error: 'Submission content cannot be empty.' });
  }

  const db = readDB();
  const assignment = db.assignments.find((a) => a.id === req.params.id);
  if (!assignment) return res.status(404).json({ error: 'Assignment not found.' });
  if (isPastDeadline(assignment)) {
    return res.status(403).json({ error: 'The deadline has passed. Submissions are closed.' });
  }

  const now = new Date().toISOString();
  let submission = db.submissions.find(
    (s) => s.assignmentId === assignment.id && s.studentName === req.user.name
  );

  if (submission) {
    // Editing an existing submission before the deadline.
    submission.content = content.trim();
    submission.updatedAt = now;
  } else {
    submission = {
      id: makeId('sub'),
      assignmentId: assignment.id,
      studentName: req.user.name,
      content: content.trim(),
      submittedAt: now,
      updatedAt: now,
      grade: null,
      feedback: '',
      gradedAt: null,
      gradedBy: null,
    };
    db.submissions.push(submission);
  }
  writeDB(db).then(() => res.status(201).json(submission));
});

// View all submissions for an assignment (instructor only).
app.get(
  '/api/assignments/:id/submissions',
  requireUser,
  requireInstructor,
  (req, res) => {
    const db = readDB();
    const assignment = db.assignments.find((a) => a.id === req.params.id);
    if (!assignment) return res.status(404).json({ error: 'Assignment not found.' });

    const subs = db.submissions
      .filter((s) => s.assignmentId === assignment.id)
      .sort((a, b) => a.studentName.localeCompare(b.studentName));
    res.json({ assignment, submissions: subs });
  }
);

// Grade a submission + leave feedback (instructor only).
app.post('/api/submissions/:id/grade', requireUser, requireInstructor, (req, res) => {
  const { grade, feedback } = req.body || {};
  const db = readDB();
  const submission = db.submissions.find((s) => s.id === req.params.id);
  if (!submission) return res.status(404).json({ error: 'Submission not found.' });

  const assignment = db.assignments.find((a) => a.id === submission.assignmentId);
  const max = assignment ? assignment.maxPoints : 100;

  const numericGrade = Number(grade);
  if (!Number.isFinite(numericGrade) || numericGrade < 0 || numericGrade > max) {
    return res.status(400).json({ error: `Grade must be a number between 0 and ${max}.` });
  }

  submission.grade = numericGrade;
  submission.feedback = (feedback || '').trim();
  submission.gradedAt = new Date().toISOString();
  submission.gradedBy = req.user.name;
  writeDB(db).then(() => res.json(submission));
});

/* ------------------------------------------------------------------ */

// SPA fallback for any non-API route.
app.get(/^(?!\/api).*/, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`\n  Assignment Submission System running at http://localhost:${PORT}\n`);
});
