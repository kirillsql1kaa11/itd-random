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

    async getLeaderboard(limit = 20) {
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
        localStorage.setItem('itd_local_leaderboard', JSON.stringify(local.slice(-50)));

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

    async submitPostSuggestion({ authorId, authorName, screenshot, postText, submittedBy }) {
        const item = {
            author_id: authorId || null,
            author_name: authorName || 'Не указан',
            screenshot: screenshot,
            post_text: postText || '',
            submitted_by: submittedBy || 'Аноним',
            status: 'pending'
        };

        const localSuggestions = JSON.parse(localStorage.getItem('itd_local_suggestions') || '[]');
        localSuggestions.unshift({ ...item, id: 'sugg_' + Date.now(), created_at: new Date().toISOString() });
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
        if (this.isConfigured) {
            try {
                const data = await this.request('suggestions_posts?status=eq.pending&order=created_at.desc');
                if (Array.isArray(data)) return data;
            } catch (e) {
                console.warn(e);
            }
        }
        const local = JSON.parse(localStorage.getItem('itd_local_suggestions') || '[]');
        return local.filter(s => s.status === 'pending');
    }

    async approveSuggestedPost(suggestion, correctAuthorId) {
        const postRecord = {
            id: 'post_' + Date.now(),
            correctAuthorId: correctAuthorId || suggestion.author_id,
            postText: suggestion.post_text || '',
            screenshot: suggestion.screenshot,
            hint: '',
            difficulty: 'normal',
            tags: [],
            createdAt: Date.now()
        };

        await this.savePost(postRecord);
        await window.quizDB.savePost(postRecord);

        if (this.isConfigured && suggestion.id && !String(suggestion.id).startsWith('sugg_')) {
            try {
                await this.request(`suggestions_posts?id=eq.${suggestion.id}`, {
                    method: 'PATCH',
                    body: { status: 'approved' }
                });
            } catch (e) {
                console.warn(e);
            }
        }

        const local = JSON.parse(localStorage.getItem('itd_local_suggestions') || '[]');
        const updated = local.map(s => s.id === suggestion.id ? { ...s, status: 'approved' } : s);
        localStorage.setItem('itd_local_suggestions', JSON.stringify(updated));

        return postRecord;
    }

    async rejectSuggestedPost(suggestionId) {
        if (this.isConfigured && suggestionId && !String(suggestionId).startsWith('sugg_')) {
            try {
                await this.request(`suggestions_posts?id=eq.${suggestionId}`, {
                    method: 'PATCH',
                    body: { status: 'rejected' }
                });
            } catch (e) {
                console.warn(e);
            }
        }

        const local = JSON.parse(localStorage.getItem('itd_local_suggestions') || '[]');
        const updated = local.map(s => s.id === suggestionId ? { ...s, status: 'rejected' } : s);
        localStorage.setItem('itd_local_suggestions', JSON.stringify(updated));
    }

    async submitAuthorSuggestion({ name, handle, bio, submittedBy }) {
        const item = {
            name,
            handle: handle.startsWith('@') ? handle : '@' + handle,
            bio: bio || '',
            submitted_by: submittedBy || 'Аноним',
            status: 'pending'
        };

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
