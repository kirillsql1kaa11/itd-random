window.ShareCard = {
    WIDTH: 1200,
    HEIGHT: 630,
    ITD_URL: 'https://xn--d1ah4a.com',
    cachedDataUrl: null,
    cachedBlob: null,
    cachedFile: null,
    cachedKey: null,

    modeLabel(mode) {
        if (mode === 'survival') return 'Выживание';
        if (mode === 'practice') return 'Свободный';
        return 'Блиц 10';
    },

    roundRect(ctx, x, y, w, h, r) {
        if (typeof ctx.roundRect === 'function') {
            ctx.beginPath();
            ctx.roundRect(x, y, w, h, r);
            ctx.closePath();
            return;
        }
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r);
        ctx.closePath();
    },

    fitText(ctx, text, maxWidth) {
        if (ctx.measureText(text).width <= maxWidth) return text;
        let out = String(text);
        while (out.length > 1 && ctx.measureText(out + '…').width > maxWidth) {
            out = out.slice(0, -1);
        }
        return out + '…';
    },

    async generate(data) {
        if (!data) return null;
        const key = JSON.stringify(data);
        if (this.cachedKey === key && this.cachedDataUrl && this.cachedBlob) {
            return {
                dataUrl: this.cachedDataUrl,
                blob: this.cachedBlob,
                file: this.cachedFile
            };
        }

        if (document.fonts && document.fonts.ready) {
            try {
                await Promise.race([
                    document.fonts.ready,
                    new Promise(r => setTimeout(r, 150))
                ]);
            } catch (_) {}
        }

        const W = this.WIDTH;
        const H = this.HEIGHT;
        const canvas = document.createElement('canvas');
        canvas.width = W;
        canvas.height = H;
        const ctx = canvas.getContext('2d');

        const bg = ctx.createLinearGradient(0, 0, W, H);
        bg.addColorStop(0, '#07080d');
        bg.addColorStop(1, '#10121c');
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, W, H);

        const glowBlue = ctx.createRadialGradient(W * 0.1, H * 0.05, 0, W * 0.1, H * 0.05, 520);
        glowBlue.addColorStop(0, 'rgba(0, 128, 255, 0.35)');
        glowBlue.addColorStop(1, 'rgba(0, 128, 255, 0)');
        ctx.fillStyle = glowBlue;
        ctx.fillRect(0, 0, W, H);

        const glowPink = ctx.createRadialGradient(W * 0.95, H * 0.95, 0, W * 0.95, H * 0.95, 560);
        glowPink.addColorStop(0, 'rgba(249, 24, 128, 0.30)');
        glowPink.addColorStop(1, 'rgba(249, 24, 128, 0)');
        ctx.fillStyle = glowPink;
        ctx.fillRect(0, 0, W, H);

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.10)';
        ctx.lineWidth = 2;
        this.roundRect(ctx, 24, 24, W - 48, H - 48, 36);
        ctx.stroke();

        ctx.textBaseline = 'alphabetic';
        ctx.textAlign = 'left';

        const pillText = 'ИТД · КТО АВТОР?';
        ctx.font = '700 22px Inter, system-ui, sans-serif';
        const pillW = ctx.measureText(pillText).width + 56;
        ctx.fillStyle = 'rgba(0, 128, 255, 0.14)';
        this.roundRect(ctx, 72, 68, pillW, 44, 22);
        ctx.fill();
        ctx.strokeStyle = 'rgba(0, 128, 255, 0.55)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.fillStyle = '#4da3ff';
        ctx.beginPath();
        ctx.arc(94, 90, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillText(pillText, 112, 98);

        ctx.textAlign = 'right';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
        ctx.font = '600 24px Inter, system-ui, sans-serif';
        ctx.fillText(this.modeLabel(data.mode), W - 72, 98);

        ctx.textAlign = 'left';
        ctx.fillStyle = '#ffffff';
        ctx.font = '800 56px Unbounded, Inter, system-ui, sans-serif';
        ctx.fillText(this.fitText(ctx, data.nickname || 'Игрок', W - 144), 72, 200);

        const rankGrad = ctx.createLinearGradient(72, 0, 520, 0);
        rankGrad.addColorStop(0, '#4da3ff');
        rankGrad.addColorStop(1, '#f91880');
        ctx.fillStyle = rankGrad;
        ctx.font = '700 32px Inter, system-ui, sans-serif';
        ctx.fillText(data.rank || 'Игрок', 72, 256);

        const rawAccuracy = String(data.accuracy || '0%').trim();
        const accuracyVal = rawAccuracy.split(' ')[0] || rawAccuracy;
        const stats = [
            { label: 'ОЧКОВ НАБРАНО', value: String(data.score ?? 0) },
            { label: 'МАКС. СЕРИЯ', value: String(data.streak ?? 0) },
            { label: 'ТОЧНОСТЬ', value: accuracyVal }
        ];
        const boxW = 330;
        const boxH = 190;
        const gap = 32;
        const startX = 72;
        const boxY = 304;

        stats.forEach((s, i) => {
            const x = startX + i * (boxW + gap);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
            this.roundRect(ctx, x, boxY, boxW, boxH, 28);
            ctx.fill();
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.10)';
            ctx.lineWidth = 1.5;
            ctx.stroke();

            ctx.textAlign = 'left';
            ctx.fillStyle = '#ffffff';
            let size = 64;
            ctx.font = `800 ${size}px Unbounded, Inter, system-ui, sans-serif`;
            while (ctx.measureText(s.value).width > boxW - 56 && size > 26) {
                size -= 4;
                ctx.font = `800 ${size}px Unbounded, Inter, system-ui, sans-serif`;
            }
            ctx.fillText(s.value, x + 28, boxY + 96);

            ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
            ctx.font = '700 18px Inter, system-ui, sans-serif';
            ctx.fillText(s.label, x + 28, boxY + 148);
        });

        ctx.textAlign = 'left';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
        ctx.font = '500 24px Inter, system-ui, sans-serif';
        const host = window.location.host || 'itd-quiz';
        ctx.fillText('Сыграй сам: ' + host, 72, 566);

        ctx.textAlign = 'right';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.font = '600 22px Inter, system-ui, sans-serif';
        ctx.fillText('Угадай, кто написал пост', W - 72, 566);

        const dataUrl = canvas.toDataURL('image/png');
        const blob = await new Promise((resolve) => {
            try {
                canvas.toBlob((b) => resolve(b), 'image/png');
            } catch (_) {
                resolve(null);
            }
        });
        let file = null;
        if (blob && typeof File === 'function') {
            try {
                file = new File([blob], 'itd-quiz-result.png', { type: 'image/png' });
            } catch (_) {
                file = null;
            }
        }

        this.cachedKey = key;
        this.cachedDataUrl = dataUrl;
        this.cachedBlob = blob;
        this.cachedFile = file;

        return { dataUrl, blob, file };
    },

    download(blobOrUrl) {
        if (!blobOrUrl) return;
        const a = document.createElement('a');
        let url = blobOrUrl;
        let needRevoke = false;
        if (blobOrUrl instanceof Blob) {
            url = URL.createObjectURL(blobOrUrl);
            needRevoke = true;
        }
        a.href = url;
        a.download = 'itd-quiz-result.png';
        document.body.appendChild(a);
        a.click();
        a.remove();
        if (needRevoke) {
            setTimeout(() => URL.revokeObjectURL(url), 3000);
        }
    },

    async copyImage(data) {
        if (!this.cachedBlob || this.cachedKey !== JSON.stringify(data)) {
            await this.generate(data);
        }
        const blob = this.cachedBlob;

        if (navigator.clipboard && window.ClipboardItem && blob) {
            try {
                await navigator.clipboard.write([
                    new ClipboardItem({ 'image/png': blob })
                ]);
                return 'copied';
            } catch (_) {
            }
        }

        this.download(blob || this.cachedDataUrl);
        return 'downloaded';
    },

    async shareToItd(data) {
        if (!this.cachedBlob || this.cachedKey !== JSON.stringify(data)) {
            await this.generate(data);
        }
        const file = this.cachedFile;
        const blob = this.cachedBlob;
        const accuracyText = String(data.accuracy || '0%');
        const text = `ИТД: Угадай Автора — ${data.score} очков, точность ${accuracyText}, серия ${data.streak}. Сыграй сам: ${window.location.origin}`;

        if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
            try {
                await navigator.share({
                    files: [file],
                    title: 'ИТД: Угадай Автора',
                    text: text
                });
                return 'shared';
            } catch (e) {
                if (e && e.name === 'AbortError') return 'cancelled';
            }
        }

        this.download(blob || this.cachedDataUrl);
        if (navigator.clipboard && navigator.clipboard.writeText) {
            try {
                await navigator.clipboard.writeText(text);
            } catch (_) {}
        }
        window.open(this.ITD_URL, '_blank', 'noopener');
        return 'downloaded';
    }
};
