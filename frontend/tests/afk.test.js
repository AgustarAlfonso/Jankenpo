jest.setTimeout(30000);

describe('AFKManager Unit Tests (Browser)', () => {
  beforeAll(async () => {
    // Navigate to the local server
    await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
  });

  it('should timeout after given duration', async () => {
    const result = await page.evaluate(async () => {
      return new Promise(resolve => {
        // Use a short 500ms timeout for testing
        const afk = new window.AFKManager(500, () => {
          resolve('TIMEOUT');
        });
        afk.reset();
      });
    });
    expect(result).toBe('TIMEOUT');
  });

  it('should not timeout if clear is called', async () => {
    const result = await page.evaluate(async () => {
      return new Promise(resolve => {
        let timedOut = false;
        const afk = new window.AFKManager(500, () => {
          timedOut = true;
        });
        
        afk.reset();
        
        // Clear before timeout
        setTimeout(() => afk.clear(), 100);
        
        // Resolve after timeout should have passed
        setTimeout(() => {
          resolve(timedOut);
        }, 1000);
      });
    });
    expect(result).toBe(false); // Should be false because it was cleared
  });

  it('should reset timer if reset is called before timeout', async () => {
    const result = await page.evaluate(async () => {
      return new Promise(resolve => {
        let callCount = 0;
        const afk = new window.AFKManager(600, () => {
          callCount++;
        });
        
        afk.reset();
        
        // Reset at 300ms, effectively pushing the timeout to 900ms
        setTimeout(() => afk.reset(), 300);
        
        // Check at 700ms (original 600ms should have passed, but we reset it)
        setTimeout(() => {
          if (callCount > 0) resolve('FAILED_EARLY');
        }, 700);

        // Check at 1100ms (new timeout 900ms should have passed)
        setTimeout(() => {
          resolve(callCount === 1 ? 'SUCCESS' : 'FAILED_COUNT');
        }, 1100);
      });
    });
    expect(result).toBe('SUCCESS');
  });
});
