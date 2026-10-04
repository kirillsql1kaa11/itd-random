// Game Engine: Quiz mechanics, scoring, streak multiplier, timers and animations
class GameEngine {
    constructor() {
        this.mode = 'blitz'; // 'blitz', 'survival', 'practice'
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
        const allPosts = await window.quizDB.getAllPosts();
        if (!allPosts || allPosts.length === 0) {
            window.app.showToast('Нет доступных постов для викторины!', 'error');
            return;
        }

        // Shuffle posts
        this.postsPool = [...allPosts].sort(() => Math.random() - 0.5);
        if (mode === 'blitz') {
            this.postsPool = this.postsPool.slice(0, 10);
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

        // Exactly 4 options: 1 guaranteed correct + 3 distinct distractors
        const correctAuthor = window.authorsManager.getById(this.currentPost.correctAuthorId) || {
            id: this.currentPost.correctAuthorId,
            name: this.currentPost.correctAuthorId,
            handle: '@' + this.currentPost.correctAuthorId,
            avatarColor: 'linear-gradient(135deg, #0080ff, #00ba7c)',
            avatarText: '?'
        };

        const distractors = window.authorsManager.getRandomDistractors(this.currentPost.correctAuthorId, 3);
        const allFour = [correctAuthor, ...distractors].sort(() => Math.random() - 0.5);
        this.currentOptions = allFour;

        this.renderQuestionUI();
        this.startTimer();
    }

    renderQuestionUI() {
        const questionEl = document.getElementById('view-quiz');
        if (!questionEl) return;

        // Update header stats
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

        // Streak multiplier indicator
        const multEl = document.getElementById('stat-multiplier');
        const mult = this.getStreakMultiplier();
        multEl.textContent = `x${mult}`;
        if (mult > 1) {
            multEl.classList.add('active');
        } else {
            multEl.classList.remove('active');
        }

        // Post screenshot
        const imgEl = document.getElementById('post-screenshot-img');
        imgEl.src = this.currentPost.screenshot;
        imgEl.alt = "Скриншот поста ИТД";

        // Hint box
        const hintBtn = document.getElementById('btn-use-hint');
        const hintText = document.getElementById('hint-content');
        hintText.classList.add('hidden');
        hintText.textContent = this.currentPost.hint || "Обратите внимание на синтаксис, тему и манеру подачи автора.";
        hintBtn.disabled = false;
        hintBtn.classList.remove('used');

        // Next button state
        const nextBtn = document.getElementById('btn-next-question');
        nextBtn.classList.add('hidden');

        // Author Reveal Box
        const revealCard = document.getElementById('author-reveal-card');
        revealCard.classList.add('hidden');
        revealCard.className = 'author-reveal-card hidden';

        // Render 4 answer buttons
        const optionsContainer = document.getElementById('quiz-options-grid');
        optionsContainer.innerHTML = '';

        this.currentOptions.forEach((author, idx) => {
            const btn = document.createElement('button');
            btn.className = 'quiz-option-btn';
            btn.dataset.authorId = author.id;
            btn.dataset.key = idx + 1;

            btn.innerHTML = `
                <div class="option-key-badge">${idx + 1}</div>
                <div class="option-avatar" style="background: ${author.avatarColor || '#333'}">
                    ${author.avatarText || author.name[0]}
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

    handleAnswer(chosenAuthorId, chosenBtn = null) {
        if (this.isAnswered) return;
        this.isAnswered = true;
        clearInterval(this.timer);

        const correctId = this.currentPost.correctAuthorId;
        const isCorrect = chosenAuthorId === correctId;
        const correctAuthor = window.authorsManager.getById(correctId) || {
            id: correctId,
            name: correctId,
            handle: '@' + correctId,
            bio: 'Автор в соцсети ИТД'
        };

        const buttons = document.querySelectorAll('.quiz-option-btn');
        buttons.forEach(btn => {
            btn.disabled = true;
            if (btn.dataset.authorId === correctId) {
                btn.classList.add('correct');
            } else if (chosenAuthorId && btn.dataset.authorId === chosenAuthorId && !isCorrect) {
                btn.classList.add('wrong');
            }
        });

        if (isCorrect) {
            this.streak++;
            if (this.streak > this.maxStreak) this.maxStreak = this.streak;

            const basePoints = 100;
            const speedBonus = Math.round((Math.max(0, this.timeLeft) / this.maxTime) * 50);
            const hintPenalty = this.hintUsed ? 30 : 0;
            const multiplier = this.getStreakMultiplier();
            const earned = Math.max(20, Math.round((basePoints + speedBonus - hintPenalty) * multiplier));

            this.score += earned;

            if (this.streak % 3 === 0 && this.streak > 0) {
                window.soundFX.playStreak();
                this.triggerConfetti();
                window.app.showToast(`Серия ответов: ${this.streak} (бонус x${multiplier})`, 'success');
            } else {
                window.soundFX.playCorrect();
            }

            this.showAuthorReveal(correctAuthor, true, earned);
        } else {
            this.streak = 0;
            window.soundFX.playWrong();

            if (this.mode === 'survival') {
                this.lives--;
                // Update live heart indicators immediately
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

        // Save round history
        this.history.push({
            post: this.currentPost,
            correctAuthor,
            chosenAuthorId,
            isCorrect
        });

        // Show Next button
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

        document.getElementById('reveal-avatar').style.background = author.avatarColor || '#0080ff';
        document.getElementById('reveal-avatar').textContent = author.avatarText || author.name[0];
        document.getElementById('reveal-name').textContent = author.name;
        document.getElementById('reveal-handle').textContent = author.handle || '@' + author.id;
        document.getElementById('reveal-bio').textContent = author.bio || author.style || 'Популярный автор в ИТД';

        const itdLink = document.getElementById('reveal-itd-link');
        itdLink.href = `https://xn--d1ah4a.com/`;
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

        // Update overall stats in DB and cloud leaderboard
        await this.updatePlayerStats();
        await window.supabaseService.saveScore({
            nickname: this.nickname,
            score: this.score,
            streak: this.maxStreak,
            accuracy: percent,
            mode: this.mode
        });

        // Switch to summary view
        document.querySelectorAll('.app-view').forEach(v => v.classList.add('hidden'));
        document.getElementById('view-summary').classList.remove('hidden');

        document.getElementById('sum-score').textContent = this.score;
        document.getElementById('sum-max-streak').textContent = this.maxStreak;
        document.getElementById('sum-accuracy').textContent = `${percent}% (${correctCount}/${total})`;
        document.getElementById('sum-rank').textContent = this.calculateRank(percent, this.score);

        // Render answer history recap
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

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

window.gameEngine = new GameEngine();
