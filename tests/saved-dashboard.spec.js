import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
});

test("summarizes local saved activity", async ({ page }) => {
  await page.evaluate(() => {
    localStorage.setItem("weDontBuyStats:v1", JSON.stringify({ saved: 148, orders: 2, items: 3, impact: 12.6 }));
    localStorage.setItem(
      "weDontBuyOrders:v1",
      JSON.stringify([
        {
          id: "local-1",
          createdAt: "2026-06-24T10:00:00.000Z",
          items: [{ id: "cropped-blazer", name: "Evening Reset Blazer", price: 74 }],
          total: 74,
          impact: 6.2,
          trigger: "Stress",
        },
        {
          id: "local-2",
          createdAt: "2026-06-24T09:00:00.000Z",
          items: [{ id: "wide-denim", name: "Wide-Leg Pause Denim", price: 49 }],
          total: 49,
          impact: 8.8,
          trigger: "Stress",
        },
      ]),
    );
    localStorage.setItem(
      "weDontBuyCoolingRack:v1",
      JSON.stringify([{ productId: "satin-slip", addedAt: "2026-06-24T10:00:00.000Z", unlockAt: "2026-06-25T10:00:00.000Z" }]),
    );
  });
  await page.reload();

  const dashboard = page.getByRole("region", { name: "Saved dashboard" });
  await expect(dashboard.getByRole("heading", { name: "Saved dashboard" })).toBeVisible();
  await expect(dashboard.getByText("148", { exact: true })).toBeVisible();
  await expect(dashboard.getByText("2 imaginary orders")).toBeVisible();
  await expect(dashboard.getByText("Most common trigger")).toBeVisible();
  await expect(dashboard.getByText("Stress")).toBeVisible();
  await expect(dashboard.getByText("1 cooling off")).toBeVisible();
});

test("resets all local data from the dashboard", async ({ page }) => {
  await page.evaluate(() => {
    localStorage.setItem("weDontBuyStats:v1", JSON.stringify({ saved: 74, orders: 1, items: 1, impact: 6.2 }));
    localStorage.setItem("weDontBuyProfile:v1", JSON.stringify({ name: "Mia" }));
  });
  await page.reload();

  await page.getByRole("button", { name: "Reset all local data" }).click();

  const dashboard = page.getByRole("region", { name: "Saved dashboard" });
  await expect(dashboard.getByText("0", { exact: true }).first()).toBeVisible();
  await expect(dashboard.getByText("0 imaginary orders")).toBeVisible();
  await expect(page.getByRole("button", { name: "Open local profile" })).toContainText("Profile");
});
