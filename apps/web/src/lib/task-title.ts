// mail threads leak "RE: FW: ..." into captured titles
const REPLY_PREFIX = /^\s*(?:(?:re|fwd?|aw|wg|sv|tr)\s*(?:\[\d+\])?\s*:\s*)+/i;

export function stripReplyPrefix(title: string) {
  const stripped = title.replace(REPLY_PREFIX, "").trim();
  return stripped || title.trim();
}
