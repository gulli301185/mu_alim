const KG_LOCAL_RE = /^[2-9]\d{8}$/;

export function normalizeKgPhone(input: string): string | null {
  const digits = input.replace(/\D/g, '');
  let local = '';

  if ((digits.startsWith('996') || digits.startsWith('995')) && digits.length === 12) {
    local = digits.slice(3);
  } else if (digits.startsWith('0') && digits.length === 10) {
    local = digits.slice(1);
  } else if (digits.length === 9) {
    local = digits;
  } else {
    return null;
  }

  if (!KG_LOCAL_RE.test(local)) return null;
  return `+996${local}`;
}

export function phoneToSmsDigits(phone: string): string {
  return phone.replace(/\D/g, '');
}
