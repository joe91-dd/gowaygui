'use strict';
// One origin for the game, account APIs, raid rooms and world boss APIs.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const game = path.resolve(__dirname, '..');
const root = path.resolve(game, process.argv[2] || process.env.GAME_ROOT || 'build/web-mobile');
if (!fs.existsSync(path.join(root, 'index.html'))) {
  console.error('Missing Cocos web export: ' + root + '\nRun npm run build:web first, or npm run serve -- build/<export-name>.');
  process.exit(1);
}
const compile = spawnSync(process.execPath, [require.resolve('typescript/lib/tsc.js'), '-p', path.join(game, 'tsconfig.server.json')], { cwd: game, stdio: 'inherit' });
if (compile.error) throw compile.error;
if (compile.status !== 0) process.exit(compile.status || 1);
process.env.GOWAYGUI_ROOM_CORE = path.join(game, '.server-build/core');
const { createLobbyServer } = require('../server/lobby-server.cjs');
const port = Number(process.env.PORT || 7658), host = process.env.HOST || '127.0.0.1';
const app = createLobbyServer({ root, dataFile: process.env.ROOM_DATA || path.join(game, 'server/data/rooms.json'), adminToken: process.env.ROOM_ADMIN_TOKEN });
app.server.on('error', error => { console.error(error.message); process.exit(1); });
app.server.listen(port, host, () => console.log(`Game and room service: http://${host}:${port}/?preview=all-maps&all-modes=1&balance=coast&map=0`));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => app.server.close(() => process.exit(0)));
