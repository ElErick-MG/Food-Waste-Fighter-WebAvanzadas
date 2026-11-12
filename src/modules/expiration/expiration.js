const DAY = 86400000;
export const dateInput = date => date.toISOString().slice(0, 10);
export const displayDate = date => dateInput(date).split('-').reverse().join('/');

// SQL DATE values are civil dates, not instants in the server's timezone.
export function businessToday(timeZone, now = new Date()) {
  const parts = new Intl.DateTimeFormat('en', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const value = type => parts.find(part => part.type === type).value;
  return new Date(`${value('year')}-${value('month')}-${value('day')}T00:00:00.000Z`);
}
export const addDays = (date, days) => new Date(date.getTime() + days * DAY);
export function expiration(date, today) {
  const days = Math.round((date.getTime() - today.getTime()) / DAY);
  if (days < 0) return { code: 'expired', label: 'Caducado', days, classes: 'bg-red-100 text-red-800 border-red-500' };
  if (days <= 2) return { code: 'critical', label: days === 0 ? 'Crítico: caduca hoy' : `Crítico: ${days} días`, days, classes: 'bg-red-50 text-red-700 border-red-500' };
  if (days <= 5) return { code: 'warning', label: `Advertencia: ${days} días`, days, classes: 'bg-yellow-50 text-yellow-800 border-yellow-500' };
  return { code: 'normal', label: 'Normal (6+ días)', days, classes: 'bg-white text-gray-700 border-gray-300' };
}
export function expirationWhere(status, today) {
  switch (status) {
    case 'expired': return { expiresDate: { lt: today } };
    case 'critical': return { expiresDate: { gte: today, lte: addDays(today, 2) } };
    case 'warning': return { expiresDate: { gte: addDays(today, 3), lte: addDays(today, 5) } };
    case 'soon': return { expiresDate: { gte: today, lte: addDays(today, 5) } };
    case 'normal': return { expiresDate: { gte: addDays(today, 6) } };
    default: return {};
  }
}
