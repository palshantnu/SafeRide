// Dynamic multi-page website model, stored in the backend `landing_sections`
// table (one row = one block). We keep page + type + fields inside `content`,
// and reuse title/subtitle/image columns + sort_order + status.

export const PAGES = ['home', 'about', 'services', 'contact'] as const;
export type PageKey = (typeof PAGES)[number];

export const PAGE_LABELS: Record<PageKey, string> = {
  home: 'Home', about: 'About', services: 'Services', contact: 'Contact',
};

export type BlockType = 'hero' | 'richtext' | 'cards' | 'stats' | 'steps' | 'cta' | 'contact';

export const BLOCK_TYPES: { type: BlockType; label: string; desc: string }[] = [
  { type: 'hero',     label: 'Hero',        desc: 'Big banner: title, subtitle, image, button' },
  { type: 'richtext', label: 'Text',        desc: 'Heading + paragraph text' },
  { type: 'cards',    label: 'Cards',       desc: 'Grid of items (features / services)' },
  { type: 'stats',    label: 'Stats',       desc: 'Highlight numbers' },
  { type: 'steps',    label: 'Steps',       desc: 'Numbered how-it-works steps' },
  { type: 'cta',      label: 'Call To Action', desc: 'Colored banner with a button' },
  { type: 'contact',  label: 'Contact Info', desc: 'Phone / email / address / hours' },
];

export interface CardItem { title: string; desc?: string; image_url?: string }
export interface StatItem { value: string; label: string }
export interface StepItem { title: string; desc?: string }

export interface BlockData {
  buttonText?: string;
  buttonLink?: string;
  body?: string;
  items?: (CardItem | StatItem | StepItem)[];
  phone?: string;
  email?: string;
  address?: string;
  hours?: string;
  columns?: number;
}

export interface Block {
  id: number;
  page: PageKey;
  type: BlockType;
  title: string;
  subtitle: string;
  image: string | null;
  image_url: string | null;
  sort_order: number;
  status: number;
  data: BlockData;
}

interface RawSection {
  id: number;
  section_key?: string;
  title?: string | null;
  subtitle?: string | null;
  content?: unknown;
  image?: string | null;
  image_url?: string | null;
  sort_order?: number;
  status?: number;
}

const asObj = (v: unknown): Record<string, unknown> => {
  if (v && typeof v === 'object') return v as Record<string, unknown>;
  if (typeof v === 'string') { try { const o = JSON.parse(v); return o && typeof o === 'object' ? o : {}; } catch { return {}; } }
  return {};
};

// Turn a /landing or /admin/landing payload into typed blocks.
export function parseBlocks(payload: unknown): Block[] {
  const p = payload as { data?: RawSection[] } | RawSection[] | undefined;
  const arr: RawSection[] = Array.isArray(p) ? p : Array.isArray(p?.data) ? p!.data! : [];
  const blocks: Block[] = [];
  for (const s of arr) {
    const c = asObj(s.content);
    const page = (c.page as PageKey) || 'home';
    const type = (c.type as BlockType) || 'richtext';
    if (!PAGES.includes(page)) continue;
    const { page: _p, type: _t, ...data } = c;
    void _p; void _t;
    blocks.push({
      id: s.id,
      page, type,
      title: s.title ?? '',
      subtitle: s.subtitle ?? '',
      image: s.image ?? null,
      image_url: s.image_url ?? null,
      sort_order: s.sort_order ?? 0,
      status: s.status ?? 1,
      data: data as BlockData,
    });
  }
  return blocks.sort((a, b) => a.sort_order - b.sort_order || a.id - b.id);
}

export const blocksForPage = (blocks: Block[], page: PageKey, activeOnly = false) =>
  blocks.filter(b => b.page === page && (!activeOnly || b.status === 1))
        .sort((a, b) => a.sort_order - b.sort_order || a.id - b.id);

// Build the `content` JSON that goes into a section row.
export function blockContent(page: PageKey, type: BlockType, data: BlockData): string {
  return JSON.stringify({ page, type, ...data });
}

// A unique section_key for a new block.
export function newSectionKey(page: PageKey, type: BlockType): string {
  return `${page}_${type}_${Date.now()}`;
}

// A blank block template for the "Add block" flow.
export function emptyBlock(page: PageKey, type: BlockType): Omit<Block, 'id' | 'image' | 'image_url'> {
  const base = { page, type, title: '', subtitle: '', sort_order: 0, status: 1 as number };
  switch (type) {
    case 'hero':     return { ...base, data: { buttonText: 'Get Started', buttonLink: '/contact' } };
    case 'cards':    return { ...base, data: { items: [{ title: '', desc: '' }], columns: 3 } };
    case 'stats':    return { ...base, data: { items: [{ value: '', label: '' }] } };
    case 'steps':    return { ...base, data: { items: [{ title: '', desc: '' }] } };
    case 'cta':      return { ...base, data: { buttonText: 'Contact Us', buttonLink: '/contact' } };
    case 'contact':  return { ...base, data: { phone: '', email: '', address: '', hours: '' } };
    case 'richtext':
    default:         return { ...base, data: { body: '' } };
  }
}

// ── Default content shown on the public site before anything is created ──────
export const DEFAULT_BRAND = {
  name: 'Sigi Ride',
  tagline: 'Your ride, your way',
  phone: '+91 00000 00000',
  email: 'support@sigiride.com',
  address: 'India',
};
