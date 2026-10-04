
const DEFAULT_AUTHORS = [
    {
        id: "nuksta",
        name: "нукста",
        handle: "@nuksta",
        avatarColor: "linear-gradient(135deg, #0288d1, #26c6da)",
        avatarText: "Н",
        badge: "Основатель",
        bio: "Главный архитектор ИТД. Пишет про обновления, философию минимализма и ночной продакшн.",
        verified: true,
        style: "Технические анонсы, краткие мысли, манифесты"
    },
    {
        id: "shlyapa",
        name: "Шляпа Боярского",
        handle: "@shlyapa",
        avatarColor: "linear-gradient(135deg, #7c3aed, #ec4899)",
        avatarText: "🎩",
        badge: "Топ-автор",
        bio: "Тысяча чертей! Искусство щитпостинга высшей пробы и саркастичные наблюдения о жизни.",
        verified: true,
        style: "Острый сарказм, абсурдный юмор, щитпост"
    },
    {
        id: "senior_pomidor",
        name: "Сениор Помидор 🍅",
        handle: "@senior_pomidor",
        avatarColor: "linear-gradient(135deg, #ef4444, #f97316)",
        avatarText: "🍅",
        badge: "Dev",
        bio: "10 лет в IT, 8 выгораний, 0 открытых пуллреквестов в пятницу вечером.",
        verified: false,
        style: "Боли разработчиков, легаси, кринж с собеседований"
    },
    {
        id: "cyber_kotik",
        name: "Киберкотик 🐾",
        handle: "@cyber_kotik",
        avatarColor: "linear-gradient(135deg, #10b981, #06b6d4)",
        avatarText: "🐱",
        badge: "Инсайт",
        bio: "Спит на клавиатуре, нажимает случайные клавиши и пишет лучший код в компании.",
        verified: true,
        style: "Милые посты, ночные мысли, IT-жиза"
    },
    {
        id: "itd_philosopher",
        name: "Ночной Философ",
        handle: "@philosopher",
        avatarColor: "linear-gradient(135deg, #6366f1, #a855f7)",
        avatarText: "🌌",
        badge: "Лонгриды",
        bio: "Почему мы скроллим ленту в 3 часа ночи вместо сна? Глубокие рассуждения под шум дождя.",
        verified: false,
        style: "Меланхолия, ночные размышления, длинные цитаты"
    },
    {
        id: "doshirak_ceo",
        name: "CEO Доширачной",
        handle: "@doshik_king",
        avatarColor: "linear-gradient(135deg, #f59e0b, #ef4444)",
        avatarText: "🍜",
        badge: "Стартапы",
        bio: "Привлек 0$ инвестиций, но уже переписал бизнес-модель на лапшу с говядиной.",
        verified: false,
        style: "Ирония над стартапами, венчуром и криптой"
    },
    {
        id: "devops_vova",
        name: "Девопс Вова в огне",
        handle: "@vova_prod",
        avatarColor: "linear-gradient(135deg, #dc2626, #b91c1c)",
        avatarText: "🔥",
        badge: "Prod Down",
        bio: "Кубернетес упал, бэкапов нет, зато пятничный деплой прошел по расписанию.",
        verified: true,
        style: "Паника в проде, докер, логи и мониторинг"
    },
    {
        id: "ai_barmaley",
        name: "Промпт-Инженер 3000",
        handle: "@gpt_overlord",
        avatarColor: "linear-gradient(135deg, #3b82f6, #8b5cf6)",
        avatarText: "🤖",
        badge: "AI Hype",
        bio: "Заменил всю команду одной нейросетью, теперь нейросеть просит отпуск за свой счет.",
        verified: false,
        style: "Нейросети, будущее, промпты и галлюцинации LLM"
    }
];

class AuthorsManager {
    constructor() {
        this.authors = [];
    }

    async load() {
        try {
            const saved = await window.quizDB.getAuthors();
            if (saved && saved.length > 0) {
                this.authors = saved;
            } else {
                this.authors = [...DEFAULT_AUTHORS];
                await window.quizDB.saveAuthors(this.authors);
            }
        } catch (e) {
            console.warn('Failed to load authors from DB, using defaults', e);
            this.authors = [...DEFAULT_AUTHORS];
        }
        return this.authors;
    }

    getAll() {
        return this.authors;
    }

    getById(id) {
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
                'linear-gradient(135deg, #6366f1, #d946ef)'
            ];
            author.avatarColor = colors[Math.floor(Math.random() * colors.length)];
        }
        if (!author.avatarText) {
            author.avatarText = (author.name || 'А')[0].toUpperCase();
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
                id: `fallback_author_${fallbackIndex}`,
                name: `Автор ИТД #${fallbackIndex}`,
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
