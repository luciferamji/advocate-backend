const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const dotenv = require('dotenv');
const path = require('path');
const { buildCorsOptions } = require('./utils/corsOptions');

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();

// Behind the local reverse proxy: trust X-Forwarded-For only from loopback
// (used for req.ip in the lead audit log). Override with TRUST_PROXY if needed.
app.set('trust proxy', process.env.TRUST_PROXY || 'loopback');

// Middleware
app.use(cors(buildCorsOptions()));
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
app.use('/api/phone-numbers', require('./routes/phoneNumber.routes'));
app.use('/api/calls', require('./routes/call.routes'));
app.use('/api/leads', require('./routes/lead.routes'));
app.use('/api/handling-offices', require('./routes/handlingOffice.routes'));
app.use('/api/lead-sources', require('./routes/leadSource.routes'));

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

module.exports = app;
