interface Env {
  ASSETS: {
    fetch(request: Request): Promise<Response>;
  };
}

const WEBMCP_HEADERS = {
  "Origin-Agent-Cluster": "?1",
  "Permissions-Policy": "tools=(self)",
} as const;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    let assetResponse = await env.ASSETS.fetch(request);

    if (
      assetResponse.status === 404 &&
      (request.method === "GET" || request.method === "HEAD") &&
      request.headers.get("Accept")?.includes("text/html")
    ) {
      const indexUrl = new URL(request.url);
      indexUrl.pathname = "/index.html";
      indexUrl.search = "";
      assetResponse = await env.ASSETS.fetch(new Request(indexUrl, request));
    }

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
};
