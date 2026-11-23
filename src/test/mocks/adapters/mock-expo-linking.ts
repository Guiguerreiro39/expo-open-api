export function createURL(path: string, options?: { scheme?: string }): string {
  const scheme = options?.scheme ?? "expoopenapi";
  const normalizedPath = path.startsWith("/") ? path.slice(1) : path;
  return `${scheme}://${normalizedPath}`;
}

export function parse(url: string) {
  const parsed = new URL(url);
  return {
    scheme: parsed.protocol.replace(/:$/, ""),
    hostname: parsed.hostname,
    path: parsed.pathname,
    queryParams: Object.fromEntries(parsed.searchParams.entries()),
  };
}

export function addEventListener() {
  return { remove: () => {} };
}

export async function getInitialURL(): Promise<string | null> {
  return null;
}
