class AdminManager {
    constructor() {
        this.isAuthenticated = false;
        this.currentScreenshotDataUrl = null;
        this.editingPostId = null;
        this.isDrawingMask = false;
        this.maskHistory = [];
        this.selectedAuthor = null;
    }

    init() {
        this.bindEvents();
        this.setupPasteListener();
        this.setupAuthorSearch();
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
    }

    setupPasswordSettings() {
        const formPassword = document.getElementById('form-change-admin-password');
        if (formPassword) {
            formPassword.addEventListener('submit', (e) => {
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
                window.supabaseService.setAdminPassword(val);
                newPassInput.value = '';
                window.app.showToast('Пароль администратора успешно изменен', 'success');
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
                    <div class="asi-avatar" style="background:${a.avatarColor || '#333'}">${a.avatarText || a.name[0]}</div>
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
            <div class="sap-avatar" style="background:${author.avatarColor || '#333'}">${author.avatarText || author.name[0]}</div>
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
            allAuthors.forEach(a => {
                const isSelected = (item.author_id && item.author_id === a.id) || (item.author_name && a.name.toLowerCase() === item.author_name.toLowerCase());
                authorSelectHtml += `<option value="${a.id}" ${isSelected ? 'selected' : ''}>${escapeHtml(a.name)} (${escapeHtml(a.handle || '')})</option>`;
            });
            authorSelectHtml += '</select>';

            card.innerHTML = `
                <img src="${item.screenshot}" alt="Предложенный скриншот" class="asc-thumb">
                <div class="asc-info">
                    <div class="asc-author-line">Автор: <strong>${escapeHtml(authorDisplayName)}</strong></div>
                    <div class="asc-meta-line">Предложил: <strong>${escapeHtml(item.submitted_by || 'Аноним')}</strong></div>
                    ${item.post_url ? `
                        <div class="asc-link-row">
                            <a href="${escapeHtml(item.post_url)}" target="_blank" rel="noopener noreferrer" class="asc-external-link">
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

            const firstChar = (item.name || '?')[0].toUpperCase();
            card.innerHTML = `
                <div class="aasc-avatar">${firstChar}</div>
                <div class="aasc-info">
                    <div class="aasc-header-row">
                        <strong class="aasc-name">${escapeHtml(item.name)}</strong>
                        <span class="aasc-handle">${escapeHtml(item.handle || '@' + item.name)}</span>
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

            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);

            dropzone.classList.add('hidden');
            previewWrapper.classList.remove('hidden');

            this.maskHistory = [ctx.getImageData(0, 0, canvas.width, canvas.height)];
            this.currentScreenshotDataUrl = canvas.toDataURL('image/png');
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
                this.currentScreenshotDataUrl = canvas.toDataURL('image/png');
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
                    this.currentScreenshotDataUrl = canvas.toDataURL('image/png');
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
        const tableBody = document.getElementById('admin-posts-tbody');
        if (!tableBody) return;

        let posts = [];
        if (window.supabaseService?.isConfigured) {
            const remotePosts = await window.supabaseService.fetchRemotePosts();
            if (Array.isArray(remotePosts)) {
                posts = remotePosts;
            }
        }
        if (posts.length === 0) {
            posts = await window.quizDB.getAllPosts();
        }

        const badge = document.getElementById('admin-total-posts-badge');
        if (badge) badge.textContent = `${posts.length} постов`;

        tableBody.innerHTML = '';
        if (posts.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="5" class="table-empty">В базе пока нет постов. Добавьте первый скриншот выше!</td></tr>`;
            return;
        }

        posts.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).forEach((post, idx) => {
            const author = window.authorsManager.getById(post.correctAuthorId) || {
                name: post.correctAuthorId,
                handle: '@' + post.correctAuthorId
            };

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="col-num">${idx + 1}</td>
                <td class="col-thumb">
                    <img src="${post.screenshot}" alt="Thumb" class="post-table-thumb">
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

    async refreshAuthorsList() {
        const container = document.getElementById('admin-authors-list');
        if (!container) return;

        const authors = window.authorsManager.getAll();
        container.innerHTML = '';

        if (authors.length === 0) {
            container.innerHTML = `<div class="table-empty" style="grid-column: 1/-1;">Авторов в базе пока нет. Нажмите «+ Добавить автора».</div>`;
            return;
        }

        authors.forEach(a => {
            const card = document.createElement('div');
            card.className = 'admin-author-item';
            card.innerHTML = `
                <div class="aai-avatar" style="background: ${a.avatarColor || '#333'}">${a.avatarText || a.name[0]}</div>
                <div class="aai-info">
                    <div class="aai-name-row">
                        <strong>${escapeHtml(a.name)}</strong>
                        ${a.verified ? `<span class="verified-icon">${window.Icons.check}</span>` : ''}
                        ${a.badge ? `<span class="badge-tag">${escapeHtml(a.badge)}</span>` : ''}
                    </div>
                    <span class="aai-handle">${escapeHtml(a.handle || '@' + a.id)}</span>
                    <p class="aai-bio">${escapeHtml(a.bio || a.style || '')}</p>
                </div>
                <button class="btn-del-author" title="Удалить автора">${window.Icons.cross}</button>
            `;

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
            screenshot: this.currentScreenshotDataUrl,
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

    async saveNewAuthorFromModal() {
        const name = document.getElementById('modal-author-name').value.trim();
        const handle = document.getElementById('modal-author-handle').value.trim();
        const bio = document.getElementById('modal-author-bio').value.trim();
        const badge = document.getElementById('modal-author-badge').value.trim();
        const color = document.getElementById('modal-author-color').value;

        if (!name) {
            window.app.showToast('Укажите ник автора!', 'error');
            return;
        }

        const id = (handle ? handle.replace('@', '') : name).toLowerCase().replace(/[^a-z0-9а-яё_]/gi, '_') + '_' + Date.now();

        await window.authorsManager.addAuthor({
            id,
            name,
            handle: handle ? (handle.startsWith('@') ? handle : '@' + handle) : '@' + id,
            bio,
            badge,
            avatarColor: color,
            verified: document.getElementById('modal-author-verified').checked
        });

        document.getElementById('form-add-author').reset();
        document.getElementById('modal-new-author').classList.add('hidden');
        await this.refreshAuthorsList();
        await this.refreshAdminStats();
        window.app.showToast(`Автор ${name} сохранен!`, 'success');
    }
}

window.adminManager = new AdminManager();
