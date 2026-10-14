/** Bounded arithmetic parser. Never evaluates JavaScript or imported code. */
export function calculate(expression: string): number {
  if (expression.length > 200) throw new Error('Expression too long.');
  const tokens = expression.match(/(?:\d+(?:\.\d*)?|\.\d+)|[a-z]+|[^\s]/g) ?? [];
  let i = 0;
  const funcs: Record<string, (n: number) => number> = {
    sqrt: Math.sqrt,
    sin: Math.sin,
    cos: Math.cos,
    tan: Math.tan,
    ln: Math.log,
    log: Math.log10,
    abs: Math.abs,
  };
  function atom(): number {
    const t = tokens[i++];
    if (t === '+') return atom();
    if (t === '-') return -atom();
    if (t === '(') {
      const v = sum();
      if (tokens[i++] !== ')') throw new Error('Missing closing parenthesis.');
      return v;
    }
    if (t === 'pi') return Math.PI;
    if (t === 'e') return Math.E;
    if (funcs[t]) {
      if (tokens[i++] !== '(') throw new Error('Use function(value).');
      const v = sum();
      if (tokens[i++] !== ')') throw new Error('Missing closing parenthesis.');
      return funcs[t](v);
    }
    if (t !== undefined && /^\d|^\.\d/.test(t)) return Number(t);
    throw new Error('Check your expression.');
  }
  function power(): number {
    const v = atom();
    return tokens[i] === '^' ? (i++, v ** power()) : v;
  }
  function product(): number {
    let v = power();
    while (tokens[i] === '*' || tokens[i] === '/') {
      const op = tokens[i++],
        r = power();
      v = op === '*' ? v * r : v / r;
    }
    return v;
  }
  function sum(): number {
    let v = product();
    while (tokens[i] === '+' || tokens[i] === '-') {
      const op = tokens[i++],
        r = product();
      v = op === '+' ? v + r : v - r;
    }
    return v;
  }
  const value = sum();
  if (i !== tokens.length || !Number.isFinite(value))
    throw new Error('Invalid expression or non-finite result.');
  return value;
}
