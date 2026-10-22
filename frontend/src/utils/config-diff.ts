export interface ConfigChange {
  path: string;
  before: unknown;
  after: unknown;
}
export function configDiff(before: unknown, after: unknown, path = '$'): ConfigChange[] {
  if (Object.is(before, after)) return [];
  if (
    before !== null &&
    after !== null &&
    typeof before === 'object' &&
    typeof after === 'object' &&
    Array.isArray(before) === Array.isArray(after)
  ) {
    return [...new Set([...Object.keys(before), ...Object.keys(after)])].flatMap((key) =>
      configDiff(
        before[key],
        after[key],
        Array.isArray(before) ? `${path}[${key}]` : `${path}.${key}`
      )
    );
  }
  return [{ path, before, after }];
}
