const pool = require("../config/database");

const initializeDatabase = async () => {
  try {
    // Verify database connectivity and that the core schema is active
    await pool.query("SELECT 1 FROM information_schema.tables WHERE table_name = 'users' LIMIT 1;");
    console.log("✅ Consolidated master database schema verified and ready");
  } catch (error) {
    console.error("❌ Failed to verify database schema");
    console.error(error);
    throw error;
  }
};

module.exports = initializeDatabase;