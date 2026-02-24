import dotenv from 'dotenv';
import http from 'node:http';

import { createApp } from './app.js';

dotenv.config();

const port = Number(process.env.PORT) || 4000;

const app = createApp();

const server = http.createServer(app);

server.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Backend listening on http://localhost:${port}`);
});

