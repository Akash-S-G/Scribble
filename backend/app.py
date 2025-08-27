from flask import Flask
from flask_socketio import SocketIO, join_room, leave_room, emit

app = Flask(__name__)
# Use eventlet or gevent in production; for dev the default works but install eventlet for best results.
socketio = SocketIO(app, cors_allowed_origins='*')

@socketio.on('connect')
def handle_connect():
    print('client connected')

@socketio.on('disconnect')
def handle_disconnect():
    print('client disconnected')

@socketio.on('join')
def handle_join(data):
    room = data.get('room', 'main')
    name = data.get('name', 'Anon')
    join_room(room)
    emit('system', {'msg': f'{name} joined {room}'}, to=room)
    print(f'{name} joined {room}')

@socketio.on('leave')
def handle_leave(data):
    room = data.get('room', 'main')
    name = data.get('name', 'Anon')
    leave_room(room)
    emit('system', {'msg': f'{name} left {room}'}, to=room)

@socketio.on('drawing')
def handle_drawing(data):
    # data should contain: room, from, to, color, width, name
    room = data.get('room', 'main')
    # broadcast to others in the same room
    emit('drawing', data, to=room, include_self=False)

@socketio.on('clear')
def handle_clear(data):
    room = data.get('room', 'main')
    emit('clear', {}, to=room)

if __name__ == '__main__':
    # For development, using eventlet is recommended: pip install eventlet
    # then run: python app.py
    
    
    socketio.run(app, host='0.0.0.0', port=5000, debug=True)
