export function parseSchema(text) {
  if (!text) {
    return {};
  }
  if (typeof text === 'object') {
    return text;
  }
  return JSON.parse(text);
}

export function serializeSchema(value) {
  return JSON.stringify(value || {}, null, 2);
}
