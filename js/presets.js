function createITDPostScreenshotDataUrl({ text, date, likes, reposts, comments, tags = [] }) {
    const width = 640;
    const lines = [];
    const words = (text || '').split(' ');
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

        <rect width="${width}" height="${height}" rx="20" fill="url(#bgGrad)" stroke="rgba(255, 255, 255, 0.08)" stroke-width="1.2" filter="url(#glow)"/>

        <g transform="translate(32, 28)">
            <circle cx="24" cy="24" r="24" fill="#22222a" stroke="rgba(255, 255, 255, 0.1)" stroke-width="1"/>
            <text x="24" y="32" fill="#888899" font-family="'Unbounded', sans-serif" font-size="18" font-weight="700" text-anchor="middle">?</text>

            <g transform="translate(62, 10)">
                <rect x="0" y="0" width="140" height="16" rx="8" fill="url(#maskGrad)"/>
                <rect x="150" y="-1" width="70" height="18" rx="9" fill="rgba(0, 128, 255, 0.15)"/>
                <text x="185" y="12" fill="#0080ff" font-family="'Inter', sans-serif" font-size="11" font-weight="600" text-anchor="middle">ИТД АВТОР</text>

                <rect x="0" y="22" width="80" height="11" rx="5" fill="#2a2a32"/>
                <circle cx="95" cy="27" r="2" fill="#555566"/>
                <text x="105" y="31" fill="#7a7a88" font-family="'Inter', sans-serif" font-size="12">${escapeXml(date || '')}</text>
            </g>

            <g transform="translate(520, 8)" opacity="0.45">
                <text x="0" y="16" fill="#ffffff" font-family="'Unbounded', sans-serif" font-size="13" font-weight="800" letter-spacing="1">ИТД</text>
            </g>
        </g>

        <line x1="32" y1="94" x2="${width - 32}" y2="94" stroke="rgba(255, 255, 255, 0.05)" stroke-width="1"/>

        ${textSvgLines}
        ${tagsSvg}

        <g transform="translate(32, ${footerY})">
            <g transform="translate(0, 0)">
                <path d="M2 5a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H7l-4 3V5z" fill="none" stroke="#7a7a8c" stroke-width="1.6"/>
                <text x="26" y="14" fill="#7a7a8c" font-family="'Inter', sans-serif" font-size="13" font-weight="500">${comments || 0}</text>
            </g>
            <g transform="translate(130, 0)">
                <path d="M3 8h11a3 3 0 0 1 3 3v1M14 5l3 3-3 3M17 14H6a3 3 0 0 1-3-3v-1M6 17l-3-3 3-3" fill="none" stroke="#7a7a8c" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
                <text x="26" y="14" fill="#7a7a8c" font-family="'Inter', sans-serif" font-size="13" font-weight="500">${reposts || 0}</text>
            </g>
            <g transform="translate(260, 0)">
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" fill="none" stroke="#f91880" stroke-width="1.6"/>
                <text x="28" y="14" fill="#f91880" font-family="'Inter', sans-serif" font-size="13" font-weight="600">${likes || 0}</text>
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

const PRESET_POSTS = [];

class PresetsManager {
    static async initPresetsIfEmpty() {
        return;
    }
}

window.PresetsManager = PresetsManager;
window.createITDPostScreenshotDataUrl = createITDPostScreenshotDataUrl;
