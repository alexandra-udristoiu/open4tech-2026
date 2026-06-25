# 📚 Assignment Submission System

A simple, self-contained web app for managing university course assignments —
students submit work and view grades; instructors create assignments, review
submissions, and leave feedback.

Built with **HTML / CSS / vanilla JavaScript** on the frontend and
**Node.js + Express** on the backend. Data is stored in a single JSON file
(`data/db.json`) so there's nothing to install or configure beyond `npm install`.

---

## Features

### 🎓 Students
- View all available assignments, sorted by deadline
- Submit work before the deadline (paste text or a link)
- Edit a submission any time before the deadline
- See submission status at a glance: **Not submitted / Submitted / Graded / Missed**
- View their grade and written feedback once graded

### 🧑‍🏫 Instructors
- Create assignments with a title, instructions, deadline, and point value
- Edit an assignment or change its deadline
- Delete an assignment (and its submissions)
- See submission/grading counts per assignment
- Read every student's submission
- Grade submissions and leave written feedback

### ✨ Extras
- Clean, responsive interface with light role-based dashboards
- Live "time left / overdue" labels and color-coded status badges
- Deadline enforcement on the **server** (submissions are rejected after the deadline)
- Toast notifications and an in-page modal workflow
- Optional sample data so you can explore the app instantly

---

## Getting started

> Requires [Node.js](https://nodejs.org/) 16 or newer.

```bash
# 1. Install dependencies
npm install

# 2. (Optional) load sample assignments + submissions
npm run seed

# 3. Start the server
npm start
```

Then open **http://localhost:3000** in your browser.

To use a different port: `PORT=4000 npm start`.

---

## How to use it

1. On the login screen, enter **any name** and pick a role (Student or Instructor).
   There are no passwords — this is a local teaching/demo tool. Your identity is
   simply remembered in the browser.
2. **As an instructor**, click **“+ New assignment”** to create one, then use
   **“View submissions”** to read and grade student work.
3. **As a student**, click **“Submit assignment”** on any open assignment. You can
   edit your submission until the deadline, after which it locks. Grades and
   feedback appear on the card once the instructor grades your work.

If you ran the seed script, try logging in as instructor **`Prof. Smith`** or
student **`Alice`** to see populated data.

---

## Project structure

```
.
├── server.js        # Express API + static file server
├── store.js         # Tiny JSON-file data store (read/write/ids)
├── seed.js          # Optional sample-data generator
├── data/db.json     # Auto-created data file (assignments + submissions)
└── public/
    ├── index.html   # App shell (login + dashboard + modal)
    ├── styles.css   # Styling
    └── app.js       # Frontend logic
```

---

## API overview

All endpoints expect `x-user-name` and `x-user-role` headers (set automatically
by the frontend at login).

| Method | Endpoint                              | Role        | Purpose                          |
|--------|---------------------------------------|-------------|----------------------------------|
| GET    | `/api/assignments`                    | any         | List assignments (status folded in for students) |
| POST   | `/api/assignments`                    | instructor  | Create an assignment             |
| PUT    | `/api/assignments/:id`                | instructor  | Edit / change deadline           |
| DELETE | `/api/assignments/:id`                | instructor  | Delete assignment + submissions  |
| POST   | `/api/assignments/:id/submit`         | student     | Submit or update a submission    |
| GET    | `/api/assignments/:id/submissions`    | instructor  | List submissions for grading     |
| POST   | `/api/submissions/:id/grade`          | instructor  | Set grade + feedback             |

---

## Notes & limitations

This is intentionally lightweight for **local / educational use**:

- No real authentication — anyone can claim any name or role.
- JSON-file storage is fine for a class but not for heavy concurrent use; swap
  `store.js` for a real database (SQLite, Postgres, …) to scale up.
- Submissions are free-form text/links rather than file uploads.
