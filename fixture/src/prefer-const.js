// Intentional lint errors: prefer-const (x2), no-console

export function summarize(items) {
  let total = 0;
  let count = items.length;
  for (const item of items) {
    total += item;
  }
  console.log('total:', total, 'count:', count);
  return total;
}
