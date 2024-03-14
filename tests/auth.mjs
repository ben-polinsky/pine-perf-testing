// adapted from pineapple's e2e tests
const OIDC = {
  usernameInput: "id=identifierInput",
  nextInput: "id=postButton",
  passwordInput: "id=password",
  signInButton: "id=sign-in-button",
};

export const loginPopup = async (page, user, appUrl) => {
  await page.goto(appUrl, { timeout: 120000 });
  const [popup] = await Promise.all([
    page.waitForEvent("popup", { timeout: 60000 }),
  ]);
  await popup.waitForLoadState();

  await fillAuth(popup, user);
  await popup.reload(); // for the test user, the popup fails to load the auth redirect for some reason, but the login succeeds. A reload cures all.
  await page.waitForURL(appUrl);
};

export const loginRedirect = async (page, user, appUrl) => {
  await page.goto(appUrl, { timeout: 120000 });
  await page.waitForLoadState();
  await fillAuth(page, user);
  await page.waitForURL(appUrl);
  await page.waitForSelector("iframe");
  const frame = await page.$("iframe");
  return frame.contentFrame();
};

async function fillAuth(page, user) {
  await page.fill(OIDC.usernameInput, user.username);
  await page.click(OIDC.nextInput, { delay: 500 });
  await page.fill(OIDC.passwordInput, user.password);
  await page.click(OIDC.signInButton, { delay: 500 });
}
