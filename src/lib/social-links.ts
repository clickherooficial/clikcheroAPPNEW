/** Normaliza entradas de redes — URL ou @handle. Usado na validacao do passo Negócio. */

const IG_RES = /^(explore|accounts|direct|reels?|tv|stories|p)$/i;

export function normalizeInstagramUrl(input: string): string | undefined {
  const raw = input.trim();
  if (!raw) return undefined;

  if (/instagram\.com/i.test(raw) && !/^https?:\/\//i.test(raw)) {
    return normalizeInstagramUrl(`https://${raw.replace(/^\/+/, '')}`);
  }

  if (/^https?:\/\//i.test(raw)) {
    try {
      const u = new URL(raw);
      if (!u.hostname.replace(/^www\./, '').includes('instagram.com')) return undefined;
      const parts = u.pathname
        .split('/')
        .filter(Boolean)
        .map((p) => p.split('?')[0]);
      const username =
        parts.find((seg) => seg && !IG_RES.test(seg))?.replace(/^@/, '') ?? '';
      if (!username) return 'https://www.instagram.com/';
      return `https://www.instagram.com/${username}/`;
    } catch {
      return undefined;
    }
  }

  let h = raw.replace(/^@+/, '').trim();
  const q = h.indexOf('?');
  if (q >= 0) h = h.slice(0, q);
  const slash = h.indexOf('/');
  if (slash > 0) h = h.slice(0, slash);
  if (!/^[a-zA-Z0-9._]{1,30}$/.test(h)) return undefined;
  return `https://www.instagram.com/${h}/`;
}

export function normalizeTikTokUrl(input: string): string | undefined {
  const raw = input.trim();
  if (!raw) return undefined;

  if (/tiktok\.com/i.test(raw) && !/^https?:\/\//i.test(raw)) {
    return normalizeTikTokUrl(`https://${raw.replace(/^\/+/, '')}`);
  }

  if (/^https?:\/\//i.test(raw)) {
    try {
      const u = new URL(raw);
      if (!u.hostname.replace(/^www\./, '').includes('tiktok.com')) return undefined;
      const parts = u.pathname.split('/').filter(Boolean);
      let nick = '';
      const atSeg = parts.find((p) => p.startsWith('@'));
      if (atSeg) nick = atSeg.replace(/^@/, '');
      else if (parts[0]) nick = parts[0].replace(/^@/, '');
      if (!/^[\w.]{2,}$/.test(nick)) return undefined;
      return `https://www.tiktok.com/@${nick}`;
    } catch {
      return undefined;
    }
  }

  let h = raw.replace(/^@+/, '').trim();
  const slash = h.indexOf('/');
  if (slash > 0) h = h.slice(0, slash);
  if (!/^[\w.]{2,}$/.test(h)) return undefined;
  return `https://www.tiktok.com/@${h}`;
}
