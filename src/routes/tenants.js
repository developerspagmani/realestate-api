const express = require('express');
const { prisma } = require('../config/database');
const { auth, authorize } = require('../middleware/auth');

const router = express.Router();

// All routes protected by auth
router.use(auth);

// Get all tenants (Admin only) — SEC-03 fix: added authorize
router.get('/', authorize('ADMIN'), async (req, res) => {
  try {
    const { type } = req.query;
    const where = {};
    if (type) where.type = parseInt(type);

    const tenants = await prisma.tenant.findMany({
      where,
      include: {
        _count: {
          select: {
            users: true,
            properties: true,
            units: true,
            bookings: true,
          }
        }
      }
    });
    res.json({ success: true, data: tenants });
  } catch (error) {
    console.error('Get all tenants error:', error);
    res.status(500).json({ success: false, message: 'Server error fetching tenants' });
  }
});

// Get tenant by ID — SEC-03 fix: restrict to own tenant or ADMIN
router.get('/:id', async (req, res) => {
  try {
    // Non-admin users can only view their own tenant
    if (req.user.role !== 2 && req.user.tenantId !== req.params.id) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: req.params.id },
      include: {
        plan: true,
        licenseKey: true,
        _count: {
          select: {
            users: true,
            properties: true,
            units: true,
            bookings: true,
          }
        }
      }
    });

    if (!tenant) {
      return res.status(404).json({ success: false, message: 'Tenant not found' });
    }

    res.json({ success: true, data: tenant });
  } catch (error) {
    console.error('Get tenant error:', error);
    res.status(500).json({ success: false, message: 'Server error fetching tenant' });
  }
});

// Create new tenant — SEC-03 fix: Admin only + input validation
router.post('/', authorize('ADMIN'), async (req, res) => {
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
        type: type || 1,
        plan: plan || 'basic',
        settings: settings || {},
        status: 1
      },
    });
    res.status(201).json({ success: true, data: tenant });
  } catch (error) {
    console.error('Create tenant error:', error);
    res.status(400).json({ success: false, message: 'Error creating tenant' });
  }
});

// Update tenant — SEC-03 fix: Admin only + explicit field extraction
router.put('/:id', async (req, res) => {
  try {
    // Non-admin users can only update their own tenant
    if (req.user.role !== 2 && req.user.tenantId !== req.params.id) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    // Only OWNERS (3) or ADMINS (2) can update
    if (req.user.role !== 2 && req.user.role !== 3) {
      return res.status(403).json({ success: false, message: 'Insufficient permissions' });
    }

    const { name, type, plan, settings, status, address, city, state, country, postalCode } = req.body;

    const tenant = await prisma.tenant.update({
      where: { id: req.params.id },
      data: {
        ...(name && { name }),
        ...(type !== undefined && { type }),
        ...(plan && { plan }),
        ...(settings && { settings }),
        ...(status !== undefined && { status }),
        ...(address && { address }),
        ...(city && { city }),
        ...(state && { state }),
        ...(country && { country }),
        ...(postalCode && { postalCode }),
      },
    });
    res.json({ success: true, data: tenant });
  } catch (error) {
    console.error('Update tenant error:', error);
    res.status(400).json({ success: false, message: 'Error updating tenant' });
  }
});

// Delete tenant — SEC-03 fix: Admin only
router.delete('/:id', authorize('ADMIN'), async (req, res) => {
  try {
    // Check for dependent resources before deleting
    const [propertyCount, userCount] = await Promise.all([
      prisma.property.count({ where: { tenantId: req.params.id } }),
      prisma.user.count({ where: { tenantId: req.params.id } }),
    ]);

    if (propertyCount > 0 || userCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete tenant with existing properties (${propertyCount}) or users (${userCount}).`
      });
    }

    await prisma.tenant.delete({
      where: { id: req.params.id },
    });
    res.status(200).json({ success: true, message: 'Tenant deleted' });
  } catch (error) {
    console.error('Delete tenant error:', error);
    res.status(400).json({ success: false, message: 'Error deleting tenant' });
  }
});

module.exports = router;
