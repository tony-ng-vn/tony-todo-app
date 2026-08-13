// Shared America/Los_Angeles time helpers used by both todoCommands.js and
// noteEntries.js. Split out so notes can format/parse local stamps without a
// circular import back into todoCommands.js.
export const SAN_FRANCISCO_TIME_ZONE = 'America/Los_Angeles';

const SAN_FRANCISCO_DATE_TIME_FORMATTER = new Intl.DateTimeFormat('en-US-u-nu-latn', {
  timeZone: SAN_FRANCISCO_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

export function getSanFranciscoDateTimeParts(date) {
  return Object.fromEntries(
    SAN_FRANCISCO_DATE_TIME_FORMATTER.formatToParts(date)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  );
}

export function dateAtSanFranciscoTime(dayKey, minutesAfterMidnight) {
  const [year, month, day] = dayKey.split('-').map(Number);
  const hour = Math.floor(minutesAfterMidnight / 60);
  const minute = minutesAfterMidnight % 60;
  const desiredWallTime = Date.UTC(year, month - 1, day, hour, minute);
  let result = new Date(desiredWallTime);

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const parts = getSanFranciscoDateTimeParts(result);
    const renderedWallTime = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour),
      Number(parts.minute),
    );
    result = new Date(result.getTime() + desiredWallTime - renderedWallTime);
  }

  return result;
}
