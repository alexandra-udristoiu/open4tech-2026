/**
 * Optional: populate the app with sample data so you can try it immediately.
 * Run with:  npm run seed
 *
 * This OVERWRITES data/db.json.
 */
const { writeDB } = require('./store');

const now = Date.now();
const day = 86400000;
const iso = (ms) => new Date(ms).toISOString();

const db = {
  assignments: [
    {
      id: 'asg_demo1',
      title: 'Essay 1: Causes of World War I',
      description:
        'Write a 1,000-word essay analysing the main causes of WWI. Cite at least three sources.',
      deadline: iso(now + 5 * day),
      maxPoints: 100,
      createdBy: 'Prof. Smith',
      createdAt: iso(now - 2 * day),
    },
    {
      id: 'asg_demo2',
      title: 'Problem Set 3: Recursion',
      description: 'Solve problems 1–8. Submit a link to your repository or paste your code.',
      deadline: iso(now + 1 * day),
      maxPoints: 50,
      createdBy: 'Prof. Smith',
      createdAt: iso(now - 1 * day),
    },
    {
      id: 'asg_demo3',
      title: 'Reading Response: Chapter 4',
      description: 'A short reflection on the assigned reading.',
      deadline: iso(now - 2 * day), // already past
      maxPoints: 20,
      createdBy: 'Prof. Smith',
      createdAt: iso(now - 6 * day),
    },
  ],
  submissions: [
    {
      id: 'sub_demo1',
      assignmentId: 'asg_demo3',
      studentName: 'Alice',
      content: 'I found the chapter on supply and demand particularly insightful because...',
      submittedAt: iso(now - 3 * day),
      updatedAt: iso(now - 3 * day),
      grade: 18,
      feedback: 'Great reflection — well argued. Watch your conclusion length.',
      gradedAt: iso(now - 1 * day),
      gradedBy: 'Prof. Smith',
    },
    {
      id: 'sub_demo2',
      assignmentId: 'asg_demo2',
      studentName: 'Alice',
      content: 'https://github.com/alice/recursion-pset',
      submittedAt: iso(now - 6 * 3600000),
      updatedAt: iso(now - 6 * 3600000),
      grade: null,
      feedback: '',
      gradedAt: null,
      gradedBy: null,
    },
  ],
};

writeDB(db).then(() => {
  console.log('Seeded data/db.json with sample assignments and submissions.');
  console.log('Try logging in as instructor "Prof. Smith" or student "Alice".');
});
