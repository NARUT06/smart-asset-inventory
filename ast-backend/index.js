require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');

const { connectDB, disconnectDB, isDbConnected } = require('./config/db');
const { notFound, errorHandler } = require('./middleware/errorMiddleware');

const authRoutes = require('./routes/authRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const locationRoutes = require('./routes/locationRoutes');
const assetRoutes = require('./routes/assetRoutes');
const transferRoutes = require('./routes/transferRoutes');
const workOrderRoutes = require('./routes/workOrderRoutes');
const maintenanceTemplateRoutes = require('./routes/maintenanceTemplateRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const auditRoutes = require('./routes/auditRoutes');
const stocktakeRoutes = require('./routes/stocktakeRoutes');

const app = express();

if (process.env.TRUST_PROXY)
    app.set('trust proxy', Number(process.env.TRUST_PROXY) || true);

// ---------- CORS Configuration ----------
const envOrigins = (process.env.CLIENT_ORIGIN || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

const defaultAllowedOrigins = [
    'http://localhost:5173',
    'http://localhost:3000',
    'http://localhost:5174',
    'https://02069b3c.smart-asset-frontend.pages.dev',
    'https://smart-asset-inventory-ijeqbheq9-jhad16358-1675.vercel.app',
];

const allowedOrigins = [...new Set([...defaultAllowedOrigins, ...envOrigins])];

const corsOptions = {
    origin: function (origin, callback) {
        // السماح للطلبات التي لا تملك origin (مثل Postman/Swagger) أو الدومينات المحددة أو أي preview deployment من Cloudflare
        if (
            !origin ||
            allowedOrigins.includes(origin) ||
            origin.endsWith('.pages.dev') ||
            origin.endsWith('.vercel.app')
        ) {
            callback(null, true);
        } else {
            callback(new Error('Blocked by CORS policy'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-Requested-With',
        'Accept',
    ],
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// ---------- Global middleware ----------
app.use(
    helmet({
        contentSecurityPolicy: false,
        crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
);

app.use(express.json({ limit: '1mb' }));
if (process.env.NODE_ENV !== 'production') app.use(morgan('dev'));

// ---------- Swagger Setup ----------
const swaggerOptions = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'Smart Asset Inventory API',
            version: '1.0.0',
            description:
                'API documentation for the Smart Asset Inventory project',
        },
        servers: [
            {
                url: 'https://smart-asset-backend-production.up.railway.app',
                description: 'Production Server (Railway)',
            },
            {
                url: 'http://localhost:5000',
                description: 'Local Development Server',
            },
        ],
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                },
            },
        },
        security: [
            {
                bearerAuth: [],
            },
        ],
    },
    apis: ['./routes/*.js', './src/routes/*.js'],
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

const swaggerUiOptions = {
    explorer: true,
    customCssUrl:
        'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.11.0/swagger-ui.min.css',
    customJs: [
        'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.11.0/swagger-ui-bundle.js',
        'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.11.0/swagger-ui-standalone-preset.js',
    ],
};

// مسار ملف JSON
app.get('/api/docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
});

// إتاحة التوثيق على الرابطين
app.use(
    '/api/docs',
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec, swaggerUiOptions),
);
app.use(
    '/api-docs',
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec, swaggerUiOptions),
);

// ---------- Routes ----------
app.get('/api/health', async (req, res) => {
    res.json({
        success: true,
        status: 'ok',
        uptime: process.uptime(),
        db: (await isDbConnected()) ? 'connected' : 'disconnected',
    });
});

app.use('/api/auth', authRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/locations', locationRoutes);
app.use('/api/assets', assetRoutes);
app.use('/api/transfers', transferRoutes);
app.use('/api/work-orders', workOrderRoutes);
app.use('/api/maintenance-templates', maintenanceTemplateRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/admin/logs', auditRoutes);
app.use('/api/stocktake', stocktakeRoutes);

// ---------- Errors ----------
app.use(notFound);
app.use(errorHandler);

// ---------- Server ----------
const start = async () => {
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
        throw new Error(
            'JWT_SECRET must be set and at least 32 characters long',
        );
    }

    await connectDB();

    const port = process.env.PORT || 5000;
    const server = app.listen(port, () => {
        console.log(
            `AST backend running in ${process.env.NODE_ENV || 'development'} mode on port ${port}`,
        );
    });

    const shutdown = (signal) => {
        console.log(`${signal} received. Shutting down...`);
        server.close(async () => {
            await disconnectDB();
            process.exit(0);
        });
        setTimeout(() => process.exit(1), 10000).unref();
    };
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
};

process.on('unhandledRejection', (err) => {
    console.error('Unhandled rejection:', err);
    process.exit(1);
});

if (require.main === module) {
    start().catch((err) => {
        console.error('Failed to start server:', err.message);
        process.exit(1);
    });
}

module.exports = app;
