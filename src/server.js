require("dotenv").config();

const app = require("./app");
const pool = require("./config/database");
const initializeDatabase = require("./database/init");

const PORT = process.env.PORT || 8000;

const startServer = async () => {
  try {
    await pool.query("SELECT NOW()");

    console.log("✅ Database connection successful");

    await initializeDatabase();

    // Check if running under Phusion Passenger (socket path) or standard port
    if (isNaN(PORT)) {
      app.listen(PORT, () => {
        console.log(`🚀 Kasina Hotel Backend running on Passenger socket ${PORT}`);
      });
    } else {
      // Bind to "0.0.0.0" so mobile devices and network can connect
      app.listen(Number(PORT), "0.0.0.0", () => {
        console.log(
          `🚀 Kasina Hotel Backend running on port ${PORT} (Network accessible)`
        );
      });
    }
  } catch (error) {
    console.error("❌ Failed to start Kasina Hotel backend");
    console.error(error);

    process.exit(1);
  }
};

startServer();

// Automated Daily Check for Due Recurring Bills & Notifications
try {
  const recurringExpensesService = require("./modules/expenses/recurringExpenses.service");
  // Run on startup after 10 seconds
  setTimeout(() => {
    recurringExpensesService.checkDueRecurringExpensesAndNotify().catch((e) => console.error("Initial recurring bills check failed:", e.message));
  }, 10000);

  // Run every 6 hours
  setInterval(() => {
    recurringExpensesService.checkDueRecurringExpensesAndNotify().catch((e) => console.error("Periodic recurring bills check failed:", e.message));
  }, 6 * 60 * 60 * 1000);
  console.log("✓ Recurring bills automated notification scheduler started");
} catch (schedErr) {
  console.warn("Could not initialize recurring bills scheduler:", schedErr.message);
}
