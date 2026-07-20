const gestures = ['BATU', 'GUNTING', 'KERTAS', 'TIDAK_TERDETEKSI'];
let failures = 0;

console.log("=== UNIT TEST HASIL LOGIKA JANKENPO ===\n");

for (let p1 of gestures) {
  for (let p2 of gestures) {
    // Host logic
    let result = '';
    if (p1 === p2) {
      result = 'SERI';
    } else if (p1 === 'TIDAK_TERDETEKSI') {
      result = 'player2';
    } else if (p2 === 'TIDAK_TERDETEKSI') {
      result = 'player1';
    } else if (
      (p1 === 'BATU' && p2 === 'GUNTING') ||
      (p1 === 'GUNTING' && p2 === 'KERTAS') ||
      (p1 === 'KERTAS' && p2 === 'BATU')
    ) {
      result = 'player1';
    } else {
      result = 'player2';
    }

    // Client UI logic simulation for Player 1
    let p1_title = '';
    let p1_class = '';
    let p1_mySlot = 'player1';
    let p1_myName = 'P1_Name';
    let p1_oppName = 'P2_Name';

    if (result === 'SERI') {
      p1_title = 'SERI!';
      p1_class = 'result-title draw';
    } else {
      const winnerName = (result === p1_mySlot) ? p1_myName : p1_oppName;
      p1_title = winnerName + ' MENANG!';
      p1_class = (result === p1_mySlot) ? 'result-title win' : 'result-title lose';
    }

    // Client UI logic simulation for Player 2
    let p2_title = '';
    let p2_class = '';
    let p2_mySlot = 'player2';
    let p2_myName = 'P2_Name';
    let p2_oppName = 'P1_Name';

    if (result === 'SERI') {
      p2_title = 'SERI!';
      p2_class = 'result-title draw';
    } else {
      const winnerName = (result === p2_mySlot) ? p2_myName : p2_oppName;
      p2_title = winnerName + ' MENANG!';
      p2_class = (result === p2_mySlot) ? 'result-title win' : 'result-title lose';
    }

    console.log(`[P1: ${p1} vs P2: ${p2}] -> Database: ${result}`);
    console.log(`  Layar P1: "${p1_title}" (warna: ${p1_class.includes('win') ? 'hijau' : p1_class.includes('lose') ? 'merah' : 'kuning'})`);
    console.log(`  Layar P2: "${p2_title}" (warna: ${p2_class.includes('win') ? 'hijau' : p2_class.includes('lose') ? 'merah' : 'kuning'})`);
    console.log("-");
  }
}
