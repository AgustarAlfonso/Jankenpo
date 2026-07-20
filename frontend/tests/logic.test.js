jest.setTimeout(30000);

describe('JankenpoVision Core Logic Tests', () => {
  beforeAll(async () => {
    // Navigate to the local server
    await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
  });

  it('should detect BATU correctly', async () => {
    const result = await page.evaluate(() => {
      // Mock landmarks for BATU (fist): all tips are below their MCP joints
      // In Y axis, higher number means lower on screen. So tip.y > mcp.y means finger is down/folded.
      const mockLandmarks = [
        [
          { x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0.5, y: 0 }, { x: 0.6, y: 0 }, { x: 0.7, y: 0 }, // Thumb (x > x of joint means folded if right hand)
          { x: 0, y: 0.5 }, { x: 0, y: 0.6 }, { x: 0, y: 0.7 }, { x: 0, y: 0.8 }, // Index (mcp=0.5, tip=0.8, tip > mcp -> folded down)
          { x: 0, y: 0.5 }, { x: 0, y: 0.6 }, { x: 0, y: 0.7 }, { x: 0, y: 0.8 }, // Middle
          { x: 0, y: 0.5 }, { x: 0, y: 0.6 }, { x: 0, y: 0.7 }, { x: 0, y: 0.8 }, // Ring
          { x: 0, y: 0.5 }, { x: 0, y: 0.6 }, { x: 0, y: 0.7 }, { x: 0, y: 0.8 }  // Pinky
        ]
      ];
      return window.detectGestureLocal(mockLandmarks);
    });
    expect(result).toBe('BATU');
  });

  it('should detect KERTAS correctly', async () => {
    const result = await page.evaluate(() => {
      // Mock landmarks for KERTAS (open hand): all tips are ABOVE their MCP joints
      // tip.y < mcp.y means finger is up
      const mockLandmarks = [
        [
          { x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0.5, y: 0 }, { x: 0.4, y: 0 }, { x: 0.3, y: 0 }, // Thumb (x < joint)
          { x: 0, y: 0.5 }, { x: 0, y: 0.4 }, { x: 0, y: 0.3 }, { x: 0, y: 0.2 }, // Index (mcp=0.5, tip=0.2, tip < mcp -> up)
          { x: 0, y: 0.5 }, { x: 0, y: 0.4 }, { x: 0, y: 0.3 }, { x: 0, y: 0.2 }, // Middle
          { x: 0, y: 0.5 }, { x: 0, y: 0.4 }, { x: 0, y: 0.3 }, { x: 0, y: 0.2 }, // Ring
          { x: 0, y: 0.5 }, { x: 0, y: 0.4 }, { x: 0, y: 0.3 }, { x: 0, y: 0.2 }  // Pinky
        ]
      ];
      return window.detectGestureLocal(mockLandmarks);
    });
    expect(result).toBe('KERTAS');
  });

  it('should handle TIDAK_TERDETEKSI for empty landmarks', async () => {
    const result = await page.evaluate(() => {
      return window.detectGestureLocal([]);
    });
    expect(result).toBe('TIDAK_TERDETEKSI');
  });
});
