// /api/submit.js — отправка заявки в Telegram через Bot API (Vercel serverless)
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  // req.body может прийти строкой, если content-type не распознан
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { body = {}; }
  }
  const { name, phone, channel, direction, comment, _honey } = body || {};

  // Honeypot: бот заполнил скрытое поле — делаем вид, что всё хорошо
  if (_honey) return res.status(200).json({ ok: true });

  // Валидация обязательных полей
  if (!name || String(name).trim().length < 2 || !phone) {
    return res.status(400).json({ ok: false, error: 'Заполните имя и телефон' });
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    console.error('Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID env vars');
    return res.status(500).json({ ok: false, error: 'Сервис временно недоступен' });
  }

  const text = [
    '🔔 Новая заявка с сайта',
    '',
    `Имя: ${name}`,
    `Телефон: ${phone}`,
    `Связь через: ${channel || 'не указано'}`,
    `Направление: ${direction || 'не указано'}`,
    '',
    'Комментарий:',
    (comment && String(comment).trim()) || '—',
    '',
    `📅 ${new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' })}`,
  ].join('\n');

  try {
    const tgResponse = await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
      }
    );
    const data = await tgResponse.json();
    if (!data.ok) throw new Error(data.description || 'Telegram API error');
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('Telegram error:', e);
    return res.status(500).json({ ok: false, error: 'Не удалось отправить заявку' });
  }
}
