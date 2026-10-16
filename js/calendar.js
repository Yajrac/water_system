// One reusable date picker. Native date inputs still allow keyboard entry.
const calendarDialog = document.createElement('dialog');
calendarDialog.className = 'calendar-dialog';
calendarDialog.setAttribute('aria-labelledby', 'calendarTitle');
calendarDialog.innerHTML = `
  <div class="calendar-heading">
    <button type="button" class="btn" id="previousMonth" aria-label="Previous month">‹</button>
    <h2 id="calendarTitle" aria-live="polite"></h2>
    <button type="button" class="btn" id="nextMonth" aria-label="Next month">›</button>
  </div>
  <div class="calendar-weekdays" aria-hidden="true"><span>Su</span><span>Mo</span><span>Tu</span><span>We</span><span>Th</span><span>Fr</span><span>Sa</span></div>
  <div id="calendarDays" class="calendar-days"></div>
  <div class="calendar-actions">
    <button type="button" class="btn" id="calendarToday">Today</button>
    <button type="button" class="btn" id="calendarClear">Clear</button>
    <button type="button" class="btn" id="calendarClose">Close</button>
  </div>`;
document.body.appendChild(calendarDialog);
let calendarInput = null;
let calendarYear = 0;
let calendarMonth = 0;

function calendarDate(year, month, day) {
  return year + '-' + String(month + 1).padStart(2, '0') + '-' + String(day).padStart(2, '0');
}
function dateAllowed(date) {
  return (!calendarInput.min || date >= calendarInput.min) && (!calendarInput.max || date <= calendarInput.max);
}
function selectCalendarDate(date) {
  if (date && !dateAllowed(date)) return;
  calendarInput.value = date;
  calendarInput.dispatchEvent(new Event('input', { bubbles: true }));
  calendarInput.dispatchEvent(new Event('change', { bubbles: true }));
  calendarDialog.close();
  calendarInput.focus();
}
function drawCalendar() {
  document.getElementById('calendarTitle').textContent = new Intl.DateTimeFormat('en-PH', { month: 'long', year: 'numeric' }).format(new Date(calendarYear, calendarMonth, 1));
  const days = document.getElementById('calendarDays');
  days.replaceChildren();
  const offset = new Date(calendarYear, calendarMonth, 1).getDay();
  const count = new Date(calendarYear, calendarMonth + 1, 0).getDate();
  for (let index = 0; index < offset; index++) days.appendChild(document.createElement('span'));
  for (let day = 1; day <= count; day++) {
    const date = calendarDate(calendarYear, calendarMonth, day);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'calendar-day';
    button.textContent = day;
    button.dataset.date = date;
    button.setAttribute('aria-label', new Intl.DateTimeFormat('en-PH', { dateStyle: 'full' }).format(new Date(calendarYear, calendarMonth, day)));
    button.setAttribute('aria-pressed', String(date === calendarInput.value));
    button.disabled = !dateAllowed(date);
    if (date === calendarInput.value) button.classList.add('selected');
    if (date === WaterStore.today()) button.setAttribute('aria-current', 'date');
    button.addEventListener('click', () => selectCalendarDate(date));
    days.appendChild(button);
  }
  document.getElementById('calendarToday').disabled = !dateAllowed(WaterStore.today());
  document.getElementById('calendarClear').disabled = calendarInput.required;
}
function openCalendar(input) {
  calendarInput = input;
  const selected = input.value || WaterStore.today();
  calendarYear = Number(selected.slice(0, 4));
  calendarMonth = Number(selected.slice(5, 7)) - 1;
  drawCalendar();
  calendarDialog.showModal();
  calendarDialog.querySelector('.calendar-day.selected:not(:disabled), .calendar-day:not(:disabled)')?.focus();
}
function moveCalendarMonth(change) {
  const next = new Date(calendarYear, calendarMonth + change, 1);
  calendarYear = next.getFullYear();
  calendarMonth = next.getMonth();
  drawCalendar();
}
document.getElementById('previousMonth').addEventListener('click', () => moveCalendarMonth(-1));
document.getElementById('nextMonth').addEventListener('click', () => moveCalendarMonth(1));
document.getElementById('calendarToday').addEventListener('click', () => selectCalendarDate(WaterStore.today()));
document.getElementById('calendarClear').addEventListener('click', () => selectCalendarDate(''));
document.getElementById('calendarClose').addEventListener('click', () => calendarDialog.close());
document.querySelectorAll('input[type="date"]').forEach(input => {
  const wrapper = document.createElement('span');
  wrapper.className = 'date-control';
  input.before(wrapper);
  wrapper.appendChild(input);
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'date-picker-button';
  button.setAttribute('aria-label', 'Open calendar for ' + input.closest('label').childNodes[0].textContent.trim());
  button.setAttribute('aria-haspopup', 'dialog');
  button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v16H4z M4 10h16 M8 3v4 M16 3v4 M8 14h2 M14 14h2 M8 17h2"/></svg>';
  button.addEventListener('click', event => { event.preventDefault(); openCalendar(input); });
  wrapper.appendChild(button);
});
