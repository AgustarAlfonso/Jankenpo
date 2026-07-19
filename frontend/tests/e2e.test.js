jest.setTimeout(30000);

describe('JankenpoVision E2E Flows', () => {
  beforeAll(async () => {
    // Navigate to the local server
    await page.goto('http://localhost:8000', { waitUntil: 'domcontentloaded' });
    // Ensure app is initialized
    await new Promise(r => setTimeout(r, 1000));
  });

  it('should display the home page correctly', async () => {
    const titleText = await page.$eval('.hero-title', el => el.innerText);
    expect(titleText).toContain('Jankenpo');
  });

  it('should navigate to HowTo page when clicking Mulai Bermain', async () => {
    await page.click('#btnStartHome');
    
    // Wait for page transition
    await page.waitForFunction(() => {
      const el = document.querySelector('#page-howto');
      return el && el.classList.contains('active');
    }, { timeout: 5000 });

    const howtoTitle = await page.$eval('#page-howto .page-title', el => el.innerText);
    expect(howtoTitle).toBe('Cara Bermain');
  });

  it('should navigate to Mode page when clicking Lanjut Pilih Mode', async () => {
    await page.click('#btnNextHowto');
    
    await page.waitForFunction(() => {
      const el = document.querySelector('#page-mode');
      return el && el.classList.contains('active');
    }, { timeout: 5000 });

    const modeTitle = await page.$eval('#page-mode .page-title', el => el.innerText);
    expect(modeTitle).toBe('Pilih Mode');
  });

  it('should select Webcam Mode and navigate to Game page', async () => {
    await page.click('button[data-mode="webcam"]');
    
    await page.waitForFunction(() => {
      const el = document.querySelector('#page-game');
      return el && el.classList.contains('active');
    }, { timeout: 5000 });

    const isWebcamVisible = await page.$eval('#gameModeWebcam', el => getComputedStyle(el).display !== 'none');
    expect(isWebcamVisible).toBe(true);
  });
});
