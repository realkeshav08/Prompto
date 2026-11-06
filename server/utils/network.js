import net from 'net';

/* ─────────────────────────────────────────────────────────────────────────────
   NETWORK SAFETY HELPERS (SSRF DEFENCE)

   The document-ingestion feature fetches user-supplied URLs server-side. These
   pure helpers decide whether a destination is safe so a request can never be
   pointed at localhost, the private LAN, or a cloud metadata endpoint
   (e.g. 169.254.169.254). Kept dependency-free so they're easy to unit test.
   ───────────────────────────────────────────────────────────────────────── */

/* True if an IP literal belongs to a private, loopback, link-local, CGNAT,
   multicast, or otherwise non-public range — for both IPv4 and IPv6. */
export function isPrivateAddress(ip) {
  if (net.isIPv4(ip)) {
    const p = ip.split('.').map(Number);
    return (
      p[0] === 0 || p[0] === 10 || p[0] === 127 ||
      (p[0] === 100 && p[1] >= 64 && p[1] <= 127) ||   // CGNAT
      (p[0] === 169 && p[1] === 254) ||                // link-local / metadata
      (p[0] === 172 && p[1] >= 16 && p[1] <= 31) ||
      (p[0] === 192 && p[1] === 168) ||
      p[0] >= 224                                      // multicast / reserved
    );
  }
  const v6 = ip.toLowerCase();
  return (
    v6 === '::1' || v6 === '::' ||
    v6.startsWith('fc') || v6.startsWith('fd') ||      // unique-local
    v6.startsWith('fe80') ||                           // link-local
    v6.startsWith('::ffff:')                           // IPv4-mapped
  );
}

/* True for hostnames that should never be fetched regardless of DNS, e.g.
   localhost and internal-only TLDs. */
export function isBlockedHostname(host) {
  const h = String(host || '').toLowerCase();
  return /^(localhost|.*\.local|.*\.internal)$/.test(h);
}
