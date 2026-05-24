// Intentional lint errors: no-unused-vars, no-var, prefer-const

export function greet(name) {
  var greeting = 'hello';
  const unused = 42;
  return `${greeting}, ${name}!`;
}

const aliased = greet;
