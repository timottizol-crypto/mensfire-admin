/* =========================================
   ЧАСТЬ 1: БАЗА, АВТОРИЗАЦИЯ И НАВИГАЦИЯ
   ========================================= */

// Раздельные пространства данных для демо и рабочей базы.
let mensfireDataMode = 'demo';
try { localStorage.setItem('mensfire_data_mode', 'demo'); } catch (error) { console.warn('Не удалось закрепить демо-режим:', error); }
function appStorageKey(key) { return 'mensfire_demo_' + key.replace(/^mensfire_/, ''); }
function updateDataModeUI() {
 const demoButton = document.querySelector('.data-mode-switch button[onclick*="demo"]');
 const liveButton = document.querySelector('.data-mode-switch button[onclick*="live"]');
 if (demoButton) {
  demoButton.classList.toggle('is-active', mensfireDataMode === 'demo');
  demoButton.setAttribute('aria-pressed', String(mensfireDataMode === 'demo'));
 }
 if (liveButton) {
  liveButton.classList.toggle('is-active', mensfireDataMode === 'live');
  liveButton.setAttribute('aria-pressed', String(mensfireDataMode === 'live'));
 }
 const caption = document.querySelector('.data-mode-caption');
 if (caption) caption.textContent = mensfireDataMode === 'demo'
  ? 'Тестовые записи изолированы и не затрагивают рабочую базу'
  : 'Рабочие записи хранятся отдельно от демо-данных';
}
function setMensfireDataMode(mode) {
 if (mode !== 'demo') {
  showToast('Рабочая база пока отключена. Используются только демо-данные.', 'info');
  return;
 }
 if (mensfireDataMode !== 'demo') {
  mensfireDataMode = 'demo';
  localStorage.setItem('mensfire_data_mode', 'demo');
  location.reload();
 }
}

// --- МОК-ДАННЫЕ (В будущем заменятся на YCLIENTS API) ---
let mockStaff = [
    { id: 'b_al', name: 'Али', role: 'admin', pin: '1111', type: 'top' },
    { id: 'b_ben', name: 'Бенджо', role: 'barber', pin: '2222', type: 'barber' },
    { id: 'b_ism', name: 'Исмаил', role: 'barber', pin: '3333', type: 'barber' }
];

const defaultServicesData = {
    top: [
        { id: 't1', title: 'Мужская стрижка', price: 1500, duration: 45, type: 'top', active: true },
        { id: 't4', title: 'Стрижка + борода', price: 2500, duration: 45, type: 'top', active: true },
        { id: 't3', title: 'Оформление бороды', price: 1200, duration: 45, type: 'top', active: true }
    ],
    barber: [
        { id: 'b1', title: 'Мужская стрижка', price: 1300, duration: 45, type: 'barber', active: true },
        { id: 'b2', title: 'Стрижка + борода', price: 2300, duration: 45, type: 'barber', active: true },
        { id: 'b6', title: 'Оформление бороды', price: 1000, duration: 45, type: 'barber', active: true }
    ]
};
let servicesData = (() => {
    try {
        const saved = JSON.parse(localStorage.getItem(appStorageKey('mensfire_admin_services')) || 'null');
        if (!saved || typeof saved !== 'object') return JSON.parse(JSON.stringify(defaultServicesData));
        const normalize = (items, fallback, type) => (Array.isArray(items) ? items : fallback).map((item,index) => ({
            id: String(item.id || 'svc_' + type + '_' + index),
            title: String(item.title || 'Новая услуга'),
            price: Math.max(0, Number(item.price) || 0),
            duration: Math.max(5, Number(item.duration) || 45),
            type,
            active: item.active !== false
        }));
        return {
            top: normalize(saved.top, defaultServicesData.top, 'top'),
            barber: normalize(saved.barber, defaultServicesData.barber, 'barber')
        };
    } catch (error) {
        console.error('Не удалось загрузить каталог услуг:', error);
        return JSON.parse(JSON.stringify(defaultServicesData));
    }
})();
let editingServiceId = null;
let editingServiceType = 'top';

let currentFinanceTab = 'expenses'; // По умолчанию Расходы
let dashboardPeriodMode = 'day';
let dashboardSelectedDate = new Date().toLocaleDateString('ru-RU');
let dashboardRangeStart = dashboardSelectedDate;
let dashboardRangeEnd = dashboardSelectedDate;
let selectedBlockDate = "";
let pickerYear = new Date().getFullYear();
let pickerMonth = new Date().getMonth(); // 0-11
let editingBlockId = null;
let confirmCallback = null;
let staffToResetPin = null;
let staffToEditId = null;

let currentUser = (() => {
    try {
        const saved = JSON.parse(localStorage.getItem('mensfire_admin_user') || 'null');
        return saved && typeof saved === 'object' ? {
            id: saved.id,
            name: saved.name,
            role: saved.role,
            type: saved.type
        } : null;
    } catch (error) {
        console.error('Не удалось прочитать текущую сессию:', error);
        localStorage.removeItem('mensfire_admin_user');
        return null;
    }
})();

function isAdminUser() {
    return Boolean(currentUser && currentUser.role === 'admin');
}

function requireAdminAction(message = 'Это действие доступно только администратору Али') {
    if (isAdminUser()) return true;
    showToast(message, 'error');
    return false;
}
// --- ГЕНЕРАЦИЯ ДЕМО-ДАННЫХ ---
// Демоданные больше не генерируются автоматически: это предотвращает перезапись данных салона.

let selectedBookingId = null;
let editingBookingId = null;
let viewOrder = []; // Заполнится в зависимости от роли

// --- ИНИЦИАЛИЗАЦИЯ ---
window.addEventListener('DOMContentLoaded', () => {
    updateDataModeUI();
    initTheme();
        // --- ПРИВЕТСТВИЕ НА ЭКРАНЕ ЗАГРУЗКИ ---
    const hour = new Date().getHours();
    let greetingText = "Доброй ночи";
    if (hour >= 5 && hour < 12) greetingText = "Доброе утро";
    else if (hour >= 12 && hour < 18) greetingText = "Добрый день";
    else if (hour >= 18 && hour < 23) greetingText = "Добрый вечер";

    const splashGreeting = document.getElementById('splashGreeting');
    if (splashGreeting) {
        if (currentUser) {
            // Если пользователь вошел, пишем "Добрый вечер, Али"
            splashGreeting.innerHTML = `${greetingText}, <span>${escapeBookingHtml(currentUser.name)}</span>`;
        } else {
            // Если не вошел, пишем "Добро пожаловать"
            splashGreeting.innerHTML = `Добро пожаловать в <span>MENSFIRE</span>`;
        }
    }
    // ---------------------------------------
    
    // Имитация загрузки (как в клиенте)
    setTimeout(() => {
        document.getElementById('splashScreen').classList.add('hidden');
        const appContainer = document.getElementById('appContainer');
        appContainer.classList.add('visible');
        
        setTimeout(() => appContainer.classList.add('animate-in'), 50);
        setTimeout(() => appContainer.classList.remove('animate-in'), 1500);

        if (currentUser) {
            initAppForUser();
        } else {
            switchView('viewLogin', null);
        }
    }, 3500);
});

// --- АВТОРИЗАЦИЯ ---
function handleLogin() {
    const pin = document.getElementById('loginPin').value;
    const user = mockStaff.find(s => s.pin === pin);

    if (user) {
        // Не сохраняем PIN в браузерной сессии.
        currentUser = { id: user.id, name: user.name, role: user.role, type: user.type };
        localStorage.setItem('mensfire_admin_user', JSON.stringify(currentUser));
        document.getElementById('loginPin').value = '';
        
        // Определяем время суток
        const hour = new Date().getHours();
        let greeting = "Добро пожаловать";
        if (hour >= 5 && hour < 12) greeting = "Доброе утро";
        else if (hour >= 12 && hour < 18) greeting = "Добрый день";
        else if (hour >= 18 && hour < 23) greeting = "Добрый вечер";
        else greeting = "Доброй ночи";

        showToast(`${greeting}, ${user.name}!`, 'success');
        initAppForUser();
    } else {
        showToast('Неверный PIN-код', 'error');
    }
}

function initAppForUser() {

    document.body.classList.remove('role-admin', 'role-barber');
    document.body.classList.add(currentUser.role === 'admin' ? 'role-admin' : 'role-barber');
    // Настраиваем профиль
    document.getElementById('profileName').innerText = currentUser.name;
    document.getElementById('profileRole').innerText = currentUser.role === 'admin' ? 'Главный мастер' : 'Барбер';
    
    document.getElementById('barberRevenueCard').style.display = 'block';
    const backupCard = document.getElementById('profileBackupCard');
    if (backupCard) backupCard.style.display = isAdminUser() ? 'block' : 'none';
    if (isAdminUser()) {
        document.getElementById('profileRevenueTitle').innerText = 'Прибыль барбершопа';
    } else {
        document.getElementById('profileRevenueTitle').innerText = 'Моя выручка за сегодня';
    }

    buildBottomNav();
    
        // Открываем первый экран по умолчанию
    const defaultView = 'viewDashboard';
    const defaultNav = document.querySelector(`.nav-item[data-view="${defaultView}"]`);
    switchView(defaultView, defaultNav);
    
    // Инициализируем данные (рендер расписания и т.д. - будет в части 2)
    if (typeof renderDashboard === 'function') renderDashboard();
    if (typeof renderSchedule === 'function') renderSchedule();
    if (typeof renderBarberRevenue === 'function') renderBarberRevenue();
    if (typeof renderProfileOverview === 'function') renderProfileOverview();
}

function logout() {
    localStorage.removeItem('mensfire_admin_user');
    currentUser = null;
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById('viewLogin').classList.add('active');
    document.getElementById('headerTitle').innerText = 'Вход';
    showToast('Вы вышли из системы', 'info');
}



function persistServicesData() {
    localStorage.setItem(appStorageKey('mensfire_admin_services'), JSON.stringify(servicesData));
}
function renderServices() {
    if (!requireAdminAction('Управлять услугами может только Али')) return;
    const container = document.getElementById('servicesCatalog');
    if (!container) return;
    const groups = [{type:'top',title:'Услуги Али',note:'Прайс главного мастера'},{type:'barber',title:'Услуги барберов',note:'Прайс команды'}];
    const all = groups.flatMap(group => servicesData[group.type]);
    const active = all.filter(item => item.active !== false);
    const summary = document.getElementById('servicesOverview');
    if (summary) summary.innerHTML = '<div class="service-overview-card"><span>Всего услуг</span><strong>' + all.length + '</strong></div><div class="service-overview-card"><span>Доступно для записи</span><strong>' + active.length + '</strong></div><div class="service-overview-card"><span>Средняя длительность</span><strong>' + Math.round(active.reduce((sum,item)=>sum+getServiceDurationMinutes(item),0)/Math.max(1,active.length)) + ' мин.</strong></div>';
    container.innerHTML = groups.map(group => '<section class="service-group"><div class="service-group-heading"><div><h3>' + group.title + '</h3><p>' + group.note + '</p></div><button class="finance-text-action" onclick="openServiceEditor(\'' + group.type + '\')">＋ Добавить</button></div><div class="service-card-grid">' +
        (servicesData[group.type].map(service => '<article class="service-card ' + (service.active === false ? 'is-inactive' : '') + '"><div class="service-card-top"><span class="service-status">' + (service.active === false ? 'Скрыта' : 'Активна') + '</span><span class="service-duration">' + getServiceDurationMinutes(service) + ' мин.</span></div><h4>' + escapeBookingHtml(service.title) + '</h4><strong class="service-price">' + Math.round(Number(service.price)||0).toLocaleString('ru-RU') + ' ₽</strong><div class="service-card-actions"><button type="button" onclick="openServiceEditor(\'' + group.type + '\',\'' + escapeBookingHtml(service.id) + '\')">Изменить</button><button type="button" onclick="toggleServiceActive(\'' + group.type + '\',\'' + escapeBookingHtml(service.id) + '\')">' + (service.active === false ? 'Вернуть' : 'Скрыть') + '</button></div></article>').join('') || '<div class="finance-empty">Пока нет услуг в этой категории</div>') + '</div></section>').join('');
}
function openServiceEditor(type, id = '') {
    if (!requireAdminAction('Управлять услугами может только Али')) return;
    editingServiceType = type === 'top' ? 'top' : 'barber';
    editingServiceId = id || null;
    const service = id ? servicesData[editingServiceType].find(item => String(item.id) === String(id)) : null;
    document.getElementById('serviceEditorTitle').textContent = service ? 'Изменить услугу' : 'Новая услуга';
    document.getElementById('serviceEditorName').value = service?.title || '';
    document.getElementById('serviceEditorPrice').value = service ? service.price : '';
    document.getElementById('serviceEditorDuration').value = service ? getServiceDurationMinutes(service) : 45;
    document.getElementById('serviceEditorCategory').value = editingServiceType;
    openModal('serviceEditorModal');
}
function saveService() {
    if (!requireAdminAction('Управлять услугами может только Али')) return;
    const title = document.getElementById('serviceEditorName').value.trim();
    const price = Number(document.getElementById('serviceEditorPrice').value);
    const duration = Number(document.getElementById('serviceEditorDuration').value);
    const type = document.getElementById('serviceEditorCategory').value === 'top' ? 'top' : 'barber';
    if (!title || !Number.isFinite(price) || price <= 0 || !Number.isInteger(duration) || duration < 5 || duration > 360) return showToast('Проверьте название, цену и длительность услуги', 'error');
    const source = servicesData[editingServiceType];
    const oldIndex = editingServiceId ? source.findIndex(item => String(item.id) === String(editingServiceId)) : -1;
    let existing = oldIndex >= 0 ? source[oldIndex] : null;
    if (existing && type !== editingServiceType) {
        source.splice(oldIndex,1);
        existing = null;
    }
    if (existing) Object.assign(existing,{title,price,duration,type});
    else servicesData[type].push({id:'svc_' + Date.now() + '_' + Math.random().toString(36).slice(2,7),title,price,duration,type,active:true});
    persistServicesData();
    closeModal('serviceEditorModal');
    renderServices();
    showToast(editingServiceId ? 'Услуга обновлена' : 'Услуга добавлена','success');
}
function toggleServiceActive(type,id) {
    if (!requireAdminAction('Управлять услугами может только Али')) return;
    const service = servicesData[type]?.find(item => String(item.id) === String(id));
    if (!service) return;
    service.active = service.active === false;
    persistServicesData();
    renderServices();
    showToast(service.active ? 'Услуга снова доступна для записи' : 'Услуга скрыта из новых записей','success');
}

function buildBottomNav() {
    const nav = document.getElementById('bottomNav');
    nav.innerHTML = '<div class="nav-bubble" id="navBubble"></div>';

    let navItems = [];
    viewOrder = [];

    const calendarIcon = '<path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM7 10h5v5H7z"/>';
    const financeIcon = '<path d="M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z"/>';
    const teamIcon = '<path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>';
    const servicesIcon = '<path d="M12 2 4 6v12l8 4 8-4V6l-8-4z"/>';
    const clientsIcon = '<path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>';

    const dashboardIcon = '<path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z"/>';
    if (currentUser.role === 'admin') {
        navItems = [
            { id: 'viewDashboard', title: 'Обзор', icon: dashboardIcon },
            { id: 'viewSchedule', title: 'Расписание', icon: calendarIcon },
            { id: 'viewFinance', title: 'Финансы', icon: financeIcon },
            { id: 'viewTeam', title: 'Команда', icon: teamIcon },
            { id: 'viewServices', title: 'Услуги', icon: servicesIcon },
            { id: 'viewClients', title: 'Клиенты', icon: clientsIcon },
            { id: 'viewProfile', title: 'Профиль', icon: clientsIcon }
        ];
    } else {
        navItems = [
            { id: 'viewDashboard', title: 'Обзор', icon: dashboardIcon },
            { id: 'viewSchedule', title: 'Расписание', icon: calendarIcon },
            { id: 'viewClients', title: 'Клиенты', icon: clientsIcon },
            { id: 'viewProfile', title: 'Профиль', icon: clientsIcon }
        ];
    }

    viewOrder = navItems.map(item => item.id);

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'desktop-nav-toggle';
    toggle.id = 'desktopNavToggle';
    toggle.innerHTML = '<span class="nav-toggle-icon">‹</span><span class="nav-toggle-label">Свернуть меню</span>';
    toggle.setAttribute('aria-label', 'Свернуть или развернуть меню');
    toggle.onclick = toggleDesktopNav;
    nav.appendChild(toggle);

    navItems.forEach((item, index) => {
        const div = document.createElement('div');
        div.className = `nav-item ${index === 0 ? 'active' : ''}`;
        div.setAttribute('data-view', item.id);
        div.innerHTML = `<svg viewBox="0 0 24 24">${item.icon}</svg><span class="nav-item-label">${item.title}</span>`;
        div.onclick = () => switchView(item.id, div);
        nav.appendChild(div);

        if (item.id === 'viewSchedule') {
            const subnav = document.createElement('div');
            subnav.className = 'desktop-schedule-subnav';
            subnav.id = 'desktopScheduleSubnav';
            subnav.innerHTML = `
                <button type="button" class="${currentScheduleTab === 'bookings' ? 'active' : ''}" onclick="switchScheduleTab('bookings')">
                    <span class="schedule-subnav-dot"></span><span class="schedule-subnav-label">Расписание</span>
                </button>
                <button type="button" class="${currentScheduleTab === 'breaks' ? 'active' : ''}" onclick="switchScheduleTab('breaks')">
                    <span class="schedule-subnav-dot"></span><span class="schedule-subnav-label">Запрет времени</span>
                </button>
            `;
            nav.appendChild(subnav);
        }
    });

    initDesktopNav();
    initNavBubble();
}


function initDesktopNav() {
    const nav = document.getElementById('bottomNav');
    const app = document.getElementById('appContainer');

    if (!nav || !app) return;

    const isCollapsed =
        localStorage.getItem('mensfire_desktop_nav') === 'collapsed';

    nav.classList.toggle('desktop-collapsed', isCollapsed);
    app.classList.toggle('desktop-nav-collapsed', isCollapsed);

    updateDesktopNavToggle();
}

function toggleDesktopNav() {
    if (window.innerWidth < 768) return;

    const nav = document.getElementById('bottomNav');
    const app = document.getElementById('appContainer');

    if (!nav || !app) return;

    const isCollapsed = !nav.classList.contains('desktop-collapsed');

    nav.classList.toggle('desktop-collapsed', isCollapsed);
    app.classList.toggle('desktop-nav-collapsed', isCollapsed);

    localStorage.setItem(
        'mensfire_desktop_nav',
        isCollapsed ? 'collapsed' : 'expanded'
    );

    updateDesktopNavToggle();
}


function updateDesktopNavToggle() {
    const nav = document.getElementById('bottomNav');
    const toggle = document.getElementById('desktopNavToggle');

    if (!nav || !toggle) return;

    const isCollapsed = nav.classList.contains('desktop-collapsed');
    const icon = toggle.querySelector('.nav-toggle-icon');
    const label = toggle.querySelector('.nav-toggle-label');

    if (icon) icon.textContent = isCollapsed ? '›' : '‹';
    if (label) label.textContent = isCollapsed ? 'Развернуть меню' : 'Свернуть меню';
}


function switchView(viewId, navElement) {
    const currentView = document.querySelector('.view.active');
    if (currentView && currentView.id === viewId) return;

    let animationClass = 'slide-from-right';
    if (currentView) {
        const currentIndex = viewOrder.indexOf(currentView.id);
        const targetIndex = viewOrder.indexOf(viewId);
        if (currentIndex !== -1 && targetIndex !== -1 && targetIndex < currentIndex) {
            animationClass = 'slide-from-left';
        }
    }

    document.querySelectorAll('.view').forEach(v => {
        v.classList.remove('active', 'slide-from-right', 'slide-from-left');
    });

    const newView = document.getElementById(viewId);
    if (newView) newView.classList.add('active', animationClass);

    setTimeout(() => {
        if (newView) newView.classList.remove('slide-from-right', 'slide-from-left');
    }, 400);

    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        let targetNav = navElement;
        if (!targetNav) {
            targetNav = document.querySelector(`.nav-item[data-view="${viewId}"]`); 
        }

    if (targetNav) {
        targetNav.classList.add('active');
        updateNavBubble(targetNav);
    }

    const titles = {
        'viewLogin': 'Вход',
        'viewDashboard': 'Обзор',
        'viewSchedule': 'Расписание',
        'viewFinance': 'Финансы',
        'viewTeam': 'Команда',
        'viewServices': 'Услуги',
        'viewClients': 'Клиенты',
        'viewProfile': 'Профиль'
    };
    if (titles[viewId]) {
        const titleEl = document.getElementById('headerTitle');
        titleEl.innerText = titles[viewId];
        titleEl.classList.remove('animate-title');
        void titleEl.offsetWidth;
        titleEl.classList.add('animate-title');
    }

    if (viewId === 'viewLogin' || viewId === 'viewProfile') {
        document.body.classList.remove('header-hidden');
    } else {
        document.body.classList.add('header-hidden');
    }
    if (viewId === 'viewDashboard' && typeof renderDashboard === 'function') renderDashboard();
    if (viewId === 'viewFinance' && typeof renderFinance === 'function') renderFinance();
    if (viewId === 'viewTeam' && typeof renderTeam === 'function') renderTeam();
    if (viewId === 'viewClients' && typeof renderClients === 'function') renderClients(currentClientsTab);
    if (viewId === 'viewServices' && typeof renderServices === 'function') renderServices();
    if (viewId === 'viewProfile') {
        if (typeof renderBarberRevenue === 'function') renderBarberRevenue();
        if (typeof renderProfileOverview === 'function') renderProfileOverview();
    }
}

// --- ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ (UI) ---
function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icon = document.createElement('span');
    icon.textContent = type === 'error' ? '⚠️' : type === 'success' ? '✅' : 'ℹ️';
    const text = document.createElement('span');
    text.textContent = String(message ?? '');
    toast.append(icon, text);
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(-10px)';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function showConfirm(title, text, yesText, callback) {
    document.getElementById('confirmModalTitle').innerText = title;
    document.getElementById('confirmModalText').innerText = text;
    const yesBtn = document.getElementById('confirmModalYesBtn');
    yesBtn.innerText = yesText;
    
    // Сбрасываем старый обработчик, чтобы не было багов
    const newYesBtn = yesBtn.cloneNode(true);
    yesBtn.parentNode.replaceChild(newYesBtn, yesBtn);
    
    newYesBtn.onclick = () => {
        closeModal('confirmModal');
        callback();
    };
    
    openModal('confirmModal');
}


function openModal(id) {
    const modal = document.getElementById(id);
    if (!modal) return;

    const drawerIds = [
        'actionModal',
        'newBookingModal',
        'blockTimeModal',
        'blockActionModal',
        'clientDetailsModal',
        'barberStatsModal'
    ];

    const isDesktopDrawer = window.innerWidth >= 768 &&
        drawerIds.includes(id);

    if (isDesktopDrawer) {
        modal.classList.add('drawer-modal');
        document.body.classList.add('mensfire-drawer-open');

        const schedule = document.getElementById('viewSchedule');
        if (schedule) schedule.classList.add('drawer-space');
    } else {
        modal.classList.remove('drawer-modal');
    }

    modal.classList.add('active');

    if (!isDesktopDrawer) {
        document.body.style.overflow = 'hidden';
    }
}

function closeModal(id) {
    const modal = document.getElementById(id);
    if (!modal) return;

    modal.classList.remove('active', 'drawer-modal');

    document.body.classList.remove('mensfire-drawer-open');

    const schedule = document.getElementById('viewSchedule');
    if (schedule) schedule.classList.remove('drawer-space');

    document.body.style.overflow = '';
}


function toggleTheme() {
    const html = document.documentElement;
    html.classList.toggle('light-theme');
    const isLight = html.classList.contains('light-theme');
    localStorage.setItem('mensfire_admin_theme', isLight ? 'light' : 'dark');
    document.getElementById('themeIcon').innerText = isLight ? '🌙' : '☀️';
    showToast(isLight ? 'Светлая тема' : 'Тёмная тема', 'info');
}

function initTheme() {
    const saved = localStorage.getItem('mensfire_admin_theme');
    if (saved === 'light') {
        document.documentElement.classList.add('light-theme');
        document.getElementById('themeIcon').innerText = '🌙';
    }
}

function goHomeFromHeader() {
    if (!currentUser) return;
    const firstNav = document.querySelector('.nav-item');
    if (firstNav) firstNav.click();
}

// --- АНИМАЦИЯ НИЖНЕГО МЕНЮ (СКОПИРОВАНО ИЗ КЛИЕНТА) ---
function updateNavBubble(el, isInit = false) {
    if (window.innerWidth >= 768) return;
    const bubble = document.getElementById('navBubble');
    const nav = document.getElementById('bottomNav');
    if (!bubble || !nav || !el) return;
    
    const navRect = nav.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    
    if (isInit) {
        bubble.style.width = elRect.width + 'px';
        bubble.style.height = elRect.height + 'px';
        bubble.style.left = (elRect.left - navRect.left) + 'px';
        bubble.style.top = (elRect.top - navRect.top) + 'px';
        return;
    }

    clearTimeout(window.bubbleTimer1);
    clearTimeout(window.bubbleTimer2);

    bubble.classList.remove('squashing');
    bubble.classList.add('expanding');

    window.bubbleTimer1 = setTimeout(() => {
        bubble.style.width = elRect.width + 'px';
        bubble.style.height = elRect.height + 'px';
        bubble.style.left = (elRect.left - navRect.left) + 'px';
        bubble.style.top = (elRect.top - navRect.top) + 'px';

        const currentActive = document.querySelector('.nav-item.active');
        if (currentActive) {
            const svg = currentActive.querySelector('svg');
            if (svg) {
                svg.classList.remove('bounce');
                void svg.offsetWidth; 
                svg.classList.add('bounce');
                setTimeout(() => svg.classList.remove('bounce'), 300);
            }
        }
    }, 100);

    window.bubbleTimer2 = setTimeout(() => {
        bubble.classList.remove('expanding');
        bubble.classList.add('squashing');
        setTimeout(() => bubble.classList.remove('squashing'), 150);
    }, 350); 
}

function initNavBubble() {
    const bubble = document.getElementById('navBubble');
    const activeNav = document.querySelector('.nav-item.active');
    if (!bubble || !activeNav) return;
    bubble.classList.remove('expanding', 'squashing');
    bubble.style.transition = 'none';
    updateNavBubble(activeNav, true);
    void bubble.offsetWidth; 
    bubble.style.transition = '';
}

window.addEventListener('resize', () => {
    const activeNav = document.querySelector('.nav-item.active');
    if (activeNav) updateNavBubble(activeNav, true);
});

// --- СВАЙПЫ (СКОПИРОВАНО ИЗ КЛИЕНТА) ---
let touchStartX = 0;
let touchStartY = 0;

document.addEventListener('touchstart', e => {
    if (document.querySelector('.modal.active') || document.querySelector('.drawer.active')) return;
    
    // ИГНОРИРУЕМ СВАЙП, ЕСЛИ ТРОГАЕМ СПИСКИ, ДАТЫ ИЛИ ТАБЫ
    if (e.target.closest('.home-scroll-area') || 
        e.target.closest('.profile-history-scroll') ||
        e.target.closest('.date-selector') || 
        e.target.closest('.category-tabs')) return; 
        
    touchStartX = e.changedTouches[0].screenX;
    touchStartY = e.changedTouches[0].screenY;
}, { passive: true });

document.addEventListener('touchend', e => {
    if (document.querySelector('.modal.active') || document.querySelector('.drawer.active')) return;
    
    // ТУТ ТОЖЕ САМОЕ
    if (e.target.closest('.home-scroll-area') || 
        e.target.closest('.profile-history-scroll') ||
        e.target.closest('.date-selector') || 
        e.target.closest('.category-tabs')) return; 
        
    const touchEndX = e.changedTouches[0].screenX;
    const touchEndY = e.changedTouches[0].screenY;
    handleSwipe(touchStartX, touchStartY, touchEndX, touchEndY);
}, { passive: true });

function handleSwipe(startX, startY, endX, endY) {
    const deltaX = endX - startX;
    const deltaY = endY - startY;
    
    if (Math.abs(deltaX) > 50 && Math.abs(deltaY) < 60) {
        const currentView = document.querySelector('.view.active');
        if (!currentView) return;
        
        const currentIndex = viewOrder.indexOf(currentView.id);
        if (currentIndex === -1) return; 

        if (deltaX < 0) {
            if (currentIndex < viewOrder.length - 1) switchView(viewOrder[currentIndex + 1], null);
        } else {
            if (currentIndex > 0) switchView(viewOrder[currentIndex - 1], null);
        }
    }
}

// --- ТАКТИЛЬНЫЙ ОТКЛИК (СКОПИРОВАНО ИЗ КЛИЕНТА) ---
(function() {
     const PRESSABLE = 'button, .nav-item, .home-cta-btn, .header-pill, .action-modal-btn, .checkout-btn, .logout-btn, [onclick]';
    let holdTimer = null;
    let pressedEl = null;
    let longPressFired = false;

    document.addEventListener('pointerdown', (e) => {
        if (e.button !== undefined && e.button !== 0) return;
        const el = e.target.closest(PRESSABLE);
        if (!el || el.disabled || el.classList.contains('disabled')) return;
        if (el.classList.contains('home-booking-item') || el.classList.contains('client-card')) return;

        clearTimeout(holdTimer);
        if (pressedEl) pressedEl.classList.remove('is-pressing');
        pressedEl = el;
        longPressFired = false;
        el.classList.add('is-pressing');

        holdTimer = setTimeout(() => {
            longPressFired = true;
            el.classList.remove('is-pressing');
            el.classList.add('is-cancelled');
            setTimeout(() => el.classList.remove('is-cancelled'), 450);
            if (navigator.vibrate) { try { navigator.vibrate(30); } catch (_) {} }
        }, 2000);
    }, { passive: true });

    const endPress = () => {
        clearTimeout(holdTimer);
        holdTimer = null;
        if (pressedEl) pressedEl.classList.remove('is-pressing');
    };

    document.addEventListener('pointerup', endPress, { passive: true });
    document.addEventListener('pointercancel', endPress, { passive: true });
    document.addEventListener('pointerleave', endPress, { passive: true });

    document.addEventListener('click', (e) => {
        if (longPressFired) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            longPressFired = false;
        }
    }, true);
})();

/* =========================================
   ЧАСТЬ 2: ЛОГИКА ЭКРАНОВ (РАСПИСАНИЕ, ФИНАНСЫ, КОМАНДА, КЛИЕНТЫ)
   ========================================= */

// Подгружаем обновленный список мастеров из localStorage (если добавляли новых)
try {
    const savedStaff = JSON.parse(localStorage.getItem(appStorageKey('mensfire_admin_staff')) || 'null');
    if (Array.isArray(savedStaff)) mockStaff = savedStaff;
} catch (error) {
    console.error('Не удалось прочитать список мастеров:', error);
}

// Проверяем сохранённую сессию по актуальному списку мастеров и не храним PIN.
if (currentUser) {
    const sessionStaff = mockStaff.find(staff => staff.id === currentUser.id);
    if (sessionStaff) {
        currentUser = {
            id: sessionStaff.id,
            name: sessionStaff.name,
            role: sessionStaff.role,
            type: sessionStaff.type
        };
        localStorage.setItem('mensfire_admin_user', JSON.stringify(currentUser));
    } else {
        currentUser = null;
        localStorage.removeItem('mensfire_admin_user');
    }
}

// Финансовые данные и карточки клиентов также загружаются безопасно.
let expenses = (() => {
    try {
        const saved = JSON.parse(localStorage.getItem(appStorageKey('mensfire_admin_expenses')) || '[]');
        return Array.isArray(saved) ? saved : [];
    } catch (error) {
        console.error('Не удалось прочитать расходы:', error);
        return [];
    }
})();

let clientProfiles = (() => {
    try {
        const saved = JSON.parse(localStorage.getItem(appStorageKey('mensfire_client_profiles')) || '{}');
        return saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {};
    } catch (error) {
        console.error('Не удалось прочитать карточки клиентов:', error);
        return {};
    }
})();

// Основные данные расписания. Без этой инициализации календарь обращается
// к неопределённой переменной bookings и полностью прекращает отрисовку.
let bookings = (() => {
    try {
        const saved = JSON.parse(localStorage.getItem(appStorageKey('mensfire_admin_bookings')) || '[]');
        return Array.isArray(saved) ? saved : [];
    } catch (error) {
        console.error('Не удалось прочитать сохранённые записи:', error);
        return [];
    }
})();

// Дополнительные данные для блокировок
let timeBlocks = (() => {
    try {
        const saved = JSON.parse(localStorage.getItem(appStorageKey('mensfire_admin_blocks')) || '[]');
        return Array.isArray(saved) ? saved : [];
    } catch (error) {
        console.error('Не удалось прочитать блокировки времени:', error);
        return [];
    }
})();

let barberWorkSchedules = (() => {
    try {
        const saved = JSON.parse(localStorage.getItem(appStorageKey('mensfire_work_schedules')) || '{}');
        return saved && typeof saved === 'object' ? saved : {};
    } catch (error) { return {}; }
})();
const workWeekDays = [{label:'Понедельник',short:'Пн'},{label:'Вторник',short:'Вт'},{label:'Среда',short:'Ср'},{label:'Четверг',short:'Чт'},{label:'Пятница',short:'Пт'},{label:'Суббота',short:'Сб'},{label:'Воскресенье',short:'Вс'}];
function getBarberWorkDay(barberId, dateValue) {
    const date = parseReportDate(dateValue);
    if (!date) return { enabled:true, start:'08:00', end:'22:00' };
    const dayIndex = (date.getDay()+6)%7;
    const custom = barberWorkSchedules[String(barberId)]?.[dayIndex];
    return custom ? {enabled:custom.enabled!==false,start:custom.start||'08:00',end:custom.end||'22:00'} : {enabled:true,start:'08:00',end:'22:00'};
}
function isWithinBarberWorkSchedule(barberId,dateValue,start,end) {
    const day = getBarberWorkDay(barberId,dateValue);
    if (!day.enabled) return false;
    const workStart=parseScheduleTimeMinutes(day.start),workEnd=parseScheduleTimeMinutes(day.end);
    return workStart!==null&&workEnd!==null&&start>=workStart&&end<=workEnd;
}
function openWorkScheduleModal() {
    if (!requireAdminAction('Настраивать график может только администратор')) return;
    const select=document.getElementById('workScheduleBarber');
    select.innerHTML=mockStaff.map(person=>'<option value="'+escapeBookingHtml(person.id)+'">'+escapeBookingHtml(person.name)+'</option>').join('');
    renderWorkScheduleEditor();
    openModal('workScheduleModal');
}
function renderWorkScheduleEditor() {
    const select=document.getElementById('workScheduleBarber'),host=document.getElementById('workScheduleDays');
    if(!select||!host)return;
    const schedule=barberWorkSchedules[String(select.value)]||{};
    host.innerHTML=workWeekDays.map((day,index)=>{
        const item=schedule[index]||{enabled:true,start:'08:00',end:'22:00'};
        return '<div class="work-schedule-day"><label class="work-schedule-day-toggle"><input type="checkbox" id="workDayEnabled_'+index+'" '+(item.enabled!==false?'checked':'')+'><span>'+day.label+'</span></label><div class="work-schedule-times"><input type="text" id="workDayStart_'+index+'" readonly inputmode="none" value="'+escapeBookingHtml(item.start||'08:00')+'" onclick="openTimePicker(\'workDayStart_'+index+'\')"><span>—</span><input type="text" id="workDayEnd_'+index+'" readonly inputmode="none" value="'+escapeBookingHtml(item.end||'22:00')+'" onclick="openTimePicker(\'workDayEnd_'+index+'\')"></div></div>';
    }).join('');
}
function saveWorkSchedule() {
    if (!requireAdminAction('Настраивать график может только администратор')) return;
    const barberId=document.getElementById('workScheduleBarber')?.value;
    if(!barberId)return;
    const schedule={};
    for(let index=0;index<7;index++){
        const enabled=document.getElementById('workDayEnabled_'+index).checked;
        const start=document.getElementById('workDayStart_'+index).value;
        const end=document.getElementById('workDayEnd_'+index).value;
        const a=parseScheduleTimeMinutes(start),b=parseScheduleTimeMinutes(end);
        if(enabled&&(a===null||b===null||a>=b||a<480||b>1320))return showToast(workWeekDays[index].label+': проверьте рабочие часы (08:00–22:00)','error');
        schedule[index]={enabled,start,end};
    }
    const conflicts=bookings.filter(booking=>String(booking.barberId)===String(barberId)&&isBookingBlockingSchedule(booking)).filter(booking=>{
        const start=parseScheduleTimeMinutes(booking.time);return start!==null&&!isWithinBarberWorkSchedule(barberId,booking.date,start,start+getBookingDurationMinutes(booking));
    });
    if(conflicts.length)return showToast('Есть записи вне нового графика: '+conflicts.slice(0,2).map(item=>item.date+' '+item.time).join(', '),'error');
    barberWorkSchedules[String(barberId)]=schedule;
    localStorage.setItem(appStorageKey('mensfire_work_schedules'),JSON.stringify(barberWorkSchedules));
    closeModal('workScheduleModal');
    renderSchedule();
    showToast('Рабочий график сохранён','success');
}

let waitlistEntries = (() => {
    try {
        const saved = JSON.parse(localStorage.getItem(appStorageKey('mensfire_waitlist')) || '[]');
        return Array.isArray(saved) ? saved : [];
    } catch (error) {
        console.error('Не удалось загрузить лист ожидания:', error);
        return [];
    }
})();
let editingWaitlistId = null;

function persistWaitlist() {
    localStorage.setItem(appStorageKey('mensfire_waitlist'), JSON.stringify(waitlistEntries));
}
function openWaitlistDatePicker() {
    calendarTargetInputId = 'waitlistDate';
    reportDatePickerTarget = null;
    const value = document.getElementById('waitlistDate')?.value;
    const date = parseReportDate(value) || parseReportDate(selectedScheduleDate) || new Date();
    selectedBlockDate = formatReportDate(date);
    pickerYear = date.getFullYear();
    pickerMonth = date.getMonth();
    renderCalendar();
    openModal('calendarModal');
}
function renderWaitlist() {
    const host = document.getElementById('waitlistList');
    if (!host) return;
    const barber = document.getElementById('waitlistBarber');
    const service = document.getElementById('waitlistService');
    if (barber && !barber.options.length) {
        barber.innerHTML = mockStaff.map(person => `<option value="${escapeBookingHtml(person.id)}">${escapeBookingHtml(person.name)}</option>`).join('');
    }
    if (service && !service.options.length) {
        const options = Object.values(servicesData).flat().filter(item => item.active !== false);
        service.innerHTML = '<option value="">Любая услуга</option>' + options.map(item => `<option value="${escapeBookingHtml(item.id)}">${escapeBookingHtml(item.title)}</option>`).join('');
    }
    const count = document.getElementById('waitlistCount');
    if (count) count.textContent = String(waitlistEntries.length);
    if (!waitlistEntries.length) {
        host.innerHTML = '<div class="waitlist-empty">Пока нет клиентов в листе ожидания</div>';
        return;
    }
    host.innerHTML = waitlistEntries.map(item => {
        const staff = mockStaff.find(person => String(person.id) === String(item.barberId));
        return `<article class="waitlist-row"><div class="waitlist-person"><strong>${escapeBookingHtml(item.clientName)}</strong><span>${escapeBookingHtml(item.phone || 'Телефон не указан')}</span><small>${escapeBookingHtml(item.date || 'Любая дата')} · ${escapeBookingHtml(item.time || 'Любое время')} · ${escapeBookingHtml(staff?.name || 'Любой мастер')}</small><small>${escapeBookingHtml(item.serviceTitle || 'Любая услуга')}</small></div><div class="waitlist-actions"><button type="button" onclick="promoteWaitlistEntry('${escapeBookingHtml(item.id)}')">Создать запись</button><button type="button" class="waitlist-remove" onclick="removeWaitlistEntry('${escapeBookingHtml(item.id)}')">Убрать</button></div></article>`;
    }).join('');
}
function addWaitlistEntry() {
    if (!requireAdminAction('Управлять листом ожидания может только администратор')) return;
    const clientName = document.getElementById('waitlistClient')?.value.trim();
    const phone = document.getElementById('waitlistPhone')?.value.trim() || '';
    const date = document.getElementById('waitlistDate')?.value || '';
    const time = document.getElementById('waitlistTime')?.value || '';
    const barberId = document.getElementById('waitlistBarber')?.value || '';
    const serviceId = document.getElementById('waitlistService')?.value || '';
    if (!clientName) return showToast('Укажите имя клиента', 'error');
    if (date && !parseReportDate(date)) return showToast('Проверьте желаемую дату', 'error');
    if (time && parseScheduleTimeMinutes(time) === null) return showToast('Проверьте желаемое время', 'error');
    const service = Object.values(servicesData).flat().find(item => String(item.id) === String(serviceId));
    waitlistEntries.push({ id:'wait-' + Date.now(), clientName, phone, date, time, barberId, serviceId, serviceTitle:service?.title || '', createdAt:new Date().toISOString() });
    persistWaitlist();
    ['waitlistClient','waitlistPhone','waitlistDate','waitlistTime'].forEach(id => { const input=document.getElementById(id); if(input) input.value=''; });
    renderWaitlist();
    showToast('Клиент добавлен в лист ожидания','success');
}
function removeWaitlistEntry(id) {
    if (!requireAdminAction('Управлять листом ожидания может только администратор')) return;
    waitlistEntries = waitlistEntries.filter(item => String(item.id) !== String(id));
    persistWaitlist();
    renderWaitlist();
}
function promoteWaitlistEntry(id) {
    if (!requireAdminAction('Создавать записи может только администратор')) return;
    const item = waitlistEntries.find(entry => String(entry.id) === String(id));
    if (!item) return;
    const barberId = item.barberId || currentUser.id;
    const date = item.date || selectedScheduleDate;
    openNewBookingModal(barberId, item.time || '', date);
    const client = document.getElementById('newBookingClient');
    if (client) client.value = item.clientName;
    const phoneInput = document.getElementById('newBookingClientPhone');
    if (phoneInput) phoneInput.value = item.phone || '';
    const barberSelect = document.getElementById('newBookingBarber');
    if (barberSelect && item.barberId) barberSelect.value = item.barberId;
    renderBookingBarberChoices();
    updateNewBookingServices();
    if (item.serviceId) {
        const option = document.querySelector('#newBookingServicesList input[value="' + CSS.escape(String(item.serviceId)) + '"]');
        if (option) { option.checked = true; updateNewBookingSummary(); }
    }
    editingWaitlistId = item.id;
    showToast('Проверьте дату и время, затем сохраните запись','info');
}


function ensureDemoSampleData() {
 if (mensfireDataMode !== 'demo') return;
 const today = new Date();
 const dateFor = offset => { const d = new Date(today); d.setDate(d.getDate()+offset); return d.toLocaleDateString('ru-RU'); };
 const cut = { title: 'Мужская стрижка', price: 1300 };
 const beard = { title: 'Оформление бороды', price: 1000 };
 if (!bookings.length) {
  bookings = [
   { id:'demo-1',clientName:'Александр',barberId:'b_ben',date:dateFor(0),time:'10:00',services:[cut],status:'confirmed',paidAmount:1300,paymentMethod:'card' },
   { id:'demo-2',clientName:'Михаил',barberId:'b_ism',date:dateFor(0),time:'11:00',services:[cut,beard],status:'confirmed',paidAmount:1000,paymentMethod:'cash' },
   { id:'demo-3',clientName:'Даниил',barberId:'b_al',date:dateFor(0),time:'13:00',services:[cut],status:'pending',paidAmount:0,paymentMethod:'' },
   { id:'demo-4',clientName:'Илья',barberId:'b_ben',date:dateFor(1),time:'12:00',services:[beard],status:'completed',paidAmount:1000,paymentMethod:'transfer' },
   { id:'demo-5',clientName:'Максим',barberId:'b_ism',date:dateFor(1),time:'15:00',services:[cut],status:'confirmed',paidAmount:0,paymentMethod:'' }
  ];
  localStorage.setItem(appStorageKey('mensfire_admin_bookings'), JSON.stringify(bookings));
 }
 // Расширенная витрина CRM: клиенты с разными каналами записи и историей визитов.
 const extraDemoBookings = [
  { id:'demo-extra-1',clientName:'Артём',barberId:'b_ben',date:dateFor(-34),time:'12:00',services:[cut],status:'completed',paidAmount:1300,paymentMethod:'card',bookingSource:'website' },
  { id:'demo-extra-2',clientName:'Артём',barberId:'b_ben',date:dateFor(-5),time:'12:30',services:[cut,beard],status:'completed',paidAmount:2300,paymentMethod:'card',bookingSource:'client_app' },
  { id:'demo-extra-3',clientName:'Роман',barberId:'b_ism',date:dateFor(-22),time:'14:00',services:[cut],status:'completed',paidAmount:1300,paymentMethod:'cash',bookingSource:'pwa' },
  { id:'demo-extra-4',clientName:'Егор',barberId:'b_al',date:dateFor(-12),time:'16:00',services:[cut,beard],status:'completed',paidAmount:2300,paymentMethod:'transfer',bookingSource:'barber_app' },
  { id:'demo-extra-5',clientName:'Никита',barberId:'b_ben',date:dateFor(-2),time:'11:00',services:[beard],status:'confirmed',paidAmount:0,paymentMethod:'',bookingSource:'phone' },
  { id:'demo-extra-6',clientName:'Владислав',barberId:'b_ism',date:dateFor(-48),time:'13:00',services:[cut],status:'completed',paidAmount:1300,paymentMethod:'cash',bookingSource:'website' },
  { id:'demo-extra-7',clientName:'Владислав',barberId:'b_ism',date:dateFor(-18),time:'13:30',services:[cut],status:'completed',paidAmount:1300,paymentMethod:'cash',bookingSource:'mobile_app' },
  { id:'demo-extra-8',clientName:'Тимур',barberId:'b_ben',date:dateFor(-9),time:'17:00',services:[cut],status:'completed',paidAmount:1300,paymentMethod:'card',bookingSource:'barber_phone' },
  { id:'demo-extra-9',clientName:'Глеб',barberId:'b_al',date:dateFor(-1),time:'18:00',services:[cut],status:'confirmed',paidAmount:0,paymentMethod:'',bookingSource:'website' },
  { id:'demo-extra-10',clientName:'Кирилл',barberId:'b_ism',date:dateFor(-65),time:'10:30',services:[cut,beard],status:'completed',paidAmount:2300,paymentMethod:'transfer',bookingSource:'pwa' },
  { id:'demo-extra-11',clientName:'Кирилл',barberId:'b_ism',date:dateFor(-20),time:'10:30',services:[cut],status:'completed',paidAmount:1300,paymentMethod:'card',bookingSource:'client_app' },
  { id:'demo-extra-12',clientName:'Матвей',barberId:'b_al',date:dateFor(3),time:'15:30',services:[cut],status:'confirmed',paidAmount:0,paymentMethod:'',bookingSource:'barber_app' }
 ];
 const extraIds = new Set(bookings.map(item => String(item.id)));
 extraDemoBookings.forEach(item => { if (!extraIds.has(String(item.id))) bookings.push(item); });
 localStorage.setItem(appStorageKey('mensfire_admin_bookings'), JSON.stringify(bookings));
 const demoProfiles = [
  ['Артём','b_ben','+7 900 111-22-33','regular'],
  ['Роман','b_ism','+7 900 222-33-44','new'],
  ['Егор','b_al','+7 900 333-44-55','new'],
  ['Никита','b_ben','+7 900 444-55-66','new'],
  ['Владислав','b_ism','+7 900 555-66-77','regular'],
  ['Тимур','b_ben','+7 900 666-77-88','new'],
  ['Глеб','b_al','+7 900 777-88-99','new'],
  ['Кирилл','b_ism','+7 900 888-99-00','regular'],
  ['Матвей','b_al','+7 900 999-00-11','new']
 ];
 demoProfiles.forEach(([name,barberId,phone,tag]) => {
  const key = JSON.stringify([name,barberId]);
  if (!clientProfiles[key]) clientProfiles[key] = { clientName:name, barberId, phone, tag, notes:'Демо-профиль клиента' };
 });
 localStorage.setItem(appStorageKey('mensfire_client_profiles'), JSON.stringify(clientProfiles));
 if (!expenses.length) {
  expenses = [
   { id:'demo-exp-1', title:'Расходные материалы', amount:850, date:dateFor(0) },
   { id:'demo-exp-2', title:'Уборка', amount:500, date:dateFor(-1) }
  ];
  localStorage.setItem(appStorageKey('mensfire_admin_expenses'), JSON.stringify(expenses));
 }
 if (!timeBlocks.length) {
  timeBlocks = [{ id:'demo-block-1', barberId:'b_ben', date:dateFor(2), startTime:'14:00', endTime:'15:00' }];
  localStorage.setItem(appStorageKey('mensfire_admin_blocks'), JSON.stringify(timeBlocks));
 }
 localStorage.setItem('mensfire_demo_seeded', '1');
}
ensureDemoSampleData();
// Выбранная дата в расписании (по умолчанию — сегодня)
let selectedScheduleDate = new Date().toLocaleDateString('ru-RU');
let currentScheduleTab = 'bookings'; // 'bookings' или 'breaks'
let selectedScheduleBarberFilter = 'all';
let selectedFinanceDate = new Date().toLocaleDateString('ru-RU');
let financePeriodMode = 'day';
let financeRangeStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toLocaleDateString('ru-RU');
let financeRangeEnd = new Date().toLocaleDateString('ru-RU');
let reportDatePickerTarget = null;
let clientsPeriodMode = 'sixMonths';
let clientsRangeStart = new Date(new Date().getFullYear(), new Date().getMonth() - 5, 1).toLocaleDateString('ru-RU');
let clientsRangeEnd = new Date().toLocaleDateString('ru-RU');
let teamPeriodMode = 'month';
let teamRangeStart = new Date(new Date().getFullYear(),new Date().getMonth(),1).toLocaleDateString('ru-RU');
let teamRangeEnd = new Date().toLocaleDateString('ru-RU');

// Массив фраз для пустого расписания
const emptyPhrases = [
    "Можно отдохнуть и выпить кофе ☕",
    "Отличное время, чтобы поправить инструменты ✂️",
    "Пока тихо... Но клиенты уже в пути! 🚀",
    "Свободное время для отдыха 😌",
    "Пора протереть зеркала 🪞",
    "Ни одной записи. Может, чайку? 🍵",
    "Идеальный момент, чтобы размяться 🏋️‍♂️",
    "Затишье перед бурей ⛈️",
    "Время навести порядок на рабочем месте 🧹",
    "Кто-то явно заслужил перерыв 🍔",
    "Скучаем по клиентам... 🥺",
    "Отличный день, чтобы обновить прическу самому себе 💈",
    "Тишина... наслаждаемся моментом 🧘‍♂️",
    "Может, посмотреть пару обучающих видео? 📺",
    "Время проверить расходники 🧴",
    "Пора заварить свежий кофе ☕",
    "Никаких записей. Пока что! 😉",
    "Идеальное время для небольшого перерыва 💤",
    "Отдыхаем, пока есть возможность 🛋️",
    "Скоро здесь будет жарко! 🔥"
];
let emptyPhrasesTimer = null;

function renderSchedule() {
    const list = document.getElementById('scheduleList');
    if (!list) return;

    list.style.opacity = '0';

    setTimeout(() => {
        renderDateSelector();
        const scheduleDate = selectedScheduleDate;
        const staffFilterHost = document.getElementById('scheduleBarberFilterMobile');
        if (staffFilterHost) staffFilterHost.innerHTML = renderScheduleBarberFilter(mockStaff).replace('schedule-barber-filter','schedule-barber-filter-mobile');
        const visibleBookings = bookings.filter(item => item.date === scheduleDate &&
            item.status !== 'cancelled' &&
            (currentUser.role === 'admin' || String(item.barberId) === String(currentUser.id)) &&
            (selectedScheduleBarberFilter === 'all' || String(item.barberId) === String(selectedScheduleBarberFilter)));
        const visibleBlocks = timeBlocks.filter(item => item.date === scheduleDate &&
            (currentUser.role === 'admin' || String(item.barberId) === String(currentUser.id)) &&
            (selectedScheduleBarberFilter === 'all' || String(item.barberId) === String(selectedScheduleBarberFilter)));
        const completedCount = visibleBookings.filter(item => item.status === 'completed').length;
        const collected = visibleBookings.reduce((sum,item) => sum + getBookingCollectedAmount(item),0);
        const planned = visibleBookings.reduce((sum,item) => sum + (item.services || []).reduce((n,service) => n + Number(service.price || 0),0),0);
        const outstanding = visibleBookings.reduce((sum,item) => {
            const total = (item.services || []).reduce((n,service) => n + Number(service.price || 0),0);
            return sum + Math.max(0,total-getBookingPaymentState(item,total).paid);
        },0);
        const overview = document.getElementById('scheduleOverview');
        if (overview) overview.innerHTML = `
            <div class="schedule-overview-card"><span>Записей</span><strong>${visibleBookings.length}</strong><small>${completedCount} завершено</small></div>
            <div class="schedule-overview-card"><span>Получено</span><strong>${Math.round(collected).toLocaleString('ru-RU')} ₽</strong><small>Фактические оплаты</small></div>
            <div class="schedule-overview-card"><span>К оплате</span><strong>${Math.round(outstanding).toLocaleString('ru-RU')} ₽</strong><small>По записям дня</small></div>
            <div class="schedule-overview-card"><span>Перерывов</span><strong>${visibleBlocks.length}</strong><small>Заблокированные интервалы</small></div>`;

        const greetEl = document.getElementById('scheduleGreeting');
        if (greetEl) greetEl.innerText = 'Расписание';

        const isPC = window.innerWidth >= 768;
        if (isPC) {
            try {
                renderDesktopSchedule();
            } catch (error) {
                console.error('Mensfire desktop calendar render error:', error);
                const view = document.getElementById('viewSchedule');
                let calendar = document.getElementById('desktopSchedule');
                if (!calendar && view) {
                    calendar = document.createElement('div');
                    calendar.id = 'desktopSchedule';
                    view.appendChild(calendar);
                }
                if (calendar) {
                    calendar.innerHTML = '<div class="calendar-render-error">Не удалось загрузить календарь. Обнови страницу; подробности доступны в консоли браузера.</div>';
                }
            }
            list.style.opacity = '1';
            return;
        }
        if (emptyPhrasesTimer) clearInterval(emptyPhrasesTimer);

        // Функция создания карточки
        const createCard = (b, isBlock) => {
            if (isBlock) {
                return `
                    <div class="home-booking-item" onclick="openBlockActionModal('${escapeBookingHtml(String(b.id))}')" style="cursor: pointer; border-left-style: dashed; border-left-color: #888; background: rgba(255,255,255,0.02); margin-bottom: 0; padding: 12px; display: flex; justify-content: space-between; align-items: flex-start; opacity: 0.8; width: 100%; box-sizing: border-box;">
                        <div class="hb-info" style="flex: 1; min-width: 0;">
                            <div class="hb-date" style="color: #888; font-size: 14px;">${escapeBookingHtml(b.startTime)} - ${escapeBookingHtml(b.endTime)}</div>
                            <div class="hb-services" style="font-size: 12px; white-space: normal;">Перерыв / Личные дела</div>
                        </div>
                        <div style="flex-shrink: 0; margin-left: 10px;">
                            <div class="status-badge completed" style="margin:0; background: rgba(255,255,255,0.05); color: #888; border-color: transparent;">Блок</div>
                        </div>
                    </div>
                `;
            } else {
                const servicesText = (b.services || []).map(s => escapeBookingHtml(s.title || 'Услуга')).join(', ');
                const bookingTotal = (b.services || []).reduce((sum, service) => sum + Number(service.price || 0), 0);
                const payState = getBookingPaymentState(b, bookingTotal);
                const bookingDuration = getBookingDurationMinutes(b);
                const startMinutes = parseScheduleTimeMinutes(b.time);
                const endMinutes = startMinutes === null ? null : startMinutes + bookingDuration;
                const endLabel = endMinutes === null ? '' : String(Math.floor(endMinutes / 60)).padStart(2, '0') + ':' + String(endMinutes % 60).padStart(2, '0');
                const remaining = Math.max(0, bookingTotal - payState.paid);
                const safeStatus = ['active', 'pending', 'confirmed', 'completed', 'cancelled'].includes(b.status) ? b.status : 'active';
                let itemClass = safeStatus === 'completed' ? 'completed' : (safeStatus === 'cancelled' ? 'cancelled' : '');
                let statusBadge = '';
                if (safeStatus === 'completed') statusBadge = `<div class="status-badge completed" style="margin:0;">Завершена</div>`;
                else if (safeStatus === 'cancelled') statusBadge = `<div class="status-badge cancelled" style="margin:0;">Отменена</div>`;
                else statusBadge = `<div class="status-badge active" style="margin:0;">Активная</div>`;

                return `
                    <div class="home-booking-item ${itemClass}" onclick="openActionModal('${escapeBookingHtml(String(b.id))}')" style="cursor: pointer; margin-bottom: 0; padding: 12px; display: flex; justify-content: space-between; align-items: flex-start; width: 100%; box-sizing: border-box;">
                        <div class="hb-info" style="flex: 1; min-width: 0;">
                            <div class="mobile-booking-time"><strong>${escapeBookingHtml(b.time || '—')}</strong><span>${endLabel ? 'до ' + endLabel : ''} · ${bookingDuration} мин.</span></div>
                            <div class="hb-master" style="font-size: 12px;">${currentUser.role === 'admin' ? escapeBookingHtml((mockStaff.find(s=>s.id === b.barberId)?.name || 'Мастер') + ' · ') : ''}${escapeBookingHtml(b.clientName || 'Клиент')}</div>
                            <div class="booking-card-badges"><i class="booking-origin origin-${getBookingSourceMeta(b).className}">${getBookingSourceMeta(b).label}</i><i class="booking-client-type type-${getBookingClientTypeMeta(b).className}">${getBookingClientTypeMeta(b).label}</i></div>
                            <div class="hb-services" style="font-size: 11px; white-space: normal;">${servicesText}</div>
                            <div class="mobile-booking-finance"><strong>${bookingTotal.toLocaleString('ru-RU')} ₽</strong><span>${payState.paid.toLocaleString('ru-RU')} ₽ получено</span><span>${remaining.toLocaleString('ru-RU')} ₽ остаток</span></div>
                            <span class="calendar-payment-label payment-${payState.status}">${payState.label}</span>
                        </div>
                        <div style="flex-shrink: 0; margin-left: 10px;">
                            ${statusBadge}
                        </div>
                    </div>
                `;
            }
        };

        // Разделители
        const yellowDivider = `<div style="width: 100%; height: 2px; background: var(--gold); opacity: 0.6; margin: 12px 0; border-radius: 2px; box-shadow: 0 0 6px rgba(212,175,55,0.4); flex-shrink: 0;"></div>`;
        const grayDivider = `<div style="width: 100%; height: 1px; background: rgba(255,255,255,0.1); margin: 12px 0; flex-shrink: 0;"></div>`;

        if (isPC) {
            list.style.display = 'flex';
            list.style.flexDirection = 'row';
            list.style.overflowX = 'auto';
            list.style.gap = '15px';
            list.style.paddingBottom = '15px';
            list.style.alignItems = 'flex-start';

            let html = '';
            
            for (let i = 0; i < 10; i++) {
                const d = new Date();
                d.setDate(d.getDate() + i);
                const dateStr = d.toLocaleDateString('ru-RU');
                let dayName = i === 0 ? 'Сегодня' : i === 1 ? 'Завтра' : d.toLocaleDateString('ru-RU', { weekday: 'short' });

                let filteredBookings = bookings.filter(b => b.date === dateStr && b.barberId === currentUser.id);
                let filteredBlocks = timeBlocks.filter(tb => tb.date === dateStr && tb.barberId === currentUser.id);

                let cardsHtml = '';

                // РЕНДЕР В ЗАВИСИМОСТИ ОТ ВКЛАДКИ
                if (currentScheduleTab === 'bookings') {
                    filteredBookings.sort((a, b) => a.time.localeCompare(b.time));
                    filteredBookings.forEach((b, index) => {
                        cardsHtml += createCard(b, false);
                        if (index < filteredBookings.length - 1) cardsHtml += yellowDivider;
                    });
                    if (filteredBookings.length === 0) cardsHtml = `<div style="color: var(--text-muted); font-size: 12px; padding: 10px 0;">Нет записей</div>`;
                } else {
                    filteredBlocks.sort((a, b) => a.startTime.localeCompare(b.startTime));
                    filteredBlocks.forEach((tb, index) => {
                        cardsHtml += createCard(tb, true);
                        if (index < filteredBlocks.length - 1) cardsHtml += grayDivider;
                    });
                    if (filteredBlocks.length === 0) cardsHtml = `<div style="color: var(--text-muted); font-size: 12px; padding: 10px 0;">Нет перерывов</div>`;
                }

                html += `
                    <div style="flex: 0 0 300px; background: rgba(255,255,255,0.02); border-radius: 16px; padding: 15px; border: 1px solid rgba(255,255,255,0.05); display: flex; flex-direction: column;">
                        <div style="font-size: 13px; font-weight: 800; color: var(--gold); text-transform: uppercase; margin-bottom: 10px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 10px; display: flex; justify-content: space-between; flex-shrink: 0;">
                            <span>${dayName}</span>
                            <span>${d.getDate()}.${(d.getMonth()+1).toString().padStart(2, '0')}</span>
                        </div>
                        <div style="display: flex; flex-direction: column; overflow-y: auto; padding-right: 5px; width: 100%;">
                            ${cardsHtml}
                        </div>
                    </div>
                `;
            }
            list.innerHTML = html;
        } else {
            list.style.display = 'flex';
            list.style.flexDirection = 'column';
            list.style.gridTemplateColumns = 'none';

            const targetDate = selectedScheduleDate;
            
            const canSeeAllStaff = currentUser.role === 'admin';
            let filteredBookings = bookings.filter(b => b.date === targetDate && (canSeeAllStaff || b.barberId === currentUser.id));
            let filteredBlocks = timeBlocks.filter(tb => tb.date === targetDate && (canSeeAllStaff || tb.barberId === currentUser.id));

            let html = '';

            // РЕНДЕР В ЗАВИСИМОСТИ ОТ ВКЛАДКИ
            if (currentScheduleTab === 'bookings') {
                filteredBookings.sort((a, b) => a.time.localeCompare(b.time));
                filteredBookings.forEach((b, index) => {
                    html += createCard(b, false);
                    if (index < filteredBookings.length - 1) html += yellowDivider;
                });
                if (filteredBookings.length === 0) {
                    const emptyText = "На этот день записей нет";
                    html = `<div class="empty-bookings-msg" id="emptyMsg" style="font-size: 16px; font-weight: 600; padding: 20px 0;">${emptyText}</div>`;
                    emptyPhrasesTimer = setInterval(() => {
                        const msgDiv = document.getElementById('emptyMsg');
                        if (!msgDiv) { clearInterval(emptyPhrasesTimer); return; }
                        msgDiv.style.opacity = '0';
                        setTimeout(() => {
                            msgDiv.innerText = emptyPhrases[Math.floor(Math.random() * emptyPhrases.length)];
                            msgDiv.style.opacity = '1';
                        }, 300);
                    }, 15000);
                }
            } else {
                filteredBlocks.sort((a, b) => a.startTime.localeCompare(b.startTime));
                filteredBlocks.forEach((tb, index) => {
                    html += createCard(tb, true);
                    if (index < filteredBlocks.length - 1) html += grayDivider;
                });
                if (filteredBlocks.length === 0) {
                    html = `<div class="empty-bookings-msg" style="font-size: 16px; font-weight: 600; padding: 20px 0;">На этот день перерывов нет</div>`;
                }
            }

            list.innerHTML = html;
        }
        
        list.style.opacity = '1';
    }, 200);
}



function renderScheduleBarberFilter(staff) {
    if (!currentUser || currentUser.role !== 'admin') return '';
    const options = [{ id: 'all', name: 'Все мастера' }, ...staff];
    return `<div class="schedule-barber-filter" role="group" aria-label="Фильтр по мастерам">${options.map(person => `<button type="button" class="${String(selectedScheduleBarberFilter)===String(person.id)?'active':''}" aria-pressed="${String(selectedScheduleBarberFilter)===String(person.id)}" onclick="setScheduleBarberFilter('${escapeBookingHtml(String(person.id))}')">${escapeBookingHtml(person.name)}</button>`).join('')}</div>`;
}
function setScheduleBarberFilter(barberId) {
    const allowed = currentUser?.role === 'admin' ? ['all', ...mockStaff.map(person => String(person.id))] : [String(currentUser?.id || '')];
    if (!allowed.includes(String(barberId))) return;
    selectedScheduleBarberFilter = String(barberId);
    renderSchedule();
}

function renderDesktopSchedule() {
    const view = document.getElementById('viewSchedule');
    if (!view) return;

    let calendar = document.getElementById('desktopSchedule');
    if (!calendar) {
        calendar = document.createElement('div');
        calendar.id = 'desktopSchedule';
    }
    // Календарь должен находиться сразу после основной карточки расписания,
    // а не в самом конце вкладки под блокировками и листом ожидания.
    const scheduleCard = view.querySelector(':scope > .schedule-main-card');
    if (scheduleCard && calendar.previousElementSibling !== scheduleCard) {
        scheduleCard.insertAdjacentElement('afterend', calendar);
    } else if (!scheduleCard && calendar.parentElement !== view) {
        view.appendChild(calendar);
    }

    const [day, month, year] = selectedScheduleDate.split('.').map(Number);
    const selectedDate = new Date(year, month - 1, day);
    if (Number.isNaN(selectedDate.getTime())) return;

    const availableStaff = currentUser.role === 'admin'
        ? mockStaff
        : mockStaff.filter(s => s.id === currentUser.id);
    const staff = selectedScheduleBarberFilter === 'all'
        ? availableStaff
        : availableStaff.filter(person => String(person.id) === String(selectedScheduleBarberFilter));
    const viewMode = ['week', 'month'].includes(window.desktopCalendarMode) ? window.desktopCalendarMode : 'day';
    if (viewMode === 'month') {
        const monthStart = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
        const gridStart = new Date(monthStart);
        gridStart.setDate(1 - ((monthStart.getDay() + 6) % 7));
        const monthDays = Array.from({ length: 42 }, (_, i) => {
            const d = new Date(gridStart);
            d.setDate(gridStart.getDate() + i);
            return d;
        });
        const monthLabel = selectedDate.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
        const weekDays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
        const html = `
            <div class="desktop-calendar-toolbar">
                <div class="desktop-calendar-date-controls">
                    <button type="button" class="calendar-date-arrow" onclick="shiftScheduleMonth(-1)" aria-label="Предыдущий месяц">‹</button>
                    <button type="button" class="calendar-today-btn" onclick="goToScheduleToday()">Сегодня</button>
                    <strong>${monthLabel}</strong>
                    <button type="button" class="calendar-date-arrow" onclick="shiftScheduleMonth(1)" aria-label="Следующий месяц">›</button>
                    <span>${staff.length} маст.</span>
                </div>
                <div class="desktop-calendar-tabs">
                    <button onclick="setDesktopCalendarMode('day')">День</button>
                    <button onclick="setDesktopCalendarMode('week')">Неделя</button>
                    <button class="active" onclick="setDesktopCalendarMode('month')">Месяц</button>
                    <button class="${currentScheduleTab === 'bookings' ? 'active' : ''}" onclick="switchScheduleTab('bookings')">Записи</button>
                    <button class="${currentScheduleTab === 'breaks' ? 'active' : ''}" onclick="switchScheduleTab('breaks')">Перерывы</button>
                </div>
            </div>
            ${renderScheduleBarberFilter(availableStaff)}
            <div class="desktop-month-grid">
                ${weekDays.map(dayName => `<div class="desktop-month-weekday">${dayName}</div>`).join('')}
                ${monthDays.map(date => {
                    const dateKey = date.toLocaleDateString('ru-RU');
                    const inMonth = date.getMonth() === selectedDate.getMonth();
                    const dayBookings = bookings.filter(b => b.date === dateKey && b.status !== 'cancelled' && staff.some(member => String(member.id) === String(b.barberId)));
                    const dayBlocks = timeBlocks.filter(b => b.date === dateKey && staff.some(member => String(member.id) === String(b.barberId)));
                    const count = currentScheduleTab === 'bookings' ? dayBookings.length : dayBlocks.length;
                    const active = dateKey === selectedScheduleDate;
                    const preview = (currentScheduleTab === 'bookings' ? dayBookings : dayBlocks).slice(0, 3);
                    return `
                        <button type="button" class="desktop-month-day ${inMonth ? '' : 'outside-month'} ${active ? 'selected' : ''}"
                            onclick="selectCalendarDate('${dateKey}')">
                            <strong>${date.getDate()}</strong>
                            <span class="desktop-month-count">${count ? (currentScheduleTab === 'bookings' ? count + ' запис.' : count + ' пер.') : '—'}</span>
                            <span class="desktop-month-preview">${preview.map(item => currentScheduleTab === 'bookings' ? `${escapeBookingHtml(item.time)} · ${escapeBookingHtml(item.clientName)}` : `${escapeBookingHtml(item.startTime)}–${escapeBookingHtml(item.endTime)} · перерыв`).join('<br>')}</span>
                            ${count > 3 ? `<small>ещё ${count - 3}</small>` : ''}
                        </button>`;
                }).join('')}
            </div>`;
        calendar.innerHTML = html;
        return;
    }

    const START_HOUR = 8;
    const END_HOUR = 22;
    const SLOT_HEIGHT = 24;
    const HOUR_HEIGHT = SLOT_HEIGHT * 4;
    const totalHeight = (END_HOUR - START_HOUR) * HOUR_HEIGHT;
    const toMinutes = time => {
        const [h, m] = time.split(':').map(Number);
        return h * 60 + m;
    };
    const toDateKey = date => date.toLocaleDateString('ru-RU');
    const weekStart = new Date(selectedDate);
    weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
    const dates = viewMode === 'week'
        ? Array.from({ length: 7 }, (_, i) => {
            const d = new Date(weekStart);
            d.setDate(weekStart.getDate() + i);
            return d;
        })
        : [selectedDate];
    const columns = dates.flatMap(date => staff.map(barber => ({ date, barber })));
    const rangeLabel = viewMode === 'week'
        ? dates[0].toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }) +
          ' — ' + dates[6].toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })
        : selectedScheduleDate;

    let html = `
        <div class="desktop-calendar-toolbar">
            <div class="desktop-calendar-date-controls">
                <button type="button" class="calendar-date-arrow" onclick="shiftScheduleDate(-${viewMode === 'week' ? 7 : 1})" aria-label="Назад">‹</button>
                <button type="button" class="calendar-today-btn" onclick="goToScheduleToday()">Сегодня</button>
                <strong>${rangeLabel}</strong>
                <button type="button" class="calendar-date-arrow" onclick="shiftScheduleDate(${viewMode === 'week' ? 7 : 1})" aria-label="Вперёд">›</button>
                <span>${staff.length} маст.</span>
            </div>
            <div class="desktop-calendar-tabs">
                <button class="${viewMode === 'day' ? 'active' : ''}" onclick="setDesktopCalendarMode('day')">День</button>
                <button class="${viewMode === 'week' ? 'active' : ''}" onclick="setDesktopCalendarMode('week')">Неделя</button>
                <button class="${currentScheduleTab === 'bookings' ? 'active' : ''}" onclick="switchScheduleTab('bookings')">Записи</button>
                <button class="${currentScheduleTab === 'breaks' ? 'active' : ''}" onclick="switchScheduleTab('breaks')">Перерывы</button>
            </div>
        </div>
        ${renderScheduleBarberFilter(availableStaff)}
        <div class="desktop-calendar-scroll ${viewMode === 'week' ? 'is-week-view' : ''}">
            <div class="desktop-calendar-grid" style="--calendar-column-count:${Math.max(columns.length, 1)}">
                <div class="desktop-time-column">
                    <div class="desktop-staff-heading">Время</div>
                    <div class="desktop-time-track" style="height:${totalHeight}px">
                        ${Array.from({length: END_HOUR - START_HOUR + 1}, (_, i) =>
                            `<div class="desktop-time-label" style="top:${i * HOUR_HEIGHT}px">${String(START_HOUR + i).padStart(2, '0')}:00</div>`
                        ).join('')}
                    </div>
                </div>
    `;

    columns.forEach(({ date, barber }) => {
        const dateKey = toDateKey(date);
        const barberBookings = bookings.filter(b => b.date === dateKey && String(b.barberId) === String(barber.id) && b.status !== 'cancelled');
        const barberBlocks = timeBlocks.filter(b => b.date === dateKey && String(b.barberId) === String(barber.id));
        const dayHeading = viewMode === 'week'
            ? date.toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric' })
            : barber.name;
        const subHeading = viewMode === 'week' ? barber.name : (barber.role === 'admin' ? 'Администратор' : 'Барбер');

        html += `
            <div class="desktop-staff-column">
                <button class="desktop-staff-heading" onclick="showBarberStats('${escapeBookingHtml(String(barber.id))}')">
                    <strong>${escapeBookingHtml(dayHeading)}</strong><span>${escapeBookingHtml(subHeading)}</span>
                </button>
                <div class="desktop-staff-track"
                    style="height:${totalHeight}px"
                    ondragover="if(event.dataTransfer.types.includes('text/plain')){event.preventDefault();event.dataTransfer.dropEffect='move'}"
                    ondrop="event.preventDefault(); event.stopPropagation(); moveBookingToSlot(event, '${escapeBookingHtml(String(barber.id))}', '${escapeBookingHtml(dateKey)}')"
                    onclick="openNewBookingFromSlot(event, '${escapeBookingHtml(String(barber.id))}', '${escapeBookingHtml(dateKey)}')">
        `;

        for (let i = 0; i <= (END_HOUR - START_HOUR) * 4; i++) {
            html += `<div class="desktop-time-line ${i % 4 === 0 ? 'hour' : ''}" style="top:${i * SLOT_HEIGHT}px"></div>`;
        }

        // Тонкая линия текущего времени помогает быстро ориентироваться в сегодняшнем дне.
        const now = new Date();
        if (dateKey === now.toLocaleDateString('ru-RU')) {
            const nowMinutes = now.getHours() * 60 + now.getMinutes();
            if (nowMinutes >= START_HOUR * 60 && nowMinutes <= END_HOUR * 60) {
                const nowTop = (nowMinutes - START_HOUR * 60) / 15 * SLOT_HEIGHT;
                html += `<div class="desktop-current-time" style="top:${nowTop}px"><span>${now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</span></div>`;
            }
        }

        if (currentScheduleTab === 'bookings') {
            // Раскладываем пересекающиеся записи по соседним дорожкам,
            // чтобы старые/импортированные конфликты не скрывали карточки.
            const layoutItems = barberBookings.map(booking => {
                const match = /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(String(booking.time || ''));
                if (!match) return null;
                const startMinutes = toMinutes(booking.time);
                const duration = getBookingDurationMinutes(booking);
                const endMinutes = startMinutes + duration;
                const top = (startMinutes - START_HOUR * 60) / 15 * SLOT_HEIGHT;
                if (top < 0 || top >= totalHeight || endMinutes <= startMinutes) return null;
                return { booking, startMinutes, endMinutes, top, duration };
            }).filter(Boolean).sort((a, b) =>
                a.startMinutes - b.startMinutes || a.endMinutes - b.endMinutes
            );

            let cluster = [];
            let clusterEnd = -1;
            const renderCluster = items => {
                if (!items.length) return;
                const laneEnds = [];
                items.forEach(item => {
                    let lane = laneEnds.findIndex(laneEnd => laneEnd <= item.startMinutes);
                    if (lane < 0) lane = laneEnds.length;
                    laneEnds[lane] = item.endMinutes;
                    item.lane = lane;
                });
                const laneCount = Math.max(laneEnds.length, 1);

                items.forEach(item => {
                    const booking = item.booking;
                    const height = Math.min(item.duration / 15 * SLOT_HEIGHT, totalHeight - item.top);
                    const serviceNames = (Array.isArray(booking.services) ? booking.services : []).map(service => escapeBookingHtml(service?.title || 'Услуга')).join(', ');
                    const bookingTotal = (Array.isArray(booking.services) ? booking.services : []).reduce((sum, service) => sum + Number(service?.price || 0), 0);
                    const payState = getBookingPaymentState(booking, bookingTotal);
                    const bookingStatus = ['active', 'pending', 'confirmed', 'completed', 'cancelled'].includes(booking.status) ? booking.status : 'active';
                    const bookingStatusLabel = bookingStatus === 'completed' ? 'Завершена' : bookingStatus === 'cancelled' ? 'Отменена' : bookingStatus === 'confirmed' ? 'Подтверждена' : bookingStatus === 'pending' ? 'Ожидает' : 'Активная';
                    const laneWidth = 100 / laneCount;
                    const left = item.lane * laneWidth;
                    html += `
                        <button type="button" draggable="true" class="desktop-booking-card ${bookingStatus} payment-border-${payState.status}"
                            style="top:${item.top}px;height:${height}px;left:calc(${left}% + 3px);width:calc(${laneWidth}% - 6px);right:auto"
                            ondragstart="event.stopPropagation(); event.dataTransfer.setData('text/plain','${escapeBookingHtml(String(booking.id))}'); event.dataTransfer.effectAllowed='move'"
                            onclick="event.stopPropagation(); openActionModal('${escapeBookingHtml(String(booking.id))}')">
                            <strong class="booking-card-client">${escapeBookingHtml(booking.clientName || 'Клиент')}</strong>
                            <span class="booking-card-badges"><i class="booking-origin origin-${getBookingSourceMeta(booking).className}">${getBookingSourceMeta(booking).label}</i><i class="booking-client-type type-${getBookingClientTypeMeta(booking).className}">${getBookingClientTypeMeta(booking).label}</i></span>
                            <span class="booking-card-service">${serviceNames || 'Услуга не указана'}</span>
                            <small class="booking-card-meta"><b>${escapeBookingHtml(booking.time || '—')}</b> · ${item.duration} мин. · ${bookingStatusLabel}</small><span class="calendar-payment-label payment-${payState.status}">${payState.label} · ${payState.paid.toLocaleString('ru-RU')} ₽</span>
                        </button>`;
                });
            };

            layoutItems.forEach(item => {
                if (cluster.length && item.startMinutes >= clusterEnd) {
                    renderCluster(cluster);
                    cluster = [];
                    clusterEnd = -1;
                }
                cluster.push(item);
                clusterEnd = Math.max(clusterEnd, item.endMinutes);
            });
            renderCluster(cluster);
        } else {
            barberBlocks.forEach(block => {
                const blockStart = parseScheduleTimeMinutes(block.startTime);
                const blockEnd = parseScheduleTimeMinutes(block.endTime);
                if (blockStart === null || blockEnd === null || blockStart >= blockEnd) return;
                const top = (blockStart - START_HOUR * 60) / 15 * SLOT_HEIGHT;
                const height = (blockEnd - blockStart) / 15 * SLOT_HEIGHT;
                if (top < 0 || top >= totalHeight || height <= 0) return;
                html += `
                    <button type="button" class="desktop-break-card" style="top:${top}px;height:${Math.min(height, totalHeight - top)}px"
                        onclick="event.stopPropagation(); openBlockActionModal('${escapeBookingHtml(String(block.id))}')">
                        <strong>${escapeBookingHtml(block.startTime)}–${escapeBookingHtml(block.endTime)}</strong><span>Перерыв</span>
                    </button>`;
            });
        }
        html += '</div></div>';
    });

    html += '</div></div>';
    calendar.innerHTML = html;
}

function setDesktopCalendarMode(mode) {
    window.desktopCalendarMode = ['day', 'week', 'month'].includes(mode) ? mode : 'day';
    renderDesktopSchedule();
}

function shiftScheduleMonth(offset) {
    const [day, month, year] = selectedScheduleDate.split('.').map(Number);
    const current = new Date(year, month - 1, day);
    if (Number.isNaN(current.getTime())) return;
    const targetDay = current.getDate();
    const target = new Date(current.getFullYear(), current.getMonth() + Number(offset || 0), 1);
    const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
    target.setDate(Math.min(targetDay, lastDay));
    selectedScheduleDate = target.toLocaleDateString('ru-RU');
    renderSchedule();
}

function selectCalendarDate(dateKey) {
    selectedScheduleDate = dateKey;
    window.desktopCalendarMode = 'day';
    renderSchedule();
}


function renderDateSelector() {
    const container = document.getElementById('scheduleDateSelector');
    if (!container) return;
    container.innerHTML = '';
    
    const days = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
    const [day, month, year] = selectedScheduleDate.split('.').map(Number);
    const selected = new Date(year, month - 1, day);
    if (Number.isNaN(selected.getTime())) return;

    for (let i = -14; i <= 15; i++) {
        const d = new Date(selected);
        d.setDate(selected.getDate() + i);
        const dateStr = d.toLocaleDateString('ru-RU');
        const todayStr = new Date().toLocaleDateString('ru-RU');
        const dayName = dateStr === todayStr ? 'Сегодня' : days[d.getDay()];
        
        const div = document.createElement('div');
        div.className = `date-selector-item ${selectedScheduleDate === dateStr ? 'selected' : ''}`;
        const canSeeAllStaff = currentUser && currentUser.role === 'admin';
        const dayBookings = bookings.filter(item => item.date === dateStr && item.status !== 'cancelled' && (canSeeAllStaff || String(item.barberId) === String(currentUser?.id)));
        const dayBlocks = timeBlocks.filter(item => item.date === dateStr && (canSeeAllStaff || String(item.barberId) === String(currentUser?.id)));
        div.innerHTML = `
            <div class="day-name">${dayName}</div>
            <div class="day-num">${d.getDate()}</div>
            <div class="date-selector-meta">
                <span class="date-booking-count">${dayBookings.length ? dayBookings.length + ' запис.' : '—'}</span>
                ${dayBlocks.length ? '<i class="date-block-indicator" title="Есть перерывы"></i>' : ''}
            </div>
        `;
        div.onclick = () => {
            selectedScheduleDate = dateStr;
            renderSchedule();
        };
        container.appendChild(div);
    }

    const activeDate = container.querySelector('.date-selector-item.selected');
    if (activeDate && window.innerWidth < 768) {
        activeDate.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
    }
}
function shiftScheduleDate(offset) {
    const [day, month, year] = selectedScheduleDate.split('.').map(Number);
    const date = new Date(year, month - 1, day);
    if (Number.isNaN(date.getTime())) return;
    date.setDate(date.getDate() + Number(offset || 0));
    selectedScheduleDate = date.toLocaleDateString('ru-RU');
    renderSchedule();
}

function goToScheduleToday() {
    selectedScheduleDate = new Date().toLocaleDateString('ru-RU');
    renderSchedule();
}

function switchScheduleTab(tab) {
    if (!['bookings', 'breaks'].includes(tab)) return;
    currentScheduleTab = tab;
    document.querySelectorAll('#desktopScheduleSubnav button').forEach((button, index) => {
        button.classList.toggle('active', (index === 0 && tab === 'bookings') || (index === 1 && tab === 'breaks'));
    });
    document.getElementById('tabBookings').classList.toggle('active', tab === 'bookings');
    document.getElementById('tabBreaks').classList.toggle('active', tab === 'breaks');
    renderSchedule();
}


function escapeBookingHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[char]);
}


const PAYMENT_METHOD_LABELS = { cash: 'Наличные', card: 'Карта', transfer: 'Перевод', online: 'Онлайн', mixed: 'Смешанная оплата' };
function getBookingSourceMeta(booking) {
    const source = String(booking?.bookingSource || booking?.source || 'admin_panel').toLowerCase();
    const map = {
        admin_panel: { label: 'Панель', className: 'admin' },
        barber_app: { label: 'Приложение барбера', className: 'barber' },
        barber_mobile: { label: 'Приложение барбера', className: 'barber' },
        barber_phone: { label: 'Телефон барбера', className: 'phone' },
        phone_call: { label: 'Телефон', className: 'phone' },
        website: { label: 'Сайт', className: 'web' },
        site: { label: 'Сайт', className: 'web' },
        web: { label: 'Сайт', className: 'web' },
        pwa: { label: 'PWA', className: 'pwa' },
        client_pwa: { label: 'PWA клиента', className: 'pwa' },
        pwa_client: { label: 'PWA клиента', className: 'pwa' },
        client_app: { label: 'Приложение клиента', className: 'app' },
        mobile_app: { label: 'Мобильное приложение', className: 'app' },
        phone: { label: 'Телефон', className: 'phone' }
    };
    return map[source] || { label: 'Другой канал', className: 'other' };
}
function getBookingClientType(booking) {
    const currentTime = parseClientDateTime(booking);
    const profile = findClientProfile(booking?.clientName || '', booking?.barberId || '').profile;
    const phone = normalizeClientPhone(profile.phone);
    const name = String(booking?.clientName || '').trim().toLocaleLowerCase('ru-RU');
    const hadEarlierVisit = bookings.some(previous => {
        if (String(previous.id) === String(booking?.id) || previous.status !== 'completed') return false;
        const previousTime = parseClientDateTime(previous);
        if (!previousTime || (currentTime && previousTime >= currentTime)) return false;
        if (phone.length >= 7) {
            const previousProfile = findClientProfile(previous.clientName || '', previous.barberId || '').profile;
            return normalizeClientPhone(previousProfile.phone) === phone;
        }
        return String(previous.clientName || '').trim().toLocaleLowerCase('ru-RU') === name;
    });
    return hadEarlierVisit ? 'regular' : 'new';
}
function getBookingClientTypeMeta(booking) {
    return getBookingClientType(booking) === 'new'
        ? { label: 'Новый клиент', className: 'new' }
        : { label: 'Повторный клиент', className: 'returning' };
}

function getBookingServiceTotal(booking) {
    return (Array.isArray(booking?.services) ? booking.services : []).reduce((sum, service) => {
        const amount = Number(service?.price);
        return sum + (Number.isFinite(amount) ? Math.max(0, amount) : 0);
    }, 0);
}

function getBookingCollectedAmount(booking) {
    const serviceTotal = getBookingServiceTotal(booking);
    const transactions = Array.isArray(booking?.payments) ? booking.payments : [];
    if (transactions.length) {
        const collected = transactions.reduce((sum, payment) => {
            const amount = Number(payment?.amount);
            return sum + (Number.isFinite(amount) ? Math.max(0, amount) : 0);
        }, 0);
        return Math.min(serviceTotal, collected);
    }
    if (Object.prototype.hasOwnProperty.call(booking || {}, 'paidAmount')) {
        const legacyPaid = Number(booking.paidAmount);
        return Math.min(serviceTotal, Number.isFinite(legacyPaid) ? Math.max(0, legacyPaid) : 0);
    }
    // Для старых записей сохраняем выручку только по завершённым визитам.
    // Будущие и незавершённые записи без отметки оплаты не считаем оплаченными.
    return booking?.status === 'completed' ? serviceTotal : 0;
}
function getBookingPaymentState(booking, total) {
    const safeTotal = Number.isFinite(Number(total)) ? Math.max(0, Number(total)) : 0;
    const transactions = Array.isArray(booking?.payments) ? booking.payments : [];
    const transactionTotal = transactions.reduce((sum, item) => {
        const amount = Number(item?.amount);
        return sum + (Number.isFinite(amount) ? Math.max(0, amount) : 0);
    }, 0);
    const hasLegacyPaidAmount = Object.prototype.hasOwnProperty.call(booking || {}, 'paidAmount');
    const legacyPaidValue = Number(booking?.paidAmount || 0);
    const legacyPaid = Number.isFinite(legacyPaidValue) ? Math.max(0, legacyPaidValue) : 0;
    // Синхронизируем статус оплаты с общей функцией суммы: старые завершённые
    // записи без отдельной истории платежей считаются полностью оплаченными.
    const fallbackPaid = !transactions.length && !hasLegacyPaidAmount && booking?.status === 'completed'
        ? safeTotal
        : legacyPaid;
    const paid = Math.min(safeTotal, transactions.length ? transactionTotal : fallbackPaid);
    const status = paid <= 0 || safeTotal <= 0 ? 'unpaid' : paid >= safeTotal ? 'paid' : 'partial';
    const methods = [...new Set(transactions
        .filter(item => Number.isFinite(Number(item?.amount)) && Number(item.amount) > 0)
        .map(item => item?.method)
        .filter(Boolean))];
    const method = methods.length > 1 ? 'mixed' : (methods[0] || booking?.paymentMethod);
    return {
        paid,
        status,
        label: status === 'paid' ? 'Оплачено' : status === 'partial' ? 'Частично оплачено' : 'Не оплачено',
        method,
        methodLabel: PAYMENT_METHOD_LABELS[method] || 'Не указан',
        transactions
    };
}
let selectedPaymentBookingId = null;

function openBookingPaymentEditor(id) {
    if (!currentUser) return showToast('Войдите в приложение, чтобы изменить оплату', 'error');
    const booking = bookings.find(item => String(item.id) === String(id));
    if (!booking) return;
    if (booking.status === 'cancelled') {
        return showToast('Нельзя добавлять оплату к отменённой записи', 'error');
    }
    const total = getBookingServiceTotal(booking);
    const paymentState = getBookingPaymentState(booking, total);
    const balance = Math.max(0, total - paymentState.paid);
    if (balance <= 0) return showToast('Запись уже оплачена полностью', 'info');

    selectedPaymentBookingId = booking.id;
    const amountInput = document.getElementById('bookingPaymentAmount');
    const methodInput = document.getElementById('bookingPaymentMethod');
    const balanceLabel = document.getElementById('bookingPaymentBalance');
    if (!amountInput || !methodInput || !balanceLabel) {
        return showToast('Форма оплаты недоступна', 'error');
    }
    amountInput.value = balance.toFixed(2).replace(/\\.00$/, '');
    amountInput.max = String(balance);
    balanceLabel.textContent = 'К оплате осталось: ' + balance.toLocaleString('ru-RU') + ' ₽';
    methodInput.value = 'cash';
    setBookingPaymentMethod('cash');
    openModal('bookingPaymentModal');
}

function saveBookingPayment() {
    if (!currentUser) return showToast('Войдите в приложение, чтобы изменить оплату', 'error');
    const booking = bookings.find(item => String(item.id) === String(selectedPaymentBookingId));
    if (!booking) {
        closeModal('bookingPaymentModal');
        return showToast('Запись не найдена', 'error');
    }

    const total = getBookingServiceTotal(booking);
    const paymentState = getBookingPaymentState(booking, total);
    const balance = Math.max(0, total - paymentState.paid);
    const amountInput = document.getElementById('bookingPaymentAmount');
    const methodInput = document.getElementById('bookingPaymentMethod');
    const amount = Number(String(amountInput?.value || '').replace(',', '.'));
    const method = methodInput?.value || '';

    if (!Number.isFinite(amount) || amount <= 0 || amount > balance) {
        return showToast('Введите сумму больше 0 и не больше остатка ' + balance + ' ₽', 'error');
    }
    if (!['cash', 'card', 'transfer', 'online'].includes(method)) {
        return showToast('Выберите корректный способ оплаты', 'error');
    }

    if (!Array.isArray(booking.payments) || booking.payments.length === 0) {
        // Переносим старую оплаченную сумму в историю транзакций до добавления нового платежа.
        // Иначе пустой legacy-массив payments мог обнулить уже полученные деньги.
        booking.payments = paymentState.paid > 0
            ? [{
                amount: paymentState.paid,
                method: ['cash', 'card', 'transfer', 'online'].includes(booking.paymentMethod) ? booking.paymentMethod : 'other',
                createdAt: booking.paymentUpdatedAt || ''
            }]
            : [];
    }
    const paymentTime = new Date().toISOString();
    booking.payments.push({
        amount,
        method,
        createdAt: paymentTime,
        by: currentUser.name || ''
    });
    booking.paidAmount = booking.payments.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    const methods = [...new Set(booking.payments.map(item => item.method).filter(Boolean))];
    booking.paymentMethod = methods.length > 1 ? 'mixed' : (methods[0] || method);
    booking.paymentUpdatedAt = paymentTime;

    localStorage.setItem(appStorageKey('mensfire_admin_bookings'), JSON.stringify(bookings));
    selectedPaymentBookingId = null;
    closeModal('bookingPaymentModal');
    openActionModal(booking.id);
    showToast('Платёж добавлен', 'success');
}

function openActionModal(id) {
    const booking = bookings.find(b => String(b.id) === String(id));
    if (!booking) {
        showToast('Запись не найдена', 'error');
        return;
    }

    selectedBookingId = booking.id;

    const details = document.getElementById('actionBookingDetails');
    const editBtn = document.getElementById('editBookingBtn');
    const completeBtn = document.getElementById('completeBookingBtn');
    const cancelBtn = document.getElementById('cancelBookingBtn');

    const barber = mockStaff.find(s => s.id === booking.barberId);
    const services = Array.isArray(booking.services) ? booking.services : [];
    const total = getBookingServiceTotal(booking);
    const duration = getBookingDurationMinutes(booking);
    const [startHour = 0, startMinute = 0] = String(booking.time || '00:00').split(':').map(Number);
    const endMinutes = startHour * 60 + startMinute + duration;
    const endTime = duration
        ? `${String(Math.floor(endMinutes / 60)).padStart(2, '0')}:${String(endMinutes % 60).padStart(2, '0')}`
        : booking.time || '—';

    const statusLabels = {
        active: 'Активная',
        pending: 'Ожидает подтверждения',
        confirmed: 'Подтверждена',
        completed: 'Завершена',
        cancelled: 'Отменена'
    };
    const statusKey = booking.status || 'active';
    const status = statusLabels[statusKey] || statusKey;
    const payment = getBookingPaymentState(booking, total);
    const canManage = isAdminUser();
    const canChangeStatus = isBookingBlockingSchedule(booking);

    details.innerHTML = `
        <div class="booking-detail-status ${escapeBookingHtml(statusKey)}">
            ${escapeBookingHtml(status)}
        </div>
        <div class="booking-detail-main">
            <div class="booking-detail-client">${escapeBookingHtml(booking.clientName || 'Клиент')}</div>
            <div class="booking-detail-date">${escapeBookingHtml(booking.date || 'Дата не указана')} · ${escapeBookingHtml(booking.time || '—')}–${escapeBookingHtml(endTime)}</div>
            <div class="booking-card-badges">
                <i class="booking-origin origin-${getBookingSourceMeta(booking).className}">${getBookingSourceMeta(booking).label}</i>
                <i class="booking-client-type type-${getBookingClientTypeMeta(booking).className}">${getBookingClientTypeMeta(booking).label}</i>
            </div>
        </div>
        <div class="booking-detail-row">
            <span>Мастер</span>
            <strong>${escapeBookingHtml(barber?.name || '—')}</strong>
        </div>
        <div class="booking-detail-services">
            <span class="booking-detail-section-label">Состав записи</span>
            ${services.length
                ? services.map(service => `<div class="booking-detail-service"><span>${escapeBookingHtml(service.title || 'Услуга')}</span><strong>${(Number(service.price) || 0).toLocaleString('ru-RU')} ₽</strong></div>`).join('')
                : '<div class="booking-detail-service"><span>Услуги не указаны</span></div>'}
        </div>
        <div class="booking-detail-row">
            <span>Количество услуг</span><strong>${services.length}</strong>
        </div>
        <div class="booking-detail-row booking-detail-total">
            <span>Стоимость</span><strong>${total.toLocaleString('ru-RU')} ₽</strong>
        </div>
        <div class="booking-payment-panel">
            <div class="booking-payment-heading"><span>Оплата</span><strong class="payment-state payment-${payment.status}">${payment.label}</strong></div>
            <div class="booking-payment-meta">Внесено: ${payment.paid.toLocaleString('ru-RU')} ₽ · Остаток: ${Math.max(0, total-payment.paid).toLocaleString('ru-RU')} ₽</div>
            <div class="booking-payment-meta">Способ: ${escapeBookingHtml(payment.methodLabel)}</div>
            ${payment.transactions.length ? '<div class="booking-payment-history">' + payment.transactions.map(item => '<div class="booking-payment-transaction"><span>' + escapeBookingHtml(item.method ? (PAYMENT_METHOD_LABELS[item.method] || item.method) : 'Ранее внесено') + '</span><strong>' + Number(item.amount || 0).toLocaleString('ru-RU') + ' ₽</strong></div>').join('') + '</div>' : ''}

            ${currentUser && booking.status !== 'cancelled' ? '<button type="button" class="booking-payment-edit" onclick="openBookingPaymentEditor(\'' + escapeBookingHtml(String(booking.id)) + '\')">Добавить оплату</button>' : ''}
        </div>
        <div class="booking-detail-row">
            <span>Длительность</span><strong>${duration} мин.</strong>
        </div>
        <button type="button" class="booking-client-link" id="bookingClientLink">
            Открыть историю клиента →
        </button>
    `;

    const clientBtn = document.getElementById('bookingClientLink');
    if (clientBtn) {
        clientBtn.onclick = () => {
            closeModal('actionModal');
            showClientDetails(booking.clientName, booking.barberId);
        };
    }

    if (editBtn) editBtn.style.display = canManage && canChangeStatus ? 'flex' : 'none';
    completeBtn.style.display = canManage && canChangeStatus ? 'flex' : 'none';
    cancelBtn.style.display = canManage && canChangeStatus ? 'flex' : 'none';

    openModal('actionModal');
}

function openEditBooking() {
    if (!requireAdminAction('Редактировать записи может только Али')) return;
    const booking = bookings.find(
        b => String(b.id) === String(selectedBookingId)
    );

    if (!booking) {
        return showToast('Запись не найдена', 'error');
    }

    if (!isBookingBlockingSchedule(booking)) {
        return showToast('Завершённую или отменённую запись нельзя редактировать', 'error');
    }

    const availableStaff = mockStaff;
    if (!availableStaff.some(s => s.id === booking.barberId)) {
        return showToast('Мастер не найден', 'error');
    }

    const dateMatch = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(String(booking.date || ''));
    const bookingTime = parseScheduleTimeMinutes(booking.time);
    if (!dateMatch || bookingTime === null) {
        return showToast('У записи некорректные дата или время. Исправьте данные перед редактированием', 'error');
    }
    const [, day, month, year] = dateMatch;
    const dateValue = `${year}-${month}-${day}`;
    const parsedDate = new Date(dateValue + 'T00:00:00');
    if (Number.isNaN(parsedDate.getTime()) ||
        parsedDate.getFullYear() !== Number(year) ||
        parsedDate.getMonth() + 1 !== Number(month) ||
        parsedDate.getDate() !== Number(day)) {
        return showToast('У записи некорректная дата. Исправьте её перед редактированием', 'error');
    }

    editingBookingId = booking.id;

    const barberSelect = document.getElementById('newBookingBarber');
    if (!barberSelect) {
        editingBookingId = null;
        return showToast('Форма редактирования недоступна', 'error');
    }

    barberSelect.innerHTML = availableStaff.map(s =>
        `<option value="${escapeBookingHtml(String(s.id))}">${escapeBookingHtml(s.name)}</option>`
    ).join('');

    if (!availableStaff.some(s => s.id === booking.barberId)) {
        return showToast('Нет доступа к этому мастеру', 'error');
    }

    barberSelect.value = booking.barberId;
    renderBookingBarberChoices();

    document.getElementById('newBookingClient').value = booking.clientName;
    const phoneInput = document.getElementById('newBookingClientPhone');
    if (phoneInput) phoneInput.value = booking.clientPhone || '';

    document.getElementById('newBookingDate').value = booking.date;

    document.getElementById('newBookingTime').value = booking.time;

    updateNewBookingServices();

    const selectedIds = (booking.services || []).map(s => s.id);

    document.querySelectorAll('#newBookingServicesList input').forEach(input => {
        input.checked = selectedIds.includes(input.value);
    });

    updateNewBookingSummary();

    document.querySelector('#newBookingModal h2').textContent =
        'Перенос / изменение записи';

    document.querySelector('#newBookingModal .checkout-btn').textContent =
        'Сохранить изменения';

    closeModal('actionModal');
    openModal('newBookingModal');
}


function completeBooking() {
    if (!requireAdminAction('Изменять статус записи может только Али')) return;
    const booking = bookings.find(b => String(b.id) === String(selectedBookingId));
    if (!booking) return showToast('Запись не найдена', 'error');
    if (!isBookingBlockingSchedule(booking)) {
        return showToast('Эта запись уже завершена или отменена', 'info');
    }

    booking.status = 'completed';
    localStorage.setItem(appStorageKey('mensfire_admin_bookings'), JSON.stringify(bookings));
    closeModal('actionModal');
    showToast('Запись завершена', 'success');
    renderSchedule();
    if (currentUser.role === 'admin') renderFinance();
    renderBarberRevenue();
}

function cancelBooking() {
    if (!requireAdminAction('Отменять записи может только Али')) return;
    const booking = bookings.find(b => String(b.id) === String(selectedBookingId));
    if (!booking) return showToast('Запись не найдена', 'error');
    if (!isBookingBlockingSchedule(booking)) {
        return showToast('Эта запись уже завершена или отменена', 'info');
    }

    booking.status = 'cancelled';
    localStorage.setItem(appStorageKey('mensfire_admin_bookings'), JSON.stringify(bookings));
    closeModal('actionModal');
    showToast('Запись отменена', 'success');
    renderSchedule();
    if (currentUser.role === 'admin') renderFinance();
}


function updateBlockBarberSelect(selectedId = '') {
    const group = document.getElementById('blockBarberGroup');
    const select = document.getElementById('blockBarberSelect');
    if (!group || !select) return;

    const isAdmin = currentUser.role === 'admin';
    group.style.display = isAdmin ? 'block' : 'none';

    const staff = isAdmin
        ? mockStaff
        : mockStaff.filter(s => s.id === currentUser.id);

    select.innerHTML = staff.map(s =>
        `<option value="${s.id}">${s.name}</option>`
    ).join('');

    const targetId = selectedId || currentUser.id;
    if (staff.some(s => s.id === targetId)) {
        select.value = targetId;
    }
}


// --- БЛОКИРОВКА ВРЕМЕНИ ---

function openBlockTimeModal() {
    if (!requireAdminAction('Создавать перерывы может только Али')) return;
    editingBlockId = null;

    const selectedDate = parseReportDate(selectedScheduleDate) || new Date();
    selectedBlockDate = formatReportDate(selectedDate);

    document.getElementById('customDateDisplay').innerText = selectedBlockDate;

    pickerYear = selectedDate.getFullYear();
    pickerMonth = selectedDate.getMonth();

    document.getElementById('blockStartTime').value = '';
    document.getElementById('blockEndTime').value = '';
    document.getElementById('blockAllDay').checked = false;
    document.getElementById('blockRepeatWeekly').checked = false;
    toggleBlockAllDay();

    updateBlockBarberSelect();

    document.querySelector('#blockTimeModal h2').innerText = 'Блокировка времени';
    document.querySelector('#blockTimeModal .checkout-btn').innerText = 'Заблокировать';

    openModal('blockTimeModal');
}

// Функции для календаря
function openNewBookingDatePicker() {
    const input = document.getElementById('newBookingDate');
    if (!input) return;
    calendarTargetInputId = 'newBookingDate';
    const parts = input.value ? input.value.split('.').map(Number) : [];
    const base = parts.length === 3 ? new Date(parts[2], parts[1] - 1, parts[0]) : new Date();
    selectedBlockDate = input.value || base.toLocaleDateString('ru-RU');
    pickerYear = base.getFullYear();
    pickerMonth = base.getMonth();
    renderCalendar();
    openModal('calendarModal');
}

function openCustomDatePicker() {
    calendarTargetInputId = null;
    renderCalendar();
    openModal('calendarModal');
}

function renderCalendar() {
    const grid = document.getElementById('calendarGrid');
    const monthNames = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];
    document.getElementById('calendarMonthYearDisplay').innerText = `${monthNames[pickerMonth]} ${pickerYear}`;

    grid.innerHTML = '';
    
    const firstDay = new Date(pickerYear, pickerMonth, 1);
    let startDayOfWeek = firstDay.getDay(); // 0=Вс, 1=Пн
    if (startDayOfWeek === 0) startDayOfWeek = 7; // Сдвигаем Вс на 7 место
    
    const daysInMonth = new Date(pickerYear, pickerMonth + 1, 0).getDate();

    // Пустые ячейки до 1-го числа
    for (let i = 1; i < startDayOfWeek; i++) {
        const empty = document.createElement('div');
        empty.className = 'calendar-day empty';
        grid.appendChild(empty);
    }

    // Дни месяца
    for (let i = 1; i <= daysInMonth; i++) {
        const dayDiv = document.createElement('div');
        dayDiv.className = 'calendar-day';
        dayDiv.innerText = i;
        
        const thisDateStr = `${String(i).padStart(2, '0')}.${String(pickerMonth + 1).padStart(2, '0')}.${pickerYear}`;
        
        if (thisDateStr === selectedBlockDate) {
            dayDiv.classList.add('selected');
        }

        dayDiv.onclick = () => {
            selectedBlockDate = thisDateStr;
            if (reportDatePickerTarget) {
                const target = reportDatePickerTarget;
                if (target === 'financeStart') { financeRangeStart = thisDateStr; if (parseReportDate(financeRangeStart) > parseReportDate(financeRangeEnd)) financeRangeEnd = thisDateStr; }
                if (target === 'financeEnd') { financeRangeEnd = thisDateStr; if (parseReportDate(financeRangeEnd) < parseReportDate(financeRangeStart)) financeRangeStart = thisDateStr; }
                if (target === 'clientsStart') { clientsRangeStart = thisDateStr; if (parseReportDate(clientsRangeStart) > parseReportDate(clientsRangeEnd)) clientsRangeEnd = thisDateStr; }
                if (target === 'clientsEnd') { clientsRangeEnd = thisDateStr; if (parseReportDate(clientsRangeEnd) < parseReportDate(clientsRangeStart)) clientsRangeStart = thisDateStr; }
                if (target === 'teamStart') { teamRangeStart = thisDateStr; if (parseReportDate(teamRangeStart) > parseReportDate(teamRangeEnd)) teamRangeEnd = thisDateStr; }
                if (target === 'teamEnd') { teamRangeEnd = thisDateStr; if (parseReportDate(teamRangeEnd) < parseReportDate(teamRangeStart)) teamRangeStart = thisDateStr; }
                reportDatePickerTarget = null;
                closeModal('calendarModal');
                if (target.startsWith('dashboard')) {
                    if (target === 'dashboardDay') {
                        dashboardSelectedDate = thisDateStr;
                        dashboardRangeStart = dashboardRangeEnd = thisDateStr;
                        dashboardPeriodMode = 'day';
                    } else if (target === 'dashboardStart') {
                        dashboardRangeStart = thisDateStr;
                        if (parseReportDate(dashboardRangeEnd) < parseReportDate(dashboardRangeStart)) dashboardRangeEnd = thisDateStr;
                    } else {
                        dashboardRangeEnd = thisDateStr;
                        if (parseReportDate(dashboardRangeEnd) < parseReportDate(dashboardRangeStart)) dashboardRangeStart = thisDateStr;
                    }
                    renderDashboard();
                }
                else if (target.startsWith('finance')) renderFinance();
                else if (target.startsWith('clients')) renderClients(currentClientsTab);
                else renderTeam();
                return;
            }
            if (calendarTargetInputId === 'newBookingDate' || calendarTargetInputId === 'waitlistDate') {
                const target = document.getElementById(calendarTargetInputId);
                if (target) target.value = thisDateStr;
                calendarTargetInputId = null;
                if (target?.id === 'newBookingDate') renderAvailableBookingSlots();
            } else {
                const display = document.getElementById('customDateDisplay');
                if (display) display.innerText = selectedBlockDate;
            }
            closeModal('calendarModal');
        };
        grid.appendChild(dayDiv);
    }
}

function changeMonth(delta) {
    pickerMonth += delta;
    if (pickerMonth < 0) {
        pickerMonth = 11;
        pickerYear--;
    } else if (pickerMonth > 11) {
        pickerMonth = 0;
        pickerYear++;
    }
    renderCalendar();
}




function moveBookingToSlot(event, barberId, date) {
    if (!requireAdminAction('Перемещать записи может только Али')) return;
    const bookingId = event.dataTransfer?.getData('text/plain');
    const booking = bookings.find(item => String(item.id) === String(bookingId));
    if (!booking || !isBookingBlockingSchedule(booking)) return;
    const staffAllowed = currentUser?.role === 'admin' || String(currentUser?.id) === String(barberId);
    if (!staffAllowed || !mockStaff.some(person => String(person.id) === String(barberId))) return;
    const track = event.currentTarget;
    const rect = track.getBoundingClientRect();
    const slotIndex = Math.max(0, Math.floor((event.clientY - rect.top) / 24));
    const start = 8 * 60 + slotIndex * 15;
    const duration = getBookingDurationMinutes(booking);
    const end = start + duration;
    if (start < 8 * 60 || end > 22 * 60) return showToast('Запись должна завершаться не позже 22:00', 'error');
    if (!isWithinBarberWorkSchedule(barberId,date,start,end)) return showToast('Это время вне рабочего графика мастера','error');
    const time = `${String(Math.floor(start / 60)).padStart(2,'0')}:${String(start % 60).padStart(2,'0')}`;
    const overlaps = (a,b,c,d) => a < d && b > c;
    const conflict = bookings.find(other => {
        if (String(other.id) === String(booking.id) || other.date !== date || String(other.barberId) !== String(barberId) || !isBookingBlockingSchedule(other)) return false;
        const otherStart = parseScheduleTimeMinutes(other.time);
        return otherStart !== null && overlaps(start,end,otherStart,otherStart+getBookingDurationMinutes(other));
    });
    if (conflict) return showToast(`У мастера уже есть запись в ${conflict.time}`, 'error');
    const block = timeBlocks.find(item => {
        if (item.date !== date || String(item.barberId) !== String(barberId)) return false;
        const blockStart = parseScheduleTimeMinutes(item.startTime);
        const blockEnd = parseScheduleTimeMinutes(item.endTime);
        return blockStart !== null && blockEnd !== null && overlaps(start,end,blockStart,blockEnd);
    });
    if (block) return showToast('Это время занято перерывом', 'error');
    booking.date = date;
    booking.barberId = String(barberId);
    booking.time = time;
    localStorage.setItem(appStorageKey('mensfire_admin_bookings'), JSON.stringify(bookings));
    selectedScheduleDate = date;
    renderSchedule();
    showToast('Запись перенесена', 'success');
}

function openNewBookingFromSlot(event, barberId, date) {
    if (!requireAdminAction('Создавать записи может только Али')) return;
    if (currentScheduleTab !== 'bookings') return;

    const track = event.currentTarget;
    const rect = track.getBoundingClientRect();

    const SLOT_HEIGHT = 24;
    const START_HOUR = 8;

    const offsetY = Math.max(0, event.clientY - rect.top);
    const slotIndex = Math.floor(offsetY / SLOT_HEIGHT);

    const totalMinutes = START_HOUR * 60 + slotIndex * 15;
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    if (totalMinutes + 45 > 22 * 60) {
        showToast('На это время нельзя поставить запись', 'error');
        return;
    }

    const time = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;

    openNewBookingModal(barberId, time, date);
}



let activeTimePickerInputId = null;
let calendarTargetInputId = null;

function openTimePicker(inputId) {
    const input = document.getElementById(inputId);
    const grid = document.getElementById('timePickerGrid');
    if (!input || !grid) return;
    activeTimePickerInputId = inputId;
    const current = input.value || '10:00';
    grid.innerHTML = '';
    for (let minutes = 8 * 60; minutes <= 21 * 60 + 45; minutes += 15) {
        const value = String(Math.floor(minutes / 60)).padStart(2, '0') + ':' + String(minutes % 60).padStart(2, '0');
        const option = document.createElement('button');
        option.type = 'button';
        option.className = 'time-picker-option' + (value === current ? ' is-selected' : '');
        option.textContent = value;
        option.onclick = () => selectTimePickerValue(value);
        grid.appendChild(option);
    }
    openModal('timePickerModal');
}

function selectTimePickerValue(value) {
    const input = document.getElementById(activeTimePickerInputId);
    if (!input) return;
    if (inputIdIsBookingTime(activeTimePickerInputId) && input.max && value > input.max) {
        return showToast('Это время не подходит для выбранной длительности услуг', 'error');
    }
    input.value = value;
    input.dispatchEvent(new Event('change', { bubbles: true }));
    if (activeTimePickerInputId === 'newBookingTime') renderAvailableBookingSlots();
    closeModal('timePickerModal');
}

function inputIdIsBookingTime(inputId) {
    return inputId === 'newBookingTime';
}

function setBookingPaymentMethod(method) {
    const select = document.getElementById('bookingPaymentMethod');
    if (!select || !['cash', 'card', 'transfer', 'online'].includes(method)) return;
    select.value = method;
    document.querySelectorAll('#bookingPaymentMethodChoices .payment-choice').forEach(button => {
        button.classList.toggle('is-selected', button.dataset.method === method);
    });
}

function renderBookingBarberChoices() {
    const select = document.getElementById('newBookingBarber');
    const container = document.getElementById('bookingBarberChoices');
    if (!select || !container) return;

    container.innerHTML = '';
    Array.from(select.options).forEach(option => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'booking-barber-choice' + (option.value === select.value ? ' is-selected' : '');
        button.textContent = option.textContent;
        button.setAttribute('aria-pressed', option.value === select.value ? 'true' : 'false');
        button.addEventListener('click', () => {
            select.value = option.value;
            renderBookingBarberChoices();
            updateNewBookingServices();
        });
        container.appendChild(button);
    });
}

function openNewBookingModal(barberId = '', time = '', date = selectedScheduleDate) {
    if (!requireAdminAction('Создавать записи может только Али')) return;
    editingBookingId = null;
    editingWaitlistId = null;

    document.querySelector('#newBookingModal h2').textContent = 'Новая запись';
    document.querySelector('#newBookingModal .checkout-btn').textContent = 'Создать запись';
    const barberSelect = document.getElementById('newBookingBarber');
    const dateInput = document.getElementById('newBookingDate');
    const timeInput = document.getElementById('newBookingTime');
    const clientInput = document.getElementById('newBookingClient');

    if (!barberSelect || !dateInput || !timeInput || !clientInput) return;

    const availableStaff = currentUser.role === 'admin'
        ? mockStaff
        : mockStaff.filter(s => s.id === currentUser.id);

    barberSelect.innerHTML = availableStaff.map(s =>
        `<option value="${s.id}">${s.name}</option>`
    ).join('');

    const defaultBarber = barberId || currentUser.id;
    if (availableStaff.some(s => s.id === defaultBarber)) {
        barberSelect.value = defaultBarber;
    }
    renderBookingBarberChoices();

    const parts = date.split('.');
    dateInput.value = parts.length === 3 ? date : '';

    timeInput.value = time || '10:00';
    clientInput.value = '';
    const phoneInput = document.getElementById('newBookingClientPhone');
    if (phoneInput) phoneInput.value = '';
    const lookup = document.getElementById('bookingClientLookup');
    if (lookup) lookup.innerHTML = '';

    updateNewBookingServices();
    openModal('newBookingModal');
}


function lookupBookingClientByPhone() {
    const phoneInput=document.getElementById('newBookingClientPhone');
    const host=document.getElementById('bookingClientLookup');
    if(!phoneInput||!host)return;
    const phone=normalizeClientPhone(phoneInput.value);
    if(phone.length<7){host.innerHTML='';return}
    const matches=[];
    const seen=new Set();
    Object.entries(clientProfiles).forEach(([key,profile])=>{
        if(normalizeClientPhone(profile?.phone)!==phone)return;
        const identity=String(profile.clientName||profile.name||key);
        if(seen.has(identity))return;
        seen.add(identity);
        matches.push({key,profile});
    });
    if(!matches.length){
        host.innerHTML='<div class="booking-client-lookup-new">Новый номер — клиент будет добавлен в CRM после создания записи</div>';
        return;
    }
    const match=matches[0];
    const clientName=String(match.profile.clientName||match.profile.name||'').trim();
    const visitBookings=bookings.filter(booking=>{
        const profile=findClientProfile(booking.clientName||'',booking.barberId||'').profile;
        return normalizeClientPhone(profile.phone)===phone;
    });
    const completed=visitBookings.filter(booking=>booking.status==='completed').length;
    const last=visitBookings.slice().sort((a,b)=>{
        const pa=parseReportDate(a.date),pb=parseReportDate(b.date);
        return (pb?.getTime()||0)-(pa?.getTime()||0);
    })[0];
    if(clientName)document.getElementById('newBookingClient').value=clientName;
    host.innerHTML='<button type="button" class="booking-client-match" onclick="applyBookingClientMatch(\''+String(match.key).replace(/\\/g,'\\\\').replace(/'/g,"\\'")+'\')"><span class="booking-client-match-icon">✓</span><span class="booking-client-match-copy"><strong>'+escapeBookingHtml(clientName||'Клиент найден')+'</strong><small>В CRM · '+completed+' завершённых визитов'+(last?' · последний '+escapeBookingHtml(last.date):'')+'</small></span><span class="booking-client-match-tag">'+(completed?'Повторный':'Есть профиль')+'</span></button>';
}
function applyBookingClientMatch(key) {
    const profile=clientProfiles[key];
    if(!profile)return;
    const name=String(profile.clientName||profile.name||'').trim();
    if(name)document.getElementById('newBookingClient').value=name;
    const phone=document.getElementById('newBookingClientPhone');
    if(phone)phone.value=profile.phone||phone.value;
    const host=document.getElementById('bookingClientLookup');
    if(host)host.innerHTML='<div class="booking-client-lookup-new">Профиль клиента выбран</div>';
}

function updateNewBookingServices() {
    const barberId = document.getElementById('newBookingBarber')?.value;
    const container = document.getElementById('newBookingServicesList');
    if (!barberId || !container) return;

    const catalog = (barberId === 'b_al' ? servicesData.top : servicesData.barber).filter(service => service.active !== false);

    container.innerHTML = catalog.map(service => `
        <label class="new-booking-service-option">
            <input type="checkbox"
                value="${escapeBookingHtml(String(service.id))}"
                onchange="updateNewBookingSummary()">
            <span>${escapeBookingHtml(service.title)}</span>
            <strong>${(Number(service.price) || 0).toLocaleString('ru-RU')} ₽ · ${getServiceDurationMinutes(service)} мин.</strong>
        </label>
    `).join('');

    updateNewBookingSummary();
}

function updateNewBookingSummary() {
    const barberId = document.getElementById('newBookingBarber')?.value;
    const container = document.getElementById('newBookingServicesList');
    if (!barberId || !container) return;

    const catalog = (barberId === 'b_al' ? servicesData.top : servicesData.barber).filter(service => service.active !== false);

    const selectedIds = [...container.querySelectorAll('input:checked')]
        .map(input => input.value);

    const selected = catalog.filter(s => selectedIds.includes(String(s.id)));
    const duration = selected.reduce((sum, service) => sum + getServiceDurationMinutes(service), 0);
    const price = selected.reduce((sum, s) => sum + Number(s.price || 0), 0);

    document.getElementById('newBookingDuration').textContent =
        `${duration} минут`;

    document.getElementById('newBookingPrice').textContent =
        `${price.toLocaleString('ru-RU')} ₽`;

    renderAvailableBookingSlots();

    // Ограничиваем последнее допустимое время начала так, чтобы все услуги
    // завершались до закрытия расписания в 22:00.
    const timeInput = document.getElementById('newBookingTime');
    if (timeInput) {
        const latestStart = Math.max(8 * 60, 22 * 60 - duration);
        const maxHours = String(Math.floor(latestStart / 60)).padStart(2, '0');
        const maxMinutes = String(latestStart % 60).padStart(2, '0');
        timeInput.max = `${maxHours}:${maxMinutes}`;
        if (timeInput.value && timeInput.value > timeInput.max) {
            timeInput.setCustomValidity('Выбранное время не подходит для длительности услуг');
        } else {
            timeInput.setCustomValidity('');
        }
    }
}



function renderAvailableBookingSlots() {
    const host=document.getElementById('availableSlotsList');
    if(!host)return;
    const barberId=document.getElementById('newBookingBarber')?.value;
    const dateValue=document.getElementById('newBookingDate')?.value;
    const container=document.getElementById('newBookingServicesList');
    const timeInput=document.getElementById('newBookingTime');
    if(!barberId||!dateValue||!container){host.innerHTML='<div class="available-slots-empty">Выберите мастера и дату</div>';return}
    const catalog=(barberId==='b_al'?servicesData.top:servicesData.barber).filter(service=>service.active!==false);
    const selectedIds=[...container.querySelectorAll('input:checked')].map(input=>input.value);
    const duration=catalog.filter(service=>selectedIds.includes(String(service.id))).reduce((sum,service)=>sum+getServiceDurationMinutes(service),0);
    if(!duration){host.innerHTML='<div class="available-slots-empty">Сначала выберите услуги</div>';return}
    if(!parseReportDate(dateValue)){host.innerHTML='<div class="available-slots-empty">Выберите корректную дату</div>';return}
    const overlaps=(a,b,c,d)=>a<d&&b>c;
    const workDay=getBarberWorkDay(barberId,dateValue);
    if(!workDay.enabled){host.innerHTML='<div class="available-slots-empty">У мастера выходной в этот день</div>';return}
    const workStart=parseScheduleTimeMinutes(workDay.start),workEnd=parseScheduleTimeMinutes(workDay.end);
    if(workStart===null||workEnd===null||workStart>=workEnd){host.innerHTML='<div class="available-slots-empty">Рабочий график не настроен корректно</div>';return}
    const busyBookings=bookings.filter(booking=>booking.date===dateValue&&String(booking.barberId)===String(barberId)&&String(booking.id)!==String(editingBookingId)&&isBookingBlockingSchedule(booking)).map(booking=>{const start=parseScheduleTimeMinutes(booking.time);return start===null?null:{start,end:start+getBookingDurationMinutes(booking)}}).filter(Boolean);
    const busyBlocks=timeBlocks.filter(block=>block.date===dateValue&&String(block.barberId)===String(barberId)).map(block=>({start:parseScheduleTimeMinutes(block.startTime),end:parseScheduleTimeMinutes(block.endTime)})).filter(block=>block.start!==null&&block.end!==null&&block.start<block.end);
    const slots=[];
    for(let start=Math.ceil(workStart/15)*15;start+duration<=workEnd;start+=15){
        const end=start+duration;
        if(busyBookings.some(item=>overlaps(start,end,item.start,item.end)))continue;
        if(busyBlocks.some(item=>overlaps(start,end,item.start,item.end)))continue;
        slots.push(start);
    }
    if(!slots.length){host.innerHTML='<div class="available-slots-empty">Свободных окон для выбранной длительности нет</div>';return}
    host.innerHTML=slots.map(start=>{
        const value=String(Math.floor(start/60)).padStart(2,'0')+':'+String(start%60).padStart(2,'0');
        return "<button type='button' class='available-slot "+(timeInput?.value===value?'is-selected':'')+"' onclick='selectAvailableBookingSlot(\""+value+"\")'>"+value+"</button>";
    }).join('');
}
function selectAvailableBookingSlot(value) {
    const input=document.getElementById('newBookingTime');
    if(!input)return;
    input.value=value;
    input.setCustomValidity('');
    renderAvailableBookingSlots();
}

function parseScheduleTimeMinutes(value) {
    if (typeof value !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return null;
    const [hours, minutes] = value.split(':').map(Number);
    return hours * 60 + minutes;
}

function getServiceDurationMinutes(service) {
    const duration = Number(service?.duration);
    return Number.isFinite(duration) && Number.isInteger(duration) && duration > 0
        ? duration
        : 45;
}

function getBookingDurationMinutes(booking) {
    const services = Array.isArray(booking?.services) ? booking.services : [];
    return services.reduce((sum, service) => sum + getServiceDurationMinutes(service), 0) || 45;
}

function isBookingBlockingSchedule(booking) {
    // Старые записи используют статус active; новые статусы также должны
    // занимать время мастера до завершения или отмены.
    return ['active', 'pending', 'confirmed'].includes(booking?.status || 'active');
}

function saveNewBooking() {
    if (!requireAdminAction('Создавать и изменять записи может только Али')) return;
    const clientName = document.getElementById('newBookingClient').value.trim();
    const barberId = document.getElementById('newBookingBarber').value;
    const dateValue = document.getElementById('newBookingDate').value;
    const time = document.getElementById('newBookingTime').value;
    const container = document.getElementById('newBookingServicesList');

    const catalog = (barberId === 'b_al' ? servicesData.top : servicesData.barber).filter(service => service.active !== false);

    const selectedIds = [...container.querySelectorAll('input:checked')]
        .map(input => input.value);

    const selectedServices = catalog.filter(s => selectedIds.includes(String(s.id)));

    if (!clientName || !barberId || !dateValue || !time || !selectedServices.length) {
        return showToast('Укажите клиента, мастера, услуги, дату и время', 'error');
    }

    const [day, month, year] = dateValue.split('.').map(Number);
    const date = `${String(day).padStart(2, '0')}.${String(month).padStart(2, '0')}.${year}`;

    const parsedDate = new Date(year, month - 1, day);
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time) ||
        !/^\d{2}\.\d{2}\.\d{4}$/.test(dateValue) ||
        Number.isNaN(parsedDate.getTime()) ||
        parsedDate.getFullYear() !== year ||
        parsedDate.getMonth() + 1 !== month ||
        parsedDate.getDate() !== day) {
        return showToast('Укажите корректные дату и время записи', 'error');
    }

    const [hours, minutes] = time.split(':').map(Number);
    const start = hours * 60 + minutes;
    const duration = selectedServices.reduce((sum, service) => sum + getServiceDurationMinutes(service), 0);
    const end = start + duration;

    if (start < 8 * 60 || end > 22 * 60) {
        return showToast('Запись должна завершаться не позже 22:00', 'error');
    }
    if (!isWithinBarberWorkSchedule(barberId,date,start,end)) return showToast('Это время вне рабочего графика мастера','error');

    const overlaps = (aStart, aEnd, bStart, bEnd) =>
        aStart < bEnd && aEnd > bStart;

    const bookingConflict = bookings.some(b => {
        if (String(b.id) === String(editingBookingId)) return false;

        if (b.date !== date || String(b.barberId) !== String(barberId) || !isBookingBlockingSchedule(b)) {
            return false;
        }

        const bStart = parseScheduleTimeMinutes(b.time);
        if (bStart === null) return false;
        const bDuration = getBookingDurationMinutes(b);

        return overlaps(start, end, bStart, bStart + bDuration);
    });

    if (bookingConflict) {
        return showToast('У мастера уже есть запись на это время', 'error');
    }

    const blockConflict = timeBlocks.some(block => {
        if (block.date !== date || String(block.barberId) !== String(barberId)) return false;

        const blockStart = parseScheduleTimeMinutes(block.startTime);
        const blockEnd = parseScheduleTimeMinutes(block.endTime);
        if (blockStart === null || blockEnd === null || blockStart >= blockEnd) return false;

        return overlaps(start, end, blockStart, blockEnd);
    });

    if (blockConflict) {
        return showToast('Это время занято перерывом', 'error');
    }

    const wasEditing = Boolean(editingBookingId);
    const existingBooking = wasEditing
        ? bookings.find(b => String(b.id) === String(editingBookingId))
        : null;

    if (wasEditing && !existingBooking) {
        return showToast('Запись не найдена', 'error');
    }

    const newTotal = selectedServices.reduce((sum, service) =>
        sum + (Number(service.price) || 0), 0);
    if (existingBooking) {
        const previousTotal = (Array.isArray(existingBooking.services) ? existingBooking.services : [])
            .reduce((sum, service) => sum + (Number(service.price) || 0), 0);
        const alreadyPaid = getBookingPaymentState(existingBooking, previousTotal).paid;
        if (newTotal < alreadyPaid) {
            return showToast(
                `Новая стоимость не может быть меньше уже внесённой суммы ${alreadyPaid.toLocaleString('ru-RU')} ₽`,
                'error'
            );
        }
    }

    const clientPhone = document.getElementById('newBookingClientPhone')?.value.trim() || '';
    const bookingData = {
        barberId,
        clientName,
        clientPhone,
        time,
        date,
        services: selectedServices.map(s => ({ ...s }))
    };

    if (existingBooking) {
        Object.assign(existingBooking, bookingData);
    } else {
        bookings.push({
            id: Date.now(),
            ...bookingData,
            status: 'active',
            paidAmount: 0,
            payments: [],
            paymentMethod: '',
            bookingSource: 'admin_panel'
        });
    }

    const normalizedClientPhone = normalizeClientPhone(clientPhone);
    if (normalizedClientPhone.length >= 7) {
        const profileKey = 'phone:' + normalizedClientPhone;
        const previousProfile = clientProfiles[profileKey] || {};
        const updatedProfile = { ...previousProfile, clientName, barberId, phone: clientPhone };
        clientProfiles[profileKey] = updatedProfile;
        clientProfiles[JSON.stringify([clientName, barberId])] = {
            ...(clientProfiles[JSON.stringify([clientName, barberId])] || {}),
            ...updatedProfile
        };
        localStorage.setItem(appStorageKey('mensfire_client_profiles'), JSON.stringify(clientProfiles));
    }

    editingBookingId = null;

    localStorage.setItem(appStorageKey('mensfire_admin_bookings'), JSON.stringify(bookings));
    if (!wasEditing && editingWaitlistId) {
        waitlistEntries = waitlistEntries.filter(item => String(item.id) !== String(editingWaitlistId));
        editingWaitlistId = null;
        persistWaitlist();
        renderWaitlist();
    }

    selectedScheduleDate = date;
    closeModal('newBookingModal');
    renderSchedule();
    showToast(
    wasEditing ? 'Изменения сохранены' : 'Запись успешно создана',
        'success'
    );
}




function toggleBlockAllDay() {
    const allDay = Boolean(document.getElementById('blockAllDay')?.checked);
    ['blockStartTime','blockEndTime'].forEach(id => {
        const input = document.getElementById(id);
        if (input) { input.disabled = allDay; input.classList.toggle('is-disabled', allDay); if (allDay) input.value = ''; }
    });
}
function addTimeBlock() {
    if (!requireAdminAction('Создавать и изменять перерывы может только Али')) return;
    const allDay = Boolean(document.getElementById('blockAllDay')?.checked);
    const repeatWeekly = Boolean(document.getElementById('blockRepeatWeekly')?.checked) && !editingBlockId;
    const start = allDay ? '08:00' : document.getElementById('blockStartTime').value;
    const end = allDay ? '22:00' : document.getElementById('blockEndTime').value;
    const date = selectedBlockDate;
    const barberId = currentUser.role === 'admin' ? document.getElementById('blockBarberSelect').value : currentUser.id;
    if (!start || !end || !date || !barberId) return showToast('Укажите мастера, дату и время', 'error');
    const toMinutes = value => { const [h,m] = value.split(':').map(Number); return h*60+m; };
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(start) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(end)) return showToast('Укажите корректное время начала и окончания','error');
    const newStart=toMinutes(start),newEnd=toMinutes(end);
    if (newStart>=newEnd) return showToast('Время окончания должно быть позже начала','error');
    if (newStart<8*60||newEnd>22*60) return showToast('Перерыв должен быть в пределах 08:00–22:00','error');
    const overlaps=(a,b,c,d)=>a<d&&b>c;
    const baseDate=parseReportDate(date);
    if(!baseDate) return showToast('Укажите корректную дату','error');
    const targetDates=Array.from({length:repeatWeekly?12:1},(_,index)=>{const d=new Date(baseDate);d.setDate(d.getDate()+index*7);return formatReportDate(d)});
    const conflicts=[];
    for(const targetDate of targetDates){
        const bookingConflict=bookings.find(b=>b.date===targetDate&&String(b.barberId)===String(barberId)&&isBookingBlockingSchedule(b)&&(()=>{const s=parseScheduleTimeMinutes(b.time);return s!==null&&overlaps(newStart,newEnd,s,s+getBookingDurationMinutes(b))})());
        if(bookingConflict){conflicts.push({date:targetDate,message:'запись в '+bookingConflict.time});continue}
        const blockConflict=timeBlocks.find(block=>block.date===targetDate&&String(block.barberId)===String(barberId)&&(!editingBlockId||String(block.id)!==String(editingBlockId))&&(()=>{const s=parseScheduleTimeMinutes(block.startTime),e=parseScheduleTimeMinutes(block.endTime);return s!==null&&e!==null&&s<e&&overlaps(newStart,newEnd,s,e)})());
        if(blockConflict) conflicts.push({date:targetDate,message:'другой перерыв'});
    }
    if(conflicts.length) return showToast('Есть конфликт: '+conflicts[0].date+' — '+conflicts[0].message,'error');
    if(editingBlockId){
        const block=timeBlocks.find(b=>String(b.id)===String(editingBlockId));
        if(!block) return showToast('Перерыв не найден','error');
        Object.assign(block,{date,barberId,startTime:start,endTime:end,allDay});
    }else{
        const groupId=repeatWeekly?'repeat-'+Date.now():null;
        targetDates.forEach((targetDate,index)=>timeBlocks.push({id:'block-'+Date.now()+'-'+index,barberId,date:targetDate,startTime:start,endTime:end,allDay,repeatGroup:groupId}));
    }
    localStorage.setItem(appStorageKey('mensfire_admin_blocks'),JSON.stringify(timeBlocks));
    closeModal('blockTimeModal');
    showToast(editingBlockId?'Перерыв обновлён':repeatWeekly?'График добавлен на 12 недель':allDay?'Выходной добавлен':'Перерыв добавлен','success');
    editingBlockId=null;
    renderSchedule();
}

// --- УПРАВЛЕНИЕ БЛОКИРОВКОЙ ---
function openBlockActionModal(id) {
    if (!requireAdminAction('Управлять перерывами может только Али')) return;
    editingBlockId = id;
    openModal('blockActionModal');
}

function editTimeBlock() {
    if (!requireAdminAction('Изменять перерывы может только Али')) return;
    const block = timeBlocks.find(tb => String(tb.id) === String(editingBlockId));
    if (!block) return;

    // Заполняем поля данными из блокировки
    selectedBlockDate = block.date;
    updateBlockBarberSelect(block.barberId);
    document.getElementById('customDateDisplay').innerText = block.date;
    
    // Устанавливаем даты в календаре
    const parts = block.date.split('.');
    pickerYear = parseInt(parts[2]);
    pickerMonth = parseInt(parts[1]) - 1;

    document.getElementById('blockStartTime').value = block.startTime;
    document.getElementById('blockEndTime').value = block.endTime;
    document.getElementById('blockAllDay').checked = Boolean(block.allDay);
    document.getElementById('blockRepeatWeekly').checked = false;
    toggleBlockAllDay();

    // Меняем заголовок и кнопку на "Редактирование"
    document.querySelector('#blockTimeModal h2').innerText = 'Редактирование перерыва';
    document.querySelector('#blockTimeModal .checkout-btn').innerText = 'Сохранить изменения';

    closeModal('blockActionModal');
    openModal('blockTimeModal');
}

function deleteTimeBlock() {
    if (!requireAdminAction('Удалять перерывы может только Али')) return;
    showConfirm(
        'Удалить перерыв?', 
        'Это действие нельзя отменить.', 
        'Да, удалить', 
        () => {
            timeBlocks = timeBlocks.filter(tb => String(tb.id) !== String(editingBlockId));
            localStorage.setItem(appStorageKey('mensfire_admin_blocks'), JSON.stringify(timeBlocks));
            closeModal('blockActionModal');
            showToast('Перерыв удален', 'success');
            renderSchedule();
        }
    );
}

function switchFinanceTab(tab) {
    if (!requireAdminAction('Просматривать финансы может только Али')) return;
    currentFinanceTab = tab;
    document.getElementById('tabFinExpenses').classList.toggle('active', tab === 'expenses');
    document.getElementById('tabFinRevenue').classList.toggle('active', tab === 'revenue');
    document.getElementById('tabFinAnalytics').classList.toggle('active', tab === 'analytics');

    document.getElementById('finTabExpenses').style.display = tab === 'expenses' ? 'block' : 'none';
    document.getElementById('finTabRevenue').style.display = tab === 'revenue' ? 'flex' : 'none';
    document.getElementById('finTabAnalytics').style.display = tab === 'analytics' ? 'block' : 'none';

    renderFinance();
}

function parseReportDate(value) {
    const parts = String(value || '').split('.').map(Number);
    if (parts.length !== 3 || !parts.every(Number.isInteger)) return null;
    const [day, month, year] = parts;
    if (day < 1 || day > 31 || month < 1 || month > 12 || year < 1000) return null;
    const date = new Date(year, month - 1, day);
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
    date.setHours(0,0,0,0);
    return Number.isFinite(date.getTime()) ? date : null;
}
function formatReportDate(date) { return date.toLocaleDateString('ru-RU'); }
function openReportDatePicker(target) {
    calendarTargetInputId = null;
    reportDatePickerTarget = target;
    const value = target === 'dashboardDay' ? dashboardSelectedDate : target === 'dashboardStart' ? dashboardRangeStart : target === 'dashboardEnd' ? dashboardRangeEnd : target === 'financeStart' ? financeRangeStart : target === 'financeEnd' ? financeRangeEnd : target === 'clientsStart' ? clientsRangeStart : target === 'clientsEnd' ? clientsRangeEnd : target === 'teamStart' ? teamRangeStart : teamRangeEnd;
    const date = parseReportDate(value) || new Date();
    selectedBlockDate = formatReportDate(date);
    pickerYear = date.getFullYear();
    pickerMonth = date.getMonth();
    renderCalendar();
    openModal('calendarModal');
}
function setFinancePeriod(mode) {
    if (!['day','month','custom'].includes(mode)) return;
    financePeriodMode = mode;
    if (mode === 'month') {
        const selected = parseReportDate(selectedFinanceDate) || new Date();
        financeRangeStart = formatReportDate(new Date(selected.getFullYear(),selected.getMonth(),1));
        financeRangeEnd = formatReportDate(new Date(selected.getFullYear(),selected.getMonth()+1,0));
    } else if (mode === 'custom') {
        if (!parseReportDate(financeRangeStart) || !parseReportDate(financeRangeEnd)) {
            financeRangeStart = formatReportDate(new Date(new Date().getFullYear(),new Date().getMonth(),1));
            financeRangeEnd = formatReportDate(new Date());
        }
    }
    renderFinance();
}
function setClientsPeriod(mode) {
    if (!['sixMonths','month','custom'].includes(mode)) return;
    clientsPeriodMode = mode;
    if (mode === 'month') {
        const now = new Date();
        clientsRangeStart = formatReportDate(new Date(now.getFullYear(),now.getMonth(),1));
        clientsRangeEnd = formatReportDate(new Date());
    } else if (mode === 'sixMonths') {
        const now = new Date();
        clientsRangeStart = formatReportDate(new Date(now.getFullYear(),now.getMonth()-5,1));
        clientsRangeEnd = formatReportDate(new Date());
    } else if (!parseReportDate(clientsRangeStart) || !parseReportDate(clientsRangeEnd)) {
        const now = new Date();
        clientsRangeStart = formatReportDate(new Date(now.getFullYear(),now.getMonth(),1));
        clientsRangeEnd = formatReportDate(now);
    }
    renderClients(currentClientsTab);
}
function setTeamPeriod(mode) {
    if (!['month','custom'].includes(mode)) return;
    teamPeriodMode = mode;
    if (mode === 'month') {
        const now = new Date();
        teamRangeStart = formatReportDate(new Date(now.getFullYear(),now.getMonth(),1));
        teamRangeEnd = formatReportDate(now);
    } else if (!parseReportDate(teamRangeStart) || !parseReportDate(teamRangeEnd)) {
        const now = new Date();
        teamRangeStart = formatReportDate(new Date(now.getFullYear(),now.getMonth(),1));
        teamRangeEnd = formatReportDate(now);
    }
    renderTeam();
}

function setDashboardPeriod(mode) {
    if (!['day','month','custom'].includes(mode)) return;
    dashboardPeriodMode = mode;
    const selected = parseReportDate(dashboardSelectedDate) || new Date();
    if (mode === 'day') {
        dashboardRangeStart = dashboardRangeEnd = formatReportDate(selected);
    } else if (mode === 'month') {
        dashboardRangeStart = formatReportDate(new Date(selected.getFullYear(), selected.getMonth(), 1));
        dashboardRangeEnd = formatReportDate(new Date(selected.getFullYear(), selected.getMonth() + 1, 0));
    } else if (!parseReportDate(dashboardRangeStart) || !parseReportDate(dashboardRangeEnd)) {
        dashboardRangeStart = formatReportDate(new Date(selected.getFullYear(), selected.getMonth(), 1));
        dashboardRangeEnd = formatReportDate(selected);
    }
    renderDashboard();
}
function dashboardEscape(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
}
function renderDashboard() {
    if (!currentUser) return;
    const controls = document.getElementById('dashboardPeriodControls');
    const rangeStart = parseReportDate(dashboardRangeStart) || new Date();
    const rangeEndDate = parseReportDate(dashboardRangeEnd) || rangeStart;
    rangeStart.setHours(0,0,0,0);
    rangeEndDate.setHours(0,0,0,0);
    const endExclusive = new Date(rangeEndDate); endExclusive.setDate(endExclusive.getDate()+1);
    const startKey = formatReportDate(rangeStart), endKey = formatReportDate(rangeEndDate);
    const inRange = value => { const date = parseReportDate(value); return !!date && date >= rangeStart && date < endExclusive; };
    const periodLabel = startKey === endKey ? startKey : startKey + ' — ' + endKey;
    if (controls) controls.innerHTML = `
        <div class="finance-range-toolbar clients-range-toolbar">
            <div class="finance-range-presets" role="group" aria-label="Период главной панели">
                <button type="button" class="finance-range-btn ${dashboardPeriodMode==='day'?'active':''}" onclick="setDashboardPeriod('day')">День</button>
                <button type="button" class="finance-range-btn ${dashboardPeriodMode==='month'?'active':''}" onclick="setDashboardPeriod('month')">Месяц</button>
                <button type="button" class="finance-range-btn ${dashboardPeriodMode==='custom'?'active':''}" onclick="setDashboardPeriod('custom')">Период</button>
            </div>
            ${dashboardPeriodMode==='day' ? `<div class="finance-range-fields"><button type="button" class="finance-range-date" onclick="openReportDatePicker('dashboardDay')">${dashboardEscape(startKey)}</button></div>` : dashboardPeriodMode==='custom' ? `<div class="finance-range-fields"><button type="button" class="finance-range-date" onclick="openReportDatePicker('dashboardStart')">${dashboardEscape(startKey)}</button><span>—</span><button type="button" class="finance-range-date" onclick="openReportDatePicker('dashboardEnd')">${dashboardEscape(endKey)}</button></div>` : ''}
        </div>`;
    const scoped = bookings.filter(item => inRange(item.date) && item.status !== 'cancelled' && (currentUser.role === 'admin' || String(item.barberId) === String(currentUser.id)));
    const completed = scoped.filter(item => item.status === 'completed');
    const collected = scoped.reduce((sum,item)=>sum+getBookingCollectedAmount(item),0);
    const outstanding = scoped.reduce((sum,item)=>{
        const total=(Array.isArray(item.services)?item.services:[]).reduce((n,s)=>n+Math.max(0,Number(s.price)||0),0);
        return sum+Math.max(0,total-getBookingPaymentState(item,total).paid);
    },0);
    const periodExpenses = currentUser.role === 'admin' ? expenses.filter(item=>inRange(item.date)).reduce((sum,item)=>sum+Math.max(0,Number(item.amount)||0),0) : 0;
    const newClients = completed.filter(item=>getBookingClientType(item)==='new').length;
    const kpis = document.getElementById('dashboardKpis');
    if (kpis) {
        const cards = [
            ['Записей',scoped.length,'Активные и завершённые визиты'],
            ['Завершено',completed.length,'Успешно оказанные услуги'],
            ['Получено',Math.round(collected).toLocaleString('ru-RU')+' ₽','Фактические оплаты'],
            ['К оплате',Math.round(outstanding).toLocaleString('ru-RU')+' ₽','Остаток по записям']
        ];
        if (currentUser.role === 'admin') {
            cards.push(['Расходы',Math.round(periodExpenses).toLocaleString('ru-RU')+' ₽','За выбранный период']);
            cards.push(['Результат',Math.round(collected-periodExpenses).toLocaleString('ru-RU')+' ₽','Получено минус расходы']);
        } else {
            cards.push(['Новые клиенты',newClients,'По завершённым визитам']);
            cards.push(['Средний чек',completed.length?Math.round(completed.reduce((sum,item)=>sum+getBookingCollectedAmount(item),0)/completed.length).toLocaleString('ru-RU')+' ₽':'0 ₽','По завершённым визитам']);
        }
        kpis.innerHTML = cards.map((card,index)=>`<article class="dashboard-kpi-card ${index===2?'is-primary':''}"><span>${dashboardEscape(card[0])}</span><strong>${dashboardEscape(card[1])}</strong><small>${dashboardEscape(card[2])}</small></article>`).join('');
    }
    const chart = document.getElementById('dashboardRevenueChart');
    if (chart) {
        const days = Math.max(1,Math.round((endExclusive-rangeStart)/86400000));
        const bucketCount = days<=1?1:Math.min(7,days);
        const buckets=[];
        for(let i=0;i<bucketCount;i++){
            const from=new Date(rangeStart); from.setDate(from.getDate()+Math.floor(i*days/bucketCount));
            const to=new Date(rangeStart); to.setDate(to.getDate()+Math.floor((i+1)*days/bucketCount));
            if(to<=from)to.setDate(from.getDate()+1);
            const value=scoped.filter(item=>item.status==='completed'&&(()=>{const d=parseReportDate(item.date);return d&&d>=from&&d<to;})()).reduce((sum,item)=>sum+getBookingCollectedAmount(item),0);
            buckets.push({label:days===1?startKey:from.toLocaleDateString('ru-RU',{day:'numeric',month:'short'}),value});
        }
        const max=Math.max(1,...buckets.map(b=>b.value));
        chart.innerHTML='<div class="dashboard-bars">'+buckets.map(b=>`<div class="dashboard-bar-col"><div class="dashboard-bar-track"><i style="height:${Math.max(4,b.value/max*100)}%"></i></div><strong>${Math.round(b.value).toLocaleString('ru-RU')} ₽</strong><span>${dashboardEscape(b.label)}</span></div>`).join('')+'</div>';
        const caption=document.getElementById('dashboardChartCaption'); if(caption)caption.textContent='Оплаченные завершённые визиты · '+periodLabel;
    }
    const mix=document.getElementById('dashboardBookingMix');
    if(mix){
        const counts=[['Завершено',completed.length,'completed'],['Ожидает',scoped.filter(item=>['pending','confirmed','active'].includes(item.status||'active')).length,'pending'],['Частично оплачено',scoped.filter(item=>{const total=(item.services||[]).reduce((n,s)=>n+Number(s.price||0),0);const p=getBookingPaymentState(item,total);return p.status==='partial';}).length,'partial']];
        mix.innerHTML='<div class="dashboard-mix-list">'+counts.map(([label,value,cls])=>`<div class="dashboard-mix-row"><span><i class="${cls}"></i>${label}</span><strong>${value}</strong></div>`).join('')+'</div>';
    }
    const team=document.getElementById('dashboardTeamSnapshot');
    if(team){
        const staff=mockStaff.filter(person=>currentUser.role==='admin'||String(person.id)===String(currentUser.id));
        team.innerHTML=staff.map(person=>{
            const own=scoped.filter(item=>String(item.barberId)===String(person.id));
            const paid=own.reduce((sum,item)=>sum+getBookingCollectedAmount(item),0);
            const visits=own.filter(item=>item.status==='completed').length;
            return `<div class="dashboard-team-row"><span class="dashboard-avatar">${dashboardEscape(person.name.slice(0,1))}</span><div><strong>${dashboardEscape(person.name)}</strong><small>${visits} визитов</small></div><b>${Math.round(paid).toLocaleString('ru-RU')} ₽</b></div>`;
        }).join('')||'<div class="finance-empty">Нет данных за период</div>';
    }
    const upcoming=document.getElementById('dashboardUpcoming');
    if(upcoming){
        const now=new Date();
        const future=scoped.filter(item=>item.status!=='completed'&&(()=>{const d=parseReportDate(item.date);if(!d)return false;const [hh,mm]=String(item.time||'00:00').split(':').map(Number);d.setHours(hh||0,mm||0,0,0);return d>=now;})()).sort((a,b)=>{const da=parseReportDate(a.date),db=parseReportDate(b.date);return da-db||String(a.time||'').localeCompare(String(b.time||''));}).slice(0,5);
        upcoming.innerHTML=future.length?future.map(item=>`<div class="dashboard-upcoming-row"><div class="dashboard-upcoming-time"><strong>${dashboardEscape(item.time||'—')}</strong><small>${dashboardEscape(item.date||'')}</small></div><div class="dashboard-upcoming-info"><strong>${dashboardEscape(item.clientName||'Клиент')}</strong><small>${dashboardEscape(item.services?.map(s=>s.title).join(', ')||'Услуга')} · ${dashboardEscape(mockStaff.find(s=>String(s.id)===String(item.barberId))?.name||'Мастер')}</small></div><span class="dashboard-upcoming-status">${item.status==='pending'?'Ожидает':'Подтверждена'}</span></div>`).join(''):'<div class="finance-empty">Нет предстоящих записей в выбранном периоде</div>';
    }
}

function renderFinanceDateSelector() {
    const container = document.getElementById('financeDateSelector');
    if (!container) return;
    container.innerHTML = '';
    container.classList.toggle('is-hidden', financePeriodMode !== 'day');
    const fields = document.getElementById('financeRangeFields');
    if (fields) fields.hidden = financePeriodMode !== 'custom';
    document.querySelectorAll('[data-finance-period]').forEach(button => button.classList.toggle('active', button.dataset.financePeriod === financePeriodMode));
    const startButton = document.getElementById('financeRangeStartButton');
    const endButton = document.getElementById('financeRangeEndButton');
    if (startButton) startButton.textContent = financeRangeStart;
    if (endButton) endButton.textContent = financeRangeEnd;
    const selectedParts = selectedFinanceDate.split('.').map(Number);
    const base = selectedParts.length === 3 ? new Date(selectedParts[2],selectedParts[1]-1,selectedParts[0]) : new Date();
    base.setHours(0,0,0,0);
    const label = document.getElementById('financeSelectedDateLabel');
    if (label) {
        const today = new Date(); today.setHours(0,0,0,0);
        const sameDay = base.getTime() === today.getTime();
        label.textContent = financePeriodMode === 'day'
            ? (sameDay ? 'Сегодня · ' : '') + base.toLocaleDateString('ru-RU',{weekday:'long',day:'numeric',month:'long',year:'numeric'})
            : financePeriodMode === 'month'
                ? base.toLocaleDateString('ru-RU',{month:'long',year:'numeric'})
                : formatReportDate(parseReportDate(financeRangeStart) || base) + ' — ' + formatReportDate(parseReportDate(financeRangeEnd) || base);
    }
    const days = ['Вс','Пн','Вт','Ср','Чт','Пт','Сб'];
    for (let i = -7; i < 16; i++) {
        const d = new Date(base);
        d.setDate(base.getDate() + i);
        const dateStr = d.toLocaleDateString('ru-RU');
        const today = new Date(); today.setHours(0,0,0,0);
        const isToday = d.getTime() === today.getTime();
        const div = document.createElement('button');
        div.type = 'button';
        div.className = 'date-selector-item' + (selectedFinanceDate === dateStr ? ' selected' : '') + (isToday ? ' is-today' : '');
        div.setAttribute('aria-pressed',String(selectedFinanceDate === dateStr));
        div.innerHTML = '<div class="day-name">' + (isToday ? 'Сегодня' : days[d.getDay()]) + '</div><div class="day-num">' + d.getDate() + '</div>';
        div.onclick = () => { selectedFinanceDate = dateStr; financePeriodMode = 'day'; renderFinance(); };
        container.appendChild(div);
    }
    requestAnimationFrame(() => {
        const selected = container.querySelector('.selected');
        if (selected) selected.scrollIntoView({block:'nearest',inline:'center',behavior:'smooth'});
    });
}

function renderFinance() {
    if (!requireAdminAction('Просматривать финансы может только Али')) return;
    renderFinanceDateSelector();

    const parseDate = value => parseReportDate(value);
    const fmt = value => `${Math.round(Number(value) || 0).toLocaleString('ru-RU')} ₽`;
    const getSafeServiceAmount = service => {
        const amount = Number(service?.price);
        return Number.isFinite(amount) ? Math.max(0, amount) : 0;
    };
    const selectedDate = parseDate(selectedFinanceDate) || new Date();
    selectedDate.setHours(0, 0, 0, 0);
    const dateKey = date => date.toLocaleDateString('ru-RU');
    const shift = (date, days) => { const next = new Date(date); next.setDate(next.getDate() + days); return next; };
    const startOfWeek = date => { const next = new Date(date); next.setDate(next.getDate() - ((next.getDay() + 6) % 7)); return next; };
    const monthStart = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
    const nextMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 1);
    const inRange = (value, start, end) => { const date = parseDate(value); return date && date >= start && date < end; };
    let periodStart = financePeriodMode === 'day' ? selectedDate : parseReportDate(financeRangeStart) || monthStart;
    let periodLastDay = financePeriodMode === 'day' ? selectedDate : parseReportDate(financeRangeEnd) || new Date(selectedDate.getFullYear(),selectedDate.getMonth()+1,0);
    if (financePeriodMode === 'month') {
        periodStart = monthStart;
        periodLastDay = new Date(selectedDate.getFullYear(),selectedDate.getMonth()+1,0);
    }
    if (periodLastDay < periodStart) [periodStart, periodLastDay] = [periodLastDay, periodStart];
    const periodEnd = shift(periodLastDay, 1);
    const periodLabel = financePeriodMode === 'day' ? formatReportDate(selectedDate) : (formatReportDate(periodStart) + ' — ' + formatReportDate(periodLastDay));
    const aggregationStart = financePeriodMode === 'day' ? monthStart : periodStart;
    const aggregationEnd = financePeriodMode === 'day' ? nextMonth : periodEnd;
    const aggregationLabel = financePeriodMode === 'day' ? selectedDate.toLocaleDateString('ru-RU',{month:'long',year:'numeric'}) : periodLabel;
    const dayEnd = shift(selectedDate, 1);
    const weekStart = startOfWeek(selectedDate);
    const weekEnd = shift(weekStart, 7);
    const dayBookings = bookings.filter(item => item.date === selectedFinanceDate && item.status !== 'cancelled');
    const dayCompleted = dayBookings.filter(item => item.status === 'completed');
    const periodCompleted = bookings.filter(item => inRange(item.date, periodStart, periodEnd) && item.status === 'completed');
    const revenue = (start, end) => bookings.filter(item => inRange(item.date, start, end))
        .reduce((sum, item) => sum + getBookingCollectedAmount(item), 0);
    const getSafeExpenseAmount = item => {
        const amount = Number(item?.amount);
        return Number.isFinite(amount) ? Math.max(0, amount) : 0;
    };
    const expensesTotal = (start, end) => expenses.filter(item => inRange(item.date, start, end))
        .reduce((sum, item) => sum + getSafeExpenseAmount(item), 0);
    const dayRevenue = revenue(selectedDate, dayEnd);
    const weekRevenue = revenue(weekStart, weekEnd);
    const monthRevenue = revenue(aggregationStart, aggregationEnd);
    const dayExpenses = financePeriodMode === 'day' ? expenses.filter(item => item.date === selectedFinanceDate) : expenses.filter(item => inRange(item.date, periodStart, periodEnd));
    const dayExpenseTotal = dayExpenses.reduce((sum, item) => sum + getSafeExpenseAmount(item), 0);
    const weekExpenseTotal = expensesTotal(weekStart, weekEnd);
    const monthExpenseTotal = expensesTotal(aggregationStart, aggregationEnd);
    const dayProfit = dayRevenue - dayExpenseTotal;
    const monthProfit = monthRevenue - monthExpenseTotal;
    const activeBookings = bookings.filter(item => item.status !== 'cancelled');
    const unpaidBalance = activeBookings.filter(item => inRange(item.date, periodStart, periodEnd)).reduce((sum, item) => {
        const total = (Array.isArray(item.services) ? item.services : []).reduce((n, service) => n + getSafeServiceAmount(service), 0);
        return sum + Math.max(0, total - getBookingPaymentState(item, total).paid);
    }, 0);
    const paymentTotals = { cash: 0, card: 0, transfer: 0, online: 0, other: 0 };
    bookings.filter(item => inRange(item.date, aggregationStart, aggregationEnd)).forEach(item => {
        const serviceTotal = (Array.isArray(item.services) ? item.services : [])
            .reduce((sum, service) => sum + getSafeServiceAmount(service), 0);
        const transactions = Array.isArray(item.payments) ? item.payments : [];
        let remaining = getBookingCollectedAmount(item);
        if (transactions.length) {
            // Не учитываем дубли/переплаты сверх стоимости заказа и пропускаем некорректные суммы.
            transactions.forEach(payment => {
                const rawAmount = Number(payment?.amount);
                if (!Number.isFinite(rawAmount) || rawAmount <= 0 || remaining <= 0) return;
                const amount = Math.min(rawAmount, remaining, serviceTotal);
                const method = Object.prototype.hasOwnProperty.call(paymentTotals, payment?.method) ? payment.method : 'other';
                paymentTotals[method] += amount;
                remaining -= amount;
            });
        } else if (remaining > 0) {
            const method = Object.prototype.hasOwnProperty.call(paymentTotals, item.paymentMethod) ? item.paymentMethod : 'other';
            paymentTotals[method] += remaining;
        }
    });

    const setText = (id, value) => { const node = document.getElementById(id); if (node) node.textContent = value; };
    setText('financeToday', fmt(dayRevenue));
    setText('financeWeek', fmt(weekRevenue));
    setText('financeMonth', fmt(monthRevenue));
    const monthLabel = document.querySelector('#finTabRevenue .finance-kpi-card:nth-child(3) .finance-kpi-label');
    if (monthLabel) monthLabel.textContent = financePeriodMode === 'day' ? 'Месяц' : 'Период';
    const monthHint = document.querySelector('#finTabRevenue .finance-kpi-card:nth-child(3) small');
    if (monthHint) monthHint.textContent = aggregationLabel;
    setText('financeProfit', fmt(dayProfit));
    setText('profitWeek', fmt(weekRevenue - weekExpenseTotal));
    setText('profitMonth', fmt(monthProfit));
    const profitMonthLabel = document.querySelector('#finTabExpenses .finance-period-metrics > div:nth-child(3) span');
    if (profitMonthLabel) profitMonthLabel.textContent = financePeriodMode === 'day' ? 'За месяц' : 'За период';
    const teamPeriodHint = document.querySelector('#finTabRevenue .finance-panel-heading p');
    if (teamPeriodHint) teamPeriodHint.textContent = 'Поступления и завершённые визиты · ' + aggregationLabel;
    setText('financeMonthExpenses', fmt(monthExpenseTotal));
    const expensePeriodLabel = document.querySelector('#finTabExpenses .finance-total-row span');
    if (expensePeriodLabel) expensePeriodLabel.textContent = financePeriodMode === 'day' ? 'Расходы за месяц' : 'Расходы за период';
    const paymentSubtitle = document.querySelector('#finTabExpenses .finance-panel:nth-child(3) .finance-panel-heading p');
    if (paymentSubtitle) paymentSubtitle.textContent = financePeriodMode === 'day' ? 'Распределение поступлений за месяц' : 'Распределение поступлений за период';

    const expensesList = document.getElementById('expensesList');
    if (expensesList) expensesList.innerHTML = dayExpenses.length ? dayExpenses.map(item => `
        <div class="finance-operation">
            <div class="finance-operation-icon">↗</div>
            <div class="finance-operation-copy"><strong>${escapeBookingHtml(item.title || 'Расход')}</strong><span>${escapeBookingHtml(item.category || 'Операционные расходы')}</span></div>
            <strong class="finance-negative">−${fmt(item.amount)}</strong>
        </div>`).join('') : '<div class="finance-empty">Расходов за выбранный день нет</div>';

    const summary = document.getElementById('financeExecutiveSummary');
    if (summary) summary.innerHTML = `
        <div class="finance-kpi-card finance-kpi-primary"><span class="finance-kpi-label">${financePeriodMode === 'day' ? 'Получено за день' : 'Получено за период'}</span><strong>${fmt(financePeriodMode === 'day' ? dayRevenue : monthRevenue)}</strong><small>${financePeriodMode === 'day' ? dayCompleted.length + ' завершённых визитов' : periodLabel}</small></div>
        <div class="finance-kpi-card"><span class="finance-kpi-label">${financePeriodMode === 'day' ? 'Чистый результат дня' : 'Чистый результат периода'}</span><strong class="${(financePeriodMode === 'day' ? dayProfit : monthProfit) < 0 ? 'finance-negative' : 'finance-positive'}">${fmt(financePeriodMode === 'day' ? dayProfit : monthProfit)}</strong><small>После расходов</small></div>
        <div class="finance-kpi-card"><span class="finance-kpi-label">Ожидает оплаты</span><strong>${fmt(unpaidBalance)}</strong><small>Баланс по активным записям</small></div>
        <div class="finance-kpi-card"><span class="finance-kpi-label">Средний чек</span><strong>${fmt((financePeriodMode === 'day' ? dayCompleted : periodCompleted).length ? (financePeriodMode === 'day' ? dayCompleted : periodCompleted).reduce((sum,b) => sum + (Array.isArray(b.services) ? b.services : []).reduce((n,x) => n + getSafeServiceAmount(x),0),0) / (financePeriodMode === 'day' ? dayCompleted : periodCompleted).length : 0)}</strong><small>По завершённым визитам</small></div>
        <div class="finance-kpi-card finance-kpi-comparison"><span class="finance-kpi-label">${financePeriodMode === 'day' ? 'К прошлому дню' : 'Выбранный период'}</span><strong>${periodLabel}</strong><small>${financePeriodMode === 'day' ? 'Сравнение с предыдущим днём' : 'Интервал для всех расчётов ниже'}</small></div>`;

    const chart = document.getElementById('financeRevenueChart');
    if (chart) {
        const spanDays = Math.round((periodEnd - periodStart) / 86400000);
        const buckets = [];
        if (financePeriodMode === 'day') {
            for (let offset = -6; offset <= 0; offset++) {
                const date = shift(selectedDate,offset);
                buckets.push({start:date,end:shift(date,1),label:date.toLocaleDateString('ru-RU',{day:'2-digit',month:'short'}).replace('.','')});
            }
        } else if (spanDays > 45) {
            const cursor = new Date(periodStart.getFullYear(),periodStart.getMonth(),1);
            while (cursor < periodEnd && buckets.length < 12) {
                const start = new Date(cursor), end = new Date(cursor.getFullYear(),cursor.getMonth()+1,1);
                buckets.push({start,end,label:start.toLocaleDateString('ru-RU',{month:'short',year:'2-digit'}).replace('.','')});
                cursor.setMonth(cursor.getMonth()+1);
            }
        } else {
            const step = spanDays > 7 ? Math.ceil(spanDays / 7) : 1;
            for (let cursor = new Date(periodStart); cursor < periodEnd && buckets.length < 31; cursor = shift(cursor,step)) {
                const end = new Date(Math.min(shift(cursor,step).getTime(),periodEnd.getTime()));
                buckets.push({start:new Date(cursor),end,label:step===7?cursor.toLocaleDateString('ru-RU',{day:'2-digit',month:'short'}).replace('.',''):cursor.toLocaleDateString('ru-RU',{day:'2-digit',month:'short'}).replace('.','')});
            }
        }
        const values = buckets.map(bucket=>revenue(bucket.start,bucket.end));
        const max = Math.max(1,...values);
        chart.innerHTML = `<div class="finance-chart-bars" style="grid-template-columns:repeat(${Math.min(buckets.length,7)},minmax(0,1fr))">${buckets.map((bucket,index) => {
            const height = Math.max(values[index] > 0 ? 5 : 2, values[index] / max * 100);
            return `<div class="finance-chart-column"><strong>${values[index] ? fmt(values[index]) : '—'}</strong><div class="finance-chart-track"><i style="height:${height}%"></i></div><span>${bucket.label}</span></div>`;
        }).join('')}</div>`;
    }

    const methods = document.getElementById('financePaymentMethods');
    if (methods) {
        const labels = {cash:'Наличные',card:'Банковская карта',transfer:'Перевод',online:'Онлайн',other:'Не указан'};
        const total = Object.values(paymentTotals).reduce((sum,value) => sum + value, 0);
        methods.innerHTML = Object.entries(paymentTotals).filter(([,value]) => value > 0).sort((a,b) => b[1]-a[1]).map(([key,value]) => `
            <div class="finance-method-row"><div><span>${labels[key]}</span><strong>${fmt(value)}</strong></div><div class="finance-method-track"><i style="width:${total ? value/total*100 : 0}%"></i></div></div>`
        ).join('') || '<div class="finance-empty">Платежей за этот месяц пока нет</div>';
    }

    const teamStats = document.getElementById('financeTeamStats');
    if (teamStats) {
        const staff = Array.isArray(mockStaff) ? mockStaff : [];
        const teamRows = new Map(staff.map(person => [String(person.id), {
            name: person.name || 'Мастер',
            paid: 0,
            visits: 0
        }]));
        bookings.filter(item => inRange(item.date, aggregationStart, aggregationEnd)).forEach(item => {
            const id = item.barberId == null || item.barberId === '' ? '__unassigned__' : String(item.barberId);
            if (!teamRows.has(id)) {
                teamRows.set(id, {
                    name: id === '__unassigned__' ? 'Без мастера' : 'Мастер из старых записей',
                    paid: 0,
                    visits: 0
                });
            }
            const row = teamRows.get(id);
            row.paid += getBookingCollectedAmount(item);
            if (item.status === 'completed') row.visits += 1;
        });
        const rows = Array.from(teamRows.values()).sort((a,b) => b.paid-a.paid);
        const teamTotal = rows.reduce((sum,person) => sum + person.paid,0);
        teamStats.innerHTML = rows.length ? rows.map(person => {
            const share = teamTotal ? person.paid / teamTotal * 100 : 0;
            return `
            <div class="finance-team-row finance-team-row-detailed"><div class="finance-team-avatar">${escapeBookingHtml(String(person.name || '?').slice(0,1).toUpperCase())}</div><div class="finance-team-copy"><strong>${escapeBookingHtml(person.name)}</strong><span>${person.visits} визитов · ${share.toFixed(0)}% поступлений</span><div class="finance-team-share-track"><i style="width:${share}%"></i></div></div><strong>${fmt(person.paid)}</strong></div>`;
        }).join('') : '<div class="finance-empty">Нет данных за выбранный период</div>';
    }

    const analyticsBookings = bookings.filter(item => inRange(item.date, periodStart, periodEnd) && item.status !== 'cancelled');
    const analyticsHeader = document.getElementById('analyticsHeaderBlock');
    if (analyticsHeader) analyticsHeader.innerHTML = `<div><strong>${periodLabel}</strong><span class="finance-muted">Сводка по записям за период</span></div><strong>${analyticsBookings.length} записей</strong>`;
    const analyticsList = document.getElementById('analyticsHistoryList');
    if (analyticsList) analyticsList.innerHTML = analyticsBookings.length ? analyticsBookings.map(item => {
        const total = (Array.isArray(item.services) ? item.services : []).reduce((sum,service) => sum + getSafeServiceAmount(service),0);
        const state = getBookingPaymentState(item,total);
        const methodKey = ['cash','card','transfer','online','mixed'].includes(state.method) ? state.method : 'other';
        const paymentStatusClass = state.status === 'paid' ? 'is-paid' : state.status === 'partial' ? 'is-partial' : 'is-unpaid';
        return `<div class="finance-operation finance-analytics-operation">
            <div class="finance-operation-copy">
                <strong>${escapeBookingHtml(item.clientName || 'Клиент')}</strong>
                <span>${escapeBookingHtml(item.time || '')} · <span class="finance-payment-status ${paymentStatusClass}">${state.label}</span></span>
                <span class="finance-payment-method finance-payment-method--${methodKey}"><i></i>${escapeBookingHtml(state.methodLabel)}</span>
            </div>
            <strong>${fmt(state.paid)} / ${fmt(total)}</strong>
        </div>`;
    }).join('') : '<div class="finance-empty">За выбранный период записей нет</div>';

    const serviceCounts = {};
    bookings.filter(item => item.status === 'completed' && inRange(item.date, periodStart, periodEnd)).forEach(item => {
        (Array.isArray(item.services) ? item.services : []).forEach(service => {
            const name = String(service.title || 'Услуга');
            if (!serviceCounts[name]) serviceCounts[name] = {count:0,revenue:0};
            serviceCounts[name].count += 1;
            serviceCounts[name].revenue += getSafeServiceAmount(service);
        });
    });
    const topServices = document.getElementById('analyticsTopServicesList');
    if (topServices) {
        const sorted = Object.entries(serviceCounts).sort((a,b) => b[1].revenue-a[1].revenue).slice(0,5);
        const maxServiceRevenue = Math.max(1,...sorted.map(([,data]) => data.revenue));
        topServices.innerHTML = sorted.length ? sorted.map(([name,data],index) => `
            <div class="finance-service-row finance-service-row-detailed"><span class="finance-service-rank">${index+1}</span><div class="finance-service-copy"><strong>${escapeBookingHtml(name)}</strong><span>${data.count} выполнено за 30 дней</span><div class="finance-service-track"><i style="width:${data.revenue/maxServiceRevenue*100}%"></i></div></div><strong>${fmt(data.revenue)}</strong></div>`
        ).join('') : '<div class="finance-empty">Статистика появится после завершённых визитов</div>';
    }

    const expenseBreakdown = document.getElementById('financeExpenseBreakdown');
    if (expenseBreakdown) {
        const groups = {};
        dayExpenses.forEach(item => {
            const label = String(item.category || item.title || 'Прочие расходы');
            groups[label] = (groups[label] || 0) + getSafeExpenseAmount(item);
        });
        const rows = Object.entries(groups).sort((a,b) => b[1]-a[1]);
        const maxExpense = Math.max(1,...rows.map(([,amount]) => amount));
        expenseBreakdown.innerHTML = rows.length ? '<div class="finance-breakdown-heading">Структура расходов за период</div>' + rows.map(([label,amount]) => `
            <div class="finance-expense-breakdown-row"><div><span>${escapeBookingHtml(label)}</span><strong>${fmt(amount)}</strong></div><div class="finance-expense-track"><i style="width:${amount/maxExpense*100}%"></i></div></div>`
        ).join('') : '<div class="finance-empty">Добавьте расходы, чтобы увидеть структуру</div>';
    }
}
function openExpenseModal() {
    if (!requireAdminAction('Управлять финансами может только Али')) return;
    document.getElementById('expenseTitle').value = '';
    document.getElementById('expenseAmount').value = '';
    openModal('expenseModal');
}

function addExpense() {
    if (!requireAdminAction('Добавлять расходы может только Али')) return;
    const titleInput = document.getElementById('expenseTitle');
    const amountInput = document.getElementById('expenseAmount');
    const title = String(titleInput?.value || '').trim();
    const rawAmount = String(amountInput?.value || '').trim().replace(',', '.');
    const amount = rawAmount && /^\d+(?:\.\d{1,2})?$/.test(rawAmount) ? Number(rawAmount) : NaN;
    const expenseDate = parseReportDate(selectedFinanceDate);

    if (!title || !Number.isFinite(amount) || amount <= 0 || !expenseDate) {
        return showToast('Укажите название, корректную сумму и дату расхода', 'error');
    }

    const newExpense = {
        id: Date.now(),
        title: title,
        amount: Math.round(amount * 100) / 100,
        date: selectedFinanceDate
    };

    expenses.push(newExpense);
    localStorage.setItem(appStorageKey('mensfire_admin_expenses'), JSON.stringify(expenses));
    closeModal('expenseModal');
    showToast(`Расход добавлен на ${selectedFinanceDate}`, 'success');
    renderFinance();
}

// --- КОМАНДА (Только Админ) ---
function renderTeam() {
    if (!requireAdminAction('Просматривать команду и управлять PIN может только Али')) return;
    const listPC = document.getElementById('teamListPC');
    const listMobile = document.getElementById('teamList');

    const today = new Date(); today.setHours(0,0,0,0);
    const todayKey = today.toLocaleDateString('ru-RU');
    let rangeStart = teamPeriodMode === 'month' ? new Date(today.getFullYear(),today.getMonth(),1) : parseReportDate(teamRangeStart);
    let rangeEnd = teamPeriodMode === 'month' ? today : parseReportDate(teamRangeEnd);
    rangeStart = rangeStart || new Date(today.getFullYear(),today.getMonth(),1);
    rangeEnd = rangeEnd || today;
    if (rangeEnd < rangeStart) [rangeStart,rangeEnd] = [rangeEnd,rangeStart];
    const rangeEndExclusive = new Date(rangeEnd); rangeEndExclusive.setDate(rangeEndExclusive.getDate()+1);
    const inSelectedPeriod = value => { const date = parseReportDate(value); return date && date >= rangeStart && date < rangeEndExclusive; };
    const periodLabel = formatReportDate(rangeStart) + ' — ' + formatReportDate(rangeEnd);
    const teamCompleted = bookings.filter(item => item.status === 'completed' && inSelectedPeriod(item.date));
    const teamRevenue = bookings.reduce((sum,item) => sum + (inSelectedPeriod(item.date) ? getBookingCollectedAmount(item) : 0),0);
    const controls = document.getElementById('teamPeriodControls');
    if (controls) controls.innerHTML = `
        <div class="finance-range-toolbar clients-range-toolbar">
            <div class="finance-range-presets" role="group" aria-label="Период статистики команды">
                <button type="button" class="finance-range-btn ${teamPeriodMode==='month'?'active':''}" onclick="setTeamPeriod('month')">Месяц</button>
                <button type="button" class="finance-range-btn ${teamPeriodMode==='custom'?'active':''}" onclick="setTeamPeriod('custom')">Период</button>
            </div>
            <div class="finance-range-fields" ${teamPeriodMode==='custom'?'':'hidden'}>
                <button type="button" class="finance-range-date" onclick="openReportDatePicker('teamStart')">${teamRangeStart}</button><span>—</span>
                <button type="button" class="finance-range-date" onclick="openReportDatePicker('teamEnd')">${teamRangeEnd}</button>
            </div>
        </div>`;
    const teamToday = bookings.filter(item => item.date === todayKey && item.status !== 'cancelled').length;
    const overview = document.getElementById('teamOverview');
    const trend = document.getElementById('teamRevenueTrend');
    if (trend) {
        const spanDays = Math.round((rangeEndExclusive-rangeStart)/86400000);
        const buckets = [];
        if (spanDays > 45) {
            const cursor = new Date(rangeStart.getFullYear(),rangeStart.getMonth(),1);
            while (cursor < rangeEndExclusive && buckets.length < 12) {
                const bucketStart = new Date(cursor), bucketEnd = new Date(cursor.getFullYear(),cursor.getMonth()+1,1);
                buckets.push({start:bucketStart,end:bucketEnd,label:bucketStart.toLocaleDateString('ru-RU',{month:'short',year:'2-digit'}).replace('.','')});
                cursor.setMonth(cursor.getMonth()+1);
            }
        } else {
            const step = spanDays > 7 ? Math.ceil(spanDays/7) : 1;
            for (let cursor = new Date(rangeStart); cursor < rangeEndExclusive && buckets.length < 7; cursor.setDate(cursor.getDate()+step)) {
                const bucketStart = new Date(cursor), bucketEnd = new Date(Math.min(new Date(cursor.getFullYear(),cursor.getMonth(),cursor.getDate()+step).getTime(),rangeEndExclusive.getTime()));
                buckets.push({start:bucketStart,end:bucketEnd,label:bucketStart.toLocaleDateString('ru-RU',{day:'2-digit',month:'short'}).replace('.','')});
            }
        }
        const values = buckets.map(bucket=>bookings.filter(item=>item.status==='completed'&&(()=>{const date=parseReportDate(item.date);return date&&date>=bucket.start&&date<bucket.end;})()).reduce((sum,item)=>sum+getBookingCollectedAmount(item),0));
        const max = Math.max(1,...values);
        trend.innerHTML = '<div class="team-trend-bars" style="grid-template-columns:repeat(' + Math.min(buckets.length,7) + ',minmax(0,1fr))">' + buckets.map((bucket,index) => {
            const height = Math.max(values[index] > 0 ? 5 : 2,values[index]/max*100);
            const amount = values[index] ? Math.round(values[index]).toLocaleString('ru-RU') + ' ₽' : '—';
            return '<div class="team-trend-column"><strong>' + amount + '</strong><div class="team-trend-track"><i style="height:' + height + '%"></i></div><span>' + bucket.label + '</span></div>';
        }).join('') + '</div>';
    }

    if (overview) overview.innerHTML = `
        <div class="team-overview-card"><span>Мастеров в команде</span><strong>${mockStaff.length}</strong><small>Активные профили</small></div>
        <div class="team-overview-card"><span>Записей сегодня</span><strong>${teamToday}</strong><small>По всем мастерам</small></div>
        <div class="team-overview-card"><span>Визитов за период</span><strong>${teamCompleted.length}</strong><small>${teamPeriodMode === 'month' ? 'Текущий месяц' : periodLabel}</small></div>
        <div class="team-overview-card"><span>Получено за период</span><strong>${Math.round(teamRevenue).toLocaleString('ru-RU')} ₽</strong><small>${teamPeriodMode === 'month' ? 'Текущий месяц' : periodLabel}</small></div>`;

    if (mockStaff.length === 0) {
        const empty = '<p class="team-empty-state">Нет мастеров</p>';
        if (listPC) listPC.innerHTML = empty;
        if (listMobile) listMobile.innerHTML = empty;
        return;
    }

    const html = mockStaff.map(staff => {
        const id = escapeBookingHtml(staff.id);
        const name = escapeBookingHtml(staff.name);
        const pin = escapeBookingHtml(staff.pin);
        const isAdmin = staff.role === 'admin';
        const roleLabel = isAdmin ? 'Главный мастер' : 'Барбер';
        const initials = escapeBookingHtml(String(staff.name || '?').trim().slice(0, 1).toUpperCase() || '?');
        const staffBookings = bookings.filter(item => String(item.barberId) === String(staff.id));
        const staffMonthBookings = staffBookings.filter(item => inSelectedPeriod(item.date));
        const staffCompleted = staffMonthBookings.filter(item => item.status === 'completed').length;
        const staffRevenue = staffMonthBookings.reduce((sum,item) => sum + getBookingCollectedAmount(item),0);
        return `
            <article class="team-card team-member-card" data-staff-card data-staff-id="${id}" tabindex="0" role="button" aria-label="Статистика: ${name}">
                <div class="team-avatar" aria-hidden="true">${initials}</div>
                <div class="team-info">
                    <h3 class="team-name">${name}</h3>
                    <span class="team-role">${roleLabel}</span>
                    <div class="team-performance"><span><strong>${staffCompleted}</strong> визитов</span><span><strong>${Math.round(staffRevenue).toLocaleString('ru-RU')} ₽</strong> получено</span></div>
                    <span class="team-pin">Доступ защищён · PIN скрыт</span>
                </div>
                <div class="team-actions">
                    <button type="button" class="team-action-btn reset" data-staff-action="edit" data-staff-id="${id}">Изменить имя</button>
                    <button type="button" class="team-action-btn reset" data-staff-action="reset" data-staff-id="${id}">Сменить PIN</button>
                    ${!isAdmin ? `<button type="button" class="team-action-btn delete" data-staff-action="delete" data-staff-id="${id}">Удалить</button>` : ''}
                </div>
            </article>
        `;
    }).join('');

    [listPC, listMobile].forEach(container => {
        if (!container) return;
        container.innerHTML = html;
        container.querySelectorAll('[data-staff-card]').forEach(card => {
            const id = card.getAttribute('data-staff-id');
            const openStats = () => showBarberStats(id);
            card.addEventListener('click', event => {
                if (event.target.closest('[data-staff-action]')) return;
                openStats();
            });
            card.addEventListener('keydown', event => {
                if (event.target !== card || (event.key !== 'Enter' && event.key !== ' ')) return;
                event.preventDefault();
                openStats();
            });
        });
        container.querySelectorAll('[data-staff-action]').forEach(button => {
            button.addEventListener('click', event => {
                event.stopPropagation();
                const id = button.getAttribute('data-staff-id');
                if (button.getAttribute('data-staff-action') === 'edit') openStaffEditModal(id);
                if (button.getAttribute('data-staff-action') === 'reset') resetStaffPin(id);
                if (button.getAttribute('data-staff-action') === 'delete') deleteStaff(id);
            });
        });
    });
}

function openStaffModal() {
    if (!requireAdminAction('Управлять командой может только Али')) return;
    document.getElementById('staffName').value = '';
    document.getElementById('staffPin').value = '';
    openModal('staffModal');
}

function openStaffEditModal(id) {
    if (!requireAdminAction('Редактировать мастеров может только Али')) return;
    const staff = mockStaff.find(item => String(item.id) === String(id));
    if (!staff || staff.role === 'admin') return;
    staffToEditId = String(id);
    document.getElementById('staffEditName').value = staff.name || '';
    openModal('staffEditModal');
}
function saveStaffEdit() {
    if (!requireAdminAction('Редактировать мастеров может только Али')) return;
    const staff = mockStaff.find(item => String(item.id) === String(staffToEditId));
    const name = document.getElementById('staffEditName').value.trim();
    if (!staff || !name) return showToast('Введите имя мастера', 'error');
    if (mockStaff.some(item => String(item.id) !== String(staffToEditId) && item.name.trim().toLowerCase() === name.toLowerCase())) {
        return showToast('Мастер с таким именем уже есть', 'error');
    }
    staff.name = name;
    localStorage.setItem(appStorageKey('mensfire_admin_staff'), JSON.stringify(mockStaff));
    closeModal('staffEditModal');
    staffToEditId = null;
    renderTeam();
    showToast('Профиль мастера обновлён', 'success');
}

function addStaff() {
    if (!requireAdminAction('Добавлять мастеров может только Али')) return;
    const name = document.getElementById('staffName').value;
    const pin = document.getElementById('staffPin').value;

    if (!name || !/^\d{4}$/.test(pin)) return showToast('Введите имя и PIN из 4 цифр', 'error');
    if (mockStaff.some(s => s.pin === pin)) return showToast('Этот PIN уже занят', 'error');

    const newStaff = {
        id: 'b_' + Date.now(),
        name: name,
        role: 'barber',
        pin: pin,
        type: 'barber'
    };

    mockStaff.push(newStaff);
    localStorage.setItem(appStorageKey('mensfire_admin_staff'), JSON.stringify(mockStaff));
    closeModal('staffModal');
    showToast('Мастер добавлен', 'success');
    renderTeam();
}

function resetStaffPin(id) {
    if (!requireAdminAction('Изменять PIN мастеров может только Али')) return;
    staffToResetPin = id;
    document.getElementById('adminNewPinInput').value = '';
    openModal('adminResetPinModal');
}

function submitAdminResetPin() {
    if (!requireAdminAction('Изменять PIN мастеров может только Али')) return;
    const newPin = document.getElementById('adminNewPinInput').value;
    if (!/^\d{4}$/.test(newPin)) {
        return showToast('PIN должен состоять из 4 цифр', 'error');
    }
    
    // Проверка, что PIN не занят
    if (mockStaff.some(s => s.pin === newPin)) {
        return showToast('Этот PIN уже занят', 'error');
    }

    const staff = mockStaff.find(s => s.id === staffToResetPin);
    if (staff) {
        staff.pin = newPin;
        localStorage.setItem(appStorageKey('mensfire_admin_staff'), JSON.stringify(mockStaff));
        closeModal('adminResetPinModal');
        showToast('PIN обновлен', 'success');
        renderTeam();
        
        // Обновляем статистику, если она открыта
        if (document.getElementById('barberStatsModal').classList.contains('active')) {
            showBarberStats(staffToResetPin);
        }
    }
}

function deleteStaff(id) {
    if (!requireAdminAction('Удалять мастеров может только Али')) return;
    const staff = mockStaff.find(item => String(item.id) === String(id));
    if (!staff || staff.role === 'admin') return showToast('Главного мастера удалить нельзя', 'error');
    const today = new Date();
    today.setHours(0,0,0,0);
    const hasUpcoming = bookings.some(item => String(item.barberId) === String(id) && item.status !== 'cancelled' && (() => {
        const parts = String(item.date || '').split('.').map(Number);
        if (parts.length !== 3 || !parts.every(Number.isFinite)) return false;
        const date = new Date(parts[2],parts[1]-1,parts[0]);
        return date >= today;
    })());
    if (hasUpcoming) return showToast('Нельзя удалить мастера с будущими активными записями. Сначала перенесите их.', 'error');
    showConfirm('Удалить мастера?', 'История визитов сохранится, но мастер исчезнет из списка сотрудников.', 'Да, удалить', () => {
        const index = mockStaff.findIndex(item => String(item.id) === String(id));
        if (index < 0) return;
        mockStaff.splice(index,1);
        localStorage.setItem(appStorageKey('mensfire_admin_staff'),JSON.stringify(mockStaff));
        showToast('Мастер удалён из команды','success');
        renderTeam();
    });
}

// --- АНАЛИТИКА БАРБЕРА ---
function showBarberStats(id) {
    if (!requireAdminAction('Статистика мастеров доступна только Али')) return;
    const staff = mockStaff.find(s => s.id === id);
    if (!staff) return;

    document.getElementById('statsBarberName').innerText = staff.name;

    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    const todayStr = today.toLocaleDateString('ru-RU');

    // Получаем все завершенные записи этого мастера
    const allCompleted = bookings.filter(b => b.barberId === id && b.status === 'completed');
    
    // За текущий месяц
    const monthBookings = allCompleted.filter(b => {
        const [d, m, y] = b.date.split('.');
        return parseInt(y) === currentYear && (parseInt(m) - 1) === currentMonth;
    });

    // За сегодня
    const todayBookings = allCompleted.filter(b => b.date === todayStr);

    // Считаем суммы
    const monthRevenue = monthBookings.reduce((sum, b) => sum + getBookingCollectedAmount(b), 0);
    const todayRevenue = todayBookings.reduce((sum, b) => sum + getBookingCollectedAmount(b), 0);
    
    const monthSalary = Math.round(monthRevenue * 0.4);
    const todaySalary = Math.round(todayRevenue * 0.4);

    // Уникальные клиенты за месяц
    const uniqueClients = new Set(monthBookings.map(b => b.clientName));

    // Топ услуга за месяц
    const serviceCounts = {};
    monthBookings.forEach(b => {
        (b.services || []).forEach(s => {
            serviceCounts[s.title] = (serviceCounts[s.title] || 0) + 1;
        });
    });
    let topService = '-';
    let topCount = 0;
    for (const [title, count] of Object.entries(serviceCounts)) {
        if (count > topCount) { topCount = count; topService = title; }
    }

    // Заполняем данные
    document.getElementById('statsMonthVisits').innerText = monthBookings.length;
    document.getElementById('statsMonthClients').innerText = uniqueClients.size;
    document.getElementById('statsMonthRevenue').innerText = monthRevenue + ' ₽';
    document.getElementById('statsMonthSalary').innerText = monthSalary + ' ₽';
    
    document.getElementById('statsTodayVisits').innerText = todayBookings.length;
    document.getElementById('statsTodayRevenue').innerText = todayRevenue + ' ₽';
    document.getElementById('statsTodaySalary').innerText = todaySalary + ' ₽';

    document.getElementById('statsTopService').innerText = topService;
    document.getElementById('statsTopServiceCount').innerText = topCount + ' раз';

    // Настраиваем кнопку сброса PIN
    const resetBtn = document.getElementById('statsResetPinBtn');
    if (resetBtn) {
        resetBtn.onclick = () => {
            closeModal('barberStatsModal');
            resetStaffPin(id);
        };
    }

    openModal('barberStatsModal');
}

// Добавь эту переменную в начало скрипта или прямо перед функцией
let currentClientsTab = 'all'; 
let clientsSearchQuery = '';
let clientsSegmentFilter = 'all';

function setClientsSearchQuery(value) {
    clientsSearchQuery = value.trim().toLowerCase();
    renderClients(currentClientsTab);
}

let selectedClientProfileKey = null;

function normalizeClientPhone(phone) {
    return String(phone || '').replace(/\D/g, '');
}

function getClientProfileKey(name, barberId, phone = '') {
    const normalizedPhone = normalizeClientPhone(phone);
    return normalizedPhone.length >= 7
        ? 'phone:' + normalizedPhone
        : JSON.stringify([name, barberId]);
}

function findClientProfile(name, barberId) {
    const legacyKey = JSON.stringify([name, barberId]);
    const legacyProfile = clientProfiles[legacyKey] || {};
    const canonicalKey = getClientProfileKey(name, barberId, legacyProfile.phone);
    return {
        key: canonicalKey,
        profile: clientProfiles[canonicalKey] || legacyProfile,
        legacyKey
    };
}

function saveClientProfile() {
    if (!selectedClientProfileKey) return;

    const previousProfile = clientProfiles[selectedClientProfileKey] || {};
    const clientName = previousProfile.clientName || '';
    const barberId = previousProfile.barberId || '';
    const legacyKey = JSON.stringify([clientName, barberId]);
    const phone = document.getElementById('clientDetailsPhone').value.trim();
    const canonicalKey = getClientProfileKey(clientName, barberId, phone);
    const updatedProfile = {
        ...previousProfile,
        ...(clientProfiles[canonicalKey] || {}),
        clientName,
        barberId,
        phone,
        birthday: document.getElementById('clientDetailsBirthday')?.value || '',
        tag: document.getElementById('clientDetailsTag')?.value || 'regular',
        notes: document.getElementById('clientDetailsNotes').value.trim(),
        preferences: document.getElementById('clientDetailsPreferences')?.value.trim() || ''
    };

    // Legacy-ключ связывает конкретную карточку с общим телефонным профилем.
    // Не удаляем общий phone:-ключ при смене номера: им могут пользоваться
    // карточки этого же клиента у других мастеров.
    clientProfiles[legacyKey] = updatedProfile;
    clientProfiles[canonicalKey] = updatedProfile;
    selectedClientProfileKey = canonicalKey;

    localStorage.setItem(
        appStorageKey('mensfire_client_profiles'),
        JSON.stringify(clientProfiles)
    );

    showToast('Данные клиента сохранены', 'success');
}
function setClientsSegmentFilter(filter) {
    clientsSegmentFilter = ['all','new','regular','vip'].includes(filter) ? filter : 'all';
    renderClients(currentClientsTab);
}

function renderClientsAnalytics(sourceBookings, clientGroups) {
    const root = document.getElementById('clientsAnalytics');
    if (!root) return;
    const now = new Date();
    let rangeStart = clientsPeriodMode === 'sixMonths' ? new Date(now.getFullYear(),now.getMonth()-5,1) : clientsPeriodMode === 'month' ? new Date(now.getFullYear(),now.getMonth(),1) : parseReportDate(clientsRangeStart);
    let rangeEnd = clientsPeriodMode === 'sixMonths' || clientsPeriodMode === 'month' ? new Date(now.getFullYear(),now.getMonth(),now.getDate()) : parseReportDate(clientsRangeEnd);
    rangeStart = rangeStart || new Date(now.getFullYear(),now.getMonth()-5,1);
    rangeEnd = rangeEnd || now;
    if (rangeEnd < rangeStart) [rangeStart,rangeEnd] = [rangeEnd,rangeStart];
    const rangeEndExclusive = new Date(rangeEnd); rangeEndExclusive.setDate(rangeEndExclusive.getDate()+1);
    const inRange = booking => { const date = parseReportDate(booking.date); return date && date >= rangeStart && date < rangeEndExclusive; };
    const periodBookings = (sourceBookings || []).filter(inRange);
    const completed = periodBookings.filter(booking => booking.status === 'completed');
    const monthKeys = [];
    const cursor = new Date(rangeStart.getFullYear(),rangeStart.getMonth(),1);
    const lastMonth = new Date(rangeEnd.getFullYear(),rangeEnd.getMonth(),1);
    while (cursor <= lastMonth && monthKeys.length < 18) {
        monthKeys.push({key:cursor.getFullYear()+'-'+String(cursor.getMonth()+1).padStart(2,'0'),label:cursor.toLocaleDateString('ru-RU',{month:'short',year:rangeStart.getFullYear()!==rangeEnd.getFullYear()?'2-digit':undefined}).replace('.','')});
        cursor.setMonth(cursor.getMonth()+1);
    }
    const monthStats = monthKeys.map(month=>({...month,revenue:0,visits:0}));
    const monthIndex = new Map(monthStats.map((item,index)=>[item.key,index]));
    completed.forEach(booking=>{
        const date=parseReportDate(booking.date), key=date.getFullYear()+'-'+String(date.getMonth()+1).padStart(2,'0'), index=monthIndex.get(key);
        if(index===undefined)return;
        monthStats[index].visits++;
        monthStats[index].revenue+=getBookingCollectedAmount(booking);
    });
    const maxRevenue=Math.max(1,...monthStats.map(item=>item.revenue));
    const chartWidth=520,chartHeight=154,left=12,right=12,top=12,bottom=28,plotWidth=chartWidth-left-right,plotHeight=chartHeight-top-bottom;
    const points=monthStats.map((item,index)=>({x:left+(monthStats.length===1?plotWidth/2:index*plotWidth/(monthStats.length-1)),y:top+plotHeight-(item.revenue/maxRevenue)*plotHeight,...item}));
    const linePath=points.map((point,index)=>(index?'L':'M')+point.x.toFixed(1)+' '+point.y.toFixed(1)).join(' ');
    const areaPath=linePath+' L '+points[points.length-1].x.toFixed(1)+' '+(top+plotHeight)+' L '+points[0].x.toFixed(1)+' '+(top+plotHeight)+' Z';
    const periodGroups=(clientGroups||[]).map(client=>{
        const visits=client.visits.filter(inRange),done=visits.filter(visit=>visit.status==='completed');
        return {...client,visits,lifetimeCompletedCount:client.completedCount,completedCount:done.length,totalSpent:visits.reduce((sum,visit)=>sum+getBookingCollectedAmount(visit),0),completedRevenue:done.reduce((sum,visit)=>sum+getBookingCollectedAmount(visit),0)};
    }).filter(client=>client.visits.length);
    const totalClients=periodGroups.length,totalVisits=completed.length,totalRevenue=completed.reduce((sum,booking)=>sum+getBookingCollectedAmount(booking),0);
    const segmentCounts={new:0,regular:0,vip:0};
    // Сегмент клиента — характеристика всей истории, а не только выбранного отчётного периода.
    periodGroups.forEach(client=>{const tag=client.profileSummary.tag||(client.lifetimeCompletedCount<=1?'new':'regular');segmentCounts[segmentCounts[tag]===undefined?'regular':tag]++;});
    const newPercent=totalClients?Math.round(segmentCounts.new/totalClients*100):0,regularPercent=totalClients?Math.round(segmentCounts.regular/totalClients*100):0,vipStart=newPercent+regularPercent;
    const maxVisits=Math.max(0,...monthStats.map(item=>item.visits));
    const periodLabel=formatReportDate(rangeStart)+' — '+formatReportDate(rangeEnd);
    const controls=document.getElementById('clientsPeriodControls');
    if (controls) controls.innerHTML = `
        <div class="finance-range-toolbar clients-range-toolbar">
            <div class="finance-range-presets" role="group" aria-label="Период аналитики клиентов">
                <button type="button" class="finance-range-btn ${clientsPeriodMode==='sixMonths'?'active':''}" onclick="setClientsPeriod('sixMonths')">6 месяцев</button>
                <button type="button" class="finance-range-btn ${clientsPeriodMode==='month'?'active':''}" onclick="setClientsPeriod('month')">Месяц</button>
                <button type="button" class="finance-range-btn ${clientsPeriodMode==='custom'?'active':''}" onclick="setClientsPeriod('custom')">Период</button>
            </div>
            <div class="finance-range-fields" ${clientsPeriodMode==='custom'?'':'hidden'}>
                <button type="button" class="finance-range-date" onclick="openReportDatePicker('clientsStart')">${formatReportDate(parseReportDate(clientsRangeStart)||rangeStart)}</button>
                <span>—</span>
                <button type="button" class="finance-range-date" onclick="openReportDatePicker('clientsEnd')">${formatReportDate(parseReportDate(clientsRangeEnd)||rangeEnd)}</button>
            </div>
        </div>`;
    root.innerHTML = `
        <div class="clients-analytics-heading">
            <div><span class="finance-eyebrow">CLIENT INSIGHTS</span><h3>Аналитика клиентов</h3><p>Визиты, выручка и структура аудитории за период</p></div>
            <span class="clients-analytics-period">${clientsPeriodMode==='sixMonths'?'6 месяцев':clientsPeriodMode==='month'?'Текущий месяц':periodLabel}</span>
        </div>
        <div class="clients-period-summary">
            <div><span>Получено за период</span><strong>${Math.round(totalRevenue).toLocaleString('ru-RU')} ₽</strong></div>
            <div><span>Завершено визитов</span><strong>${totalVisits}</strong></div>
            <div><span>Клиентов за период</span><strong>${totalClients}</strong></div>
        </div>
        <div class="clients-analytics-grid">
            <article class="clients-chart-card clients-revenue-chart">
                <div class="clients-chart-title"><div><span>Выручка по месяцам</span><strong>${Math.round(totalRevenue).toLocaleString('ru-RU')} ₽</strong></div><span class="clients-chart-icon">↗</span></div>
                <svg class="clients-line-chart" viewBox="0 0 520 154" role="img" aria-label="Динамика выручки по месяцам за выбранный период">
                    <defs><linearGradient id="clientsChartFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stop-color="#d4af37" stop-opacity=".30"/><stop offset="100%" stop-color="#d4af37" stop-opacity="0"/></linearGradient></defs>
                    <path d="M ${left} ${top+plotHeight/2} H ${chartWidth-right}" class="clients-chart-gridline"/><path d="M ${left} ${top+plotHeight} H ${chartWidth-right}" class="clients-chart-gridline"/>
                    <path d="${areaPath}" class="clients-chart-area"/><path d="${linePath}" class="clients-chart-line"/>
                    ${points.map(point=>`<circle cx="${point.x}" cy="${point.y}" r="4" class="clients-chart-point"><title>${point.label}: ${Math.round(point.revenue).toLocaleString('ru-RU')} ₽</title></circle>`).join('')}
                    ${points.map(point=>`<text x="${point.x}" y="150" text-anchor="middle" class="clients-chart-label">${point.label}</text>`).join('')}
                </svg>
                <div class="clients-chart-footer"><span>${totalVisits} завершённых визитов · ${periodLabel}</span><span>Демо-данные</span></div>
            </article>
            <article class="clients-chart-card clients-loyalty-chart">
                <div class="clients-chart-title"><div><span>Сегменты аудитории</span><strong>${totalClients} клиентов</strong></div><span class="clients-chart-icon">◎</span></div>
                <div class="clients-donut-layout"><div class="clients-donut" style="--new-share:${newPercent}%;--regular-share:${vipStart}%;--vip-share:100%"><div><strong>${totalClients}</strong><small>всего</small></div></div>
                    <div class="clients-donut-legend"><div><i class="new"></i><span>Новые</span><strong>${segmentCounts.new}</strong></div><div><i class="regular"></i><span>Постоянные</span><strong>${segmentCounts.regular}</strong></div><div><i class="vip"></i><span>VIP</span><strong>${segmentCounts.vip}</strong></div></div>
                </div>
                <div class="clients-chart-footer"><span>Сегментация за период</span><span>Демо</span></div>
            </article>
        </div>
        <div class="clients-monthly-strip">${monthStats.map(item=>`<div class="clients-month-stat"><span>${item.label}</span><strong>${item.visits}</strong><small>визитов</small><div><i style="width:${maxVisits?Math.max(4,item.visits/maxVisits*100):0}%"></i></div></div>`).join('')}</div>`;
}
function renderClients(tab = 'all') {
    currentClientsTab = tab;
    renderWaitlist();
    const list = document.getElementById('clientsList');
    const tabsContainer = document.getElementById('clientsTabsContainer');
    const title = document.getElementById('clientsPageTitle');
    const segmentContainer = document.getElementById('clientsSegmentContainer');
    if (!list || !tabsContainer || !title) return;

    title.innerText = currentUser.role === 'admin' ? 'Клиенты' : 'Мои клиенты';

    // 2. Рендерим табы (только для админа)
    if (currentUser.role === 'admin') {
        tabsContainer.innerHTML = `
            <div class="category-tabs" style="margin-bottom: 15px;">
                <button class="tab-btn ${currentClientsTab === 'my' ? 'active' : ''}" onclick="renderClients('my')">Мои клиенты</button>
                <button class="tab-btn ${currentClientsTab === 'all' ? 'active' : ''}" onclick="renderClients('all')">Все клиенты</button>
            </div>
        `;
    } else {
        tabsContainer.innerHTML = ''; // У барберов табов нет
    }

    if (segmentContainer) {
        const filters = [{id:'all',label:'Все'},{id:'new',label:'Новые'},{id:'regular',label:'Постоянные'},{id:'vip',label:'VIP'}];
        segmentContainer.innerHTML = '<div class="client-segment-tabs">' + filters.map(item =>
            '<button type="button" class="client-segment-btn ' + (clientsSegmentFilter === item.id ? 'active' : '') + '" onclick="setClientsSegmentFilter(\'' + item.id + '\')">' + item.label + '</button>'
        ).join('') + '</div>';
    }

    // 3. Фильтруем записи для подсчета
    let filteredBookings = bookings;
    
    // Если это барбер ИЛИ админ на вкладке "Мои клиенты" — фильтруем по ID
    if (currentUser.role === 'barber' || (currentUser.role === 'admin' && currentClientsTab === 'my')) {
        filteredBookings = filteredBookings.filter(b => String(b.barberId) === String(currentUser.id));
    }

        // Собираем клиентов (привязка к мастеру, чтобы не сливались)
    const clients = {};
    filteredBookings.forEach(b => {
        const clientKey = JSON.stringify([String(b.clientName || ''), String(b.barberId || '')]); 
        
        if (!clients[clientKey]) {
            clients[clientKey] = {
                name: b.clientName, barberId: b.barberId, visits: [],
                completedCount: 0, cancelledCount: 0, totalSpent: 0, completedRevenue: 0
            };
        }
        clients[clientKey].visits.push(b);
        // Потрачено — все фактически полученные суммы; завершённые визиты
        // считаются отдельно, чтобы отмены не завышали число посещений.
        clients[clientKey].totalSpent += getBookingCollectedAmount(b);
        if (b.status === 'completed') {
            clients[clientKey].completedCount++;
            clients[clientKey].completedRevenue += getBookingCollectedAmount(b);
        } else if (b.status === 'cancelled') {
            clients[clientKey].cancelledCount++;
        }
    });

    // Объединяем карточки только при наличии совпадающего подтверждённого телефона.
    // Без номера клиенты остаются раздельными по имени и мастеру.
    const groupedClients = {};
    Object.values(clients).forEach(client => {
        const { profile } = findClientProfile(client.name, client.barberId);
        const phoneKey = normalizeClientPhone(profile.phone);
        const groupKey = phoneKey.length >= 7
            ? 'phone:' + phoneKey
            : JSON.stringify([client.name, client.barberId]);

        if (!groupedClients[groupKey]) {
            groupedClients[groupKey] = {
                ...client,
                names: [client.name],
                barberIds: [client.barberId],
                profiles: [profile],
                profileSummary: {
                    phone: String(profile.phone || ''),
                    birthday: String(profile.birthday || ''),
                    tag: ['new', 'regular', 'vip'].includes(profile.tag) ? profile.tag : '',
                    notes: String(profile.notes || '')
                }
            };
        } else {
            const group = groupedClients[groupKey];
            if (!group.names.includes(client.name)) group.names.push(client.name);
            if (!group.barberIds.includes(client.barberId)) group.barberIds.push(client.barberId);
            group.visits.push(...client.visits);
            group.completedCount += client.completedCount;
            group.cancelledCount += client.cancelledCount;
            group.totalSpent += client.totalSpent;
            group.completedRevenue += client.completedRevenue;
            group.profiles.push(profile);
            ['phone', 'birthday', 'notes'].forEach(field => {
                if (!group.profileSummary[field] && profile[field]) {
                    group.profileSummary[field] = String(profile[field]);
                }
            });
            if (!group.profileSummary.tag && ['new', 'regular', 'vip'].includes(profile.tag)) {
                group.profileSummary.tag = profile.tag;
            }
        }
    });

    const allClientGroups = Object.values(groupedClients);
    renderClientsAnalytics(filteredBookings, allClientGroups);
    const clientsOverview = document.getElementById('clientsOverview');
    if (clientsOverview) {
        const now = new Date();
        let rangeStart = clientsPeriodMode === 'sixMonths' ? new Date(now.getFullYear(),now.getMonth()-5,1) : clientsPeriodMode === 'month' ? new Date(now.getFullYear(),now.getMonth(),1) : parseReportDate(clientsRangeStart);
        let rangeEnd = clientsPeriodMode === 'sixMonths' || clientsPeriodMode === 'month' ? new Date(now.getFullYear(),now.getMonth(),now.getDate()) : parseReportDate(clientsRangeEnd);
        rangeStart = rangeStart || new Date(now.getFullYear(),now.getMonth(),1); rangeEnd = rangeEnd || now;
        if (rangeEnd < rangeStart) [rangeStart,rangeEnd] = [rangeEnd,rangeStart];
        const endExclusive = new Date(rangeEnd); endExclusive.setDate(endExclusive.getDate()+1);
        const inPeriod = visit => { const date=parseReportDate(visit.date); return date && date>=rangeStart && date<endExclusive; };
        const periodGroups = allClientGroups.map(client=>{const visits=client.visits.filter(inPeriod),done=visits.filter(visit=>visit.status==='completed');return {...client,visits,completedCount:done.length,totalSpent:visits.reduce((sum,visit)=>sum+getBookingCollectedAmount(visit),0),completedRevenue:done.reduce((sum,visit)=>sum+getBookingCollectedAmount(visit),0)};}).filter(client=>client.visits.length);
        const loyalClients=periodGroups.filter(client=>client.completedCount>=3).length;
        const visitTotal=periodGroups.reduce((sum,client)=>sum+client.completedCount,0);
        const spentTotal=periodGroups.reduce((sum,client)=>sum+client.totalSpent,0);
        const completedRevenueTotal=periodGroups.reduce((sum,client)=>sum+client.completedRevenue,0);
        const averageCheck=visitTotal?Math.round(completedRevenueTotal/visitTotal):0;
        const upcomingClients=periodGroups.filter(client=>client.visits.some(visit=>visit.status!=='cancelled'&&parseClientDateTime(visit)>=Date.now())).length;
        const caption=clientsPeriodMode==='sixMonths'?'Последние 6 месяцев':clientsPeriodMode==='month'?'Текущий месяц':formatReportDate(rangeStart)+' — '+formatReportDate(rangeEnd);
        clientsOverview.innerHTML=`
            <div class="client-overview-card"><span>Клиентов за период</span><strong>${periodGroups.length}</strong><small>${caption}</small></div>
            <div class="client-overview-card"><span>Повторных клиентов</span><strong>${loyalClients}</strong><small>От 3 завершённых визитов за период</small></div>
            <div class="client-overview-card"><span>Завершённых визитов</span><strong>${visitTotal}</strong><small>${caption}</small></div>
            <div class="client-overview-card"><span>Средний чек</span><strong>${averageCheck.toLocaleString('ru-RU')} ₽</strong><small>По завершённым визитам</small></div>
            <div class="client-overview-card"><span>Оплачено</span><strong>${Math.round(spentTotal).toLocaleString('ru-RU')} ₽</strong><small>Фактически получено</small></div>
            <div class="client-overview-card"><span>Есть запись</span><strong>${upcomingClients}</strong><small>Будущие визиты в CRM</small></div>`;
    }

    const clientArray = Object.values(groupedClients)
    .filter(c => {
        if (clientsSegmentFilter !== 'all') {
            const explicitTag = c.profileSummary.tag;
            const inferredTag = explicitTag || (c.completedCount <= 1 ? 'new' : 'regular');
            if (inferredTag !== clientsSegmentFilter) return false;
        }
        const phone = normalizeClientPhone(c.profileSummary.phone);
        const phoneQuery = normalizeClientPhone(clientsSearchQuery);
        return (
            c.names.some(name => String(name || '').toLowerCase().includes(clientsSearchQuery)) ||
            (phoneQuery.length > 0 && phone.includes(phoneQuery))
        );
    })
    .sort((a, b) => b.completedCount - a.completedCount || b.totalSpent - a.totalSpent);
    
    if (clientArray.length === 0) {
        list.innerHTML = '<div class="empty-bookings-msg" style="font-size: 16px;">Клиентов пока нет</div>';
        return;
    }

    // Выводим список
    list.innerHTML = clientArray.map(c => {
        const parseVisitDate = value => {
            const [day, month, year] = String(value || '').split('.').map(Number);
            if (!day || !month || !year) return 0;
            const parsed = new Date(year, month - 1, day).getTime();
            return Number.isFinite(parsed) ? parsed : 0;
        };
        const completedAverageCheck = c.completedCount ? Math.round(c.completedRevenue / c.completedCount) : 0;
        const clientPhoneKey = normalizeClientPhone((c.profileSummary || {}).phone);
        const loyaltyBookings = clientPhoneKey.length >= 7
            ? bookings.filter(booking => normalizeClientPhone(findClientProfile(booking.clientName, booking.barberId).profile.phone) === clientPhoneKey)
            : c.visits;
        const loyalty = getClientLoyaltyState(loyaltyBookings);
        const upcomingVisit = c.visits.filter(visit => visit.status !== 'cancelled' && parseClientDateTime(visit) >= Date.now())
            .sort((a,b) => parseClientDateTime(a) - parseClientDateTime(b))[0];
        const completedVisits = c.visits
            .filter(visit => visit.status === 'completed')
            .slice()
            .sort((a, b) => parseVisitDate(b.date) - parseVisitDate(a.date));
        const sortedVisits = c.visits.slice()
            .sort((a, b) => parseVisitDate(b.date) - parseVisitDate(a.date));
        const lastVisit = completedVisits[0] || sortedVisits[0];
        const profile = c.profileSummary || c.profiles[0] || {};
        const clientTagLabels = { new: 'Новый', regular: 'Постоянный', vip: 'VIP' };
        const clientTag = clientTagLabels[profile.tag || 'regular'] || 'Постоянный';
        const masterNames = c.barberIds.map(id => mockStaff.find(staff => String(staff.id) === String(id))?.name || 'Мастер');
        const masterBadge = currentUser.role === 'admin' && currentClientsTab === 'all'
            ? `<div class="client-meta" style="color: var(--gold); font-size: 10px; margin-top: 4px;">Мастера: ${masterNames.join(', ')}</div>`
            : '';
        const safeNameArg = escapeBookingHtml(JSON.stringify(String(c.name || '')));
        const safeBarberArg = escapeBookingHtml(JSON.stringify(String(c.barberId || '')));
        const safeTag = ['new', 'regular', 'vip'].includes(profile.tag) ? profile.tag : 'regular';
        const safeNames = c.names.map(escapeBookingHtml).join(' / ');
        const safeMasters = masterNames.map(escapeBookingHtml).join(', ');

        return `
            <div class="client-card" onclick="showClientDetails(${safeNameArg}, ${safeBarberArg})">
                <div class="client-avatar">${escapeBookingHtml(String(c.name || '?').charAt(0).toUpperCase())}</div>
                <div class="client-info">
                    <div class="client-name">${safeNames} <span class="client-tag-badge tag-${safeTag}">${clientTag}</span></div>
                    <div class="client-meta">Визитов: <span class="gold-text">${c.completedCount}</span> · Отмен: <span class="gold-text">${c.cancelledCount}</span></div>
                    <div class="client-loyalty-list-badge"><span class="client-loyalty-dot" style="background:${loyalty.level.color}"></span><b>${loyalty.level.name}</b><span>${loyalty.count} лояльных визитов</span><span>·</span><span>${loyalty.points.toLocaleString('ru-RU')} баллов</span></div>
                    <div class="booking-card-badges"><i class="booking-client-type type-${c.completedCount > 0 ? 'returning' : 'new'}">${c.completedCount > 0 ? 'Повторный клиент' : 'Новый клиент'}</i><i class="booking-origin origin-other">${[...new Set(c.visits.map(visit => getBookingSourceMeta(visit).label))].slice(0,2).map(escapeBookingHtml).join(' · ') || 'Канал не указан'}</i></div>
                    <div class="client-meta">Оплачено: <span class="gold-text">${Number(c.totalSpent || 0).toLocaleString('ru-RU')} ₽</span> · Средний чек: <span class="gold-text">${completedAverageCheck.toLocaleString('ru-RU')} ₽</span></div>
                    <div class="client-meta">${completedVisits.length ? 'Последний визит:' : 'Последняя запись:'} ${escapeBookingHtml(lastVisit.date)} в ${escapeBookingHtml(lastVisit.time)}</div>
                    ${profile.preferences ? '<div class="client-meta client-preferences-preview">✦ ' + escapeBookingHtml(profile.preferences) + '</div>' : ''}
                    <div class="client-meta client-next-visit">${upcomingVisit ? 'Следующая запись: ' + escapeBookingHtml(upcomingVisit.date) + ' в ' + escapeBookingHtml(upcomingVisit.time) : 'Будущих записей нет'}</div>
                    ${masterBadge ? `<div class="client-meta" style="color: var(--gold); font-size: 10px; margin-top: 4px;">Мастера: ${safeMasters}</div>` : ''}
                </div>
            </div>
        `;
    }).join('');
}


/* Лояльность MensFire — правила синхронизированы с клиентским приложением. */
function getClientLoyaltyState(sourceBookings) {
    const eligible = (Array.isArray(sourceBookings) ? sourceBookings : [])
        .filter(booking => booking && ['active', 'completed'].includes(String(booking.status || '').toLowerCase()))
        .map(booking => {
            const serviceTotal = (Array.isArray(booking.services) ? booking.services : [])
                .reduce((sum, service) => {
                    const amount = Number(service?.price);
                    return sum + (Number.isFinite(amount) ? Math.max(0, amount) : 0);
                }, 0);
            const rawTotal = booking.total;
            const parsedTotal = rawTotal !== '' && rawTotal != null ? Number(rawTotal) : NaN;
            const total = Number.isFinite(parsedTotal) && parsedTotal >= 0 ? parsedTotal : serviceTotal;
            const parsedTimestamp = parseClientDateTime(booking);
            return {
                booking,
                total,
                timestamp: parsedTimestamp > 0 ? parsedTimestamp : Number.POSITIVE_INFINITY
            };
        })
        .filter(item => Number.isFinite(item.total) && item.total > 1000)
        // Повторяем порядок клиентского приложения: дата и точное время визита.
        .sort((a, b) => a.timestamp - b.timestamp);

    const count = eligible.length;
    let level;
    if (count < 10) level = { name: 'Бронзовый', next: 'Серебряный', percent: 1, base: 0, target: 10, color: '#CD7F32', light: '#A65D26' };
    else if (count < 20) level = { name: 'Серебряный', next: 'Золотой', percent: 2, base: 10, target: 20, color: '#C0C0C0', light: '#8C8C8C' };
    else level = { name: 'Золотой', next: 'Максимум', percent: 3, base: 20, target: 20, color: '#D4AF37', light: '#C79A2A' };

    let points = 0;
    const history = eligible.map((item, index) => {
        const rate = index < 10 ? 0.01 : index < 20 ? 0.02 : 0.03;
        const earned = Math.floor(item.total * rate);
        points += earned;
        return { ...item, rate, earned, runningPoints: points };
    });
    const progress = count >= 20 ? 100 : Math.max(0, Math.min(100, ((count - level.base) / (level.target - level.base)) * 100));
    return { count, level, points, progress, remaining: Math.max(0, level.target - count), history };
}

function renderClientLoyaltyPanel(sourceBookings) {
    const root = document.getElementById('clientLoyaltyPanel');
    if (!root) return;
    const state = getClientLoyaltyState(sourceBookings);
    const history = state.history.slice().reverse().slice(0, 8);
    root.innerHTML = `
        <section class="client-loyalty-card level-${state.level.name.toLowerCase()}">
            <div class="client-loyalty-heading">
                <div><span class="client-loyalty-eyebrow">ПРОГРАММА ЛОЯЛЬНОСТИ</span><strong>${state.level.name} уровень</strong></div>
                <span class="client-loyalty-percent">${state.level.percent}% кэшбэк</span>
            </div>
            <div class="client-loyalty-stats">
                <div><strong>${state.count}</strong><span>засчитанных визитов</span></div>
                <div><strong>${state.points.toLocaleString('ru-RU')}</strong><span>накоплено баллов</span></div>
            </div>
            <div class="client-loyalty-progress"><i style="width:${state.progress}%;background:${state.level.color}"></i></div>
            <div class="client-loyalty-next">${state.count >= 20 ? 'Достигнут максимальный уровень' : 'До уровня «' + state.level.next + '» осталось: ' + state.remaining + ' виз.'}</div>
            <div class="client-loyalty-history-title">Начисления баллов</div>
            <div class="client-loyalty-disclaimer">Расчёт по тем же правилам, что и в приложении клиента. Списание баллов здесь пока не предусмотрено.</div>
            ${history.length ? history.map(item => {
                const booking = item.booking;
                const date = escapeBookingHtml(booking.date || 'Дата не указана');
                const time = escapeBookingHtml(booking.time || '');
                const serviceNames = (Array.isArray(booking.services) ? booking.services : []).map(service => escapeBookingHtml(service?.title || 'Услуга')).join(', ');
                const barberName = mockStaff.find(staff => String(staff.id) === String(booking.barberId))?.name || 'Мастер';
                const visitMeta = [barberName, serviceNames, item.total.toLocaleString('ru-RU') + ' ₽ × ' + Math.round(item.rate * 100) + '%'].filter(Boolean).join(' · ');
                return '<div class="client-loyalty-row"><span><b>' + date + (time ? ' · ' + time : '') + '</b><small>' + escapeBookingHtml(visitMeta) + '</small></span><strong>+' + item.earned.toLocaleString('ru-RU') + ' б.</strong></div>';
            }).join('') : '<div class="client-loyalty-empty">Пока нет визитов, подходящих для начисления баллов</div>'}
        </section>`;
}

function parseClientDateTime(booking) {
    const [day, month, year] = String(booking?.date || '').split('.').map(Number);
    const [hour, minute] = String(booking?.time || '00:00').split(':').map(Number);
    if (!Number.isInteger(day) || !Number.isInteger(month) || !Number.isInteger(year) ||
        !Number.isInteger(hour) || !Number.isInteger(minute) ||
        day < 1 || month < 1 || month > 12 || year < 1000 ||
        hour < 0 || hour > 23 || minute < 0 || minute > 59) return 0;
    const date = new Date(year, month - 1, day, hour, minute);
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 ||
        date.getDate() !== day) return 0;
    const timestamp = date.getTime();
    return Number.isFinite(timestamp) ? timestamp : 0;
}

function showClientDetails(name, barberId) {
    const selectedProfile = findClientProfile(name, barberId);
    const selectedPhone = normalizeClientPhone(selectedProfile.profile.phone);
    const mergedClientProfile = { ...selectedProfile.profile };
    if (selectedPhone.length >= 7) {
        Object.values(clientProfiles)
            .filter(profile => normalizeClientPhone(profile.phone) === selectedPhone)
            .forEach(profile => {
                ['phone', 'birthday', 'tag', 'notes', 'preferences'].forEach(field => {
                    if (!mergedClientProfile[field] && profile[field]) {
                        mergedClientProfile[field] = profile[field];
                    }
                });
            });
    }
    const myBookings = bookings.filter(b => {
        if (b.clientName === name && String(b.barberId) === String(barberId)) return true;
        if (!selectedPhone) return false;
        const otherProfile = findClientProfile(b.clientName, b.barberId).profile;
        return normalizeClientPhone(otherProfile.phone) === selectedPhone;
    });
    
    // Правильная сортировка: от старых к новым
    const parseClientVisitTimestamp = booking => parseClientDateTime(booking);
    myBookings.sort((a, b) => parseClientVisitTimestamp(b) - parseClientVisitTimestamp(a));
    
    let total = 0;
    let completedRevenue = 0;
    let completedCount = 0;
    
    const historyHTML = myBookings.map(b => {
        const serviceTotal = (Array.isArray(b.services) ? b.services : []).reduce((sum, service) => {
            const amount = Number(service?.price);
            return sum + (Number.isFinite(amount) ? Math.max(0, amount) : 0);
        }, 0);
        const paymentState = getBookingPaymentState(b, serviceTotal);
        const paymentMethodKey = ['cash', 'card', 'transfer', 'online', 'mixed'].includes(paymentState.method)
            ? paymentState.method : 'other';
        const paymentMethodLabel = paymentState.methodLabel || 'Не указан';
        total += getBookingCollectedAmount(b);
        if (b.status === 'completed') {
            completedRevenue += getBookingCollectedAmount(b);
            completedCount++;
        }
        
        let statusIcon = '🕐';
        let statusColor = '#888';
        if (b.status === 'completed') { statusIcon = '✅'; statusColor = '#4CAF50'; }
        else if (b.status === 'cancelled') { statusIcon = '❌'; statusColor = '#ff4d4d'; }

        const servicesText = (b.services || []).map(s => escapeBookingHtml(s.title || 'Услуга')).join(', ');
        const masterName = mockStaff.find(s => s.id === b.barberId)?.name || '—';
        const sourceMeta = getBookingSourceMeta(b);
        const clientTypeMeta = getBookingClientTypeMeta(b);

        return `
            <article class="client-history-item status-${escapeBookingHtml(b.status || 'active')}">
                <div class="client-history-icon" aria-hidden="true">${statusIcon}</div>
                <div class="client-history-content">
                    <div class="client-history-date">${escapeBookingHtml(b.date)} в ${escapeBookingHtml(b.time)}</div>
                    <div class="booking-card-badges"><i class="booking-origin origin-${sourceMeta.className}">${sourceMeta.label}</i><i class="booking-client-type type-${clientTypeMeta.className}">${clientTypeMeta.label}</i></div>
                    <div class="client-history-services">${servicesText || 'Услуги не указаны'}</div>
                    <div class="client-history-master">Мастер: ${escapeBookingHtml(masterName)}</div>
                    <div class="client-history-payment">
                        Оплата: <b class="payment-state payment-${escapeBookingHtml(paymentState.status)}">${escapeBookingHtml(paymentState.label)}</b>
                        <span>${paymentState.paid.toLocaleString('ru-RU')} / ${serviceTotal.toLocaleString('ru-RU')} ₽</span>
                        <span class="finance-payment-method finance-payment-method--${paymentMethodKey}"><i></i>${escapeBookingHtml(paymentMethodLabel)}</span>
                    </div>
                </div>
            </article>
        `;
    }).join('');

    document.getElementById('clientDetailsName').innerText = name;
    selectedClientProfileKey = selectedProfile.key;
    clientProfiles[selectedClientProfileKey] = {
        ...mergedClientProfile,
        clientName: name,
        barberId
    };

    const profile = clientProfiles[selectedClientProfileKey] || {};

    document.getElementById('clientDetailsPhone').value = profile.phone || '';
    const birthdayInput = document.getElementById('clientDetailsBirthday');
    if (birthdayInput) birthdayInput.value = profile.birthday || '';
    const tagInput = document.getElementById('clientDetailsTag');
    if (tagInput) tagInput.value = profile.tag || 'regular';
    document.getElementById('clientDetailsNotes').value = profile.notes || '';
    const preferencesInput = document.getElementById('clientDetailsPreferences');
    if (preferencesInput) preferencesInput.value = profile.preferences || '';
    document.getElementById('clientDetailsMaster').innerText = mockStaff.find(s => String(s.id) === String(barberId))?.name || 'Мастер';
    document.getElementById('clientDetailsVisits').innerText = completedCount;
    document.getElementById('clientDetailsTotal').innerText = total + ' ₽';
    
    const cancelledCount = myBookings.filter(b => b.status === 'cancelled').length;
    const noShowCount = myBookings.filter(b => ['no_show', 'missed'].includes(String(b.status || '').toLowerCase())).length;
    const firstCompleted = [...myBookings].reverse().find(booking => booking.status === 'completed');
    const averageCheck = completedCount ? Math.round(completedRevenue / completedCount) : 0;
    const metrics = document.getElementById('clientDetailsMetrics');
    if (metrics) {
        const nextVisit = myBookings.filter(booking => booking.status !== 'cancelled' && parseClientDateTime(booking) >= Date.now())
            .sort((a,b) => parseClientDateTime(a) - parseClientDateTime(b))[0];
        const lastCompleted = myBookings.find(booking => booking.status === 'completed');
        metrics.innerHTML = `
            <span>Отмен: <b>${cancelledCount}</b></span>
            <span>Неявки: <b>${noShowCount}</b></span>
            <span>Средний чек: <b>${averageCheck.toLocaleString('ru-RU')} ₽</b></span>
            <span>Первый визит: <b>${firstCompleted ? escapeBookingHtml(firstCompleted.date) : '—'}</b></span>
            <span>Последний визит: <b>${lastCompleted ? escapeBookingHtml(lastCompleted.date) : '—'}</b></span>
            <span>Следующая запись: <b>${nextVisit ? escapeBookingHtml(nextVisit.date + ' · ' + nextVisit.time) : 'нет'}</b></span>
        `;
    }

    renderClientLoyaltyPanel(myBookings);

    const historyContainer = document.getElementById('clientDetailsHistory');
    if (historyContainer) {
        historyContainer.innerHTML = historyHTML || '<div style="color: var(--text-muted); font-size: 13px; text-align: center; padding: 20px 0;">История пуста</div>';
    }

    openModal('clientDetailsModal');
}
function createBookingForClient() {
    if (!selectedClientProfileKey) return;
    const profile = clientProfiles[selectedClientProfileKey] || {};
    const clientName = profile.clientName || document.getElementById('clientDetailsName')?.textContent || '';
    const barberId = String(profile.barberId || currentUser?.id || '');
    closeModal('clientDetailsModal');
    openNewBookingModal(barberId);
    const input = document.getElementById('newBookingClient');
    if (input) {
        input.value = clientName;
        input.dispatchEvent(new Event('input', { bubbles: true }));
    }
}
// --- ПРОФИЛЬ ---
function renderBarberRevenue() {
    const card = document.getElementById('barberRevenueCard');
    if (!currentUser) {
        if (card) card.style.display = 'none';
        return;
    }
    if (card) card.style.display = 'block';
    const today = new Date().toLocaleDateString('ru-RU');
    const revenueEl = document.getElementById('barberRevenue');
    const titleEl = document.getElementById('profileRevenueTitle');
    if (!revenueEl || !titleEl) return;
    if (isAdminUser()) {
        const totalRevenue = bookings.filter(item => item.date === today && item.status === 'completed')
            .reduce((sum,item) => sum + getBookingCollectedAmount(item),0);
        const totalExpenses = expenses.filter(item => item.date === today)
            .reduce((sum,item) => sum + Number(item.amount || 0),0);
        const profit = totalRevenue-totalExpenses;
        titleEl.textContent = 'Прибыль барбершопа за сегодня';
        revenueEl.textContent = Math.round(profit).toLocaleString('ru-RU') + ' ₽';
        revenueEl.style.color = profit >= 0 ? '#4CAF50' : '#ff4d4d';
    } else {
        const revenue = bookings.filter(item => String(item.barberId) === String(currentUser.id) && item.date === today && item.status === 'completed')
            .reduce((sum,item) => sum + getBookingCollectedAmount(item),0);
        titleEl.textContent = 'Моя доля за сегодня · 40%';
        revenueEl.textContent = Math.round(revenue * .4).toLocaleString('ru-RU') + ' ₽';
        revenueEl.style.color = 'var(--gold)';
    }
}
function renderProfileOverview() {
    const container = document.getElementById('profileOverview');
    if (!container || !currentUser) return;
    const now = new Date();
    const monthStart = new Date(now.getFullYear(),now.getMonth(),1);
    const parseDate = value => {
        const parts = String(value || '').split('.').map(Number);
        return parts.length === 3 && parts.every(Number.isFinite) ? new Date(parts[2],parts[1]-1,parts[0]) : null;
    };
    const scope = bookings.filter(item => {
        const date = parseDate(item.date);
        return date && date >= monthStart && (isAdminUser() || String(item.barberId) === String(currentUser.id));
    });
    const completed = scope.filter(item => item.status === 'completed');
    const collected = scope.reduce((sum,item) => sum + getBookingCollectedAmount(item),0);
    const clients = new Set(completed.map(item => String(item.clientName || '').trim().toLowerCase()).filter(Boolean));
    const due = scope.filter(item => item.status !== 'cancelled').reduce((sum,item) => {
        const total = (item.services || []).reduce((n,service) => n + Number(service.price || 0),0);
        return sum + Math.max(0,total-getBookingPaymentState(item,total).paid);
    },0);
    container.innerHTML = `
        <div class="profile-overview-card"><span>Визитов за месяц</span><strong>${completed.length}</strong></div>
        <div class="profile-overview-card"><span>${isAdminUser() ? 'Получено за месяц' : 'Моя выручка за месяц'}</span><strong>${Math.round(collected).toLocaleString('ru-RU')} ₽</strong></div>
        <div class="profile-overview-card"><span>Клиентов</span><strong>${clients.size}</strong></div>
        <div class="profile-overview-card"><span>Остаток к оплате</span><strong>${Math.round(due).toLocaleString('ru-RU')} ₽</strong></div>`;
}

/* Резервное копирование данных салона (хранение остаётся локальным). */
const MENSFIRE_BACKUP_KEYS = [
    'mensfire_admin_bookings',
    'mensfire_admin_blocks',
    'mensfire_admin_expenses',
    'mensfire_admin_staff',
    'mensfire_admin_services',
    'mensfire_client_profiles'
];

function exportMensfireBackup() {
    if (!requireAdminAction('Создавать резервные копии может только Али')) return;
    const data = {};
    MENSFIRE_BACKUP_KEYS.forEach(key => {
        const raw = localStorage.getItem(appStorageKey(key));
        if (raw !== null) {
            try { data[key] = JSON.parse(raw); }
            catch (error) { throw new Error('Не удалось прочитать данные для копии: ' + key); }
        } else {
            data[key] = key === 'mensfire_client_profiles' ? {} : [];
        }
    });

    const backup = {
        app: 'MENSFIRE',
        version: 1,
        createdAt: new Date().toISOString(),
        data
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'mensfire-backup-' + new Date().toISOString().slice(0, 10) + '.json';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showToast('Резервная копия скачана', 'success');
}

function importMensfireBackup(input) {
    if (!requireAdminAction('Восстанавливать резервные копии может только Али')) {
        if (input) input.value = '';
        return;
    }
    const file = input?.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
        let backup;
        try {
            backup = JSON.parse(String(reader.result || ''));
            if (backup?.app !== 'MENSFIRE' || backup?.version !== 1 || !backup.data) {
                throw new Error('Неподдерживаемый формат резервной копии');
            }
            const expected = {
                mensfire_admin_bookings: Array.isArray,
                mensfire_admin_blocks: Array.isArray,
                mensfire_admin_expenses: Array.isArray,
                mensfire_admin_staff: Array.isArray,
                mensfire_client_profiles: value => value && typeof value === 'object' && !Array.isArray(value)
            };
            for (const [key, validator] of Object.entries(expected)) {
                if (!validator(backup.data[key])) {
                    throw new Error('В копии отсутствуют или повреждены данные: ' + key);
                }
            }

            const staff = backup.data.mensfire_admin_staff;
            const staffIds = new Set();
            const staffPins = new Set();
            const hasAdmin = staff.some(member =>
                member && member.role === 'admin' && member.id && /^\d{4}$/.test(String(member.pin || ''))
            );
            if (!hasAdmin) {
                throw new Error('В резервной копии нет действующего администратора с корректным PIN. Восстановление отменено.');
            }
            for (const member of staff) {
                if (!member || typeof member.id !== 'string' || !member.id ||
                    typeof member.name !== 'string' || !member.name.trim() ||
                    !/^\d{4}$/.test(String(member.pin || '')) ||
                    staffIds.has(member.id) || staffPins.has(String(member.pin))) {
                    throw new Error('Список мастеров или PIN в резервной копии повреждён. Восстановление отменено.');
                }
                staffIds.add(member.id);
                staffPins.add(String(member.pin));
            }
        } catch (error) {
            showToast(error.message || 'Не удалось прочитать резервную копию', 'error');
            input.value = '';
            return;
        }

        showConfirm(
            'Восстановить резервную копию?',
            'Текущие записи, перерывы, расходы, мастера и карточки клиентов будут заменены данными из файла. Перед восстановлением скачай текущую копию.',
            'Восстановить',
            () => {
                MENSFIRE_BACKUP_KEYS.forEach(key => {
                    localStorage.setItem(appStorageKey(key), JSON.stringify(backup.data[key]));
                });
                showToast('Данные восстановлены. Перезагружаю приложение…', 'success');
                setTimeout(() => window.location.reload(), 700);
            }
        );
        input.value = '';
    };
    reader.onerror = () => {
        showToast('Не удалось прочитать выбранный файл', 'error');
        input.value = '';
    };
    reader.readAsText(file);
}

function openChangePasswordModal() {
    document.getElementById('newPin').value = '';
    openModal('passwordModal');
}

function changePassword() {
    const newPin = document.getElementById('newPin').value;
    if (!/^\d{4}$/.test(newPin)) return showToast('PIN должен состоять из 4 цифр', 'error');
    
    // Проверка, что PIN не занят другим мастером
    if (mockStaff.some(s => s.pin === newPin && s.id !== currentUser.id)) {
        return showToast('Этот PIN уже занят другим мастером', 'error');
    }

    const staff = mockStaff.find(s => s.id === currentUser.id);
    if (staff) {
        staff.pin = newPin;
        // Сессия не содержит PIN; сохраняем только обновлённые данные мастеров.
        localStorage.setItem(appStorageKey('mensfire_admin_staff'), JSON.stringify(mockStaff));
        closeModal('passwordModal');
        showToast('Пароль успешно изменен', 'success');
    }
}

// --- ИНТЕГРАЦИЯ С ПЕРЕКЛЮЧЕНИЕМ ЭКРАНОВ ---
// Переопределяем switchView из Части 1, чтобы добавлять вызов рендера при переходе
const originalSwitchView = switchView;
switchView = function(viewId, navElement) {
    originalSwitchView(viewId, navElement);
    
    if (viewId === 'viewSchedule') renderSchedule();
    if (viewId === 'viewFinance' && currentUser.role === 'admin') renderFinance();
    if (viewId === 'viewTeam' && currentUser.role === 'admin') renderTeam();
    if (viewId === 'viewClients') renderClients();
    
    if (viewId === 'viewProfile') {
        renderBarberRevenue();
        
        // Показываем левую колонку с командой на ПК
        if (currentUser.role === 'admin' && window.innerWidth >= 768) {
            document.getElementById('profileLeftCol').style.display = 'block';
            renderTeam();
        } else {
            document.getElementById('profileLeftCol').style.display = 'none';
        }
    }
};