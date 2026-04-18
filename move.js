const fs = require('fs');

fs.cpSync('temp_app', '.', { recursive: true, force: true });
fs.rmSync('temp_app', { recursive: true, force: true });
console.log('Done!');
