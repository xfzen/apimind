export function isSafeEmail(value) {
  if (typeof value !== 'string' || value.length > 254) {
    return false;
  }
  const at = value.indexOf('@');
  if (at <= 0 || at !== value.lastIndexOf('@') || at > 64) {
    return false;
  }
  const local = value.slice(0, at);
  const domain = value.slice(at + 1);
  if (!local || !domain || domain.length > 253 || domain.indexOf('.') < 1) {
    return false;
  }
  if (local.startsWith('.') || local.endsWith('.') || local.includes('..')) {
    return false;
  }
  if (domain.startsWith('.') || domain.endsWith('.') || domain.includes('..')) {
    return false;
  }
  if (!/^[A-Za-z0-9._%+-]+$/.test(local)) {
    return false;
  }
  return domain.split('.').every(part => /^[A-Za-z0-9-]{1,63}$/.test(part) && !part.startsWith('-') && !part.endsWith('-'));
}

export function emailRule(message = '请输入正确的email!') {
  return {
    validator: (rule, value) => {
      if (!value || isSafeEmail(value)) {
        return Promise.resolve();
      }
      return Promise.reject(new Error(message));
    }
  };
}
