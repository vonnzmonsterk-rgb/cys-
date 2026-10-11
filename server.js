// Tiny WebSocket relay for 1v1 online matches. It only pairs two players by a 4-letter room code
// and forwards messages between them. It does not know anything about the game.
const http = require('http');
const { WebSocketServer } = require('ws');
const rooms = new Map();
const server = http.createServer((req, res) => { res.writeHead(200, { 'content-type': 'text/plain' }); res.end('CYS relay is running'); });
const wss = new WebSocketServer({ server, maxPayload: 64 * 1024 });
const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const newCode = () => { let s = ''; for (let i = 0; i < 4; i++) s += ALPHA[Math.random() * ALPHA.length | 0]; return s; };
const send = (ws, o) => { if (ws && ws.readyState === 1) ws.send(JSON.stringify(o)); };

wss.on('connection', ws => {
  ws.alive = true; ws.on('pong', () => { ws.alive = true; });
  ws.on('message', buf => {
    let m; try { m = JSON.parse(buf); } catch (e) { return; }
    if (m.t === 'host') {
      let c; do { c = newCode(); } while (rooms.has(c));
      rooms.set(c, { host: ws, guest: null }); ws.room = c; ws.role = 'host'; send(ws, { t: 'hosted', room: c });
    } else if (m.t === 'join') {
      const c = String(m.room || '').toUpperCase(), r = rooms.get(c);
      if (!r || r.guest) return send(ws, { t: 'error', msg: 'Room not found or already full' });
      r.guest = ws; ws.room = c; ws.role = 'guest'; send(r.host, { t: 'peer' }); send(ws, { t: 'joined' });
    } else {
      const r = rooms.get(ws.room); if (!r) return;
      const peer = ws.role === 'host' ? r.guest : r.host;
      if (peer && peer.readyState === 1) peer.send(buf.toString());
    }
  });
  ws.on('close', () => {
    const r = rooms.get(ws.room); if (!r) return;
    const peer = ws.role === 'host' ? r.guest : r.host; send(peer, { t: 'left' });
    if (ws.role === 'host') rooms.delete(ws.room); else r.guest = null;
  });
});
setInterval(() => wss.clients.forEach(ws => { if (!ws.alive) return ws.terminate(); ws.alive = false; ws.ping(); }), 30000);
server.listen(process.env.PORT || 8080, () => console.log('CYS relay listening on', process.env.PORT || 8080));
