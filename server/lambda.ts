/**
 * AWS Lambda + Function URL entry for Doc AI MCP.
 * Uses slim lambdaApp (no MCP SDK bundle).
 */
import serverless from "serverless-http";
import { app } from "./lambdaApp.js";

export const handler = serverless(app, {
  binary: false,
});
