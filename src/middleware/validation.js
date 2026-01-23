const Joi = require('joi');

const validate = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.body);

    if (error) {
      const message = error.details.map(detail => detail.message);
      return res.status(400).json({
        success: false,
        message: 'Validation Error',
        errors: message
      });
    }

    next();
  };
};

// Common validation schemas
const schemas = {
  // User schemas
  register: Joi.object({
    name: Joi.string().min(2).max(100).optional(),
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required(),
    firstName: Joi.string().min(2).max(100).required(),
    companyName: Joi.string().min(2).max(100).optional(),
    spaceName: Joi.string().min(2).max(100).optional(),
    lastName: Joi.string().min(2).max(100).required(),
    zipCode: Joi.string().optional().allow('', null),
    city: Joi.string().optional().allow('', null),
    state: Joi.string().optional().allow('', null),
    country: Joi.string().optional().allow('', null),
    website: Joi.string().optional().allow('', null),
    addressLine1: Joi.string().optional().allow('', null),
    addressLine2: Joi.string().optional().allow('', null),
    phone: Joi.string().pattern(/^[+]?[\d\s-()]+$/).optional().allow('', null),
    type: Joi.number().integer().valid(1, 2).optional(),
  }),

  login: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required(),
  }),

  updateProfile: Joi.object({
    name: Joi.string().min(2).max(100).optional(),
    firstName: Joi.string().min(2).max(100).optional(),
    lastName: Joi.string().min(2).max(100).optional(),
    companyName: Joi.string().min(2).max(100).optional(),
    zipCode: Joi.string().optional().allow('', null),
    city: Joi.string().optional().allow('', null),
    state: Joi.string().optional().allow('', null),
    country: Joi.string().optional().allow('', null),
    website: Joi.string().optional().allow('', null),
    addressLine1: Joi.string().optional().allow('', null),
    addressLine2: Joi.string().optional().allow('', null),
    phone: Joi.string().pattern(/^[+]?[\d\s-()]+$/).optional().allow('', null),
    avatar: Joi.string().optional().allow('', null),
  }),

  createUser: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required(),
    name: Joi.string().min(2).max(100).optional(),
    firstName: Joi.string().min(2).max(100).optional(),
    lastName: Joi.string().min(2).max(100).optional(),
    companyName: Joi.string().min(2).max(100).optional(),
    zipCode: Joi.string().optional().allow('', null),
    city: Joi.string().optional().allow('', null),
    state: Joi.string().optional().allow('', null),
    country: Joi.string().optional().allow('', null),
    website: Joi.string().optional().allow('', null),
    addressLine1: Joi.string().optional().allow('', null),
    addressLine2: Joi.string().optional().allow('', null),
    phone: Joi.string().pattern(/^[+]?[\d\s-()]+$/).optional().allow('', null),
    role: Joi.number().integer().valid(1, 2, 3).required(),
    tenantId: Joi.string().uuid().required(),
    status: Joi.number().integer().valid(1, 2, 3).optional(),
  }),

  updateUser: Joi.object({
    name: Joi.string().min(2).max(100).optional(),
    firstName: Joi.string().min(2).max(100).optional(),
    lastName: Joi.string().min(2).max(100).optional(),
    companyName: Joi.string().min(2).max(100).optional(),
    zipCode: Joi.string().optional().allow('', null),
    city: Joi.string().optional().allow('', null),
    state: Joi.string().optional().allow('', null),
    country: Joi.string().optional().allow('', null),
    website: Joi.string().optional().allow('', null),
    addressLine1: Joi.string().optional().allow('', null),
    addressLine2: Joi.string().optional().allow('', null),
    phone: Joi.string().pattern(/^[+]?[\d\s-()]+$/).optional().allow('', null),
    role: Joi.number().integer().valid(1, 2, 3).optional(),
    status: Joi.number().integer().valid(1, 2, 3).optional(),
    tenantId: Joi.string().uuid().optional(),
  }),

  // Seats schemas
  createWorkspace: Joi.object({
    name: Joi.string().min(2).max(100).required(),
    description: Joi.string().max(500).optional(),
    type: Joi.string().valid('DESK', 'OFFICE', 'MEETING_ROOM', 'EVENT_SPACE').required(),
    capacity: Joi.number().integer().min(1).required(),
    area: Joi.number().positive().optional(),
    hourlyRate: Joi.number().positive().required(),
    dailyRate: Joi.number().positive().required(),
    monthlyRate: Joi.number().positive().required(),
    features: Joi.array().items(Joi.string()).optional(),
    spaceId: Joi.string().required(),
  }),

  updateWorkspace: Joi.object({
    name: Joi.string().min(2).max(100).optional(),
    description: Joi.string().max(500).optional(),
    type: Joi.string().valid('DESK', 'OFFICE', 'MEETING_ROOM', 'EVENT_SPACE').optional(),
    capacity: Joi.number().integer().min(1).optional(),
    area: Joi.number().positive().optional(),
    hourlyRate: Joi.number().positive().optional(),
    dailyRate: Joi.number().positive().optional(),
    monthlyRate: Joi.number().positive().optional(),
    features: Joi.array().items(Joi.string()).optional(),
    isAvailable: Joi.boolean().optional(),
  }),

  // Booking schemas
  createBooking: Joi.object({
    tenantId: Joi.string().uuid().optional().allow('', null),
    userId: Joi.string().uuid().optional().allow('', null),
    unitId: Joi.string().uuid().required(),
    propertyId: Joi.string().uuid().optional().allow('', null),
    startAt: Joi.date().iso().required(),
    endAt: Joi.date().iso().greater(Joi.ref('startAt')).required(),
    status: Joi.number().integer().valid(1, 2, 3, 4, 5).optional(),
    paymentStatus: Joi.number().integer().valid(1, 2, 3).optional(),
    totalPrice: Joi.number().optional(),
    qrCode: Joi.string().optional().allow('', null),
    notes: Joi.string().max(1000).optional().allow(''),
    specialRequests: Joi.string().max(500).optional().allow(''),
    agentId: Joi.string().uuid().optional().allow('', null),
    customerInfo: Joi.object({
      name: Joi.string().optional(),
      email: Joi.string().email().optional(),
      phone: Joi.string().optional(),
      address: Joi.string().optional()
    }).optional()
  }),

  updateBooking: Joi.object({
    userId: Joi.string().uuid().optional().allow('', null),
    unitId: Joi.string().uuid().optional().allow('', null),
    propertyId: Joi.string().uuid().optional().allow('', null),
    startAt: Joi.date().iso().optional(),
    endAt: Joi.date().iso().optional(),
    status: Joi.number().integer().valid(1, 2, 3, 4, 5).optional(),
    paymentStatus: Joi.number().integer().valid(1, 2, 3).optional(),
    notes: Joi.string().max(1000).optional().allow(''),
    specialRequests: Joi.string().max(500).optional().allow(''),
    tenantId: Joi.string().uuid().optional().allow('', null),
    agentId: Joi.string().uuid().optional().allow('', null),
  }).custom((value, helpers) => {
    // Validate that if startAt and endAt are both provided, endAt is after startAt
    if (value.startAt && value.endAt) {
      if (new Date(value.endAt) <= new Date(value.startAt)) {
        return helpers.error('custom.dateOrder');
      }
    }
    return value;
  }).messages({
    'custom.dateOrder': 'endAt must be after startAt'
  }),

  // Space schemas
  createSpace: Joi.object({
    name: Joi.string().min(2).max(100).required(),
    description: Joi.string().max(1000).optional(),
    address: Joi.string().required(),
    city: Joi.string().required(),
    state: Joi.string().required(),
    zipCode: Joi.string().optional(),
    country: Joi.string().required(),
    latitude: Joi.number().min(-90).max(90).optional(),
    longitude: Joi.number().min(-180).max(180).optional(),
    phone: Joi.string().pattern(/^[+]?[\d\s-()]+$/).optional(),
    email: Joi.string().email().optional(),
    website: Joi.string().uri().optional(),
  }),

  updateSpace: Joi.object({
    name: Joi.string().min(2).max(100).optional(),
    description: Joi.string().max(1000).optional(),
    address: Joi.string().optional(),
    city: Joi.string().optional(),
    state: Joi.string().optional(),
    zipCode: Joi.string().optional(),
    country: Joi.string().optional(),
    latitude: Joi.number().min(-90).max(90).optional(),
    longitude: Joi.number().min(-180).max(180).optional(),
    phone: Joi.string().pattern(/^[+]?[\d\s-()]+$/).optional(),
    email: Joi.string().email().optional(),
    website: Joi.string().uri().optional(),
    isActive: Joi.boolean().optional(),
  }),

  // Review schemas
  createReview: Joi.object({
    bookingId: Joi.string().required(),
    rating: Joi.number().integer().min(1).max(5).required(),
    comment: Joi.string().max(1000).optional(),
  }),

  // Payment schemas
  processPayment: Joi.object({
    bookingId: Joi.string().required(),
    paymentMethod: Joi.string().required(),
    amount: Joi.number().positive().required(),
  }),

  // Property schemas
  createProperty: Joi.object({
    tenantId: Joi.string().uuid().required(),
    propertyType: Joi.number().integer().valid(1, 2, 3, 4).required(),
    title: Joi.string().min(2).max(200).required(),
    slug: Joi.string().min(2).max(100).optional().allow('', null),
    description: Joi.string().max(1000).optional().allow('', null),
    addressLine1: Joi.string().min(5).max(200).required(),
    addressLine2: Joi.string().max(200).optional().allow('', null),
    city: Joi.string().min(2).max(100).required(),
    state: Joi.string().min(2).max(100).required(),
    country: Joi.string().min(2).max(100).optional().allow('', null),
    postalCode: Joi.string().min(3).max(20).optional().allow('', null),
    latitude: Joi.number().optional().allow(null),
    longitude: Joi.number().optional().allow(null),
    status: Joi.number().integer().valid(1, 2, 3).optional(),
    mainImageId: Joi.string().uuid().optional().allow('', null),
    gallery: Joi.array().items(Joi.string().uuid()).optional().allow(null),
    area: Joi.number().integer().min(0).optional().allow(null),
    floorPlanId: Joi.string().uuid().optional().allow('', null),
    brochureId: Joi.string().uuid().optional().allow('', null),
    amenities: Joi.array().items(Joi.string().uuid()).optional().allow(null)
  }),

  updateProperty: Joi.object({
    tenantId: Joi.string().uuid().optional(),
    propertyType: Joi.number().integer().valid(1, 2, 3, 4).optional(),
    title: Joi.string().min(2).max(200).optional(),
    slug: Joi.string().min(2).max(100).optional().allow('', null),
    description: Joi.string().max(1000).optional().allow('', null),
    addressLine1: Joi.string().min(5).max(200).optional(),
    addressLine2: Joi.string().max(200).optional().allow('', null),
    city: Joi.string().min(2).max(100).optional(),
    state: Joi.string().min(2).max(100).optional(),
    country: Joi.string().min(2).max(100).optional(),
    postalCode: Joi.string().min(3).max(20).optional(),
    latitude: Joi.number().optional().allow(null),
    longitude: Joi.number().optional().allow(null),
    status: Joi.number().integer().valid(1, 2, 3).optional(),
    mainImageId: Joi.string().uuid().optional().allow('', null),
    gallery: Joi.array().items(Joi.string().uuid()).optional().allow(null),
    area: Joi.number().integer().min(0).optional().allow(null),
    floorPlanId: Joi.string().uuid().optional().allow('', null),
    brochureId: Joi.string().uuid().optional().allow('', null),
    amenities: Joi.array().items(Joi.string().uuid()).optional().allow(null)
  }),

  // Unit schemas
  createUnit: Joi.object({
    tenantId: Joi.string().uuid().required(),
    propertyId: Joi.string().uuid().required(),
    unitCategory: Joi.number().integer().valid(1, 2, 3, 4).required(),
    unitCode: Joi.string().min(1).max(50).optional().allow('', null),
    slug: Joi.string().min(2).max(100).optional().allow('', null),
    floorNo: Joi.number().integer().min(0).optional().allow(null),
    capacity: Joi.number().integer().min(0).optional().allow(null),
    sizeSqft: Joi.number().integer().min(0).optional().allow(null),
    status: Joi.number().integer().valid(1, 2, 3, 4).default(1),
    mainImageId: Joi.string().uuid().optional().allow('', null),
    gallery: Joi.array().items(Joi.string().uuid()).optional().allow(null),
    hourlyRate: Joi.number().optional(),
    dailyRate: Joi.number().optional(),
    monthlyRate: Joi.number().optional(),
    currency: Joi.string().optional()
  }),

  updateUnit: Joi.object({
    tenantId: Joi.string().uuid().optional(),
    propertyId: Joi.string().uuid().optional(),
    unitCategory: Joi.number().integer().valid(1, 2, 3, 4).optional(),
    unitCode: Joi.string().min(1).max(50).optional().allow('', null),
    slug: Joi.string().min(2).max(100).optional().allow('', null),
    floorNo: Joi.number().integer().min(0).optional().allow(null),
    capacity: Joi.number().integer().min(0).optional().allow(null),
    sizeSqft: Joi.number().integer().min(0).optional().allow(null),
    status: Joi.number().integer().valid(1, 2, 3, 4).optional(),
    mainImageId: Joi.string().uuid().optional().allow('', null),
    gallery: Joi.array().items(Joi.string().uuid()).optional().allow(null),
    unitPricing: Joi.array().items(Joi.object({
      price: Joi.number().required(),
      pricingModel: Joi.number().required(),
      currency: Joi.string().optional()
    })).optional(),
    hourlyRate: Joi.number().optional(),
    dailyRate: Joi.number().optional(),
    monthlyRate: Joi.number().optional(),
    currency: Joi.string().optional()
  }),

  // Lead schemas
  createLead: Joi.object({
    tenantId: Joi.string().uuid().required(),
    name: Joi.string().min(2).max(100).required(),
    email: Joi.string().email().required(),
    phone: Joi.string().min(5).max(20).optional().allow('', null),
    company: Joi.string().max(100).optional().allow('', null),
    message: Joi.string().max(1000).optional().allow('', null),
    source: Joi.alternatives().try(
      Joi.number().integer().valid(1, 2, 3, 4, 5, 6),
      Joi.string().valid('website', 'phone', 'email', 'referral', 'social', 'other')
    ).default(1),
    status: Joi.number().integer().valid(1, 2, 3, 4, 5).optional().default(1),
    priority: Joi.number().integer().valid(1, 2, 3).optional().default(2),
    unitId: Joi.string().uuid().optional().allow('', null),
    budget: Joi.number().min(0).optional().allow(null),
    preferredDate: Joi.date().optional().allow(null),
    notes: Joi.string().max(1000).optional().allow('', null),
    agentId: Joi.string().uuid().optional().allow('', null),
  }),

  updateLead: Joi.object({
    tenantId: Joi.string().uuid().optional(),
    name: Joi.string().min(2).max(100).optional(),
    email: Joi.string().email().optional(),
    phone: Joi.string().min(5).max(20).optional().allow('', null),
    company: Joi.string().max(100).optional().allow('', null),
    message: Joi.string().max(1000).optional().allow('', null),
    source: Joi.alternatives().try(
      Joi.number().integer().valid(1, 2, 3, 4, 5, 6),
      Joi.string().valid('website', 'phone', 'email', 'referral', 'social', 'other')
    ).optional(),
    status: Joi.number().integer().valid(1, 2, 3, 4, 5).optional(),
    priority: Joi.number().integer().valid(1, 2, 3).optional(),
    unitId: Joi.string().uuid().optional().allow('', null),
    budget: Joi.number().min(0).optional().allow(null),
    preferredDate: Joi.date().optional().allow(null),
    notes: Joi.string().max(1000).optional().allow('', null),
    agentId: Joi.string().uuid().optional().allow('', null),
  }),

  updateLeadStatus: Joi.object({
    tenantId: Joi.string().uuid().required(),
    status: Joi.number().integer().valid(1, 2, 3, 4, 5).required(), // 1: new, 2: contacted, 3: qualified, 4: converted, 5: lost
    notes: Joi.string().max(1000).optional(),
  }),
};

module.exports = {
  validate,
  schemas,
};
