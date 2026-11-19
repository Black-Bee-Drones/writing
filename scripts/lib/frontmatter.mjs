import matter from 'gray-matter';

/**
 * Splits YAML front matter from the body. The front matter is *metadata for you*
 * (title, tags, ...): it is never part of the text pasted into Medium.
 */
export function parseFrontMatter(raw, issues, cfg) {
  let parsed;
  try {
    // Pass an options object so gray-matter doesn't cache by content string.
    parsed = matter(raw, {});
  } catch (e) {
    issues.error(`Front matter is not valid YAML: ${e.message}`);
    return { data: {}, body: raw };
  }
  const data = parsed.data || {};
  if (!data.title) issues.warn('Front matter has no `title`.');
  if (!data.author) issues.warn('Front matter has no `author`.');
  if (data.tags && !Array.isArray(data.tags)) {
    issues.warn('`tags` should be a YAML list, e.g. ["drone", "pwm"].');
    data.tags = String(data.tags).split(',').map((t) => t.trim()).filter(Boolean);
  }
  if (Array.isArray(data.tags) && data.tags.length > cfg.maxTags) {
    issues.warn(
      `${data.tags.length} tags in front matter, but Medium allows ${cfg.maxTags}. ` +
        `Medium will use only ${cfg.maxTags}; pick them when publishing.`,
    );
  }
  return { data, body: parsed.content };
}
