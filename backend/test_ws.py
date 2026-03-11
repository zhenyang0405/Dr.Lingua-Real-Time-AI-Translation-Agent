import asyncio
import websockets
import json

async def test_interrupt():
    uri = "ws://localhost:8000/ws/test-user/test-session"
    async with websockets.connect(uri) as websocket:
        print("Connected")
        
        # Start a response
        await websocket.send(json.dumps({"text": "Hello, please speak a long sentence."}))
        
        # Wait a bit for it to start talking
        for _ in range(5):
             msg = await websocket.recv()
             print("<", msg)
             if "talking" in msg:
                 break
        
        print("Sending interrupt...")
        await websocket.send(json.dumps({"type": "interrupt"}))
        
        # See what happens next
        for _ in range(10):
            try:
                msg = await asyncio.wait_for(websocket.recv(), timeout=2.0)
                print("<", msg)
            except asyncio.TimeoutError:
                break

asyncio.run(test_interrupt())
