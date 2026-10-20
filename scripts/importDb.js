import fs from "fs";
import path from "path";
import { exec } from "child_process";
import env from "dotenv";

env.config();

const __dirname = path.resolve();

// Construct database connection URL for pg_restore
const dbUrl = process.env.DATABASE_URL || `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_DATABASE}`;

async function runPgRestore(filePath) {
  console.log(`Starting pg_restore on ${path.basename(filePath)}...`);
  
  // --no-owner: Skip restoring object ownership to match the local/Render database user
  // --no-privileges: Skip restoring access privileges to avoid permission errors
  // --clean: Drop database objects before recreating them
  const cmd = `pg_restore --no-owner --no-privileges --clean -d "${dbUrl}" "${filePath}"`;

  return new Promise((resolve, reject) => {
    exec(cmd, (err, stdout, stderr) => {
      if (err) {
        console.error(`❌ pg_restore failed for ${path.basename(filePath)}:`, err.message);
        console.error("stderr details:", stderr);
        return reject(err);
      }
      console.log(`✅ Completed pg_restore for ${path.basename(filePath)}`);
      resolve();
    });
  });
}

(async () => {
  try {
    const sushiSqlPath = path.join(__dirname, "database", "sushi.sql");
    if (fs.existsSync(sushiSqlPath)) {
      await runPgRestore(sushiSqlPath);
      console.log("🎉 Database initialization completed successfully!");
    } else {
      console.error(`❌ database/sushi.sql not found at ${sushiSqlPath}`);
      process.exit(1);
    }
  } catch (err) {
    console.error("Critical error during database import:", err);
    process.exit(1);
  }
})();
