import { isIPv6 } from 'node:net';

/**
 * Key for per-client rate limits. IPv4 addresses are used as they are; IPv6 addresses by their
 * /64 prefix, because one subscriber usually holds a whole /64 and could otherwise dodge the
 * limits by rotating addresses inside it (QA F-6). IPv4-mapped IPv6 counts as the IPv4 address.
 */
export function rateLimitKey(ip: string): string {
  const value = ip.trim().replace(/%.*$/, '');
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(value);
  if (mapped) return mapped[1];
  if (!isIPv6(value)) return value;

  const [head, tail = ''] = value.split('::');
  const headParts = head ? head.split(':') : [];
  const tailParts = tail ? tail.split(':') : [];
  const groups = value.includes('::')
    ? [...headParts, ...Array<string>(Math.max(0, 8 - headParts.length - tailParts.length)).fill('0'), ...tailParts]
    : headParts;
  return `${groups
    .slice(0, 4)
    .map((g) => parseInt(g, 16).toString(16))
    .join(':')}::/64`;
}
