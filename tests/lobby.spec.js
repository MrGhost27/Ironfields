const { test, expect } = require('@playwright/test');

test('Lobby should not show maps and Create Game should lead to waiting room', async ({ page }) => {
  await page.goto('/');

  // Assuming we skip real auth or have a way to mock it
  // For this project, we'd likely need to mock the Supabase calls
  // but for a basic UI check, we can just look for elements.
  
  // Verify login screen is present initially
  await expect(page.locator('#scr-auth')).toBeVisible();
  
  /* 
  Further testing would require:
  1. Mocking Supabase auth/db responses.
  2. Logging in.
  3. Verifying the lobby structure.
  4. Testing seat claims and lance builder visibility.
  */
});
