const http = require('http');
const WebSocket = require('ws');
const PORT = process.env.PORT || 3000;
const server = http.createServer((req,res) => {
  if (req.url === '/health') { res.writeHead(200, {'content-type':'application/json'}); return res.end(JSON.stringify({ok:true,game:'Mar das Frutas'})); }
  res.writeHead(200, {'content-type':'text/plain; charset=utf-8'});
  res.end('Servidor online do Mar das Frutas. Endpoint WebSocket ativo.');
});
const wss = new WebSocket.Server({ server, maxPayload: 4096 });
const rooms = new Map();
const safeName = v => String(v || 'Pirata').replace(/[<>]/g,'').slice(0,16) || 'Pirata';
const send = (ws,obj) => { if(ws.readyState===WebSocket.OPEN) ws.send(JSON.stringify(obj)); };
const broadcast = (room,obj,except=null) => { for(const p of rooms.get(room)?.values() || []) if(p.ws!==except) send(p.ws,obj); };
wss.on('connection', ws => {
  ws.meta = {id:Math.random().toString(36).slice(2,11),room:null,name:'Pirata',state:{x:0,y:0,z:0,ry:0,mv:0,run:0},lastState:0};
  ws.on('message', raw => {
    let d; try { d=JSON.parse(raw.toString()); } catch { return send(ws,{type:'error',message:'Mensagem inválida'}); }
    if(d.type==='join'){
      const room=String(d.room||'mar-das-frutas').slice(0,40);
      if(ws.meta.room)return;
      if(!rooms.has(room))rooms.set(room,new Map());
      const members=rooms.get(room);
      if(members.size>=80)return send(ws,{type:'error',message:'Sala cheia (limite 80)'});
      ws.meta.room=room;ws.meta.name=safeName(d.name);
      const players=[...members.values()].map(p=>({id:p.id,name:p.name,...p.state}));
      members.set(ws.meta.id,{id:ws.meta.id,name:ws.meta.name,ws,state:ws.meta.state});
      send(ws,{type:'welcome',id:ws.meta.id,players});
      broadcast(room,{type:'playerJoined',player:{id:ws.meta.id,name:ws.meta.name,...ws.meta.state}},ws);
      return;
    }
    const room=ws.meta.room, members=room&&rooms.get(room), me=members&&members.get(ws.meta.id);
    if(!me)return;
    if(d.type==='state'){
      const now=Date.now(); if(now-ws.meta.lastState<65)return; ws.meta.lastState=now;
      const num=(v,lo,hi)=>Number.isFinite(Number(v))?Math.max(lo,Math.min(hi,Number(v))):0;
      me.state={x:num(d.x,-1000,1000),y:num(d.y,0,200),z:num(d.z,-1000,1000),ry:num(d.ry,-100,100),mv:num(d.mv,0,1),run:d.run?1:0};
      broadcast(room,{type:'state',player:{id:me.id,name:me.name,...me.state}},ws);
    } else if(d.type==='chat'){
      const text=String(d.text||'').replace(/[<>]/g,'').trim().slice(0,120);
      if(!text)return;
      broadcast(room,{type:'chat',id:me.id,name:me.name,text});
    }
  });
  ws.on('close',()=>{
    const room=ws.meta.room, members=room&&rooms.get(room);
    if(members){members.delete(ws.meta.id);broadcast(room,{type:'playerLeft',id:ws.meta.id});if(!members.size)rooms.delete(room);}
  });
});
server.listen(PORT,'0.0.0.0',()=>console.log(`Mar das Frutas online na porta ${PORT}`));
