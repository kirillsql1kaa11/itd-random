// Supabase Cloud Database Client & Synchronization Manager
// Integrates with Supabase for shared authors, posts, leaderboard and community submissions
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
            console.warn('Supabase connection test failed:', e);
            return false;
        }
    }

    // --- LEADERBOARD ---
    async getLeaderboard(limit = 20) {
        if (!this.isConfigured) {
            // Local fallback
            const local = JSON.parse(localStorage.getItem('itd_local_leaderboard') || '[]');
            return local.sort((a, b) => b.score - a.score).slice(0, limit);
        }

        try {
            const data = await this.request(`leaderboard?select=*&order=score.desc&limit=${limit}`);
            return data;
        } catch (e) {
            console.warn('Failed to fetch remote leaderboard, using local fallback:', e);
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

        // Always save locally
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
                console.warn('Could not post score to Supabase:', e);
            }
        }
        return record;
    }

    // --- SUGGESTIONS ---
    async submitPostSuggestion({ authorId, authorName, screenshot, postText, submittedBy }) {
        const item = {
            author_id: authorId || null,
            author_name: authorName || 'Не указан',
            screenshot: screenshot,
            post_text: postText || '',
            submitted_by: submittedBy || 'Аноним',
            status: 'pending'
        };

        // Save locally to IndexedDB as well
        await window.quizDB.saveSetting('pending_suggestion_' + Date.now(), item);

        if (this.isConfigured) {
            try {
                await this.request('suggestions_posts', {
                    method: 'POST',
                    body: item
                });
            } catch (e) {
                console.warn('Could not send suggestion to Supabase:', e);
            }
        }
        return true;
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
                console.warn('Could not send author suggestion to Supabase:', e);
            }
        }
        return true;
    }

    // --- POSTS & AUTHORS SYNC ---
    async fetchRemotePosts() {
        if (!this.isConfigured) return null;
        try {
            const data = await this.request('posts?select=*');
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
            console.warn('Error fetching remote posts:', e);
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
            console.warn('Error fetching remote authors:', e);
            return null;
        }
    }
}

window.supabaseService = new SupabaseService();
