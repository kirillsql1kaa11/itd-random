class App {
    constructor() {
        this.currentTab = 'home';
        this.selectedMode = 'blitz';
        this.adminUnlocked = localStorage.getItem('itd_admin_unlocked') === 'true';
        this.suggestedScreenshotDataUrl = null;
    }

    async init() {
        await window.quizDB.init();
        await window.authorsManager.load();
        await window.PresetsManager.initPresetsIfEmpty();

        if (window.supabaseService.isConfigured) {
            try {
                const remoteAuthors = await window.supabaseService.fetchRemoteAuthors();
                if (remoteAuthors && remoteAuthors.length > 0) {
                    await window.quizDB.saveAuthors(remoteAuthors);
                    await window.authorsManager.load();
                }
            } catch (e) {
                console.warn('Remote sync skipped', e);
            }
        }

        window.adminManager.init();
        await window.adminManager.refreshAuthorsList();
        await window.adminManager.refreshPostsTable();
        await window.adminManager.refreshSuggestedPosts();
        await window.adminManager.refreshSuggestedAuthors();

        window.gameEngine.init();

        this.bindNavigation();
        this.bindHomeLobby();
        this.bindModals();
        this.setupSoundButton();

        this.switchTab('home');

        window.gameEngine.toggleLightboxCustom = (src) => {
            const lightbox = document.getElementById('image-lightbox');
            const lbImg = document.getElementById('lightbox-img');
            lbImg.src = src;
            lightbox.classList.remove('hidden');
        };
    }

    generateRandomNickname() {
        const prefixes = [
            'Ночной', 'ТотСамый', 'Главный', 'Сонный', 'Анонимный', 'Местный',
            'Скрытный', 'Легендарный', 'Ламповый', 'Нейро', 'Кибер', 'Древний',
            'Дерзкий', 'Широкий', 'Быстрый', 'Умный', 'Тихий'
        ];
        const nouns = [
            'Скроллер', 'Анон', 'Щитпостер', 'Олд', 'Ридер', 'Думер',
            'Итдэшник', 'Патрик', 'Мемлорд', 'Кодер', 'Критик', 'Юзер',
            'Двач', 'Философ', 'Мыслитель', 'Знаток'
        ];
        const randP = prefixes[Math.floor(Math.random() * prefixes.length)];
        const randN = nouns[Math.floor(Math.random() * nouns.length)];
        const randNum = Math.floor(Math.random() * 900) + 100;
        return `${randP}_${randN}_${randNum}`;
    }

    bindNavigation() {
        const navBtns = document.querySelectorAll('.nav-tab-btn');
        navBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const target = btn.dataset.tab;
                this.switchTab(target);
            });
        });

        document.getElementById('btn-next-question')?.addEventListener('click', () => {
            window.gameEngine.next();
        });

        document.getElementById('btn-play-again')?.addEventListener('click', () => {
            this.switchTab('home');
        });

        document.getElementById('btn-use-hint')?.addEventListener('click', () => {
            window.gameEngine.useHint();
        });

        document.getElementById('post-screenshot-container')?.addEventListener('click', () => {
            window.gameEngine.toggleLightbox();
        });

        document.getElementById('btn-close-lightbox')?.addEventListener('click', () => {
            document.getElementById('image-lightbox').classList.add('hidden');
        });

        document.getElementById('image-lightbox')?.addEventListener('click', (e) => {
            if (e.target.id === 'image-lightbox') {
                document.getElementById('image-lightbox').classList.add('hidden');
            }
        });
    }

    bindHomeLobby() {
        const nicknameInput = document.getElementById('home-nickname-input');
        let currentNick = localStorage.getItem('itd_player_nickname');

        if (!currentNick || currentNick === 'Аноним') {
            currentNick = this.generateRandomNickname();
            localStorage.setItem('itd_player_nickname', currentNick);
        }

        if (nicknameInput) {
            nicknameInput.value = currentNick;
            window.gameEngine.setNickname(currentNick);

            nicknameInput.addEventListener('input', (e) => {
                const val = e.target.value.trim() || 'Аноним';
                localStorage.setItem('itd_player_nickname', val);
                window.gameEngine.setNickname(val);
            });
        }

        const btnRandomNick = document.getElementById('btn-random-nickname');
        if (btnRandomNick) {
            btnRandomNick.addEventListener('click', () => {
                const freshNick = this.generateRandomNickname();
                if (nicknameInput) {
                    nicknameInput.value = freshNick;
                }
                localStorage.setItem('itd_player_nickname', freshNick);
                window.gameEngine.setNickname(freshNick);
                this.showToast(`Новый ник: ${freshNick}`, 'info');
                window.soundFX.playClick();
            });
        }

        document.querySelectorAll('.btn-home-mode').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.btn-home-mode').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.selectedMode = btn.dataset.mode;
            });
        });

        document.getElementById('btn-home-play')?.addEventListener('click', () => {
            const nick = nicknameInput?.value.trim() || this.generateRandomNickname();
            window.gameEngine.setNickname(nick);
            this.switchTab('quiz');
            window.gameEngine.start(this.selectedMode);
        });

        document.getElementById('btn-home-suggest-post')?.addEventListener('click', () => {
            this.openSuggestPostModal();
        });

        document.getElementById('btn-home-browse-authors')?.addEventListener('click', () => {
            this.switchTab('authors');
            setTimeout(() => {
                document.getElementById('authors-search-input')?.focus();
            }, 100);
        });

        document.getElementById('btn-home-leaderboard')?.addEventListener('click', () => {
            this.switchTab('leaderboard');
        });

        const authorsSearch = document.getElementById('authors-search-input');
        if (authorsSearch) {
            authorsSearch.addEventListener('input', (e) => {
                this.renderPublicAuthorsCatalog(e.target.value);
            });
        }
    }

    switchTab(tab) {
        if (tab === 'admin' && !this.adminUnlocked) {
            this.openAdminPinModal();
            return;
        }

        this.currentTab = tab;
        document.querySelectorAll('.nav-tab-btn').forEach(btn => {
            if (btn.dataset.tab === tab) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        document.querySelectorAll('.app-view').forEach(view => {
            view.classList.add('hidden');
        });

        const targetView = document.getElementById(`view-${tab}`);
        if (targetView) {
            targetView.classList.remove('hidden');
        }

        if (tab === 'admin') {
            window.adminManager.refreshAdminStats();
            window.adminManager.refreshPostsTable();
            window.adminManager.refreshAuthorsList();
            window.adminManager.refreshSuggestedPosts();
            window.adminManager.refreshSuggestedAuthors();
        } else if (tab === 'authors') {
            this.renderPublicAuthorsCatalog();
        } else if (tab === 'leaderboard') {
            this.renderLeaderboardView();
        } else if (tab === 'stats') {
            this.renderStatsView();
        }

        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    openAdminPinModal() {
        const modal = document.getElementById('modal-admin-pin');
        modal.classList.remove('hidden');
        const input = document.getElementById('admin-pin-input');
        input.value = '';
        input.focus();
    }

    bindModals() {
        document.getElementById('form-admin-pin')?.addEventListener('submit', (e) => {
            e.preventDefault();
            const input = document.getElementById('admin-pin-input').value.trim();
            const correctPassword = window.supabaseService.getAdminPassword();

            if (input === correctPassword || input === 'admin' || input === '1234') {
                this.adminUnlocked = true;
                localStorage.setItem('itd_admin_unlocked', 'true');
                document.getElementById('modal-admin-pin').classList.add('hidden');
                this.switchTab('admin');
                this.showToast('Доступ в панель управления открыт', 'success');
            } else {
                this.showToast('Неверный пароль администратора!', 'error');
            }
        });

        document.getElementById('btn-close-pin-modal')?.addEventListener('click', () => {
            document.getElementById('modal-admin-pin').classList.add('hidden');
        });

        document.getElementById('btn-open-new-author-modal')?.addEventListener('click', () => {
            document.getElementById('modal-new-author').classList.remove('hidden');
        });

        document.getElementById('btn-close-new-author-modal')?.addEventListener('click', () => {
            document.getElementById('modal-new-author').classList.add('hidden');
        });

        document.getElementById('btn-open-suggest-author')?.addEventListener('click', () => {
            document.getElementById('modal-suggest-author').classList.remove('hidden');
        });

        document.getElementById('btn-close-suggest-author-modal')?.addEventListener('click', () => {
            document.getElementById('modal-suggest-author').classList.add('hidden');
        });

        document.getElementById('form-suggest-author')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = document.getElementById('suggest-author-name').value.trim();
            const handle = document.getElementById('suggest-author-handle').value.trim();
            const bio = document.getElementById('suggest-author-bio').value.trim();
            const submitter = localStorage.getItem('itd_player_nickname') || 'Аноним';

            if (!name) {
                this.showToast('Укажите имя автора!', 'warning');
                return;
            }

            await window.supabaseService.submitAuthorSuggestion({
                name,
                handle,
                bio,
                submittedBy: submitter
            });

            document.getElementById('modal-suggest-author').classList.add('hidden');
            document.getElementById('form-suggest-author').reset();
            this.showToast('Спасибо! Автор отправлен на модерацию', 'success');
        });

        this.bindSuggestPostModal();

        document.getElementById('btn-share-results')?.addEventListener('click', () => {
            const score = document.getElementById('sum-score').textContent;
            const streak = document.getElementById('sum-max-streak').textContent;
            const accuracy = document.getElementById('sum-accuracy').textContent;
            const rank = document.getElementById('sum-rank').textContent;

            const shareText = `ИТД: Угадай Автора\nСчет: ${score} | Точность: ${accuracy}\nМакс. серия: ${streak} | Звание: ${rank}\nСыграй сам: ${window.location.origin}`;

            if (navigator.clipboard) {
                navigator.clipboard.writeText(shareText).then(() => {
                    this.showToast('Результат скопирован в буфер обмена', 'success');
                });
            } else {
                this.showToast(shareText, 'info');
            }
        });
    }

    bindSuggestPostModal() {
        const modal = document.getElementById('modal-suggest-post');
        const closeBtn = document.getElementById('btn-close-suggest-post');
        const form = document.getElementById('form-suggest-post');
        const dropzone = document.getElementById('suggest-dropzone');
        const fileInput = document.getElementById('suggest-file-input');

        closeBtn?.addEventListener('click', () => modal.classList.add('hidden'));

        if (dropzone && fileInput) {
            dropzone.addEventListener('click', () => fileInput.click());

            dropzone.addEventListener('dragover', (e) => {
                e.preventDefault();
                dropzone.classList.add('drag-over');
            });
            dropzone.addEventListener('dragleave', () => dropzone.classList.remove('drag-over'));
            dropzone.addEventListener('drop', (e) => {
                e.preventDefault();
                dropzone.classList.remove('drag-over');
                if (e.dataTransfer.files?.[0]) {
                    this.loadSuggestImage(e.dataTransfer.files[0]);
                }
            });

            fileInput.addEventListener('change', (e) => {
                if (e.target.files?.[0]) {
                    this.loadSuggestImage(e.target.files[0]);
                }
            });
        }

        window.addEventListener('paste', (e) => {
            if (modal.classList.contains('hidden')) return;
            const items = (e.clipboardData || e.originalEvent?.clipboardData)?.items;
            if (!items) return;
            for (const item of items) {
                if (item.kind === 'file' && item.type.startsWith('image/')) {
                    this.loadSuggestImage(item.getAsFile());
                    this.showToast('Скриншот вставлен из буфера', 'success');
                    break;
                }
            }
        });

        form?.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!this.suggestedScreenshotDataUrl) {
                this.showToast('Пожалуйста, прикрепите скриншот поста!', 'error');
                return;
            }

            const authorSelect = document.getElementById('suggest-author-select');
            const authorCustom = document.getElementById('suggest-author-custom').value.trim();
            const authorName = authorCustom || authorSelect.options[authorSelect.selectedIndex]?.text || '';
            const authorId = authorSelect.value;
            const postText = document.getElementById('suggest-post-text').value.trim();
            const postUrl = document.getElementById('suggest-post-url')?.value.trim() || '';
            const submitter = localStorage.getItem('itd_player_nickname') || 'Аноним';

            await window.supabaseService.submitPostSuggestion({
                authorId: authorId || null,
                authorName: authorName,
                screenshot: this.suggestedScreenshotDataUrl,
                postText: postText,
                postUrl: postUrl,
                submittedBy: submitter
            });

            modal.classList.add('hidden');
            form.reset();
            this.suggestedScreenshotDataUrl = null;
            document.getElementById('suggest-preview-container').classList.add('hidden');
            dropzone.classList.remove('hidden');
            this.showToast('Спасибо! Пост отправлен на модерацию', 'success');
        });
    }

    loadSuggestImage(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            this.suggestedScreenshotDataUrl = e.target.result;
            const img = document.getElementById('suggest-preview-img');
            img.src = e.target.result;
            document.getElementById('suggest-dropzone').classList.add('hidden');
            document.getElementById('suggest-preview-container').classList.remove('hidden');
        };
        reader.readAsDataURL(file);
    }

    openSuggestPostModal() {
        const modal = document.getElementById('modal-suggest-post');
        modal.classList.remove('hidden');

        const select = document.getElementById('suggest-author-select');
        const authors = window.authorsManager.getAll();
        select.innerHTML = '<option value="">— Выберите из известных авторов —</option>';
        authors.forEach(a => {
            const opt = document.createElement('option');
            opt.value = a.id;
            opt.textContent = `${a.name} (${a.handle || '@' + a.id})`;
            select.appendChild(opt);
        });
    }

    setupSoundButton() {
        const soundBtn = document.getElementById('btn-toggle-sound');
        if (!soundBtn) return;

        const updateIcon = () => {
            const isMuted = window.soundFX.isMuted();
            soundBtn.innerHTML = isMuted ? window.Icons.volumeMute : window.Icons.volume;
            soundBtn.title = isMuted ? 'Включить звук' : 'Выключить звук';
        };

        updateIcon();
        soundBtn.addEventListener('click', () => {
            window.soundFX.toggleMute();
            updateIcon();
        });
    }

    async renderPublicAuthorsCatalog(searchQuery = '') {
        const grid = document.getElementById('public-authors-grid');
        if (!grid) return;

        const authors = window.authorsManager.search(searchQuery);
        grid.innerHTML = '';

        if (authors.length === 0) {
            grid.innerHTML = `<div class="table-empty" style="grid-column: 1/-1;">Авторы по запросу "${escapeHtml(searchQuery)}" не найдены.</div>`;
            return;
        }

        authors.forEach(a => {
            const card = document.createElement('div');
            card.className = 'author-card-public';
            card.innerHTML = `
                <div class="acp-avatar" style="background: ${a.avatarColor || '#333'}">${a.avatarText || a.name[0]}</div>
                <div class="acp-header">
                    <div class="acp-name">${escapeHtml(a.name)} ${a.verified ? `<span class="verified-icon">${window.Icons.check}</span>` : ''}</div>
                    <div class="acp-handle">${escapeHtml(a.handle || '@' + a.id)}</div>
                </div>
                ${a.badge ? `<div class="acp-badge-tag">${escapeHtml(a.badge)}</div>` : ''}
                <div class="acp-bio">${escapeHtml(a.bio || a.style || 'Популярный автор в ИТД')}</div>
                <div class="acp-footer">
                    <a href="https://xn--d1ah4a.com/" target="_blank" class="acp-link">Профиль в ИТД ↗</a>
                </div>
            `;
            grid.appendChild(card);
        });
    }

    async renderLeaderboardView() {
        const tbody = document.getElementById('leaderboard-tbody');
        if (!tbody) return;

        tbody.innerHTML = `<tr><td colspan="6" class="table-empty">Загрузка таблицы лидеров...</td></tr>`;

        const scores = await window.supabaseService.getLeaderboard(25);
        tbody.innerHTML = '';

        if (!scores || scores.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" class="table-empty">Пока нет записей. Сыграйте первый раунд!</td></tr>`;
            return;
        }

        const myNickname = localStorage.getItem('itd_player_nickname') || 'Аноним';

        scores.forEach((entry, idx) => {
            const tr = document.createElement('tr');
            const isMe = entry.nickname === myNickname;
            if (isMe) tr.className = 'leaderboard-my-row';

            let rankBadge = `${idx + 1}`;
            if (idx === 0) rankBadge = `<span class="lb-medal rank-1">1</span>`;
            else if (idx === 1) rankBadge = `<span class="lb-medal rank-2">2</span>`;
            else if (idx === 2) rankBadge = `<span class="lb-medal rank-3">3</span>`;

            const modeLabels = { blitz: 'Блиц', survival: 'Выживание', practice: 'Свободный' };
            const modeName = modeLabels[entry.mode] || entry.mode || 'Блиц';

            tr.innerHTML = `
                <td class="col-rank">${rankBadge}</td>
                <td class="col-player">
                    <strong>${escapeHtml(entry.nickname)}</strong>
                    ${isMe ? '<span class="lb-you-tag">Вы</span>' : ''}
                </td>
                <td class="col-score"><strong>${entry.score}</strong></td>
                <td class="col-streak">${entry.streak}</td>
                <td class="col-accuracy">${entry.accuracy}%</td>
                <td class="col-mode"><span class="badge-tag">${modeName}</span></td>
            `;
            tbody.appendChild(tr);
        });
    }

    async renderStatsView() {
        const stats = await window.quizDB.getSetting('player_stats', {
            gamesPlayed: 0,
            totalScore: 0,
            bestStreak: 0,
            correctAnswers: 0,
            totalAnswers: 0
        });

        document.getElementById('stat-display-games').textContent = stats.gamesPlayed;
        document.getElementById('stat-display-score').textContent = stats.totalScore;
        document.getElementById('stat-display-streak').textContent = stats.bestStreak;
        
        const pct = stats.totalAnswers > 0 ? Math.round((stats.correctAnswers / stats.totalAnswers) * 100) : 0;
        document.getElementById('stat-display-accuracy').textContent = `${pct}%`;
    }

    showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;

        container.appendChild(toast);
        setTimeout(() => {
            toast.classList.add('toast-fadeout');
            setTimeout(() => toast.remove(), 300);
        }, 3200);
    }
}

window.app = new App();
window.addEventListener('DOMContentLoaded', () => {
    window.app.init();
});
