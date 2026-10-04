// Preset questions and ITD post screenshot synthesizer
// Creates crisp, authentic ITD post screenshots for initial gameplay

function createITDPostScreenshotDataUrl({ text, date, likes, reposts, comments, tags = [] }) {
    // Generate SVG mimicking exact ITD post card with masked/censored author
    const width = 640;
    // Calculate estimated height based on text length
    const lines = [];
    const words = text.split(' ');
    let currentLine = '';
    for (const w of words) {
        if ((currentLine + ' ' + w).length > 44) {
            lines.push(currentLine);
            currentLine = w;
        } else {
            currentLine = currentLine ? currentLine + ' ' + w : w;
        }
    }
    if (currentLine) lines.push(currentLine);

    const textSvgLines = lines.map((l, idx) => 
        `<text x="32" y="${140 + idx * 26}" fill="#f5f5f7" font-family="'Inter', -apple-system, BlinkMacSystemFont, sans-serif" font-size="16" font-weight="400">${escapeXml(l)}</text>`
    ).join('\n');

    const tagsY = 150 + lines.length * 26;
    const tagsSvg = tags.map((t, idx) => 
        `<text x="${32 + idx * 90}" y="${tagsY}" fill="#0080ff" font-family="'Inter', sans-serif" font-size="13" font-weight="500">${escapeXml(t)}</text>`
    ).join('\n');

    const footerY = tagsY + (tags.length ? 36 : 24);
    const height = footerY + 54;

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
        <defs>
            <linearGradient id="bgGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stop-color="#141416" />
                <stop offset="100%" stop-color="#1a1a1f" />
            </linearGradient>
            <linearGradient id="maskGrad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stop-color="#2a2a32" />
                <stop offset="50%" stop-color="#3d3d4a" />
                <stop offset="100%" stop-color="#2a2a32" />
            </linearGradient>
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="8" stdDeviation="16" flood-color="#000000" flood-opacity="0.6"/>
            </filter>
        </defs>

        <!-- Main Card Container -->
        <rect width="${width}" height="${height}" rx="20" fill="url(#bgGrad)" stroke="rgba(255, 255, 255, 0.08)" stroke-width="1.2" filter="url(#glow)"/>

        <!-- Header: Censored Avatar -->
        <g transform="translate(32, 28)">
            <!-- Outer mystery circle -->
            <circle cx="24" cy="24" r="24" fill="#22222a" stroke="rgba(255, 255, 255, 0.1)" stroke-width="1"/>
            <text x="24" y="32" fill="#888899" font-family="'Unbounded', sans-serif" font-size="18" font-weight="700" text-anchor="middle">?</text>

            <!-- Masked Author Name & Handle (Secret!) -->
            <g transform="translate(62, 10)">
                <!-- Mystery bar for nickname -->
                <rect x="0" y="0" width="140" height="16" rx="8" fill="url(#maskGrad)"/>
                <!-- Clue Badge -->
                <rect x="150" y="-1" width="70" height="18" rx="9" fill="rgba(0, 128, 255, 0.15)"/>
                <text x="185" y="12" fill="#0080ff" font-family="'Inter', sans-serif" font-size="11" font-weight="600" text-anchor="middle">ИТД АВТОР</text>

                <!-- Mystery bar for handle & timestamp -->
                <rect x="0" y="22" width="80" height="11" rx="5" fill="#2a2a32"/>
                <circle cx="95" cy="27" r="2" fill="#555566"/>
                <text x="105" y="31" fill="#7a7a88" font-family="'Inter', sans-serif" font-size="12">${escapeXml(date)}</text>
            </g>

            <!-- Mini ITD Logo watermark -->
            <g transform="translate(520, 8)" opacity="0.45">
                <text x="0" y="16" fill="#ffffff" font-family="'Unbounded', sans-serif" font-size="13" font-weight="800" letter-spacing="1">ИТД</text>
            </g>
        </g>

        <!-- Divider line -->
        <line x1="32" y1="94" x2="${width - 32}" y2="94" stroke="rgba(255, 255, 255, 0.05)" stroke-width="1"/>

        <!-- Post Content -->
        ${textSvgLines}

        <!-- Tags -->
        ${tagsSvg}

        <!-- Post Footer Stats (Comments, Reposts, Likes) -->
        <g transform="translate(32, ${footerY})">
            <!-- Comments icon + text -->
            <g transform="translate(0, 0)">
                <path d="M2 5a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H7l-4 3V5z" fill="none" stroke="#7a7a8c" stroke-width="1.6"/>
                <text x="26" y="14" fill="#7a7a8c" font-family="'Inter', sans-serif" font-size="13" font-weight="500">${comments}</text>
            </g>

            <!-- Reposts icon + text -->
            <g transform="translate(130, 0)">
                <path d="M3 8h11a3 3 0 0 1 3 3v1M14 5l3 3-3 3M17 14H6a3 3 0 0 1-3-3v-1M6 17l-3-3 3-3" fill="none" stroke="#7a7a8c" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
                <text x="26" y="14" fill="#7a7a8c" font-family="'Inter', sans-serif" font-size="13" font-weight="500">${reposts}</text>
            </g>

            <!-- Likes icon + text -->
            <g transform="translate(260, 0)">
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" fill="none" stroke="#f91880" stroke-width="1.6"/>
                <text x="28" y="14" fill="#f91880" font-family="'Inter', sans-serif" font-size="13" font-weight="600">${likes}</text>
            </g>
        </g>
    </svg>`;

    return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}

function escapeXml(unsafe) {
    return String(unsafe).replace(/[<>&'"]/g, c => {
        switch (c) {
            case '<': return '&lt;';
            case '>': return '&gt;';
            case '&': return '&amp;';
            case '\'': return '&apos;';
            case '"': return '&quot;';
        }
    });
}

const PRESET_POSTS = [
    {
        id: "post_1",
        correctAuthorId: "nuksta",
        postText: "Обновили ядро ленты. Никаких алгоритмических пузырей и рекомендаций из тиктока: только хронологический порядок и чистый текст. Меньше шума, больше мысли.",
        postDate: "сегодня в 02:40",
        likes: 342,
        reposts: 58,
        comments: 89,
        tags: ["#обновление", "#итд", "#минимализм"],
        hint: "Главный архитектор ИТД, радеет за чистый минимализм и текстовый формат.",
        difficulty: "easy"
    },
    {
        id: "post_2",
        correctAuthorId: "shlyapa",
        postText: "Если вы думаете, что ваша жизнь сложная — вспомните, что кто-то прямо сейчас пытается объяснить клиенту, почему логотип нельзя сделать «чуть более дерзким и одновременно круглым». Тысяча чертей.",
        postDate: "вчера в 19:15",
        likes: 512,
        reposts: 124,
        comments: 63,
        tags: ["#дизайн", "#боль", "#щитпост"],
        hint: "Любит колкие фразочки вроде «тысяча чертей» и высмеивать абсурдные рабочие моменты.",
        difficulty: "easy"
    },
    {
        id: "post_3",
        correctAuthorId: "senior_pomidor",
        postText: "Джуниор спросил меня, почему мы до сих пор поддерживаем этот модуль 2017 года. Я посмотрел ему в глаза и прошептал: «Потому что когда я пытаюсь удалить хотя бы один коммент, отваливается биллинг».",
        postDate: "сегодня в 11:20",
        likes: 890,
        reposts: 215,
        comments: 142,
        tags: ["#легаси", "#разработка", "#жиза"],
        hint: "Опытный разработчик с тонной выгораний и ужаса перед древним кодом компании.",
        difficulty: "easy"
    },
    {
        id: "post_4",
        correctAuthorId: "cyber_kotik",
        postText: "Лег на клавиатуру, случайно отправил в прод строку `asdfghjkl;;;` — тесты прошли быстрее обычного, нагрузка на базу упала на 40%. Кажется, я заслужил двойную порцию паштета.",
        postDate: "сегодня в 15:44",
        likes: 620,
        reposts: 88,
        comments: 45,
        tags: ["#лапки", "#код", "#прод"],
        hint: "Пишет от лица пушистого программиста, требует лакомства за успешные релизы.",
        difficulty: "normal"
    },
    {
        id: "post_5",
        correctAuthorId: "itd_philosopher",
        postText: "Странно осознавать, что миллионы людей смотрят в темные прямоугольники экранов в надежде найти там подтверждение собственного существования. Тишина за окном реальнее любого уведомления.",
        postDate: "3 ч. назад",
        likes: 278,
        reposts: 41,
        comments: 72,
        tags: ["#ночь", "#мысли", "#тишина"],
        hint: "Глубокие меланхоличные размышления о смысле жизни, экранах и ночной тишине.",
        difficulty: "normal"
    },
    {
        id: "post_6",
        correctAuthorId: "doshirak_ceo",
        postText: "Питчил наш стартап венчурным фондам. Предложил заменить кофе-поинты в офисе на автоматизированные станции заваривания острой говяжьей лапши. Сказали, что у нас слишком высокий ROI.",
        postDate: "вчера в 14:02",
        likes: 430,
        reposts: 76,
        comments: 51,
        tags: ["#стартап", "#инвестиции", "#дошик"],
        hint: "Иронизирует над стартап-культурой, связывая любой бизнес-план с лапшой быстрого приготовления.",
        difficulty: "normal"
    },
    {
        id: "post_7",
        correctAuthorId: "devops_vova",
        postText: "17:59 пятницы: «Ребята, тут минорный хотфикс, накатим быстренько перед выходными». 23:45: Я сижу в зуме с семью тимлидами, мы поем колыбельные серверу баз данных.",
        postDate: "сегодня в 00:15",
        likes: 1042,
        reposts: 310,
        comments: 188,
        tags: ["#деплой", "#пятница", "#девопс"],
        hint: "Его посты всегда пахнут гарью с упавшего сервера и ночными звонками в пятницу.",
        difficulty: "easy"
    },
    {
        id: "post_8",
        correctAuthorId: "ai_barmaley",
        postText: "Попросил нейросеть оптимизировать мой распорядок дня. Она удалила из календаря все митинги, поставила 14 часов сна и заказала пиццу на мой адрес. Скайнет уже победил, и мне это нравится.",
        postDate: "вчера в 21:30",
        likes: 715,
        reposts: 153,
        comments: 94,
        tags: ["#ии", "#промпты", "#будущее"],
        hint: "Постоянно экспериментирует с нейросетями и шутит про неизбежное восстание машин.",
        difficulty: "normal"
    }
];

class PresetsManager {
    static async initPresetsIfEmpty() {
        const existing = await window.quizDB.getAllPosts();
        if (!existing || existing.length === 0) {
            console.log('Seeding initial preset ITD posts...');
            for (const item of PRESET_POSTS) {
                const screenshotUrl = createITDPostScreenshotDataUrl({
                    text: item.postText,
                    date: item.postDate,
                    likes: item.likes,
                    reposts: item.reposts,
                    comments: item.comments,
                    tags: item.tags
                });

                const postRecord = {
                    id: item.id,
                    correctAuthorId: item.correctAuthorId,
                    postText: item.postText,
                    screenshot: screenshotUrl, // Valid image data URL
                    hint: item.hint,
                    difficulty: item.difficulty,
                    tags: item.tags,
                    likes: item.likes,
                    createdAt: Date.now()
                };

                await window.quizDB.savePost(postRecord);
            }
        }
    }
}

window.PresetsManager = PresetsManager;
window.createITDPostScreenshotDataUrl = createITDPostScreenshotDataUrl;
