/* ============================================================
   Assignment Submission System — frontend logic (vanilla JS)
   ============================================================ */

const SESSION_KEY = 'asp.session';
let session = loadSession(); // { name, role } or null

/* ------------------------- element refs ------------------------- */
const $ = (id) => document.getElementById(id);
const loginView = $('login-view');
const appView = $('app-view');
const content = $('content');
const emptyState = $('empty-state');

/* ------------------------- session ------------------------- */
function loadSession() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY)) || null;
  } catch {
    return null;
  }
}
function saveSession(s) {
  session = s;
  localStorage.setItem(SESSION_KEY, JSON.stringify(s));
}
function clearSession() {
  session = null;
  localStorage.removeItem(SESSION_KEY);
}

/* ------------------------- API helper ------------------------- */
async function api(path, { method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (session) {
    headers['x-user-name'] = session.name;
    headers['x-user-role'] = session.role;
  }
  const res = await fetch(path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

/* ------------------------- utilities ------------------------- */
function esc(str) {
  return String(str ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}

function fmtDate(iso) {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

// "in 3 days", "2 hours left", "1 day ago"
function relativeDeadline(iso) {
  const diff = new Date(iso).getTime() - Date.now();
  const abs = Math.abs(diff);
  const mins = Math.round(abs / 60000);
  const hours = Math.round(abs / 3600000);
  const days = Math.round(abs / 86400000);
  let phrase;
  if (mins < 60) phrase = `${mins} min`;
  else if (hours < 24) phrase = `${hours} hr`;
  else phrase = `${days} day${days === 1 ? '' : 's'}`;
  return diff >= 0 ? `${phrase} left` : `${phrase} ago`;
}

// Convert an ISO string into the value a datetime-local input expects (local tz).
function toLocalInputValue(iso) {
  const d = iso ? new Date(iso) : new Date();
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16);
}

let toastTimer;
function toast(message, type = '') {
  const el = $('toast');
  el.textContent = message;
  el.className = 'toast' + (type ? ` toast-${type}` : '');
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.hidden = true), 3000);
}

/* ------------------------- modal ------------------------- */
function openModal(title, bodyEl) {
  $('modal-title').textContent = title;
  const body = $('modal-body');
  body.innerHTML = '';
  body.appendChild(bodyEl);
  $('modal-backdrop').hidden = false;
}
function closeModal() {
  $('modal-backdrop').hidden = true;
}
$('modal-close').addEventListener('click', closeModal);
$('modal-backdrop').addEventListener('click', (e) => {
  if (e.target === $('modal-backdrop')) closeModal();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !$('modal-backdrop').hidden) closeModal();
});

/* ------------------------- login ------------------------- */
$('login-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const name = $('login-name').value.trim();
  const role = document.querySelector('input[name="role"]:checked').value;
  const err = $('login-error');
  if (!name) {
    err.textContent = 'Please enter your name.';
    err.hidden = false;
    return;
  }
  err.hidden = true;
  saveSession({ name, role });
  showApp();
});

$('logout-btn').addEventListener('click', () => {
  clearSession();
  loginView.hidden = false;
  appView.hidden = true;
  $('login-name').value = '';
});

/* ------------------------- view switching ------------------------- */
function showApp() {
  loginView.hidden = true;
  appView.hidden = false;
  $('who').textContent = `${session.name} · ${session.role}`;

  const isInstructor = session.role === 'instructor';
  $('instructor-tools').hidden = !isInstructor;
  $('student-title').hidden = isInstructor;

  loadAssignments();
}

/* ------------------------- load + render ------------------------- */
async function loadAssignments() {
  content.innerHTML = '';
  emptyState.hidden = true;
  try {
    const assignments = await api('/api/assignments');
    if (!assignments.length) {
      emptyState.textContent =
        session.role === 'instructor'
          ? 'No assignments yet. Click “+ New assignment” to create one.'
          : 'No assignments have been posted yet. Check back soon!';
      emptyState.hidden = false;
      return;
    }
    assignments.forEach((a) => {
      content.appendChild(
        session.role === 'instructor'
          ? instructorCard(a)
          : studentCard(a)
      );
    });
  } catch (err) {
    toast(err.message, 'error');
  }
}

/* ---------- shared deadline label ---------- */
function deadlineLabel(a) {
  const past = a.pastDeadline;
  const soon = !past && new Date(a.deadline).getTime() - Date.now() < 86400000 * 2;
  const cls = past ? 'deadline-past' : soon ? 'deadline-soon' : '';
  return `<span class="${cls}">${fmtDate(a.deadline)} · ${relativeDeadline(a.deadline)}</span>`;
}

/* ============================================================
   STUDENT VIEW
   ============================================================ */
function studentStatusBadge(a) {
  const map = {
    graded: ['badge-green', 'Graded'],
    submitted: ['badge-blue', 'Submitted'],
    missed: ['badge-red', 'Missed'],
    not_submitted: ['badge-amber', 'Not submitted'],
  };
  const [cls, label] = map[a.status] || map.not_submitted;
  return `<span class="badge ${cls}">${label}</span>`;
}

function studentCard(a) {
  const card = document.createElement('div');
  card.className = 'card assignment';

  const sub = a.submission;
  let resultHtml = '';
  if (a.status === 'graded') {
    resultHtml = `
      <div class="result-box">
        <div class="score">${sub.grade} / ${a.maxPoints}</div>
        ${
          sub.feedback
            ? `<div class="feedback"><span class="feedback-label">Instructor feedback:</span><br>${esc(
                sub.feedback
              )}</div>`
            : '<div class="muted">No written feedback.</div>'
        }
      </div>`;
  } else if (sub) {
    resultHtml = `<div class="meta-row"><span>📝 Your submission was received ${esc(
      fmtDate(sub.updatedAt)
    )}.</span></div>`;
  }

  // Action button: submit / edit / closed
  let actionBtn = '';
  if (!a.pastDeadline) {
    actionBtn = `<button class="btn btn-primary btn-sm" data-act="submit">${
      sub ? 'Edit submission' : 'Submit assignment'
    }</button>`;
  } else if (!sub) {
    actionBtn = `<button class="btn btn-sm" disabled>Deadline passed</button>`;
  }
  const viewBtn = sub
    ? `<button class="btn btn-ghost btn-sm" data-act="view">View my submission</button>`
    : '';

  card.innerHTML = `
    <div class="assignment-head">
      <h3>${esc(a.title)}</h3>
      ${studentStatusBadge(a)}
    </div>
    ${a.description ? `<p class="desc">${esc(a.description)}</p>` : ''}
    <div class="meta-row">
      <span>📅 <strong>Due:</strong> ${deadlineLabel(a)}</span>
      <span>🎯 <strong>Points:</strong> ${a.maxPoints}</span>
    </div>
    ${resultHtml}
    ${actionBtn || viewBtn ? `<div class="card-actions">${actionBtn}${viewBtn}</div>` : ''}
  `;

  const submitBtn = card.querySelector('[data-act="submit"]');
  if (submitBtn) submitBtn.addEventListener('click', () => openSubmitModal(a));
  const vb = card.querySelector('[data-act="view"]');
  if (vb) vb.addEventListener('click', () => openViewSubmissionModal(a));

  return card;
}

function openSubmitModal(a) {
  const form = document.createElement('form');
  const existing = a.submission ? a.submission.content : '';
  form.innerHTML = `
    <p class="muted">Due ${esc(fmtDate(a.deadline))} · ${relativeDeadline(a.deadline)}</p>
    <label for="sub-content">Your work</label>
    <textarea id="sub-content" placeholder="Paste your answer, a link to your work, etc.">${esc(
      existing
    )}</textarea>
    <button type="submit" class="btn btn-primary btn-block">
      ${a.submission ? 'Update submission' : 'Submit'}
    </button>
  `;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const contentVal = form.querySelector('#sub-content').value.trim();
    if (!contentVal) return toast('Submission cannot be empty.', 'error');
    try {
      await api(`/api/assignments/${a.id}/submit`, {
        method: 'POST',
        body: { content: contentVal },
      });
      closeModal();
      toast('Submission saved!', 'success');
      loadAssignments();
    } catch (err) {
      toast(err.message, 'error');
    }
  });
  openModal(a.title, form);
  setTimeout(() => form.querySelector('#sub-content').focus(), 50);
}

function openViewSubmissionModal(a) {
  const sub = a.submission;
  const wrap = document.createElement('div');
  wrap.innerHTML = `
    <div class="meta-row">
      <span><strong>Submitted:</strong> ${esc(fmtDate(sub.submittedAt))}</span>
      ${
        sub.updatedAt !== sub.submittedAt
          ? `<span><strong>Last edited:</strong> ${esc(fmtDate(sub.updatedAt))}</span>`
          : ''
      }
    </div>
    <div class="sub-content">${esc(sub.content)}</div>
    ${
      sub.grade != null
        ? `<div class="result-box">
             <div class="score">${sub.grade} / ${a.maxPoints}</div>
             ${
               sub.feedback
                 ? `<div class="feedback"><span class="feedback-label">Feedback:</span><br>${esc(
                     sub.feedback
                   )}</div>`
                 : '<div class="muted">No written feedback.</div>'
             }
           </div>`
        : '<p class="muted">Not graded yet.</p>'
    }
  `;
  openModal(a.title, wrap);
}

/* ============================================================
   INSTRUCTOR VIEW
   ============================================================ */
function instructorCard(a) {
  const card = document.createElement('div');
  card.className = 'card assignment';
  const ungraded = a.submissionCount - a.gradedCount;
  card.innerHTML = `
    <div class="assignment-head">
      <h3>${esc(a.title)}</h3>
      ${
        ungraded > 0
          ? `<span class="badge badge-amber">${ungraded} to grade</span>`
          : a.submissionCount > 0
          ? `<span class="badge badge-green">All graded</span>`
          : `<span class="badge badge-gray">No submissions</span>`
      }
    </div>
    ${a.description ? `<p class="desc">${esc(a.description)}</p>` : ''}
    <div class="meta-row">
      <span>📅 <strong>Due:</strong> ${deadlineLabel(a)}</span>
      <span>🎯 <strong>Points:</strong> ${a.maxPoints}</span>
      <span>📥 <strong>Submissions:</strong> ${a.submissionCount}</span>
    </div>
    <div class="card-actions">
      <button class="btn btn-primary btn-sm" data-act="subs">View submissions</button>
      <button class="btn btn-ghost btn-sm" data-act="edit">Edit</button>
      <button class="btn btn-danger btn-sm" data-act="delete">Delete</button>
    </div>
  `;
  card.querySelector('[data-act="subs"]').addEventListener('click', () =>
    openSubmissionsModal(a)
  );
  card.querySelector('[data-act="edit"]').addEventListener('click', () =>
    openAssignmentModal(a)
  );
  card.querySelector('[data-act="delete"]').addEventListener('click', () =>
    deleteAssignment(a)
  );
  return card;
}

// Create / edit assignment
function openAssignmentModal(existing = null) {
  const form = document.createElement('form');
  form.innerHTML = `
    <label for="f-title">Title</label>
    <input id="f-title" type="text" required value="${esc(existing?.title || '')}" placeholder="e.g. Essay 1: Causes of WWI" />

    <label for="f-desc">Description / instructions</label>
    <textarea id="f-desc" placeholder="What should students do?">${esc(
      existing?.description || ''
    )}</textarea>

    <label for="f-deadline">Deadline</label>
    <input id="f-deadline" type="datetime-local" required value="${toLocalInputValue(
      existing?.deadline
    )}" />

    <label for="f-points">Maximum points</label>
    <input id="f-points" type="number" min="1" step="1" value="${existing?.maxPoints || 100}" />

    <button type="submit" class="btn btn-primary btn-block">
      ${existing ? 'Save changes' : 'Create assignment'}
    </button>
  `;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = {
      title: form.querySelector('#f-title').value.trim(),
      description: form.querySelector('#f-desc').value.trim(),
      deadline: new Date(form.querySelector('#f-deadline').value).toISOString(),
      maxPoints: Number(form.querySelector('#f-points').value) || 100,
    };
    if (!body.title) return toast('Title is required.', 'error');
    try {
      if (existing) {
        await api(`/api/assignments/${existing.id}`, { method: 'PUT', body });
        toast('Assignment updated.', 'success');
      } else {
        await api('/api/assignments', { method: 'POST', body });
        toast('Assignment created.', 'success');
      }
      closeModal();
      loadAssignments();
    } catch (err) {
      toast(err.message, 'error');
    }
  });
  openModal(existing ? 'Edit assignment' : 'New assignment', form);
  setTimeout(() => form.querySelector('#f-title').focus(), 50);
}

$('new-assignment-btn').addEventListener('click', () => openAssignmentModal());

async function deleteAssignment(a) {
  if (
    !confirm(
      `Delete “${a.title}”? This also removes all ${a.submissionCount} submission(s). This cannot be undone.`
    )
  )
    return;
  try {
    await api(`/api/assignments/${a.id}`, { method: 'DELETE' });
    toast('Assignment deleted.', 'success');
    loadAssignments();
  } catch (err) {
    toast(err.message, 'error');
  }
}

// View + grade submissions for one assignment
async function openSubmissionsModal(a) {
  const wrap = document.createElement('div');
  wrap.innerHTML = '<p class="muted">Loading submissions…</p>';
  openModal(`Submissions · ${a.title}`, wrap);

  try {
    const { assignment, submissions } = await api(
      `/api/assignments/${a.id}/submissions`
    );
    if (!submissions.length) {
      wrap.innerHTML = '<p class="empty">No submissions yet.</p>';
      return;
    }
    wrap.innerHTML = '';
    submissions.forEach((s) => wrap.appendChild(submissionRow(assignment, s)));
  } catch (err) {
    wrap.innerHTML = `<p class="error-text">${esc(err.message)}</p>`;
  }
}

function submissionRow(assignment, s) {
  const row = document.createElement('div');
  row.className = 'sub-row';
  const edited = s.updatedAt !== s.submittedAt;
  row.innerHTML = `
    <div class="sub-head">
      <span class="student">🎓 ${esc(s.studentName)}</span>
      ${
        s.grade != null
          ? `<span class="badge badge-green">${s.grade} / ${assignment.maxPoints}</span>`
          : `<span class="badge badge-amber">Needs grading</span>`
      }
    </div>
    <div class="meta-row">
      <span>${esc(fmtDate(s.submittedAt))}${edited ? ' (edited)' : ''}</span>
    </div>
    <div class="sub-content">${esc(s.content)}</div>
    <form class="grade-form">
      <div class="field">
        <label>Grade (/${assignment.maxPoints})</label>
        <input type="number" class="g-grade" min="0" max="${assignment.maxPoints}" step="0.5"
          value="${s.grade != null ? s.grade : ''}" placeholder="0" required />
      </div>
      <div class="field wide">
        <label>Feedback</label>
        <input type="text" class="g-feedback" value="${esc(s.feedback || '')}"
          placeholder="Written feedback for the student" />
      </div>
      <button type="submit" class="btn btn-primary btn-sm">
        ${s.grade != null ? 'Update' : 'Save grade'}
      </button>
    </form>
  `;
  row.querySelector('.grade-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const grade = row.querySelector('.g-grade').value;
    const feedback = row.querySelector('.g-feedback').value;
    try {
      await api(`/api/submissions/${s.id}/grade`, {
        method: 'POST',
        body: { grade, feedback },
      });
      toast(`Saved grade for ${s.studentName}.`, 'success');
      openSubmissionsModal(assignment); // refresh modal
      loadAssignments(); // refresh card counts behind it
    } catch (err) {
      toast(err.message, 'error');
    }
  });
  return row;
}

/* ------------------------- boot ------------------------- */
if (session) showApp();
