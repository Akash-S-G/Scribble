import React, { useRef, useEffect, useState } from 'react';
import { io } from 'socket.io-client';

// Default export React component
export default function App() {
  const canvasRef = useRef(null);
  const socketRef = useRef(null);
  const drawingRef = useRef(false);
  const lastPosRef = useRef({ x: 0, y: 0 });
  const [connected, setConnected] = useState(false);
  const [room, setRoom] = useState('main');
  const [name, setName] = useState('Anon');
  const [color, setColor] = useState('#000000');
  const [brush, setBrush] = useState(4);

  useEffect(() => {
    const canvas = canvasRef.current;
    canvas.width = 800;
    canvas.height = 600;
    const ctx = canvas.getContext('2d');
    // make white background
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }, []);

  useEffect(() => {
    // cleanup on unmount
    return () => {
      if (socketRef.current) socketRef.current.disconnect();
    };
  }, []);

  function getPointerPos(e) {
    const rect = canvasRef.current.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
  }

  function drawLine(ctx, from, to, color, width) {
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
  }

  function startDrawing(e) {
    drawingRef.current = true;
    lastPosRef.current = getPointerPos(e);
  }
  function stopDrawing() {
    drawingRef.current = false;
  }

  function handleMove(e) {
    if (!drawingRef.current) return;
    const pos = getPointerPos(e);
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    // local draw
    drawLine(ctx, lastPosRef.current, pos, color, brush);

    // normalized coordinates (0..1) so different screen sizes work
    const payload = {
      room,
      from: { x: lastPosRef.current.x / canvas.width, y: lastPosRef.current.y / canvas.height },
      to: { x: pos.x / canvas.width, y: pos.y / canvas.height },
      color,
      width: brush,
      name,
    };

    // emit to server
    if (socketRef.current && connected) {
      socketRef.current.emit('drawing', payload);
    }

    lastPosRef.current = pos;
  }

  function connectSocket() {
    if (socketRef.current) socketRef.current.disconnect();
    // adjust this URL if your backend runs elsewhere
    const socket = io('http://localhost:5000', { transports: ['websocket'], });
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      socket.emit('join', { room, name });
    });

    socket.on('disconnect', () => {
      setConnected(false);
    });

    // listen for drawing events
    socket.on('drawing', (data) => {
      // draw incoming strokes
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      const from = { x: data.from.x * canvas.width, y: data.from.y * canvas.height };
      const to = { x: data.to.x * canvas.width, y: data.to.y * canvas.height };
      drawLine(ctx, from, to, data.color || '#000', data.width || 3);
    });

    // listen for clear events
    socket.on('clear', () => {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    });
  }

  async function handleJoin() {
    connectSocket();
  }

  function clearBoard() {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (socketRef.current && connected) {
      socketRef.current.emit('clear', { room });
    }
  }

  return (
    <div style={{ fontFamily: 'Arial, sans-serif', padding: 12 }}>
      <h1>DrawTogether</h1>
      <div style={{ marginBottom: 8 }}>
        <label>Room: <input value={room} onChange={e => setRoom(e.target.value)} /></label>
        <label style={{ marginLeft: 8 }}>Name: <input value={name} onChange={e => setName(e.target.value)} /></label>
        <button style={{ marginLeft: 8 }} onClick={handleJoin} disabled={connected}>Join</button>
        <button style={{ marginLeft: 8 }} onClick={() => { if (socketRef.current) socketRef.current.disconnect(); setConnected(false); }}>Leave</button>
      </div>

      <div style={{ display: 'flex', gap: 12 }}>
        <div>
          <canvas
            ref={canvasRef}
            style={{ border: '1px solid #ccc', touchAction: 'none' }}
            onMouseDown={startDrawing}
            onMouseUp={stopDrawing}
            onMouseOut={stopDrawing}
            onMouseMove={handleMove}
            onTouchStart={startDrawing}
            onTouchEnd={stopDrawing}
            onTouchCancel={stopDrawing}
            onTouchMove={handleMove}
          />
          <div style={{ marginTop: 8 }}>
            <button onClick={clearBoard}>Clear (all)</button>
          </div>
        </div>

        <div style={{ minWidth: 180 }}>
          <div>Connected: {connected ? 'Yes' : 'No'}</div>
          <div style={{ marginTop: 8 }}>
            <label>Color: <input type="color" value={color} onChange={e => setColor(e.target.value)} /></label>
          </div>
          <div style={{ marginTop: 8 }}>
            <label>Brush: <input type="range" min="1" max="40" value={brush} onChange={e => setBrush(Number(e.target.value))} /></label>
            <div>{brush}px</div>
          </div>
          <div style={{ marginTop: 12 }}>
            <b>Controls</b>
            <div>Draw with mouse or touch. Join same room to draw together.</div>
          </div>
        </div>
      </div>
    </div>
  );
}