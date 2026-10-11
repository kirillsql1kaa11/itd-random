export async function generateShareCard(data: {
  nickname: string;
  score: number;
  accuracy: number;
  streak: number;
  mode: string;
}): Promise<string> {
  const canvas = document.createElement('canvas');
  const width = 1200;
  const height = 630;
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  const grad = ctx.createLinearGradient(0, 0, width, height);
  grad.addColorStop(0, '#0a0a0d');
  grad.addColorStop(0.5, '#121218');
  grad.addColorStop(1, '#08080a');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.lineWidth = 2;
  ctx.strokeRect(30, 30, width - 60, height - 60);

  ctx.fillStyle = '#0080ff';
  ctx.font = '600 24px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('ИТД · КТО АВТОР ПОСТА?', 70, 95);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 52px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(data.nickname || 'Аноним', 70, 175);

  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.font = '500 22px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  const modeText = data.mode === 'blitz' ? 'Режим: Блиц 10' : data.mode === 'survival' ? 'Режим: Выживание' : 'Режим: Свободный';
  ctx.fillText(modeText, 70, 215);

  const drawStatBox = (x: number, y: number, w: number, h: number, title: string, val: string, color: string) => {
    ctx.fillStyle = '#16161c';
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 16);
    ctx.fill();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.font = '500 20px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(title, x + 30, y + 50);

    ctx.fillStyle = color;
    ctx.font = 'bold 44px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(val, x + 30, y + 115);
  };

  drawStatBox(70, 270, 320, 160, 'Набрано очков', String(data.score), '#00ba7c');
  drawStatBox(430, 270, 320, 160, 'Точность', `${data.accuracy}%`, '#0080ff');
  drawStatBox(790, 270, 340, 160, 'Лучшая серия', `x${data.streak}`, '#f59e0b');

  ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
  ctx.font = '400 20px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('Сыграй и проверь свою интуицию в викторине ИТД', 70, 540);

  return canvas.toDataURL('image/png');
}
