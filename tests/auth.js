// adapted from pineapple's e2e tests
const OIDC = {
  usernameInput: "id=identifierInput",
  nextInput: "id=postButton",
  passwordInput: "id=password",
  signInButton: "id=sign-in-button",
};

const loginPopup = async (page, popup, user, appUrl) => {
  await fillAuth(popup, user);
  return popup;
};

const loginRedirect = async (page, user, appUrl) => {
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

module.exports = { loginPopup, loginRedirect };
