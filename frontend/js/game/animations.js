export function playRevealAnimation() {
  // Animations removed so result page appears instantly
}

export function playArenaRevealAnimation(isMultiplayer = false) {
  if (typeof anime === 'undefined') {
    return;
  }

  // 1. Gather data from the DOM
  const playerEmojiEl = document.querySelector(isMultiplayer ? '#mpPlayerTag span:first-child' : '#playerTag span:first-child');
  const oppEmojiEl = document.querySelector(isMultiplayer ? '#mpOpponentShow .ai-emoji' : '#aiShow .ai-emoji');
  const vsResultEl = document.getElementById(isMultiplayer ? 'mpVsResult' : 'vsResult');

  const playerEmoji = playerEmojiEl ? playerEmojiEl.innerText : '✊';
  const oppEmoji = oppEmojiEl ? oppEmojiEl.innerText : '🖐️';
  const resultText = vsResultEl ? vsResultEl.innerText : 'MENANG!';
  
  // Extract result class (win/lose/draw)
  let resultClass = 'win';
  if (vsResultEl) {
    if (vsResultEl.classList.contains('lose')) resultClass = 'lose';
    if (vsResultEl.classList.contains('draw')) resultClass = 'draw';
  }

  // 2. Populate the Cut-In Overlay
  document.getElementById('cutinLeftEmoji').innerText = playerEmoji;
  document.getElementById('cutinRightEmoji').innerText = oppEmoji;
  document.getElementById('cutinRightName').innerText = isMultiplayer ? 'LAWAN' : 'AI';
  
  const banner = document.getElementById('cutinVsBanner');
  banner.innerText = resultText;
  banner.className = `cutin-vs-banner ${resultClass}`;

  // 3. Initial Reset
  const overlay = document.getElementById('cutinOverlay');
  
  // MUST append to body so that the viewport is the containing block, 
  // avoiding clipping bugs from .page overflow settings.
  document.body.appendChild(overlay); 
  
  anime.set(overlay, { opacity: 1, zIndex: 999999 });
  anime.set('#cutinLeft', { translateX: '-100%' }); // Out of screen left
  anime.set('#cutinRight', { translateX: '100%' }); // Out of screen right
  anime.set('#cutinVsBanner', { scale: 3, opacity: 0, rotate: '-10deg' });

  // 4. Persona Style Animation Timeline
  const tl = anime.timeline({
    easing: 'easeOutExpo',
  });

  // A. Sides slash in diagonally
  tl.add({
    targets: ['#cutinLeft', '#cutinRight'],
    translateX: '0%',
    duration: 800,
    easing: 'easeOutQuart'
  })
  // B. The result banner slams down in the middle
  .add({
    targets: '#cutinVsBanner',
    scale: 1,
    opacity: 1,
    rotate: '-10deg',
    duration: 400,
    easing: 'easeInCubic'
  }, '-=300')
  // C. Screen shake impact for the banner
  .add({
    targets: '#cutinVsBanner',
    translateX: [
      { value: 15, duration: 40, easing: 'easeInOutQuad' },
      { value: -15, duration: 40, easing: 'easeInOutQuad' },
      { value: 10, duration: 40, easing: 'easeInOutQuad' },
      { value: -10, duration: 40, easing: 'easeInOutQuad' },
      { value: 0, duration: 40, easing: 'easeInOutQuad' }
    ]
  }, '-=100')
  // D. Wait a bit, then slide out so the result page can take over
  .add({
    targets: '#cutinOverlay',
    opacity: 0,
    duration: 400,
    easing: 'easeInQuad'
  }, '+=1500');
}
