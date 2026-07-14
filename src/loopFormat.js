const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function formatLoopAge(createdAt, now = new Date()) {
  const created = new Date(createdAt);
  const days = Math.floor((startOfDay(now) - startOfDay(created)) / MS_PER_DAY);

  if (days <= 0) {
    return 'today';
  }

  return days === 1 ? '1 day' : `${days} days`;
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}
