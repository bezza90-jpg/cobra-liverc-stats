export function normaliseTransponder(value) {
  return String(value ?? '').trim();
}

export function validTransponder(value) {
  const number = normaliseTransponder(value);
  return /^[0-9]{7}$/.test(number) && number !== '1234567' && !/^(\d)\1{6}$/.test(number);
}
