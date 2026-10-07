const DEFAULT_AUTHORS = [];

class AuthorsManager {
    constructor() {
        this.authors = [];
    }

    async load() {
        if (window.supabaseService?.isConfigured) {
            try {
                const remote = await window.supabaseService.fetchRemoteAuthors();
                if (Array.isArray(remote)) {
                    this.authors = remote;
                    await window.quizDB.saveAuthors(this.authors);
                    return this.authors;
                }
            } catch (e) {
                console.warn(e);
            }
        }

        try {
            const saved = await window.quizDB.getAuthors();
            this.authors = Array.isArray(saved) ? saved : [];
        } catch (e) {
            console.warn(e);
            this.authors = [];
        }
        return this.authors;
    }

    getAll() {
        return this.authors;
    }

    getById(id) {
        if (!id) return null;
        return this.authors.find(a => a.id === id || a.handle === id || a.name.toLowerCase() === id.toLowerCase());
    }

    async addAuthor(author) {
        if (!author.id) {
            author.id = 'author_' + Date.now();
        }
        if (!author.avatarColor) {
            const colors = [
                'linear-gradient(135deg, #3b82f6, #06b6d4)',
                'linear-gradient(135deg, #ec4899, #8b5cf6)',
                'linear-gradient(135deg, #f59e0b, #ef4444)',
                'linear-gradient(135deg, #10b981, #3b82f6)',
                'linear-gradient(135deg, #6366f1, #d946ef)',
                'linear-gradient(135deg, #0288d1, #26c6da)',
                'linear-gradient(135deg, #7c3aed, #ec4899)',
                'linear-gradient(135deg, #ef4444, #f97316)',
                'linear-gradient(135deg, #10b981, #06b6d4)',
                'linear-gradient(135deg, #ec4899, #f43f5e)',
                'linear-gradient(135deg, #84cc16, #22c55e)',
                'linear-gradient(135deg, #14b8a6, #3b82f6)',
                'linear-gradient(135deg, #f97316, #facc15)',
                'linear-gradient(135deg, #a855f7, #6366f1)',
                'linear-gradient(135deg, #f43f5e, #fb923c)',
                'linear-gradient(135deg, #0ea5e9, #6366f1)'
            ];
            author.avatarColor = colors[Math.floor(Math.random() * colors.length)];
        }
        if (!author.avatarText) {
            author.avatarText = (author.name || 'А')[0].toUpperCase();
        }

        if (window.supabaseService?.isConfigured) {
            try {
                await window.supabaseService.saveAuthor(author);
            } catch (e) {
                console.warn(e);
            }
        }

        const existingIndex = this.authors.findIndex(a => a.id === author.id);
        if (existingIndex >= 0) {
            this.authors[existingIndex] = author;
        } else {
            this.authors.push(author);
        }
        await window.quizDB.saveAuthors(this.authors);
        return author;
    }

    async deleteAuthor(id) {
        if (window.supabaseService?.isConfigured) {
            try {
                await window.supabaseService.deleteAuthor(id);
            } catch (e) {
                console.warn(e);
            }
        }
        this.authors = this.authors.filter(a => a.id !== id);
        await window.quizDB.saveAuthors(this.authors);
    }

    search(query) {
        if (!query || !query.trim()) return this.authors;
        const q = query.trim().toLowerCase();
        return this.authors.filter(a => 
            a.name.toLowerCase().includes(q) || 
            (a.handle && a.handle.toLowerCase().includes(q)) ||
            (a.bio && a.bio.toLowerCase().includes(q)) ||
            (a.style && a.style.toLowerCase().includes(q))
        );
    }

    getRandomDistractors(correctAuthorId, count = 3) {
        const pool = this.authors.filter(a => a.id !== correctAuthorId);
        const shuffled = [...pool].sort(() => Math.random() - 0.5);
        const selected = shuffled.slice(0, count);

        let fallbackIndex = 1;
        while (selected.length < count) {
            selected.push({
                id: `fallback_${fallbackIndex}`,
                name: `Автор #${fallbackIndex}`,
                handle: `@author_${fallbackIndex}`,
                avatarColor: 'linear-gradient(135deg, #374151, #1f2937)',
                avatarText: `${fallbackIndex}`,
                bio: 'Пользователь ИТД'
            });
            fallbackIndex++;
        }
        return selected;
    }
}

window.authorsManager = new AuthorsManager();
