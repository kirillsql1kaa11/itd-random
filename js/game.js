
class GameEngine {
    constructor() {
        this.mode = 'blitz'; 
        this.postsPool = [];
        this.currentIndex = 0;
        this.currentPost = null;
        this.currentOptions = [];
        this.score = 0;
        this.streak = 0;
        this.maxStreak = 0;
        this.lives = 3;
        this.timer = null;
        this.timeLeft = 15;
        this.maxTime = 15;
        this.isAnswered = false;
        this.hintUsed = false;
        this.history = [];
        this.nickname = localStorage.getItem('itd_player_nickname') || 'Аноним';
    }

    async init() {
        this.setupKeyboardShortcuts();
    }

    setNickname(name) {
        this.nickname = (name || 'Аноним').trim();
        localStorage.setItem('itd_player_nickname', this.nickname);
    }

    async start(mode = 'blitz') {
        this.mode = mode;
        this.sessionToken = null;
        let allPosts = [];

        try {
            const secureQuestions = await window.supabaseService.getQuizQuestions(mode);
            if (Array.isArray(secureQuestions) && secureQuestions.length > 0) {
                allPosts = secureQuestions;
                this.sessionToken = window.supabaseService?.sessionToken || null;
            }
        } catch (e) {
        }

        if (allPosts.length === 0) {
            if (window.supabaseService?.isConfigured && typeof window.supabaseService.fetchRemotePosts === 'function') {
                try {
                    const remote = await window.supabaseService.fetchRemotePosts();
                    if (Array.isArray(remote) && remote.length > 0) {
                        allPosts = remote;
                    }
                } catch (e) {
                }
            }
            if (allPosts.length === 0) {
                allPosts = await window.quizDB.getAllPosts();
            }
        }

        if (!allPosts || allPosts.length === 0) {
            window.app.showToast('В базе пока нет постов! Добавьте пост через панель управления или предложите на главной.', 'info');
            window.app.switchTab('home');
            return;
        }

        this.postsPool = [...allPosts];
        if (!this.postsPool[0]?.qToken) {
            this.postsPool.sort(() => Math.random() - 0.5);
            if (mode === 'blitz') {
                this.postsPool = this.postsPool.slice(0, 10);
            }
        }

        this.currentIndex = 0;
        this.score = 0;
        this.streak = 0;
        this.maxStreak = 0;
        this.lives = mode === 'survival' ? 3 : 0;
        this.history = [];
        
        document.querySelectorAll('.app-view').forEach(v => v.classList.add('hidden'));
        document.getElementById('view-quiz').classList.remove('hidden');

        this.loadCurrentQuestion();
    }

    testSinglePost(post) {
        this.mode = 'practice';
        this.postsPool = [post];
        this.currentIndex = 0;
        this.score = 0;
        this.streak = 0;
        this.history = [];

        document.querySelectorAll('.app-view').forEach(v => v.classList.add('hidden'));
        document.getElementById('view-quiz').classList.remove('hidden');

        this.loadCurrentQuestion();
    }

    loadCurrentQuestion() {
        if (this.currentIndex >= this.postsPool.length) {
            if (this.mode === 'survival') {
                this.postsPool = [...this.postsPool].sort(() => Math.random() - 0.5);
                this.currentIndex = 0;
            } else {
                this.finishGame();
                return;
            }
        }

        this.currentPost = this.postsPool[this.currentIndex];
        this.isAnswered = false;
        this.hintUsed = false;

        if (Array.isArray(this.currentPost.options) && this.currentPost.options.length > 0) {
            this.currentOptions = this.currentPost.options;
        } else {
            const correctAuthorId = this.currentPost.correctAuthorId;
            const correctAuthor = window.authorsManager.getById(correctAuthorId) || {
                id: correctAuthorId,
                name: correctAuthorId,
                handle: '@' + correctAuthorId,
                avatarColor: 'linear-gradient(135deg, #0080ff, #00ba7c)',
                avatarText: '?'
            };

            const distractors = window.authorsManager.getRandomDistractors(correctAuthorId, 3);
            const allFour = [correctAuthor, ...distractors].sort(() => Math.random() - 0.5);
            this.currentOptions = allFour;
        }

        this.renderQuestionUI();
        this.startTimer();
        this.preloadNextScreenshot();
    }

    preloadNextScreenshot() {
        const pool = this.postsPool || [];
        for (let i = 1; i <= 2; i++) {
            const next = pool[this.currentIndex + i];
            if (!next || !next.screenshot) continue;
            if (!this.preloadedImages) this.preloadedImages = new Map();
            if (this.preloadedImages.has(next.id)) continue;
            const img = new Image();
            img.decoding = 'async';
            img.src = next.screenshot;
            this.preloadedImages.set(next.id, img);
        }
        if (this.preloadedImages && this.preloadedImages.size > 8) {
            const oldest = this.preloadedImages.keys().next().value;
            this.preloadedImages.delete(oldest);
        }
    }

    renderQuestionUI() {
        const questionEl = document.getElementById('view-quiz');
        if (!questionEl) return;

        document.getElementById('stat-streak').textContent = this.streak;
        document.getElementById('stat-score').textContent = this.score;

        const roundLabel = document.getElementById('stat-round-label');
        if (this.mode === 'blitz') {
            roundLabel.textContent = `Пост ${this.currentIndex + 1} / ${this.postsPool.length}`;
        } else if (this.mode === 'survival') {
            let heartsHtml = '';
            for (let i = 0; i < 3; i++) {
                heartsHtml += i < this.lives ? window.Icons.heartFilled : window.Icons.heartEmpty;
            }
            roundLabel.innerHTML = `<span>Раунд ${this.currentIndex + 1}</span> <span class="lives-indicator">${heartsHtml}</span>`;
        } else {
            roundLabel.textContent = `Пост ${this.currentIndex + 1}`;
        }

        const multEl = document.getElementById('stat-multiplier');
        const mult = this.getStreakMultiplier();
        multEl.textContent = `x${mult}`;
        if (mult > 1) {
            multEl.classList.add('active');
        } else {
            multEl.classList.remove('active');
        }

        const imgEl = document.getElementById('post-screenshot-img');
        imgEl.src = this.currentPost.screenshot;
        imgEl.alt = "Скриншот поста ИТД";

        const hintBtn = document.getElementById('btn-use-hint');
        const hintText = document.getElementById('hint-content');
        hintText.classList.add('hidden');
        hintText.textContent = this.currentPost.hint || "Обратите внимание на синтаксис, тему и манеру подачи автора.";
        hintBtn.disabled = false;
        hintBtn.classList.remove('used');

        const nextBtn = document.getElementById('btn-next-question');
        nextBtn.classList.add('hidden');

        const revealCard = document.getElementById('author-reveal-card');
        revealCard.classList.add('hidden');
        revealCard.className = 'author-reveal-card hidden';

        const optionsContainer = document.getElementById('quiz-options-grid');
        optionsContainer.innerHTML = '';

        this.currentOptions.forEach((author, idx) => {
            const btn = document.createElement('button');
            btn.className = 'quiz-option-btn';
            btn.dataset.authorId = author.id;
            btn.dataset.key = idx + 1;

            btn.innerHTML = `
                <div class="option-key-badge">${idx + 1}</div>
                <div class="option-avatar" style="background: ${escapeHtml(safeCssValue(author.avatarColor))}">
                    ${escapeHtml(author.avatarText || (author.name && author.name.length > 0 ? author.name[0] : '?'))}
                </div>
                <div class="option-meta">
                    <div class="option-name-row">
                        <span class="option-name">${escapeHtml(author.name)}</span>
                        ${author.verified ? `<span class="verified-icon" title="Верифицирован">${window.Icons.check}</span>` : ''}
                    </div>
                    <span class="option-handle">${escapeHtml(author.handle || '@' + author.id)}</span>
                </div>
            `;

            btn.addEventListener('click', () => {
                this.handleAnswer(author.id, btn);
            });

            optionsContainer.appendChild(btn);
        });

        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    startTimer() {
        clearInterval(this.timer);
        const timerBar = document.getElementById('timer-progress-fill');
        const timerBox = document.getElementById('quiz-timer-box');
        
        if (this.mode === 'practice') {
            timerBox.style.display = 'none';
            return;
        }
        timerBox.style.display = 'flex';

        this.timeLeft = this.maxTime;
        timerBar.style.width = '100%';
        timerBar.classList.remove('warning', 'danger');

        this.timer = setInterval(() => {
            if (this.isAnswered) {
                clearInterval(this.timer);
                return;
            }

            this.timeLeft -= 0.1;
            const pct = Math.max(0, (this.timeLeft / this.maxTime) * 100);
            timerBar.style.width = `${pct}%`;

            if (pct < 40 && pct > 20) {
                timerBar.classList.add('warning');
            } else if (pct <= 20) {
                timerBar.classList.add('danger');
            }

            if (this.timeLeft <= 0) {
                clearInterval(this.timer);
                this.handleTimeout();
            }
        }, 100);
    }

    async handleAnswer(chosenAuthorId, chosenBtn = null) {
        if (this.isAnswered) return;
        this.isAnswered = true;
        clearInterval(this.timer);

        const buttons = document.querySelectorAll('.quiz-option-btn');
        buttons.forEach(btn => {
            btn.disabled = true;
        });
        if (chosenBtn) {
            chosenBtn.classList.add('loading');
        }

        let isCorrect = false;
        let correctId = null;
        let correctAuthor = null;
        let serverEarned = null;

        if (this.currentPost.qToken) {
            try {
                const verifyRes = await window.supabaseService.verifyAnswer(
                    this.currentPost.qToken,
                    chosenAuthorId,
                    this.currentPost.id,
                    { timeLeft: this.timeLeft, hintUsed: this.hintUsed }
                );
                if (verifyRes) {
                    isCorrect = Boolean(verifyRes.isCorrect);
                    correctId = verifyRes.correctAuthorId;
                    correctAuthor = verifyRes.correctAuthor;
                    if (verifyRes.sessionToken) {
                        this.sessionToken = verifyRes.sessionToken;
                    }
                    if (typeof verifyRes.serverScore === 'number') {
                        this.score = verifyRes.serverScore;
                    }
                    if (typeof verifyRes.serverStreak === 'number') {
                        this.streak = verifyRes.serverStreak;
                        if (this.streak > this.maxStreak) this.maxStreak = this.streak;
                    }
                    if (typeof verifyRes.pointsEarned === 'number') {
                        serverEarned = verifyRes.pointsEarned;
                    }
                }
            } catch (err) {
            }
        }

        if (!correctAuthor) {
            correctId = this.currentPost.correctAuthorId;
            isCorrect = chosenAuthorId === correctId;
            correctAuthor = window.authorsManager.getById(correctId) || {
                id: correctId,
                name: correctId,
                handle: '@' + correctId,
                bio: 'Автор в соцсети ИТД'
            };
        }

        if (chosenBtn) {
            chosenBtn.classList.remove('loading');
        }

        buttons.forEach(btn => {
            if (correctId && btn.dataset.authorId === correctId) {
                btn.classList.add('correct');
            } else if (chosenAuthorId && btn.dataset.authorId === chosenAuthorId && !isCorrect) {
                btn.classList.add('wrong');
            }
        });

        if (isCorrect) {
            const basePoints = 100;
            const speedBonus = Math.round((Math.max(0, this.timeLeft) / this.maxTime) * 50);
            const hintPenalty = this.hintUsed ? 30 : 0;
            const multiplier = this.getStreakMultiplier();
            let earned = serverEarned;
            if (typeof earned !== 'number') {
                this.streak++;
                if (this.streak > this.maxStreak) this.maxStreak = this.streak;
                earned = Math.max(20, Math.round((basePoints + speedBonus - hintPenalty) * multiplier));
                this.score += earned;
            }

            if (this.streak % 3 === 0 && this.streak > 0) {
                window.soundFX.playStreak();
                this.triggerConfetti();
                window.app.showToast(`Серия ответов: ${this.streak} (бонус x${multiplier})`, 'success');
            } else {
                window.soundFX.playCorrect();
            }

            this.showAuthorReveal(correctAuthor, true, earned);
        } else {
            if (typeof serverEarned !== 'number') {
                this.streak = 0;
            }
            window.soundFX.playWrong();

            if (this.mode === 'survival') {
                this.lives--;
                
                const roundLabel = document.getElementById('stat-round-label');
                let heartsHtml = '';
                for (let i = 0; i < 3; i++) {
                    heartsHtml += i < this.lives ? window.Icons.heartFilled : window.Icons.heartEmpty;
                }
                roundLabel.innerHTML = `<span>Раунд ${this.currentIndex + 1}</span> <span class="lives-indicator">${heartsHtml}</span>`;
            }

            this.showAuthorReveal(correctAuthor, false, 0);

            if (this.mode === 'survival' && this.lives <= 0) {
                setTimeout(() => {
                    this.finishGame();
                }, 2200);
                return;
            }
        }

        this.history.push({
            post: this.currentPost,
            correctAuthor,
            chosenAuthorId,
            isCorrect
        });

        const nextBtn = document.getElementById('btn-next-question');
        nextBtn.classList.remove('hidden');
        nextBtn.focus();
    }

    handleTimeout() {
        window.app.showToast('Время на ответ истекло', 'warning');
        this.handleAnswer(null, null);
    }

    showAuthorReveal(author, isCorrect, pointsEarned) {
        const revealCard = document.getElementById('author-reveal-card');
        revealCard.classList.remove('hidden');
        revealCard.classList.add(isCorrect ? 'reveal-correct' : 'reveal-wrong');

        document.getElementById('reveal-title').innerHTML = isCorrect 
            ? `<span class="reveal-status-icon">${window.Icons.check}</span> Верно! (+${pointsEarned} очков)` 
            : `<span class="reveal-status-icon">${window.Icons.cross}</span> Неверно. Автор поста:`;

        document.getElementById('reveal-avatar').style.background = safeCssValue(author.avatarColor, '#0080ff');
        document.getElementById('reveal-avatar').textContent = author.avatarText || (author.name && author.name.length > 0 ? author.name[0] : '?');
        document.getElementById('reveal-name').textContent = author.name;
        document.getElementById('reveal-handle').textContent = author.handle || '@' + author.id;
        document.getElementById('reveal-bio').textContent = author.bio || author.style || 'Популярный автор в ИТД';

        const itdLink = document.getElementById('reveal-itd-link');
        let postUrl = '';
        if (this.currentPost.hint && this.currentPost.hint.startsWith('Оригинал: ')) {
            postUrl = safeUrl(this.currentPost.hint.replace('Оригинал: ', '').trim());
        }
        if (postUrl) {
            itdLink.href = postUrl;
            itdLink.textContent = 'Открыть пост в ИТД ↗';
        } else {
            const rawNick = (author.handle || author.id || '').trim();
            let profileUrl = 'https://xn--d1ah4a.com/';
            if (rawNick.startsWith('http://') || rawNick.startsWith('https://')) {
                profileUrl = safeUrl(rawNick, profileUrl);
            } else if (rawNick) {
                const cleanNick = rawNick.replace(/^@+/, '');
                if (cleanNick) {
                    profileUrl = `https://xn--d1ah4a.com/@${encodeURIComponent(cleanNick)}`;
                }
            }
            itdLink.href = profileUrl;
            itdLink.textContent = 'Профиль в ИТД ↗';
        }
    }

    getStreakMultiplier() {
        if (this.streak >= 8) return 3.0;
        if (this.streak >= 5) return 2.0;
        if (this.streak >= 3) return 1.5;
        return 1.0;
    }

    useHint() {
        if (this.isAnswered || this.hintUsed) return;
        this.hintUsed = true;
        const hintText = document.getElementById('hint-content');
        const hintBtn = document.getElementById('btn-use-hint');
        hintText.classList.remove('hidden');
        hintBtn.disabled = true;
        hintBtn.classList.add('used');
        window.soundFX.playClick();
    }

    next() {
        this.currentIndex++;
        this.loadCurrentQuestion();
    }

    async finishGame() {
        clearInterval(this.timer);
        window.soundFX.playWin();
        this.triggerConfetti();

        const correctCount = this.history.filter(h => h.isCorrect).length;
        const total = this.history.length;
        const percent = total > 0 ? Math.round((correctCount / total) * 100) : 0;

        await this.updatePlayerStats();
        await window.supabaseService.saveScore({
            nickname: this.nickname,
            score: this.score,
            streak: this.maxStreak,
            accuracy: percent,
            mode: this.mode,
            sessionToken: this.sessionToken
        });

        document.querySelectorAll('.app-view').forEach(v => v.classList.add('hidden'));
        document.getElementById('view-summary').classList.remove('hidden');

        document.getElementById('sum-score').textContent = this.score;
        document.getElementById('sum-max-streak').textContent = this.maxStreak;
        document.getElementById('sum-accuracy').textContent = `${percent}% (${correctCount}/${total})`;
        document.getElementById('sum-rank').textContent = this.calculateRank(percent, this.score);

        this.lastResult = {
            nickname: this.nickname,
            mode: this.mode,
            score: this.score,
            streak: this.maxStreak,
            accuracy: `${percent}% (${correctCount}/${total})`,
            rank: this.calculateRank(percent, this.score)
        };
        this.renderShareCardPreview();

        const historyContainer = document.getElementById('summary-history-list');
        historyContainer.innerHTML = '';
        this.history.forEach((item) => {
            const row = document.createElement('div');
            row.className = `summary-history-item ${item.isCorrect ? 'correct' : 'wrong'}`;
            row.innerHTML = `
                <div class="shi-status">${item.isCorrect ? window.Icons.check : window.Icons.cross}</div>
                <div class="shi-body">
                    <div class="shi-snippet">${escapeHtml(item.post.postText || 'Скриншот поста')}</div>
                    <div class="shi-meta">
                        Автор: <strong>${escapeHtml(item.correctAuthor.name)}</strong> (${escapeHtml(item.correctAuthor.handle)})
                    </div>
                </div>
            `;
            historyContainer.appendChild(row);
        });
    }

    async renderShareCardPreview() {
        const img = document.getElementById('share-card-preview');
        if (!img || !this.lastResult || !window.ShareCard) return;
        try {
            const res = await window.ShareCard.generate(this.lastResult);
            if (res && res.dataUrl) {
                img.src = res.dataUrl;
                img.style.display = 'block';
            }
        } catch (_) {
        }
    }

    calculateRank(pct, score) {
        if (pct >= 90) return "Легенда ИТД";
        if (pct >= 70) return "Знаток ленты ИТД";
        if (pct >= 50) return "Внимательный скроллер";
        if (pct >= 30) return "Случайный читатель";
        return "Новичок в ИТД";
    }

    async updatePlayerStats() {
        const stats = await window.quizDB.getSetting('player_stats', {
            gamesPlayed: 0,
            totalScore: 0,
            bestStreak: 0,
            correctAnswers: 0,
            totalAnswers: 0
        });

        stats.gamesPlayed += 1;
        stats.totalScore += this.score;
        if (this.maxStreak > stats.bestStreak) {
            stats.bestStreak = this.maxStreak;
        }
        stats.correctAnswers += this.history.filter(h => h.isCorrect).length;
        stats.totalAnswers += this.history.length;

        await window.quizDB.setSetting('player_stats', stats);
    }

    setupKeyboardShortcuts() {
        window.addEventListener('keydown', (e) => {
            if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;

            const quizView = document.getElementById('view-quiz');
            if (quizView.classList.contains('hidden')) return;

            if (['1', '2', '3', '4'].includes(e.key)) {
                const idx = parseInt(e.key) - 1;
                const author = this.currentOptions[idx];
                if (author && !this.isAnswered) {
                    this.handleAnswer(author.id);
                }
            } else if (e.code === 'Space' || e.key === 'Enter') {
                if (this.isAnswered) {
                    e.preventDefault();
                    this.next();
                }
            } else if (e.key === 'h' || e.key === 'H' || e.key === 'р' || e.key === 'Р') {
                this.useHint();
            } else if (e.key === 'z' || e.key === 'Z' || e.key === 'я' || e.key === 'Я') {
                this.toggleLightbox();
            }
        });
    }

    toggleLightbox() {
        const lightbox = document.getElementById('image-lightbox');
        const lbImg = document.getElementById('lightbox-img');
        if (lightbox.classList.contains('hidden')) {
            lbImg.src = this.currentPost.screenshot;
            lightbox.classList.remove('hidden');
        } else {
            lightbox.classList.add('hidden');
        }
    }

    triggerConfetti() {
        const canvas = document.getElementById('confetti-canvas');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        const particles = [];
        const colors = ['#0080ff', '#f91880', '#00ba7c', '#f59e0b', '#a855f7', '#ffffff'];

        for (let i = 0; i < 60; i++) {
            particles.push({
                x: canvas.width / 2,
                y: canvas.height * 0.4,
                vx: (Math.random() - 0.5) * 12,
                vy: (Math.random() - 0.8) * 14,
                size: Math.random() * 8 + 4,
                color: colors[Math.floor(Math.random() * colors.length)],
                rotation: Math.random() * 360,
                rSpeed: (Math.random() - 0.5) * 10,
                alpha: 1
            });
        }

        let animFrame;
        const render = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            let active = false;

            particles.forEach(p => {
                p.x += p.vx;
                p.y += p.vy;
                p.vy += 0.35;
                p.vx *= 0.98;
                p.rotation += p.rSpeed;
                p.alpha -= 0.015;

                if (p.alpha > 0) {
                    active = true;
                    ctx.save();
                    ctx.translate(p.x, p.y);
                    ctx.rotate((p.rotation * Math.PI) / 180);
                    ctx.globalAlpha = Math.max(0, p.alpha);
                    ctx.fillStyle = p.color;
                    ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.7);
                    ctx.restore();
                }
            });

            if (active) {
                animFrame = requestAnimationFrame(render);
            } else {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                cancelAnimationFrame(animFrame);
            }
        };

        render();
    }
}


window.gameEngine = new GameEngine();
