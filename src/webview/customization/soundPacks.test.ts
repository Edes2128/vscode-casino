import { describe, expect, it } from 'vitest';
import { SOUND_CATEGORIES, SOUND_PACK_IDS } from '../../state/appearance';
import { SOUND_CATEGORY_INFO, SOUND_PACK_CATALOG, soundPackInfo } from './soundPacks';

describe('the sound pack catalog', () => {
  it('names the five packs, in the order of the ids, each once', () => {
    expect(SOUND_PACK_CATALOG.map((pack) => pack.id)).toEqual([...SOUND_PACK_IDS]);
    expect(SOUND_PACK_CATALOG.map((pack) => pack.name)).toEqual(['Classic Lounge', 'Retro Arcade', 'Pixel Adventure', 'Neon Cyber', 'Minimal Sounds']);
  });

  it('gives every pack one short line about how it sounds', () => {
    for (const pack of SOUND_PACK_CATALOG) {
      expect(pack.blurb.length, pack.id).toBeGreaterThan(10);
      expect(pack.blurb.length, pack.id).toBeLessThanOrEqual(48);
      expect(pack.blurb, pack.id).not.toContain('\n');
      expect(pack.blurb.endsWith('.'), pack.id).toBe(true);
    }
    expect(new Set(SOUND_PACK_CATALOG.map((pack) => pack.blurb)).size).toBe(5);
  });

  it('finds a pack by id, and falls back to the first for an id nobody knows', () => {
    for (const id of SOUND_PACK_IDS) expect(soundPackInfo(id).id).toBe(id);
    expect(soundPackInfo('nonsense' as never).id).toBe('classic');
  });
});

describe('the sound groups', () => {
  it('have a name and a line of help each, for all five', () => {
    expect(Object.keys(SOUND_CATEGORY_INFO).sort()).toEqual([...SOUND_CATEGORIES].sort());
    for (const category of SOUND_CATEGORIES) {
      expect(SOUND_CATEGORY_INFO[category].label.length, category).toBeGreaterThan(0);
      expect(SOUND_CATEGORY_INFO[category].hint.length, category).toBeGreaterThan(10);
    }
  });
});
