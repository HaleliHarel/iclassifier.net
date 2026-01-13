import express from 'express';
import serverless from 'serverless-http';
import { createServer } from '../../server/index.js';

// Create the Express app
const app = createServer();

// Export the serverless handler
export const handler = serverless(app);