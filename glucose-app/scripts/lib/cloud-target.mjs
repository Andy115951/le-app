export function cloudTestConfig(env = process.env) {
  const url = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
  const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY;
  const adminKey = env.SUPABASE_SERVICE_ROLE_KEY;
  const expectedUrl = env.GLUCOSE_EXPECTED_SUPABASE_URL;
  if (env.GLUCOSE_RUN_CLOUD_TESTS !== '1' || !url || !anonKey || !adminKey || !expectedUrl) {
    throw new Error('Cloud tests require explicit opt-in, credentials, and GLUCOSE_EXPECTED_SUPABASE_URL.');
  }
  function origin(value) {
    let parsed;
    try { parsed = new URL(value); } catch { throw new Error('Invalid cloud-test target.'); }
    const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname);
    if ((parsed.protocol !== 'https:' && !(loopback && parsed.protocol === 'http:')) ||
        parsed.username || parsed.password || parsed.pathname !== '/' || parsed.search || parsed.hash) {
      throw new Error('Cloud-test targets must be service origins without credentials or URL parameters.');
    }
    return parsed.origin;
  }
  const selected = origin(url);
  if (selected !== origin(expectedUrl)) throw new Error('Refusing cloud writes: the target does not match the explicitly selected project.');
  return { url: selected, anonKey, adminKey };
}
