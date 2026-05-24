// Intentional lint errors: no-console (x3)

export function trace(value) {
  console.log('trace:', value);
  console.warn('check this');
  console.error('boom');
  return value;
}
