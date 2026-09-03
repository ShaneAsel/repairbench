import { expect, test } from "@playwright/test";

test("canonical Y-axis workspace renders and accepts a human observation", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => consoleErrors.push(error.message));

  await page.goto("/demo/y-axis?reset=1");
  await expect(page.getByText("Y-axis diagnostic workspace")).toBeVisible();
  await expect(page.locator("canvas")).toBeVisible();
  await expect(page.getByRole("button", { name: /WebMCP preview/ })).toContainText("12 tools");

  await page.locator("canvas").click({ position: { x: 415, y: 440 } });
  await expect(page.locator(".component-detail h3")).toContainText(/Build Plate|Bed Carriage/);

  const createResult = await page.evaluate(() => window.__repairbenchWebMcp!.invoke("create_test", { templateId: "manual_y_motion" })) as any;
  expect(createResult.ok).toBe(true);
  const requestResult = await page.evaluate(
    (testId) => window.__repairbenchWebMcp!.invoke("request_observation", { testId }),
    createResult.data.testId,
  ) as any;
  expect(requestResult).toMatchObject({
    ok: true,
    data: { status: "awaiting_human", interaction: "ask_in_chat", nextTool: "record_test_result" },
  });

  await expect(page.getByText("Reply in ChatGPT or record here")).toBeVisible();
  const recordResult = await page.evaluate(
    (testId) => window.__repairbenchWebMcp!.invoke("record_test_result", {
      testId,
      resultOptionId: "moves_freely",
    }),
    createResult.data.testId,
  ) as any;
  expect(recordResult).toMatchObject({
    ok: true,
    data: {
      status: "completed",
      observation: { optionId: "moves_freely", label: "Moves freely", source: "human_chat" },
      suggestedEvidenceEffects: [{ hypothesisId: "physical_obstruction", status: "unlikely" }],
    },
  });
  await expect(page.getByText("Agent recorded your chat response “Moves freely”")).toBeVisible();
  await expect(page.locator(".observation-row strong", { hasText: "Moves freely" })).toBeVisible();
  await expect(page.locator(".observation-row", { hasText: "via ChatGPT" })).toBeVisible();

  const diagnostic = await page.evaluate(() => window.__repairbenchWebMcp!.invoke("get_active_diagnostic", {})) as any;
  const observationId = diagnostic.data.observations.at(-1).id;
  const updateResult = await page.evaluate(
    ({ evidenceId }) => window.__repairbenchWebMcp!.invoke("update_hypothesis", {
      hypothesisId: "physical_obstruction",
      status: "unlikely",
      reasoning: "Free unpowered travel argues against a persistent physical obstruction.",
      evidence: [{ kind: "observation", id: evidenceId }],
    }),
    { evidenceId: observationId },
  ) as any;
  expect(updateResult.ok).toBe(true);
  await expect(page.locator(".hypothesis-row", { hasText: "Physical obstruction" }).locator(".status-label")).toHaveText("unlikely");

  await page.goto("/demo/y-axis?reset=1");
  await expect(page.getByText("No tests yet")).toBeVisible();
  await expect(page.locator(".hypothesis-row", { hasText: "Physical obstruction" }).locator(".status-label")).toHaveText("possible");
  await expect(page).toHaveURL(/\/demo\/y-axis$/);

  await page.screenshot({ path: "/private/tmp/repairbench-demo.png", fullPage: true });
  expect(consoleErrors).toEqual([]);
});

test("landing page presents the demo without horizontal overflow", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Find the fault/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Open Y-axis demo/ })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBe(0);
  await page.screenshot({ path: "/private/tmp/repairbench-landing.png", fullPage: true });
});
