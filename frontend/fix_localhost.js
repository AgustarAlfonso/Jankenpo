const fs = require('fs');
const path = require('path');

const testsDir = path.join(__dirname, 'tests');
const testFiles = fs.readdirSync(testsDir).filter(f => f.endsWith('.js'));

for (const testFile of testFiles) {
  const filePath = path.join(testsDir, testFile);
  let content = fs.readFileSync(filePath, 'utf8');
  content = content.replace(/http:\/\/localhost:3000/g, 'http://127.0.0.1:3000');
  fs.writeFileSync(filePath, content, 'utf8');
}

console.log("Updated localhost to 127.0.0.1 in tests.");
