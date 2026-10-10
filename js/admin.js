class AdminManager {
    constructor() {
        this.isAuthenticated = false;
        this.currentScreenshotDataUrl = null;
        this.editingPostId = null;
        this.isDrawingMask = false;
        this.maskHistory = [];
        this.selectedAuthor = null;

        this.postsPage = 1;
        this.postsPerPage = 15;
        this.postsTotal = 0;
        this.postsAllTotal = null;
        this.postsRequestId = 0;
        this.postsSearchTimer = null;
        this.postsSearch = '';
        this.cachedPosts = [];

        this.authorsPage = 1;
        this.authorsPerPage = 10;
        this.authorsSearch = '';
    }

    init() {
        this.bindEvents();
        this.setupPasteListener();
        this.setupAuthorSearch();
        this.setupItdImport();
        this.setupPasswordSettings();
    }

    bindEvents() {
        const dropzone = document.getElementById('admin-dropzone');
        const fileInput = document.getElementById('admin-file-input');

        if (dropzone && fileInput) {
            dropzone.addEventListener('click', () => fileInput.click());

            dropzone.addEventListener('dragover', (e) => {
                e.preventDefault();
                dropzone.classList.add('drag-over');
            });

            dropzone.addEventListener('dragleave', () => {
                dropzone.classList.remove('drag-over');
            });

            dropzone.addEventListener('drop', (e) => {
                e.preventDefault();
                dropzone.classList.remove('drag-over');
                if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                    this.handleFile(e.dataTransfer.files[0]);
                }
            });

            fileInput.addEventListener('change', (e) => {
                if (e.target.files && e.target.files[0]) {
                    this.handleFile(e.target.files[0]);
                }
            });
        }

        this.setupCensorCanvas();

        const form = document.getElementById('admin-post-form');
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                this.savePost();
            });
        }

        const resetBtn = document.getElementById('btn-admin-reset-form');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => this.resetForm());
        }

        const btnExport = document.getElementById('btn-export-backup');
        if (btnExport) {
            btnExport.addEventListener('click', () => this.exportBackup());
        }

        const inputImport = document.getElementById('input-import-backup');
        if (inputImport) {
            inputImport.addEventListener('change', (e) => {
                if (e.target.files && e.target.files[0]) {
                    this.importBackup(e.target.files[0]);
                }
            });
        }

        const btnResetDefaults = document.getElementById('btn-reset-presets');
        if (btnResetDefaults) {
            btnResetDefaults.addEventListener('click', () => this.resetPresets());
        }

        const formNewAuthor = document.getElementById('form-add-author');
        if (formNewAuthor) {
            formNewAuthor.addEventListener('submit', (e) => {
                e.preventDefault();
                this.saveNewAuthorFromModal();
            });
        }

        const btnRefreshStats = document.getElementById('btn-admin-refresh-stats');
        if (btnRefreshStats) {
            btnRefreshStats.addEventListener('click', () => {
                this.refreshAdminStats();
                window.app.showToast('Статистика обновлена', 'info');
            });
        }

        const btnGoHome = document.getElementById('btn-admin-go-home');
        if (btnGoHome) {
            btnGoHome.addEventListener('click', () => {
                window.app.switchTab('home');
            });
        }

        const postsSearchInput = document.getElementById('admin-posts-search-input');
        if (postsSearchInput) {
            postsSearchInput.addEventListener('input', (e) => {
                this.postsSearch = (e.target.value || '').trim();
                this.postsPage = 1;
                clearTimeout(this.postsSearchTimer);
                this.postsSearchTimer = setTimeout(() => this.refreshPostsTable(), 300);
            });
        }

        document.getElementById('btn-posts-prev')?.addEventListener('click', () => {
            if (this.postsPage > 1) {
                this.postsPage--;
                this.refreshPostsTable();
            }
        });

        document.getElementById('btn-posts-next')?.addEventListener('click', () => {
            this.postsPage++;
            this.refreshPostsTable();
        });

        const authorsSearchInput = document.getElementById('admin-authors-search-input');
        if (authorsSearchInput) {
            authorsSearchInput.addEventListener('input', (e) => {
                this.authorsSearch = (e.target.value || '').trim().toLowerCase();
                this.authorsPage = 1;
                this.renderAuthorsList();
            });
        }

        document.getElementById('btn-authors-prev')?.addEventListener('click', () => {
            if (this.authorsPage > 1) {
                this.authorsPage--;
                this.renderAuthorsList();
            }
        });

        document.getElementById('btn-authors-next')?.addEventListener('click', () => {
            this.authorsPage++;
            this.renderAuthorsList();
        });
    }

    setupPasswordSettings() {
        const formPassword = document.getElementById('form-change-admin-password');
        if (formPassword) {
            formPassword.addEventListener('submit', async (e) => {
                e.preventDefault();
                const newPassInput = document.getElementById('new-admin-password-input');
                const val = (newPassInput?.value || '').trim();
                if (!val) {
                    window.app.showToast('Введите новый пароль', 'warning');
                    return;
                }
                if (val.length < 3) {
                    window.app.showToast('Пароль слишком короткий (минимум 3 символа)', 'warning');
                    return;
                }
                await window.supabaseService.setAdminPassword(val);
                newPassInput.value = '';
                window.app.showToast('Пароль администратора успешно сохранен в базе', 'success');
            });
        }

        const btnLogout = document.getElementById('btn-admin-logout');
        if (btnLogout) {
            btnLogout.addEventListener('click', () => {
                window.app.adminUnlocked = false;
                localStorage.removeItem('itd_admin_unlocked');
                window.app.switchTab('home');
                window.app.showToast('Вы вышли из панели управления', 'info');
            });
        }
    }

    setupItdImport() {
        const urlInput = document.getElementById('admin-itd-url');
        const tokenInput = document.getElementById('admin-itd-token');
        const btn = document.getElementById('btn-itd-import');
        if (!urlInput || !tokenInput || !btn) return;

        tokenInput.value = localStorage.getItem('itd_import_token') || '';

        btn.addEventListener('click', async () => {
            const url = urlInput.value.trim();
            const token = tokenInput.value.trim();
            if (!url) {
                window.app.showToast('Вставьте ссылку на пост ИТД', 'warning');
                return;
            }
            if (!token) {
                window.app.showToast('Укажите токен авторизации ИТД', 'warning');
                return;
            }
            localStorage.setItem('itd_import_token', token);

            btn.disabled = true;
            const prevLabel = btn.textContent;
            btn.textContent = 'Загрузка...';
            try {
                const res = await window.supabaseService.apiCall('admin?action=fetch_itd_post', {
                    method: 'POST',
                    body: { url, itdToken: token }
                });
                await this.applyItdPost(res.post);
            } catch (e) {
                window.app.showToast(e.message || 'Не удалось загрузить пост', 'error');
            } finally {
                btn.disabled = false;
                btn.textContent = prevLabel;
            }
        });
    }

    async applyItdPost(post) {
        if (!post) return;

        const handle = (post.authorHandle || '').toLowerCase();
        let author = (window.authorsManager.getAll() || []).find(a => (a.handle || '').toLowerCase() === handle);

        if (!author && handle) {
            const id = handle.replace('@', '').replace(/[^a-z0-9а-яё_]/gi, '_') + '_' + Date.now();
            author = {
                id,
                name: post.authorName || handle,
                handle: post.authorHandle,
                badge: 'Автор ИТД',
                verified: true
            };
            await window.authorsManager.addAuthor(author);
            author = window.authorsManager.getById(id) || author;
            window.app.showToast(`Создан новый автор ${post.authorHandle}`, 'info');
        }
        if (author) this.selectAuthor(author);

        const textEl = document.getElementById('admin-post-text');
        if (textEl && post.text) textEl.value = post.text;

        if (post.screenshot) {
            this.loadImageIntoCanvas(post.screenshot);
            window.app.showToast('Данные поста загружены. Не забудьте скрыть ник на картинке!', 'success');
        } else {
            window.app.showToast(post.mediaUrl ? 'Автор и текст заполнены, но картинку не удалось скачать — загрузите вручную' : 'Автор и текст заполнены, в посте не найдено картинки', 'warning');
        }
    }

    setupAuthorSearch() {
        const searchInput = document.getElementById('admin-post-author-search');
        const dropdown = document.getElementById('admin-author-suggestions');

        if (!searchInput || !dropdown) return;

        const renderSuggestions = (query) => {
            const matches = window.authorsManager.search(query);
            dropdown.innerHTML = '';

            if (matches.length === 0) {
                dropdown.innerHTML = `<div style="padding:10px 14px; font-size:12px; color:var(--text-muted);">Авторы не найдены. Создайте автора в разделе авторов ниже.</div>`;
                dropdown.classList.remove('hidden');
                return;
            }

            matches.slice(0, 8).forEach(a => {
                const item = document.createElement('div');
                item.className = 'author-suggestion-item';
                item.innerHTML = `
                    <div class="asi-avatar" style="background:${escapeHtml(safeCssValue(a.avatarColor))}">${escapeHtml(a.avatarText || (a.name && a.name.length > 0 ? a.name[0] : '?'))}</div>
                    <div class="asi-meta">
                        <div class="asi-name">${escapeHtml(a.name)}</div>
                        <div class="asi-handle">${escapeHtml(a.handle || '@' + a.id)}</div>
                    </div>
                `;

                item.addEventListener('click', () => {
                    this.selectAuthor(a);
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

    selectAuthor(author) {
        this.selectedAuthor = author;
        const hiddenInput = document.getElementById('admin-post-author-id');
        const pillContainer = document.getElementById('admin-selected-author-pill');
        const searchInput = document.getElementById('admin-post-author-search');

        hiddenInput.value = author.id;
        pillContainer.innerHTML = `
            <div class="sap-avatar" style="background:${escapeHtml(safeCssValue(author.avatarColor))}">${escapeHtml(author.avatarText || (author.name && author.name.length > 0 ? author.name[0] : '?'))}</div>
            <span class="sap-name">${escapeHtml(author.name)}</span>
            <span class="sap-handle">${escapeHtml(author.handle || '@' + author.id)}</span>
            <button type="button" class="sap-remove-btn" title="Сменить автора">✕</button>
        `;

        pillContainer.querySelector('.sap-remove-btn').addEventListener('click', () => {
            this.clearSelectedAuthor();
        });

        pillContainer.classList.remove('hidden');
        searchInput.placeholder = 'Автор выбран (нажмите ✕ для смены)';
    }

    clearSelectedAuthor() {
        this.selectedAuthor = null;
        document.getElementById('admin-post-author-id').value = '';
        const pill = document.getElementById('admin-selected-author-pill');
        pill.innerHTML = '';
        pill.classList.add('hidden');
        const searchInput = document.getElementById('admin-post-author-search');
        searchInput.placeholder = 'Начните вводить имя или @handle автора...';
        searchInput.focus();
    }

    async refreshAdminStats() {
        const stats = await window.supabaseService.getAdminStats();

        const elGames = document.getElementById('admin-stat-total-games');
        const elPlayers = document.getElementById('admin-stat-unique-players');
        const elTopScore = document.getElementById('admin-stat-top-score');
        const elTopPlayer = document.getElementById('admin-stat-top-player');
        const elPosts = document.getElementById('admin-stat-active-posts');
        const elAuthors = document.getElementById('admin-stat-active-authors');
        const elPendingTotal = document.getElementById('admin-stat-pending-total');
        const elPendingDetail = document.getElementById('admin-stat-pending-detail');

        if (elGames) elGames.textContent = stats.totalGames;
        if (elPlayers) elPlayers.textContent = stats.uniquePlayers;
        if (elTopScore) elTopScore.textContent = stats.topScore;
        if (elTopPlayer) elTopPlayer.textContent = stats.topPlayer !== '—' ? `Лидер: ${stats.topPlayer}` : 'Пока нет лидеров';
        if (elPosts) elPosts.textContent = stats.totalPosts;
        if (elAuthors) elAuthors.textContent = stats.totalAuthors;

        const totalPending = stats.pendingPosts + stats.pendingAuthors;
        if (elPendingTotal) elPendingTotal.textContent = totalPending;
        if (elPendingDetail) elPendingDetail.textContent = `${stats.pendingPosts} постов, ${stats.pendingAuthors} авторов`;
    }

    async refreshSuggestedPosts() {
        const container = document.getElementById('admin-pending-suggestions-list');
        const countBadge = document.getElementById('admin-pending-sugg-count');
        if (!container) return;

        container.innerHTML = `<div class="table-empty">Загрузка предложенных постов...</div>`;

        const suggestions = await window.supabaseService.getSuggestedPosts();
        if (countBadge) countBadge.textContent = `${suggestions.length} предложений`;

        container.innerHTML = '';
        if (suggestions.length === 0) {
            container.innerHTML = `<div class="table-empty">Нет постов, ожидающих модерации.</div>`;
            return;
        }

        const allAuthors = window.authorsManager.getAll();

        suggestions.forEach(item => {
            const card = document.createElement('div');
            card.className = 'admin-suggestion-card';

            const author = item.author_id ? window.authorsManager.getById(item.author_id) : null;
            const authorDisplayName = author ? `${author.name} (${author.handle})` : (item.author_name || 'Не указан');

            let authorSelectHtml = '<select class="asc-author-select"><option value="">— Привязать к автору —</option>';
            const targetAuthorName = (item.author_name || '').toString().toLowerCase();
            allAuthors.forEach(a => {
                const aName = (a && a.name) ? String(a.name) : '';
                const aHandle = (a && a.handle) ? String(a.handle) : '';
                const isSelected = (item.author_id && a && item.author_id === a.id) || (targetAuthorName && aName && aName.toLowerCase() === targetAuthorName);
                authorSelectHtml += `<option value="${escapeHtml(a ? a.id : '')}" ${isSelected ? 'selected' : ''}>${escapeHtml(aName || 'Без имени')} (${escapeHtml(aHandle)})</option>`;
            });
            authorSelectHtml += '</select>';

            card.innerHTML = `
                <img src="${escapeHtml(safeImageSrc(item.screenshot))}" alt="Предложенный скриншот" class="asc-thumb">
                <div class="asc-info">
                    <div class="asc-author-line">Автор: <strong>${escapeHtml(authorDisplayName)}</strong></div>
                    <div class="asc-meta-line">Предложил: <strong>${escapeHtml(item.submitted_by || 'Аноним')}</strong></div>
                    ${item.post_url ? `
                        <div class="asc-link-row">
                            <a href="${escapeHtml(safeUrl(item.post_url, '#'))}" target="_blank" rel="noopener noreferrer" class="asc-external-link">
                                <span>Ссылка на пост в ИТД</span> ${window.Icons.externalLink}
                            </a>
                        </div>
                    ` : ''}
                    ${item.post_text ? `<p class="asc-comment">${escapeHtml(item.post_text)}</p>` : ''}
                    <div style="margin-bottom: 10px;">
                        <label style="font-size:11px; color:var(--text-muted); display:block; margin-bottom:4px;">Автор для викторины:</label>
                        ${authorSelectHtml}
                    </div>
                    <div class="asc-actions">
                        <button type="button" class="btn-approve">✓ Одобрить в викторину</button>
                        <button type="button" class="btn-reject">✕ Отклонить</button>
                    </div>
                </div>
            `;

            card.querySelector('.asc-thumb').addEventListener('click', () => {
                window.gameEngine.toggleLightboxCustom(item.screenshot);
            });

            card.querySelector('.btn-approve').addEventListener('click', async () => {
                const selectEl = card.querySelector('.asc-author-select');
                let authorId = selectEl?.value || item.author_id;

                if (!authorId) {
                    if (item.author_name && item.author_name !== 'Не указан') {
                        const newAuth = await window.supabaseService.approveSuggestedAuthor({
                            name: item.author_name,
                            handle: '@' + item.author_name.toLowerCase().replace(/[^a-z0-9_]/gi, ''),
                            bio: 'Автор предложенного поста'
                        });
                        authorId = newAuth.id;
                    } else {
                        const fallback = window.authorsManager.getAll()[0];
                        authorId = fallback ? fallback.id : 'unknown';
                    }
                }

                await window.supabaseService.approveSuggestedPost(item, authorId);
                card.remove();
                window.app.showToast('Пост одобрен и добавлен в викторину!', 'success');
                await this.refreshPostsTable();
                await this.refreshAdminStats();

                const remaining = container.querySelectorAll('.admin-suggestion-card').length;
                if (countBadge) countBadge.textContent = `${remaining} предложений`;
                if (remaining === 0) {
                    container.innerHTML = `<div class="table-empty">Нет постов, ожидающих модерации.</div>`;
                }
            });

            card.querySelector('.btn-reject').addEventListener('click', async () => {
                await window.supabaseService.rejectSuggestedPost(item.id);
                card.remove();
                window.app.showToast('Пост отклонен и удален из очереди', 'info');
                await this.refreshAdminStats();

                const remaining = container.querySelectorAll('.admin-suggestion-card').length;
                if (countBadge) countBadge.textContent = `${remaining} предложений`;
                if (remaining === 0) {
                    container.innerHTML = `<div class="table-empty">Нет постов, ожидающих модерации.</div>`;
                }
            });

            container.appendChild(card);
        });
    }

    async refreshSuggestedAuthors() {
        const container = document.getElementById('admin-pending-authors-list');
        const countBadge = document.getElementById('admin-pending-authors-count');
        if (!container) return;

        container.innerHTML = `<div class="table-empty">Загрузка предложенных авторов...</div>`;

        const suggestions = await window.supabaseService.getSuggestedAuthors();
        if (countBadge) countBadge.textContent = `${suggestions.length} предложений`;

        container.innerHTML = '';
        if (suggestions.length === 0) {
            container.innerHTML = `<div class="table-empty">Нет предложенных авторов, ожидающих проверки.</div>`;
            return;
        }

        suggestions.forEach(item => {
            const card = document.createElement('div');
            card.className = 'admin-author-suggestion-card';

            const firstChar = (item.name && item.name.length > 0 ? item.name[0] : '?').toUpperCase();
            const avatarStyle = item.avatar_color ? `style="background:${escapeHtml(safeCssValue(item.avatar_color))};"` : '';
            card.innerHTML = `
                <div class="aasc-avatar" ${avatarStyle}>${escapeHtml(firstChar)}</div>
                <div class="aasc-info">
                    <div class="aasc-header-row">
                        <strong class="aasc-name">${escapeHtml(item.name)}</strong>
                        <span class="aasc-handle">${escapeHtml(item.handle || '@' + item.name)}</span>
                        ${item.badge ? `<span class="author-badge-pill" style="margin-left:6px; font-size:10px;">${escapeHtml(item.badge)}</span>` : ''}
                    </div>
                    <div class="aasc-meta">Предложил: <strong>${escapeHtml(item.submitted_by || 'Аноним')}</strong></div>
                    ${item.bio ? `<div class="aasc-bio">${escapeHtml(item.bio)}</div>` : ''}
                    <div class="aasc-actions">
                        <button type="button" class="btn-approve aasc-btn-approve">✓ Одобрить автора</button>
                        <button type="button" class="btn-reject aasc-btn-reject">✕ Отклонить</button>
                    </div>
                </div>
            `;

            card.querySelector('.aasc-btn-approve').addEventListener('click', async () => {
                await window.supabaseService.approveSuggestedAuthor(item);
                card.remove();
                window.app.showToast(`Автор ${item.name} добавлен в игру!`, 'success');
                await this.refreshAuthorsList();
                await this.refreshAdminStats();

                const remaining = container.querySelectorAll('.admin-author-suggestion-card').length;
                if (countBadge) countBadge.textContent = `${remaining} предложений`;
                if (remaining === 0) {
                    container.innerHTML = `<div class="table-empty">Нет предложенных авторов, ожидающих проверки.</div>`;
                }
            });

            card.querySelector('.aasc-btn-reject').addEventListener('click', async () => {
                await window.supabaseService.rejectSuggestedAuthor(item.id);
                card.remove();
                window.app.showToast('Предложенный автор отклонен', 'info');
                await this.refreshAdminStats();

                const remaining = container.querySelectorAll('.admin-author-suggestion-card').length;
                if (countBadge) countBadge.textContent = `${remaining} предложений`;
                if (remaining === 0) {
                    container.innerHTML = `<div class="table-empty">Нет предложенных авторов, ожидающих проверки.</div>`;
                }
            });

            container.appendChild(card);
        });
    }

    setupPasteListener() {
        window.addEventListener('paste', (e) => {
            const adminView = document.getElementById('view-admin');
            if (adminView.classList.contains('hidden')) return;

            const items = (e.clipboardData || e.originalEvent?.clipboardData)?.items;
            if (!items) return;

            for (const item of items) {
                if (item.kind === 'file' && item.type.startsWith('image/')) {
                    const blob = item.getAsFile();
                    this.handleFile(blob);
                    window.app.showToast('Скриншот вставлен из буфера обмена', 'success');
                    break;
                }
            }
        });
    }

    handleFile(file) {
        if (!file.type.startsWith('image/')) {
            window.app.showToast('Пожалуйста, выберите файл изображения (PNG, JPG, WebP)', 'warning');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            this.loadImageIntoCanvas(e.target.result);
        };
        reader.readAsDataURL(file);
    }

    loadImageIntoCanvas(dataUrl) {
        this.currentScreenshotDataUrl = dataUrl;
        const img = new Image();
        img.onload = () => {
            const canvas = document.getElementById('censor-canvas');
            const previewWrapper = document.getElementById('admin-preview-container');
            const dropzone = document.getElementById('admin-dropzone');

            const size = window.ImageUtil.scaledSize(img.width, img.height);
            canvas.width = size.width;
            canvas.height = size.height;
            const ctx = canvas.getContext('2d');
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(img, 0, 0, size.width, size.height);

            dropzone.classList.add('hidden');
            previewWrapper.classList.remove('hidden');

            this.maskHistory = [ctx.getImageData(0, 0, canvas.width, canvas.height)];
            this.currentScreenshotDataUrl = window.ImageUtil.canvasToDataUrl(canvas);
        };
        img.src = dataUrl;
    }

    setupCensorCanvas() {
        const canvas = document.getElementById('censor-canvas');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');

        let isDown = false;
        let startX = 0;
        let startY = 0;

        const getPos = (e) => {
            const rect = canvas.getBoundingClientRect();
            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;
            return {
                x: (e.clientX - rect.left) * scaleX,
                y: (e.clientY - rect.top) * scaleY
            };
        };

        canvas.addEventListener('mousedown', (e) => {
            isDown = true;
            const pos = getPos(e);
            startX = pos.x;
            startY = pos.y;
        });

        canvas.addEventListener('mousemove', (e) => {
            if (!isDown) return;
            const pos = getPos(e);
            const mode = document.querySelector('input[name="censor-tool"]:checked')?.value || 'blackout';

            const lastState = this.maskHistory[this.maskHistory.length - 1];
            if (lastState) {
                ctx.putImageData(lastState, 0, 0);
            }

            ctx.save();
            if (mode === 'blackout') {
                ctx.fillStyle = 'rgba(15, 15, 20, 0.85)';
                ctx.fillRect(startX, startY, pos.x - startX, pos.y - startY);
                ctx.strokeStyle = '#0080ff';
                ctx.lineWidth = 1.5;
                ctx.strokeRect(startX, startY, pos.x - startX, pos.y - startY);
            } else if (mode === 'blur') {
                ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
                ctx.fillRect(startX, startY, pos.x - startX, pos.y - startY);
            }
            ctx.restore();
        });

        const finishBox = (e) => {
            if (!isDown) return;
            isDown = false;
            const pos = getPos(e);
            const mode = document.querySelector('input[name="censor-tool"]:checked')?.value || 'blackout';

            const lastState = this.maskHistory[this.maskHistory.length - 1];
            if (lastState) {
                ctx.putImageData(lastState, 0, 0);
            }

            const x = Math.min(startX, pos.x);
            const y = Math.min(startY, pos.y);
            const w = Math.abs(pos.x - startX);
            const h = Math.abs(pos.y - startY);

            if (w > 3 && h > 3) {
                ctx.save();
                if (mode === 'blackout') {
                    ctx.fillStyle = '#111115';
                    ctx.fillRect(x, y, w, h);
                    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
                    ctx.lineWidth = 1;
                    ctx.strokeRect(x, y, w, h);
                } else if (mode === 'blur') {
                    ctx.fillStyle = 'rgba(15, 15, 20, 0.96)';
                    ctx.fillRect(x, y, w, h);
                }
                ctx.restore();

                this.maskHistory.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
                this.currentScreenshotDataUrl = window.ImageUtil.canvasToDataUrl(canvas);
                window.app.showToast('Область скрыта', 'info');
            }
        };

        canvas.addEventListener('mouseup', finishBox);
        canvas.addEventListener('mouseleave', () => {
            if (isDown) finishBox({ clientX: 0, clientY: 0 });
        });

        const undoBtn = document.getElementById('btn-undo-censor');
        if (undoBtn) {
            undoBtn.addEventListener('click', () => {
                if (this.maskHistory.length > 1) {
                    this.maskHistory.pop();
                    const prev = this.maskHistory[this.maskHistory.length - 1];
                    ctx.putImageData(prev, 0, 0);
                    this.currentScreenshotDataUrl = window.ImageUtil.canvasToDataUrl(canvas);
                    window.app.showToast('Действие отменено', 'info');
                }
            });
        }

        const changeImgBtn = document.getElementById('btn-change-screenshot');
        if (changeImgBtn) {
            changeImgBtn.addEventListener('click', () => {
                document.getElementById('admin-preview-container').classList.add('hidden');
                document.getElementById('admin-dropzone').classList.remove('hidden');
                this.currentScreenshotDataUrl = null;
                this.maskHistory = [];
                document.getElementById('admin-file-input').value = '';
            });
        }
    }

    async refreshPostsTable() {
        const requestId = ++this.postsRequestId;
        const query = (this.postsSearch || '').trim();
        let pagePosts = [];
        let total = 0;
        let loaded = false;

        if (window.supabaseService?.isConfigured) {
            try {
                let result = await window.supabaseService.fetchPostsPage({
                    limit: this.postsPerPage,
                    offset: (this.postsPage - 1) * this.postsPerPage,
                    query
                });
                if (result && result.posts.length === 0 && result.total > 0 && this.postsPage > 1) {
                    this.postsPage = Math.max(1, Math.ceil(result.total / this.postsPerPage));
                    result = await window.supabaseService.fetchPostsPage({
                        limit: this.postsPerPage,
                        offset: (this.postsPage - 1) * this.postsPerPage,
                        query
                    });
                }
                if (result) {
                    pagePosts = result.posts;
                    total = result.total;
                    loaded = true;
                    if (!query) this.postsAllTotal = total;
                }
            } catch (e) {
            }
        }

        if (!loaded) {
            const all = (await window.quizDB.getAllPosts()) || [];
            all.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
            const q = query.toLowerCase();
            const filtered = q ? all.filter(p => (p.postText || '').toLowerCase().includes(q) || (p.hint || '').toLowerCase().includes(q)) : all;
            total = filtered.length;
            if (!q) this.postsAllTotal = total;
            const maxPage = Math.max(1, Math.ceil(total / this.postsPerPage));
            if (this.postsPage > maxPage) this.postsPage = maxPage;
            const start = (this.postsPage - 1) * this.postsPerPage;
            pagePosts = filtered.slice(start, start + this.postsPerPage);
        }

        if (requestId !== this.postsRequestId) return;

        const badge = document.getElementById('admin-total-posts-badge');
        if (badge && this.postsAllTotal !== null) badge.textContent = `${this.postsAllTotal} постов`;

        this.cachedPosts = pagePosts;
        this.postsTotal = total;
        this.renderPostsTable();
    }

    renderPostsTable() {
        const tableBody = document.getElementById('admin-posts-tbody');
        if (!tableBody) return;

        const query = (this.postsSearch || '').trim();
        const pagePosts = this.cachedPosts || [];

        const totalItems = this.postsTotal || 0;
        const totalPages = Math.max(1, Math.ceil(totalItems / this.postsPerPage));
        if (this.postsPage < 1) this.postsPage = 1;

        const startIdx = (this.postsPage - 1) * this.postsPerPage;
        const endIdx = startIdx + pagePosts.length;

        tableBody.innerHTML = '';
        if (totalItems === 0) {
            tableBody.innerHTML = `<tr><td colspan="5" class="table-empty">${query ? 'По вашему запросу ничего не найдено' : 'В базе пока нет постов. Добавьте первый скриншот выше!'}</td></tr>`;
        } else {
            pagePosts.forEach((post, i) => {
                const globalIdx = startIdx + i + 1;
                const author = window.authorsManager.getById(post.correctAuthorId) || {
                    name: post.correctAuthorId,
                    handle: '@' + post.correctAuthorId
                };

                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td class="col-num">${globalIdx}</td>
                    <td class="col-thumb">
                        <img src="${escapeHtml(safeImageSrc(post.screenshot))}" alt="Thumb" class="post-table-thumb">
                    </td>
                    <td class="col-author">
                        <div class="table-author-cell">
                            <strong>${escapeHtml(author.name)}</strong>
                            <small>${escapeHtml(author.handle)}</small>
                        </div>
                    </td>
                    <td class="col-hint">${escapeHtml(post.hint || '—')}</td>
                    <td class="col-actions">
                        <button class="btn-action-icon test-btn" title="Протестировать вопрос">${window.Icons.target}</button>
                        <button class="btn-action-icon edit-btn" title="Редактировать">${window.Icons.edit}</button>
                        <button class="btn-action-icon del-btn" title="Удалить">${window.Icons.trash}</button>
                    </td>
                `;

                tr.querySelector('.post-table-thumb').addEventListener('click', () => {
                    window.gameEngine.toggleLightboxCustom(post.screenshot);
                });
                tr.querySelector('.test-btn').addEventListener('click', () => this.testQuestion(post));
                tr.querySelector('.edit-btn').addEventListener('click', () => this.editPost(post));
                tr.querySelector('.del-btn').addEventListener('click', () => this.deletePost(post.id));

                tableBody.appendChild(tr);
            });
        }

        const infoEl = document.getElementById('admin-posts-page-info');
        const pageNumEl = document.getElementById('posts-page-number');
        const prevBtn = document.getElementById('btn-posts-prev');
        const nextBtn = document.getElementById('btn-posts-next');

        if (infoEl) {
            infoEl.textContent = totalItems === 0 ? '0 вопросов' : `Показано ${startIdx + 1}–${endIdx} из ${totalItems} вопросов`;
        }
        if (pageNumEl) {
            pageNumEl.textContent = `${this.postsPage} / ${totalPages}`;
        }
        if (prevBtn) prevBtn.disabled = this.postsPage <= 1;
        if (nextBtn) nextBtn.disabled = this.postsPage >= totalPages;
    }

    async refreshAuthorsList() {
        this.renderAuthorsList();
    }

    renderAuthorsList() {
        const container = document.getElementById('admin-authors-list');
        if (!container) return;

        const authors = window.authorsManager.getAll() || [];
        const query = (this.authorsSearch || '').trim().toLowerCase();

        const filtered = authors.filter(a => {
            if (!query) return true;
            const name = (a.name || '').toLowerCase();
            const handle = (a.handle || '').toLowerCase();
            const bio = (a.bio || a.style || '').toLowerCase();
            const badge = (a.badge || '').toLowerCase();
            return name.includes(query) || handle.includes(query) || bio.includes(query) || badge.includes(query);
        });

        const totalItems = filtered.length;
        const totalPages = Math.max(1, Math.ceil(totalItems / this.authorsPerPage));
        if (this.authorsPage > totalPages) this.authorsPage = totalPages;
        if (this.authorsPage < 1) this.authorsPage = 1;

        const startIdx = (this.authorsPage - 1) * this.authorsPerPage;
        const endIdx = Math.min(totalItems, startIdx + this.authorsPerPage);
        const pageAuthors = filtered.slice(startIdx, endIdx);

        container.innerHTML = '';
        if (totalItems === 0) {
            container.innerHTML = `<div class="table-empty" style="grid-column: 1/-1;">${query ? 'Авторы по запросу не найдены' : 'Авторов в базе пока нет. Нажмите «+ Добавить автора».'}</div>`;
        } else {
            pageAuthors.forEach(a => {
                const card = document.createElement('div');
                card.className = 'admin-author-item';
                card.innerHTML = `
                    <div class="aai-avatar" style="background: ${escapeHtml(safeCssValue(a.avatarColor))}">${escapeHtml(a.avatarText || (a.name && a.name.length > 0 ? a.name[0] : '?'))}</div>
                    <div class="aai-info">
                        <div class="aai-name-row">
                            <strong>${escapeHtml(a.name)}</strong>
                            ${a.verified ? `<span class="verified-icon">${window.Icons.check}</span>` : ''}
                            ${a.badge ? `<span class="badge-tag">${escapeHtml(a.badge)}</span>` : ''}
                        </div>
                        <span class="aai-handle">${escapeHtml(a.handle || '@' + a.id)}</span>
                        <p class="aai-bio">${escapeHtml(a.bio || a.style || '')}</p>
                    </div>
                    <div class="aai-actions">
                        <button type="button" class="btn-edit-author" title="Редактировать автора">${window.Icons.edit}</button>
                        <button type="button" class="btn-del-author" title="Удалить автора">${window.Icons.cross}</button>
                    </div>
                `;

                card.querySelector('.btn-edit-author').addEventListener('click', () => {
                    this.openEditAuthorModal(a);
                });

                card.querySelector('.btn-del-author').addEventListener('click', async () => {
                    if (confirm(`Удалить автора "${a.name}" из базы?`)) {
                        await window.authorsManager.deleteAuthor(a.id);
                        await this.refreshAuthorsList();
                        await this.refreshAdminStats();
                        window.app.showToast('Автор удален', 'info');
                    }
                });

                container.appendChild(card);
            });
        }

        const infoEl = document.getElementById('admin-authors-page-info');
        const pageNumEl = document.getElementById('authors-page-number');
        const prevBtn = document.getElementById('btn-authors-prev');
        const nextBtn = document.getElementById('btn-authors-next');

        if (infoEl) {
            infoEl.textContent = totalItems === 0 ? '0 авторов' : `Показано ${startIdx + 1}–${endIdx} из ${totalItems} авторов`;
        }
        if (pageNumEl) {
            pageNumEl.textContent = `${this.authorsPage} / ${totalPages}`;
        }
        if (prevBtn) prevBtn.disabled = this.authorsPage <= 1;
        if (nextBtn) nextBtn.disabled = this.authorsPage >= totalPages;
    }

    async savePost() {
        if (!this.currentScreenshotDataUrl) {
            window.app.showToast('Пожалуйста, загрузите скриншот поста!', 'error');
            return;
        }

        const authorId = document.getElementById('admin-post-author-id').value;
        if (!authorId) {
            window.app.showToast('Пожалуйста, найдите и выберите автора поста через строку поиска!', 'error');
            return;
        }

        const postText = document.getElementById('admin-post-text').value.trim();
        const hint = document.getElementById('admin-post-hint').value.trim();
        const tagsInput = document.getElementById('admin-post-tags').value.trim();
        const tags = tagsInput ? tagsInput.split(',').map(t => t.trim().startsWith('#') ? t.trim() : '#' + t.trim()) : [];
        const difficulty = document.getElementById('admin-post-diff').value || 'normal';

        const postRecord = {
            id: this.editingPostId || ('post_' + Date.now()),
            correctAuthorId: authorId,
            postText: postText,
            screenshot: await window.ImageUtil.compressDataUrl(this.currentScreenshotDataUrl),
            hint: hint,
            difficulty: difficulty,
            tags: tags,
            createdAt: Date.now()
        };

        await window.supabaseService.savePost(postRecord);
        await window.quizDB.savePost(postRecord);

        window.app.showToast(this.editingPostId ? 'Пост успешно обновлен!' : 'Вопрос добавлен в викторину!', 'success');
        window.soundFX.playCorrect();

        this.resetForm();
        await this.refreshPostsTable();
        await this.refreshAdminStats();
    }

    editPost(post) {
        this.editingPostId = post.id;
        document.getElementById('admin-post-text').value = post.postText || '';
        document.getElementById('admin-post-hint').value = post.hint || '';
        document.getElementById('admin-post-tags').value = (post.tags || []).join(', ');
        document.getElementById('admin-post-diff').value = post.difficulty || 'normal';

        const author = window.authorsManager.getById(post.correctAuthorId);
        if (author) {
            this.selectAuthor(author);
        }

        this.loadImageIntoCanvas(post.screenshot);

        document.getElementById('admin-form-title').textContent = 'Редактирование вопроса';
        document.getElementById('btn-admin-submit').textContent = 'Сохранить изменения';

        document.getElementById('admin-post-form').scrollIntoView({ behavior: 'smooth' });
    }

    testQuestion(post) {
        window.app.switchTab('quiz');
        window.gameEngine.testSinglePost(post);
        window.app.showToast('Тестирование вопроса', 'info');
    }

    async deletePost(id) {
        if (confirm('Точно удалить этот вопрос из викторины?')) {
            await window.supabaseService.deletePost(id);
            await window.quizDB.deletePost(id);
            window.app.showToast('Вопрос удален', 'info');
            await this.refreshPostsTable();
            await this.refreshAdminStats();
        }
    }

    resetForm() {
        this.editingPostId = null;
        this.currentScreenshotDataUrl = null;
        this.maskHistory = [];
        this.clearSelectedAuthor();

        document.getElementById('admin-post-form').reset();
        document.getElementById('admin-preview-container').classList.add('hidden');
        document.getElementById('admin-dropzone').classList.remove('hidden');
        document.getElementById('admin-form-title').textContent = 'Загрузка скриншота поста';
        document.getElementById('btn-admin-submit').textContent = 'Добавить в викторину';
        document.getElementById('admin-file-input').value = '';
    }

    async exportBackup() {
        const json = await window.quizDB.exportBackup();
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `itd_quiz_backup_${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
        window.app.showToast('Резервная копия сохранена на устройство', 'success');
    }

    async importBackup(file) {
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                await window.quizDB.importBackup(e.target.result);
                await window.authorsManager.load();
                await this.refreshAuthorsList();
                await this.refreshPostsTable();
                await this.refreshAdminStats();
                window.app.showToast('База данных успешно импортирована!', 'success');
            } catch (err) {
                console.error(err);
                window.app.showToast('Ошибка при чтении бэкапа: ' + err.message, 'error');
            }
        };
        reader.readAsText(file);
    }

    async resetPresets() {
        if (confirm('Очистить локальные вопросы?')) {
            const all = await window.quizDB.getAllPosts();
            for (const p of all) {
                await window.quizDB.deletePost(p.id);
            }
            await this.refreshPostsTable();
            await this.refreshAdminStats();
            window.app.showToast('База постов очищена', 'info');
        }
    }

    openCreateAuthorModal() {
        document.getElementById('form-add-author')?.reset();
        const editIdInput = document.getElementById('modal-author-edit-id');
        if (editIdInput) editIdInput.value = '';
        const title = document.getElementById('modal-author-title');
        if (title) title.textContent = 'Добавить автора в базу';
        const submitBtn = document.getElementById('btn-save-author-modal');
        if (submitBtn) submitBtn.textContent = 'Сохранить автора';
        const verified = document.getElementById('modal-author-verified');
        if (verified) verified.checked = true;
        document.getElementById('modal-new-author')?.classList.remove('hidden');
        document.getElementById('modal-author-name')?.focus();
    }

    openEditAuthorModal(author) {
        if (!author) return;
        const form = document.getElementById('form-add-author');
        if (form) form.reset();

        const editIdInput = document.getElementById('modal-author-edit-id');
        if (editIdInput) editIdInput.value = author.id || '';

        const title = document.getElementById('modal-author-title');
        if (title) title.textContent = 'Редактировать автора';

        const submitBtn = document.getElementById('btn-save-author-modal');
        if (submitBtn) submitBtn.textContent = 'Сохранить изменения';

        const nameInput = document.getElementById('modal-author-name');
        if (nameInput) nameInput.value = author.name || '';

        const handleInput = document.getElementById('modal-author-handle');
        if (handleInput) handleInput.value = author.handle || '';

        const badgeInput = document.getElementById('modal-author-badge');
        if (badgeInput) badgeInput.value = author.badge || '';

        const colorSelect = document.getElementById('modal-author-color');
        if (colorSelect && author.avatarColor) colorSelect.value = author.avatarColor;

        const bioInput = document.getElementById('modal-author-bio');
        if (bioInput) bioInput.value = author.bio || author.style || '';

        const verifiedCheck = document.getElementById('modal-author-verified');
        if (verifiedCheck) verifiedCheck.checked = Boolean(author.verified);

        document.getElementById('modal-new-author')?.classList.remove('hidden');
        nameInput?.focus();
    }

    async saveNewAuthorFromModal() {
        const editId = document.getElementById('modal-author-edit-id')?.value.trim();
        const name = document.getElementById('modal-author-name').value.trim();
        const handle = document.getElementById('modal-author-handle').value.trim();
        const bio = document.getElementById('modal-author-bio').value.trim();
        const badge = document.getElementById('modal-author-badge').value.trim();
        const color = document.getElementById('modal-author-color').value;

        if (!name) {
            window.app.showToast('Укажите ник автора!', 'error');
            return;
        }

        const id = editId || (handle ? handle.replace('@', '') : name).toLowerCase().replace(/[^a-z0-9а-яё_]/gi, '_') + '_' + Date.now();

        await window.authorsManager.addAuthor({
            id,
            name,
            handle: handle ? (handle.startsWith('@') ? handle : '@' + handle) : '@' + id,
            bio,
            badge,
            avatarColor: color,
            avatarText: name ? name[0].toUpperCase() : '?',
            verified: Boolean(document.getElementById('modal-author-verified')?.checked)
        });

        document.getElementById('form-add-author')?.reset();
        const editIdInput = document.getElementById('modal-author-edit-id');
        if (editIdInput) editIdInput.value = '';
        document.getElementById('modal-new-author')?.classList.add('hidden');
        await this.refreshAuthorsList();
        await this.refreshPostsTable();
        await this.refreshAdminStats();
        window.app.showToast(editId ? `Данные автора ${name} обновлены!` : `Автор ${name} сохранен!`, 'success');
    }
}

window.adminManager = new AdminManager();
