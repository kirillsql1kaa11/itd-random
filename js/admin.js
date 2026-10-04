
class AdminManager {
    constructor() {
        this.isAuthenticated = false;
        this.currentScreenshotDataUrl = null;
        this.editingPostId = null;
        this.isDrawingMask = false;
        this.maskHistory = [];
    }

    init() {
        this.bindEvents();
        this.setupPasteListener();
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

        const authorSelect = document.getElementById('admin-author-select');
        if (authorSelect) {
            authorSelect.addEventListener('change', (e) => {
                const newAuthorBox = document.getElementById('admin-new-author-fields');
                if (e.target.value === '__new__') {
                    newAuthorBox.classList.remove('hidden');
                } else {
                    newAuthorBox.classList.add('hidden');
                }
            });
        }

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

        const formDbConfig = document.getElementById('form-admin-supabase');
        if (formDbConfig) {
            
            document.getElementById('input-admin-sb-url').value = window.supabaseService.url;
            document.getElementById('input-admin-sb-key').value = window.supabaseService.key;

            formDbConfig.addEventListener('submit', async (e) => {
                e.preventDefault();
                const url = document.getElementById('input-admin-sb-url').value.trim();
                const key = document.getElementById('input-admin-sb-key').value.trim();
                window.supabaseService.setCredentials(url, key);
                
                window.app.showToast('Проверка подключения к Supabase...', 'info');
                const ok = await window.supabaseService.testConnection();
                if (ok) {
                    window.app.showToast('Подключение к Supabase успешно установлено!', 'success');
                } else {
                    window.app.showToast('Подключение сохранено (проверьте URL/Key при ошибке)', 'warning');
                }
                this.updateSupabaseBadge();
            });
        }

        const btnClearDb = document.getElementById('btn-clear-supabase');
        if (btnClearDb) {
            btnClearDb.addEventListener('click', () => {
                window.supabaseService.clearCredentials();
                document.getElementById('input-admin-sb-url').value = '';
                document.getElementById('input-admin-sb-key').value = '';
                window.app.showToast('Параметры Supabase сброшены (режим локальной БД)', 'info');
                this.updateSupabaseBadge();
            });
        }
    }

    updateSupabaseBadge() {
        const badge = document.getElementById('admin-db-status');
        if (!badge) return;
        if (window.supabaseService.isConfigured) {
            badge.textContent = 'Supabase Cloud: Активен';
            badge.style.color = 'var(--accent-green)';
            badge.style.background = 'rgba(0, 186, 124, 0.15)';
        } else {
            badge.textContent = 'Локальная БД (IndexedDB)';
            badge.style.color = 'var(--text-muted)';
            badge.style.background = 'var(--bg-secondary)';
        }
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
            const mode = document.querySelector('input[name="censor-tool"]:checked')?.value || 'blackout';
            const pos = getPos(e);

            const lastState = this.maskHistory[this.maskHistory.length - 1];
            if (lastState) {
                ctx.putImageData(lastState, 0, 0);
            }

            const x = Math.min(startX, pos.x);
            const y = Math.min(startY, pos.y);
            const w = Math.abs(pos.x - startX);
            const h = Math.abs(pos.y - startY);

            ctx.save();
            if (mode === 'blackout') {
                ctx.fillStyle = '#0f0f12';
                ctx.fillRect(x, y, w, h);
                ctx.strokeStyle = '#0080ff';
                ctx.lineWidth = 2;
                ctx.strokeRect(x, y, w, h);
            } else if (mode === 'blur') {
                ctx.fillStyle = 'rgba(20, 20, 25, 0.95)';
                ctx.fillRect(x, y, w, h);
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

    async refreshAuthorsDropdown() {
        const select = document.getElementById('admin-author-select');
        if (!select) return;

        const authors = window.authorsManager.getAll();
        select.innerHTML = '<option value="" disabled selected>— Выберите автора из списка —</option>';

        authors.forEach(a => {
            const opt = document.createElement('option');
            opt.value = a.id;
            opt.textContent = `${a.name} (${a.handle || '@' + a.id})`;
            select.appendChild(opt);
        });

        const newOpt = document.createElement('option');
        newOpt.value = '__new__';
        newOpt.textContent = '+ Создать нового автора...';
        select.appendChild(newOpt);
    }

    async refreshPostsTable() {
        const tableBody = document.getElementById('admin-posts-tbody');
        if (!tableBody) return;

        const posts = await window.quizDB.getAllPosts();
        document.getElementById('admin-total-posts-badge').textContent = `${posts.length} постов`;

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
                if (confirm(`Удалить автора "${a.name}" из пула вариантов?`)) {
                    await window.authorsManager.deleteAuthor(a.id);
                    await this.refreshAuthorsList();
                    await this.refreshAuthorsDropdown();
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

        let authorId = document.getElementById('admin-author-select').value;
        if (!authorId) {
            window.app.showToast('Укажите правильного автора поста!', 'error');
            return;
        }

        if (authorId === '__new__') {
            const newName = document.getElementById('admin-new-author-name').value.trim();
            const newHandle = document.getElementById('admin-new-author-handle').value.trim();
            const newBio = document.getElementById('admin-new-author-bio').value.trim();

            if (!newName) {
                window.app.showToast('Введите имя нового автора!', 'error');
                return;
            }

            const cleanId = (newHandle ? newHandle.replace('@', '') : newName)
                .toLowerCase()
                .replace(/[^a-z0-9а-яё_]/gi, '_') + '_' + Date.now();

            const newAuthor = await window.authorsManager.addAuthor({
                id: cleanId,
                name: newName,
                handle: newHandle ? (newHandle.startsWith('@') ? newHandle : '@' + newHandle) : '@' + cleanId,
                bio: newBio,
                verified: false
            });

            authorId = newAuthor.id;
            await this.refreshAuthorsDropdown();
            await this.refreshAuthorsList();
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

        await window.quizDB.savePost(postRecord);
        window.app.showToast(this.editingPostId ? 'Пост успешно обновлен!' : 'Вопрос добавлен в викторину!', 'success');
        window.soundFX.playCorrect();

        this.resetForm();
        await this.refreshPostsTable();
    }

    editPost(post) {
        this.editingPostId = post.id;
        document.getElementById('admin-post-text').value = post.postText || '';
        document.getElementById('admin-post-hint').value = post.hint || '';
        document.getElementById('admin-post-tags').value = (post.tags || []).join(', ');
        document.getElementById('admin-post-diff').value = post.difficulty || 'normal';

        const select = document.getElementById('admin-author-select');
        select.value = post.correctAuthorId;
        document.getElementById('admin-new-author-fields').classList.add('hidden');

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
            await window.quizDB.deletePost(id);
            window.app.showToast('Вопрос удален', 'info');
            await this.refreshPostsTable();
        }
    }

    resetForm() {
        this.editingPostId = null;
        this.currentScreenshotDataUrl = null;
        this.maskHistory = [];

        document.getElementById('admin-post-form').reset();
        document.getElementById('admin-preview-container').classList.add('hidden');
        document.getElementById('admin-dropzone').classList.remove('hidden');
        document.getElementById('admin-new-author-fields').classList.add('hidden');
        document.getElementById('admin-form-title').textContent = 'Загрузка нового скриншота поста';
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
                await this.refreshAuthorsDropdown();
                await this.refreshAuthorsList();
                await this.refreshPostsTable();
                window.app.showToast('База данных успешно импортирована!', 'success');
            } catch (err) {
                console.error(err);
                window.app.showToast('Ошибка при чтении бэкапа: ' + err.message, 'error');
            }
        };
        reader.readAsText(file);
    }

    async resetPresets() {
        if (confirm('Сбросить вопросы к стандартному стартовому паку ИТД?')) {
            await window.PresetsManager.initPresetsIfEmpty();
            await this.refreshPostsTable();
            window.app.showToast('Стартовый пак восстановлен', 'success');
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
        await this.refreshAuthorsDropdown();
        await this.refreshAuthorsList();
        window.app.showToast(`Автор ${name} добавлен в базу!`, 'success');
    }
}

window.adminManager = new AdminManager();
