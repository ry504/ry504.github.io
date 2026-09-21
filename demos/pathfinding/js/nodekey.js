// Python nodes are (x, y) integer tuples used as dict keys. JS Maps use string keys.
export const key = (x, y) => `${x},${y}`;
export const parseKey = (k) => {
  const i = k.indexOf(',');
  return [Number(k.slice(0, i)), Number(k.slice(i + 1))];
};
