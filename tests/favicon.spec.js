import { expect, test } from "@playwright/test";

const entries = ["/", "/go/receipt/", "/go/ritual/", "/go/privacy/"];

test("serves /favicon.ico for browsers that request it by default", async ({ request }) => {
  const response = await request.get("/favicon.ico");

  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toMatch(/icon/);
});

for (const path of entries) {
  test(`${path} links an SVG favicon that resolves`, async ({ page, request }) => {
    await page.goto(path);

    const href = await page.locator('link[rel="icon"][type="image/svg+xml"]').getAttribute("href");
    const response = await request.get(href);
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toMatch(/image\/svg\+xml/);
  });
}
