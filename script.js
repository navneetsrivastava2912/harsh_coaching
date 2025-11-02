// script.js (module)
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-analytics.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  getDocs,
  collection,
  addDoc,
  query,
  orderBy
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-firestore.js";

/* ---------- FIREBASE CONFIG (keep yours) ---------- */
const firebaseConfig = {
  apiKey: "AIzaSyDLYERZPsHz3fOyzhh3wl_gPn0fXxMj7kM",
  authDomain: "harsh-coaching.firebaseapp.com",
  projectId: "harsh-coaching",
  storageBucket: "harsh-coaching.firebasestorage.app",
  messagingSenderId: "729286340003",
  appId: "1:729286340003:web:4cee04f176c1bab7463e16",
  measurementId: "G-WRDRSGQE5R"
};

const app = initializeApp(firebaseConfig);
try { getAnalytics(app); } catch(e) {}
const auth = getAuth(app);
const db = getFirestore(app);

/* ---------- Students list ---------- */
const STUDENTS = [
  { id: 'karan_pal', name: 'Karan Pal' },
  { id: 'amrita_pal', name: 'Amrita Pal' },
  { id: 'anshuman_bhatt', name: 'Anshuman Bhatt' },
  { id: 'shambhavi_maurya', name: 'Shambhavi Maurya' },
  { id: 'krishna_maurya', name: 'Krishna Maurya' }
];

/* ---------- UI element refs ---------- */
const teacherBtn = document.getElementById('teacherBtn');
const teacherModal = document.getElementById('teacherModal');
const closeModal = document.getElementById('closeModal');
const authBtn = document.getElementById('authBtn');
const logoutBtn = document.getElementById('logoutBtn');
const toggleRegister = document.getElementById('toggleRegister');
const authError = document.getElementById('authError');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');

const dashboard = document.getElementById('dashboard');
const openAttendance = document.getElementById('openAttendance');
const openTests = document.getElementById('openTests');
const openRanking = document.getElementById('openRanking');

const attendancePanel = document.getElementById('attendancePanel');
const testsPanel = document.getElementById('testsPanel');
const rankingPanel = document.getElementById('rankingPanel');

const attendanceDate = document.getElementById('attendanceDate');
const loadAttendanceBtn = document.getElementById('loadAttendance');
const studentsList = document.getElementById('studentsList');
const submitAttendanceBtn = document.getElementById('submitAttendance');
const clearSelectionsBtn = document.getElementById('clearSelections');
const attendanceMsg = document.getElementById('attendanceMsg');

const testForm = document.getElementById('testForm');
const testStudent = document.getElementById('testStudent');
const testSubject = document.getElementById('testSubject');
const testTotal = document.getElementById('testTotal');
const testObtained = document.getElementById('testObtained');
const testDate = document.getElementById('testDate');
const testSavedMsg = document.getElementById('testSavedMsg');

const rankingBody = document.getElementById('rankingBody');
const exportTestsCSV = document.getElementById('exportTestsCSV');
const exportAttendanceCSV = document.getElementById('exportAttendanceCSV');

const menuToggle = document.getElementById('menuToggle');
const navLinks = document.querySelector('.nav-links');
if(menuToggle) menuToggle.addEventListener('click', ()=> navLinks.classList.toggle('active'));

/* ---------- Utilities ---------- */
const todayYMD = () => {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth()+1).padStart(2,'0');
  const dd = String(d.getDate()).padStart(2,'0');
  return `${yyyy}-${mm}-${dd}`;
};
attendanceDate.value = todayYMD();
testDate.value = todayYMD();

function showMsg(el, text, timeout=3000){
  el.textContent = text;
  if(timeout) setTimeout(()=> el.textContent = '', timeout);
}

/* ---------- State for buffered selection ---------- */
let selection = {}; // { studentId: 'Present'|'Absent' }
function resetSelection(){ selection = {}; }

/* ---------- Ensure students documents exist ---------- */
async function ensureStudentsExist(){
  for(const s of STUDENTS){
    const sd = doc(db, 'students', s.id);
    const snap = await getDoc(sd);
    if(!snap.exists()){
      await setDoc(sd, { name: s.name, createdAt: new Date().toISOString() });
    }
  }
}

/* ---------- Render students list (loads current DB status but does NOT write) ---------- */
async function renderStudentsForDate(dateYMD){
  studentsList.innerHTML = '';
  // load current DB values to show existing saved state
  for(const s of STUDENTS){
    const docRef = doc(db, 'students', s.id, 'attendance', dateYMD);
    const snap = await getDoc(docRef);
    const savedStatus = snap.exists() ? snap.data().status : null;

    // if teacher hasn't changed selection in this session, reflect saved status
    const current = selection[s.id] ?? savedStatus ?? null;

    const card = document.createElement('div');
    card.className = 'student-card';
    card.innerHTML = `
      <div class="student-info">
        <div class="avatar">${s.name.split(' ').map(n=>n[0]).slice(0,2).join('')}</div>
        <div>
          <div class="student-name">${s.name}</div>
          <div class="muted small">ID: ${s.id}</div>
        </div>
      </div>
      <div class="status-buttons" data-student="${s.id}">
        <button class="ap-btn p ${current==='Present' ? 'selected' : (current?'' : 'unselected') }" title="Present">P</button>
        <button class="ap-btn a ${current==='Absent' ? 'selected' : (current?'' : 'unselected') }" title="Absent">A</button>
      </div>`;
    studentsList.appendChild(card);

    const btnP = card.querySelector('.ap-btn.p');
    const btnA = card.querySelector('.ap-btn.a');

    // when clicked, only update local selection (no DB write)
    btnP.addEventListener('click', ()=> {
      selection[s.id] = 'Present';
      btnP.classList.add('selected'); btnP.classList.remove('unselected');
      btnA.classList.remove('selected'); btnA.classList.add('unselected');
    });
    btnA.addEventListener('click', ()=> {
      selection[s.id] = 'Absent';
      btnA.classList.add('selected'); btnA.classList.remove('unselected');
      btnP.classList.remove('selected'); btnP.classList.add('unselected');
    });
  }
}

/* load button */
loadAttendanceBtn.addEventListener('click', async ()=>{
  resetSelection();
  const date = attendanceDate.value;
  if(!date){ showMsg(attendanceMsg, 'Pick a date'); return; }
  await renderStudentsForDate(date);
  showMsg(attendanceMsg, `Loaded attendance for ${date}`, 2000);
});

/* Clear selections */
clearSelectionsBtn.addEventListener('click', async ()=>{
  resetSelection();
  await renderStudentsForDate(attendanceDate.value);
});

/* Submit attendance — confirm first, then write all selected (and default others to 'Not recorded' or keep existing?) 
   We'll write present/absent for every student based on selection; if a student is not selected, we keep DB as-is (no overwrite).
*/
submitAttendanceBtn.addEventListener('click', async ()=>{
  const date = attendanceDate.value;
  if(!date) { showMsg(attendanceMsg,'Pick a date'); return; }

  // If nothing selected, warn
  if(Object.keys(selection).length === 0){
    if(!confirm('No selection made. Do you want to fetch existing values for this date?')) return;
    await renderStudentsForDate(date);
    return;
  }

  if(!confirm(`Submit attendance for ${date}? This will overwrite that date for selected students.`)) return;

  try {
    submitAttendanceBtn.disabled = true;
    submitAttendanceBtn.textContent = 'Submitting...';

    // Ensure students exist
    await ensureStudentsExist();

    // For each selected student, write the attendance doc
    const promises = [];
    for(const [sid, status] of Object.entries(selection)){
      const docRef = doc(db, 'students', sid, 'attendance', date);
      promises.push(setDoc(docRef, { status, timestamp: new Date().toISOString() }));
    }
    await Promise.all(promises);

    // After successful write, clear selection and re-render to show saved styling
    resetSelection();
    await renderStudentsForDate(date);
    showMsg(attendanceMsg, 'Attendance submitted ✅', 3000);
  } catch(err){
    console.error(err);
    showMsg(attendanceMsg, 'Error saving attendance. Check console.', 4000);
  } finally {
    submitAttendanceBtn.disabled = false;
    submitAttendanceBtn.textContent = 'Submit Attendance';
  }
});

/* ---------- TESTS: populate students select & save ---------- */
function populateTestStudentOptions(){
  testStudent.innerHTML = '';
  for(const s of STUDENTS){
    const opt = document.createElement('option');
    opt.value = s.id;
    opt.textContent = s.name;
    testStudent.appendChild(opt);
  }
}

testForm.addEventListener('submit', async (e)=>{
  e.preventDefault();
  const sid = testStudent.value;
  const subject = testSubject.value.trim();
  const total = Number(testTotal.value);
  const obtained = Number(testObtained.value);
  const date = testDate.value || todayYMD();

  if(!sid || !subject || !total || total <= 0 || obtained < 0){
    testSavedMsg.textContent = 'Please fill valid test details.';
    return;
  }
  const percentage = ((obtained / total) * 100);
  const payload = { subject, totalMarks: total, obtainedMarks: obtained, percentage: Number(percentage.toFixed(1)), date, createdAt: new Date().toISOString() };

  try {
    await addDoc(collection(db, 'students', sid, 'tests'), payload);
    testSavedMsg.textContent = `Saved: ${subject} (${obtained}/${total}) — ${payload.percentage}%`;
    setTimeout(()=> testSavedMsg.textContent = '', 3500);
    testForm.reset(); testDate.value = todayYMD();
  } catch(err){
    console.error(err);
    testSavedMsg.textContent = 'Error saving test.';
  }
});

/* ---------- Ranking builder ---------- */
async function showRanking(){
  const attendanceCounts = {};
  const testAverages = {};
  for(const s of STUDENTS){
    attendanceCounts[s.id] = { name: s.name, present: 0, total: 0 };
    testAverages[s.id] = { sum: 0, count: 0 };
  }

  for(const s of STUDENTS){
    // attendance subcollection
    const attCol = collection(db, 'students', s.id, 'attendance');
    const attDocs = await getDocs(attCol);
    attDocs.forEach(d => {
      const data = d.data();
      attendanceCounts[s.id].total++;
      if(data.status === 'Present') attendanceCounts[s.id].present++;
    });

    // tests
    const tcol = collection(db, 'students', s.id, 'tests');
    const tdocs = await getDocs(tcol);
    tdocs.forEach(d => {
      const data = d.data();
      if(typeof data.percentage === 'number'){
        testAverages[s.id].sum += data.percentage;
        testAverages[s.id].count++;
      }
    });
  }

  // build array & sort
  const arr = Object.keys(attendanceCounts).map(id => {
    const a = attendanceCounts[id];
    const t = testAverages[id];
    const attPerc = a.total === 0 ? 0 : (a.present / a.total) * 100;
    const avgTest = t.count === 0 ? 0 : (t.sum / t.count);
    return {
      id, name: a.name, present: a.present, total: a.total,
      attendancePercent: Number(attPerc.toFixed(1)),
      avgTestPercent: Number(avgTest.toFixed(1))
    };
  });
  arr.sort((x,y)=> (y.attendancePercent - x.attendancePercent) || (y.avgTestPercent - x.avgTestPercent));
  rankingBody.innerHTML = '';
  arr.forEach((r,i)=>{
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${i+1}</td><td>${r.name}</td><td>${r.present}</td><td>${r.total}</td><td>${r.attendancePercent}%</td><td>${r.avgTestPercent}%</td>`;
    rankingBody.appendChild(tr);
  });
}

/* export attendance (all students across all dates) */
async function exportAllAttendanceCSV(){
  const rows = [['Student','Date','Status']];
  const combined = [];
  for(const s of STUDENTS){
    const attCol = collection(db, 'students', s.id, 'attendance');
    const attDocs = await getDocs(attCol);
    attDocs.forEach(d=> {
      const data = d.data();
      combined.push({ student: s.name, date: d.id, status: data.status || '' });
    });
  }
  combined.sort((a,b)=> a.date.localeCompare(b.date));
  combined.forEach(c => rows.push([c.student, c.date, c.status]));
  downloadCSV(rows, 'attendance_all.csv');
}

/* export tests CSV */
async function exportTestsCSVHandler(){
  const rows = [['Student','Subject','Total Marks','Obtained Marks','Percentage','Date']];
  for(const s of STUDENTS){
    const tcol = collection(db, 'students', s.id, 'tests');
    const tdocs = await getDocs(tcol);
    tdocs.forEach(d => {
      const data = d.data();
      rows.push([s.name, data.subject||'', data.totalMarks||'', data.obtainedMarks||'', data.percentage||'', data.date||'']);
    });
  }
  downloadCSV(rows, 'tests_all.csv');
}
exportTestsCSV?.addEventListener('click', exportTestsCSVHandler);
exportAttendanceCSV?.addEventListener('click', exportAllAttendanceCSV);

/* CSV helper */
function downloadCSV(rows, filename='export.csv'){
  const csvContent = rows.map(r => r.map(cell => {
    if(cell === null || cell === undefined) return '';
    const s = String(cell).replace(/"/g,'""');
    return /[",\n]/.test(s) ? `"${s}"` : s;
  }).join(',')).join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

/* ---------- AUTH handlers ---------- */
authBtn.addEventListener('click', async ()=>{
  authError.textContent = '';
  const email = (emailInput.value || '').trim();
  const password = (passwordInput.value || '').trim();
  if(!email || !password){ authError.textContent = 'Provide valid email & password'; return; }
  try {
    if(toggleRegister.checked){
      await createUserWithEmailAndPassword(auth, email, password);
      showMsg(authError, 'Teacher registered. Logging in...');
    } else {
      await signInWithEmailAndPassword(auth, email, password);
    }
  } catch(err){
    console.error(err);
    authError.textContent = err?.message || 'Authentication failed';
  }
});

document.getElementById('signOut')?.addEventListener('click', async ()=>{
  await signOut(auth);
  teacherModal.classList.add('hidden');
});
logoutBtn?.addEventListener('click', async ()=> {
  await signOut(auth);
  teacherModal.classList.add('hidden');
});

/* auth state change */
onAuthStateChanged(auth, async (user)=>{
  if(user){
    document.getElementById('authSection').style.display = 'none';
    dashboard.classList.remove('hidden');
    logoutBtn.classList.remove('hidden');
    // Ensure students and populate UI
    await ensureStudentsExist();
    populateTestStudentOptions();
    await renderStudentsForDate(attendanceDate.value || todayYMD());
    await showRanking();
    // default open attendance
    attendancePanel.classList.remove('hidden');
    testsPanel.classList.add('hidden');
    rankingPanel.classList.add('hidden');
  } else {
    document.getElementById('authSection').style.display = 'block';
    dashboard.classList.add('hidden');
    logoutBtn.classList.add('hidden');
  }
});

/* Dashboard tab switching */
openAttendance.addEventListener('click', ()=> {
  attendancePanel.classList.remove('hidden');
  testsPanel.classList.add('hidden');
  rankingPanel.classList.add('hidden');
  openAttendance.classList.add('active');
  openTests.classList.remove('active');
  openRanking.classList.remove('active');
});
openTests.addEventListener('click', ()=> {
  attendancePanel.classList.add('hidden');
  testsPanel.classList.remove('hidden');
  rankingPanel.classList.add('hidden');
  openAttendance.classList.remove('active');
  openTests.classList.add('active');
  openRanking.classList.remove('active');
});
openRanking.addEventListener('click', async ()=> {
  attendancePanel.classList.add('hidden');
  testsPanel.classList.add('hidden');
  rankingPanel.classList.remove('hidden');
  openAttendance.classList.remove('active');
  openTests.classList.remove('active');
  openRanking.classList.add('active');
  await showRanking();
});

/* Modal open/close */
teacherBtn.addEventListener('click', ()=> teacherModal.classList.remove('hidden'));
closeModal.addEventListener('click', ()=> teacherModal.classList.add('hidden'));

/* On initial load: populate tests select and default UI settings */
document.addEventListener('DOMContentLoaded', async ()=>{
  populateTestStudentOptions();
});
