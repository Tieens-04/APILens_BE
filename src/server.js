require('dotenv').config();
const connectDB = require('./config/db');
const app = require('./app');

// Kết nối tới Database
connectDB();

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`[SERVER] Restly API is running on port ${PORT}`);
  console.log(`[ENVIRONMENT] ${process.env.NODE_ENV}`);
});
