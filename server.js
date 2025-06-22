const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const dotenv = require('dotenv');
const path = require('path');
const { sequelize } = require('./models');
const createSuperAdmin = require('./utils/createSuperAdmin');

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? 'https://lawfypro.lawfyco.com/' 
    : 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Static files
app.use(express.static(path.join(__dirname, 'dist')));

// Routes
app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/admin', require('./routes/admin.routes'));
app.use('/api/advocates', require('./routes/advocate.routes'));
app.use('/api/clients', require('./routes/client.routes'));
app.use('/api/cases', require('./routes/case.routes'));
app.use('/api/hearings', require('./routes/hearing.routes'));
app.use('/api/calendar', require('./routes/calendar.routes'));
app.use('/api/dashboard', require('./routes/dashboard.routes'));
app.use('/api/upload', require('./routes/upload.routes'));
app.use('/api/download', require('./routes/download.routes'));
app.use('/api/invoices', require('./routes/invoice.routes'));
app.use('/api/document-links', require('./routes/documentLink.routes'));
app.use('/api/tasks', require('./routes/task.routes'));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});
// Error handler middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  
  const errorResponse = {
    error: {
      message: err.message || 'Internal Server Error',
      code: err.code || 'INTERNAL_ERROR'
    }
  };

  if (err.details) {
    errorResponse.error.details = err.details;
  }

  res.status(err.statusCode || 500).json(errorResponse);
});

// Start server
const startServer = async () => {
  try {
    // Sync database
    await sequelize.sync({ alter: process.env.NODE_ENV === 'development' });
    console.log('Database connected successfully');
    
    // Create super admin if doesn't exist
    await createSuperAdmin();
    
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Unable to connect to the database:', error);
    process.exit(1);
  }
};

startServer();

require('./cron/nextDayHearingCron');