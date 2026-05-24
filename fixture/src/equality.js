// Intentional lint errors: eqeqeq (x2), no-undef

export function compare(a, b) {
  if (a == b) return 'loose-equal';
  if (a != null) return 'loose-not-null';
  return undefinedReference;
}
