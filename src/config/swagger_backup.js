const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Multi-Tenant Real Estate & Co-working API',
      version: '1.0.0',
      description: 'Comprehensive API for Multi-Tenant Real Estate & Co-working Management System with PostgreSQL, Prisma ORM, and UUID support',
      contact: {
        name: 'API Support',
        email: 'support@realestate-coworking.com',
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT',
      },
    },
    servers: [
      {
        url: process.env.API_URL || 'http://localhost:3000',
        description: 'Development server',
      },
      {
        url: process.env.PROD_API_URL || 'https://api.coworkingbooking.com',
        description: 'Production server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT authentication token',
        },
      },
      schemas: {
        // Core Models
        Tenant: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              description: 'Tenant unique identifier',
            },
            name: {
              type: 'string',
              description: 'Tenant name',
            },
            type: {
              type: 'integer',
              enum: [1, 2, 3],
              description: '1: Real Estate, 2: Co-working, 3: Mixed',
            },
            domain: {
              type: 'string',
              description: 'Tenant domain (optional)',
            },
            status: {
              type: 'integer',
              enum: [1, 2, 3],
              description: '1: active, 2: inactive, 3: suspended',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Tenant creation timestamp',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
              description: 'Tenant last update timestamp',
            },
          },
        },
        User: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              description: 'User unique identifier',
            },
            tenantId: {
              type: 'string',
              format: 'uuid',
              description: 'Associated tenant ID',
            },
            name: {
              type: 'string',
              description: 'User full name',
            },
            email: {
              type: 'string',
              format: 'email',
              description: 'User email address',
            },
            phone: {
              type: 'string',
              description: 'User phone number',
            },
            role: {
              type: 'integer',
              enum: [1, 2, 3],
              description: '1: user, 2: admin, 3: owner',
            },
            status: {
              type: 'integer',
              enum: [1, 2, 3],
              description: '1: active, 2: inactive, 3: suspended',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'User creation timestamp',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
              description: 'User last update timestamp',
            },
          },
        },
        Property: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              description: 'Property unique identifier',
            },
            tenantId: {
              type: 'string',
              format: 'uuid',
              description: 'Associated tenant ID',
            },
            propertyType: {
              type: 'integer',
              enum: [1, 2, 3, 4],
              description: '1: residential, 2: commercial, 3: industrial, 4: mixed',
            },
            title: {
              type: 'string',
              description: 'Property title',
            },
            description: {
              type: 'string',
              description: 'Property description',
            },
            addressLine1: {
              type: 'string',
              description: 'Property address line 1',
            },
            addressLine2: {
              type: 'string',
              description: 'Property address line 2',
            },
            city: {
              type: 'string',
              description: 'Property city',
            },
            state: {
              type: 'string',
              description: 'Property state',
            },
            country: {
              type: 'string',
              description: 'Property country',
            },
            postalCode: {
              type: 'string',
              description: 'Property postal code',
            },
            latitude: {
              type: 'number',
              format: 'float',
              description: 'Property latitude',
            },
            longitude: {
              type: 'number',
              format: 'float',
              description: 'Property longitude',
            },
            status: {
              type: 'integer',
              enum: [1, 2, 3],
              description: '1: active, 2: inactive, 3: archived',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Property creation timestamp',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
              description: 'Property last update timestamp',
            },
          },
        },
        Unit: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              description: 'Unit unique identifier',
            },
            tenantId: {
              type: 'string',
              format: 'uuid',
              description: 'Associated tenant ID',
            },
            propertyId: {
              type: 'string',
              format: 'uuid',
              description: 'Associated property ID',
            },
            unitCategory: {
              type: 'integer',
              enum: [1, 2, 3, 4],
              description: '1: residential, 2: commercial, 3: industrial, 4: mixed',
            },
            unitCode: {
              type: 'string',
              description: 'Unit code',
            },
            floorNo: {
              type: 'integer',
              description: 'Floor number',
            },
            capacity: {
              type: 'integer',
              description: 'Unit capacity',
            },
            sizeSqft: {
              type: 'integer',
              description: 'Unit size in square feet',
            },
            status: {
              type: 'integer',
              enum: [1, 2, 3, 4],
              description: '1: available, 2: occupied, 3: maintenance, 4: inactive',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Unit creation timestamp',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
              description: 'Unit last update timestamp',
            },
          },
        },
        Booking: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              description: 'Booking unique identifier',
            },
            tenantId: {
              type: 'string',
              format: 'uuid',
              description: 'Associated tenant ID',
            },
            unitId: {
              type: 'string',
              format: 'uuid',
              description: 'Associated unit ID',
            },
            userId: {
              type: 'string',
              format: 'uuid',
              description: 'Associated user ID',
            },
            startAt: {
              type: 'string',
              format: 'date-time',
              description: 'Booking start time',
            },
            endAt: {
              type: 'string',
              format: 'date-time',
              description: 'Booking end time',
            },
            status: {
              type: 'integer',
              enum: [1, 2, 3, 4, 5],
              description: '1: pending, 2: confirmed, 3: cancelled, 4: completed, 5: no_show',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Booking creation timestamp',
            },
          },
        },
        Lead: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              description: 'Lead unique identifier',
            },
            tenantId: {
              type: 'string',
              format: 'uuid',
              description: 'Associated tenant ID',
            },
            unitId: {
              type: 'string',
              format: 'uuid',
              description: 'Associated unit ID',
            },
            propertyId: {
              type: 'string',
              format: 'uuid',
              description: 'Associated property ID',
            },
            name: {
              type: 'string',
              description: 'Lead name',
            },
            email: {
              type: 'string',
              format: 'email',
              description: 'Lead email',
            },
            phone: {
              type: 'string',
              description: 'Lead phone number',
            },
            message: {
              type: 'string',
              description: 'Lead message',
            },
            source: {
              type: 'integer',
              enum: [1, 2, 3, 4, 5, 6],
              description: '1: website, 2: email, 3: phone, 4: social, 5: referral, 6: other',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Lead creation timestamp',
            },
          },
        },
        Amenity: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              description: 'Amenity unique identifier',
            },
            name: {
              type: 'string',
              description: 'Amenity name',
            },
            category: {
              type: 'integer',
              enum: [1, 2, 3, 4, 5],
              description: '1: facilities, 2: technology, 3: comfort, 4: safety, 5: other',
            },
            icon: {
              type: 'string',
              description: 'Amenity icon',
            },
            status: {
              type: 'integer',
              enum: [1, 2],
              description: '1: active, 2: inactive',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Amenity creation timestamp',
            },
          },
        },
        UnitPricing: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              description: 'Unit pricing unique identifier',
            },
            unitId: {
              type: 'string',
              format: 'uuid',
              description: 'Associated unit ID',
            },
            pricingModel: {
              type: 'integer',
              enum: [1, 2, 3, 4, 5],
              description: '1: fixed, 2: hourly, 3: daily, 4: monthly, 5: yearly',
            },
            price: {
              type: 'number',
              format: 'float',
              description: 'Unit price',
            },
            currency: {
              type: 'string',
              description: 'Price currency',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Unit pricing creation timestamp',
            },
          },
        },
        RealEstateUnitDetails: {
          type: 'object',
          properties: {
            unitId: {
              type: 'string',
              format: 'uuid',
              description: 'Associated unit ID',
            },
            bedrooms: {
              type: 'integer',
              description: 'Number of bedrooms',
            },
            bathrooms: {
              type: 'integer',
              description: 'Number of bathrooms',
            },
            furnishing: {
              type: 'integer',
              enum: [1, 2, 3],
              description: '1: unfurnished, 2: semi-furnished, 3: fully furnished',
            },
            parkingSlots: {
              type: 'integer',
              description: 'Number of parking slots',
            },
            facing: {
              type: 'integer',
              enum: [1, 2, 3, 4, 5, 6, 7, 8],
              description: '1: north, 2: south, 3: east, 4: west, 5: north-east, 6: north-west, 7: south-east, 8: south-west',
            },
          },
        },
        CoworkingUnitDetails: {
          type: 'object',
          properties: {
            unitId: {
              type: 'string',
              format: 'uuid',
              description: 'Associated unit ID',
            },
            seatType: {
              type: 'integer',
              enum: [1, 2, 3, 4],
              description: '1: desk, 2: cabin, 3: meeting room, 4: event space',
            },
            pricingBasis: {
              type: 'integer',
              enum: [1, 2, 3, 4],
              description: '1: per seat, 2: per unit, 3: per hour, 4: per day',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Coworking unit details creation timestamp',
            },
          },
        },
        Listing: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              description: 'Listing unique identifier',
            },
            tenantId: {
              type: 'string',
              format: 'uuid',
              description: 'Associated tenant ID',
            },
            unitId: {
              type: 'string',
              format: 'uuid',
              description: 'Associated unit ID',
            },
            slug: {
              type: 'string',
              description: 'Listing slug (URL-friendly)',
            },
            isPublished: {
              type: 'boolean',
              description: 'Whether the listing is published',
            },
            publishedAt: {
              type: 'string',
              format: 'date-time',
              description: 'Listing publication timestamp',
            },
            seoTitle: {
              type: 'string',
              description: 'SEO title',
            },
            seoDescription: {
              type: 'string',
              description: 'SEO description',
            },
          },
        },
        UserPropertyAccess: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              description: 'User property access unique identifier',
            },
            tenantId: {
              type: 'string',
              format: 'uuid',
              description: 'Associated tenant ID',
            },
            userId: {
              type: 'string',
              format: 'uuid',
              description: 'Associated user ID',
            },
            propertyId: {
              type: 'string',
              format: 'uuid',
              description: 'Associated property ID',
            },
            accessLevel: {
              type: 'integer',
              enum: [1, 2, 3],
              description: '1: read, 2: write, 3: admin',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'User property access creation timestamp',
            },
          },
        },
        AuditLog: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              description: 'Audit log unique identifier',
            },
            tenantId: {
              type: 'string',
              format: 'uuid',
              description: 'Associated tenant ID',
            },
            userId: {
              type: 'string',
              format: 'uuid',
              description: 'Associated user ID',
            },
            action: {
              type: 'string',
              description: 'Action performed',
            },
            entity: {
              type: 'string',
              description: 'Entity type',
            },
            entityId: {
              type: 'string',
              format: 'uuid',
              description: 'Entity ID',
            },
            ipAddress: {
              type: 'string',
              description: 'IP address of the action',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Audit log creation timestamp',
            },
          },
        },
        // Response Models
        AuthResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              description: 'Operation success status',
            },
            message: {
              type: 'string',
              description: 'Response message',
            },
            data: {
              type: 'object',
              properties: {
                user: {
                  $ref: '#/components/schemas/User',
                },
                token: {
                  type: 'string',
                  description: 'JWT authentication token',
                },
              },
            },
          },
        },
        Error: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false,
            },
            message: {
              type: 'string',
              description: 'Error message',
            },
            errors: {
              type: 'array',
              items: {
                type: 'string',
              },
              description: 'Validation errors array',
            },
          },
        },
        SuccessResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: true,
            },
            message: {
              type: 'string',
              description: 'Success message',
            },
            data: {
              type: 'object',
              description: 'Response data',
            },
          },
        },
        PaginatedResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: true,
            },
            message: {
              type: 'string',
              description: 'Response message',
            },
            data: {
              type: 'object',
              properties: {
                items: {
                  type: 'array',
                  items: {
                    type: 'object',
                  },
                  description: 'Array of items',
                },
                pagination: {
                  type: 'object',
                  properties: {
                    page: {
                      type: 'integer',
                      description: 'Current page number',
                    },
                    limit: {
                      type: 'integer',
                      description: 'Items per page',
                    },
                    total: {
                      type: 'integer',
                      description: 'Total number of items',
                    },
                    totalPages: {
                      type: 'integer',
                      description: 'Total number of pages',
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    apis: [
      './src/routes/*.js',
      './src/controllers/*.js',
    ],
  },
};

const specs = swaggerJsdoc(options);

module.exports = {
  specs,
  swaggerUi,
};
              description: 'Booked seats ID',
            },
            spaceId: {
              type: 'string',
              format: 'uuid',
              description: 'Booked space ID',
            },
            startDate: {
              type: 'string',
              format: 'date',
              description: 'Booking start date',
            },
            endDate: {
              type: 'string',
              format: 'date',
              description: 'Booking end date',
            },
            startTime: {
              type: 'string',
              format: 'time',
              description: 'Booking start time',
            },
            endTime: {
              type: 'string',
              format: 'time',
              description: 'Booking end time',
            },
            totalAmount: {
              type: 'number',
              description: 'Total booking amount',
            },
            status: {
              type: 'string',
              enum: ['PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED'],
              description: 'Booking status',
            },
            paymentStatus: {
              type: 'string',
              enum: ['PENDING', 'PAID', 'REFUNDED', 'FAILED'],
              description: 'Payment status',
            },
            notes: {
              type: 'string',
              description: 'Booking notes',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Booking creation timestamp',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
              description: 'Booking last update timestamp',
            },
          },
        },
        Lead: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              description: 'Lead unique identifier',
            },
            name: {
              type: 'string',
              description: 'Lead name',
            },
            email: {
              type: 'string',
              format: 'email',
              description: 'Lead email',
            },
            phone: {
              type: 'string',
              description: 'Lead phone number',
            },
            company: {
              type: 'string',
              description: 'Lead company',
            },
            message: {
              type: 'string',
              description: 'Lead message',
            },
            source: {
              type: 'string',
              description: 'Lead source (website, email, phone, social, referral)',
            },
            priority: {
              type: 'string',
              enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'],
              description: 'Lead priority',
            },
            status: {
              type: 'string',
              enum: ['NEW', 'CONTACTED', 'QUALIFIED', 'CONVERTED', 'LOST'],
              description: 'Lead status',
            },
            budget: {
              type: 'number',
              description: 'Lead budget',
            },
            preferredDate: {
              type: 'string',
              format: 'date',
              description: 'Preferred date',
            },
            notes: {
              type: 'string',
              description: 'Lead notes',
            },
            userId: {
              type: 'string',
              format: 'uuid',
              description: 'Associated user ID',
            },
            workspaceId: {
              type: 'string',
              format: 'uuid',
              description: 'Associated seats ID',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Lead creation timestamp',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
              description: 'Lead last update timestamp',
            },
          },
        },
        Campaign: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              description: 'Campaign unique identifier',
            },
            name: {
              type: 'string',
              description: 'Campaign name',
            },
            type: {
              type: 'string',
              description: 'Campaign type (email, whatsapp, sms, social)',
            },
            subject: {
              type: 'string',
              description: 'Campaign subject',
            },
            content: {
              type: 'string',
              description: 'Campaign content',
            },
            targetAudience: {
              type: 'array',
              items: {
                type: 'string',
              },
              description: 'Target audience segments',
            },
            status: {
              type: 'string',
              enum: ['DRAFT', 'SCHEDULED', 'ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED'],
              description: 'Campaign status',
            },
            scheduledDate: {
              type: 'string',
              format: 'date-time',
              description: 'Campaign scheduled date',
            },
            launchedAt: {
              type: 'string',
              format: 'date-time',
              description: 'Campaign launch date',
            },
            createdBy: {
              type: 'string',
              format: 'uuid',
              description: 'Campaign creator ID',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Campaign creation timestamp',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
              description: 'Campaign last update timestamp',
            },
          },
        },
        SocialPost: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              description: 'Social post unique identifier',
            },
            content: {
              type: 'string',
              description: 'Post content',
            },
            platform: {
              type: 'string',
              description: 'Social platform (facebook, twitter, instagram, linkedin, whatsapp)',
            },
            mediaIds: {
              type: 'array',
              items: {
                type: 'string',
                format: 'uuid',
              },
              description: 'Associated media IDs',
            },
            status: {
              type: 'string',
              enum: ['DRAFT', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED'],
              description: 'Post status',
            },
            scheduledDate: {
              type: 'string',
              format: 'date-time',
              description: 'Scheduled publish date',
            },
            publishedAt: {
              type: 'string',
              format: 'date-time',
              description: 'Actual publish date',
            },
            hashtags: {
              type: 'array',
              items: {
                type: 'string',
              },
              description: 'Post hashtags',
            },
            mentions: {
              type: 'array',
              items: {
                type: 'string',
              },
              description: 'Post mentions',
            },
            likes: {
              type: 'integer',
              description: 'Number of likes',
            },
            shares: {
              type: 'integer',
              description: 'Number of shares',
            },
            comments: {
              type: 'integer',
              description: 'Number of comments',
            },
            createdBy: {
              type: 'string',
              format: 'uuid',
              description: 'Post creator ID',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Post creation timestamp',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
              description: 'Post last update timestamp',
            },
          },
        },
        Media: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              description: 'Media unique identifier',
            },
            filename: {
              type: 'string',
              description: 'Generated filename',
            },
            originalName: {
              type: 'string',
              description: 'Original filename',
            },
            mimeType: {
              type: 'string',
              description: 'File MIME type',
            },
            size: {
              type: 'integer',
              description: 'File size in bytes',
            },
            url: {
              type: 'string',
              description: 'File URL',
            },
            alt: {
              type: 'string',
              description: 'Alternative text',
            },
            description: {
              type: 'string',
              description: 'File description',
            },
            category: {
              type: 'string',
              description: 'File category (image, video, document, other)',
            },
            type: {
              type: 'string',
              description: 'File type (seats, space, profile, general)',
            },
            uploadedBy: {
              type: 'string',
              format: 'uuid',
              description: 'Uploader ID',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Media creation timestamp',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
              description: 'Media last update timestamp',
            },
          },
        },
        Error: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false,
              description: 'Operation success status',
            },
            message: {
              type: 'string',
              description: 'Error message',
            },
            error: {
              type: 'string',
              description: 'Detailed error information',
            },
          },
        },
        Success: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: true,
              description: 'Operation success status',
            },
            message: {
              type: 'string',
              description: 'Success message',
            },
            data: {
              type: 'object',
              description: 'Response data',
            },
          },
        },
        Pagination: {
          type: 'object',
          properties: {
            page: {
              type: 'integer',
              description: 'Current page number',
            },
            limit: {
              type: 'integer',
              description: 'Items per page',
            },
            total: {
              type: 'integer',
              description: 'Total number of items',
            },
            pages: {
              type: 'integer',
              description: 'Total number of pages',
            },
          },
        },
      },
    },
    tags: [
      {
        name: 'Authentication',
        description: 'User authentication and authorization operations',
      },
      {
        name: 'Users',
        description: 'User management operations',
      },
      {
        name: 'Workspaces',
        description: 'Seats management operations',
      },
      {
        name: 'Bookings',
        description: 'Booking management operations',
      },
      {
        name: 'Payments',
        description: 'Payment processing operations',
      },
      {
        name: 'Admin',
        description: 'Administrative operations',
      },
      {
        name: 'Leads',
        description: 'Lead management operations',
      },
      {
        name: 'Media',
        description: 'Media file management operations',
      },
      {
        name: 'Campaigns',
        description: 'Marketing campaign operations',
      },
      {
        name: 'Social Posts',
        description: 'Social media post operations',
      },
    ],
  },
  apis: ['./src/routes/*.js', './src/controllers/*.js'], // Path to the API docs
};

const specs = swaggerJsdoc(options);

module.exports = {
  specs,
  swaggerUi,
};
