import net from "net";
import os from "os";
import { loadConfig } from "../config";

async function checkPort(host: string, port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(1000);
    socket.on("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.on("error", () => resolve(false));
    socket.on("timeout", () => resolve(false));
    socket.connect(port, host);
  });
}

function getInstallGuide(type: string): string {
  const platform = os.platform();

  if (type === "postgres") {
    if (platform === "darwin") return "brew install postgresql && brew services start postgresql";
    if (platform === "linux") return "sudo apt update && sudo apt install postgresql && sudo systemctl start postgresql";
    if (platform === "win32") return "Download: https://www.postgresql.org/download/windows/ or `choco install postgresql`";
  }

  if (type === "mysql") {
    if (platform === "darwin") return "brew install mysql && brew services start mysql";
    if (platform === "linux") return "sudo apt update && sudo apt install mysql-server && sudo systemctl start mysql";
    if (platform === "win32") return "Download: https://dev.mysql.com/downloads/installer/ or `choco install mysql`";
  }

  if (type === "mongo") {
    if (platform === "darwin") return "brew tap mongodb/brew && brew install mongodb-community && brew services start mongodb/brew/mongodb-community";
    if (platform === "linux") return "sudo apt install -y mongodb && sudo systemctl start mongodb";
    if (platform === "win32") return "Download: https://www.mongodb.com/try/download/community or `choco install mongodb`";
  }

  return "❓ Installation guide not available for your OS.";
}

export async function runDoctor() {
  const configs = loadConfig();

  if (!configs || Object.keys(configs).length === 0) {
    console.log("⚠️ No database connections configured. Run `dbman config` first.");
    return;
  }

  for (const [name, cfg] of Object.entries(configs)) {
    console.log(`\n🔍 Checking "${name}" (${cfg.type})...`);

    if (cfg.type === "mongo") {
      try {
        const { MongoClient } = await import("mongodb");
        const client = new MongoClient(cfg.uri, { serverSelectionTimeoutMS: 1000 });
        await client.connect();
        await client.db(cfg.dbName).command({ ping: 1 });
        console.log(`✅ MongoDB is running at ${cfg.uri}`);
        await client.close();
      } catch {
        console.log(`❌ Cannot connect to MongoDB at ${cfg.uri}`);
        console.log("👉 " + getInstallGuide("mongo"));
      }
    } else {
      const alive = await checkPort(cfg.host, cfg.port);
      if (alive) {
        console.log(`✅ ${cfg.type} is running at ${cfg.host}:${cfg.port}`);
      } else {
        console.log(`❌ Cannot connect to ${cfg.type} at ${cfg.host}:${cfg.port}`);
        console.log("👉 " + getInstallGuide(cfg.type));
      }
    }
  }
}
