// Intentional lint errors: no-unreachable, no-console

export function early(x) {
  if (x > 0) {
    return x;
  }
  return -x;
  console.log('never runs');
}

export function alwaysReturns() {
  return 1;
  const dead = 'code';
  return dead;
}
