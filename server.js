import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { Server } from 'socket.io';

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = 3000;

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('internal server error');
    }
  });

  const io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  // Store connected users
  const connectedUsers = new Map();

  io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('auth', (userId) => {
      console.log(`User ${userId} authenticated`);
      connectedUsers.set(socket.id, userId);
      socket.userId = userId;
    });

    socket.on('highlight', (highlightData) => {
      console.log('Broadcasting highlight:', highlightData);
      // Broadcast to all other connected clients
      socket.broadcast.emit('highlight', highlightData);
    });

    socket.on('disconnect', () => {
      const userId = connectedUsers.get(socket.id);
      if (userId) {
        console.log(`User ${userId} disconnected`);
        connectedUsers.delete(socket.id);
      }
    });
  });

  server
    .once('error', (err) => {
      console.error(err);
      process.exit(1);
    })
    .listen(port, () => {
      console.log(`> Ready on http://${hostname}:${port}`);
    });
});
