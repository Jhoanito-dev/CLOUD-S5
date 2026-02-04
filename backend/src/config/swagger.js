const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Road Works API - Antananarivo',
      version: '1.0.0',
      description: 'API REST pour le signalement et suivi des travaux routiers à Antananarivo',
      contact: {
        name: 'Équipe Cloud S5 - Promotion 17',
      },
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Development server',
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
      schemas: {
        User: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            uid: { type: 'string' },
            email: { type: 'string', format: 'email' },
            first_name: { type: 'string' },
            last_name: { type: 'string' },
            role: { type: 'string', enum: ['visitor', 'user', 'manager'] },
            is_blocked: { type: 'boolean' },
            created_at: { type: 'string', format: 'date-time' },
          },
        },
        Report: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            uid: { type: 'string' },
            latitude: { type: 'number' },
            longitude: { type: 'number' },
            description: { type: 'string' },
            surface: { type: 'number' },
            budget: { type: 'number' },
            company: { type: 'string' },
            status: { type: 'string', enum: ['new', 'in_progress', 'done'] },
            created_at: { type: 'string', format: 'date-time' },
          },
        },
        LoginRequest: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string', format: 'email' },
            password: { type: 'string', minLength: 6 },
          },
        },
        RegisterRequest: {
          type: 'object',
          required: ['email', 'password', 'first_name', 'last_name'],
          properties: {
            email: { type: 'string', format: 'email' },
            password: { type: 'string', minLength: 6 },
            first_name: { type: 'string' },
            last_name: { type: 'string' },
          },
        },
        Stats: {
          type: 'object',
          properties: {
            total_reports: { type: 'integer' },
            total_surface: { type: 'number' },
            total_budget: { type: 'number' },
            by_status: {
              type: 'object',
              properties: {
                new: { type: 'integer' },
                in_progress: { type: 'integer' },
                done: { type: 'integer' },
              },
            },
            progress_percentage: { type: 'number' },
          },
        },
        Error: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' },
          },
        },
      },
    },
  },
  apis: ['./src/routes/*.js'],
};

module.exports = swaggerJsdoc(options);
