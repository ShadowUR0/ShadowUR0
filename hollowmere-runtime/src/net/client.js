export class OnlineClient {
    ws = null;
    myId = '';
    sendAccum = 0;
    remotes = new Map();
    connected = false;
    room = '';
    onRoster = () => { };
    onStatus = () => { };
    async connect(url, room, name, classId) {
        this.disconnect();
        const cleanRoom = room.trim().replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 20) || 'mere';
        const cleanName = name.trim().replace(/[<>]/g, '').slice(0, 18) || 'Wanderer';
        this.room = cleanRoom;
        await new Promise((resolve, reject) => {
            let settled = false;
            let timer = 0;
            const ws = new WebSocket(url);
            this.ws = ws;
            const fail = (reason) => {
                if (settled)
                    return;
                settled = true;
                clearTimeout(timer);
                if (this.ws === ws) {
                    this.ws = null;
                    this.connected = false;
                    this.myId = '';
                    this.remotes.clear();
                    this.onRoster([]);
                    this.onStatus('OFFLINE');
                }
                try {
                    ws.close();
                }
                catch { }
                reject(new Error(reason));
            };
            timer = window.setTimeout(() => fail('Connection timed out'), 6000);
            ws.addEventListener('open', () => {
                if (this.ws !== ws)
                    return;
                ws.send(JSON.stringify({ t: 'join', room: cleanRoom, name: cleanName, classId }));
            });
            ws.addEventListener('message', (event) => {
                if (this.ws !== ws)
                    return;
                let msg;
                try {
                    msg = JSON.parse(String(event.data));
                }
                catch {
                    return;
                }
                if (msg.t === 'welcome') {
                    this.myId = msg.id;
                    this.connected = true;
                    this.onStatus(`ONLINE · ${msg.room}`);
                    if (!settled) {
                        settled = true;
                        clearTimeout(timer);
                        resolve();
                    }
                }
                else if (msg.t === 'roster') {
                    this.remotes.clear();
                    for (const p of msg.players)
                        if (p.id !== this.myId)
                            this.remotes.set(p.id, p);
                    this.onRoster([...this.remotes.values()]);
                }
                else if (msg.t === 'error') {
                    fail(msg.message);
                }
            });
            ws.addEventListener('error', () => {
                if (this.ws === ws)
                    fail('Could not reach the Hollowmere room server');
            });
            ws.addEventListener('close', () => {
                clearTimeout(timer);
                if (this.ws !== ws)
                    return;
                this.ws = null;
                this.connected = false;
                this.myId = '';
                this.remotes.clear();
                this.onRoster([]);
                this.onStatus('OFFLINE');
                if (!settled) {
                    settled = true;
                    reject(new Error('Connection closed before joining'));
                }
            });
        });
    }
    tick(dt, state) {
        if (!this.connected || !this.ws || this.ws.readyState !== WebSocket.OPEN)
            return;
        this.sendAccum += dt;
        if (this.sendAccum < 0.08)
            return;
        this.sendAccum = 0;
        this.ws.send(JSON.stringify({ t: 'state', ...state }));
    }
    disconnect() {
        const ws = this.ws;
        this.ws = null;
        this.connected = false;
        this.myId = '';
        this.sendAccum = 0;
        this.remotes.clear();
        this.onRoster([]);
        if (ws) {
            try {
                ws.close();
            }
            catch { }
        }
    }
}
