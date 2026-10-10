class App {
    constructor() {
        this.currentTab = 'home';
        this.selectedMode = 'blitz';
        this.adminUnlocked = localStorage.getItem('itd_admin_unlocked') === 'true';
        this.suggestedScreenshotDataUrl = null;
        this.suggestSelectedAuthor = null;
        this.publicAuthorsPage = 1;
        this.publicAuthorsPerPage = 20;
        this.publicAuthorsQuery = '';
        this.lbScores = [];
        this.lbPage = 1;
        this.lbPerPage = 10;
    }

    async init() {
        this.bindNavigation();
        this.bindHomeLobby();
        this.bindModals();
        this.setupBackdropClose();
        document.querySelectorAll('.modal-backdrop, .lightbox-backdrop').forEach(m => {
            m.classList.add('hidden');
        });

        try {
            await window.quizDB.init();
            await window.authorsManager.load();
            await window.PresetsManager.initPresetsIfEmpty();
        } catch (e) {
            console.warn(e);
        }

        window.adminManager.init();
        window.gameEngine.init();

        this.switchTab('home');

        window.gameEngine.toggleLightboxCustom = (src) => {
            const lightbox = document.getElementById('image-lightbox');
            const lbImg = document.getElementById('lightbox-img');
            if (lightbox && lbImg) {
                const safe = window.safeImageSrc ? window.safeImageSrc(src) : src;
                if (!safe) return;
                lbImg.src = safe;
                lightbox.classList.remove('hidden');
            }
        };

        if (window.supabaseService?.isConfigured) {
            window.supabaseService.fetchRemoteAuthors().then(remoteAuthors => {
                if (remoteAuthors && remoteAuthors.length > 0) {
                    window.quizDB.saveAuthors(remoteAuthors).then(() => {
                        window.authorsManager.load();
                    });
                }
            }).catch(console.warn);
        }
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
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const target = btn.dataset.tab;
                if (target) {
                    this.switchTab(target);
                }
            });
        });

        document.getElementById('btn-next-question')?.addEventListener('click', () => {
            window.gameEngine.next();
        });

        const handleFinishPractice = () => {
            window.gameEngine.finishPractice();
        };
        document.getElementById('btn-quiz-finish')?.addEventListener('click', handleFinishPractice);
        document.getElementById('btn-finish-practice')?.addEventListener('click', handleFinishPractice);

        document.getElementById('btn-play-again')?.addEventListener('click', () => {
            this.switchTab('home');
        });

        document.getElementById('btn-hint-5050')?.addEventListener('click', () => {
            window.gameEngine.use5050();
        });

        document.getElementById('btn-use-hint')?.addEventListener('click', () => {
            window.gameEngine.useTextHint();
        });

        document.getElementById('post-screenshot-container')?.addEventListener('click', () => {
            window.gameEngine.toggleLightbox();
        });

        document.getElementById('btn-close-lightbox')?.addEventListener('click', () => {
            document.getElementById('image-lightbox')?.classList.add('hidden');
        });

        document.getElementById('image-lightbox')?.addEventListener('click', (e) => {
            if (e.target.id === 'image-lightbox') {
                document.getElementById('image-lightbox')?.classList.add('hidden');
            }
        });

        document.getElementById('btn-lb-prev')?.addEventListener('click', () => {
            if (this.lbPage > 1) {
                this.lbPage--;
                this.renderLeaderboardPage();
            }
        });

        document.getElementById('btn-lb-next')?.addEventListener('click', () => {
            const totalPages = Math.max(1, Math.ceil(this.lbScores.length / this.lbPerPage));
            if (this.lbPage < totalPages) {
                this.lbPage++;
                this.renderLeaderboardPage();
            }
        });

        document.getElementById('btn-public-authors-prev')?.addEventListener('click', () => {
            if (this.publicAuthorsPage > 1) {
                this.publicAuthorsPage--;
                this.renderPublicAuthorsCatalog();
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        });

        document.getElementById('btn-public-authors-next')?.addEventListener('click', () => {
            const authors = window.authorsManager.search(this.publicAuthorsQuery || '');
            const totalPages = Math.max(1, Math.ceil(authors.length / this.publicAuthorsPerPage));
            if (this.publicAuthorsPage < totalPages) {
                this.publicAuthorsPage++;
                this.renderPublicAuthorsCatalog();
                window.scrollTo({ top: 0, behavior: 'smooth' });
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
                window.soundFX?.playClick();
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
                this.publicAuthorsPage = 1;
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

        try {
            if (tab === 'admin') {
                window.adminManager.refreshAdminStats().catch(console.warn);
                window.adminManager.refreshPostsTable().catch(console.warn);
                window.adminManager.refreshAuthorsList().catch(console.warn);
                window.adminManager.refreshSuggestedPosts().catch(console.warn);
                window.adminManager.refreshSuggestedAuthors().catch(console.warn);
            } else if (tab === 'authors') {
                this.renderPublicAuthorsCatalog();
            } else if (tab === 'leaderboard') {
                this.renderLeaderboardView().catch(console.warn);
            } else if (tab === 'stats') {
                this.renderStatsView().catch(console.warn);
            }
        } catch (e) {
            console.warn(e);
        }

        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    openAdminPinModal() {
        const modal = document.getElementById('modal-admin-pin');
        if (!modal) return;
        modal.classList.remove('hidden');
        const input = document.getElementById('admin-pin-input');
        if (input) {
            input.value = '';
            input.focus();
        }
    }

    setupBackdropClose() {
        document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
            backdrop.addEventListener('click', (e) => {
                if (e.target === backdrop) {
                    backdrop.classList.add('hidden');
                }
            });
        });

        document.querySelectorAll('.modal-close-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                btn.closest('.modal-backdrop')?.classList.add('hidden');
            });
        });

        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                document.querySelectorAll('.modal-backdrop, .lightbox-backdrop').forEach(m => {
                    m.classList.add('hidden');
                });
            }
        });
    }

    bindModals() {
        document.getElementById('form-admin-pin')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const input = document.getElementById('admin-pin-input')?.value.trim() || '';
            const submitBtn = e.target.querySelector('button[type="submit"]');
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent = 'Проверка...';
            }

            try {
                const isValid = await window.supabaseService.verifyAdminPassword(input);
                if (isValid) {
                    this.adminUnlocked = true;
                    localStorage.setItem('itd_admin_unlocked', 'true');
                    document.getElementById('modal-admin-pin')?.classList.add('hidden');
                    this.switchTab('admin');
                    this.showToast('Доступ в панель управления открыт', 'success');
                } else {
                    this.showToast('Неверный пароль администратора!', 'error');
                    const inputEl = document.getElementById('admin-pin-input');
                    if (inputEl) {
                        inputEl.value = '';
                        inputEl.focus();
                    }
                }
            } catch (err) {
                console.warn(err);
                this.showToast('Ошибка при проверке пароля', 'error');
            } finally {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Войти';
                }
            }
        });

        document.getElementById('btn-close-pin-modal')?.addEventListener('click', () => {
            document.getElementById('modal-admin-pin')?.classList.add('hidden');
        });

        document.getElementById('btn-open-new-author-modal')?.addEventListener('click', () => {
            if (window.adminManager?.openCreateAuthorModal) {
                window.adminManager.openCreateAuthorModal();
            } else {
                document.getElementById('modal-new-author')?.classList.remove('hidden');
            }
        });

        document.getElementById('btn-close-new-author-modal')?.addEventListener('click', () => {
            document.getElementById('modal-new-author')?.classList.add('hidden');
        });

        document.getElementById('btn-open-suggest-author')?.addEventListener('click', () => {
            this.openSuggestAuthorModal();
        });

        document.getElementById('btn-close-suggest-author-modal')?.addEventListener('click', () => {
            document.getElementById('modal-suggest-author')?.classList.add('hidden');
        });

        const checkAuthorExistsWarning = () => {
            const nameVal = document.getElementById('suggest-author-name')?.value.trim().toLowerCase() || '';
            const handleVal = (document.getElementById('suggest-author-handle')?.value.trim().toLowerCase() || '').replace(/^@+/, '');
            const warnEl = document.getElementById('suggest-author-exists-warning');
            if (!warnEl) return;
            if (!nameVal && !handleVal) {
                warnEl.classList.add('hidden');
                warnEl.textContent = '';
                return;
            }
            const existing = window.authorsManager.getAll().find(a => {
                const aName = (a.name || '').toLowerCase();
                const aHandle = (a.handle || a.id || '').toLowerCase().replace(/^@+/, '');
                return (nameVal && aName === nameVal) || (handleVal && aHandle === handleVal);
            });
            if (existing) {
                warnEl.textContent = `Автор «${existing.name}» (${existing.handle || '@' + existing.id}) уже есть в базе викторины!`;
                warnEl.classList.remove('hidden');
            } else {
                warnEl.classList.add('hidden');
                warnEl.textContent = '';
            }
        };

        document.getElementById('suggest-author-name')?.addEventListener('input', checkAuthorExistsWarning);
        document.getElementById('suggest-author-handle')?.addEventListener('input', checkAuthorExistsWarning);

        document.getElementById('form-suggest-author')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const lastAuthTime = parseInt(localStorage.getItem('itd_last_author_suggest_time') || '0', 10);
            const now = Date.now();
            const cooldown = 60 * 1000;
            if (now - lastAuthTime < cooldown) {
                const rem = Math.ceil((cooldown - (now - lastAuthTime)) / 1000);
                this.showToast(`Подождите ${rem} сек. перед предложением следующего автора`, 'warning');
                return;
            }

            const name = document.getElementById('suggest-author-name')?.value.trim();
            const handle = document.getElementById('suggest-author-handle')?.value.trim();
            const badge = document.getElementById('suggest-author-badge')?.value.trim();
            const avatarColor = document.getElementById('suggest-author-color')?.value;
            const profileUrl = document.getElementById('suggest-author-profile')?.value.trim();
            const bio = document.getElementById('suggest-author-bio')?.value.trim();
            const submitter = localStorage.getItem('itd_player_nickname') || 'Аноним';

            if (!name) {
                this.showToast('Укажите имя автора!', 'warning');
                return;
            }

            await window.supabaseService.submitAuthorSuggestion({
                name,
                handle,
                badge,
                avatarColor,
                profileUrl,
                bio,
                submittedBy: submitter
            });

            localStorage.setItem('itd_last_author_suggest_time', String(Date.now()));
            document.getElementById('modal-suggest-author')?.classList.add('hidden');
            document.getElementById('form-suggest-author')?.reset();
            document.getElementById('suggest-author-exists-warning')?.classList.add('hidden');
            this.showToast('Спасибо! Автор отправлен на модерацию', 'success');
        });

        this.bindSuggestPostModal();

        document.getElementById('btn-copy-card')?.addEventListener('click', async () => {
            const data = window.gameEngine?.lastResult;
            if (!data) return;
            try {
                const status = await window.ShareCard.copyImage(data);
                this.showToast(status === 'copied' ? 'Картинка скопирована в буфер обмена' : 'Картинка сохранена на устройство', 'success');
            } catch (err) {
                this.showToast('Не удалось скопировать картинку', 'error');
            }
        });

        document.getElementById('btn-share-itd')?.addEventListener('click', async () => {
            const data = window.gameEngine?.lastResult;
            if (!data) return;
            try {
                const status = await window.ShareCard.shareToItd(data);
                if (status === 'downloaded') {
                    this.showToast('Картинка сохранена, текст скопирован. Прикрепите её к посту в ИТД', 'success');
                }
            } catch (err) {
                this.showToast('Не удалось поделиться результатом', 'error');
            }
        });

        document.getElementById('btn-share-results')?.addEventListener('click', () => {
            const score = document.getElementById('sum-score')?.textContent || '0';
            const streak = document.getElementById('sum-max-streak')?.textContent || '0';
            const accuracy = document.getElementById('sum-accuracy')?.textContent || '0%';
            const rank = document.getElementById('sum-rank')?.textContent || 'Игрок';

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
        const changeImgBtn = document.getElementById('btn-suggest-change-img');
        const createAuthorBtn = document.getElementById('btn-suggest-create-author');

        closeBtn?.addEventListener('click', () => modal?.classList.add('hidden'));

        changeImgBtn?.addEventListener('click', () => {
            fileInput?.click();
        });

        createAuthorBtn?.addEventListener('click', () => {
            this.openSuggestAuthorModal();
        });

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
            if (!modal || modal.classList.contains('hidden')) return;
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

        this.setupSuggestAuthorSearch();

        form?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const lastPostTime = parseInt(localStorage.getItem('itd_last_post_suggest_time') || '0', 10);
            const now = Date.now();
            const cooldown = 60 * 1000;
            if (now - lastPostTime < cooldown) {
                const rem = Math.ceil((cooldown - (now - lastPostTime)) / 1000);
                this.showToast(`Подождите ${rem} сек. перед предложением следующего поста`, 'warning');
                return;
            }

            if (!this.suggestedScreenshotDataUrl) {
                this.showToast('Пожалуйста, прикрепите скриншот поста!', 'error');
                return;
            }

            if (!this.suggestSelectedAuthor || !this.suggestSelectedAuthor.id) {
                this.showToast('Пожалуйста, выберите автора из списка или предложите нового!', 'error');
                return;
            }

            const postUrl = document.getElementById('suggest-post-url')?.value.trim() || '';
            if (!postUrl) {
                this.showToast('Пожалуйста, укажите ссылку на пост в ИТД!', 'error');
                return;
            }

            const postText = document.getElementById('suggest-post-text')?.value.trim() || '';
            const hint = document.getElementById('suggest-post-hint')?.value.trim() || '';
            const tags = document.getElementById('suggest-post-tags')?.value.trim() || '';
            const submitter = localStorage.getItem('itd_player_nickname') || 'Аноним';

            try {
                await window.supabaseService.submitPostSuggestion({
                    authorId: this.suggestSelectedAuthor.id,
                    authorName: this.suggestSelectedAuthor.name,
                    screenshot: this.suggestedScreenshotDataUrl,
                    postText,
                    postUrl,
                    hint,
                    tags,
                    submittedBy: submitter
                });
            } catch (err) {
                this.showToast(err.message || 'Не удалось отправить пост', 'error');
                return;
            }

            localStorage.setItem('itd_last_post_suggest_time', String(Date.now()));
            modal.classList.add('hidden');
            form.reset();
            this.clearSuggestSelectedAuthor();
            this.suggestedScreenshotDataUrl = null;
            document.getElementById('suggest-preview-container')?.classList.add('hidden');
            dropzone?.classList.remove('hidden');
            this.showToast('Спасибо! Пост отправлен на модерацию', 'success');
        });
    }

    setupSuggestAuthorSearch() {
        const searchInput = document.getElementById('suggest-post-author-search');
        const dropdown = document.getElementById('suggest-author-suggestions');
        if (!searchInput || !dropdown) return;

        const renderSuggestions = (query) => {
            const matches = window.authorsManager.search(query);
            dropdown.innerHTML = '';

            if (matches.length === 0) {
                const emptyRow = document.createElement('div');
                emptyRow.style.cssText = 'padding:10px 14px; font-size:12px; color:var(--text-muted); display:flex; justify-content:space-between; align-items:center;';
                emptyRow.innerHTML = '<span>Автор не найден</span><button type="button" class="btn-link-action" id="btn-suggest-dropdown-create" style="background:none; border:none; color:var(--accent-blue); cursor:pointer; font-size:12px; font-weight:600; padding:0; text-decoration:underline;">+ Предложить автора</button>';
                emptyRow.querySelector('#btn-suggest-dropdown-create')?.addEventListener('click', () => {
                    dropdown.classList.add('hidden');
                    this.openSuggestAuthorModal();
                });
                dropdown.appendChild(emptyRow);
                dropdown.classList.remove('hidden');
                return;
            }

            matches.slice(0, 8).forEach(a => {
                const item = document.createElement('div');
                item.className = 'author-suggestion-item';
                item.innerHTML = `
                    <div class="asi-avatar" style="background:${window.escapeHtml(window.safeCssValue(a.avatarColor))}">${window.escapeHtml(a.avatarText || (a.name && a.name.length > 0 ? a.name[0] : '?'))}</div>
                    <div class="asi-meta">
                        <div class="asi-name">${window.escapeHtml(a.name)}</div>
                        <div class="asi-handle">${window.escapeHtml(a.handle || '@' + a.id)}</div>
                    </div>
                `;

                item.addEventListener('click', () => {
                    this.selectSuggestAuthor(a);
                    dropdown.classList.add('hidden');
                    searchInput.value = '';
                });

                dropdown.appendChild(item);
            });

            dropdown.classList.remove('hidden');
        };

        searchInput.addEventListener('focus', () => {
            renderSuggestions(searchInput.value);
        });

        searchInput.addEventListener('input', (e) => {
            renderSuggestions(e.target.value);
        });

        document.addEventListener('click', (e) => {
            if (!searchInput.contains(e.target) && !dropdown.contains(e.target)) {
                dropdown.classList.add('hidden');
            }
        });
    }

    selectSuggestAuthor(author) {
        this.suggestSelectedAuthor = author;
        const hiddenInput = document.getElementById('suggest-post-author-id');
        const pillContainer = document.getElementById('suggest-selected-author-pill');
        const searchInput = document.getElementById('suggest-post-author-search');

        if (hiddenInput) hiddenInput.value = author.id;
        if (pillContainer) {
            pillContainer.innerHTML = `
                <div class="sap-avatar" style="background:${window.escapeHtml(window.safeCssValue(author.avatarColor))}">${window.escapeHtml(author.avatarText || (author.name && author.name.length > 0 ? author.name[0] : '?'))}</div>
                <span class="sap-name">${window.escapeHtml(author.name)}</span>
                <span class="sap-handle">${window.escapeHtml(author.handle || '@' + author.id)}</span>
                <button type="button" class="sap-remove-btn" title="Сменить автора">✕</button>
            `;

            pillContainer.querySelector('.sap-remove-btn')?.addEventListener('click', () => {
                this.clearSuggestSelectedAuthor();
            });

            pillContainer.classList.remove('hidden');
        }
        if (searchInput) searchInput.placeholder = 'Автор выбран (нажмите ✕ для смены)';
    }

    clearSuggestSelectedAuthor() {
        this.suggestSelectedAuthor = null;
        const hiddenInput = document.getElementById('suggest-post-author-id');
        if (hiddenInput) hiddenInput.value = '';
        const pill = document.getElementById('suggest-selected-author-pill');
        if (pill) {
            pill.innerHTML = '';
            pill.classList.add('hidden');
        }
        const searchInput = document.getElementById('suggest-post-author-search');
        if (searchInput) {
            searchInput.placeholder = 'Начните вводить имя или @handle автора...';
            searchInput.focus();
        }
    }

    openSuggestAuthorModal() {
        const modal = document.getElementById('modal-suggest-author');
        if (!modal) return;
        document.getElementById('form-suggest-author')?.reset();
        document.getElementById('suggest-author-exists-warning')?.classList.add('hidden');
        modal.classList.remove('hidden');
        document.getElementById('suggest-author-name')?.focus();
    }

    async loadSuggestImage(file) {
        if (!file || !file.type.startsWith('image/')) {
            this.showToast('Выберите файл изображения', 'warning');
            return;
        }
        try {
            const compressed = await window.ImageUtil.compressFile(file);
            this.suggestedScreenshotDataUrl = compressed;
            const img = document.getElementById('suggest-preview-img');
            if (img) img.src = compressed;
            document.getElementById('suggest-dropzone')?.classList.add('hidden');
            document.getElementById('suggest-preview-container')?.classList.remove('hidden');
        } catch (err) {
            this.showToast('Не удалось обработать изображение', 'error');
        }
    }

    openSuggestPostModal() {
        const modal = document.getElementById('modal-suggest-post');
        if (!modal) return;
        modal.classList.remove('hidden');
        const searchInput = document.getElementById('suggest-post-author-search');
        if (searchInput && !this.suggestSelectedAuthor) {
            searchInput.focus();
        }
    }

    async renderPublicAuthorsCatalog(searchQuery = null) {
        const grid = document.getElementById('public-authors-grid');
        if (!grid) return;

        if (typeof searchQuery === 'string') {
            this.publicAuthorsQuery = searchQuery;
        }

        const authors = window.authorsManager.search(this.publicAuthorsQuery || '');
        const totalItems = authors.length;
        const totalPages = Math.max(1, Math.ceil(totalItems / this.publicAuthorsPerPage));

        if (this.publicAuthorsPage > totalPages) this.publicAuthorsPage = totalPages;
        if (this.publicAuthorsPage < 1) this.publicAuthorsPage = 1;

        const infoEl = document.getElementById('public-authors-page-info');
        const pageNumEl = document.getElementById('public-authors-page-number');
        const prevBtn = document.getElementById('btn-public-authors-prev');
        const nextBtn = document.getElementById('btn-public-authors-next');
        const paginationBar = document.getElementById('public-authors-pagination');

        const startIdx = (this.publicAuthorsPage - 1) * this.publicAuthorsPerPage;
        const endIdx = Math.min(totalItems, startIdx + this.publicAuthorsPerPage);
        const pageAuthors = authors.slice(startIdx, endIdx);

        if (infoEl) {
            infoEl.textContent = totalItems === 0 ? '0 авторов' : `Показано ${startIdx + 1}–${endIdx} из ${totalItems} авторов`;
        }
        if (pageNumEl) {
            pageNumEl.textContent = `${this.publicAuthorsPage} / ${totalPages}`;
        }
        if (prevBtn) {
            prevBtn.disabled = this.publicAuthorsPage <= 1;
        }
        if (nextBtn) {
            nextBtn.disabled = this.publicAuthorsPage >= totalPages;
        }
        if (paginationBar) {
            if (totalItems === 0) {
                paginationBar.classList.add('hidden');
            } else {
                paginationBar.classList.remove('hidden');
            }
        }

        grid.innerHTML = '';

        if (totalItems === 0) {
            grid.innerHTML = `<div class="table-empty" style="grid-column: 1/-1;">Авторы по запросу "${window.escapeHtml(this.publicAuthorsQuery)}" не найдены.</div>`;
            return;
        }

        pageAuthors.forEach(a => {
            const card = document.createElement('div');
            card.className = 'author-card-public';
            const rawNick = (a.handle || a.id || '').trim();
            let profileUrl = 'https://xn--d1ah4a.com/';
            if (rawNick.startsWith('http://') || rawNick.startsWith('https://')) {
                profileUrl = window.safeUrl(rawNick, profileUrl);
            } else if (rawNick) {
                const cleanNick = rawNick.replace(/^@+/, '');
                if (cleanNick) {
                    profileUrl = `https://xn--d1ah4a.com/@${encodeURIComponent(cleanNick)}`;
                }
            }
            card.innerHTML = `
                <div class="acp-avatar" style="background: ${window.escapeHtml(window.safeCssValue(a.avatarColor))}">${window.escapeHtml(a.avatarText || (a.name ? a.name[0] : '?'))}</div>
                <div class="acp-header">
                    <div class="acp-name">${window.escapeHtml(a.name)} ${a.verified ? `<span class="verified-icon">${window.Icons.check}</span>` : ''}</div>
                    <div class="acp-handle">${window.escapeHtml(a.handle || '@' + a.id)}</div>
                </div>
                ${a.badge ? `<div class="acp-badge-tag">${window.escapeHtml(a.badge)}</div>` : ''}
                <div class="acp-bio">${window.escapeHtml(a.bio || a.style || 'Популярный автор в ИТД')}</div>
                <div class="acp-footer">
                    <a href="${window.escapeHtml(profileUrl)}" target="_blank" rel="noopener noreferrer" class="acp-link">Профиль в ИТД ↗</a>
                </div>
            `;
            grid.appendChild(card);
        });
    }

    async renderLeaderboardView() {
        const tbody = document.getElementById('leaderboard-tbody');
        if (!tbody) return;

        tbody.innerHTML = `<tr><td colspan="6" class="table-empty">Загрузка таблицы лидеров...</td></tr>`;

        const scores = await window.supabaseService.getLeaderboard(100);
        this.lbScores = Array.isArray(scores) ? scores : [];
        this.lbPage = 1;
        this.renderLeaderboardPage();
    }

    renderLeaderboardPage() {
        const tbody = document.getElementById('leaderboard-tbody');
        if (!tbody) return;

        const totalItems = this.lbScores.length;
        const totalPages = Math.max(1, Math.ceil(totalItems / this.lbPerPage));
        if (this.lbPage > totalPages) this.lbPage = totalPages;
        if (this.lbPage < 1) this.lbPage = 1;

        const infoEl = document.getElementById('leaderboard-page-info');
        const numEl = document.getElementById('lb-page-number');
        const prevBtn = document.getElementById('btn-lb-prev');
        const nextBtn = document.getElementById('btn-lb-next');

        if (infoEl) infoEl.textContent = `Всего: ${totalItems}`;
        if (numEl) numEl.textContent = `${this.lbPage} / ${totalPages}`;
        if (prevBtn) prevBtn.disabled = this.lbPage <= 1;
        if (nextBtn) nextBtn.disabled = this.lbPage >= totalPages;

        tbody.innerHTML = '';

        if (totalItems === 0) {
            tbody.innerHTML = `<tr><td colspan="6" class="table-empty">Пока нет записей. Сыграйте первый раунд!</td></tr>`;
            return;
        }

        const startIndex = (this.lbPage - 1) * this.lbPerPage;
        const pageItems = this.lbScores.slice(startIndex, startIndex + this.lbPerPage);
        const myNickname = localStorage.getItem('itd_player_nickname') || 'Аноним';

        pageItems.forEach((entry, idx) => {
            const globalRank = startIndex + idx + 1;
            const tr = document.createElement('tr');
            const isMe = entry.nickname === myNickname;
            if (isMe) tr.className = 'leaderboard-my-row';

            let rankBadge = `${globalRank}`;
            if (globalRank === 1) rankBadge = `<span class="lb-medal rank-1">1</span>`;
            else if (globalRank === 2) rankBadge = `<span class="lb-medal rank-2">2</span>`;
            else if (globalRank === 3) rankBadge = `<span class="lb-medal rank-3">3</span>`;

            const modeLabels = { blitz: 'Блиц', survival: 'Выживание', practice: 'Свободный' };
            const modeName = modeLabels[entry.mode] || entry.mode || 'Блиц';

            tr.innerHTML = `
                <td class="col-rank">${rankBadge}</td>
                <td class="col-player">
                    <strong>${window.escapeHtml(entry.nickname)}</strong>
                    ${isMe ? '<span class="lb-you-tag">Вы</span>' : ''}
                </td>
                <td class="col-score"><strong>${window.escapeHtml(entry.score)}</strong></td>
                <td class="col-streak">${window.escapeHtml(entry.streak)}</td>
                <td class="col-accuracy">${window.escapeHtml(entry.accuracy)}%</td>
                <td class="col-mode"><span class="badge-tag">${window.escapeHtml(modeName)}</span></td>
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

        const elGames = document.getElementById('stat-display-games');
        const elScore = document.getElementById('stat-display-score');
        const elStreak = document.getElementById('stat-display-streak');
        const elAccuracy = document.getElementById('stat-display-accuracy');

        if (elGames) elGames.textContent = stats.gamesPlayed;
        if (elScore) elScore.textContent = stats.totalScore;
        if (elStreak) elStreak.textContent = stats.bestStreak;
        
        const pct = stats.totalAnswers > 0 ? Math.round((stats.correctAnswers / stats.totalAnswers) * 100) : 0;
        if (elAccuracy) elAccuracy.textContent = `${pct}%`;
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
if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', () => {
        window.app.init();
    });
} else {
    window.app.init();
}
