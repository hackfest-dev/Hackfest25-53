import socketio

sio = socketio.Client()

@sio.on('connect')
def on_connect():
    print("Connected to server")
    sio.emit('start_conversation', {
        "user_id": "user_123",
        "input": "Set up a Python environment for ML"
    })

@sio.on('new_token')
def on_new_token(data):
    print("Agent says:", data)

sio.connect('http://localhost:5000')
