// Packages scripts/bundle.mjs leaves out of the bundle. Shared with
// scripts/gate-vercel.mjs, which ships exactly these next to the bundle when it
// replicates the Vercel function tree.
//
// They must stay on disk: native bindings, files read relative to the package
// (pino's thread-stream worker transports), or the generated Prisma client
// (lives in node_modules/.prisma).
// Vercel's file tracing ships whatever these import. Optional Nest transports
// are not installed; Nest only imports them when a microservice/websocket
// feature is used, which this app never does.
export const external = [
  'argon2',
  '@prisma/client',
  '.prisma/client',
  'pino-http',
  '@nestjs/microservices',
  '@nestjs/websockets',
  '@nestjs/platform-socket.io',
  '@nestjs/platform-ws',
];
