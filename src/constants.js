/**
 * Application-wide constants
 * Replaces magic numbers throughout the codebase for better readability and maintainability.
 */

const UserRole = Object.freeze({
  USER: 1,
  ADMIN: 2,
  OWNER: 3,
  AGENT: 4,
});

const BookingStatus = Object.freeze({
  PENDING: 1,
  CONFIRMED: 2,
  CANCELLED: 3,
  COMPLETED: 4,
  NO_SHOW: 5,
});

const PaymentStatus = Object.freeze({
  PENDING: 1,
  PAID: 2,
  REFUNDED: 3,
});

const UserStatus = Object.freeze({
  ACTIVE: 1,
  INACTIVE: 2,     // Pending verification
  SUSPENDED: 3,
});

const PropertyType = Object.freeze({
  RESIDENTIAL: 1,
  COMMERCIAL: 2,
  INDUSTRIAL: 3,
  MIXED: 4,
});

const PropertyStatus = Object.freeze({
  ACTIVE: 1,
  INACTIVE: 2,
  ARCHIVED: 3,
});

const UnitStatus = Object.freeze({
  AVAILABLE: 1,
  OCCUPIED: 2,
  MAINTENANCE: 3,
  INACTIVE: 4,
});

const UnitCategory = Object.freeze({
  RESIDENTIAL: 1,
  COMMERCIAL: 2,
  INDUSTRIAL: 3,
  MIXED: 4,
});

const PricingModel = Object.freeze({
  FIXED: 1,
  HOURLY: 2,
  DAILY: 3,
  MONTHLY: 4,
  YEARLY: 5,
});

const LeadStatus = Object.freeze({
  NEW: 1,
  CONTACTED: 2,
  QUALIFIED: 3,
  CONVERTED: 4,
  LOST: 5,
});

const LeadPriority = Object.freeze({
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
});

const TenantStatus = Object.freeze({
  ACTIVE: 1,
  INACTIVE: 2,
  SUSPENDED: 3,
});

const AgentStatus = Object.freeze({
  ACTIVE: 1,
  INACTIVE: 2,
  ON_LEAVE: 3,
});

const ModuleStatus = Object.freeze({
  ACTIVE: 1,
  MAINTENANCE: 2,
  DISABLED: 3,
});

const CampaignStatus = Object.freeze({
  DRAFT: 1,
  SCHEDULED: 2,
  SENDING: 3,
  SENT: 4,
  FAILED: 5,
  CANCELLED: 6,
});

// Allowed MIME types for file uploads
const ALLOWED_MIME_TYPES = Object.freeze([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'video/mp4',
  'video/webm',
  'audio/mpeg',
  'audio/wav',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

// Max file upload size in bytes (10MB)
const MAX_FILE_SIZE = 10 * 1024 * 1024;

module.exports = {
  UserRole,
  BookingStatus,
  PaymentStatus,
  UserStatus,
  PropertyType,
  PropertyStatus,
  UnitStatus,
  UnitCategory,
  PricingModel,
  LeadStatus,
  LeadPriority,
  TenantStatus,
  AgentStatus,
  ModuleStatus,
  CampaignStatus,
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE,
};
