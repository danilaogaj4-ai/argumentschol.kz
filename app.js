const API_BASE_URL = "https://script.google.com/macros/s/AKfycbwzqnbERDrU-i5MpHM3y8gqnTBcmRwsS7ME43gv1VXnc5I9MymPwJM9eGVjddnbLGQ7/exec";

// Универсальный загрузчик API, работающий как с локальным сервером, так и с Google Sheets
function apiFetch(endpoint, options = {}) {
    if (!API_BASE_URL) {
        // Локальный режим
        return fetch(endpoint, options);
    }

    // Режим Google Sheets (обход CORS-запросов)
    const url = new URL(API_BASE_URL);
    
    if (options.method === 'POST') {
        let action = '';
        if (endpoint.includes('/api/register')) action = 'register';
        else if (endpoint.includes('/api/user-status')) action = 'update-user-status';
        else if (endpoint.includes('/api/registrations/clear')) action = 'clear-registrations';
        
        let bodyData = {};
        try {
            bodyData = options.body ? JSON.parse(options.body) : {};
        } catch (e) {
            console.error('Ошибка парсинга тела запроса:', e);
        }
        bodyData.action = action;
        
        // Отправляем как text/plain, чтобы избежать CORS preflight OPTIONS запроса
        return fetch(API_BASE_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'text/plain'
            },
            body: JSON.stringify(bodyData)
        });
    } else {
        // GET-запросы
        let action = '';
        if (endpoint.includes('/api/registrations')) {
            action = 'registrations';
            url.searchParams.set('action', action);
        } else if (endpoint.includes('/api/user-status')) {
            action = 'user-status';
            url.searchParams.set('action', action);
            
            // Извлекаем phone из query params исходного URL
            const queryPart = endpoint.split('?')[1];
            if (queryPart) {
                const params = new URLSearchParams(queryPart);
                const phone = params.get('phone');
                if (phone) {
                    url.searchParams.set('phone', phone);
                }
            }
        }
        
        return fetch(url.toString());
    }
}

document.addEventListener('DOMContentLoaded', () => {
    // State management
    let currentUser = JSON.parse(localStorage.getItem('currentUser')) || null;
    let selectedCourse = {
        level: 'Beginner',
        format: 'Индивидуально',
        language: 'Русский',
        proLectures: []
    };
    let selectedSlots = [];
    let isPromoActionTriggered = false;

    // Elements
    const authModal = document.getElementById('authModal');
    const authStep1 = document.getElementById('authStep1');
    const authStep2 = document.getElementById('authStep2');
    const closeAuthBtn = document.getElementById('closeAuthBtn');
    const googleLoginBtn = document.getElementById('googleLoginBtn');
    const authDetailsForm = document.getElementById('authDetailsForm');
    const authNameInput = document.getElementById('authName');
    const authPhoneInput = document.getElementById('authPhone');
    
    const profileModal = document.getElementById('profileModal');
    const closeProfileBtn = document.getElementById('closeProfileBtn');
    const navProfileBtn = document.getElementById('navProfileBtn');
    const profileDot = document.getElementById('profileDot');
    const profileInfoName = document.getElementById('profileInfoName');
    const profileInfoPhone = document.getElementById('profileInfoPhone');
    const profileInfoStatus = document.getElementById('profileInfoStatus');
    const profileAvatarInitials = document.getElementById('profileAvatarInitials');
    const logoutBtn = document.getElementById('logoutBtn');
    const downloadGuideBtn = document.getElementById('downloadGuideBtn');

    const promoLinkHere = document.getElementById('promoLinkHere');
    const bonusNotification = document.getElementById('bonusNotification');

    const proBuilderOpenBtn = document.getElementById('proBuilderOpenBtn');
    const proModal = document.getElementById('proModal');
    const closeProModalBtn = document.getElementById('closeProModalBtn');
    const proTopicCheckboxes = document.querySelectorAll('.pro-topic-checkbox');
    const builderCounter = document.getElementById('builderCounter');
    const saveProConfigBtn = document.getElementById('saveProConfigBtn');
    const proSelectedTopicsList = document.getElementById('proSelectedTopicsList');

    const selectCourseBtns = document.querySelectorAll('.select-course-btn');
    const selectedCourseSummaryBox = document.getElementById('selectedCourseSummaryBox');
    const sumLevel = document.getElementById('sumLevel');
    const sumFormat = document.getElementById('sumFormat');
    const sumLang = document.getElementById('sumLang');
    const sumProTopicsContainer = document.getElementById('sumProTopicsContainer');
    const sumProTopics = document.getElementById('sumProTopics');

    const debateForm = document.getElementById('debateForm');
    const firstNameInput = document.getElementById('firstName');
    const lastNameInput = document.getElementById('lastName');
    const phoneInput = document.getElementById('phoneNumber');
    
    const schedulerGrid = document.getElementById('schedulerGrid');
    const successModal = document.getElementById('successModal');
    const closeModalBtn = document.getElementById('closeModalBtn');

    // ==========================================================================
    // Phone Number Formatting Input Mask (+7 (XXX) XXX-XX-XX)
    // ==========================================================================
    // Маска телефона убрана — обычное текстовое поле
    function setupPhoneMask(inputElement) { /* убрано */ }
    setupPhoneMask(phoneInput);
    setupPhoneMask(authPhoneInput);


    // ==========================================================================
    // Authorization & Profile State Logic
    // ==========================================================================
    function updateProfileUI() {
        if (currentUser) {
            // Logged in
            if (profileInfoName) profileInfoName.textContent = currentUser.name;
            if (profileInfoPhone) profileInfoPhone.textContent = currentUser.phone;
            
            // Generate avatar initials
            if (profileAvatarInitials) {
                const parts = currentUser.name.trim().split(' ');
                const initials = parts.map(p => p[0]).join('').substring(0, 2).toUpperCase();
                profileAvatarInitials.textContent = initials || '👤';
            }

            // Sync status from server
            apiFetch(`/api/user-status?phone=${encodeURIComponent(currentUser.phone)}`)
                .then(res => res.json())
                .then(data => {
                    currentUser.status = data.status || 'Нет полного доступа';
                    localStorage.setItem('currentUser', JSON.stringify(currentUser));
                    
                    if (profileInfoStatus) {
                        const isBought = currentUser.status === 'Куплен';
                        profileInfoStatus.textContent = isBought ? '✅ Полный доступ' : '🔒 Нет полного доступа';
                        profileInfoStatus.className = 'status-badge ' + 
                            (isBought ? 'status-bought' : 'status-unbought');
                    }
                })
                .catch(() => {
                    // Fallback to local
                    if (profileInfoStatus) {
                        const isBought = currentUser.status === 'Куплен';
                        profileInfoStatus.textContent = isBought ? '✅ Полный доступ' : '🔒 Нет полного доступа';
                        profileInfoStatus.className = 'status-badge ' + 
                            (isBought ? 'status-bought' : 'status-unbought');
                    }
                });

            // Pre-fill main registration form
            if (firstNameInput && !firstNameInput.value) {
                const nameParts = currentUser.name.split(' ');
                firstNameInput.value = nameParts[0] || '';
                if (lastNameInput && nameParts.length > 1 && !lastNameInput.value) {
                    lastNameInput.value = nameParts.slice(1).join(' ');
                }
            }
            if (phoneInput && !phoneInput.value) {
                phoneInput.value = currentUser.phone;
            }
        } else {
            // Not logged in
            if (profileDot) profileDot.classList.remove('active');
        }
    }
    updateProfileUI();

    // Check if user should have a red notification dot (Mock flow: login immediately triggers dot)
    if (localStorage.getItem('showProfileNotification') === 'true') {
        if (profileDot) profileDot.classList.add('active');
    }

    // Google Sign-In click
    if (googleLoginBtn) {
        googleLoginBtn.addEventListener('click', () => {
            authStep1.style.display = 'none';
            authStep2.style.display = 'block';
        });
    }

    // Submit details form (finish login)
    if (authDetailsForm) {
        authDetailsForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const name = authNameInput.value.trim();
            const phone = authPhoneInput.value;
            
            if (name && phone.trim()) {
                currentUser = { name, phone, status: 'Нет полного доступа' };
                localStorage.setItem('currentUser', JSON.stringify(currentUser));
                
                // Hide modal
                authModal.classList.remove('open');
                
                // Sync status with DB
                apiFetch('/api/user-status', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ phoneNumber: phone, firstName: name, status: 'Не куплен' })
                });

                updateProfileUI();

                // If promo link was clicked
                if (isPromoActionTriggered) {
                    triggerGuideDownload();
                } else {
                    // Normal login: alert in profile icon
                    localStorage.setItem('showProfileNotification', 'true');
                    if (profileDot) profileDot.classList.add('active');
                }
                
                // Reset auth forms
                authDetailsForm.reset();
                authStep1.style.display = 'block';
                authStep2.style.display = 'none';
            }
        });
    }

    // Profile Navigation button click
    if (navProfileBtn) {
        navProfileBtn.addEventListener('click', () => {
            if (currentUser) {
                // Clear notification dot
                localStorage.removeItem('showProfileNotification');
                if (profileDot) profileDot.classList.remove('active');
                
                // Open Profile modal
                profileModal.classList.add('open');
                updateProfileUI();
            } else {
                // Open Login modal
                isPromoActionTriggered = false;
                authModal.classList.add('open');
            }
        });
    }

    // Close Modals buttons
    if (closeAuthBtn) closeAuthBtn.addEventListener('click', () => authModal.classList.remove('open'));
    if (closeProfileBtn) closeProfileBtn.addEventListener('click', () => profileModal.classList.remove('open'));
    
    // Logout
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            localStorage.removeItem('currentUser');
            localStorage.removeItem('showProfileNotification');
            currentUser = null;
            profileModal.classList.remove('open');
            updateProfileUI();
            
            // Clear inputs that were auto-filled
            if (firstNameInput) firstNameInput.value = '';
            if (lastNameInput) lastNameInput.value = '';
            if (phoneInput) phoneInput.value = '';
        });
    }

    // ==========================================================================
    // Promo Link / Guide Download & Progress Bar
    // ==========================================================================
    if (promoLinkHere) {
        promoLinkHere.addEventListener('click', () => {
            if (currentUser) {
                // Already logged in, start download directly
                triggerGuideDownload();
            } else {
                // Set flag to download immediately after login
                isPromoActionTriggered = true;
                authModal.classList.add('open');
            }
        });
    }

    // Download button inside profile
    if (downloadGuideBtn) {
        downloadGuideBtn.addEventListener('click', () => {
            showBonusNotification();
        });
    }

    function triggerGuideDownload() {
        showBonusNotification();
        
        // Trigger programmatic download of pdf file
        const link = document.createElement('a');
        link.href = 'подготовка к турниру.pdf';
        link.download = 'подготовка к турниру.pdf';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    function showBonusNotification() {
        if (bonusNotification) {
            bonusNotification.classList.add('show');
            setTimeout(() => {
                bonusNotification.classList.remove('show');
            }, 5000);
        }
    }

    // ==========================================================================
    // Course Level Selectors & Live summary Box updates
    // ==========================================================================
    function updateCourseChoices() {
        // Find checked format/lang for active level
        const level = selectedCourse.level;
        const formatRadio = document.querySelector(`input[name="format-${level.toLowerCase()}"]:checked`);
        const langRadio = document.querySelector(`input[name="lang-${level.toLowerCase()}"]:checked`);
        
        selectedCourse.format = formatRadio ? formatRadio.value : 'Индивидуально';
        selectedCourse.language = langRadio ? langRadio.value : 'Русский';

        // Update visual details summary box
        if (selectedCourseSummaryBox) {
            selectedCourseSummaryBox.style.display = 'block';
            if (sumLevel) sumLevel.textContent = selectedCourse.level;
            if (sumFormat) sumFormat.textContent = selectedCourse.format;
            if (sumLang) sumLang.textContent = selectedCourse.language;
            
            if (level === 'Pro' && selectedCourse.proLectures.length > 0) {
                if (sumProTopicsContainer) sumProTopicsContainer.style.display = 'block';
                if (sumProTopics) {
                    sumProTopics.innerHTML = '';
                    selectedCourse.proLectures.forEach(topic => {
                        const li = document.createElement('li');
                        li.textContent = topic;
                        sumProTopics.appendChild(li);
                    });
                }
            } else {
                if (sumProTopicsContainer) sumProTopicsContainer.style.display = 'none';
            }
        }
    }

    // Add change listeners to all radios inside format-cards to sync dynamically
    document.querySelectorAll('.format-card input[type="radio"]').forEach(radio => {
        radio.addEventListener('change', () => {
            const cardLevel = radio.closest('.format-card').getAttribute('data-level');
            if (cardLevel === selectedCourse.level) {
                updateCourseChoices();
            }
        });
    });

    // Select course levels buttons listener
    selectCourseBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const level = btn.getAttribute('data-level');
            
            // Check if level is Pro and no lectures are chosen
            if (level === 'Pro' && selectedCourse.proLectures.length < 8) {
                // Force user to open builder first
                e.preventDefault();
                proModal.classList.add('open');
                return;
            }

            selectedCourse.level = level;
            
            // Highlight active card
            document.querySelectorAll('.format-card').forEach(card => {
                card.style.borderColor = 'var(--card-border)';
                card.style.borderWidth = '1px';
            });
            const activeCard = btn.closest('.format-card');
            if (activeCard) {
                activeCard.style.borderColor = 'var(--primary-color)';
                activeCard.style.borderWidth = '2px';
            }

            updateCourseChoices();
        });
    });

    // ==========================================================================
    // Pro Course Configurator Builder Logic (exactly 8 topics selection)
    // ==========================================================================
    if (proBuilderOpenBtn) {
        proBuilderOpenBtn.addEventListener('click', () => {
            proModal.classList.add('open');
        });
    }

    if (closeProModalBtn) {
        closeProModalBtn.addEventListener('click', () => {
            proModal.classList.remove('open');
        });
    }

    proTopicCheckboxes.forEach(checkbox => {
        checkbox.addEventListener('change', () => {
            const checkedCount = document.querySelectorAll('.pro-topic-checkbox:checked').length;
            
            if (builderCounter) builderCounter.textContent = checkedCount;

            // Enforce select exactly 8 rules: disable unselected checkboxes when count = 8
            if (checkedCount === 8) {
                proTopicCheckboxes.forEach(cb => {
                    if (!cb.checked) cb.disabled = true;
                });
                if (saveProConfigBtn) saveProConfigBtn.disabled = false;
            } else {
                proTopicCheckboxes.forEach(cb => cb.disabled = false);
                if (saveProConfigBtn) saveProConfigBtn.disabled = true;
            }
        });
    });

    if (saveProConfigBtn) {
        saveProConfigBtn.addEventListener('click', () => {
            const selected = [];
            document.querySelectorAll('.pro-topic-checkbox:checked').forEach(cb => {
                selected.push(cb.value);
            });
            
            selectedCourse.proLectures = selected;
            
            // Display selected items in Pro card list
            if (proSelectedTopicsList) {
                proSelectedTopicsList.innerHTML = '';
                selected.forEach(topic => {
                    const li = document.createElement('li');
                    li.textContent = topic;
                    proSelectedTopicsList.appendChild(li);
                });
            }

            proModal.classList.remove('open');

            // Automatically switch level to Pro
            selectedCourse.level = 'Pro';
            
            // Update active styles
            document.querySelectorAll('.format-card').forEach(card => {
                card.style.borderColor = 'var(--card-border)';
                card.style.borderWidth = '1px';
            });
            const proCard = document.querySelector('.format-card[data-level="Pro"]');
            if (proCard) {
                proCard.style.borderColor = 'var(--primary-color)';
                proCard.style.borderWidth = '2px';
            }

            updateCourseChoices();
        });
    }

    // ==========================================================================
    // Tooltips on format 'i' icons
    // ==========================================================================
    const infoIcons = document.querySelectorAll('.info-icon');
    const formatTooltip = document.getElementById('formatTooltip');
    const tooltipText = document.getElementById('tooltipText');

    infoIcons.forEach(icon => {
        icon.addEventListener('mouseenter', (e) => {
            const cardLevel = icon.closest('.format-card').getAttribute('data-level');
            const formatRadio = document.querySelector(`input[name="format-${cardLevel.toLowerCase()}"]:checked`);
            const val = formatRadio ? formatRadio.value : 'Индивидуально';
            
            let text = '';
            if (val === 'Индивидуально') {
                text = 'Личный ментор, постоянная связь с ним, выстраивание индивидуальной стратегии с личным тренером.';
            } else {
                text = 'Совместный чат с тренером, совместное проведение раундов, группы по 5-6 человек одного возраста с вами.';
            }

            if (tooltipText && formatTooltip) {
                tooltipText.textContent = text;
                formatTooltip.style.display = 'block';
                
                // Position tooltip above icon
                const rect = icon.getBoundingClientRect();
                formatTooltip.style.left = `${rect.left + window.scrollX - 20}px`;
                formatTooltip.style.top = `${rect.top + window.scrollY - formatTooltip.offsetHeight - 10}px`;
            }
        });

        icon.addEventListener('mouseleave', () => {
            if (formatTooltip) formatTooltip.style.display = 'none';
        });
    });

    // ==========================================================================
    // Render Scheduler Grid (Exact hours Пн-Вс: 10:00 - 21:00)
    // ==========================================================================
    const hours = ['10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00'];
    const days = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

    if (schedulerGrid) {
        // Hours rendering starting from row 2
        hours.forEach(hour => {
            // 1. Hour label cell
            const labelCell = document.createElement('div');
            labelCell.className = 'hour-label-cell';
            labelCell.textContent = hour;
            schedulerGrid.appendChild(labelCell);

            // 2. 7 days slots
            days.forEach(day => {
                const slot = document.createElement('div');
                slot.className = 'time-slot';
                slot.setAttribute('data-day', day);
                slot.setAttribute('data-hour', hour);
                
                slot.addEventListener('click', () => {
                    slot.classList.toggle('selected');
                    const slotId = `${day} - ${hour}`;
                    
                    if (slot.classList.contains('selected')) {
                        selectedSlots.push(slotId);
                        if (slotsError) slotsError.style.display = 'none';
                    } else {
                        selectedSlots = selectedSlots.filter(s => s !== slotId);
                    }
                });

                schedulerGrid.appendChild(slot);
            });
        });
    }

    // ==========================================================================
    // Main Registration Form Submission
    // ==========================================================================
    if (debateForm) {
        debateForm.addEventListener('submit', (e) => {
            e.preventDefault();
            
            let isValid = true;
            
            // Errors
            const firstNameError = document.getElementById('firstNameError');
            const lastNameError = document.getElementById('lastNameError');
            const phoneError = document.getElementById('phoneError');
            const slotsError = document.getElementById('slotsError');

            firstNameInput.classList.remove('invalid');
            lastNameInput.classList.remove('invalid');
            phoneInput.classList.remove('invalid');
            if (firstNameError) firstNameError.style.display = 'none';
            if (lastNameError) lastNameError.style.display = 'none';
            if (phoneError) phoneError.style.display = 'none';
            if (slotsError) slotsError.style.display = 'none';

            // Validate fields
            if (!firstNameInput.value.trim()) {
                firstNameInput.classList.add('invalid');
                if (firstNameError) firstNameError.style.display = 'block';
                isValid = false;
            }

            if (!lastNameInput.value.trim()) {
                lastNameInput.classList.add('invalid');
                if (lastNameError) lastNameError.style.display = 'block';
                isValid = false;
            }

            if (!phoneInput.value.trim()) {
                phoneInput.classList.add('invalid');
                if (phoneError) phoneError.style.display = 'block';
                isValid = false;
            }

            if (selectedSlots.length === 0) {
                if (slotsError) slotsError.style.display = 'block';
                isValid = false;
            }

            if (isValid) {
                // Pre-submit courses choices check
                updateCourseChoices();

                const payload = {
                    firstName: firstNameInput.value.trim(),
                    lastName: lastNameInput.value.trim(),
                    phoneNumber: phoneInput.value,
                    slots: selectedSlots,
                    courseLevel: selectedCourse.level,
                    format: selectedCourse.format,
                    language: selectedCourse.language,
                    selectedLectures: selectedCourse.level === 'Pro' ? selectedCourse.proLectures : []
                };

                // Сохраняем в localStorage (работает на любом хостинге без сервера)
                function saveToLocalStorage(p) {
                    var stored = JSON.parse(localStorage.getItem('registrations') || '[]');
                    stored.push(Object.assign({ id: Date.now().toString(), timestamp: new Date().toISOString() }, p));
                    localStorage.setItem('registrations', JSON.stringify(stored));
                }

                function showSuccessModal(p) {
                    var summaryName     = document.getElementById('summaryName');
                    var summaryPhone    = document.getElementById('summaryPhone');
                    var sumModalLevel   = document.getElementById('sumModalLevel');
                    var sumModalFormat  = document.getElementById('sumModalFormat');
                    var sumModalLang    = document.getElementById('sumModalLang');
                    var summarySlotsDiv = document.getElementById('summarySlots');

                    if (summaryName)    summaryName.textContent  = p.firstName + ' ' + p.lastName;
                    if (summaryPhone)   summaryPhone.textContent = p.phoneNumber;
                    if (sumModalLevel)  sumModalLevel.textContent  = p.courseLevel;
                    if (sumModalFormat) sumModalFormat.textContent = p.format;
                    if (sumModalLang)   sumModalLang.textContent   = p.language;

                    if (summarySlotsDiv) {
                        summarySlotsDiv.innerHTML = '';
                        p.slots.forEach(function(slot) {
                            var badge = document.createElement('span');
                            badge.className = 'summary-slot-badge';
                            badge.textContent = slot;
                            summarySlotsDiv.appendChild(badge);
                        });
                    }

                    if (successModal) successModal.classList.add('open');
                    debateForm.reset();
                    document.querySelectorAll('.time-slot').forEach(function(s) { s.classList.remove('selected'); });
                    selectedSlots = [];
                    updateProfileUI();
                }

                // Сохраняем локально и показываем успех
                saveToLocalStorage(payload);
                showSuccessModal(payload);

                // Параллельно пробуем отправить на сервер (если есть) — тихо
                try {
                    apiFetch('/api/register', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    }).catch(function() { /* сервер недоступен — данные уже в localStorage */ });
                } catch(e) { /* игнорируем */ }
            }
        });
    }

    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', () => {
            successModal.classList.remove('open');
        });
    }

    // Логика кота-помощника удалена по запросу пользователя
});
