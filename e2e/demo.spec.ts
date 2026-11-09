import { expect, test } from "@playwright/test";

test("a visitor runs moment 1, approves Ada's draft, and resets the demo", async ({ page }) => {
  await page.goto("/");

  const nav = page.getByRole("navigation", { name: "Main" });
  await expect(nav.getByRole("link")).toHaveCount(5);
  await expect(page.getByTestId("pm-badge")).toHaveCount(0);

  await page.getByRole("button", { name: "Advance to next day" }).click();
  await expect(page.getByText("Demo day 1 of 5")).toBeVisible();
  await expect(nav.getByTestId("pm-badge")).toHaveText("1");

  await nav.getByRole("link", { name: /AI Program Manager/ }).click();
  await page.getByTestId("queue-item").filter({ hasText: "Kelpforge" }).click();
  // Locally the server has no API key, so Ada replays the recording; a live deployment runs her for real.
  if (!process.env.E2E_BASE_URL) await expect(page.getByText("Replaying a recorded run")).toBeVisible();
  await expect(page.getByTestId("agent-steps")).toContainText("Updated the risk level");

  await page.getByRole("button", { name: "Approve (mark sent)" }).click();
  await expect(page.getByTestId("draft-card")).toContainText("Approved");
  await expect(nav.getByTestId("pm-badge")).toHaveCount(0);

  await page.getByRole("button", { name: "Advance to next day" }).click();
  // Live, how many drafts Ada writes for the slot swap varies; the recording writes two.
  await expect(nav.getByTestId("pm-badge")).toHaveText(process.env.E2E_BASE_URL ? /^[1-9]$/ : "2");

  await page.getByRole("button", { name: "Reset demo" }).click();
  await expect(page.getByText("Demo day 0 of 5")).toBeVisible();
  await expect(nav.getByTestId("pm-badge")).toHaveCount(0);
});

test("moment 3: an investor confirms, Ada updates the RSVPs and drafts the run sheet", async ({ page }) => {
  await page.goto("/");
  for (let day = 1; day <= 5; day++) {
    await page.getByRole("button", { name: "Advance to next day" }).click();
    await expect(page.getByText(`Demo day ${day} of 5`)).toBeVisible();
  }
  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Events" }).click();
  const panel = page.getByTestId("event-card").filter({ hasText: "Investor panel" });
  await expect(panel.getByTestId("rsvp-count")).toHaveText("4 of 6 confirmed");
  await expect(panel.getByTestId("run-sheet")).toContainText("Suggested pitch order");

  await page.getByRole("button", { name: "Reset demo" }).click();
  await expect(page.getByText("Demo day 0 of 5")).toBeVisible();
});

test("no horizontal scroll at phone width", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const path of ["/", "/pm", "/startups", "/mentors", "/events"]) {
    await page.goto(path);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, path).toBeLessThanOrEqual(0);
  }
});
