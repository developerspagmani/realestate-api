const express = require('express');
const { prisma } = require('../config/database');
const { auth, authorize } = require('../middleware/auth');

const router = express.Router();

// All routes protected by auth
router.use(auth);

// Get all tenants (Admin only)
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
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get tenant by ID
router.get('/:id', async (req, res) => {
  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: req.params.id },
      include: {
        users: true,
        properties: true,
        units: true,
        bookings: true,
      }
    });

    if (!tenant) {
      return res.status(404).json({ success: false, error: 'Tenant not found' });
    }

    res.json({ success: true, data: tenant });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create new tenant
router.post('/', async (req, res) => {
  try {
    const tenant = await prisma.tenant.create({
      data: req.body,
    });
    res.status(201).json({ success: true, data: tenant });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Update tenant
router.put('/:id', async (req, res) => {
  try {
    const tenant = await prisma.tenant.update({
      where: { id: req.params.id },
      data: req.body,
    });
    res.json({ success: true, data: tenant });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Delete tenant
router.delete('/:id', async (req, res) => {
  try {
    await prisma.tenant.delete({
      where: { id: req.params.id },
    });
    res.status(200).json({ success: true, message: 'Tenant deleted' });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

module.exports = router;
