import { describe, it, expect } from 'vitest';
import { isPrivateAddress, isBlockedHostname } from './network.js';

describe('isPrivateAddress', () => {
  it('blocks IPv4 loopback, private, CGNAT and metadata ranges', () => {
    const blocked = [
      '127.0.0.1',        // loopback
      '10.0.0.5',         // private
      '172.16.5.9',       // private
      '172.31.255.255',   // private (upper bound)
      '192.168.1.1',      // private
      '169.254.169.254',  // cloud metadata
      '100.64.0.1',       // CGNAT
      '0.0.0.0',          // "this host"
      '224.0.0.1',        // multicast
    ];
    blocked.forEach(ip => expect(isPrivateAddress(ip), ip).toBe(true));
  });

  it('allows ordinary public IPv4 addresses', () => {
    const allowed = ['8.8.8.8', '1.1.1.1', '93.184.216.34', '172.15.0.1', '172.32.0.1'];
    allowed.forEach(ip => expect(isPrivateAddress(ip), ip).toBe(false));
  });

  it('blocks IPv6 loopback, unique-local, link-local and mapped addresses', () => {
    const blocked = ['::1', '::', 'fc00::1', 'fd12:3456::1', 'fe80::1', '::ffff:127.0.0.1'];
    blocked.forEach(ip => expect(isPrivateAddress(ip), ip).toBe(true));
  });

  it('allows public IPv6 addresses', () => {
    expect(isPrivateAddress('2606:4700:4700::1111')).toBe(false);
  });
});

describe('isBlockedHostname', () => {
  it('blocks localhost and internal-only TLDs (case-insensitive)', () => {
    ['localhost', 'LOCALHOST', 'router.local', 'service.internal'].forEach(h =>
      expect(isBlockedHostname(h), h).toBe(true)
    );
  });

  it('allows normal public hostnames', () => {
    ['example.com', 'api.openai.com', 'sub.domain.co'].forEach(h =>
      expect(isBlockedHostname(h), h).toBe(false)
    );
  });
});
