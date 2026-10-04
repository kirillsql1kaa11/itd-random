// Robust IndexedDB Storage Manager for ITD Quiz
// Allows storing high-res screenshot blobs, questions, authors, and player statistics without quota limits
class QuizDB {
    constructor() {
        this.dbName = 'ITD_Quiz_DB';
        this.version = 1;
        this.db = null;
    }

    async init() {
        return new Promise((resolve, reject) => {
            const req = indexedDB.open(this.dbName, this.version);

            req.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains('posts')) {
                    db.createObjectStore('posts', { keyPath: 'id' });
                }
                if (!db.objectStoreNames.contains('authors')) {
                    db.createObjectStore('authors', { keyPath: 'id' });
                }
                if (!db.objectStoreNames.contains('settings')) {
                    db.createObjectStore('settings', { keyPath: 'key' });
                }
            };

            req.onsuccess = (e) => {
                this.db = e.target.result;
                resolve(this);
            };

            req.onerror = (e) => {
                console.error('IndexedDB open error:', e);
                reject(e);
            };
        });
    }

    async getAllPosts() {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction('posts', 'readonly');
            const store = tx.objectStore('posts');
            const req = store.getAll();
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = () => reject(req.error);
        });
    }

    async getPost(id) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction('posts', 'readonly');
            const store = tx.objectStore('posts');
            const req = store.get(id);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }

    async savePost(post) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction('posts', 'readwrite');
            const store = tx.objectStore('posts');
            const req = store.put(post);
            req.onsuccess = () => resolve(post);
            req.onerror = () => reject(req.error);
        });
    }

    async deletePost(id) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction('posts', 'readwrite');
            const store = tx.objectStore('posts');
            const req = store.delete(id);
            req.onsuccess = () => resolve(true);
            req.onerror = () => reject(req.error);
        });
    }

    async getAuthors() {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction('authors', 'readonly');
            const store = tx.objectStore('authors');
            const req = store.getAll();
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = () => reject(req.error);
        });
    }

    async saveAuthors(authorsList) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction('authors', 'readwrite');
            const store = tx.objectStore('authors');
            store.clear();
            authorsList.forEach(author => store.put(author));
            tx.oncomplete = () => resolve(true);
            tx.onerror = () => reject(tx.error);
        });
    }

    async getSetting(key, defaultVal = null) {
        return new Promise((resolve) => {
            const tx = this.db.transaction('settings', 'readonly');
            const store = tx.objectStore('settings');
            const req = store.get(key);
            req.onsuccess = () => {
                if (req.result && req.result.value !== undefined) {
                    resolve(req.result.value);
                } else {
                    resolve(defaultVal);
                }
            };
            req.onerror = () => resolve(defaultVal);
        });
    }

    async setSetting(key, value) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction('settings', 'readwrite');
            const store = tx.objectStore('settings');
            const req = store.put({ key, value });
            req.onsuccess = () => resolve(true);
            req.onerror = () => reject(req.error);
        });
    }

    // Export entire database as JSON string
    async exportBackup() {
        const posts = await this.getAllPosts();
        const authors = await this.getAuthors();
        return JSON.stringify({
            app: 'ITD_Author_Guesser',
            version: 1,
            exportedAt: new Date().toISOString(),
            posts,
            authors
        }, null, 2);
    }

    // Import database from JSON string
    async importBackup(jsonString) {
        const data = JSON.parse(jsonString);
        if (!data.posts && !data.authors) {
            throw new Error('Некорректный формат файла бэкапа');
        }

        if (Array.isArray(data.authors) && data.authors.length > 0) {
            await this.saveAuthors(data.authors);
        }

        if (Array.isArray(data.posts) && data.posts.length > 0) {
            const tx = this.db.transaction('posts', 'readwrite');
            const store = tx.objectStore('posts');
            for (const post of data.posts) {
                store.put(post);
            }
            await new Promise((res, rej) => {
                tx.oncomplete = res;
                tx.onerror = rej;
            });
        }
        return true;
    }
}

window.quizDB = new QuizDB();
