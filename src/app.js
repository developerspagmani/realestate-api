const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
require('dotenv').config();
// Restart trigger - forced update

const { specs, swaggerUi } = require('./config/swagger');
const { connectDB, disconnectDB, getDatabaseInfo } = require('./config/database');

console.log('--- API Initialization ---');
console.log('Environment:', process.env.NODE_ENV);
console.log('Prisma URL configured:', !!process.env.DATABASE_URL);
console.log('--------------------------');

// Routes
const authRoutes = require('./routes/auth'); // Restored original
const userRoutes = require('./routes/users');
const workspaceRoutes = require('./routes/workspaces');
const bookingRoutes = require('./routes/bookings');
const adminRoutes = require('./routes/admin');
const paymentRoutes = require('./routes/payments');
const leadsRoutes = require('./routes/leads');
const mediaRoutes = require('./routes/media');
const campaignRoutes = require('./routes/campaigns');
const socialPostsRoutes = require('./routes/socialPosts');
const tenantRoutes = require('./routes/tenants');
const propertyRoutes = require('./routes/properties');
const unitRoutes = require('./routes/units');
const widgetRoutes = require('./routes/widgets');
const moduleRoutes = require('./routes/modules');
const property3DRoutes = require('./routes/property3D');
const publicRoutes = require('./routes/public');
const amenityRoutes = require('./routes/amenities');
const agentRoutes = require('./routes/agents');
const marketingRoutes = require('./routes/marketing');
const categoryRoutes = require('./routes/categories');
const planRoutes = require('./routes/plans');
const licenseKeyRoutes = require('./routes/licenseKeys');



const errorHandler = require('./middleware/errorHandler');

const app = express();

// Enable trust proxy for rate limiting behind Next.js proxy
app.set('trust proxy', 1);

// Static files
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'development' ? 10000 : (parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100),
  message: {
    error: 'Too many requests from this IP, please try again later.'
  }
});

// Middleware
app.use(helmet());

const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:3000',
  'http://localhost:3001',
].filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (server-to-server, mobile apps, curl)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  credentials: true,
  maxAge: 86400,
}));
app.use(morgan('dev'));

app.use(limiter);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check with database info
app.get('/health', (req, res) => {
  const dbInfo = getDatabaseInfo();
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    database: dbInfo,
    environment: process.env.NODE_ENV
  });
});

const { tenantMiddleware } = require('./controllers/tenantController');

// Routes - All enabled for testing
app.use('/api/auth', authRoutes);

app.use(tenantMiddleware);
app.use('/api/users', userRoutes);
app.use('/api/workspaces', workspaceRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/leads', leadsRoutes);
app.use('/api/media', mediaRoutes);
app.use('/api/campaigns', campaignRoutes);
app.use('/api/social-posts', socialPostsRoutes);
app.use('/api/tenants', tenantRoutes);
app.use('/api/properties', propertyRoutes);
app.use('/api/units', unitRoutes);
app.use('/api/widgets', widgetRoutes);
app.use('/api/modules', moduleRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/property-3d', property3DRoutes);
app.use('/api/amenities', amenityRoutes);
app.use('/api/agents', agentRoutes);
app.use('/api/marketing', marketingRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/plans', planRoutes);
app.use('/api/license-keys', licenseKeyRoutes);



// Swagger Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs, {
  explorer: true,
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'Multi-Tenant Real Estate API Documentation',
}));

// Swagger JSON endpoint
app.get('/api-docs.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(specs);
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Error handling middleware
app.use(errorHandler);

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down gracefully...');
  await disconnectDB();
  process.exit(0);
});

// Start server with database connection
const PORT = process.env.PORT || 3001;

const startServer = async () => {
  try {
    await connectDB();
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📊 Environment: ${process.env.NODE_ENV}`);
      const dbInfo = getDatabaseInfo();
      console.log(`🗄️  Database: ${dbInfo.provider} (${dbInfo.url})`);
      console.log(`📚 API Documentation: http://localhost:${PORT}/api-docs`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

if (require.main === module) {
  startServer();
}

module.exports = app;
