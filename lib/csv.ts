export function parseCsvLine(line: string) {
  const values: string[] = [];
  let current = '';
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"' && line[index + 1] === '"' && quoted) {
      current += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === ',' && !quoted) {
      values.push(current.trim());
      current = '';
    } else {
      current += character;
    }
  }
  values.push(current.trim());
  return values;
}

export function parseVoters(csv: string) {
  const lines = csv.split(/\r?\n/).filter((line) => line.trim() && !/^,+$/.test(line.trim()));
  const headerIndex = lines.findIndex((line) => parseCsvLine(line).some((header) => header.trim().toLocaleLowerCase('en') === 'member_id'));
  if (headerIndex < 0) return [];
  const headers = parseCsvLine(lines[headerIndex]).map((header) => header.trim().toLocaleLowerCase('en'));
  return lines.slice(headerIndex + 1).map((line) => {
    const values = parseCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? '']));
  });
}

export function normalizeCsvBirthDate(value: string): string | null {
  const input = value.trim();
  if (!input) return null;

  function calendarDate(year: number, month: number, day: number) {
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
      ? date.toISOString().slice(0, 10) : null;
  }

  const yearFirst = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/.exec(input);
  if (yearFirst) return calendarDate(Number(yearFirst[1]), Number(yearFirst[2]), Number(yearFirst[3]));

  const yearLast = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/.exec(input);
  if (yearLast) {
    const first = Number(yearLast[1]);
    const second = Number(yearLast[2]);
    // Use month/day/year for ambiguous dates, matching the eligible voter import.
    return first > 12
      ? calendarDate(Number(yearLast[3]), second, first)
      : calendarDate(Number(yearLast[3]), first, second);
  }

  if (/^\d+$/.test(input)) return null;
  const parsed = Date.parse(input);
  if (!Number.isFinite(parsed)) return null;
  const date = new Date(parsed);
  return calendarDate(date.getFullYear(), date.getMonth() + 1, date.getDate());
}
