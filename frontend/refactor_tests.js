const fs = require('fs');
const path = require('path');

const fileMap = {
  'constants.js': 'js/core/constants.js',
  'domRefs.js': 'js/core/domRefs.js',
  'navigation.js': 'js/core/navigation.js',
  'toast.js': 'js/core/toast.js',
  'handDetection.js': 'js/detection/handDetection.js',
  'singlePlayer.js': 'js/game/singlePlayer.js',
  'particles.js': 'js/game/particles.js',
  'multiplayer.js': 'js/multiplayer/multiplayer.js',
  'afkTimer.js': 'js/multiplayer/afkTimer.js',
  'rematchManager.js': 'js/multiplayer/rematchManager.js',
  'popupManager.js': 'js/multiplayer/popupManager.js',
  'roomLifecycleManager.js': 'js/multiplayer/roomLifecycleManager.js',
  'app.js': 'app.js'
};

const baseDir = __dirname;
const testsDir = path.join(baseDir, 'tests');

const testFiles = fs.readdirSync(testsDir).filter(f => f.endsWith('.js'));
const modifiedFiles = [];

for (const testFile of testFiles) {
  const filePath = path.join(testsDir, testFile);
  const content = fs.readFileSync(filePath, 'utf8');

  let newContent = content.replace(/from\s+['"]\.\.\/([^'"]+)['"]/g, (match, importedFile) => {
    if (fileMap[importedFile]) {
      // test files are in frontend/tests/, so we go up one level then to new path
      return `from '../${fileMap[importedFile]}'`;
    }
    return match;
  });

  if (newContent !== content) {
    modifiedFiles.push(testFile);
    fs.writeFileSync(filePath, newContent, 'utf8');
  }
}

console.log("Modified test files: " + modifiedFiles.join(', '));
