const express = require('express');
const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8080;

// Setup SQLite Database
const db = new DatabaseSync('hrms.db');

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY, name TEXT, email TEXT UNIQUE, password TEXT, role TEXT,
    jobTitle TEXT, department TEXT, joinDate TEXT, phone TEXT, address TEXT,
    status TEXT, avatarColor TEXT, avatarUrl TEXT, documents TEXT,
    basic INTEGER, allowances INTEGER, deductions INTEGER, updatedAt TEXT
  );
  CREATE TABLE IF NOT EXISTS attendance (
    employeeId TEXT, date TEXT, status TEXT, checkIn TEXT, checkOut TEXT,
    PRIMARY KEY (employeeId, date)
  );
  CREATE TABLE IF NOT EXISTS leaves (
    id TEXT PRIMARY KEY, employeeId TEXT, type TEXT, start TEXT, end TEXT,
    remarks TEXT, status TEXT, comment TEXT, createdAt TEXT
  );
`;
db.exec(SCHEMA);

// Helper function to format dates as YYYY-MM-DD
function pad(n){ return n<10 ? '0'+n : ''+n; }
function isoOf(y,m,d){ return `${y}-${pad(m+1)}-${pad(d)}`; }
function todayISO(){
  const d = new Date();
  return isoOf(d.getFullYear(), d.getMonth(), d.getDate());
}

// Seed Database if empty
const userCount = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
if (userCount === 0) {
  console.log('Seeding initial HRMS data...');
  // Seed Users
  const seedUsers = [
    {id:'EMP-1000', name:'Priya Nair', email:'priya.nair@ledgerhr.io', password:'Admin@123', role:'admin',
     jobTitle:'HR Officer', department:'People Ops', joinDate:'2021-03-01', phone:'+91 98765 43210', address:'Salt Lake, Kolkata',
     status:'active', avatarColor:'#3D5A80', avatarUrl:null, documents:JSON.stringify(['Offer Letter.pdf','ID Proof.pdf']),
     basic:65000, allowances:15000, deductions:5000, updatedAt:'2026-06-01'},
    {id:'EMP-1001', name:'Arjun Sen', email:'arjun.sen@ledgerhr.io', password:'Employee@1', role:'employee',
     jobTitle:'Frontend Engineer', department:'Engineering', joinDate:'2023-01-10', phone:'+91 90123 44556', address:'Park Street, Kolkata',
     status:'active', avatarColor:'#4C7A56', avatarUrl:null, documents:JSON.stringify(['Offer Letter.pdf','ID Proof.pdf']),
     basic:48000, allowances:9000, deductions:3200, updatedAt:'2026-05-15'},
    {id:'EMP-1002', name:'Meher Iqbal', email:'meher.iqbal@ledgerhr.io', password:'Employee@1', role:'employee',
     jobTitle:'Product Designer', department:'Design', joinDate:'2022-07-22', phone:'+91 99887 12233', address:'Ballygunge, Kolkata',
     status:'active', avatarColor:'#B4813A', avatarUrl:null, documents:JSON.stringify(['Offer Letter.pdf','ID Proof.pdf']),
     basic:52000, allowances:10000, deductions:3500, updatedAt:'2026-05-15'},
    {id:'EMP-1003', name:'Rhea Dutta', email:'rhea.dutta@ledgerhr.io', password:'Employee@1', role:'employee',
     jobTitle:'Payroll Analyst', department:'Finance', joinDate:'2024-02-05', phone:'+91 91234 56789', address:'Howrah, Kolkata',
     status:'active', avatarColor:'#AF4448', avatarUrl:null, documents:JSON.stringify(['Offer Letter.pdf','ID Proof.pdf']),
     basic:41000, allowances:7000, deductions:2800, updatedAt:'2026-05-15'}
  ];
  
  const insertUser = db.prepare(`INSERT INTO users (id, name, email, password, role, jobTitle, department, joinDate, phone, address, status, avatarColor, avatarUrl, documents, basic, allowances, deductions, updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  seedUsers.forEach(u => {
    insertUser.run(u.id, u.name, u.email, u.password, u.role, u.jobTitle, u.department, u.joinDate, u.phone, u.address, u.status, u.avatarColor, u.avatarUrl, u.documents, u.basic, u.allowances, u.deductions, u.updatedAt);
  });

  // Seed Attendance
  const seedAttendance = [];
  const empIds = seedUsers.filter(u=>u.role==='employee').map(u=>u.id);
  const today = new Date();
  const insertAtt = db.prepare(`INSERT INTO attendance (employeeId, date, status, checkIn, checkOut) VALUES (?,?,?,?,?)`);
  for(const empId of empIds){
    for(let i=13;i>=0;i--){
      const d = new Date(today); d.setDate(d.getDate()-i);
      if(d.getDay()===0 || d.getDay()===6) continue;
      const roll = Math.random();
      const status = roll<0.78 ? 'Present' : roll<0.9 ? 'Half-day' : 'Absent';
      const iso = isoOf(d.getFullYear(), d.getMonth(), d.getDate());
      const checkIn = status!=='Absent' ? '09:'+pad(Math.floor(Math.random()*30)) : null;
      const checkOut = status==='Present' ? '18:'+pad(Math.floor(Math.random()*30)) : null;
      insertAtt.run(empId, iso, status, checkIn, checkOut);
    }
  }

  // Seed Leaves
  const insertLeave = db.prepare(`INSERT INTO leaves (id, employeeId, type, start, end, remarks, status, comment, createdAt) VALUES (?,?,?,?,?,?,?,?,?)`);
  insertLeave.run('seed-lv-1', 'EMP-1001', 'Sick', '2026-06-10', '2026-06-11', 'Fever, resting at home.', 'Approved', 'Get well soon.', '2026-06-08');
  insertLeave.run('seed-lv-2', 'EMP-1002', 'Paid', '2026-07-10', '2026-07-12', 'Family function out of town.', 'Pending', '', '2026-07-02');
  insertLeave.run('seed-lv-3', 'EMP-1003', 'Unpaid', '2026-06-20', '2026-06-20', 'Personal errand.', 'Rejected', 'Clashes with month-end close.', '2026-06-15');
  console.log('Seeding completed successfully!');
}

// In-memory Pending signup users
const pendingUsers = new Map();

// Express Configuration
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname)));

// Auth Middleware to authenticate request using custom X-User-Id header
function authenticate(req, res, next) {
  const userId = req.headers['x-user-id'];
  if (!userId) {
    return res.status(401).json({ error: 'Authentication required. Please set X-User-Id header.' });
  }
  const u = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!u) {
    return res.status(401).json({ error: 'Invalid user session ID.' });
  }
  // Convert fields
  req.user = {
    id: u.id, name: u.name, email: u.email, role: u.role,
    jobTitle: u.jobTitle, department: u.department, joinDate: u.joinDate,
    phone: u.phone, address: u.address, status: u.status,
    avatarColor: u.avatarColor, avatarUrl: u.avatarUrl,
    documents: JSON.parse(u.documents || '[]'),
    salary: { basic: u.basic, allowances: u.allowances, deductions: u.deductions },
    updatedAt: u.updatedAt
  };
  next();
}

// Auth API endpoints
app.post('/api/auth/signup', (req, res) => {
  const { empId, name, email, password, role } = req.body;
  if (!empId || !name || !email || !password || !role) {
    return res.status(400).json({ error: 'All fields are required.' });
  }

  // Check if user already exists
  const existingId = db.prepare('SELECT id FROM users WHERE id = ?').get(empId);
  if (existingId) return res.status(400).json({ error: 'That Employee ID is already registered.' });

  const existingEmail = db.prepare('SELECT email FROM users WHERE email = ?').get(email);
  if (existingEmail) return res.status(400).json({ error: 'That email is already registered.' });

  const code = String(Math.floor(100000 + Math.random()*900000));
  const pendingUser = {
    id: empId, name, email, password, role,
    jobTitle: role==='admin' ? 'HR Officer' : 'Employee',
    department: 'Unassigned', joinDate: todayISO(), phone: '', address: '',
    salary: { basic: 30000, allowances: 0, deductions: 0 }, status: 'active',
    avatarColor: role==='admin' ? '#3D5A80' : '#4C7A56', avatarUrl: null,
    documents: ['Offer Letter.pdf', 'ID Proof.pdf'], updatedAt: todayISO(),
    code: code
  };
  pendingUsers.set(empId, pendingUser);
  res.json({ status: 'verify', pendingUser: { id: empId, email: email }, code: code });
});

app.post('/api/auth/verify', (req, res) => {
  const { empId, code } = req.body;
  const pending = pendingUsers.get(empId);
  if (!pending) {
    return res.status(400).json({ error: 'No pending signup session found for this Employee ID.' });
  }
  if (pending.code !== code) {
    return res.status(400).json({ error: 'Incorrect verification code.' });
  }

  const u = pending;
  const insertUser = db.prepare(`INSERT INTO users (id, name, email, password, role, jobTitle, department, joinDate, phone, address, status, avatarColor, avatarUrl, documents, basic, allowances, deductions, updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  insertUser.run(u.id, u.name, u.email, u.password, u.role, u.jobTitle, u.department, u.joinDate, u.phone, u.address, u.status, u.avatarColor, u.avatarUrl, JSON.stringify(u.documents), u.salary.basic, u.salary.allowances, u.salary.deductions, u.updatedAt);

  pendingUsers.delete(empId);
  res.json({ status: 'ok', userId: u.id });
});

app.post('/api/auth/signin', (req, res) => {
  const { email, password } = req.body;
  const u = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!u || u.password !== password) {
    return res.status(400).json({ error: 'Incorrect email or password.' });
  }
  res.json({ status: 'ok', userId: u.id });
});

app.get('/api/auth/me', authenticate, (req, res) => {
  res.json(req.user);
});

// Users/Profiles API
app.get('/api/users', authenticate, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin role required.' });
  }
  const rows = db.prepare("SELECT * FROM users WHERE role = 'employee'").all();
  const list = rows.map(u => ({
    id: u.id, name: u.name, email: u.email, role: u.role,
    jobTitle: u.jobTitle, department: u.department, joinDate: u.joinDate,
    phone: u.phone, address: u.address, status: u.status,
    avatarColor: u.avatarColor, avatarUrl: u.avatarUrl,
    documents: JSON.parse(u.documents || '[]'),
    salary: { basic: u.basic, allowances: u.allowances, deductions: u.deductions },
    updatedAt: u.updatedAt
  }));
  res.json(list);
});

app.put('/api/users/:id', authenticate, (req, res) => {
  const targetId = req.params.id;
  const current = req.user;
  
  if (current.role !== 'admin' && current.id !== targetId) {
    return res.status(403).json({ error: 'You are not authorized to edit this profile.' });
  }

  const { name, phone, address, jobTitle, department, status } = req.body;
  const dbUser = db.prepare('SELECT * FROM users WHERE id = ?').get(targetId);
  if (!dbUser) return res.status(404).json({ error: 'User not found.' });

  if (current.role === 'admin') {
    db.prepare(`UPDATE users SET name = ?, phone = ?, address = ?, jobTitle = ?, department = ?, status = ? WHERE id = ?`)
      .run(name || dbUser.name, phone ?? dbUser.phone, address ?? dbUser.address, jobTitle || dbUser.jobTitle, department || dbUser.department, status || dbUser.status, targetId);
  } else {
    // Regular employees can only edit phone and address
    db.prepare(`UPDATE users SET phone = ?, address = ? WHERE id = ?`)
      .run(phone ?? dbUser.phone, address ?? dbUser.address, targetId);
  }
  res.json({ success: true });
});

app.put('/api/users/:id/avatar', authenticate, (req, res) => {
  const targetId = req.params.id;
  if (req.user.id !== targetId && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Not authorized to change avatar.' });
  }
  const { avatarUrl } = req.body;
  db.prepare(`UPDATE users SET avatarUrl = ? WHERE id = ?`).run(avatarUrl, targetId);
  res.json({ success: true });
});

// Attendance API
app.get('/api/attendance', authenticate, (req, res) => {
  const current = req.user;
  let rows = [];
  if (current.role === 'admin') {
    rows = db.prepare('SELECT * FROM attendance').all();
  } else {
    rows = db.prepare('SELECT * FROM attendance WHERE employeeId = ?').all(current.id);
  }
  res.json(rows.map(r => ({
    employeeId: r.employeeId,
    date: r.date,
    status: r.status,
    checkIn: r.checkIn,
    checkOut: r.checkOut
  })));
});

app.post('/api/attendance/check-in', authenticate, (req, res) => {
  const current = req.user;
  const dateStr = todayISO();
  const timeStr = new Date().toTimeString().slice(0,5);

  const existing = db.prepare('SELECT * FROM attendance WHERE employeeId = ? AND date = ?').get(current.id, dateStr);
  if (existing) {
    db.prepare('UPDATE attendance SET checkIn = ?, status = ? WHERE employeeId = ? AND date = ?')
      .run(timeStr, 'Present', current.id, dateStr);
  } else {
    db.prepare('INSERT INTO attendance (employeeId, date, status, checkIn, checkOut) VALUES (?,?,?,?,?)')
      .run(current.id, dateStr, 'Present', timeStr, null);
  }
  res.json({ success: true, checkIn: timeStr });
});

app.post('/api/attendance/check-out', authenticate, (req, res) => {
  const current = req.user;
  const dateStr = todayISO();
  const timeStr = new Date().toTimeString().slice(0,5);

  const existing = db.prepare('SELECT * FROM attendance WHERE employeeId = ? AND date = ?').get(current.id, dateStr);
  if (existing) {
    db.prepare('UPDATE attendance SET checkOut = ? WHERE employeeId = ? AND date = ?')
      .run(timeStr, current.id, dateStr);
    res.json({ success: true, checkOut: timeStr });
  } else {
    res.status(400).json({ error: 'No check-in record found for today.' });
  }
});

app.post('/api/attendance/status', authenticate, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin role required.' });
  }
  const { employeeId, date, status } = req.body;
  if (!employeeId || !date || !status) {
    return res.status(400).json({ error: 'employeeId, date, and status are required.' });
  }

  const existing = db.prepare('SELECT * FROM attendance WHERE employeeId = ? AND date = ?').get(employeeId, date);
  if (existing) {
    db.prepare('UPDATE attendance SET status = ? WHERE employeeId = ? AND date = ?').run(status, employeeId, date);
  } else {
    db.prepare('INSERT INTO attendance (employeeId, date, status, checkIn, checkOut) VALUES (?,?,?,?,?)')
      .run(employeeId, date, status, null, null);
  }
  res.json({ success: true });
});

// Leaves API
app.get('/api/leaves', authenticate, (req, res) => {
  const current = req.user;
  let rows = [];
  if (current.role === 'admin') {
    rows = db.prepare('SELECT * FROM leaves').all();
  } else {
    rows = db.prepare('SELECT * FROM leaves WHERE employeeId = ?').all(current.id);
  }
  res.json(rows.map(r => ({
    id: r.id,
    employeeId: r.employeeId,
    type: r.type,
    start: r.start,
    end: r.end,
    remarks: r.remarks,
    status: r.status,
    comment: r.comment,
    createdAt: r.createdAt
  })));
});

app.post('/api/leaves', authenticate, (req, res) => {
  const current = req.user;
  const { type, start, end, remarks } = req.body;
  if (!type || !start || !end) {
    return res.status(400).json({ error: 'type, start date, and end date are required.' });
  }

  const leaveId = 'LV-' + Math.random().toString(36).slice(2,9);
  db.prepare(`INSERT INTO leaves (id, employeeId, type, start, end, remarks, status, comment, createdAt) VALUES (?,?,?,?,?,?,?,?,?)`)
    .run(leaveId, current.id, type, start, end, remarks || '', 'Pending', '', todayISO());
  
  res.json({ success: true });
});

app.post('/api/leaves/:id/decide', authenticate, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin role required.' });
  }
  const leaveId = req.params.id;
  const { decision, comment } = req.body;
  if (!decision || (decision !== 'Approved' && decision !== 'Rejected')) {
    return res.status(400).json({ error: 'Valid decision ("Approved" or "Rejected") is required.' });
  }

  const lv = db.prepare('SELECT * FROM leaves WHERE id = ?').get(leaveId);
  if (!lv) return res.status(404).json({ error: 'Leave request not found.' });

  db.prepare('UPDATE leaves SET status = ?, comment = ? WHERE id = ?').run(decision, comment || '', leaveId);

  // If approved, mark all days in range as 'Leave' in attendance table
  if (decision === 'Approved') {
    let d = new Date(lv.start + 'T00:00:00');
    const endD = new Date(lv.end + 'T00:00:00');
    const updateAtt = db.prepare(`
      INSERT INTO attendance (employeeId, date, status, checkIn, checkOut) VALUES (?,?,?,?,?)
      ON CONFLICT(employeeId, date) DO UPDATE SET status = 'Leave'
    `);
    while (d <= endD) {
      const iso = isoOf(d.getFullYear(), d.getMonth(), d.getDate());
      updateAtt.run(lv.employeeId, iso, 'Leave', null, null);
      d.setDate(d.getDate() + 1);
    }
  }

  res.json({ success: true });
});

// Payroll API
app.get('/api/payroll', authenticate, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin role required.' });
  }
  const rows = db.prepare("SELECT id, name, basic, allowances, deductions, updatedAt FROM users WHERE role = 'employee'").all();
  res.json(rows.map(r => ({
    id: r.id,
    name: r.name,
    salary: { basic: r.basic, allowances: r.allowances, deductions: r.deductions },
    updatedAt: r.updatedAt
  })));
});

app.put('/api/payroll/:id', authenticate, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin role required.' });
  }
  const empId = req.params.id;
  const { basic, allowances, deductions } = req.body;
  if (basic === undefined || allowances === undefined || deductions === undefined) {
    return res.status(400).json({ error: 'basic, allowances, and deductions are required.' });
  }

  db.prepare(`UPDATE users SET basic = ?, allowances = ?, deductions = ?, updatedAt = ? WHERE id = ?`)
    .run(Number(basic) || 0, Number(allowances) || 0, Number(deductions) || 0, todayISO(), empId);

  res.json({ success: true });
});

// Database Explorer API endpoints (Admin-only)
app.get('/api/db/schema', authenticate, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin role required.' });
  }
  try {
    const tables = db.prepare("SELECT type, name, tbl_name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all();
    const schemaInfo = tables.map(t => {
      const columns = db.prepare(`PRAGMA table_info("${t.name}")`).all();
      return {
        name: t.name,
        sql: t.sql,
        columns: columns.map(c => ({
          cid: c.cid,
          name: c.name,
          type: c.type,
          notnull: c.notnull,
          dflt_value: c.dflt_value,
          pk: c.pk
        }))
      };
    });
    res.json(schemaInfo);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/db/query', authenticate, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin role required.' });
  }
  const { query } = req.body;
  if (!query || typeof query !== 'string') {
    return res.status(400).json({ error: 'Query string is required.' });
  }
  try {
    const trimmed = query.trim().toLowerCase();
    const isSelect = trimmed.startsWith('select') || trimmed.startsWith('pragma') || trimmed.startsWith('explain') || trimmed.startsWith('show');
    const stmt = db.prepare(query);
    if (isSelect) {
      const rows = stmt.all();
      res.json({ success: true, type: 'select', rows });
    } else {
      const result = stmt.run();
      res.json({ success: true, type: 'run', changes: result.changes, lastInsertRowid: result.lastInsertRowid });
    }
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Start Express Server
app.listen(PORT, () => {
  console.log(`Ledger HRMS Server running at http://localhost:${PORT}`);
});
