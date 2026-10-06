window.ImageUtil = {
    MAX_WIDTH: 1200,
    QUALITY: 0.8,

    canvasToDataUrl(canvas, quality = this.QUALITY) {
        const webp = canvas.toDataURL('image/webp', quality);
        if (webp.startsWith('data:image/webp')) return webp;
        return canvas.toDataURL('image/jpeg', quality);
    },

    loadImage(src) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error('Не удалось загрузить изображение'));
            img.src = src;
        });
    },

    fileToDataUrl(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = () => reject(new Error('Не удалось прочитать файл'));
            reader.readAsDataURL(file);
        });
    },

    scaledSize(width, height, maxWidth = this.MAX_WIDTH) {
        if (width <= maxWidth) return { width, height };
        const ratio = maxWidth / width;
        return { width: maxWidth, height: Math.round(height * ratio) };
    },

    async compressDataUrl(dataUrl, maxWidth = this.MAX_WIDTH, quality = this.QUALITY) {
        const img = await this.loadImage(dataUrl);
        const size = this.scaledSize(img.naturalWidth || img.width, img.naturalHeight || img.height, maxWidth);
        const canvas = document.createElement('canvas');
        canvas.width = size.width;
        canvas.height = size.height;
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, size.width, size.height);
        const result = this.canvasToDataUrl(canvas, quality);
        return result.length < dataUrl.length ? result : dataUrl;
    },

    async compressFile(file, maxWidth = this.MAX_WIDTH, quality = this.QUALITY) {
        const raw = await this.fileToDataUrl(file);
        return this.compressDataUrl(raw, maxWidth, quality);
    },

    formatSize(dataUrl) {
        const bytes = Math.round((dataUrl.length * 3) / 4);
        if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' МБ';
        return Math.round(bytes / 1024) + ' КБ';
    }
};
