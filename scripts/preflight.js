

const { existsSync } = require("fs");
const { join, dirname } = require("path");
const app = dirname(__dirname);

if (existsSync(join(app, "node_modules", "next", "package.json"))) process.exit(0);

const inside = process.cwd().replace(/\\/g, "/").endsWith("/frontend");
console.error(`
  FireHarmonix cannot start yet: its dependencies are not installed.

  Run this once:

      ${inside ? "npm install" : "npm run setup"}

  ${inside ? "(or from the workspace root: npm run setup)" : "(or: cd frontend && npm install)"}

  Then start it:

      npm run dev

`);
process.exit(1);
