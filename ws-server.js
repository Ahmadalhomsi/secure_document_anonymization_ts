// ws-server.js

import { WebSocketServer } from "ws";

const PORT = 8080;
const wss = new WebSocketServer({ port: PORT });

let clients = [];

wss.on("connection", (socket) => {
  console.log("New client connected");
  clients.push(socket);

  socket.on("message", (data) => {
    try {
      const parsedData = JSON.parse(data.toString());
      console.log("Received:", parsedData);

      // Broadcast the message or response to all connected clients
      clients.forEach((client) => {
        if (client.readyState === client.OPEN) {
          client.send(JSON.stringify(parsedData));
        }
      });
    } catch (error) {
      console.error("Error parsing message:", error);
    }
  });

  socket.on("close", () => {
    console.log("Client disconnected");
    clients = clients.filter((client) => client !== socket);
  });
});

console.log(`WebSocket server running on ws://localhost:${PORT}`);
