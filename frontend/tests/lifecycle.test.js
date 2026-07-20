jest.setTimeout(30000);

describe('RoomLifecycleManager Unit Tests (Browser)', () => {
  beforeAll(async () => {
    // Navigate to the local server
    await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
  });

  it('Host leaves room -> removes room completely', async () => {
    const result = await page.evaluate(async () => {
      let removedRef = null;
      let updated = false;

      const mockUpdateFn = async () => { updated = true; };
      const mockRemoveFn = async (ref) => { removedRef = ref; };
      
      const manager = new window.RoomLifecycleManager(mockUpdateFn, mockRemoveFn, () => {}, () => {});
      await manager.leaveRoom('room_1', 'player1');
      
      return { removedRef, updated, p2WasJoined: manager.p2WasJoined };
    });

    expect(result.removedRef).toBe('room_1');
    expect(result.updated).toBe(false);
    expect(result.p2WasJoined).toBe(false);
  });

  it('Player2 leaves room -> updates room state', async () => {
    const result = await page.evaluate(async () => {
      let updatedData = null;
      let removed = false;

      const mockUpdateFn = async (ref, data) => { updatedData = data; };
      const mockRemoveFn = async () => { removed = true; };
      
      const manager = new window.RoomLifecycleManager(mockUpdateFn, mockRemoveFn, () => {}, () => {});
      await manager.leaveRoom('room_1', 'player2');
      
      return { updatedData, removed, p2WasJoined: manager.p2WasJoined };
    });

    expect(result.removed).toBe(false);
    expect(result.updatedData['players/player2/joined']).toBe(false);
    expect(result.updatedData['state']).toBe('WAITING');
    expect(result.p2WasJoined).toBe(false);
  });

  it('checkRoomStatus: snapshot does not exist triggers popup and dead cb', async () => {
    const result = await page.evaluate(async () => {
      let popupShown = false;
      let deadCbCalled = false;

      const mockShowPopup = (title, msg, cb) => {
        popupShown = true;
        cb(); // auto trigger
      };
      const mockOnDead = () => { deadCbCalled = true; };
      
      const manager = new window.RoomLifecycleManager(async()=>{}, async()=>{}, mockShowPopup, mockOnDead);
      
      const snapshotMock = { exists: () => false };
      const isDead = await manager.checkRoomStatus(snapshotMock, 'room_1', 'player2');
      
      return { isDead, popupShown, deadCbCalled };
    });

    expect(result.isDead).toBe(true);
    expect(result.popupShown).toBe(true);
    expect(result.deadCbCalled).toBe(true);
  });

  it('checkRoomStatus: Player2 kabur saat room aktif, memicu host menghapus room dan popup', async () => {
    const result = await page.evaluate(async () => {
      let popupShown = false;
      let deadCbCalled = false;
      let removedRef = null;

      const mockShowPopup = (title, msg, cb) => {
        popupShown = true;
        cb(); // auto trigger
      };
      const mockOnDead = () => { deadCbCalled = true; };
      const mockRemoveFn = async (ref) => { removedRef = ref; };
      
      const manager = new window.RoomLifecycleManager(async()=>{}, mockRemoveFn, mockShowPopup, mockOnDead);
      manager.p2WasJoined = true;
      
      const snapshotMock = {
        exists: () => true,
        val: () => ({ players: { player2: { joined: false } } })
      };
      const isDead = await manager.checkRoomStatus(snapshotMock, 'room_1', 'player1');
      
      return { isDead, popupShown, deadCbCalled, removedRef };
    });

    expect(result.isDead).toBe(true);
    expect(result.popupShown).toBe(true);
    expect(result.deadCbCalled).toBe(true);
    expect(result.removedRef).toBe('room_1');
  });
});

describe('PopupManager Unit Tests (Browser)', () => {
  beforeAll(async () => {
    await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
  });

  it('showPopup sets text content and adds active class', async () => {
    const result = await page.evaluate(() => {
      const overlay = document.createElement('div');
      const titleEl = document.createElement('h2');
      const msgEl = document.createElement('p');
      const btnEl = document.createElement('button');
      
      const manager = new window.PopupManager(overlay, titleEl, msgEl, btnEl);
      manager.showPopup('TEST TITLE', 'test msg', null);
      
      return {
        title: titleEl.textContent,
        msg: msgEl.textContent,
        hasClass: overlay.classList.contains('active')
      };
    });

    expect(result.title).toBe('TEST TITLE');
    expect(result.msg).toBe('test msg');
    expect(result.hasClass).toBe(true);
  });

  it('btnEl click triggers hidePopup and callback', async () => {
    const result = await page.evaluate(() => {
      const overlay = document.createElement('div');
      const titleEl = document.createElement('h2');
      const msgEl = document.createElement('p');
      const btnEl = document.createElement('button');
      
      const manager = new window.PopupManager(overlay, titleEl, msgEl, btnEl);
      
      let callbackTriggered = false;
      manager.showPopup('TITLE', 'MSG', () => { callbackTriggered = true; });
      
      // Simulate click
      btnEl.click();
      
      return {
        callbackTriggered,
        hasClass: overlay.classList.contains('active')
      };
    });

    expect(result.callbackTriggered).toBe(true);
    expect(result.hasClass).toBe(false);
  });
});
