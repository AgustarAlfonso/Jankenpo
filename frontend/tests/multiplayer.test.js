jest.setTimeout(120000); // 120 seconds for Puppeteer E2E (needs to download mediapipe models on 2 pages)network operations

describe('JankenpoVision Multiplayer Lobby E2E', () => {
  let page1;
  let page2;

  beforeAll(async () => {
    // Create two separate pages for two players
    page1 = await browser.newPage();
    page2 = await browser.newPage();
    
    // Forward browser console to Node console to see Firebase errors
    page1.on('console', msg => console.log('PAGE 1 LOG:', msg.text()));
    page2.on('console', msg => console.log('PAGE 2 LOG:', msg.text()));
  });

  afterAll(async () => {
    await page1.close();
    await page2.close();
  });

  it('should allow Player 1 to create a room and Player 2 to join', async () => {
    // === PLAYER 1 ===
    console.log('Player 1: Navigating to local server...');
    await page1.goto('http://127.0.0.1:3000', { waitUntil: 'domcontentloaded' });
    await new Promise(r => setTimeout(r, 1000));
    
    console.log('Player 1: Navigating to Mode Selection...');
    await page1.evaluate(() => document.querySelector('#btnStartHome').click());
    await new Promise(r => setTimeout(r, 600)); // wait for transition
    
    await page1.evaluate(() => document.querySelector('#btnNextHowto').click());
    await new Promise(r => setTimeout(r, 600)); // wait for transition
    
    console.log('Player 1: Clicking Multiplayer Mode...');
    await page1.evaluate(() => document.querySelector('button[data-mode="multiplayer"]').click());
    await new Promise(r => setTimeout(r, 600)); // wait for transition
    
    console.log('Player 1: Creating Room...');
    await page1.evaluate(() => document.querySelector('#mpPlayerNameInput').value = '');
    await page1.type('#mpPlayerNameInput', 'Player Alpha');
    await page1.evaluate(() => document.querySelector('#btnCreateRoom').click());
    
    console.log('Player 1: Waiting for room creation UI...');
    await new Promise(r => setTimeout(r, 3000)); // wait for Firebase write and UI update
    
    console.log('Player 1: Extracting Room Code...');
    const roomCode = await page1.$eval('#roomCodeVal', el => el.innerText);
    expect(roomCode.length).toBe(6);
    
    // === PLAYER 2 ===
    console.log(`Player 2: Navigating to local server...`);
    await page2.goto(`http://127.0.0.1:3000`, { waitUntil: 'domcontentloaded' });
    
    console.log('Player 2: Navigating to Mode Selection...');
    await page2.evaluate(() => document.querySelector('#btnStartHome').click());
    await new Promise(r => setTimeout(r, 600)); // wait for transition
    
    await page2.evaluate(() => document.querySelector('#btnNextHowto').click());
    await new Promise(r => setTimeout(r, 600)); // wait for transition
    
    console.log('Player 2: Clicking Multiplayer Mode...');
    await page2.evaluate(() => document.querySelector('button[data-mode="multiplayer"]').click());
    await new Promise(r => setTimeout(r, 600)); // wait for transition
    
    console.log('Player 2: Verifying Lobby Setup...');
    const isLobbySetup = await page2.evaluate(() => document.querySelector('#page-mp-lobby').classList.contains('active'));
    expect(isLobbySetup).toBe(true);
    
    console.log('Player 2: Entering Room Code and Joining...');
    await page2.type('#mpRoomCodeInput', roomCode);
    await page2.evaluate(() => document.querySelector('#mpPlayerNameInput').value = '');
    await page2.type('#mpPlayerNameInput', 'Player Beta');
    await page2.evaluate(() => document.querySelector('#btnJoinRoom').click());
    
    console.log('Players: Waiting for Game Start transition...');
    // When state goes READY, app.js waits 1.5s then calls goTo(5)
    await new Promise(r => setTimeout(r, 3000));
    
    console.log('Players: Verifying Score labels...');
    const p1ScoreLabel = await page1.$eval('#mpScoreP1Label', el => el.innerText);
    const p2ScoreLabel = await page1.$eval('#mpScoreP2Label', el => el.innerText);
    
    expect(p1ScoreLabel).toContain('Player Alpha');
    expect(p2ScoreLabel).toContain('Player Beta');
    console.log('Test completed successfully!');
  });
});
