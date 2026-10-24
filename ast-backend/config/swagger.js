const swaggerJsdoc = require('swagger-jsdoc');

const options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'Smart Asset Inventory API',
            version: '1.0.0',
            description:
                'API Documentation for BUC University Asset Management System',
        },
        servers: [
            {
                url: 'http://localhost:5000',
                description: 'Local Server',
            },
            {
                url: 'https://smart-asset-backend-production.up.railway.app',
                description: 'Production Server (Railway)',
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
    // المسارات التي تحتوي على تعليقات التوثيق
    apis: ['./routes/*.js'],
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;
