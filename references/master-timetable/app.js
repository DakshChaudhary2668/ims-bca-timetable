const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
const codeAliases = {
  1: { MFCS: ['BCA-1001T'], CA: ['BCA-1002T', 'BCA-1002P'], IKS: ['BCA-1003T'], PST: ['BCA-1004T', 'BCA-1004P'], GE: ['BCA-1005T'], EVS: ['BCA-1006T'], SAPI: ['CDC-001'], LINUX: ['SP1-P1'] },
  3: { STATS: ['BCA-3001T'], DBMS: ['BCA-3002T', 'BCA-3002P'], SE: ['BCA-3003T'], FE: ['BCA-3004T', 'BCA-3004P'], BDA: ['BCA-3005T', 'BCA-3005P'], PYTHON: ['BCA-3007T', 'BCA-3007P'], YOGA: ['BCA-3008P'], CRPC: ['CDC-003'], 'BIG DATA': ['BIG DATA'] },
  5: { DBMS: ['BCA-501', 'BCA-505P'], JAVA: ['BCA-502', 'BCA-506P'], CN: ['BCA-503'], NM: ['BCA-504'], CEWR: ['CDC-003'], 'MINOR PROJECT': ['BCA-507MP'], 'DATA VISUALIZATION': ['SP51-P1'], 'GOOGLE UXUI': ['SP52-P1'] }
};
const $ = (selector) => document.querySelector(selector);
let activeView = 'section';
let activePage = 'timetable';
let draft = false;
let draftSchedule = null;
const STORAGE_KEY = 'ims-academic-scheduling:v1';
const CSV_BOM = '\uFEFF';
function readSavedState() {
  try {
    const state = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return state && state.version === 1 ? state : {};
  } catch {
    return {};
  }
}
const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const savedState = readSavedState();
let maxConsecutiveClasses = Number.isInteger(savedState.maxConsecutiveClasses) && savedState.maxConsecutiveClasses >= 1 && savedState.maxConsecutiveClasses <= 6 ? savedState.maxConsecutiveClasses : 3;
const approvedVersions = { ...(isRecord(savedState.approvedVersions) ? savedState.approvedVersions : {}) };
const savedDrafts = { ...(isRecord(savedState.drafts) ? savedState.drafts : {}) };
const facultyOverrides = { ...(isRecord(savedState.facultyOverrides) ? savedState.facultyOverrides : {}) };
const manualFaculty = { ...(isRecord(savedState.manualFaculty) ? savedState.manualFaculty : {}) };
let facultyDirectory = Array.isArray(savedState.facultyDirectory) ? [...new Set(savedState.facultyDirectory.filter((name) => typeof name === 'string' && name.trim()).map((name) => name.trim()))] : [];
let attendance = Array.isArray(savedState.attendance) ? savedState.attendance.filter((item) => isRecord(item) && typeof item.faculty === 'string' && days.includes(item.day) && ['present', 'absent', 'late'].includes(item.status)) : [];
const dailyCancellations = { ...(isRecord(savedState.dailyCancellations) ? savedState.dailyCancellations : {}) };
let absences = Array.isArray(savedState.absences) ? savedState.absences : [];
let auditLog = Array.isArray(savedState.auditLog) ? savedState.auditLog.filter((item) => isRecord(item) && typeof item.at === 'string' && Number.isFinite(Date.parse(item.at)) && typeof item.action === 'string' && typeof item.detail === 'string' && [1, 3, 5].includes(Number(item.semester)) && ['A', 'B', 'C', 'D'].includes(item.section) && typeof item.week === 'string').slice(-500) : [];
let toastTimer;

const semester = () => Number($('#programme').value);
const section = () => ($('#section').value.match(/Section (\w+)/) || [,'A'])[1];
const master = () => window.MASTER_RESOURCE[semester()];
const selectedWeek = () => $('#week').value;
function selectedDateLabel(day) {
  const match = selectedWeek().match(/(\d{1,2})[–-](\d{1,2})\s+(\w+)\s+(\d{4})/);
  if (!match) return day;
  const months = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
  const date = new Date(Number(match[4]), months[match[3]], Number(match[1]) + days.indexOf(day));
  return Number.isNaN(date.getTime()) ? day : date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}
function periodStartMinutes() { return [0, 60, 130, 190, 250, 310, 365]; }
const scheduleKey = (term = semester(), week = selectedWeek()) => `${term}|${week}`;
const substitutionKey = (day, group, slot) => `${semester()}|${selectedWeek()}|${day}|${group}|${slot}`;
const activeAbsences = () => absences.filter((item) => Number(item.semester ?? semester()) === semester() && (item.week ?? selectedWeek()) === selectedWeek());
let draftKey = null;
const currentSchedule = () => draft && draftSchedule && draftKey === scheduleKey()
  ? draftSchedule
  : (validSchedule(approvedVersions[scheduleKey()], semester()) ? approvedVersions[scheduleKey()] : master().schedule);

function restoreSelection() {
  const selection = savedState.selection || {};
  if ([1, 3, 5].includes(Number(selection.semester))) $('#programme').value = String(selection.semester);
  if (['A', 'B', 'C', 'D'].includes(selection.section)) $('#section').value = `Section ${selection.section}`;
  if ([...$('#week').options].some((option) => option.value === selection.week)) $('#week').value = selection.week;
}

function validSchedule(schedule, term) {
  const periodCount = window.MASTER_RESOURCE[term]?.periods?.length;
  return Boolean(periodCount && days.every((day) => ['A', 'B', 'C', 'D'].every((group) => Array.isArray(schedule?.[day]?.[group]) && schedule[day][group].length === periodCount)));
}

restoreSelection();
const savedDraft = savedState.draft;
if (savedDraft && Number(savedDraft.semester) === semester() && savedDraft.week === selectedWeek() && validSchedule(savedDraft.schedule, semester())) {
  savedDrafts[scheduleKey()] = savedDraft.schedule;
}
if (!approvedVersions[scheduleKey()] && validSchedule(approvedVersions[semester()], semester())) approvedVersions[scheduleKey()] = approvedVersions[semester()];

function loadSelectedDraft() {
  draftKey = scheduleKey();
  draftSchedule = validSchedule(savedDrafts[draftKey], semester()) ? savedDrafts[draftKey] : null;
  draft = Boolean(draftSchedule);
}
loadSelectedDraft();

function saveState() {
  try {
    if (draft && draftSchedule && draftKey) savedDrafts[draftKey] = draftSchedule;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stateSnapshot()));
    return true;
  } catch {
    return false;
  }
}

function addAuditEntry(action, detail) {
  auditLog.push({ at: new Date().toISOString(), action, detail: String(detail), semester: semester(), section: section(), week: selectedWeek() });
  if (auditLog.length > 500) auditLog = auditLog.slice(-500);
}

function stateSnapshot() {
  return {
      version: 1,
      selection: { semester: semester(), section: section(), week: selectedWeek() },
      maxConsecutiveClasses,
      auditLog,
      approvedVersions,
      drafts: savedDrafts,
      facultyOverrides,
      manualFaculty,
      absences,
      facultyDirectory,
      attendance,
      dailyCancellations
  };
}
const selectedSubjects = () => semester() === 3
  ? [...master().subjects, { code: 'BIG DATA', title: 'BIG DATA', group: 'GR-A,B,C,D', faculty: 'Mr.Sanjay Kumar Sharma', kind: 'Specialization' }]
  : master().subjects;

function matchingSubjects(text, group = section()) {
  const raw = String(text || '').toUpperCase();
  const isLab = /\(L\d+\)|\bLAB\b/.test(raw);
  const batch = raw.match(/BATCH\s*-?\s*(1|2)/)?.[1];
  const codes = new Set(Object.entries(codeAliases[semester()] || {}).filter(([alias]) => raw.includes(alias)).flatMap(([alias, options]) => {
    if (semester() === 1 && ['CA', 'PST'].includes(alias)) return [isLab ? options[1] : options[0]];
    if (semester() === 3 && ['DBMS', 'FE', 'BDA', 'PYTHON'].includes(alias)) return [isLab ? options[1] : options[0]];
    if (semester() === 5 && ['DBMS', 'JAVA'].includes(alias)) return [isLab ? options[1] : options[0]];
    return [options[0]];
  }));
  return selectedSubjects().filter((item) => {
    if (!codes.has(item.code) && !raw.includes(item.title.toUpperCase())) return false;
    const groupText = item.group.toUpperCase();
    if (groupText.startsWith('GR-')) return groupText.slice(3).split(',').some((part) => part.replace(/[^A-D]/g, '').includes(group));
    if (/BATCH/.test(groupText) && batch) return groupText.includes(`BATCH-${batch}`);
    return true;
  });
}

function facultyFor(text, group = section(), day = '', slot = -1) {
  const override = facultyOverrides[substitutionKey(day, group, slot)];
  if (override) return [override];
  const manual = manualFaculty[manualKey(text, group)];
  if (manual) return [manual];
  return [...new Set(matchingSubjects(text, group).map((item) => item.faculty).filter((name) => name && name.toUpperCase() !== 'ALL FACULTY'))];
}

function manualKey(text, group = section()) {
  const codes = [...new Set(matchingSubjects(text, group).map((item) => item.code))].sort();
  const identity = codes.length ? codes.join('+') : String(text || '').trim().toUpperCase();
  return `${semester()}|${group}|${identity}`;
}

function manualKeyForCode(code, group) { return `${semester()}|${group}|${code}`; }

function allFaculty() {
  const termPrefix = `${semester()}|`;
  const weekPrefix = `${semester()}|${selectedWeek()}|`;
  const termAssignments = Object.entries(manualFaculty).filter(([key]) => key.startsWith(termPrefix)).map(([, name]) => name);
  const weekSubstitutions = Object.entries(facultyOverrides).filter(([key]) => key.startsWith(weekPrefix)).map(([, name]) => name);
  const sourceFaculty = Object.values(window.MASTER_RESOURCE).flatMap((resource) => resource.subjects.map((item) => item.faculty));
  return [...new Set([...sourceFaculty, ...facultyDirectory, ...termAssignments, ...weekSubstitutions].filter((name) => name && name.toUpperCase() !== 'ALL FACULTY'))].sort((a, b) => a.localeCompare(b));
}

function attendanceKey(faculty, day) { return `${semester()}|${selectedWeek()}|${day}|${faculty.toLowerCase()}`; }
function attendanceRecord(faculty, day) { return attendance.find((item) => item.key === attendanceKey(faculty, day)); }
function setAttendance(record) {
  attendance = attendance.filter((item) => item.key !== record.key);
  attendance.push(record);
}

function roomFor(text, group = section()) {
  const raw = String(text || '').toUpperCase();
  const isLab = /\(L\d+\)|\bLAB\b/.test(raw);
  if (semester() === 1 && isLab) {
    if (raw.includes('PST(L1)')) return 'LAB-1';
    if (raw.includes('PST(L2)')) return 'Lab-2';
    if (raw.includes('CA(L1)') || raw.includes('CA(L2)')) return ['A', 'B', 'D'].includes(group) ? 'Lab-1' : 'Lab-2';
  }
  if (semester() === 3) {
    if (raw.includes('FE') && raw.includes('BATCH-2')) return 'FE Lab-4';
    if (raw.includes('FE') && raw.includes('BATCH-1')) return 'FE Lab-3';
    if (raw.includes('BDA') && raw.includes('BATCH-1')) return 'BDA L1';
    if (raw.includes('BDA') && raw.includes('BATCH-2')) return 'BDA Lab-2';
  }
  if (semester() === 3 && isLab) {
    if (raw.includes('DBMS(L3)')) return 'DBMS Lab-3';
    if (raw.includes('PYTHON(L1)')) return 'Python Lab-1';
    if (raw.includes('PYTHON(L3)')) return 'Python Lab-3';
    if (raw.includes('FE') && raw.includes('L3')) return raw.includes('BATCH-2') ? 'FE Lab-4' : 'FE Lab-3';
    if (raw.includes('BDA') && raw.includes('L1')) return 'BDA L1';
    if (raw.includes('BDA') && raw.includes('L2')) return 'BDA Lab-2';
  }
  if (semester() === 5 && isLab) {
    if (raw.includes('DBMS(L4)')) return 'LAB-4';
    if (raw.includes('JAVA(L2)')) return 'LAB-2';
  }
  return master().rooms.find((entry) => entry.group.toUpperCase() === group.toUpperCase())?.room || master().defaultRooms;
}

function classType(text) {
  if (/\(L\d+\)|\bLAB\b/i.test(text)) return 'lab';
  if (/YOGA|LIBRARY|MENTOR|REMEDIAL|MINOR PROJECT/i.test(text)) return 'activity';
  return 'lecture';
}

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

function renderSchedule() {
  const data = master();
  const group = section();
  const table = $('#scheduleTable');
  table.querySelector('thead').innerHTML = `<tr><th>DAY</th>${data.periods.map((period, slot) => `<th>${slot === data.lunchSlot ? 'LUNCH' : period.slice(0, 5)}<span>${period.slice(6)}</span></th>`).join('')}</tr>`;
  table.querySelector('tbody').innerHTML = days.map((day) => `<tr><td class="day">${day}</td>${data.periods.map((period, slot) => {
    const cancellationKey = substitutionKey(day, group, slot);
    if (dailyCancellations[cancellationKey]) return `<td><div class="course-card postponed" title="${escapeHtml(dailyCancellations[cancellationKey])}"><span>POSTPONED</span><small>${escapeHtml(dailyCancellations[cancellationKey])}</small></div></td>`;
    const label = currentSchedule()[day][group][slot];
    if (slot === data.lunchSlot) return '<td><div class="course-card break">LUNCH</div></td>';
    if (!label) return `<td><div class="course-card empty" ${draft ? `role="button" tabindex="0" aria-label="Edit empty period ${escapeHtml(period)} on ${day}, Section ${group}"` : ''} data-day="${day}" data-slot="${slot}">—</div></td>`;
    const faculty = facultyFor(label, group, day, slot).join(', ');
    const room = roomFor(label, group);
    const main = activeView === 'faculty' ? faculty || label : activeView === 'room' ? room : label;
    const secondary = activeView === 'faculty' ? (faculty ? label : 'Faculty not mapped') : activeView === 'room' ? label : faculty || 'Faculty not mapped';
    const title = `${label} · ${faculty || 'Faculty not mapped'} · ${room}`;
    return `<td><div class="course-card ${classType(label)}" role="button" tabindex="0" aria-label="${escapeHtml(`${main}, ${secondary}, ${day}, Section ${group}, ${period}`)}" data-course="${encodeURIComponent(label)}" data-day="${day}" data-slot="${slot}" title="${escapeHtml(title)}"><span>${escapeHtml(main)}</span><small>${escapeHtml(secondary)}</small></div></td>`;
  }).join('')}</tr>`).join('');
  table.querySelectorAll('[data-slot]').forEach((cell) => cell.addEventListener('click', () => {
    const day = cell.dataset.day; const slot = Number(cell.dataset.slot); const label = cell.dataset.course ? decodeURIComponent(cell.dataset.course) : '';
    if (draft) editPeriod(day, group, slot, label); else if (label) showCourse(label, group, day, slot);
  }));
  table.querySelectorAll('[role="button"]').forEach((cell) => cell.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); cell.click(); }
  }));
  $('#semesterDetail').textContent = String(semester());
  $('#sectionDetail').textContent = group;
  $('#lunchDetail').textContent = data.periods[data.lunchSlot];
  $('#roomDetail').textContent = roomFor('', group);
  $('#dateLabel').textContent = selectedWeek().toUpperCase();
  $('#printMeta').textContent = `BCA Semester ${semester()} · Section ${group} · ${selectedWeek()} · ${draft ? 'Daily draft' : 'Published master'}`;
}

function editPeriod(day, group, slot, current) {
  const choices = [...new Set(days.flatMap((weekday) => ['A', 'B', 'C', 'D'].flatMap((sectionName) => master().schedule[weekday][sectionName])))]
    .filter((value) => value && !/LUNCH BREAK/i.test(value)).sort();
  const options = ['<option value="">No class</option>', ...choices.map((value) => `<option ${value === current ? 'selected' : ''}>${escapeHtml(value)}</option>`)].join('');
  openModal(`<div class="modal-kicker">DAILY DRAFT · ${escapeHtml(day.toUpperCase())} · SECTION ${group}</div><h2 class="modal-title">Edit period</h2><p class="modal-copy">Choose a class from the approved master resource or clear this period. Changes save in this browser.</p><div class="field"><label for="periodClass">Class</label><select id="periodClass">${options}</select></div><div class="load-row"><strong>Period</strong><span>${escapeHtml(master().periods[slot])}</span><span>Draft</span></div>`, 'Save period', (event) => {
    event.preventDefault(); draftSchedule[day][group][slot] = $('#periodClass').value;
    addAuditEntry('Edit schedule', `${day} Section ${group}, ${master().periods[slot]}: ${current || 'empty'} → ${draftSchedule[day][group][slot] || 'empty'}`);
    $('#modal').close(); renderSchedule(); validate();
    showToast(saveState() ? `${day} Section ${group} updated and saved in this browser.` : `${day} Section ${group} updated for this session, but browser storage could not save it.`);
  });
}

function showCourse(label, group = section(), day = 'Mon', slot = 0) {
  const rows = matchingSubjects(label, group);
  const titles = [...new Set(rows.map((item) => item.title))];
  const codes = [...new Set(rows.map((item) => item.code))];
  const teachers = facultyFor(label, group, day, slot);
  const period = master().periods[slot];
  const missingFaculty = teachers.length === 0;
  const content = `<div class="modal-kicker">BCA SEMESTER ${semester()} · SECTION ${group}</div><h2 class="modal-title">${escapeHtml(label)}</h2><p class="modal-copy">${escapeHtml(day)} · source timetable effective 26 Oct 2026.</p><div class="load-row"><strong>Subject</strong><span>${escapeHtml(titles.join(' / ') || 'No mapped subject row')}</span><span>${escapeHtml(codes.join(', ') || '—')}</span></div><div class="load-row"><strong>Faculty</strong><span>${escapeHtml(teachers.join(' / ') || 'Not listed')}</span><span>${missingFaculty ? 'Manual assignment needed' : 'Source / admin'}</span></div><div class="load-row"><strong>Room</strong><span>${escapeHtml(roomFor(label, group))}</span><span>Source</span></div><div class="load-row"><strong>Period</strong><span>${escapeHtml(period)}</span><span>Selected week</span></div>${missingFaculty ? '<div class="candidate"><span class="check-icon">!</span><div><strong>No faculty match found</strong><small>An admin can choose a listed faculty member or enter a name manually.</small></div></div>' : ''}`;
  if (missingFaculty) openModal(content, 'Assign faculty', (event) => { event.preventDefault(); $('#modal').close(); assignFaculty(label, group); });
  else openModal(content, 'Close');
}

function attendanceFlow(defaultFaculty = '', defaultDay = 'Mon') {
  const names = allFaculty().map((name) => `<option>${escapeHtml(name)}</option>`).join('');
  const dayOptions = days.map((day) => `<option ${day === defaultDay ? 'selected' : ''}>${day}</option>`).join('');
  const arrivalOptions = master().periods.map((period, slot) => slot === master().lunchSlot || slot === 0 ? '' : `<option value="${slot}">Arrived at ${escapeHtml(period.split('–')[0])} · before this period</option>`).join('') + `<option value="${master().periods.length}">Arrived after the last period</option>`;
  openModal(`<div class="modal-kicker">FACULTY ATTENDANCE · ${escapeHtml(selectedWeek())}</div><h2 class="modal-title">Mark daily attendance</h2><p class="modal-copy">Record the faculty member’s status for one working day. For late arrival, select the timetable hour they arrived; earlier classes will be queued for admin approval.</p><div class="field"><label for="attendanceFaculty">Faculty member</label><select id="attendanceFaculty">${names}</select></div><div class="field"><label for="attendanceDay">Day</label><select id="attendanceDay">${dayOptions}</select></div><div class="field"><label for="attendanceStatus">Attendance status</label><select id="attendanceStatus"><option value="present">Present</option><option value="late">Late arrival</option><option value="absent">Absent</option></select></div><div class="field" id="lateArrivalField" hidden><label for="lateArrivalSlot">Arrival time · timetable period</label><select id="lateArrivalSlot">${arrivalOptions}</select><small>Classes starting before the selected hour will need a cover or postponement decision.</small></div>`, 'Save attendance', (event) => {
    event.preventDefault();
    const faculty = $('#attendanceFaculty').value;
    const day = $('#attendanceDay').value;
    const status = $('#attendanceStatus').value;
    const arrivalSlot = status === 'late' ? Number($('#lateArrivalSlot').value) : null;
    const lateMinutes = status === 'late' ? (periodStartMinutes()[arrivalSlot] ?? 420) : 0;
    const arrivalTime = status === 'late' ? (arrivalSlot < master().periods.length ? master().periods[arrivalSlot].split('–')[0] : 'after last period') : '';
    if (!faculty) { showToast('Choose a faculty member first.'); return; }
    const record = { key: attendanceKey(faculty, day), semester: semester(), week: selectedWeek(), day, faculty, status, lateMinutes, arrivalSlot, arrivalTime, approved: status === 'present', updatedAt: new Date().toISOString() };
    setAttendance(record);
    addAuditEntry('Mark faculty attendance', `${faculty} marked ${status}${arrivalTime ? `, arrived at ${arrivalTime}` : ''} on ${day}`);
    const saved = saveState(); $('#modal').close(); renderPage('overview');
    showToast(saved ? `${faculty} marked ${status}${arrivalTime ? ` · arrived ${arrivalTime}` : ''}. ${status === 'present' ? 'Attendance saved.' : 'Review affected classes to update the daily timetable.'}` : 'Attendance updated for this session, but browser storage could not save it.');
    if (status !== 'present') setTimeout(() => reviewAttendance(record.key), 120);
  });
  if (defaultFaculty) $('#attendanceFaculty').value = defaultFaculty;
  $('#attendanceStatus').addEventListener('change', () => { $('#lateArrivalField').hidden = $('#attendanceStatus').value !== 'late'; });
}

function affectedAttendanceClasses(record) {
  const starts = periodStartMinutes();
  const arrivalSlot = Number.isInteger(record.arrivalSlot) ? record.arrivalSlot : Math.max(0, starts.findIndex((minute) => minute >= record.lateMinutes));
  return ['A', 'B', 'C', 'D'].flatMap((group) => master().periods.flatMap((_, slot) => {
    if (slot === master().lunchSlot || (record.status === 'late' && slot >= arrivalSlot)) return [];
    const label = dailyCancellations[substitutionKey(record.day, group, slot)] ? '' : currentSchedule()[record.day][group][slot];
    if (!label || !facultyFor(label, group, record.day, slot).includes(record.faculty)) return [];
    const busy = new Set(['A', 'B', 'C', 'D'].flatMap((other) => {
      const otherLabel = dailyCancellations[substitutionKey(record.day, other, slot)] ? '' : currentSchedule()[record.day][other][slot]; return otherLabel ? facultyFor(otherLabel, other, record.day, slot) : [];
    }));
    const codes = matchingSubjects(label, group).map((item) => item.code);
    const sameSubject = selectedSubjects().filter((item) => codes.includes(item.code)).map((item) => item.faculty).filter((name) => name && name.toUpperCase() !== 'ALL FACULTY');
    const choices = [...new Set([...sameSubject, ...allFaculty()])].filter((name) => name !== record.faculty && !busy.has(name) && !exceedsConsecutiveLoad(name, record.day, slot));
    return [{ group, slot, label, choices }];
  }));
}

function reviewAttendance(key) {
  const record = attendance.find((item) => item.key === key);
  if (!record) return;
  const affected = affectedAttendanceClasses(record);
  if (!affected.length) {
    record.approved = true; saveState(); renderPage('overview');
    showToast('No scheduled classes need an update. Attendance review is complete.'); return;
  }
  const rows = affected.map((item, index) => `<div class="attendance-decision"><div><strong>Section ${item.group} · ${escapeHtml(master().periods[item.slot])}</strong><small>${escapeHtml(item.label)}</small></div><div class="field"><label for="attendanceChoice${index}">Daily action</label><select id="attendanceChoice${index}"><option value="">Choose faculty manually</option>${item.choices.map((name) => `<option value="${escapeHtml(name)}">Cover: ${escapeHtml(name)}</option>`).join('')}<option value="__postpone">Postpone this class</option></select></div><div class="field attendance-manual"><label for="attendanceManual${index}">Or enter faculty</label><input id="attendanceManual${index}" maxlength="100" placeholder="Faculty name"></div></div>`).join('');
  openModal(`<div class="modal-kicker">ADMIN APPROVAL · ${escapeHtml(record.day.toUpperCase())}</div><h2 class="modal-title">Update today’s timetable</h2><p class="modal-copy">${escapeHtml(record.faculty)} is ${record.status === 'absent' ? 'absent' : `late · arrived at ${record.arrivalTime || record.lateMinutes + ' minutes after start'}`}. Assign a covering faculty member or postpone each affected class. The daily schedule changes only after approval.</p>${rows}`, 'Approve daily changes', (event) => {
    event.preventDefault();
    const decisions = affected.map((item, index) => {
      const chosen = $(`#attendanceChoice${index}`).value;
      const manual = $(`#attendanceManual${index}`).value.trim();
      return { ...item, action: chosen === '__postpone' ? 'postpone' : 'cover', substitute: manual || chosen };
    });
    const missing = decisions.find((item) => item.action === 'cover' && !item.substitute);
    if (missing) { showToast('Choose a cover or postpone every affected class.'); return; }
    const unavailable = decisions.find((item) => item.action === 'cover' && (exceedsConsecutiveLoad(item.substitute, record.day, item.slot) || ['A', 'B', 'C', 'D'].some((group) => {
      const label = currentSchedule()[record.day][group][item.slot]; return label && facultyFor(label, group, record.day, item.slot).includes(item.substitute);
    })));
    if (unavailable) { showToast(`${unavailable.substitute} is already teaching or exceeds the daily load. Choose another cover.`); return; }
    const duplicateCover = decisions.find((item, index) => item.action === 'cover' && decisions.some((other, otherIndex) => otherIndex !== index && other.action === 'cover' && other.slot === item.slot && other.substitute.toLowerCase() === item.substitute.toLowerCase()));
    if (duplicateCover) { showToast(`${duplicateCover.substitute} cannot cover two sections at the same time.`); return; }
    if (!draft || draftKey !== scheduleKey()) { draft = true; draftKey = scheduleKey(); draftSchedule = structuredClone(currentSchedule()); }
    decisions.forEach((item) => {
      const keyForSlot = substitutionKey(record.day, item.group, item.slot);
      if (item.action === 'postpone') { dailyCancellations[keyForSlot] = item.label; delete facultyOverrides[keyForSlot]; }
      else { facultyOverrides[keyForSlot] = item.substitute; delete dailyCancellations[keyForSlot]; }
    });
    record.approved = true; record.decisions = decisions.map(({ group, slot, label, action, substitute }) => ({ group, period: slot, label, action, substitute: substitute || '' }));
    addAuditEntry('Approve attendance timetable update', `${record.faculty} · ${decisions.length} class changes approved for ${record.day}`);
    const saved = saveState(); $('#modal').close(); renderSchedule(); validate(false); renderPage('overview');
    showToast(saved ? `Daily timetable updated for ${record.day}. Publish the daily version to issue the approved schedule.` : 'Daily changes applied for this session, but browser storage could not save them.');
  });
}

function manageFaculty() {
  const options = allFaculty().map((name) => `<option>${escapeHtml(name)}</option>`).join('');
  openModal(`<div class="modal-kicker">ACADEMIC SETUP · FACULTY DIRECTORY</div><h2 class="modal-title">Add faculty member</h2><p class="modal-copy">Add a name to the admin directory so it is available for teaching assignments and daily cover decisions.</p><div class="field"><label for="newFacultyName">Faculty name</label><input id="newFacultyName" maxlength="100" placeholder="Full name"></div><div class="load-row"><strong>Existing directory</strong><span>${allFaculty().length} names</span><span>Available</span></div>`, 'Add faculty', (event) => {
    event.preventDefault(); const name = $('#newFacultyName').value.trim();
    if (!name) { showToast('Enter a faculty name.'); return; }
    if (allFaculty().some((item) => item.toLowerCase() === name.toLowerCase())) { showToast('That faculty member is already in the directory.'); return; }
    facultyDirectory.push(name); addAuditEntry('Add faculty', `${name} added to faculty directory`); const saved = saveState(); $('#modal').close(); renderPage('setup');
    showToast(saved ? `${name} added to the faculty directory.` : `${name} added for this session, but browser storage could not save it.`);
  });
}

function assignFaculty(label, group = section(), keyOverride = '') {
  const choices = allFaculty().map((name) => `<option>${escapeHtml(name)}</option>`).join('');
  const save = (event) => {
    event.preventDefault();
    const name = $('#manualFacultyName').value.trim() || $('#existingFaculty').value;
    if (!name) { showToast('Choose an instructor or enter a faculty name.'); return; }
    manualFaculty[keyOverride || manualKey(label, group)] = name;
    addAuditEntry('Assign faculty', `${name} assigned to ${label} in Section ${group}`);
    $('#modal').close();
    const saved = saveState();
    renderSchedule();
    validate(false);
    if (activePage !== 'timetable') renderPage(activePage);
    showToast(saved ? `${name} assigned to ${label} for Section ${group}.` : `Assignment is active for this session, but browser storage could not save it.`);
  };
  openModal(`<div class="modal-kicker">ADMIN · MANUAL FACULTY ALLOCATION</div><h2 class="modal-title">Assign a faculty member</h2><p class="modal-copy">No source faculty match was found for <strong>${escapeHtml(label)}</strong>, Section ${escapeHtml(group)}. Choose an existing instructor or enter a name. The assignment saves in this browser.</p><div class="field"><label for="existingFaculty">Choose faculty</label><select id="existingFaculty"><option value="">Select a faculty member</option>${choices}</select></div><div class="field"><label for="manualFacultyName">Or enter a faculty name</label><input id="manualFacultyName" type="text" autocomplete="off" placeholder="Type faculty name"></div>`, 'Save assignment', save);
}

function assignSubjectRow(code, title) {
  const choices = allFaculty().map((name) => `<option>${escapeHtml(name)}</option>`).join('');
  openModal(`<div class="modal-kicker">ADMIN · SUBJECT ALLOCATION</div><h2 class="modal-title">Update ${escapeHtml(code)}</h2><p class="modal-copy">${escapeHtml(title)}. Choose the section and assign the faculty member responsible for this subject.</p><div class="field"><label for="manualGroup">Section</label><select id="manualGroup">${['A','B','C','D'].map((name) => `<option ${name === section() ? 'selected' : ''}>${name}</option>`).join('')}</select></div><div class="field"><label for="existingFaculty">Choose faculty</label><select id="existingFaculty"><option value="">Select a faculty member</option>${choices}</select></div><div class="field"><label for="manualFacultyName">Or enter a faculty name</label><input id="manualFacultyName" type="text" autocomplete="off" placeholder="Type faculty name"></div>`, 'Save assignment', (event) => {
    event.preventDefault();
    const name = $('#manualFacultyName').value.trim() || $('#existingFaculty').value;
    if (!name) { showToast('Choose an instructor or enter a faculty name.'); return; }
    const group = $('#manualGroup').value;
    manualFaculty[manualKeyForCode(code, group)] = name;
    addAuditEntry('Assign faculty', `${name} assigned to ${code} in Section ${group}`);
    $('#modal').close(); const saved = saveState(); if (activePage !== 'timetable') renderPage(activePage); renderSchedule(); validate(false);
    showToast(saved ? `${name} assigned to ${code} for Section ${group}.` : `Assignment is active for this session, but browser storage could not save it.`);
  });
}

function openModal(content, action = 'Confirm', handler) {
  $('#modalContent').innerHTML = content;
  const button = $('#modalAction');
  button.textContent = action;
  button.style.display = action === 'Close' ? 'none' : '';
  button.onclick = handler || null;
  $('#modal').showModal();
}

function showToast(message) {
  const toast = $('#toast'); toast.textContent = message; toast.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove('show'), 2600);
}

function validate(notify = true) {
  const data = master();
  const conflicts = [];
  const unmapped = [];
  const facultyDays = new Map();
  days.forEach((day) => {
    data.periods.forEach((_, slot) => {
      if (slot === data.lunchSlot) return;
      const byFaculty = new Map();
      const byRoom = new Map();
      ['A', 'B', 'C', 'D'].forEach((group) => {
        const label = dailyCancellations[substitutionKey(day, group, slot)] ? '' : currentSchedule()[day][group][slot];
        if (!label) return;
        const room = roomFor(label, group);
        if (room) {
          if (!byRoom.has(room)) byRoom.set(room, new Set());
          byRoom.get(room).add(group);
        }
        const assignedFaculty = facultyFor(label, group, day, slot);
        if (!assignedFaculty.length) unmapped.push(`${label} · Section ${group} · ${day} · ${data.periods[slot]}`);
        assignedFaculty.forEach((faculty) => {
          if (!faculty || faculty.toUpperCase() === 'ALL FACULTY') return;
          if (!byFaculty.has(faculty)) byFaculty.set(faculty, new Set());
          byFaculty.get(faculty).add(group);
          const key = `${day}|${faculty}`;
          if (!facultyDays.has(key)) facultyDays.set(key, new Set());
          facultyDays.get(key).add(slot);
        });
      });
      byFaculty.forEach((groups, faculty) => { if (groups.size > 1) conflicts.push(`${faculty} has overlapping classes in Sections ${[...groups].sort().join(', ')} on ${day} at ${data.periods[slot]}.`); });
      byRoom.forEach((groups, room) => { if (groups.size > 1) conflicts.push(`${room} is double-booked by Sections ${[...groups].sort().join(', ')} on ${day} at ${data.periods[slot]}.`); });
    });
  });
  facultyDays.forEach((slots, key) => {
    const [day, faculty] = key.split('|');
    let run = 0;
    for (let slot = 0; slot < data.periods.length; slot++) {
      if (slot === data.lunchSlot) run = 0;
      else if (slots.has(slot)) run++;
      else run = 0;
      if (run > maxConsecutiveClasses) { conflicts.push(`${faculty} has more than ${maxConsecutiveClasses} consecutive classes on ${day}.`); break; }
    }
  });
  const card = $('#conflictCard');
  if (conflicts.length) {
    card.classList.add('warning');
    const detail = conflicts.slice(0, 3).map(escapeHtml).join('<br>');
    const more = conflicts.length > 3 ? `<br>+ ${conflicts.length - 3} more issue${conflicts.length === 4 ? '' : 's'}` : '';
    card.innerHTML = `<span class="check-icon">!</span><div><b>${conflicts.length} scheduling conflict${conflicts.length > 1 ? 's' : ''}</b><small>${detail}${more}</small></div>`;
    if (notify) showToast(`Validation found ${conflicts.length} faculty or room conflicts.`);
  } else {
    card.classList.toggle('warning', unmapped.length > 0);
    card.innerHTML = unmapped.length
      ? `<span class="check-icon">!</span><div><b>No overlaps · ${unmapped.length} unassigned session${unmapped.length === 1 ? '' : 's'}</b><small>Assign faculty from Faculty & Workload before publishing if needed. First: ${escapeHtml(unmapped[0])}</small></div>`
      : '<span class="check-icon">✓</span><div><b>No mapped faculty conflicts</b><small>Checked source faculty and section assignments.</small></div>';
    if (notify) showToast(unmapped.length ? `No overlaps found; ${unmapped.length} scheduled sessions still need faculty review.` : 'Validation complete · no mapped faculty overlaps.');
  }
  return conflicts;
}

function generate() {
  if (!draft) {
    draft = true;
    draftKey = scheduleKey();
    draftSchedule = structuredClone(validSchedule(approvedVersions[draftKey], semester()) ? approvedVersions[draftKey] : master().schedule);
    addAuditEntry('Create daily draft', `BCA Semester ${semester()} · ${selectedWeek()}`);
    const saved = saveState();
    $('#publishStatus').className = 'status-pill';
    $('#publishStatus').innerHTML = '<i></i> Daily draft';
    $('#generateButton').innerHTML = '<span>✓</span> Review & publish';
    showToast(saved ? `Created a daily draft from the published BCA Semester ${semester()} master.` : 'Draft created for this session, but browser storage could not save it.');
    return;
  }
  const conflicts = validate();
  if (conflicts.length) return;
  const published = validSchedule(approvedVersions[scheduleKey()], semester()) ? approvedVersions[scheduleKey()] : master().schedule;
    const changes = days.flatMap((day) => ['A', 'B', 'C', 'D'].flatMap((group) => master().periods.map((period, slot) => {
      const key = substitutionKey(day, group, slot);
      const before = published[day][group][slot] || '—';
      const after = dailyCancellations[key] ? `POSTPONED · ${dailyCancellations[key]}` : facultyOverrides[key] && draftSchedule[day][group][slot] ? `${draftSchedule[day][group][slot]} · Cover: ${facultyOverrides[key]}` : draftSchedule[day][group][slot] || '—';
      return { day, group, period, before, after, slot };
    }).filter((item) => item.slot !== master().lunchSlot && item.before !== item.after)));
  const changeRows = changes.map((item) => `<tr><td>${escapeHtml(item.day)}</td><td>Section ${item.group}</td><td>${escapeHtml(item.period)}</td><td>${escapeHtml(item.before)}</td><td>${escapeHtml(item.after)}</td></tr>`).join('');
  const changeReview = changes.length
    ? `<div class="table-overflow"><table class="data-table"><thead><tr><th>DAY</th><th>SECTION</th><th>PERIOD</th><th>PUBLISHED</th><th>DAILY VERSION</th></tr></thead><tbody>${changeRows}</tbody></table></div>`
    : '<div class="empty-state">No timetable changes from the currently published version.</div>';
  openModal(`<div class="modal-kicker">REVIEW DAILY SCHEDULE · ${changes.length} CHANGE${changes.length === 1 ? '' : 'S'}</div><h2 class="modal-title">Issue this daily version?</h2><p class="modal-copy">The approved master is effective ${master().effectiveDate}. This will publish the ${escapeHtml(selectedWeek())} BCA Semester ${semester()} schedule for all sections.</p>${changeReview}`, 'Issue version', (event) => {
      event.preventDefault(); $('#modal').close(); approvedVersions[draftKey] = draftSchedule; delete savedDrafts[draftKey]; addAuditEntry('Publish daily version', `BCA Semester ${semester()} · ${selectedWeek()}`); draftSchedule = null; draft = false; const saved = saveState();
    $('#publishStatus').className = 'status-pill published'; $('#publishStatus').innerHTML = '<i></i> Published';
    $('#generateButton').innerHTML = '<span>▷</span> Create daily version'; showToast(saved ? 'Daily version issued and saved in this browser.' : 'Daily version issued for this session, but browser storage could not save it.');
  });
}

function exceedsConsecutiveLoad(facultyName, day, proposedSlot) {
  const data = master();
  const slots = new Set([proposedSlot]);
  ['A', 'B', 'C', 'D'].forEach((group) => data.periods.forEach((_, slot) => {
    if (slot === data.lunchSlot) return;
    const label = dailyCancellations[substitutionKey(day, group, slot)] ? '' : currentSchedule()[day][group][slot];
    if (label && facultyFor(label, group, day, slot).includes(facultyName)) slots.add(slot);
  }));
  let run = 0;
  for (let slot = 0; slot < data.periods.length; slot++) {
    if (slot === data.lunchSlot) run = 0;
    else if (slots.has(slot)) { run++; if (run > maxConsecutiveClasses) return true; }
    else run = 0;
  }
  return false;
}

function absenceFlow() {
  const faculties = allFaculty();
  const names = faculties.map((name) => `<option>${escapeHtml(name)}</option>`).join('');
  const weekdays = days.map((day) => `<option>${day}</option>`).join('');
  const periods = master().periods.map((time, slot) => slot === master().lunchSlot ? '' : `<option value="${slot}">${escapeHtml(time)}</option>`).join('');
  openModal(`<div class="modal-kicker">DAILY OPERATIONS · SOURCE MASTER</div><h2 class="modal-title">Record faculty absence</h2><p class="modal-copy">The master resource supplies faculty and section assignments. Select the absent instructor and affected day.</p><div class="field"><label for="absentFaculty">Absent faculty</label><select id="absentFaculty">${names}</select></div><div class="field"><label for="absenceDay">Day</label><select id="absenceDay">${weekdays}</select></div><div class="field"><label for="absencePeriod">Period</label><select id="absencePeriod">${periods}</select></div>`, 'Find affected classes', (event) => {
    event.preventDefault();
    const absent = $('#absentFaculty').value; const day = $('#absenceDay').value; const slot = Number($('#absencePeriod').value);
    if (!absent) { showToast('No faculty member is scheduled in that day and period.'); return; }
    const affected = ['A', 'B', 'C', 'D'].flatMap((group) => {
        const label = dailyCancellations[substitutionKey(day, group, slot)] ? '' : currentSchedule()[day][group][slot];
      if (!label || !facultyFor(label, group, day, slot).includes(absent)) return [];
      const codes = matchingSubjects(label, group).map((item) => item.code);
      const sameCourse = [...new Set(selectedSubjects().filter((item) => codes.includes(item.code) && item.faculty !== absent && item.faculty && item.faculty.toUpperCase() !== 'ALL FACULTY').map((item) => item.faculty))];
      const busy = new Set(['A', 'B', 'C', 'D'].flatMap((other) => {
        const name = dailyCancellations[substitutionKey(day, other, slot)] ? '' : currentSchedule()[day][other][slot]; return name ? facultyFor(name, other, day, slot) : [];
      }));
      const sameCourseAvailable = sameCourse.filter((name) => name !== absent && !busy.has(name) && !exceedsConsecutiveLoad(name, day, slot));
      const eligible = sameCourseAvailable.length ? sameCourseAvailable : allFaculty().filter((name) => name !== absent && !busy.has(name) && !exceedsConsecutiveLoad(name, day, slot));
      return [{ group, label, room: roomFor(label, group), eligible, manualFallback: sameCourseAvailable.length === 0 }];
    });
    $('#modal').close();
    if (!affected.length) { showToast(`No ${absent} session was found in that period.`); return; }
    reviewSubstitutes({ absent, day, slot, affected });
  });
  const updateAbsenceFaculty = () => {
    const day = $('#absenceDay').value; const slot = Number($('#absencePeriod').value);
    const previous = $('#absentFaculty').value;
    const scheduled = [...new Set(['A', 'B', 'C', 'D'].flatMap((group) => {
      const label = dailyCancellations[substitutionKey(day, group, slot)] ? '' : currentSchedule()[day][group][slot];
      return label ? facultyFor(label, group, day, slot) : [];
    }))].sort();
    $('#absentFaculty').innerHTML = scheduled.length ? scheduled.map((name) => `<option>${escapeHtml(name)}</option>`).join('') : '<option value="">No faculty scheduled</option>';
    if (scheduled.includes(previous)) $('#absentFaculty').value = previous;
  };
  $('#absenceDay').addEventListener('change', updateAbsenceFaculty);
  $('#absencePeriod').addEventListener('change', updateAbsenceFaculty);
  updateAbsenceFaculty();
}

function markHolidayFlow() {
  const weekdayOptions = days.map((day) => `<option>${day}</option>`).join('');
  openModal(`<div class="modal-kicker">DAILY OPERATIONS · SCHEDULE OVERRIDE</div><h2 class="modal-title">Mark a day as a holiday</h2><p class="modal-copy">This clears scheduled classes for all four sections on the selected weekday in a new daily draft. The approved timetable stays in place until you publish the draft.</p><div class="field"><label for="holidayDay">Day</label><select id="holidayDay">${weekdayOptions}</select></div><div class="field"><label for="holidayReason">Reason (optional)</label><input id="holidayReason" type="text" maxlength="120" placeholder="Holiday or campus closure"></div>`, 'Apply holiday', (event) => {
    event.preventDefault();
    const day = $('#holidayDay').value;
    const reason = $('#holidayReason').value.trim();
    if (!draft) { draft = true; draftKey = scheduleKey(); draftSchedule = structuredClone(currentSchedule()); }
    ['A', 'B', 'C', 'D'].forEach((group) => {
      draftSchedule[day][group] = draftSchedule[day][group].map((course, slot) => {
        const key = substitutionKey(day, group, slot); delete dailyCancellations[key]; delete facultyOverrides[key];
        return slot === master().lunchSlot ? course : '';
      });
    });
    addAuditEntry('Apply holiday', `${day} closed for all sections${reason ? `: ${reason}` : ''}`);
    const saved = saveState();
    $('#publishStatus').className = 'status-pill'; $('#publishStatus').innerHTML = '<i></i> Daily draft';
    $('#generateButton').innerHTML = '<span>✓</span> Review & publish';
    $('#modal').close(); renderSchedule(); validate(false); if (activePage === 'operations') renderPage('operations');
    showToast(saved ? `${day} marked as a holiday in the daily draft.` : `${day} marked for this session, but browser storage could not save it.`);
  });
}

function restorePublishedDayFlow() {
  const weekdayOptions = days.map((day) => `<option>${day}</option>`).join('');
  openModal(`<div class="modal-kicker">DAILY OPERATIONS · SCHEDULE OVERRIDE</div><h2 class="modal-title">Restore a day from the published timetable</h2><p class="modal-copy">This replaces all draft edits on the chosen weekday for Sections A–D with the currently published timetable. You can review the changes before issuing.</p><div class="field"><label for="restoreDay">Day</label><select id="restoreDay">${weekdayOptions}</select></div>`, 'Restore published day', (event) => {
    event.preventDefault();
    const day = $('#restoreDay').value;
    const published = validSchedule(approvedVersions[scheduleKey()], semester()) ? approvedVersions[scheduleKey()] : master().schedule;
    if (!draft) { draft = true; draftKey = scheduleKey(); draftSchedule = structuredClone(published); }
    ['A', 'B', 'C', 'D'].forEach((group) => {
      draftSchedule[day][group] = [...published[day][group]];
      master().periods.forEach((_, slot) => { const key = substitutionKey(day, group, slot); delete dailyCancellations[key]; delete facultyOverrides[key]; });
    });
    addAuditEntry('Restore published day', `${day} restored for all sections`);
    const saved = saveState();
    $('#publishStatus').className = 'status-pill'; $('#publishStatus').innerHTML = '<i></i> Daily draft';
    $('#generateButton').innerHTML = '<span>✓</span> Review & publish';
    $('#modal').close(); renderSchedule(); validate(false); if (activePage === 'operations') renderPage('operations');
    showToast(saved ? `${day} restored from the published timetable.` : `${day} restored for this session, but browser storage could not save it.`);
  });
}

function reviewSubstitutes(caseData) {
  const items = caseData.affected.map((session, index) => `<div class="load-row"><strong>Section ${session.group}</strong><span>${escapeHtml(session.label)} · ${escapeHtml(session.room)}</span><span>${master().periods[caseData.slot]}</span></div><div class="field"><label for="candidate${index}">${session.manualFallback ? 'Available faculty option' : 'Same-course substitute'}</label><select id="candidate${index}"><option value="">Choose faculty</option>${session.eligible.map((name) => `<option>${escapeHtml(name)}</option>`).join('')}</select><label for="candidateManual${index}">Or enter a faculty name manually</label><input id="candidateManual${index}" type="text" maxlength="100" placeholder="Faculty name" autocomplete="off">${session.manualFallback ? '<small>No same-course instructor is free. Choose an available faculty member or enter a name; validation checks load conflicts before publishing.</small>' : ''}</div>`).join('');
  openModal(`<div class="modal-kicker">AFFECTED CLASSES · ${escapeHtml(caseData.day.toUpperCase())}</div><h2 class="modal-title">Review substitute options</h2><p class="modal-copy">Same-course faculty who are free in this period appear first. If none are free, choose any available faculty member or enter a name. Timetable validation checks overlaps and teaching loads before publishing.</p>${items}`, 'Approve substitution', (event) => {
    event.preventDefault();
    const decisions = caseData.affected.map((session, index) => ({ ...session, substitute: $(`#candidateManual${index}`).value.trim() || $(`#candidate${index}`).value }));
    if (decisions.some((item) => !item.substitute)) { showToast('Choose a substitute for each affected class.'); return; }
    if (!draft) { draft = true; draftKey = scheduleKey(); draftSchedule = structuredClone(currentSchedule()); }
    decisions.forEach((decision) => { facultyOverrides[substitutionKey(caseData.day, decision.group, caseData.slot)] = decision.substitute; });
    absences.push({ semester: semester(), week: selectedWeek(), faculty: caseData.absent, day: caseData.day, period: caseData.slot, decisions });
    addAuditEntry('Approve substitution', `${caseData.absent} absent on ${caseData.day} at ${master().periods[caseData.slot]}; ${decisions.map((item) => `Section ${item.group} → ${item.substitute}`).join(', ')}`);
    const saved = saveState();
    $('#publishStatus').className = 'status-pill'; $('#publishStatus').innerHTML = '<i></i> Daily draft'; $('#generateButton').innerHTML = '<span>✓</span> Review & publish';
    $('#modal').close(); showToast(saved ? 'Substitution approved in the daily draft.' : 'Substitution is active for this session, but browser storage could not save it.'); renderSchedule(); validate(false); if (activePage === 'operations') renderPage('operations');
  });
}

function revertSubstitution(recordIndex, group) {
  const record = absences[recordIndex];
  const decision = record?.decisions?.find((item) => item.group === group);
  if (!record || !decision) return;
  openModal(`<div class="modal-kicker">DAILY OPERATIONS · ${escapeHtml(record.day.toUpperCase())}</div><h2 class="modal-title">Revert this substitution?</h2><p class="modal-copy">Section ${escapeHtml(group)} will return to its previously assigned faculty for ${escapeHtml(decision.label)}. You can approve a different substitute afterward.</p><div class="load-row"><strong>Current</strong><span>${escapeHtml(decision.substitute)}</span><span>Substitute</span></div>`, 'Revert substitution', (event) => {
    event.preventDefault();
    const key = `${Number(record.semester ?? semester())}|${record.week ?? selectedWeek()}|${record.day}|${group}|${record.period}`;
    delete facultyOverrides[key];
    record.decisions = record.decisions.filter((item) => item.group !== group);
    if (!record.decisions.length) absences.splice(recordIndex, 1);
    addAuditEntry('Revert substitution', `${decision.substitute} removed from Section ${group} for ${decision.label} on ${record.day}`);
    const saved = saveState(); $('#modal').close(); renderSchedule(); validate(false); renderPage('operations');
    showToast(saved ? `Substitution for Section ${group} reverted.` : `Substitution reverted for this session, but browser storage could not save it.`);
  });
}

function showConstraints() {
  const data = master();
  openModal(`<div class="modal-kicker">SCHEDULING RULES · MASTER RESOURCE</div><h2 class="modal-title">BCA Semester ${semester()} schedule details</h2><p class="modal-copy">The published timetable is effective ${data.effectiveDate} for the ${data.session} term. Periods and lunch timing come from the workbook.</p><div class="load-row"><strong>Lunch</strong><span>${data.periods[data.lunchSlot]}</span><span>Source sheet</span></div><div class="load-row"><strong>Teaching days</strong><span>Monday–Friday</span><span>Source sheet</span></div><div class="load-row"><strong>Groups</strong><span>A, B, C, D</span><span>Source sheet</span></div><div class="load-row"><strong>Rooms</strong><span>${escapeHtml(data.defaultRooms)}</span><span>Source sheet</span></div><p class="modal-copy" style="margin-top:14px">The handwritten note sets a three-class maximum by default. The admin can adjust this rule in Settings; the limit is checked during validation.</p>`, 'Close');
}

function courseTable() {
  const rows = selectedSubjects().filter((item) => {
    const scope = String(item.group || '').toUpperCase();
    if (scope.startsWith('GR-')) return scope.slice(3).replace(/[^A-D]/g, '').includes(section());
    return true;
  }).map((item) => {
    const manual = manualFaculty[manualKeyForCode(item.code, section())];
    const missing = !item.faculty || item.faculty.toUpperCase() === 'ALL FACULTY';
    const faculty = manual || (item.faculty && item.faculty.toUpperCase() !== 'ALL FACULTY' ? item.faculty : 'Not listed');
    const action = `<button class="outline-button" data-action="manual-subject" data-code="${escapeHtml(item.code)}" data-title="${escapeHtml(item.title)}">${missing && !manual ? 'Assign faculty' : 'Edit assignment'}</button>`;
    return `<tr><td><strong>${escapeHtml(item.code)}</strong></td><td>${escapeHtml(item.title)}</td><td>${escapeHtml(item.group || '—')}</td><td>${escapeHtml(faculty)}</td><td>${escapeHtml(item.kind || 'Theory')}</td><td>${action}</td></tr>`;
  }).join('');
  return `<div class="table-overflow"><table class="data-table"><thead><tr><th>COURSE CODE</th><th>SUBJECT</th><th>SECTION / BATCH</th><th>FACULTY · SECTION ${section()}</th><th>TYPE</th><th>ADMIN ACTION</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

function facultyWorkload() {
  const counts = new Map();
  const unassignedRows = [];
  days.forEach((day) => ['A', 'B', 'C', 'D'].forEach((group) => master().periods.forEach((_, slot) => {
    if (slot === master().lunchSlot) return;
    const label = dailyCancellations[substitutionKey(day, group, slot)] ? '' : currentSchedule()[day][group][slot];
    if (!label) return;
    const faculty = facultyFor(label, group, day, slot);
    if (!faculty.length) { unassignedRows.push({ day, group, slot, label }); return; }
    faculty.forEach((name) => {
      if (!counts.has(name)) counts.set(name, { sessions: 0, sections: new Set(), days: new Set(), subjects: new Set(), daily: new Map() });
      const load = counts.get(name);
      load.sessions++;
      load.sections.add(group);
      load.days.add(day);
      load.daily.set(day, (load.daily.get(day) || 0) + 1);
      matchingSubjects(label, group).forEach((item) => load.subjects.add(item.title));
      if (!matchingSubjects(label, group).length) load.subjects.add(label);
    });
  })));
  const rows = allFaculty().map((name) => ({ name, ...(counts.get(name) || { sessions: 0, sections: new Set(), days: new Set(), subjects: new Set(), daily: new Map() }) })).sort((left, right) => right.sessions - left.sessions || left.name.localeCompare(right.name));
  const table = rows.map((item) => `<tr><td><strong>${escapeHtml(item.name)}</strong></td><td>${item.sessions}</td><td>${escapeHtml([...item.sections].sort().join(', ') || '—')}</td><td>${item.days.size}</td><td>${escapeHtml(days.filter((day) => item.daily.has(day)).map((day) => `${day} ${item.daily.get(day)}`).join(' · ') || '—')}</td><td>${escapeHtml([...item.subjects].sort().join(', ') || '—')}</td></tr>`).join('');
  const unassignedTable = unassignedRows.map((item) => `<tr><td>${escapeHtml(item.day)}</td><td>Section ${item.group}</td><td>${escapeHtml(master().periods[item.slot])}</td><td>${escapeHtml(item.label)}</td><td><button class="outline-button" data-action="assign-unmapped" data-group="${item.group}" data-course="${encodeURIComponent(item.label)}">Assign faculty</button></td></tr>`).join('');
  return { rows, unassigned: unassignedRows.length, sessions: rows.reduce((total, item) => total + item.sessions, 0), table: `<div class="table-overflow"><table class="data-table"><thead><tr><th>FACULTY</th><th>SESSIONS</th><th>SECTIONS</th><th>TEACHING DAYS</th><th>SESSIONS BY DAY</th><th>SUBJECTS</th></tr></thead><tbody>${table}</tbody></table></div>`, unassignedTable: unassignedTable ? `<div class="table-overflow"><table class="data-table"><thead><tr><th>DAY</th><th>SECTION</th><th>PERIOD</th><th>CLASS</th><th>ADMIN ACTION</th></tr></thead><tbody>${unassignedTable}</tbody></table></div>` : '<div class="empty-state">All scheduled classes have a faculty mapping.</div>' };
}

function exportFacultyWorkload() {
  const rows = facultyWorkload().rows;
  const cell = (value) => {
    let text = String(value ?? '');
    if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
    return `"${text.replaceAll('"', '""')}"`;
  };
  const csv = [['Semester', 'Week', 'Faculty', 'Sessions', 'Sections', 'Teaching days', 'Sessions by day', 'Subjects'], ...rows.map((item) => [semester(), selectedWeek(), item.name, item.sessions, [...item.sections].sort().join(', '), [...item.days].sort().join(', '), days.filter((day) => item.daily.has(day)).map((day) => `${day} ${item.daily.get(day)}`).join(' · '), [...item.subjects].sort().join(', ')])].map((row) => row.map(cell).join(',')).join('\n');
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([CSV_BOM, csv], { type: 'text/csv;charset=utf-8' }));
  link.download = `BCA-semester-${semester()}-faculty-workload-${selectedWeek().replace(/[^\w-]+/g, '-')}.csv`;
  link.click(); URL.revokeObjectURL(link.href);
  showToast(`Exported faculty workloads for ${selectedWeek()}.`);
}

function exportAuditLog() {
  const records = auditLog.filter((item) => Number(item.semester) === semester() && item.week === selectedWeek());
  const cell = (value) => {
    let text = String(value ?? '');
    if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
    return `"${text.replaceAll('"', '""')}"`;
  };
  const csv = [['Time', 'Semester', 'Week', 'Section', 'Action', 'Details'], ...records.map((item) => [item.at, item.semester, item.week, item.section, item.action, item.detail])].map((row) => row.map(cell).join(',')).join('\n');
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([CSV_BOM, csv], { type: 'text/csv;charset=utf-8' }));
  link.download = `BCA-semester-${semester()}-activity-${selectedWeek().replace(/[^\w-]+/g, '-')}.csv`;
  link.click(); URL.revokeObjectURL(link.href);
  showToast(`Exported ${records.length} admin activity records.`);
}

function exportSubstitutions() {
  const records = activeAbsences();
  const cell = (value) => {
    let text = String(value ?? '');
    if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
    return `"${text.replaceAll('"', '""')}"`;
  };
  const decisions = records.flatMap((item) => item.decisions.map((decision) => [item.semester, item.week, item.day, master().periods[item.period], item.faculty, decision.group, decision.label, decision.room, decision.substitute, 'Admin approved']));
  const csv = [['Semester', 'Week', 'Day', 'Period', 'Absent faculty', 'Section', 'Course', 'Room', 'Substitute', 'Status'], ...decisions].map((row) => row.map(cell).join(',')).join('\n');
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([CSV_BOM, csv], { type: 'text/csv;charset=utf-8' }));
  link.download = `BCA-semester-${semester()}-substitutions-${selectedWeek().replace(/[^\w-]+/g, '-')}.csv`;
  link.click(); URL.revokeObjectURL(link.href);
  showToast(`Exported ${decisions.length} substitution records.`);
}

function renderPage(page) {
  const data = master();
  const panel = (title, copy, inner) => `<section class="content-panel"><h2>${title}</h2><p>${copy}</p>${inner}</section>`;
  const summary = (cards) => `<div class="summary-grid">${cards.map((item) => `<div class="summary-card"><small>${escapeHtml(item[0])}</small><strong>${escapeHtml(item[1])}</strong><span>${escapeHtml(item[2])}</span></div>`).join('')}</div>`;
  let html = '';
  if (page === 'overview') {
    const today = window.overviewDay || 'Mon';
    const entries = allFaculty().map((name) => {
      const record = attendance.find((item) => Number(item.semester) === semester() && item.week === selectedWeek() && item.day === today && item.faculty.toLowerCase() === name.toLowerCase());
      const status = record ? record.status === 'late' ? `Late · ${record.arrivalTime || `${record.lateMinutes} min late`}` : record.status : 'Not marked';
      const tag = record ? record.status === 'present' ? 'green' : record.status === 'late' ? 'amber' : 'red' : '';
      return `<tr><td><strong>${escapeHtml(name)}</strong></td><td>${tag ? `<span class="tag ${tag}">${escapeHtml(status)}</span>` : escapeHtml(status)}</td><td>${record?.approved ? '<span class="tag green">Reviewed</span>' : record && record.status !== 'present' ? `<button class="outline-button" data-action="review-attendance" data-key="${escapeHtml(record.key)}">Review daily changes</button>` : '—'}</td><td><button class="outline-button" data-action="mark-attendance" data-faculty="${escapeHtml(name)}" data-day="${today}">${record ? 'Update' : 'Mark status'}</button></td></tr>`;
    }).join('');
    const marked = attendance.filter((item) => Number(item.semester) === semester() && item.week === selectedWeek() && item.day === today);
    const pending = marked.filter((item) => item.status !== 'present' && !item.approved).length;
    html = summary([['SCHEDULE', draft ? 'Daily draft' : 'Published', `BCA semester ${semester()}`], ['FACULTY', allFaculty().length, 'In the admin directory'], ['ATTENDANCE', `${marked.filter((item) => item.status === 'present').length} present`, `${marked.filter((item) => item.status === 'absent').length} absent · ${marked.filter((item) => item.status === 'late').length} late`], ['PENDING APPROVAL', pending, 'Daily timetable updates']]) + panel('Daily faculty attendance', 'Mark each faculty member present, absent or late. Late and absent records create class changes for admin review before publication.', `<div class="attendance-toolbar"><label class="field"><span>Schedule day · ${escapeHtml(selectedDateLabel(today))}</span><select id="overviewDay">${days.map((day) => `<option ${day === today ? 'selected' : ''}>${day}</option>`).join('')}</select></label><button class="primary-button" data-action="mark-attendance">＋ Mark faculty status</button><button class="outline-button" data-action="operations">Daily operations</button></div><div class="table-overflow"><table class="data-table"><thead><tr><th>FACULTY</th><th>STATUS · ${today.toUpperCase()}</th><th>DAILY TIMETABLE</th><th>ADMIN</th></tr></thead><tbody>${entries}</tbody></table></div>`) + panel('Academic overview', 'Manage the timetable, workload and academic structure for the selected semester and week.', '<div class="row-actions"><button class="outline-button" data-action="timetable">Open timetable</button><button class="outline-button" data-action="faculty">Faculty workload</button><button class="outline-button" data-action="setup">Academic setup</button></div>');
  }
  if (page === 'setup') html = panel('Academic structure', 'Programme, batch, groups, rooms and period times read from the master workbook.', `<div class="table-overflow"><table class="data-table"><thead><tr><th>PROGRAMME</th><th>SEMESTER</th><th>BATCH</th><th>EFFECTIVE</th><th>ROOMS</th><th>LUNCH</th></tr></thead><tbody><tr><td>BCA</td><td>${semester()}</td><td>${escapeHtml(data.batch)}</td><td>${data.effectiveDate}</td><td>${escapeHtml(data.defaultRooms)}</td><td>${escapeHtml(data.periods[data.lunchSlot])}</td></tr></tbody></table></div>`) + panel('Faculty directory', 'Add faculty members once, then use them across subject assignments and daily substitute decisions.', `<div class="row-actions"><button class="primary-button" data-action="add-faculty">＋ Add faculty</button><span class="tag">${allFaculty().length} available</span></div>`) + panel('Subjects and faculty assignments', 'Edit an assignment by section. Changes update workload totals and timetable faculty labels immediately.', courseTable());
  if (page === 'faculty') {
    const workload = facultyWorkload();
    const highestLoad = workload.rows[0];
    html = summary([['FACULTY', workload.rows.length, 'Names in the admin directory'], ['SCHEDULED SESSIONS', workload.sessions, `Across Sections A–D · ${selectedWeek()}`], ['UNASSIGNED SESSIONS', workload.unassigned, 'Need a faculty mapping'], ['HIGHEST WEEKLY LOAD', highestLoad ? `${highestLoad.name} · ${highestLoad.sessions}` : '—', 'Sessions assigned']]) + panel('Weekly faculty workload', 'Faculty are ranked by scheduled sessions; the table includes sections, weekday distribution and subjects.', `${workload.table}<div class="row-actions" style="margin-top:12px"><button class="outline-button" data-action="faculty-export">↓ Export workload CSV</button></div>`) + panel('Unassigned timetable sessions', 'Assign a faculty member directly to a scheduled class that has no subject-to-faculty match.', workload.unassignedTable) + panel('Faculty and subject assignments', 'Source subject codes, names, section mappings, types and faculty from the selected semester sheet.', courseTable());
  }
  if (page === 'operations') {
    const records = activeAbsences();
    const rows = records.map((item) => item.decisions.map((decision) => `<tr><td>${escapeHtml(item.day)}</td><td>${escapeHtml(data.periods[item.period] || '—')}</td><td>${escapeHtml(item.faculty)}</td><td>Section ${decision.group}</td><td>${escapeHtml(decision.label)}</td><td>${escapeHtml(decision.substitute)}</td><td><span class="tag green">Approved</span></td><td><button class="outline-button" data-action="revert-substitution" data-record="${absences.indexOf(item)}" data-group="${decision.group}">Revert</button></td></tr>`).join('')).join('');
    html = summary([['ABSENCES RECORDED', records.length, `BCA semester ${semester()}`], ['SUBSTITUTIONS', records.reduce((n, item) => n + item.decisions.length, 0), 'Admin decisions for this week'], ['SCHEDULE DATE', selectedWeek(), 'Selected week'], ['SOURCE', 'Master', `Effective ${data.effectiveDate}`]]) + panel('Daily operations', 'Record faculty absence, approve available substitutes, apply a weekday holiday or campus closure, or export decisions.', '<div class="row-actions"><button class="primary-button" data-action="absence">♙ Mark faculty absent</button><button class="outline-button" data-action="substitutions">Review substitutions</button><button class="outline-button" data-action="holiday">Apply holiday / closure</button><button class="outline-button" data-action="restore-day">Restore published day</button><button class="outline-button" data-action="export-substitutions">↓ Export substitutions CSV</button></div>') + panel('Substitution decisions', `Approved substitutions for ${escapeHtml(selectedWeek())}.`, rows ? `<div class="table-overflow"><table class="data-table"><thead><tr><th>DAY</th><th>PERIOD</th><th>ABSENT FACULTY</th><th>SECTION</th><th>COURSE</th><th>SUBSTITUTE</th><th>STATUS</th><th>ACTION</th></tr></thead><tbody>${rows}</tbody></table></div>` : '<div class="empty-state">No absence or substitute decisions recorded for this week.</div>');
  }
  if (page === 'reports') {
    const recent = auditLog.filter((item) => Number(item.semester) === semester() && item.week === selectedWeek()).slice(-20).reverse();
    const activityRows = recent.map((item) => `<tr><td>${escapeHtml(new Date(item.at).toLocaleString())}</td><td>${escapeHtml(item.action)}</td><td>${escapeHtml(item.detail)}</td><td>Section ${escapeHtml(item.section)}</td></tr>`).join('');
    html = summary([['VERSION', draft ? 'Daily draft' : 'Published master', `BCA semester ${semester()} · section ${section()}`], ['WEEK', selectedWeek(), 'Selected range'], ['EFFECTIVE DATE', data.effectiveDate, 'Source workbook'], ['EXPORT', 'CSV + JSON', 'Schedule and backup']]) + panel('Reports and exports', 'Export one section or all sections for the selected week, print the full timetable, or back up admin changes.', '<div class="row-actions"><button class="primary-button" data-action="export">↓ Export selected section CSV</button><button class="outline-button" data-action="export-all">↓ Export all sections CSV</button><button class="outline-button" data-action="print-all">▣ Print all sections</button><button class="outline-button" data-action="export-audit">↓ Export activity CSV</button><button class="outline-button" data-action="backup">↓ Backup admin data</button><button class="outline-button" data-action="restore">↑ Restore backup</button><button class="outline-button" data-action="constraints">Master source details</button></div>') + panel('Recent activity', `Admin changes for BCA Semester ${semester()} · ${escapeHtml(selectedWeek())}. Up to 20 recent actions are shown.`, activityRows ? `<div class="table-overflow"><table class="data-table"><thead><tr><th>TIME</th><th>ACTION</th><th>DETAILS</th><th>SECTION</th></tr></thead><tbody>${activityRows}</tbody></table></div>` : '<div class="empty-state">No activity has been recorded for this semester and week.</div>');
  }
  if (page === 'settings') html = summary([['LUNCH', data.periods[data.lunchSlot], `Semester ${semester()}`], ['DAY SPAN', '09:30–16:30', 'Seven source periods'], ['WORKING DAYS', '5', 'Monday–Friday'], ['MAX CONSECUTIVE CLASSES', maxConsecutiveClasses, 'Per faculty per day']]) + panel('Timetable constraints', 'The app uses the published master’s period layout, year-specific lunch slot, group allocation and mapped faculty.', `<div class="table-overflow"><table class="data-table"><thead><tr><th>RULE</th><th>VALUE</th><th>SOURCE</th></tr></thead><tbody><tr><td>Effective date</td><td>${data.effectiveDate}</td><td>${data.sourceSheet}</td></tr><tr><td>Lunch</td><td>${escapeHtml(data.periods[data.lunchSlot])}</td><td>${data.sourceSheet}</td></tr><tr><td>Consecutive faculty classes</td><td>Maximum ${maxConsecutiveClasses}</td><td>Admin setting · default 3 from handwritten note</td></tr><tr><td>Section rooms</td><td>${escapeHtml(data.defaultRooms)}</td><td>${data.sourceSheet}</td></tr></tbody></table></div><div class="field"><label for="maxConsecutiveClasses">Maximum consecutive classes per faculty</label><select id="maxConsecutiveClasses">${[1,2,3,4,5,6].map((value) => `<option value="${value}" ${value === maxConsecutiveClasses ? 'selected' : ''}>${value} classes</option>`).join('')}</select></div><button class="primary-button" data-action="save-load-rule">Save scheduling rule</button>`);
  $('#pageExtra').innerHTML = html;
  const dayControl = $('#overviewDay');
  if (dayControl) dayControl.addEventListener('change', () => { window.overviewDay = dayControl.value; renderPage('overview'); });
}

function showSubstitutions() {
  const records = activeAbsences();
  openModal(`<div class="modal-kicker">SUBSTITUTION REVIEW · ${escapeHtml(selectedWeek())}</div><h2 class="modal-title">${records.length ? `${records.length} absence record${records.length > 1 ? 's' : ''}` : 'No substitution requests'}</h2><p class="modal-copy">${records.length ? 'Approved substitute decisions are listed on the Daily Operations page for this week.' : 'Select “Mark faculty absent” to search the selected week for affected classes and available same-course faculty.'}</p>`, 'Close');
}

function setPage(page) {
  activePage = page;
  document.querySelectorAll('.nav-item[data-page]').forEach((item) => item.classList.toggle('active', item.dataset.page === page));
  const names = { overview: 'Overview', setup: 'Academic setup', timetable: 'Timetable builder', faculty: 'Faculty & workload', operations: 'Daily operations', reports: 'Reports & exports', settings: 'Settings' };
  const titles = { overview: 'Academic overview', setup: 'Academic setup', timetable: 'Weekly timetable', faculty: 'Faculty & workload', operations: 'Daily operations', reports: 'Reports & exports', settings: 'Scheduling settings' };
  $('#crumbCurrent').textContent = names[page].toUpperCase(); $('#pageTitle').textContent = titles[page];
  $('#pageDescription').textContent = ({ overview: 'A clear view of published schedules, faculty and operations.', setup: 'Review the programme structure and semester source data.', timetable: 'View the approved teaching week by section, faculty or room.', faculty: 'Review actual subject, group and faculty assignments.', operations: 'Record absences and approve available same-course substitutes.', reports: 'Export schedules and inspect the active source version.', settings: 'Review schedule timings and validation rules.' })[page];
  ['.toolbar', '.viewbar', '.workspace', '.details-panel', '.source-note'].forEach((selector) => { $(selector).hidden = page !== 'timetable'; });
  $('#pageExtra').hidden = page === 'timetable'; if (page !== 'timetable') renderPage(page);
  $('#sidebar').classList.remove('open');
}

function exportCsv(allSections = false) {
  const data = master(); const groups = allSections ? ['A', 'B', 'C', 'D'] : [section()];
  const rows = [['Semester', 'Section', 'Week', 'Day', 'Time', 'Course code', 'Course', 'Faculty', 'Room', 'Version']];
  groups.forEach((group) => days.forEach((day) => data.periods.forEach((period, slot) => {
    const isLunch = slot === data.lunchSlot;
    const isPostponed = Boolean(dailyCancellations[substitutionKey(day, group, slot)]);
    const scheduled = isLunch ? '' : currentSchedule()[day][group][slot] || '';
    const course = isLunch ? 'LUNCH' : isPostponed ? `POSTPONED: ${dailyCancellations[substitutionKey(day, group, slot)]}` : scheduled;
    const courseCode = isLunch || !course || isPostponed ? '' : matchingSubjects(course, group).map((item) => item.code).join(', ');
    const faculty = isLunch || !course || isPostponed ? '' : facultyFor(course, group, day, slot).join(', ');
    const room = isLunch || !course || isPostponed ? '' : roomFor(course, group);
    rows.push([semester(), group, selectedWeek(), day, period, courseCode, course, faculty, room, draft ? 'Daily draft' : 'Published']);
  })));
  const cell = (value) => {
    let text = String(value ?? '');
    if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
    return `"${text.replaceAll('"', '""')}"`;
  };
  const csv = rows.map((row) => row.map(cell).join(',')).join('\n');
  const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([CSV_BOM, csv], { type: 'text/csv;charset=utf-8' }));
  link.download = `BCA-semester-${semester()}-${allSections ? 'all-sections' : `section-${groups[0]}`}-${selectedWeek().replace(/[^\w-]+/g, '-')}.csv`; link.click(); URL.revokeObjectURL(link.href); showToast(`Exported the ${draft ? 'daily draft' : 'published'} timetable for ${allSections ? 'all sections' : `Section ${groups[0]}`}.`);
}

function printAllSections() {
  const printWindow = window.open('', '_blank');
  if (!printWindow) { showToast('Allow pop-ups to print the full master timetable.'); return; }
  const data = master();
  const sectionTables = ['A', 'B', 'C', 'D'].map((group) => `<section><h2>Section ${group}</h2><table><thead><tr><th>Day</th>${data.periods.map((period, slot) => `<th>${slot === data.lunchSlot ? 'Lunch' : escapeHtml(period)}</th>`).join('')}</tr></thead><tbody>${days.map((day) => `<tr><th>${day}</th>${data.periods.map((period, slot) => {
    if (slot === data.lunchSlot) return '<td class="lunch">LUNCH</td>';
    const label = dailyCancellations[substitutionKey(day, group, slot)] ? '' : currentSchedule()[day][group][slot];
    if (!label) return '<td class="empty">—</td>';
    const faculty = facultyFor(label, group, day, slot).join(', ') || 'Faculty not mapped';
    return `<td><strong>${escapeHtml(label)}</strong><small>${escapeHtml(faculty)} · ${escapeHtml(roomFor(label, group))}</small></td>`;
  }).join('')}</tr>`).join('')}</tbody></table></section>`).join('');
  printWindow.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>BCA Semester ${semester()} · ${escapeHtml(selectedWeek())}</title><style>body{font:11px Arial,sans-serif;color:#17242a;margin:18px}h1{font-size:20px;margin:0 0 4px}p{margin:0 0 16px;color:#555}section{break-inside:avoid;margin:0 0 18px}h2{font-size:15px;margin:0 0 6px}table{width:100%;border-collapse:collapse;table-layout:fixed}th,td{border:1px solid #aab1b4;padding:4px;text-align:center;vertical-align:middle}thead th{background:#24343d;color:#fff}td{height:46px}td small{display:block;font-size:8px;margin-top:4px}.lunch{background:#f4e6c7}.empty{color:#9a9a9a}@page{size:landscape;margin:10mm}</style></head><body><h1>IMS Ghaziabad · BCA Semester ${semester()}</h1><p>${escapeHtml(selectedWeek())} · ${draft ? 'Daily draft' : 'Published master'} · Effective ${escapeHtml(data.effectiveDate)}</p>${sectionTables}</body></html>`);
  printWindow.document.close();
  printWindow.setTimeout(() => { printWindow.focus(); printWindow.print(); }, 250);
}

function exportBackup() {
  if (!saveState()) { showToast('Could not save admin data in this browser; no backup was created.'); return; }
  const payload = { app: 'ims-academic-scheduling', exportedAt: new Date().toISOString(), data: stateSnapshot() };
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' }));
  link.download = `ims-timetable-backup-${new Date().toISOString().slice(0, 10)}.json`;
  link.click(); URL.revokeObjectURL(link.href); showToast('Downloaded a backup of schedules, faculty assignments and operations.');
}

function restoreBackup() {
  openModal(`<div class="modal-kicker">RESTORE ADMIN DATA</div><h2 class="modal-title">Choose a timetable backup</h2><p class="modal-copy">Restoring replaces the saved schedules, faculty assignments and operations in this browser with the selected backup.</p><div class="field"><label for="backupFile">JSON backup file</label><input id="backupFile" type="file" accept="application/json,.json"></div>`, 'Restore backup', async (event) => {
    event.preventDefault();
    const file = $('#backupFile').files[0];
    if (!file) { showToast('Choose a JSON backup file first.'); return; }
    let payload;
    try { payload = JSON.parse(await file.text()); } catch { showToast('That file is not valid JSON.'); return; }
    const data = payload?.data;
    if (payload?.app !== 'ims-academic-scheduling' || !isRecord(data) || data.version !== 1 || !isRecord(data.approvedVersions) || !isRecord(data.drafts) || !isRecord(data.manualFaculty) || !isRecord(data.facultyOverrides) || !Array.isArray(data.absences) || (data.auditLog !== undefined && !Array.isArray(data.auditLog)) || (data.facultyDirectory !== undefined && !Array.isArray(data.facultyDirectory)) || (data.attendance !== undefined && !Array.isArray(data.attendance)) || (data.dailyCancellations !== undefined && !isRecord(data.dailyCancellations))) {
      showToast('This file is not a supported timetable backup.'); return;
    }
    if (data.maxConsecutiveClasses !== undefined && (!Number.isInteger(data.maxConsecutiveClasses) || data.maxConsecutiveClasses < 1 || data.maxConsecutiveClasses > 6)) {
      showToast('The backup contains an invalid faculty-load rule.'); return;
    }
    for (const [key, schedule] of Object.entries(data.approvedVersions)) {
      const term = Number(key.split('|')[0]);
      if (![1, 3, 5].includes(term) || !validSchedule(schedule, term)) { showToast('The backup contains an invalid published schedule.'); return; }
    }
    for (const [key, schedule] of Object.entries(data.drafts)) {
      const term = Number(key.split('|')[0]);
      if (![1, 3, 5].includes(term) || !validSchedule(schedule, term)) { showToast('The backup contains an invalid draft schedule.'); return; }
    }
    const backupSelection = data.selection || {};
    const invalidAbsence = data.absences.some((item) => {
      if (!isRecord(item) || typeof item.faculty !== 'string' || !days.includes(item.day) || !Array.isArray(item.decisions)) return true;
      const term = Number(item.semester ?? backupSelection.semester);
      const period = Number(item.period);
      if (![1, 3, 5].includes(term) || !Number.isInteger(period) || period < 0 || period >= window.MASTER_RESOURCE[term].periods.length) return true;
      return item.decisions.some((decision) => !isRecord(decision) || !['A', 'B', 'C', 'D'].includes(decision.group) || typeof decision.label !== 'string' || typeof decision.substitute !== 'string');
    });
    if (invalidAbsence) { showToast('The backup contains invalid absence records.'); return; }
    if ((data.attendance || []).some((item) => !isRecord(item) || typeof item.faculty !== 'string' || !days.includes(item.day) || !['present', 'absent', 'late'].includes(item.status) || ![1, 3, 5].includes(Number(item.semester)) || typeof item.week !== 'string' || (item.status === 'late' && (!Number.isInteger(item.lateMinutes) || item.lateMinutes < 1 || item.lateMinutes > 420 || (item.arrivalSlot !== undefined && (!Number.isInteger(item.arrivalSlot) || item.arrivalSlot < 0 || item.arrivalSlot > window.MASTER_RESOURCE[Number(item.semester)].periods.length)))))) { showToast('The backup contains invalid attendance records.'); return; }
    if ((data.facultyDirectory || []).some((name) => typeof name !== 'string' || !name.trim()) || Object.values(data.dailyCancellations || {}).some((label) => typeof label !== 'string')) { showToast('The backup contains invalid faculty or daily schedule records.'); return; }
    if (Object.values(data.manualFaculty).some((name) => typeof name !== 'string') || Object.values(data.facultyOverrides).some((name) => typeof name !== 'string')) {
      showToast('The backup contains invalid faculty assignments.'); return;
    }
    if ((data.auditLog || []).some((item) => !isRecord(item) || typeof item.at !== 'string' || !Number.isFinite(Date.parse(item.at)) || typeof item.action !== 'string' || typeof item.detail !== 'string' || ![1, 3, 5].includes(Number(item.semester)) || !['A', 'B', 'C', 'D'].includes(item.section) || typeof item.week !== 'string')) {
      showToast('The backup contains invalid activity records.'); return;
    }
    Object.keys(approvedVersions).forEach((key) => delete approvedVersions[key]);
    Object.assign(approvedVersions, data.approvedVersions);
    Object.keys(savedDrafts).forEach((key) => delete savedDrafts[key]);
    Object.assign(savedDrafts, data.drafts);
    Object.keys(manualFaculty).forEach((key) => delete manualFaculty[key]);
    Object.assign(manualFaculty, data.manualFaculty);
    Object.keys(facultyOverrides).forEach((key) => delete facultyOverrides[key]);
    Object.assign(facultyOverrides, data.facultyOverrides);
    facultyDirectory = data.facultyDirectory || [];
    attendance = (data.attendance || []).map((item) => ({ ...item, key: item.key || `${Number(item.semester)}|${item.week}|${item.day}|${item.faculty.toLowerCase()}`, approved: Boolean(item.approved) }));
    Object.keys(dailyCancellations).forEach((key) => delete dailyCancellations[key]);
    Object.assign(dailyCancellations, data.dailyCancellations || {});
    auditLog = Array.isArray(data.auditLog) ? data.auditLog.slice(-500) : [];
    maxConsecutiveClasses = data.maxConsecutiveClasses ?? 3;
    const selection = data.selection || {};
    absences = data.absences.map((item) => ({ ...item, semester: Number(item.semester ?? selection.semester ?? 1), week: item.week ?? selection.week ?? '' }));
    if ([1, 3, 5].includes(Number(selection.semester))) $('#programme').value = String(selection.semester);
    if (['A', 'B', 'C', 'D'].includes(selection.section)) $('#section').value = `Section ${selection.section}`;
    if ([...$('#week').options].some((option) => option.value === selection.week)) $('#week').value = selection.week;
    draft = false; draftSchedule = null; loadSelectedDraft();
    addAuditEntry('Restore backup', `Admin data restored from ${payload.exportedAt || 'a backup file'}`);
    const saved = saveState(); $('#modal').close(); renderSchedule(); validate(false); if (activePage !== 'timetable') renderPage(activePage);
    $('#publishStatus').className = draft ? 'status-pill' : 'status-pill published';
    $('#publishStatus').innerHTML = `<i></i> ${draft ? 'Daily draft' : 'Published'}`;
    $('#generateButton').innerHTML = draft ? '<span>✓</span> Review & publish' : '<span>▷</span> Create daily version';
    showToast(saved ? 'Timetable backup restored in this browser.' : 'Backup restored for this session, but browser storage could not save it.');
  });
}

$('#generateButton').addEventListener('click', generate);
$('#validateButton').addEventListener('click', validate);
$('#constraintsButton').addEventListener('click', showConstraints);
$('#importButton').addEventListener('click', showConstraints);
$('#exportButton').addEventListener('click', exportCsv);
$('#printButton').addEventListener('click', () => window.print());
$('#editButton').addEventListener('click', () => openModal(`<div class="modal-kicker">EDIT TIMETABLE</div><h2 class="modal-title">Edit the daily version</h2><p class="modal-copy">Create a daily version first. Then select a class or empty period in the grid to change it. Faculty absence substitutions can be recorded in Daily Operations.</p>`, 'Close'));
document.querySelectorAll('.tab').forEach((tab) => tab.addEventListener('click', () => { activeView = tab.dataset.view; document.querySelectorAll('.tab').forEach((item) => item.classList.toggle('selected', item === tab)); renderSchedule(); }));
document.querySelectorAll('.nav-item[data-page],.operation-link').forEach((item) => item.addEventListener('click', () => setPage(item.dataset.page)));
$('#pageExtra').addEventListener('click', (event) => {
  const button = event.target.closest('[data-action]'); const action = button?.dataset.action; if (!action) return;
  if (action === 'timetable') setPage('timetable');
  if (action === 'setup') setPage('setup');
  if (action === 'faculty') setPage('faculty');
  if (action === 'operations') setPage('operations');
  if (action === 'mark-attendance') attendanceFlow(button.dataset.faculty || '', button.dataset.day || window.overviewDay || 'Mon');
  if (action === 'review-attendance') reviewAttendance(button.dataset.key);
  if (action === 'add-faculty') manageFaculty();
  if (action === 'absence') absenceFlow();
  if (action === 'holiday') markHolidayFlow();
  if (action === 'restore-day') restorePublishedDayFlow();
  if (action === 'substitutions') showSubstitutions();
  if (action === 'export') exportCsv();
  if (action === 'export-all') exportCsv(true);
  if (action === 'print-all') printAllSections();
  if (action === 'export-audit') exportAuditLog();
  if (action === 'export-substitutions') exportSubstitutions();
  if (action === 'faculty-export') exportFacultyWorkload();
  if (action === 'revert-substitution') revertSubstitution(Number(button.dataset.record), button.dataset.group);
  if (action === 'assign-unmapped') assignFaculty(decodeURIComponent(button.dataset.course), button.dataset.group);
  if (action === 'save-load-rule') {
    const value = Number($('#maxConsecutiveClasses').value);
    if (!Number.isInteger(value) || value < 1 || value > 6) { showToast('Choose a limit from 1 to 6 classes.'); return; }
    maxConsecutiveClasses = value;
    addAuditEntry('Update scheduling rule', `Maximum consecutive classes set to ${value}`);
    const saved = saveState(); validate(); renderPage('settings');
    showToast(saved ? `Maximum consecutive load set to ${value} classes.` : `Rule active for this session, but browser storage could not save it.`);
  }
  if (action === 'backup') exportBackup();
  if (action === 'restore') restoreBackup();
  if (action === 'constraints') showConstraints();
  if (action === 'manual-subject') assignSubjectRow(button.dataset.code, button.dataset.title);
});
$('#programme').addEventListener('change', () => {
  draft = false; draftSchedule = null; loadSelectedDraft(); const saved = saveState();
  $('#publishStatus').className = draft ? 'status-pill' : 'status-pill published'; $('#publishStatus').innerHTML = `<i></i> ${draft ? 'Daily draft' : 'Published'}`;
  $('#generateButton').innerHTML = draft ? '<span>✓</span> Review & publish' : '<span>▷</span> Create daily version';
  renderSchedule(); validate(false); if (activePage !== 'timetable') renderPage(activePage);
  if (!saved) showToast('Semester changed for this session, but browser storage could not save it.');
});
$('#section').addEventListener('change', () => {
  const saved = saveState(); renderSchedule(); validate(false); if (activePage !== 'timetable') renderPage(activePage);
  if (!saved) showToast('Section changed for this session, but browser storage could not save it.');
});
$('#week').addEventListener('change', () => {
  draft = false; draftSchedule = null; loadSelectedDraft(); const saved = saveState();
  $('#publishStatus').className = draft ? 'status-pill' : 'status-pill published'; $('#publishStatus').innerHTML = `<i></i> ${draft ? 'Daily draft' : 'Published'}`;
  $('#generateButton').innerHTML = draft ? '<span>✓</span> Review & publish' : '<span>▷</span> Create daily version';
  renderSchedule(); validate(false); if (activePage !== 'timetable') renderPage(activePage);
  showToast(saved ? `Selected week: ${selectedWeek()}.` : `Week changed for this session, but browser storage could not save it.`);
});
$('#menuButton').addEventListener('click', () => $('#sidebar').classList.toggle('open'));
$('#filterButton').addEventListener('click', () => openModal(`<div class="modal-kicker">TIMETABLE FILTERS</div><h2 class="modal-title">Current schedule</h2><p class="modal-copy">Choose semester, section and week using the controls above. Faculty and room views use assignments in the master workbook.</p><div class="load-row"><strong>Selection</strong><span>BCA ${semester()} · Section ${section()}</span><span>${escapeHtml(selectedWeek())}</span></div>`, 'Close'));

renderSchedule();
validate(false);
if (draft) {
  $('#publishStatus').className = 'status-pill';
  $('#publishStatus').innerHTML = '<i></i> Daily draft';
  $('#generateButton').innerHTML = '<span>✓</span> Review & publish';
}
