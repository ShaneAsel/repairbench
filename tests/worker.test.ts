import { describe, expect, it, vi } from "vitest";
import worker from "../worker/index";

describe("Sites Worker", () => {
  it("serves the SPA shell for deep navigation and preserves WebMCP headers", async () => {
    const fetch = vi.fn(async (request: Request) => {
      const { pathname } = new URL(request.url);
      return pathname === "/index.html"
        ? new Response("<!doctype html>", { headers: { "Content-Type": "text/html" } })
        : new Response("Not found", { status: 404 });
    });

    const response = await worker.fetch(
      new Request("https://repairbench.example/demo/y-axis?reset=1", {
        headers: { Accept: "text/html" },
      }),
      { ASSETS: { fetch } } as unknown as Parameters<typeof worker.fetch>[1],
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("<!doctype html>");
    expect(response.headers.get("Origin-Agent-Cluster")).toBe("?1");
    expect(response.headers.get("Permissions-Policy")).toBe("tools=(self)");
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(new URL(fetch.mock.calls[1][0].url).pathname).toBe("/index.html");
  });
});
