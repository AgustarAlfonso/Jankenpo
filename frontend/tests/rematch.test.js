jest.setTimeout(30000);

describe('RematchManager Unit Tests (Browser)', () => {
  beforeAll(async () => {
    // Navigate to the local server
    await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
  });

  it('should call updateFirebaseFn with correct payload when requestRematch is called', async () => {
    const result = await page.evaluate(async () => {
      let updatedData = null;
      let updatedRef = null;
      
      const mockUpdateFn = async (ref, data) => {
        updatedRef = ref;
        updatedData = data;
      };
      const mockToastFn = (msg) => {};
      
      const rematch = new window.RematchManager(mockUpdateFn, mockToastFn);
      await rematch.requestRematch('room_123', 'player2');
      
      return { ref: updatedRef, data: updatedData };
    });
    
    expect(result.ref).toBe('room_123');
    expect(result.data['players/player2/play_again']).toBe(true);
  });

  it('should show toast ONLY ONCE when opponent requests rematch', async () => {
    const result = await page.evaluate(async () => {
      let toastMessages = [];
      const mockUpdateFn = async (ref, data) => {};
      const mockToastFn = (msg) => { toastMessages.push(msg); };
      
      const rematch = new window.RematchManager(mockUpdateFn, mockToastFn);
      
      const roomState = {
        players: {
          player1: { play_again: true }, // opponent wants to play again
          player2: { play_again: false } // local player hasn't decided
        }
      };

      // Call it multiple times, simulating multiple Firebase updates
      await rematch.checkRematchState(roomState, 'room_123', 'player2');
      await rematch.checkRematchState(roomState, 'room_123', 'player2');
      await rematch.checkRematchState(roomState, 'room_123', 'player2');
      
      return toastMessages;
    });

    expect(result.length).toBe(1);
    expect(result[0]).toContain('Lawan meminta main lagi');
  });

  it('should reset game state ONLY if local slot is player1 (Host) and BOTH agreed', async () => {
    const result = await page.evaluate(async () => {
      let updateCalls = 0;
      let lastData = null;
      const mockUpdateFn = async (ref, data) => {
        updateCalls++;
        lastData = data;
      };
      
      const rematch = new window.RematchManager(mockUpdateFn, () => {});
      
      const roomState = {
        players: {
          player1: { play_again: true, gesture: 'BATU', submitted: true },
          player2: { play_again: true, gesture: 'GUNTING', submitted: true }
        },
        state: 'RESULT',
        round_result: 'player1'
      };

      // Simulating from Player 2 perspective
      await rematch.checkRematchState(roomState, 'room_123', 'player2');
      const p2Calls = updateCalls; // Should be 0, player 2 doesn't trigger reset

      // Simulating from Player 1 (Host) perspective
      await rematch.checkRematchState(roomState, 'room_123', 'player1');
      const p1Calls = updateCalls; // Should be 1
      
      return { p2Calls, p1Calls, lastData };
    });

    expect(result.p2Calls).toBe(0); // Player 2 shouldn't perform the reset
    expect(result.p1Calls).toBe(1); // Player 1 (Host) performs the reset
    expect(result.lastData).toMatchObject({
      'state': 'READY',
      'round_result': null,
      'players/player1/play_again': false,
      'players/player2/play_again': false
    });
  });

  it('should not reset toast until explicitly asked to', async () => {
    const result = await page.evaluate(async () => {
      let toastCount = 0;
      const rematch = new window.RematchManager(async () => {}, () => { toastCount++; });
      
      const roomState = {
        players: {
          player1: { play_again: true },
          player2: { play_again: false }
        }
      };

      await rematch.checkRematchState(roomState, 'ref', 'player2');
      const countAfterFirstCheck = toastCount; // Should be 1
      
      rematch.resetToast();
      
      await rematch.checkRematchState(roomState, 'ref', 'player2');
      const countAfterReset = toastCount; // Should be 2 now because flag was reset
      
      return { countAfterFirstCheck, countAfterReset };
    });

    expect(result.countAfterFirstCheck).toBe(1);
    expect(result.countAfterReset).toBe(2);
  });
});
