const { prisma } = require('../config/database');

// Get tenant by domain
const getTenantByDomain = async (req, res, next) => {
  try {
    const identifier = req.headers['x-tenant-domain'] || req.headers.host?.split(':')[0];

    if (!identifier) {
      return res.status(400).json({
        success: false,
        message: 'Tenant identifier is required'
      });
    }

    let tenant;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);

    if (isUuid) {
      tenant = await prisma.tenant.findUnique({
        where: { id: identifier }
      });
    } else {
      tenant = await prisma.tenant.findUnique({
        where: { domain: identifier }
      });
    }

    if (!tenant) {
      return res.status(404).json({
        success: false,
        message: 'Tenant not found'
      });
    }

    // Attach tenant to request for downstream use
    req.tenant = tenant;
    next();
  } catch (error) {
    console.error('Get tenant error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching tenant'
    });
  }
};

// Middleware to attach tenant to all requests
const tenantMiddleware = async (req, res, next) => {
  try {
    const identifier = req.headers['x-tenant-domain'] || req.headers.host?.split(':')[0];

    if (!identifier) {
      // For some global operations, identifier might be missing.
      // Controllers should handle missing req.tenant if they need it.
      return next();
    }

    let tenant;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);

    if (isUuid) {
      tenant = await prisma.tenant.findUnique({
        where: { id: identifier }
      });
    } else {
      tenant = await prisma.tenant.findUnique({
        where: { domain: identifier }
      });
    }

    if (!tenant) {
      // If tenant not found, we don't attach it but we let the request continue.
      // Controllers that require a tenant should check for req.tenant.
      return next();
    }

    // Attach tenant and database connection to request
    req.tenant = tenant;
    req.prisma = prisma;

    next();
  } catch (error) {
    console.error('Tenant middleware error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error (middleware)',
      debug: error.message
    });
  }
};

// Create new tenant
const createTenant = async (req, res) => {
  try {
    const { name, domain, type, plan, settings } = req.body;

    if (!name || !domain) {
      return res.status(400).json({
        success: false,
        message: 'Name and domain are required'
      });
    }

    // Check if domain already exists
    const existingTenant = await prisma.tenant.findUnique({
      where: { domain }
    });

    if (existingTenant) {
      return res.status(400).json({
        success: false,
        message: 'Domain already exists'
      });
    }

    const tenant = await prisma.tenant.create({
      data: {
        name,
        domain,
        type: type || 'standard',
        plan: plan || 'basic',
        settings: settings || {},
        status: 'active'
      }
    });

    res.status(201).json({
      success: true,
      message: 'Tenant created successfully',
      data: { tenant }
    });
  } catch (error) {
    console.error('Create tenant error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error creating tenant'
    });
  }
};

// Get all tenants (Super Admin only)
const getAllTenants = async (req, res) => {
  try {
    const { type } = req.query;
    const where = {};
    if (type) where.type = parseInt(type);

    const tenants = await prisma.tenant.findMany({
      where,
      orderBy: { createdAt: 'desc' }
    });

    res.status(200).json({
      success: true,
      data: tenants // Return directly as array for easier consumption or consistent with other controllers
    });
  } catch (error) {
    console.error('Get all tenants error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching tenants'
    });
  }
};

// Update tenant
const updateTenant = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, type, plan, settings, status } = req.body;

    const tenant = await prisma.tenant.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(type && { type }),
        ...(plan && { plan }),
        ...(settings && { settings }),
        ...(status && { status })
      }
    });

    res.status(200).json({
      success: true,
      message: 'Tenant updated successfully',
      data: { tenant }
    });
  } catch (error) {
    console.error('Update tenant error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error updating tenant'
    });
  }
};

// Delete tenant
const deleteTenant = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if tenant has dependencies
    const properties = await prisma.property.count({
      where: { tenant_id: id }
    });

    const users = await prisma.user.count({
      where: { tenant_id: id }
    });

    if (properties > 0 || users > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete tenant with existing properties or users'
      });
    }

    await prisma.tenant.delete({
      where: { id }
    });

    res.status(200).json({
      success: true,
      message: 'Tenant deleted successfully'
    });
  } catch (error) {
    console.error('Delete tenant error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error deleting tenant'
    });
  }
};

module.exports = {
  getTenantByDomain,
  tenantMiddleware,
  createTenant,
  getAllTenants,
  updateTenant,
  deleteTenant
};
