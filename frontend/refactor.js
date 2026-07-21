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

// Create directories
const dirs = ['js/core', 'js/detection', 'js/game', 'js/multiplayer'];
dirs.forEach(d => {
  const dirPath = path.join(baseDir, d);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
});

// Read contents before moving
const contents = {};
for (const [filename, newRelPath] of Object.entries(fileMap)) {
  const oldPath = path.join(baseDir, filename);
  if (fs.existsSync(oldPath)) {
    contents[filename] = fs.readFileSync(oldPath, 'utf8');
  } else if (filename === 'app.js') {
    contents[filename] = fs.readFileSync(path.join(baseDir, filename), 'utf8');
  }
}

// Compute new relative path from one file to another
function getRelativePath(fromRelPath, toRelPath) {
  const fromDir = path.dirname(fromRelPath);
  let relPath = path.posix.relative(fromDir, toRelPath);
  if (!relPath.startsWith('.') && !relPath.startsWith('/')) {
    relPath = './' + relPath;
  }
  return relPath;
}

// Modify contents
const modifiedFiles = [];
for (const [filename, content] of Object.entries(contents)) {
  const fileNewRelPath = fileMap[filename];
  let newContent = content.replace(/from\s+['"](\.\/[^'"]+)['"]/g, (match, importPath) => {
    const importedFile = importPath.replace('./', '');
    if (fileMap[importedFile]) {
      const newImportPath = getRelativePath(fileNewRelPath, fileMap[importedFile]);
      return `from '${newImportPath}'`;
    }
    return match;
  });

  if (newContent !== content) {
    modifiedFiles.push(filename);
  }

  // Write to new path
  const newPath = path.join(baseDir, fileNewRelPath);
  fs.writeFileSync(newPath, newContent, 'utf8');
  
  // Delete old file if it was moved
  if (filename !== 'app.js' && fileNewRelPath !== filename) {
    fs.unlinkSync(path.join(baseDir, filename));
  }
}

console.log("Modified files: " + modifiedFiles.join(', '));
