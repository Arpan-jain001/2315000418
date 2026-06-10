import dotenv from "dotenv";
dotenv.config();

import app from "./app.js";
import connectDB from "./config/db.js";

const PORT = process.env.PORT || 3000;

// Connect Database
connectDB();

// Start Server
app.listen(PORT, () => {
  console.log(`
=================================
🚀 Server Started Successfully
🌐 URL  : http://localhost:${PORT}
⚙️ Mode : ${process.env.NODE_ENV}
=================================
`);
});