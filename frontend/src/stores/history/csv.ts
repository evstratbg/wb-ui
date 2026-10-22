import type { TableRow } from './types';
const quoted = (value: unknown) => {
  let text = value == null ? '' : String(value);
  if (typeof value === 'string' && /^[\s]*[=+@-]|^[\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
};
export const historyCsv = (headers: string[], rows: TableRow[]) =>
  '\ufeff' +
  [
    ['Time (UTC)', ...headers].map(quoted).join(','),
    ...rows.map((row) => [new Date(row.date).toISOString(), ...row.value].map(quoted).join(',')),
  ].join('\r\n');
