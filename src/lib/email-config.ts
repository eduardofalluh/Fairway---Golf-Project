/** Tee-time emails go through Resend; the UI hides the option without a key. */
export function emailConfigured() {
  return Boolean(process.env.RESEND_API_KEY);
}
