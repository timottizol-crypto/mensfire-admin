/* =========================================
   ЧАСТЬ 1: БАЗА, АВТОРИЗАЦИЯ И НАВИГАЦИЯ
   ========================================= */

// --- МОК-ДАННЫЕ (В будущем заменятся на YCLIENTS API) ---
let mockStaff = [
    { id: 'b_al', name: 'Али', role: 'admin', pin: '1111', type: 'top' },
    { id: 'b_ben', name: 'Бенджо', role: 'barber', pin: '2222', type: 'barber' },
    { id: 'b_ism', name: 'Исмаил', role: 'barber', pin: '3333', type: 'barber' }
];

const servicesData = {
    top: [
        { id: 't1', title: 'Мужская стрижка', price: 1500, type: 'top' },
        { id: 't4', title: 'Стрижка + борода', price: 2500, type: 'top' },
        { id: 't3', title: 'Оформление бороды', price: 1200, type: 'top' }
    ],
    barber: [
        { id: 'b1', title: 'Мужская стрижка', price: 1300, type: 'barber' },
        { id: 'b2', title: 'Стрижка + борода', price: 2300, type: 'barber' },
        { id: 'b6', title: 'Оформление бороды', price: 1000, type: 'barber' }
    ]
};

let currentFinanceTab = 'expenses'; // По умолчанию Расходы

let currentUser = JSON.parse(localStorage.getItem('mensfire_admin_user')) || null;
// --- ГЕНЕРАЦИЯ ДЕМО-ДАННЫХ ---
function seedDatabase() {
    let existing = JSON.parse(localStorage.getItem('mensfire_admin_bookings')) || [];
    let hasOtherBarbers = existing.some(b => b.barberId === 'b_ben' || b.barberId === 'b_ism');
    
    if (existing.length > 5 && hasOtherBarbers) return; 
    
    let demoBookings = [];
    let demoExpenses = [];
    const staff = ['b_al', 'b_ben', 'b_ism'];
    const clients = ['Иван', 'Дмитрий', 'Сергей', 'Алексей', 'Максим', 'Андрей', 'Никита', 'Роман', 'Артем', 'Егор'];
    const servicesTop = servicesData.top;
    const servicesBarber = servicesData.barber;

    // Генерируем на 30 дней (от -7 до +22)
    for (let i = -7; i < 23; i++) {
        const d = new Date();
        d.setDate(d.getDate() + i);
        const dateStr = d.toLocaleDateString('ru-RU');

        staff.forEach(barberId => {
            const numBookings = Math.floor(Math.random() * 4) + 2; // 2-5 записей в день
            for (let j = 0; j < numBookings; j++) {
                const timeH = 10 + j * 2;
                const services = barberId === 'b_al' ? servicesTop : servicesBarber;
                const randomService = services[Math.floor(Math.random() * services.length)];
                
                let status = 'active';
                if (i < 0) status = 'completed';
                else if (i === 0 && timeH < new Date().getHours()) status = 'completed';

                demoBookings.push({
                    id: Date.now() + Math.random(),
                    barberId: barberId,
                    clientName: clients[Math.floor(Math.random() * clients.length)],
                    time: `${timeH.toString().padStart(2, '0')}:00`,
                    date: dateStr,
                    services: [randomService],
                    status: status
                });
            }
        });

        if (i % 2 === 0) {
            demoExpenses.push({
                id: Date.now() + Math.random(),
                title: ['Закупка кофе', 'Расходники', 'Химия', 'Аренда'][Math.floor(Math.random() * 4)],
                amount: Math.floor(Math.random() * 3000) + 500,
                date: dateStr
            });
        }
    }

    bookings = demoBookings;
    expenses = demoExpenses;
    localStorage.setItem('mensfire_admin_bookings', JSON.stringify(bookings));
    localStorage.setItem('mensfire_admin_expenses', JSON.stringify(expenses));
    localStorage.setItem('mensfire_db_seeded_v3', 'true');
}
let bookings = JSON.parse(localStorage.getItem('mensfire_admin_bookings')) || [];
let expenses = JSON.parse(localStorage.getItem('mensfire_admin_expenses')) || [];

// Запускаем генерацию при загрузке
seedDatabase();

let selectedBookingId = null;
let viewOrder = []; // Заполнится в зависимости от роли

// --- ИНИЦИАЛИЗАЦИЯ ---
window.addEventListener('DOMContentLoaded', () => {
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
            splashGreeting.innerHTML = `${greetingText}, <span>${currentUser.name}</span>`;
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
        currentUser = user;
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
    if (currentUser.role === 'admin') {
        document.getElementById('profileRevenueTitle').innerText = 'Прибыль барбершопа';
    } else {
        document.getElementById('profileRevenueTitle').innerText = 'Моя выручка за сегодня';
    }

    buildBottomNav();
    
        // Открываем первый экран по умолчанию
    const defaultView = 'viewSchedule';
    const defaultNav = document.querySelector(`.nav-item[data-view="${defaultView}"]`);
    switchView(defaultView, defaultNav);
    
    // Инициализируем данные (рендер расписания и т.д. - будет в части 2)
    if (typeof renderSchedule === 'function') renderSchedule();
}

function logout() {
    localStorage.removeItem('mensfire_admin_user');
    currentUser = null;
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById('viewLogin').classList.add('active');
    document.getElementById('headerTitle').innerText = 'Вход';
    showToast('Вы вышли из системы', 'info');
}

function buildBottomNav() {
    const nav = document.getElementById('bottomNav');
    nav.innerHTML = '<div class="nav-bubble" id="navBubble"></div>';
    
    let navItems = [];
    viewOrder = [];

    if (currentUser.role === 'admin') {
        const isPC = window.innerWidth >= 768;
        navItems = [
            { id: 'viewSchedule', title: 'Расписание', icon: '<path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM7 10h5v5H7z"/>' },
            { id: 'viewFinance', title: 'Финансы', icon: '<path d="M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z"/>' }
        ];
        
        // Добавляем "Команду" только если это НЕ ПК
        if (!isPC) {
            navItems.push({ id: 'viewTeam', title: 'Команда', icon: '<path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>' });
        }

        navItems.push(
            { id: 'viewClients', title: 'Клиенты', icon: '<path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>' },
            { id: 'viewProfile', title: 'Профиль', icon: '<path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>' }
        );
        
        viewOrder = navItems.map(item => item.id);
    } else {
        navItems = [
            { id: 'viewSchedule', title: 'Расписание', icon: '<path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM7 10h5v5H7z"/>' },
            { id: 'viewClients', title: 'Клиенты', icon: '<path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>' },
            { id: 'viewProfile', title: 'Профиль', icon: '<path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>' }
        ];
        viewOrder = ['viewSchedule', 'viewClients', 'viewProfile'];
    }

    navItems.forEach((item, index) => {
        const div = document.createElement('div');
        div.className = `nav-item ${index === 0 ? 'active' : ''}`;
        div.setAttribute('data-view', item.id);
        div.innerHTML = `<svg viewBox="0 0 24 24">${item.icon}</svg> ${item.title}`;
        div.onclick = () => switchView(item.id, div);
        nav.appendChild(div);
    });

    initNavBubble();
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
        'viewSchedule': 'Расписание',
        'viewFinance': 'Финансы',
        'viewTeam': 'Команда',
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
}

// --- ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ (UI) ---
function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span>${type==='error'?'⚠️':type==='success'?'✅':'ℹ️'}</span><span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(-10px)';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function openModal(id) {
    document.getElementById(id).classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeModal(id) {
    document.getElementById(id).classList.remove('active');
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
    if (e.target.closest('.home-scroll-area') || e.target.closest('.profile-history-scroll')) return; 
    touchStartX = e.changedTouches[0].screenX;
    touchStartY = e.changedTouches[0].screenY;
}, { passive: true });

document.addEventListener('touchend', e => {
    if (document.querySelector('.modal.active') || document.querySelector('.drawer.active')) return;
    if (e.target.closest('.home-scroll-area') || e.target.closest('.profile-history-scroll')) return; 
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
    const PRESSABLE = 'button, .nav-item, .glass-card, .home-cta-btn, .header-pill, .action-modal-btn, .checkout-btn, .logout-btn, [onclick]';
    let holdTimer = null;
    let pressedEl = null;
    let longPressFired = false;

    document.addEventListener('pointerdown', (e) => {
        if (e.button !== undefined && e.button !== 0) return;
        const el = e.target.closest(PRESSABLE);
        if (!el || el.disabled || el.classList.contains('disabled')) return;

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
            if (typeof showToast === 'function') showToast('Действие отменено', 'info');
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
mockStaff = JSON.parse(localStorage.getItem('mensfire_admin_staff')) || mockStaff;

// Дополнительные данные для блокировок
let timeBlocks = JSON.parse(localStorage.getItem('mensfire_admin_blocks')) || [];
// Выбранная дата в расписании (по умолчанию — сегодня)
let selectedScheduleDate = new Date().toLocaleDateString('ru-RU');
let currentScheduleTab = 'bookings'; // 'bookings' или 'breaks'
let selectedFinanceDate = new Date().toLocaleDateString('ru-RU');

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

        const hour = new Date().getHours();
        let greeting = "Доброй ночи";
        if (hour >= 5 && hour < 12) greeting = "Доброе утро";
        else if (hour >= 12 && hour < 18) greeting = "Добрый день";
        else if (hour >= 18 && hour < 23) greeting = "Добрый вечер";
        const greetEl = document.getElementById('scheduleGreeting');
        if (greetEl) greetEl.innerText = `${greeting}, ${currentUser.name}`;

        const isPC = window.innerWidth >= 768;
        if (emptyPhrasesTimer) clearInterval(emptyPhrasesTimer);

        const createCard = (b, isBlock) => {
            if (isBlock) {
                return `
                    <div class="home-booking-item" style="border-left-color: #888; opacity: 0.7; background: rgba(255,255,255,0.02); margin-bottom: 8px; padding: 12px; display: flex; justify-content: space-between; align-items: center;">
                        <div class="hb-info">
                            <div class="hb-date" style="color: #888; font-size: 13px;">${b.startTime} - ${b.endTime}</div>
                            <div class="hb-services" style="font-size: 11px;">Блокировка времени</div>
                        </div>
                    </div>
                `;
            } else {
                const servicesText = b.services.map(s => s.title).join(', ');
                let itemClass = b.status === 'completed' ? 'completed' : (b.status === 'cancelled' ? 'cancelled' : '');
                let statusBadge = '';
                if (b.status === 'completed') statusBadge = `<div class="status-badge completed" style="margin:0;">Завершена</div>`;
                else if (b.status === 'cancelled') statusBadge = `<div class="status-badge cancelled" style="margin:0;">Отменена</div>`;
                else statusBadge = `<div class="status-badge active" style="margin:0;">Активная</div>`;

                return `
                    <div class="home-booking-item ${itemClass}" onclick="openActionModal(${b.id})" style="cursor: pointer; margin-bottom: 8px; padding: 12px; display: flex; justify-content: space-between; align-items: flex-start; transition: transform 0.2s ease;">
                        <div class="hb-info" style="flex: 1; min-width: 0;">
                            <div class="hb-date" style="font-size: 14px;">${b.time}</div>
                            <div class="hb-master" style="font-size: 12px;">${currentUser.role === 'admin' ? mockStaff.find(s=>s.id === b.barberId)?.name + ' | ' : ''}${b.clientName}</div>
                            <div class="hb-services" style="font-size: 11px; white-space: normal;">${servicesText}</div>
                        </div>
                        <div style="flex-shrink: 0; margin-left: 10px;">
                            ${statusBadge}
                        </div>
                    </div>
                `;
            }
        };

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

                // ФИКС: Показываем только записи текущего пользователя (включая Админа)
                let filteredBookings = bookings.filter(b => b.date === dateStr && b.barberId === currentUser.id);
                let filteredBlocks = timeBlocks.filter(tb => tb.date === dateStr && tb.barberId === currentUser.id);

                filteredBookings.sort((a, b) => a.time.localeCompare(b.time));

                let cardsHtml = '';
                if (currentScheduleTab === 'bookings') {
                    filteredBookings.forEach(b => { cardsHtml += createCard(b, false); });
                } else {
                    filteredBlocks.forEach(tb => { cardsHtml += createCard(tb, true); });
                }

                html += `
                        <div style="flex: 0 0 300px; background: rgba(255,255,255,0.02); border-radius: 16px; padding: 15px; border: 1px solid rgba(255,255,255,0.05); display: flex; flex-direction: column;">
                        <div style="font-size: 13px; font-weight: 800; color: var(--gold); text-transform: uppercase; margin-bottom: 10px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 10px; display: flex; justify-content: space-between; flex-shrink: 0;">
                            <span>${dayName}</span>
                            <span>${d.getDate()}.${(d.getMonth()+1).toString().padStart(2, '0')}</span>
                        </div>
                        <div style="display: flex; flex-direction: column; overflow-y: auto; padding-right: 5px;">
                            ${cardsHtml || `<div style="color: var(--text-muted); font-size: 12px; padding: 10px 0;">Нет ${currentScheduleTab === 'bookings' ? 'записей' : 'перерывов'}</div>`}
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
            // ФИКС: Показываем только записи текущего пользователя
            let filteredBookings = bookings.filter(b => b.date === targetDate && b.barberId === currentUser.id);
            let filteredBlocks = timeBlocks.filter(tb => tb.date === targetDate && tb.barberId === currentUser.id);
            
            filteredBookings.sort((a, b) => a.time.localeCompare(b.time));

            let cardsHtml = '';
            if (currentScheduleTab === 'bookings') {
                filteredBookings.forEach(b => { cardsHtml += createCard(b, false); });
            } else {
                filteredBlocks.forEach(tb => { cardsHtml += createCard(tb, true); });
            }

            if (!cardsHtml) {
                const emptyText = currentScheduleTab === 'bookings' ? emptyPhrases[0] : "На этот день перерывов нет 😌";
                list.innerHTML = `<div class="empty-bookings-msg" id="emptyMsg" style="font-size: 16px; font-weight: 600; padding: 20px 0; transition: opacity 0.3s ease;">${emptyText}</div>`;
                
                if (currentScheduleTab === 'bookings') {
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
                list.innerHTML = cardsHtml;
            }
        }
        
        list.style.opacity = '1';
    }, 200);
}

function renderDateSelector() {
    const container = document.getElementById('scheduleDateSelector');
    if (!container) return;
    container.innerHTML = '';
    
    const days = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
    
    for (let i = 0; i < 30; i++) {
        const d = new Date();
        d.setDate(d.getDate() + i);
        const dateStr = d.toLocaleDateString('ru-RU');
        const dayName = i === 0 ? 'Сегодня' : i === 1 ? 'Завтра' : days[d.getDay()];
        
        const div = document.createElement('div');
        div.className = `date-selector-item ${selectedScheduleDate === dateStr ? 'selected' : ''}`;
        div.innerHTML = `
            <div class="day-name">${dayName}</div>
            <div class="day-num">${d.getDate()}</div>
        `;
        div.onclick = () => {
            selectedScheduleDate = dateStr;
            renderSchedule();
        };
        container.appendChild(div);
    }
}
function switchScheduleTab(tab) {
    currentScheduleTab = tab;
    document.getElementById('tabBookings').classList.toggle('active', tab === 'bookings');
    document.getElementById('tabBreaks').classList.toggle('active', tab === 'breaks');
    renderSchedule();
}

function openActionModal(id) {
    const booking = bookings.find(b => b.id === id);
    if (!booking || booking.status !== 'active') {
        showToast('Эта запись уже завершена или отменена', 'info');
        return;
    }
    selectedBookingId = id;
    openModal('actionModal');
}

function completeBooking() {
    const booking = bookings.find(b => b.id === selectedBookingId);
    if (booking) {
        booking.status = 'completed';
        localStorage.setItem('mensfire_admin_bookings', JSON.stringify(bookings));
        closeModal('actionModal');
        showToast('Запись завершена', 'success');
        renderSchedule();
        if (currentUser.role === 'admin') renderFinance();
        if (currentUser.role === 'barber') renderBarberRevenue();
    }
}

function cancelBooking() {
    const booking = bookings.find(b => b.id === selectedBookingId);
    if (booking) {
        booking.status = 'cancelled';
        localStorage.setItem('mensfire_admin_bookings', JSON.stringify(bookings));
        closeModal('actionModal');
        showToast('Запись отменена', 'success');
        renderSchedule();
        if (currentUser.role === 'admin') renderFinance();
    }
}

// --- БЛОКИРОВКА ВРЕМЕНИ ---
function openBlockTimeModal() {
    const today = new Date().toLocaleDateString('ru-RU');
    document.getElementById('blockDate').value = today;
    document.getElementById('blockStartTime').value = '';
    document.getElementById('blockEndTime').value = '';
    openModal('blockTimeModal');
}

function addTimeBlock() {
    const date = document.getElementById('blockDate').value;
    const start = document.getElementById('blockStartTime').value;
    const end = document.getElementById('blockEndTime').value;

    if (!start || !end) return showToast('Укажите время начала и конца', 'error');

    // Переводим время в минуты для удобного сравнения
    const [startH, startM] = start.split(':').map(Number);
    const [endH, endM] = end.split(':').map(Number);
    const newStart = startH * 60 + startM;
    const newEnd = endH * 60 + endM;

    if (newStart >= newEnd) {
        return showToast('Время окончания должно быть позже начала', 'error');
    }

    // Ищем активные записи этого мастера на выбранную дату
    const activeBookings = bookings.filter(b =>
        b.date === date &&
        b.barberId === currentUser.id &&
        b.status === 'active'
    );

    let hasOverlap = false;
    let conflictTime = '';

    activeBookings.forEach(b => {
        const [bH, bM] = b.time.split(':').map(Number);
        const bStart = bH * 60 + bM;
        const bEnd = bStart + 90; // Буфер 1.5 часа (90 минут) на стрижку

        // Проверка на пересечение интервалов
        if (newStart < bEnd && newEnd > bStart) {
            hasOverlap = true;
            conflictTime = b.time;
        }
    });

    if (hasOverlap) {
        return showToast(`Нельзя: пересекается с записью в ${conflictTime} (нужно минимум 1.5 ч)`, 'error');
    }

    const newBlock = {
        id: Date.now(),
        barberId: currentUser.id,
        date: date,
        startTime: start,
        endTime: end
    };

    timeBlocks.push(newBlock);
    localStorage.setItem('mensfire_admin_blocks', JSON.stringify(timeBlocks));
    
    closeModal('blockTimeModal');
    showToast('Время успешно заблокировано', 'success');
    renderSchedule();
}

function switchFinanceTab(tab) {
    currentFinanceTab = tab;
    document.getElementById('tabFinExpenses').classList.toggle('active', tab === 'expenses');
    document.getElementById('tabFinRevenue').classList.toggle('active', tab === 'revenue');
    document.getElementById('tabFinAnalytics').classList.toggle('active', tab === 'analytics');

    document.getElementById('finTabExpenses').style.display = tab === 'expenses' ? 'block' : 'none';
    document.getElementById('finTabRevenue').style.display = tab === 'revenue' ? 'flex' : 'none';
    document.getElementById('finTabAnalytics').style.display = tab === 'analytics' ? 'block' : 'none';

    renderFinance();
}

function renderFinanceDateSelector() {
    const container = document.getElementById('financeDateSelector');
    if (!container) return;
    container.innerHTML = '';
    
    const days = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
    
    // Генерируем от -7 (прошлая неделя) до +22 дней (будущее)
    for (let i = -7; i < 23; i++) {
        const d = new Date();
        d.setDate(d.getDate() + i);
        const dateStr = d.toLocaleDateString('ru-RU');
        let dayName = '';
        if (i === 0) dayName = 'Сегодня';
        else if (i === 1) dayName = 'Завтра';
        else if (i === -1) dayName = 'Вчера';
        else dayName = days[d.getDay()];
        
        const div = document.createElement('div');
        div.className = `date-selector-item ${selectedFinanceDate === dateStr ? 'selected' : ''}`;
        div.innerHTML = `
            <div class="day-name">${dayName}</div>
            <div class="day-num">${d.getDate()}</div>
        `;
        div.onclick = () => {
            selectedFinanceDate = dateStr;
            renderFinance();
        };
        container.appendChild(div);
    }

       // Скролл к выбранной дате (только внутри контейнера, без дергания страницы)
    setTimeout(() => {
        const selected = container.querySelector('.selected');
        if (selected) {
            const containerWidth = container.offsetWidth;
            const selectedLeft = selected.offsetLeft;
            const selectedWidth = selected.offsetWidth;
            container.scrollTo({
                left: selectedLeft - (containerWidth / 2) + (selectedWidth / 2),
                behavior: 'smooth'
            });
        }
    }, 50);
}

// --- ФИНАНСЫ (Только Админ) ---
function renderFinance() {
    renderFinanceDateSelector();
    
    const targetDate = selectedFinanceDate;
    
    // --- 1. ВЫРУЧКА И ПРИБЫЛЬ ---
    const revenueForDay = bookings
        .filter(b => b.date === targetDate && b.status === 'completed')
        .reduce((sum, b) => sum + b.services.reduce((s, serv) => s + serv.price, 0), 0);
    
    const expensesForDay = expenses.filter(e => e.date === targetDate);
    const totalExpensesDay = expensesForDay.reduce((sum, e) => sum + e.amount, 0);

    const revenueForMonth = bookings
        .filter(b => b.status === 'completed')
        .reduce((sum, b) => sum + b.services.reduce((s, serv) => s + serv.price, 0), 0);
    const totalExpensesMonth = expenses.reduce((sum, e) => sum + e.amount, 0);

    document.getElementById('financeToday').innerText = `${revenueForDay} ₽`;
    document.getElementById('financeWeek').innerText = `${revenueForDay * 5} ₽`;
    document.getElementById('financeMonth').innerText = `${revenueForMonth} ₽`;

    const profitDay = revenueForDay - totalExpensesDay;
    const profitMonth = revenueForMonth - totalExpensesMonth;
    
    const profitEl = document.getElementById('financeProfit');
    profitEl.innerText = `${profitDay} ₽`;
    profitEl.style.color = profitDay >= 0 ? '#4CAF50' : '#ff4d4d';

    document.getElementById('profitWeek').innerText = `${(revenueForDay * 5) - (totalExpensesDay * 5)} ₽`;
    document.getElementById('profitMonth').innerText = `${profitMonth} ₽`;

    // --- 2. РАСХОДЫ ---
    const expensesList = document.getElementById('expensesList');
    if (expensesForDay.length === 0) {
        expensesList.innerHTML = '<p style="font-size: 13px; color: var(--text-muted); text-align: center; padding: 20px 0;">Нет расходов за этот день</p>';
    } else {
        expensesList.innerHTML = expensesForDay.map(e => `
            <div style="display: flex; justify-content: space-between; font-size: 14px; margin-bottom: 10px; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 10px;">
                <span>${e.title}</span>
                <span style="color: #ff4d4d; font-weight: 600;">-${e.amount} ₽</span>
            </div>
        `).join('');
    }
    document.getElementById('financeMonthExpenses').innerText = `${totalExpensesMonth} ₽`;

        // --- 3. АНАЛИТИКА (КОМПАКТНАЯ) ---
    const dayBookings = bookings.filter(b => b.date === targetDate && b.status === 'completed');
    const clientsCount = dayBookings.length;

    const serviceCounts = {};
    dayBookings.forEach(b => {
        b.services.forEach(s => {
            serviceCounts[s.title] = (serviceCounts[s.title] || 0) + 1;
        });
    });
    let topService = '-';
    let maxCount = 0;
    for (const [title, count] of Object.entries(serviceCounts)) {
        if (count > maxCount) { maxCount = count; topService = title; }
    }

    const analyticsList = document.getElementById('analyticsHistoryList');
    
    // Блок за выбранный день (сверху)
    let analyticsHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 12px; background: rgba(212, 175, 55, 0.1); border-radius: 10px; border: 1px solid rgba(212, 175, 55, 0.3); margin-bottom: 10px;">
            <div>
                <div style="font-size: 14px; font-weight: 800; color: var(--gold);">${targetDate}</div>
                <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">Топ: <b>${topService}</b></div>
            </div>
            <div style="text-align: right;">
                <div style="font-size: 20px; font-weight: 800; color: var(--text-main); line-height: 1;">${clientsCount}</div>
                <div style="font-size: 9px; color: var(--text-muted);">клиентов</div>
            </div>
        </div>
        <div style="font-size: 10px; font-weight: 700; color: var(--text-muted); margin: 10px 0 5px 5px; text-transform: uppercase;">История за 30 дней</div>
    `;

    // История (компактные карточки)
    for (let i = 0; i < 30; i++) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = d.toLocaleDateString('ru-RU');
        if (dateStr === targetDate) continue; 
        
        const pastBookings = bookings.filter(b => b.date === dateStr && b.status === 'completed');
        const pastClients = pastBookings.length;

        const pastServices = {};
        pastBookings.forEach(b => {
            b.services.forEach(s => {
                pastServices[s.title] = (pastServices[s.title] || 0) + 1;
            });
        });
        let pastTop = '-';
        let pastMax = 0;
        for (const [title, count] of Object.entries(pastServices)) {
            if (count > pastMax) { pastMax = count; pastTop = title; }
        }

        if (pastClients > 0) {
            analyticsHTML += `
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; background: rgba(255,255,255,0.02); border-radius: 8px; border: 1px solid rgba(255,255,255,0.05); margin-bottom: 6px;">
                    <div>
                        <div style="font-size: 12px; font-weight: 700; color: var(--text-main);">${dateStr}</div>
                        <div style="font-size: 10px; color: var(--text-muted); margin-top: 1px;">${pastTop}</div>
                    </div>
                    <div style="font-size: 14px; font-weight: 800; color: var(--gold);">${pastClients} <span style="font-size: 10px; color: var(--text-muted);">чел.</span></div>
                </div>
            `;
        }
    }
    
    analyticsList.innerHTML = analyticsHTML;
}


function openExpenseModal() {
    document.getElementById('expenseTitle').value = '';
    document.getElementById('expenseAmount').value = '';
    openModal('expenseModal');
}

function addExpense() {
    const title = document.getElementById('expenseTitle').value;
    const amount = parseFloat(document.getElementById('expenseAmount').value);

    if (!title || isNaN(amount) || amount <= 0) return showToast('Заполните все поля', 'error');

    const newExpense = {
        id: Date.now(),
        title: title,
        amount: amount,
        date: selectedFinanceDate // <--- Берем выбранную дату!
    };

    expenses.push(newExpense);
    localStorage.setItem('mensfire_admin_expenses', JSON.stringify(expenses));
    closeModal('expenseModal');
    showToast(`Расход добавлен на ${selectedFinanceDate}`, 'success');
    renderFinance();
}

// --- КОМАНДА (Только Админ) ---
function renderTeam() {
    const listPC = document.getElementById('teamListPC');
    const listMobile = document.getElementById('teamList');
    
    if (mockStaff.length === 0) {
        const empty = '<p style="text-align: center; color: var(--text-muted);">Нет мастеров</p>';
        if (listPC) listPC.innerHTML = empty;
        if (listMobile) listMobile.innerHTML = empty;
        return;
    }

    const html = mockStaff.map(s => `
        <div class="glass-card" style="display: flex; flex-direction: column; gap: 10px; margin-bottom: 10px; padding: 15px;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <h3 style="font-size: 16px; color: var(--gold);">${s.name}</h3>
                    <p style="font-size: 12px; color: var(--text-muted);">${s.role === 'admin' ? 'Главный мастер' : 'Барбер'} | PIN: ${s.pin}</p>
                </div>
                <div style="display: flex; gap: 5px;">
                    <button class="action-modal-btn action-btn-primary" style="padding: 6px 10px; margin: 0; font-size: 11px; width: auto;" onclick="resetStaffPin('${s.id}')">Сбросить PIN</button>
                    ${s.role !== 'admin' ? `<button class="action-modal-btn action-btn-danger" style="padding: 6px 10px; margin: 0; font-size: 11px; width: auto;" onclick="deleteStaff('${s.id}')">Удалить</button>` : ''}
                </div>
            </div>
        </div>
    `).join('');

    if (listPC) listPC.innerHTML = html;
    if (listMobile) listMobile.innerHTML = html;
}

function openStaffModal() {
    document.getElementById('staffName').value = '';
    document.getElementById('staffPin').value = '';
    openModal('staffModal');
}

function addStaff() {
    const name = document.getElementById('staffName').value;
    const pin = document.getElementById('staffPin').value;

    if (!name || !pin || pin.length !== 4) return showToast('Введите имя и 4-значный PIN', 'error');
    if (mockStaff.some(s => s.pin === pin)) return showToast('Этот PIN уже занят', 'error');

    const newStaff = {
        id: 'b_' + Date.now(),
        name: name,
        role: 'barber',
        pin: pin,
        type: 'barber'
    };

    mockStaff.push(newStaff);
    localStorage.setItem('mensfire_admin_staff', JSON.stringify(mockStaff));
    closeModal('staffModal');
    showToast('Мастер добавлен', 'success');
    renderTeam();
}

function resetStaffPin(id) {
    const newPin = prompt('Введите новый PIN (4 цифры):');
    if (newPin && newPin.length === 4) {
        const staff = mockStaff.find(s => s.id === id);
        if (staff) {
            staff.pin = newPin;
            localStorage.setItem('mensfire_admin_staff', JSON.stringify(mockStaff));
            showToast('PIN обновлен', 'success');
            renderTeam();
        }
    } else if (newPin) {
        showToast('PIN должен состоять из 4 цифр', 'error');
    }
}

function deleteStaff(id) {
    if (confirm('Удалить мастера?')) {
        const index = mockStaff.findIndex(s => s.id === id);
        if (index !== -1) {
            mockStaff.splice(index, 1);
            localStorage.setItem('mensfire_admin_staff', JSON.stringify(mockStaff));
            showToast('Мастер удален', 'success');
            renderTeam();
        }
    }
}

// Добавь эту переменную в начало скрипта или прямо перед функцией
let currentClientsTab = 'all'; 

function renderClients(tab = 'all') {
    currentClientsTab = tab;
    const list = document.getElementById('clientsList');
    const tabsContainer = document.getElementById('clientsTabsContainer');
    const title = document.getElementById('clientsPageTitle');
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

    // 3. Фильтруем записи для подсчета
    let filteredBookings = bookings;
    
    // Если это барбер ИЛИ админ на вкладке "Мои клиенты" — фильтруем по ID
    if (currentUser.role === 'barber' || (currentUser.role === 'admin' && currentClientsTab === 'my')) {
        filteredBookings = filteredBookings.filter(b => b.barberId === currentUser.id);
    }

        // Собираем клиентов (привязка к мастеру, чтобы не сливались)
    const clients = {};
    filteredBookings.forEach(b => {
        const clientKey = b.clientName + '_' + b.barberId; 
        
        if (!clients[clientKey]) {
            clients[clientKey] = { name: b.clientName, barberId: b.barberId, visits: [], totalSpent: 0 };
        }
        clients[clientKey].visits.push(b);
        if (b.status === 'completed') {
            clients[clientKey].totalSpent += b.services.reduce((s, serv) => s + serv.price, 0);
        }
    });

    const clientArray = Object.values(clients).sort((a, b) => b.visits.length - a.visits.length);
    
    if (clientArray.length === 0) {
        list.innerHTML = '<div class="empty-bookings-msg" style="font-size: 16px;">Клиентов пока нет</div>';
        return;
    }

    // Выводим список
    list.innerHTML = clientArray.map(c => {
        const sortedVisits = c.visits.sort((a, b) => b.date.localeCompare(a.date));
        const lastVisit = sortedVisits[0];
        
        // Если это Админ на вкладке "Все", показываем мастера
        let masterBadge = '';
        if (currentUser.role === 'admin' && currentClientsTab === 'all') {
            const masterName = mockStaff.find(s => s.id === c.barberId)?.name || 'Мастер';
            masterBadge = `<div class="client-meta" style="color: var(--gold); font-size: 10px; margin-top: 4px;">Мастер: ${masterName}</div>`;
        }

        return `
            <div class="client-card" onclick="showClientDetails('${c.name}', '${c.barberId}')">
                <div class="client-avatar">${c.name.charAt(0).toUpperCase()}</div>
                <div class="client-info">
                    <div class="client-name">${c.name}</div>
                    <div class="client-meta">Визитов: <span class="gold-text">${c.visits.length}</span> · Потрачено: <span class="gold-text">${c.totalSpent} ₽</span></div>
                    <div class="client-meta">Последний: ${lastVisit.date} в ${lastVisit.time}</div>
                    ${masterBadge}
                </div>
            </div>
        `;
    }).join('');
}

function showClientDetails(name, barberId) {
    const myBookings = bookings.filter(b => b.clientName === name && b.barberId === barberId);
    myBookings.sort((a, b) => b.date.localeCompare(a.date));
    
    let total = 0;
    const history = myBookings.map(b => {
        if (b.status === 'completed') total += b.services.reduce((s, serv) => s + serv.price, 0);
        const statusText = b.status === 'completed' ? '✅' : (b.status === 'cancelled' ? '❌' : '🕐');
        const masterName = mockStaff.find(s => s.id === b.barberId)?.name || '—';
        return `${statusText} ${b.date} в ${b.time} — ${b.services.map(s => s.title).join(', ')} (${masterName})`;
    }).join('\n');
    
    const masterName = mockStaff.find(s => s.id === barberId)?.name || '';
    alert(`👤 ${name} ${currentUser.role === 'admin' && currentClientsTab === 'all' ? '(Мастер: ' + masterName + ')' : ''}\n\nВсего визитов: ${myBookings.length}\nПотрачено: ${total} ₽\n\nИстория:\n${history}`);
}
// --- ПРОФИЛЬ ---
function renderBarberRevenue() {
    const today = new Date().toLocaleDateString('ru-RU');
    const revenueEl = document.getElementById('barberRevenue');
    const titleEl = document.getElementById('profileRevenueTitle');

    if (currentUser.role === 'admin') {
        // АДМИН: Считаем общую прибыль (Вся выручка за сегодня - Все расходы за сегодня)
        const totalRevenue = bookings
            .filter(b => b.date === today && b.status === 'completed')
            .reduce((sum, b) => sum + b.services.reduce((s, serv) => s + serv.price, 0), 0);
        
        const totalExpenses = expenses
            .filter(e => e.date === today)
            .reduce((sum, e) => sum + e.amount, 0);

        const totalProfit = totalRevenue - totalExpenses;
        revenueEl.innerText = `${totalProfit} ₽`;
        revenueEl.style.color = totalProfit >= 0 ? '#4CAF50' : '#ff4d4d';
        
    } else {
        // БАРБЕР: Считаем его личную выручку (40%)
        const todayRevenue = bookings
            .filter(b => b.barberId === currentUser.id && b.date === today && b.status === 'completed')
            .reduce((sum, b) => sum + b.services.reduce((s, serv) => s + serv.price, 0), 0);
        
        const barberShare = Math.round(todayRevenue * 0.4);
        revenueEl.innerText = `${barberShare} ₽`;
        revenueEl.style.color = 'var(--gold)';
    }
}

function openChangePasswordModal() {
    document.getElementById('newPin').value = '';
    openModal('passwordModal');
}

function changePassword() {
    const newPin = document.getElementById('newPin').value;
    if (!newPin || newPin.length !== 4) return showToast('PIN должен состоять из 4 цифр', 'error');
    
    // Проверка, что PIN не занят другим мастером
    if (mockStaff.some(s => s.pin === newPin && s.id !== currentUser.id)) {
        return showToast('Этот PIN уже занят другим мастером', 'error');
    }

    const staff = mockStaff.find(s => s.id === currentUser.id);
    if (staff) {
        staff.pin = newPin;
        currentUser.pin = newPin;
        localStorage.setItem('mensfire_admin_user', JSON.stringify(currentUser));
        localStorage.setItem('mensfire_admin_staff', JSON.stringify(mockStaff));
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