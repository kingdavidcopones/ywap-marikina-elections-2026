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
