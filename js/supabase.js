class SupabaseService {
    constructor() {
        const configUrl = window.APP_CONFIG?.supabaseUrl || '';
        const configKey = window.APP_CONFIG?.supabaseKey || '';
        this.url = localStorage.getItem('supabase_url') || configUrl;
        this.key = localStorage.getItem('supabase_key') || configKey;
        this.isConfigured = Boolean(this.url && this.key);
    }

    setCredentials(url, key) {
        this.url = (url || '').trim().replace(/\/$/, '');
        this.key = (key || '').trim();
        this.isConfigured = Boolean(this.url && this.key);
        localStorage.setItem('supabase_url', this.url);
        localStorage.setItem('supabase_key', this.key);
    }

    clearCredentials() {
        this.url = '';
        this.key = '';
        this.isConfigured = false;
        localStorage.removeItem('supabase_url');
        localStorage.removeItem('supabase_key');
    }

    async request(endpoint, options = {}) {
        if (!this.isConfigured) {
            throw new Error('Supabase не настроен');
        }

        const headers = {
            'apikey': this.key,
            'Authorization': `Bearer ${this.key}`,
            'Content-Type': 'application/json',
            'Prefer': options.prefer || 'return=representation',
            ...(options.headers || {})
        };

        const res = await fetch(`${this.url}/rest/v1/${endpoint}`, {
            method: options.method || 'GET',
            headers,
            body: options.body ? JSON.stringify(options.body) : undefined
        });

        if (!res.ok) {
            const errText = await res.text();
            throw new Error(`Supabase error (${res.status}): ${errText}`);
        }

        if (res.status === 204) return null;
        return await res.json();
    }

    async testConnection() {
        if (!this.isConfigured) return false;
        try {
            await this.request('authors?select=id&limit=1');
            return true;
        } catch (e) {
            console.warn(e);
            return false;
        }
    }

    getAdminPassword() {
        return localStorage.getItem('itd_admin_custom_password') || window.APP_CONFIG?.adminPassword || 'admin';
    }

    setAdminPassword(newPassword) {
        if (!newPassword || newPassword.trim().length === 0) return false;
        localStorage.setItem('itd_admin_custom_password', newPassword.trim());
        return true;
    }

    async getLeaderboard(limit = 25) {
        if (!this.isConfigured) {
            const local = JSON.parse(localStorage.getItem('itd_local_leaderboard') || '[]');
            return local.sort((a, b) => b.score - a.score).slice(0, limit);
        }

        try {
            const data = await this.request(`leaderboard?select=*&order=score.desc&limit=${limit}`);
            return data;
        } catch (e) {
            console.warn(e);
            const local = JSON.parse(localStorage.getItem('itd_local_leaderboard') || '[]');
            return local.sort((a, b) => b.score - a.score).slice(0, limit);
        }
    }

    async saveScore({ nickname, score, streak, accuracy, mode }) {
        const record = {
            nickname: nickname || 'Анонимный скроллер',
            score: Number(score) || 0,
            streak: Number(streak) || 0,
            accuracy: Number(accuracy) || 0,
            mode: mode || 'blitz'
        };

        const local = JSON.parse(localStorage.getItem('itd_local_leaderboard') || '[]');
        local.push({ ...record, id: 'local_' + Date.now(), created_at: new Date().toISOString() });
        localStorage.setItem('itd_local_leaderboard', JSON.stringify(local.slice(-100)));

        if (this.isConfigured) {
            try {
                await this.request('leaderboard', {
                    method: 'POST',
                    body: record
                });
            } catch (e) {
                console.warn(e);
            }
        }
        return record;
    }

    async submitPostSuggestion({ authorId, authorName, screenshot, postText, postUrl, submittedBy }) {
        let fullText = (postText || '').trim();
        const cleanUrl = (postUrl || '').trim();
        if (cleanUrl) {
            fullText = fullText ? `${fullText}\n\n🔗 ${cleanUrl}` : `🔗 ${cleanUrl}`;
        }

        const item = {
            author_id: authorId || null,
            author_name: authorName || 'Не указан',
            screenshot: screenshot,
            post_text: fullText,
            submitted_by: submittedBy || 'Аноним',
            status: 'pending'
        };

        const localSuggestions = JSON.parse(localStorage.getItem('itd_local_suggestions') || '[]');
        const localItem = { ...item, id: 'sugg_' + Date.now(), post_url: cleanUrl, created_at: new Date().toISOString() };
        localSuggestions.unshift(localItem);
        localStorage.setItem('itd_local_suggestions', JSON.stringify(localSuggestions));

        if (this.isConfigured) {
            try {
                await this.request('suggestions_posts', {
                    method: 'POST',
                    body: item
                });
            } catch (e) {
                console.warn(e);
            }
        }
        return true;
    }

    async getSuggestedPosts() {
        let list = [];
        if (this.isConfigured) {
            try {
                const data = await this.request('suggestions_posts?order=created_at.desc');
                if (Array.isArray(data)) {
                    list = data;
                }
            } catch (e) {
                console.warn(e);
            }
        }

        if (list.length === 0) {
            list = JSON.parse(localStorage.getItem('itd_local_suggestions') || '[]');
        }

        return list.map(item => {
            let rawText = item.post_text || '';
            let postUrl = item.post_url || '';
            const match = rawText.match(/🔗\s*(https?:\/\/[^\s]+)/) || rawText.match(/\[URL:\s*([^\]]+)\]/);
            if (match) {
                postUrl = match[1];
                rawText = rawText.replace(/🔗\s*https?:\/\/[^\s]+/, '').replace(/\[URL:\s*[^\]]+\]/, '').trim();
            }
            return {
                ...item,
                post_text: rawText,
                post_url: postUrl
            };
        });
    }

    async approveSuggestedPost(suggestion, correctAuthorId) {
        const postRecord = {
            id: 'post_' + Date.now(),
            correctAuthorId: correctAuthorId || suggestion.author_id,
            postText: suggestion.post_text || '',
            screenshot: suggestion.screenshot,
            hint: suggestion.post_url ? `Оригинал: ${suggestion.post_url}` : '',
            difficulty: 'normal',
            tags: suggestion.post_url ? ['#итд', '#оригинал'] : ['#итд'],
            createdAt: Date.now()
        };

        await this.savePost(postRecord);
        await window.quizDB.savePost(postRecord);

        if (this.isConfigured && suggestion.id && !String(suggestion.id).startsWith('sugg_')) {
            try {
                await this.request(`suggestions_posts?id=eq.${suggestion.id}`, {
                    method: 'DELETE'
                });
            } catch (e) {
                console.warn(e);
            }
        }

        const local = JSON.parse(localStorage.getItem('itd_local_suggestions') || '[]');
        const updated = local.filter(s => s.id !== suggestion.id);
        localStorage.setItem('itd_local_suggestions', JSON.stringify(updated));

        return postRecord;
    }

    async rejectSuggestedPost(suggestionId) {
        if (this.isConfigured && suggestionId && !String(suggestionId).startsWith('sugg_')) {
            try {
                await this.request(`suggestions_posts?id=eq.${suggestionId}`, {
                    method: 'DELETE'
                });
            } catch (e) {
                console.warn(e);
            }
        }

        const local = JSON.parse(localStorage.getItem('itd_local_suggestions') || '[]');
        const updated = local.filter(s => s.id !== suggestionId);
        localStorage.setItem('itd_local_suggestions', JSON.stringify(updated));
    }

    async submitAuthorSuggestion({ name, handle, bio, submittedBy }) {
        const item = {
            name: (name || '').trim(),
            handle: handle ? (handle.startsWith('@') ? handle.trim() : '@' + handle.trim()) : '@' + (name || '').trim().toLowerCase().replace(/[^a-z0-9_]/gi, ''),
            bio: (bio || '').trim(),
            submitted_by: submittedBy || 'Аноним',
            status: 'pending'
        };

        const local = JSON.parse(localStorage.getItem('itd_local_author_suggestions') || '[]');
        local.unshift({ ...item, id: 'sugg_auth_' + Date.now(), created_at: new Date().toISOString() });
        localStorage.setItem('itd_local_author_suggestions', JSON.stringify(local));

        if (this.isConfigured) {
            try {
                await this.request('suggestions_authors', {
                    method: 'POST',
                    body: item
                });
            } catch (e) {
                console.warn(e);
            }
        }
        return true;
    }

    async getSuggestedAuthors() {
        let list = [];
        if (this.isConfigured) {
            try {
                const data = await this.request('suggestions_authors?order=created_at.desc');
                if (Array.isArray(data)) {
                    list = data;
                }
            } catch (e) {
                console.warn(e);
            }
        }

        if (list.length === 0) {
            list = JSON.parse(localStorage.getItem('itd_local_author_suggestions') || '[]');
        }
        return list;
    }

    async approveSuggestedAuthor(suggestion) {
        const id = (suggestion.handle ? suggestion.handle.replace('@', '') : suggestion.name)
            .toLowerCase().replace(/[^a-z0-9а-яё_]/gi, '_') + '_' + Date.now();

        const colorPalettes = [
            'linear-gradient(135deg, #0288d1, #26c6da)',
            'linear-gradient(135deg, #7c3aed, #ec4899)',
            'linear-gradient(135deg, #ef4444, #f97316)',
            'linear-gradient(135deg, #10b981, #06b6d4)',
            'linear-gradient(135deg, #f59e0b, #ef4444)'
        ];
        const randomColor = colorPalettes[Math.floor(Math.random() * colorPalettes.length)];

        const authorRecord = {
            id,
            name: suggestion.name,
            handle: suggestion.handle ? (suggestion.handle.startsWith('@') ? suggestion.handle : '@' + suggestion.handle) : '@' + id,
            avatarColor: randomColor,
            avatarText: suggestion.name ? suggestion.name[0].toUpperCase() : '?',
            badge: 'Автор ИТД',
            bio: suggestion.bio || 'Популярный автор в ИТД',
            verified: true
        };

        await this.saveAuthor(authorRecord);
        await window.authorsManager.addAuthor(authorRecord);

        if (this.isConfigured && suggestion.id && !String(suggestion.id).startsWith('sugg_auth_')) {
            try {
                await this.request(`suggestions_authors?id=eq.${suggestion.id}`, {
                    method: 'DELETE'
                });
            } catch (e) {
                console.warn(e);
            }
        }

        const local = JSON.parse(localStorage.getItem('itd_local_author_suggestions') || '[]');
        const updated = local.filter(s => s.id !== suggestion.id);
        localStorage.setItem('itd_local_author_suggestions', JSON.stringify(updated));

        return authorRecord;
    }

    async rejectSuggestedAuthor(suggestionId) {
        if (this.isConfigured && suggestionId && !String(suggestionId).startsWith('sugg_auth_')) {
            try {
                await this.request(`suggestions_authors?id=eq.${suggestionId}`, {
                    method: 'DELETE'
                });
            } catch (e) {
                console.warn(e);
            }
        }

        const local = JSON.parse(localStorage.getItem('itd_local_author_suggestions') || '[]');
        const updated = local.filter(s => s.id !== suggestionId);
        localStorage.setItem('itd_local_author_suggestions', JSON.stringify(updated));
    }

    async getAdminStats() {
        const stats = {
            totalGames: 0,
            uniquePlayers: 0,
            topScore: 0,
            topPlayer: '—',
            avgAccuracy: 0,
            totalPosts: 0,
            totalAuthors: 0,
            pendingPosts: 0,
            pendingAuthors: 0
        };

        try {
            let leaderboardRows = [];
            if (this.isConfigured) {
                const lb = await this.request('leaderboard?select=nickname,score,accuracy');
                if (Array.isArray(lb)) leaderboardRows = lb;
            }
            if (leaderboardRows.length === 0) {
                leaderboardRows = JSON.parse(localStorage.getItem('itd_local_leaderboard') || '[]');
            }

            stats.totalGames = leaderboardRows.length;
            const uniqueNicknames = new Set(leaderboardRows.map(r => (r.nickname || '').trim()).filter(Boolean));
            stats.uniquePlayers = uniqueNicknames.size;

            let highest = 0;
            let leader = '—';
            let accuracySum = 0;
            leaderboardRows.forEach(r => {
                const s = Number(r.score) || 0;
                if (s > highest) {
                    highest = s;
                    leader = r.nickname || 'Игрок';
                }
                accuracySum += Number(r.accuracy) || 0;
            });
            stats.topScore = highest;
            stats.topPlayer = leader;
            stats.avgAccuracy = stats.totalGames > 0 ? Math.round(accuracySum / stats.totalGames) : 0;

            if (this.isConfigured) {
                const p = await this.request('posts?select=id');
                stats.totalPosts = Array.isArray(p) ? p.length : 0;

                const a = await this.request('authors?select=id');
                stats.totalAuthors = Array.isArray(a) ? a.length : 0;

                const sp = await this.request('suggestions_posts?select=id');
                stats.pendingPosts = Array.isArray(sp) ? sp.length : 0;

                const sa = await this.request('suggestions_authors?select=id');
                stats.pendingAuthors = Array.isArray(sa) ? sa.length : 0;
            } else {
                const p = await window.quizDB.getAllPosts();
                stats.totalPosts = p.length;
                stats.totalAuthors = window.authorsManager.getAll().length;
                const sp = JSON.parse(localStorage.getItem('itd_local_suggestions') || '[]');
                stats.pendingPosts = sp.length;
                const sa = JSON.parse(localStorage.getItem('itd_local_author_suggestions') || '[]');
                stats.pendingAuthors = sa.length;
            }
        } catch (e) {
            console.warn(e);
        }

        return stats;
    }

    async saveAuthor(author) {
        if (!this.isConfigured) return;
        try {
            await this.request('authors', {
                method: 'POST',
                prefer: 'resolution=merge-duplicates',
                body: {
                    id: author.id,
                    name: author.name,
                    handle: author.handle,
                    avatar_color: author.avatarColor,
                    avatar_text: author.avatarText,
                    badge: author.badge || null,
                    bio: author.bio || null,
                    verified: Boolean(author.verified)
                }
            });
        } catch (e) {
            console.warn(e);
        }
    }

    async deleteAuthor(id) {
        if (!this.isConfigured) return;
        try {
            await this.request(`authors?id=eq.${id}`, {
                method: 'DELETE'
            });
        } catch (e) {
            console.warn(e);
        }
    }

    async savePost(post) {
        if (!this.isConfigured) return;
        try {
            await this.request('posts', {
                method: 'POST',
                prefer: 'resolution=merge-duplicates',
                body: {
                    id: post.id,
                    correct_author_id: post.correctAuthorId,
                    post_text: post.postText || '',
                    screenshot: post.screenshot,
                    hint: post.hint || '',
                    difficulty: post.difficulty || 'normal',
                    tags: post.tags || [],
                    likes: post.likes || 0
                }
            });
        } catch (e) {
            console.warn(e);
        }
    }

    async deletePost(id) {
        if (!this.isConfigured) return;
        try {
            await this.request(`posts?id=eq.${id}`, {
                method: 'DELETE'
            });
        } catch (e) {
            console.warn(e);
        }
    }

    async fetchRemotePosts() {
        if (!this.isConfigured) return null;
        try {
            const data = await this.request('posts?select=*&order=created_at.desc');
            return data.map(p => ({
                id: p.id,
                correctAuthorId: p.correct_author_id,
                postText: p.post_text,
                screenshot: p.screenshot,
                hint: p.hint,
                difficulty: p.difficulty,
                tags: p.tags,
                likes: p.likes,
                createdAt: new Date(p.created_at).getTime()
            }));
        } catch (e) {
            console.warn(e);
            return null;
        }
    }

    async fetchRemoteAuthors() {
        if (!this.isConfigured) return null;
        try {
            const data = await this.request('authors?select=*');
            return data.map(a => ({
                id: a.id,
                name: a.name,
                handle: a.handle,
                avatarColor: a.avatar_color,
                avatarText: a.avatar_text,
                badge: a.badge,
                bio: a.bio,
                verified: a.verified
            }));
        } catch (e) {
            console.warn(e);
            return null;
        }
    }
}

window.supabaseService = new SupabaseService();
