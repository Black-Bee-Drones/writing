/**
 * Hides fenced code blocks, HTML comments and inline code behind placeholders so that later
 * regex passes (math detection) can never touch their contents.
 *  - `$` inside a bash/python snippet must stay a `$`
 *  - `$$ ... $$` inside an <!-- HTML comment --> is a note to yourself, not an equation
 */
const FENCE = /^( {0,3})(`{3,}|~{3,})[^\n]*\n[\s\S]*?(?:^ {0,3}\2[`~]*[ \t]*$|(?![\s\S]))/gm;
const COMMENT = /<!--[\s\S]*?-->/g;
// Inline spans: a run of N backticks ... the same run of N backticks (same line).
const INLINE = /(?<!`)(`+)(?!`)[^\n]*?[^`\n]\1(?!`)/g;

export function protectCode(text) {
  const store = [];
  const stash = (m) => {
    store.push(m);
    return `\uE010${store.length - 1}\uE011`;
  };
  const out = text.replace(FENCE, stash).replace(COMMENT, stash).replace(INLINE, stash);
  const restore = (s) => {
    // loop: a stashed comment may itself contain a placeholder (e.g. inline code inside it)
    let prev;
    do {
      prev = s;
      s = s.replace(/\uE010(\d+)\uE011/g, (_, i) => store[Number(i)]);
    } while (s !== prev);
    return s;
  };
  return { text: out, restore };
}
