const DONE_COLUMN_PATTERN =
  /^(done|complete[d]?|finish(ed)?|resolved|closed|shipped|released|delivered)$/i;

export function isDoneLikeColumn(name: string) {
  return DONE_COLUMN_PATTERN.test(name.trim());
}
