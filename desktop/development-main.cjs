// Development-only launcher: never use the installed game's personal save folder.
// The packaged game continues to use the original, unchanged desktop-app/main.cjs.
const { app } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

const developmentData = path.resolve(__dirname, '..', '.build', 'development-appdata');
fs.mkdirSync(developmentData, { recursive: true });
app.setPath('appData', developmentData);
// Keep development taskbar/jump-list registration separate as well.
const setAppUserModelId = app.setAppUserModelId.bind(app);
app.setAppUserModelId = (id) => setAppUserModelId(`${id}.development`);
require('../desktop-app/main.cjs');
