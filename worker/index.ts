interface Env {
  ASSETS: Fetcher;
}

const WEBMCP_HEADERS = {
  "Origin-Agent-Cluster": "?1",
  "Permissions-Policy": "tools=(self)",
} as const;

export default {
  async fetch(request, env): Promise<Response> {
    const assetResponse = await env.ASSETS.fetch(request);
    const headers = new Headers(assetResponse.headers);

    for (const [name, value] of Object.entries(WEBMCP_HEADERS)) {
      headers.set(name, value);
    }

    return new Response(assetResponse.body, {
      status: assetResponse.status,
      statusText: assetResponse.statusText,
      headers,
    });
  },
} satisfies ExportedHandler<Env>;
