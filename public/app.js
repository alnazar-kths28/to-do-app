const API = '/api';
let token = localStorage.getItem('token');
let currentUser = JSON.parse(localStorage.getItem('user') || 'null');
let todos = [];
let currentFilter = 'all';
let currentSort = 'date-desc';
let searchQuery = '';
let selectedIds = new Set();
let editingId = null;

// ─── UTILS ───────────────────────────────────────
const $ = (id) => document.getElementById(id);

const showScreen = (name) => {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  $(`${name}-screen`).classList.add('active');
};

const showToast = (msg, type = '') => {
  const t = $('toast');
  t.textContent = msg;
  t.className = `toast${type ? ' ' + type : ''}`;
  t.classList.remove('hidden');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.add('hidden'), 3000);
};

const apiFetch = async (path, options = {}) => {
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await res.json();
  if (res.status === 401 || res.status === 403) {
    // Токен протух или невалидный — разлогиниваем
    forceLogout();
    throw new Error('Session expired');
  }
  if (!res.ok) throw new Error(data.error || 'Ошибка');
  return data;
};

const forceLogout = () => {
  token = null; currentUser = null; todos = [];
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  showScreen('auth');
  showToast('Сессия истекла. Войдите снова.', 'error');
};

const escapeHtml = (str) =>
  String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

// ─── THEME ───────────────────────────────────────
const applyTheme = () => {
  const isLight = localStorage.getItem('theme') === 'light';
  document.body.classList.toggle('light', isLight);
  $('theme-btn').textContent = isLight ? '◑' : '◐';
};
$('theme-btn').addEventListener('click', () => {
  const next = localStorage.getItem('theme') === 'light' ? 'dark' : 'light';
  localStorage.setItem('theme', next);
  applyTheme();
});
applyTheme();

// ─── PASSWORD STRENGTH ───────────────────────────
$('reg-password').addEventListener('input', (e) => {
  const val = e.target.value;
  const pw = $('pw-strength');
  const fill = $('strength-fill');
  const label = $('strength-label');

  if (!val) { pw.classList.remove('visible'); return; }
  pw.classList.add('visible');

  let score = 0;
  if (val.length >= 8) score++;
  if (/[A-Z]/.test(val)) score++;
  if (/[0-9]/.test(val)) score++;
  if (/[^A-Za-z0-9]/.test(val)) score++;

  const levels = [
    { pct: '25%', color: '#ff5757', text: 'Слабый' },
    { pct: '50%', color: '#ffd557', text: 'Средний' },
    { pct: '75%', color: '#57ff99', text: 'Хороший' },
    { pct: '100%',color: '#57ff99', text: 'Отличный' },
  ];
  const l = levels[Math.max(0, score - 1)];
  fill.style.width = l.pct;
  fill.style.background = l.color;
  label.textContent = l.text;
  label.style.color = l.color;
});

// ─── SHOW/HIDE PASSWORD ──────────────────────────
document.querySelectorAll('.toggle-pw').forEach(btn => {
  btn.addEventListener('click', () => {
    const input = $(btn.dataset.target);
    input.type = input.type === 'password' ? 'text' : 'password';
    btn.textContent = input.type === 'password' ? '👁' : '🙈';
  });
});

// ─── AUTH TABS ────────────────────────────────────
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
    btn.classList.add('active');
    $(`${btn.dataset.tab}-form`).classList.add('active');
  });
});

// ─── REGISTER ────────────────────────────────────
$('register-btn').addEventListener('click', async () => {
  const username = $('reg-username').value.trim();
  const email    = $('reg-email').value.trim();
  const password = $('reg-password').value;
  $('register-error').textContent = '';
  if (!username || !email || !password) {
    $('register-error').textContent = 'Заполни все поля';
    return;
  }
  const btn = $('register-btn');
  btn.classList.add('loading');
  try {
    const data = await apiFetch('/auth/register', { method: 'POST', body: { username, email, password } });
    saveSession(data);
    initApp();
  } catch (err) {
    $('register-error').textContent = err.message;
  } finally { btn.classList.remove('loading'); }
});

// ─── LOGIN ────────────────────────────────────────
$('login-btn').addEventListener('click', async () => {
  const username = $('login-username').value.trim();
  const password = $('login-password').value;
  $('login-error').textContent = '';
  if (!username || !password) {
    $('login-error').textContent = 'Введи имя пользователя и пароль';
    return;
  }
  const btn = $('login-btn');
  btn.classList.add('loading');
  try {
    const data = await apiFetch('/auth/login', { method: 'POST', body: { username, password } });
    saveSession(data);
    initApp();
  } catch (err) {
    $('login-error').textContent = err.message;
  } finally { btn.classList.remove('loading'); }
});

$('login-password').addEventListener('keydown', e => { if (e.key === 'Enter') $('login-btn').click(); });
$('reg-password').addEventListener('keydown', e => { if (e.key === 'Enter') $('register-btn').click(); });

const saveSession = ({ token: t, user }) => {
  token = t; currentUser = user;
  localStorage.setItem('token', t);
  localStorage.setItem('user', JSON.stringify(user));
};

// ─── LOGOUT ──────────────────────────────────────
$('logout-btn').addEventListener('click', () => {
  token = null; currentUser = null; todos = []; selectedIds.clear();
  localStorage.removeItem('token'); localStorage.removeItem('user');
  showScreen('auth');
});

// ─── INIT APP ────────────────────────────────────
const initApp = async () => {
  $('user-name').textContent = currentUser?.username || '';
  $('user-avatar').textContent = (currentUser?.username?.[0] || 'U').toUpperCase();
  showScreen('app');
  await loadTodos();
};

// ─── LOAD TODOS ───────────────────────────────────
const loadTodos = async () => {
  try {
    todos = await apiFetch('/todos');
    renderTodos();
    updateStats();
  } catch (err) {
    if (err.message !== 'Session expired') showToast('Ошибка загрузки задач', 'error');
  }
};

// ─── SEARCH ──────────────────────────────────────
$('search-input').addEventListener('input', (e) => {
  searchQuery = e.target.value.trim().toLowerCase();
  $('search-clear').classList.toggle('hidden', !searchQuery);
  renderTodos();
});
$('search-clear').addEventListener('click', () => {
  $('search-input').value = '';
  searchQuery = '';
  $('search-clear').classList.add('hidden');
  renderTodos();
});

// ─── CHAR COUNT ──────────────────────────────────
$('todo-input').addEventListener('input', (e) => {
  const len = e.target.value.length;
  const el = $('char-count');
  el.textContent = `${len} / 200`;
  el.className = 'char-count' + (len > 180 ? ' danger' : len > 150 ? ' warning' : '');
});

// ─── ADD TODO ─────────────────────────────────────
async function addTodo() {
  const title    = $('todo-input').value.trim();
  const priority = $('priority-select').value;
  const due_date = $('due-date').value || null;
  if (!title) { $('todo-input').focus(); return; }

  try {
    const todo = await apiFetch('/todos', { method: 'POST', body: { title, priority, due_date } });
    todos.unshift(todo);
    $('todo-input').value = '';
    $('due-date').value = '';
    $('char-count').textContent = '0 / 200';
    renderTodos(); updateStats();
    showToast('Задача добавлена', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

$('add-btn').addEventListener('click', addTodo);
$('todo-input').addEventListener('keydown', e => { if (e.key === 'Enter') addTodo(); });

// ─── TOGGLE COMPLETE ──────────────────────────────
const toggleTodo = async (id) => {
  const todo = todos.find(t => t.id === id);
  if (!todo) return;
  const newCompleted = !todo.completed;

  // Оптимистичное обновление
  todo.completed = newCompleted;
  renderTodos(); updateStats();

  try {
    // Передаём отдельно, чтобы COALESCE не поглотил false
    await apiFetch(`/todos/${id}`, {
      method: 'PUT',
      body: { completed: newCompleted, title: todo.title, priority: todo.priority },
    });
  } catch (err) {
    // Откат
    todo.completed = !newCompleted;
    renderTodos(); updateStats();
    showToast('Ошибка обновления', 'error');
  }
};

// ─── DELETE TODO ──────────────────────────────────
const deleteTodo = async (id) => {
  const el = document.querySelector(`[data-id="${id}"]`);
  if (el) el.classList.add('removing');
  await new Promise(r => setTimeout(r, 250));

  try {
    await apiFetch(`/todos/${id}`, { method: 'DELETE' });
    todos = todos.filter(t => t.id !== id);
    selectedIds.delete(id);
    renderTodos(); updateStats(); updateBulkBar();
    showToast('Удалено', '');
  } catch (err) {
    showToast(err.message, 'error');
    renderTodos();
  }
};

// ─── EDIT TODO ────────────────────────────────────
const openEdit = (id) => {
  const todo = todos.find(t => t.id === id);
  if (!todo) return;
  editingId = id;
  $('edit-title').value = todo.title;
  $('edit-priority').value = todo.priority;
  $('edit-due').value = todo.due_date ? todo.due_date.slice(0,10) : '';
  $('edit-modal').classList.remove('hidden');
  setTimeout(() => $('edit-title').focus(), 50);
};
const closeEdit = () => { $('edit-modal').classList.add('hidden'); editingId = null; };

$('edit-cancel').addEventListener('click', closeEdit);
$('modal-backdrop').addEventListener('click', closeEdit);
$('edit-title').addEventListener('keydown', e => { if (e.key === 'Enter') $('edit-save').click(); });

$('edit-save').addEventListener('click', async () => {
  if (!editingId) return;
  const title    = $('edit-title').value.trim();
  const priority = $('edit-priority').value;
  const due_date = $('edit-due').value || null;
  if (!title) return;

  try {
    const updated = await apiFetch(`/todos/${editingId}`, {
      method: 'PUT',
      body: { title, priority, due_date },
    });
    const idx = todos.findIndex(t => t.id === editingId);
    if (idx !== -1) todos[idx] = { ...todos[idx], ...updated };
    closeEdit(); renderTodos(); updateStats();
    showToast('Сохранено', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
});

// ─── SELECTION ───────────────────────────────────
const toggleSelect = (id) => {
  if (selectedIds.has(id)) selectedIds.delete(id);
  else selectedIds.add(id);
  updateBulkBar();
  renderTodos();
};

$('select-all').addEventListener('change', (e) => {
  const visible = getFiltered().map(t => t.id);
  if (e.target.checked) visible.forEach(id => selectedIds.add(id));
  else selectedIds.clear();
  updateBulkBar();
  renderTodos();
});

const updateBulkBar = () => {
  const bar = $('bulk-bar');
  if (selectedIds.size > 0) {
    bar.classList.remove('hidden');
    $('bulk-count').textContent = `${selectedIds.size} выбрано`;
  } else {
    bar.classList.add('hidden');
  }
};

$('bulk-complete').addEventListener('click', async () => {
  const ids = [...selectedIds];
  for (const id of ids) {
    const todo = todos.find(t => t.id === id);
    if (todo && !todo.completed) await toggleTodo(id);
  }
  selectedIds.clear(); updateBulkBar(); renderTodos(); updateStats();
});

$('bulk-delete').addEventListener('click', async () => {
  if (!confirm(`Удалить ${selectedIds.size} задач?`)) return;
  const ids = [...selectedIds];
  for (const id of ids) {
    try {
      await apiFetch(`/todos/${id}`, { method: 'DELETE' });
      todos = todos.filter(t => t.id !== id);
    } catch {}
  }
  selectedIds.clear(); updateBulkBar(); renderTodos(); updateStats();
  showToast(`Удалено ${ids.length} задач`);
});

$('bulk-cancel').addEventListener('click', () => {
  selectedIds.clear(); updateBulkBar(); renderTodos();
  $('select-all').checked = false;
});

// ─── FILTER + SORT ───────────────────────────────
document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentFilter = btn.dataset.filter;
    renderTodos();
  });
});

$('sort-select').addEventListener('change', (e) => {
  currentSort = e.target.value;
  renderTodos();
});

const priorityOrder = { high: 0, medium: 1, low: 2 };

const getFiltered = () => {
  let list = [...todos];

  // Search
  if (searchQuery) {
    list = list.filter(t => t.title.toLowerCase().includes(searchQuery));
  }

  // Filter
  if (currentFilter === 'active')    list = list.filter(t => !t.completed);
  if (currentFilter === 'completed') list = list.filter(t => t.completed);
  if (currentFilter === 'high')      list = list.filter(t => t.priority === 'high');

  // Sort
  list.sort((a, b) => {
    if (currentSort === 'date-desc') return new Date(b.created_at) - new Date(a.created_at);
    if (currentSort === 'date-asc')  return new Date(a.created_at) - new Date(b.created_at);
    if (currentSort === 'priority')  return priorityOrder[a.priority] - priorityOrder[b.priority];
    if (currentSort === 'alpha')     return a.title.localeCompare(b.title);
    if (currentSort === 'due') {
      if (!a.due_date && !b.due_date) return 0;
      if (!a.due_date) return 1;
      if (!b.due_date) return -1;
      return new Date(a.due_date) - new Date(b.due_date);
    }
    return 0;
  });
  return list;
};

const getDueLabel = (due_date) => {
  if (!due_date) return null;
  const due  = new Date(due_date);
  const now  = new Date();
  const diff = Math.ceil((due - now) / 86400000);
  if (diff < 0)  return { text: 'Просрочено', cls: 'overdue' };
  if (diff === 0) return { text: 'Сегодня', cls: 'soon' };
  if (diff === 1) return { text: 'Завтра', cls: 'soon' };
  return { text: due.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }), cls: '' };
};

// ─── RENDER ───────────────────────────────────────
const renderTodos = () => {
  const list     = $('todo-list');
  const filtered = getFiltered();
  const empty    = $('empty-state');

  if (filtered.length === 0) {
    list.innerHTML = '';
    empty.classList.remove('hidden');
    $('empty-text').textContent = searchQuery
      ? `Ничего не найдено по «${searchQuery}»`
      : 'Нет задач. Добавь первую!';
    return;
  }
  empty.classList.add('hidden');

  list.innerHTML = filtered.map(todo => {
    const created  = new Date(todo.created_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
    const dueInfo  = getDueLabel(todo.due_date);
    const isOver   = dueInfo?.cls === 'overdue';
    const selected = selectedIds.has(todo.id);

    return `
      <li class="todo-item ${todo.completed ? 'completed' : ''} ${selected ? 'selected' : ''} ${isOver && !todo.completed ? 'overdue' : ''}"
          data-id="${todo.id}">
        <input type="checkbox" class="todo-checkbox" ${selected ? 'checked' : ''}
               onchange="toggleSelect(${todo.id})" title="Выбрать"/>
        <div class="todo-check ${todo.completed ? 'checked' : ''}"
             onclick="toggleTodo(${todo.id})" title="${todo.completed ? 'Снять выполнение' : 'Выполнить'}"></div>
        <div class="priority-dot ${todo.priority}"></div>
        <div class="todo-main">
          <span class="todo-title">${escapeHtml(todo.title)}</span>
          <div class="todo-meta">
            <span class="todo-date">${created}</span>
            ${dueInfo ? `<span class="todo-due ${dueInfo.cls}">📅 ${dueInfo.text}</span>` : ''}
          </div>
        </div>
        <div class="todo-actions">
          <button class="todo-action-btn" onclick="openEdit(${todo.id})" title="Редактировать">✎</button>
          <button class="todo-action-btn del" onclick="deleteTodo(${todo.id})" title="Удалить">✕</button>
        </div>
      </li>`;
  }).join('');
};

// ─── STATS ────────────────────────────────────────
const updateStats = () => {
  const total = todos.length;
  const done  = todos.filter(t => t.completed).length;
  const pct   = total > 0 ? Math.round(done / total * 100) : 0;
  const circ  = 150.8;

  $('stat-total').textContent = total;
  $('stat-done').textContent  = done;
  $('stat-left').textContent  = total - done;
  $('progress-pct').textContent = `${pct}%`;
  $('ring-fill').style.strokeDashoffset = circ - (circ * pct / 100);
};

// ─── START ────────────────────────────────────────
if (token && currentUser) {
  initApp();
} else {
  showScreen('auth');
}