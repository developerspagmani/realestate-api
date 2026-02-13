const { prisma } = require('../config/database');
const { calculateCommission } = require('./commissionController');
const { sendBookingEmail } = require('../utils/emailService');

const calculateTotalPrice = (startAt, endAt, unit) => {
  // Real estate visits are free by default
  if (!unit || !unit.unitPricing || unit.unitPricing.length === 0) {
    return 0;
  }

  try {
    let totalPrice = 0;
    const start = new Date(startAt);
    const end = new Date(endAt);

    // Safety check for invalid dates
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0;

    const hours = Math.ceil((end - start) / (1000 * 60 * 60));
    if (hours <= 0) return 0;

    // Ensure we have at least 1 unit of time
    const days = Math.max(1, Math.ceil(hours / 24));
    const months = Math.max(1, Math.ceil(days / 30));

    const pricing = unit.unitPricing[0];
    switch (pricing.pricingModel) {
      case 2: // hourly
        totalPrice = parseFloat(pricing.price) * Math.max(1, hours);
        break;
      case 3: // daily
        totalPrice = parseFloat(pricing.price) * days;
        break;
      case 4: // monthly
        totalPrice = parseFloat(pricing.price) * months;
        break;
      case 1: // fixed
      default:
        totalPrice = parseFloat(pricing.price);
        break;
    }
    return totalPrice;
  } catch (err) {
    console.error('Error calculating total price:', err);
    return 0;
  }
};

// Create booking with ACID transaction
const createBooking = async (req, res) => {
  try {
    const {
      unitId,
      startAt,
      endAt,
      specialRequests,
      tenantId: bodyTenantId,
      status,
      paymentStatus,
      notes,
      userId: bodyUserId,
      agentId,
      customerInfo,
      guestName,
      guestEmail,
      guestPhone,
      totalPrice: bodyTotalPrice,
      qrCode: bodyQrCode
    } = req.body;

    const isAdmin = req.user.role === 2;
    // SEC-01 fix: Force tenantId from user context for non-admins to prevent IDOR
    const tenantId = (isAdmin && bodyTenantId) ? bodyTenantId : req.user.tenantId;

    if (!tenantId) {
      return res.status(400).json({ success: false, message: 'Tenant ID is required' });
    }

    // If Admin/Owner, they can specify a different userId. Otherwise use req.user.id
    let userId = req.user.id;
    if (bodyUserId && [2, 3].includes(req.user.role)) {
      userId = bodyUserId;
    }

    // Start transaction for ACID compliance
    const result = await prisma.$transaction(async (tx) => {
      // Check unit availability
      const conflictingBookings = await tx.booking.findMany({
        where: {
          unitId,
          status: { in: [2, 4] }, // 2: confirmed, 4: completed
          OR: [
            {
              startAt: { lte: new Date(endAt) },
              endAt: { gte: new Date(startAt) }
            }
          ]
        }
      });

      if (conflictingBookings.length > 0) {
        throw new Error('Unit is not available for the selected dates');
      }

      // Get unit details
      const unit = await tx.unit.findUnique({
        where: { id: unitId },
        include: {
          property: true,
          unitPricing: true
        }
      });

      if (!unit) {
        throw new Error('Unit not found');
      }

      // Calculate total price based on unit pricing, or use provided price if quotaion matched
      let finalPrice = calculateTotalPrice(startAt, endAt, unit);
      if (bodyTotalPrice) {
        // If provided price is roughly same as calculated (allowing for tax/discounts), use it
        finalPrice = parseFloat(bodyTotalPrice);
      }

      // Format customer info into notes if available
      let finalNotes = notes || '';
      if (customerInfo) {
        const infoStr = `\n--- Customer Billing Details ---\nName: ${customerInfo.name}\nEmail: ${customerInfo.email}\nPhone: ${customerInfo.phone}\nAddress: ${customerInfo.address}\n-------------------------------`;
        finalNotes = finalNotes ? `${finalNotes}\n${infoStr}` : infoStr;
      }

      // Generate QR Code reference if not provided
      const qrReference = bodyQrCode || 'BK-' + Math.random().toString(36).substr(2, 9).toUpperCase();

      // Process Lead mapping if guest email is provided
      let leadId = null;
      if (guestEmail) {
        // Try to find existing lead by email in this tenant
        let lead = await tx.lead.findFirst({
          where: { email: guestEmail, tenantId }
        });

        if (lead) {
          // Update existing lead with latest contact info if provided
          lead = await tx.lead.update({
            where: { id: lead.id },
            data: {
              name: guestName || lead.name,
              phone: guestPhone || lead.phone,
              // If lead doesn't have a userId yet, check if a user exists with this email
              userId: lead.userId || (await tx.user.findUnique({ where: { email: guestEmail }, select: { id: true } }))?.id || null,
              status: lead.status === 5 ? 1 : lead.status
            }
          });
        } else {
          // Check if a user exists with this email to link them
          const existingUser = await tx.user.findUnique({ where: { email: guestEmail }, select: { id: true } });

          // Create new lead
          lead = await tx.lead.create({
            data: {
              tenantId,
              name: guestName || 'Guest',
              email: guestEmail,
              phone: guestPhone || null,
              userId: existingUser?.id || null,
              source: 1, // website
              status: 1, // new
              unitId: unitId,
              propertyId: unit.propertyId,
              notes: `Auto-generated from visit schedule for unit ${unit.unitCode}`
            }
          });
        }
        leadId = lead.id;
      }

      // Create booking
      const booking = await tx.booking.create({
        data: {
          tenantId,
          unitId,
          userId: (bodyUserId && bodyUserId !== '') ? bodyUserId : (req.user.role === 1 ? req.user.id : null),
          leadId: leadId,
          agentId: (agentId && agentId !== '') ? agentId : null,
          guestName: guestName || null,
          guestEmail: guestEmail || null,
          guestPhone: guestPhone || null,
          startAt: new Date(startAt),
          endAt: new Date(endAt),
          status: status !== undefined ? parseInt(status) : 1, // pending
          totalPrice: finalPrice,
          qrCode: qrReference,
          specialRequests,
          notes: finalNotes,
          paymentStatus: paymentStatus !== undefined ? parseInt(paymentStatus) : 1, // pending
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
            }
          },
          unit: {
            select: {
              id: true,
              unitCode: true,
              unitCategory: true,
              property: {
                select: {
                  id: true,
                  title: true,
                  city: true,
                  addressLine1: true,
                }
              }
            }
          },
          agent: {
            select: {
              id: true,
              user: {
                select: {
                  name: true,
                  firstName: true,
                  lastName: true,
                  email: true
                }
              }
            }
          },
          tenant: {
            select: {
              id: true,
              name: true,
              type: true,
            }
          }
        }
      });

      return { booking, totalPrice: finalPrice };
    });

    // Send Notification if enabled in tenant settings
    try {
      const tenant = await prisma.tenant.findUnique({ where: { id: result.booking.tenantId } });
      const settings = tenant?.settings || {};
      if (settings.notifications?.emailBookings && result.booking.user?.email) {
        await sendBookingEmail(result.booking.user.email, result.booking.user.name, {
          unitCode: result.booking.unit.unitCode,
          propertyName: result.booking.unit.property.title,
          date: result.booking.startAt.toLocaleDateString(),
          price: result.booking.totalPrice,
          status: 'Confirmed'
        });
      }
    } catch (emailError) {
      console.error('Error in booking email notification:', emailError);
    }

    res.status(201).json({
      success: true,
      message: 'Booking created successfully',
      data: {
        booking: result.booking,
        totalPrice: result.totalPrice
      }
    });
  } catch (error) {
    console.error('Create booking error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error creating booking'
    });
  }
};

// Get booking by ID
const getBookingById = async (req, res) => {
  try {
    const { id } = req.params;
    const { tenantId: queryTenantId } = req.query;

    const isAdmin = req.user.role === 2;
    // SEC-01 fix: Force tenantId from user context for non-admins to prevent IDOR
    const tenantId = (isAdmin && queryTenantId) ? queryTenantId : req.user.tenantId;

    // Build where clause with tenant and role-based access
    const where = { id };

    if (tenantId) {
      where.tenantId = tenantId;
    } else if (!isAdmin) {
      return res.status(400).json({
        success: false,
        message: 'Tenant ID is required'
      });
    }

    // Regular users can only see their own bookings (only if auth is enabled)
    if (req.user && req.user.role === 1) {
      where.userId = req.user.id;
    }

    const booking = await prisma.booking.findFirst({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          }
        },
        unit: {
          include: {
            property: {
              select: {
                id: true,
                title: true,
                city: true,
                addressLine1: true,
              }
            },
            tenant: {
              select: {
                id: true,
                name: true,
              }
            }
          }
        },
        agent: {
          select: {
            id: true,
            user: {
              select: {
                name: true,
                firstName: true,
                lastName: true,
                email: true
              }
            }
          }
        },
        tenant: {
          select: {
            id: true,
            name: true,
          }
        }
      }
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    res.status(200).json({
      success: true,
      data: { booking }
    });
  } catch (error) {
    console.error('Get booking error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching booking'
    });
  }
};

// Update booking status (Admin/Owner only)
const updateBookingStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const { tenantId: queryTenantId } = req.query;

    const isAdmin = req.user.role === 2;
    // SEC-01 fix: Force tenantId from user context for non-admins to prevent IDOR
    const effectiveTenantId = (isAdmin && queryTenantId) ? queryTenantId : req.user.tenantId;

    // Validate status as integer
    const statusInt = parseInt(status);
    if (![1, 2, 3, 4, 5].includes(statusInt)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid booking status'
      });
    }

    // Start transaction for ACID compliance
    const booking = await prisma.$transaction(async (tx) => {
      // Build where clause with tenant filtering
      const where = { id };

      if (effectiveTenantId) {
        where.tenantId = effectiveTenantId;
      } else if (!isAdmin) {
        throw new Error('Tenant ID is required');
      }

      const updatedBooking = await tx.booking.update({
        where,
        data: { status: statusInt },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            }
          },
          unit: {
            select: {
              id: true,
              unitCode: true,
            }
          }
        }
      });

      return updatedBooking;
    });

    const statusLabels = {
      1: 'pending',
      2: 'confirmed',
      3: 'cancelled',
      4: 'completed',
      5: 'no show'
    };

    // Trigger Commission Calculation if Confirmed or Completed
    if (statusInt === 2 || statusInt === 4) {
      // Run in background, don't await response
      calculateCommission(booking.id).catch(err => console.error('Commission trigger error:', err));
    }

    // Send Notification for Confirmation
    if (statusInt === 2) {
      try {
        const tenant = await prisma.tenant.findUnique({ where: { id: booking.tenantId } });
        const settings = tenant?.settings || {};
        if (settings.notifications?.emailBookings && booking.user?.email) {
          await sendBookingEmail(booking.user.email, booking.user.name, {
            unitCode: booking.unit.unitCode,
            date: booking.startAt ? new Date(booking.startAt).toLocaleDateString() : 'N/A',
            price: booking.totalPrice,
            status: 'Confirmed'
          });
        }
      } catch (emailError) {
        console.error('Error in status update email notification:', emailError);
      }
    }

    res.status(200).json({
      success: true,
      message: `Booking ${statusLabels[statusInt] || 'updated'} successfully`,
      data: { booking }
    });
  } catch (error) {
    console.error('Update booking status error:', error);
    if (error.code === 'P2025') {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }
    res.status(500).json({
      success: false,
      message: 'Server error updating booking'
    });
  }
};

// Update booking (Admin/Owner only)
const updateBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      startAt,
      endAt,
      status,
      notes,
      specialRequests,
      paymentStatus,
      userId,
      unitId,
      agentId,
      propertyId,
      guestName,
      guestEmail,
      guestPhone,
      tenantId: queryTenantId
    } = req.body;

    const isAdmin = req.user.role === 2;
    // SEC-01 fix: Force tenantId from user context for non-admins to prevent IDOR
    const effectiveTenantId = (isAdmin && queryTenantId) ? queryTenantId : req.user.tenantId;

    // Start transaction for ACID compliance
    const booking = await prisma.$transaction(async (tx) => {
      // Build where clause with tenant filtering
      const where = { id };

      if (effectiveTenantId) {
        where.tenantId = effectiveTenantId;
      } else if (!isAdmin) {
        throw new Error('Tenant ID is required');
      }

      // Get existing booking first
      const existingBooking = await tx.booking.findUnique({
        where,
        include: {
          unit: {
            include: { unitPricing: true }
          },
          user: true
        }
      });

      if (!existingBooking) {
        throw new Error('Booking not found');
      }

      // Check if booking can be updated
      if (existingBooking.status === 3 || existingBooking.status === 4) {
        throw new Error('Cannot update cancelled or completed booking');
      }

      // If updating dates, check availability
      if (startAt && endAt) {
        const conflictingBookings = await tx.booking.findMany({
          where: {
            id: { not: id }, // Exclude current booking
            unitId: existingBooking.unitId,
            status: { in: [2, 4] }, // 2: confirmed, 4: completed
            OR: [
              {
                startAt: { lte: new Date(endAt) },
                endAt: { gte: new Date(startAt) }
              }
            ]
          }
        });

        if (conflictingBookings.length > 0) {
          throw new Error('Unit is not available for the selected dates');
        }
      }

      // Prepare update data
      const updateData = {};
      if (startAt) updateData.startAt = new Date(startAt);
      if (endAt) updateData.endAt = new Date(endAt);
      if (status !== undefined) {
        const statusInt = parseInt(status);
        if (![1, 2, 3, 4, 5].includes(statusInt)) {
          throw new Error('Invalid booking status');
        }
        updateData.status = statusInt;
      }
      if (paymentStatus !== undefined) updateData.paymentStatus = parseInt(paymentStatus);
      if (userId) updateData.userId = userId === '' ? null : userId;
      if (unitId) updateData.unitId = unitId === '' ? null : unitId;
      if (propertyId) updateData.propertyId = propertyId === '' ? null : propertyId;
      if (agentId !== undefined) updateData.agentId = agentId === '' ? null : agentId;
      if (notes !== undefined) updateData.notes = notes;
      if (specialRequests !== undefined) updateData.specialRequests = specialRequests;

      // Calculate totalPrice if dates or unit are changed
      if (startAt || endAt || unitId) {
        let pricingUnit = existingBooking.unit;

        // If unit changed, fetch new unit for pricing
        if (unitId && unitId !== existingBooking.unitId) {
          pricingUnit = await tx.unit.findUnique({
            where: { id: unitId },
            include: { unitPricing: true }
          });
        }

        const effectiveStart = startAt ? new Date(startAt) : existingBooking.startAt;
        const effectiveEnd = endAt ? new Date(endAt) : existingBooking.endAt;

        updateData.totalPrice = calculateTotalPrice(effectiveStart, effectiveEnd, pricingUnit);
      }

      // Handle guest info and Lead mapping (Automated Sync)
      const effectiveGuestEmail = guestEmail !== undefined ? guestEmail : existingBooking.guestEmail;

      if (effectiveGuestEmail) {
        // Always ensure we have a lead linked and it's updated with latest info
        let lead = await tx.lead.findFirst({
          where: { email: effectiveGuestEmail, tenantId: existingBooking.tenantId }
        });

        if (lead) {
          // Update lead with latest provided info
          lead = await tx.lead.update({
            where: { id: lead.id },
            data: {
              name: guestName || lead.name,
              phone: guestPhone || lead.phone,
              userId: lead.userId || (await tx.user.findUnique({ where: { email: effectiveGuestEmail }, select: { id: true } }))?.id || null,
              status: lead.status === 5 ? 1 : lead.status
            }
          });
        } else {
          // Check for user
          const existingUser = await tx.user.findUnique({ where: { email: effectiveGuestEmail }, select: { id: true } });

          // Create lead if it doesn't exist but we have an email
          lead = await tx.lead.create({
            data: {
              tenantId: existingBooking.tenantId,
              name: guestName || existingBooking.guestName || 'Guest',
              email: effectiveGuestEmail,
              phone: guestPhone || existingBooking.guestPhone || null,
              userId: existingUser?.id || null,
              source: 1,
              status: 1,
              unitId: unitId || existingBooking.unitId,
              propertyId: propertyId || existingBooking.propertyId,
              notes: `Auto-generated from updated visit schedule`
            }
          });
        }
        updateData.leadId = lead.id;
      }

      if (guestName !== undefined) updateData.guestName = guestName;
      if (guestEmail !== undefined) updateData.guestEmail = guestEmail;
      if (guestPhone !== undefined) updateData.guestPhone = guestPhone;

      // Update booking
      const updatedBooking = await tx.booking.update({
        where,
        data: updateData,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
            }
          },
          unit: {
            select: {
              id: true,
              unitCode: true,
              unitCategory: true,
              property: {
                select: {
                  id: true,
                  title: true,
                  city: true,
                  addressLine1: true,
                  addressLine2: true,
                }
              }
            }
          },
          property: {
            select: {
              id: true,
              title: true,
              city: true,
              addressLine1: true,
              addressLine2: true,
            }
          },
          agent: {
            select: {
              id: true,
              user: {
                select: {
                  name: true,
                  firstName: true,
                  lastName: true,
                  email: true
                }
              }
            }
          },
          tenant: {
            select: {
              id: true,
              name: true,
              type: true,
            }
          }
        }
      });

      return updatedBooking;
    });

    res.status(200).json({
      success: true,
      message: 'Booking updated successfully',
      data: { booking }
    });
  } catch (error) {
    console.error('Update booking error:', error);
    if (error.code === 'P2025') {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }
    res.status(500).json({
      success: false,
      message: error.message || 'Server error updating booking'
    });
  }
};

// Cancel booking (User or Admin)
const cancelBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const { tenantId } = req.query;
    const isAdmin = req.user.role === 2;
    // SEC-01 fix: Force tenantId from user context for non-admins to prevent IDOR
    const effectiveTenantId = (isAdmin && tenantId) ? tenantId : req.user.tenantId;

    // Start transaction for ACID compliance
    const booking = await prisma.$transaction(async (tx) => {
      // Build where clause with tenant filtering
      const where = { id };

      if (effectiveTenantId) {
        where.tenantId = effectiveTenantId;
      } else if (!isAdmin) {
        throw new Error('Tenant ID is required');
      }

      // Get booking first
      const existingBooking = await tx.booking.findUnique({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            }
          },
          unit: {
            select: {
              id: true,
              unitCode: true,
            }
          }
        }
      });

      if (!existingBooking) {
        throw new Error('Booking not found');
      }

      // Check permissions (using integer roles)
      if (existingBooking.userId !== req.user.id && ![2, 3].includes(req.user.role)) {
        throw new Error('Access denied');
      }

      // Check if booking can be cancelled (using integer status)
      if (existingBooking.status === 3 || existingBooking.status === 4) {
        throw new Error('Booking cannot be cancelled');
      }

      // Update booking status
      const updatedBooking = await tx.booking.update({
        where: { id },
        data: {
          status: 3  // cancelled
        }
      });

      return updatedBooking;
    });

    res.status(200).json({
      success: true,
      message: 'Booking cancelled successfully',
      data: { booking }
    });
  } catch (error) {
    console.error('Cancel booking error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error cancelling booking'
    });
  }
};

// Check unit availability
const checkAvailability = async (req, res) => {
  try {
    const { unitId, startAt, endAt, bookingId } = req.query;
    const { tenantId } = req.query;

    if (!unitId || !startAt || !endAt) {
      return res.status(400).json({ success: false, message: 'Missing required parameters' });
    }

    const where = {
      unitId,
      status: { in: [2, 4] }, // 2: confirmed, 4: completed
      OR: [
        {
          startAt: { lte: new Date(endAt) },
          endAt: { gte: new Date(startAt) }
        }
      ]
    };

    // If we're editing, exclude the current booking
    if (bookingId) {
      where.id = { not: bookingId };
    }

    // Add tenant filtering
    if (tenantId) {
      where.tenantId = tenantId;
    } else if (req.user && req.user.role !== 3 && req.user.tenantId) {
      where.tenantId = req.user.tenantId;
    }

    const conflictingBookings = await prisma.booking.findMany({
      where,
      include: {
        user: { select: { name: true } }
      }
    });

    let estimatedPrice = 0;
    try {
      const unit = await prisma.unit.findUnique({
        where: { id: unitId },
        include: { unitPricing: true }
      });
      if (unit) {
        estimatedPrice = calculateTotalPrice(startAt, endAt, unit);
      }
    } catch (e) {
      console.error('Price calculation skip in availability check:', e.message);
    }

    res.status(200).json({
      success: true,
      available: conflictingBookings.length === 0,
      conflicts: conflictingBookings,
      estimatedPrice
    });
  } catch (error) {
    console.error('Check availability error:', error);
    res.status(500).json({ success: false, message: 'Error checking availability' });
  }
};

// Get all bookings (Admin/Owner only)
const getAllBookings = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      userId,
      unitId,
      startDate,
      endDate,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      tenantId,
      ownerId,
      industryType,
      propertyId
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const isAdmin = req.user.role === 2;
    // SEC-01 fix: Force tenantId from user context for non-admins to prevent IDOR
    const effectiveTenantId = (isAdmin && tenantId) ? tenantId : (isAdmin ? null : req.user?.tenantId);

    // Build where clause with tenant filtering for multi-tenant architecture
    const where = {};

    if (effectiveTenantId) {
      where.tenantId = effectiveTenantId;
    }
    if (industryType) {
      where.tenant = { type: parseInt(industryType) };
    }
    if (propertyId) {
      where.propertyId = propertyId;
    }

    // Owner filtering logic
    const effectiveOwnerId = (req.user.role === 2 && ownerId) ? ownerId : (req.user.role === 3 ? req.user.id : null);

    if (effectiveOwnerId) {
      // Check if this user has specific property access records
      const hasAccessRecords = await prisma.userPropertyAccess.count({
        where: { userId: effectiveOwnerId, tenantId: effectiveTenantId }
      });

      if (hasAccessRecords > 0) {
        // Find properties this user has access to
        const accessRecords = await prisma.userPropertyAccess.findMany({
          where: { userId: effectiveOwnerId },
          select: { propertyId: true }
        });
        const propertyIds = accessRecords.map(r => r.propertyId);

        where.OR = [
          { propertyId: { in: propertyIds } },
          { unit: { propertyId: { in: propertyIds } } }
        ];
      }
      // If no access records, they are treated as global owners for that tenant
    }

    if (status) where.status = parseInt(status);
    if (userId) where.userId = userId;
    if (unitId) where.unitId = unitId;

    if (startDate || endDate) {
      where.startAt = {};
      if (startDate) where.startAt.gte = new Date(startDate);
      if (endDate) where.startAt.lte = new Date(endDate);
    }

    const [bookings, total] = await Promise.all([
      prisma.booking.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
            }
          },
          lead: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
            }
          },
          unit: {
            select: {
              id: true,
              unitCode: true,
              unitCategory: true,
              property: {
                select: {
                  id: true,
                  title: true,
                  city: true,
                  addressLine1: true,
                  addressLine2: true,
                }
              }
            }
          },
          property: {
            select: {
              id: true,
              title: true,
              city: true,
              addressLine1: true,
              addressLine2: true,
            }
          },
          agent: {
            select: {
              id: true,
              user: {
                select: {
                  name: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                  phone: true
                }
              }
            }
          },
          tenant: {
            select: {
              id: true,
              name: true,
              type: true,
            }
          }
        },
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: parseInt(limit),
      }),
      prisma.booking.count({ where })
    ]);

    res.status(200).json({
      success: true,
      data: {
        bookings,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit),
        }
      }
    });
  } catch (error) {
    console.error('Get all bookings error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching bookings'
    });
  }
};

// Get booking statistics (Admin/Owner only)
const getBookingStats = async (req, res) => {
  try {
    const { period = 'month', tenantId } = req.query;

    let dateFilter;
    const now = new Date();

    switch (period) {
      case 'day':
        dateFilter = {
          gte: new Date(now.getFullYear(), now.getMonth(), now.getDate())
        };
        break;
      case 'week':
        dateFilter = {
          gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        };
        break;
      case 'month':
        dateFilter = {
          gte: new Date(now.getFullYear(), now.getMonth(), 1)
        };
        break;
      case 'year':
        dateFilter = {
          gte: new Date(now.getFullYear(), 0, 1)
        };
        break;
    }

    // Build base where clause with tenant filtering
    const baseWhere = {
      createdAt: dateFilter
    };

    // Add tenant filtering - use query parameter if auth is disabled
    if (tenantId) {
      baseWhere.tenantId = tenantId;
    } else if (req.user && req.user.role !== 2 && req.user.tenantId) {
      baseWhere.tenantId = req.user.tenantId;
    } else if (!req.user && !tenantId) {
      return res.status(400).json({
        success: false,
        message: 'Tenant ID is required when authentication is disabled'
      });
    }

    const [
      totalBookings,
      confirmedBookings,
      cancelledBookings,
      completedBookings,
      revenueStats
    ] = await Promise.all([
      prisma.booking.count({ where: baseWhere }),
      prisma.booking.count({
        where: {
          ...baseWhere,
          status: 2  // confirmed
        }
      }),
      prisma.booking.count({
        where: {
          ...baseWhere,
          status: 3  // cancelled
        }
      }),
      prisma.booking.count({
        where: {
          ...baseWhere,
          status: 4  // completed
        }
      }),
      prisma.booking.aggregate({
        where: {
          ...baseWhere,
          status: 4 // completed
        },
        _sum: {
          totalPrice: true
        }
      })
    ]);

    res.status(200).json({
      success: true,
      data: {
        totalBookings,
        confirmedBookings,
        cancelledBookings,
        completedBookings,
        totalRevenue: revenueStats._sum.totalPrice || 0,
        averageBookingValue: totalBookings > 0 ? (revenueStats._sum.totalPrice || 0) / totalBookings : 0,
        period
      }
    });
  } catch (error) {
    console.error('Get booking stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching booking statistics'
    });
  }
};

const getUserBookings = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      startDate,
      endDate,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      tenantId
    } = req.query;

    const skip = (page - 1) * limit;

    // Build where clause for current user's bookings
    const where = {};

    // Add user filtering if auth is enabled
    if (req.user) {
      where.userId = req.user.id;

      // Add tenant filtering
      if (req.user.tenantId) {
        where.tenantId = req.user.tenantId;
      }
    } else if (tenantId) {
      // If auth is disabled, require tenantId and userId
      where.tenantId = tenantId;
      if (!req.query.userId) {
        return res.status(400).json({
          success: false,
          message: 'User ID is required when authentication is disabled'
        });
      }
      where.userId = req.query.userId;
    } else {
      return res.status(400).json({
        success: false,
        message: 'Authentication is required or provide tenantId and userId'
      });
    }

    if (status) where.status = parseInt(status);

    if (startDate || endDate) {
      where.startAt = {};
      if (startDate) where.startAt.gte = new Date(startDate);
      if (endDate) where.startAt.lte = new Date(endDate);
    }

    const [bookings, total] = await Promise.all([
      prisma.booking.findMany({
        where,
        include: {
          unit: {
            select: {
              id: true,
              unitCode: true,
              unitCategory: true,
              property: {
                select: {
                  id: true,
                  title: true,
                  city: true,
                  addressLine1: true,
                }
              }
            }
          },
          lead: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
            }
          },
          agent: {
            select: {
              id: true,
              user: {
                select: {
                  name: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                  phone: true
                }
              }
            }
          },
          tenant: {
            select: {
              id: true,
              name: true,
              type: true,
            }
          }
        },
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: parseInt(limit),
      }),
      prisma.booking.count({ where })
    ]);

    res.status(200).json({
      success: true,
      data: {
        bookings,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('Get user bookings error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching user bookings'
    });
  }
};

const deleteBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const { tenantId } = req.query;

    const where = { id };
    if (tenantId) {
      where.tenantId = tenantId;
    } else if (req.user && req.user.role !== 2 && req.user.tenantId) {
      where.tenantId = req.user.tenantId;
    }

    await prisma.booking.delete({ where });

    res.status(200).json({
      success: true,
      message: 'Booking deleted successfully'
    });
  } catch (error) {
    console.error('Delete booking error:', error);
    if (error.code === 'P2025') {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }
    res.status(500).json({
      success: false,
      message: 'Server error deleting booking'
    });
  }
};

const sendVisitInfo = async (req, res) => {
  try {
    const { id } = req.params;
    const { tenantId: queryTenantId } = req.query;

    const isAdmin = req.user.role === 2;
    const effectiveTenantId = (isAdmin && queryTenantId) ? queryTenantId : req.user.tenantId;

    const booking = await prisma.booking.findUnique({
      where: { id },
      include: {
        user: true,
        lead: true,
        unit: {
          include: {
            property: true
          }
        },
        property: true,
        agent: {
          include: {
            user: true
          }
        }
      }
    });

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Visit record not found' });
    }

    if (effectiveTenantId && booking.tenantId !== effectiveTenantId) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const recipientEmail = booking.guestEmail || booking.user?.email || booking.lead?.email;
    const recipientName = booking.guestName || booking.user?.name || booking.lead?.name || 'Guest';

    console.log('Sending visit info to:', recipientEmail, 'for booking:', id);

    if (!recipientEmail) {
      console.warn('No recipient email found for booking:', id, {
        guestEmail: booking.guestEmail,
        userEmail: booking.user?.email,
        leadEmail: booking.lead?.email
      });
      return res.status(400).json({ success: false, message: 'User or Guest email not found' });
    }

    // Send email using a specialized template
    const propertyTitle = booking.unit?.property?.title || booking.property?.title || 'Unknown Property';
    const unitCode = booking.unit?.unitCode || 'N/A';
    const agentName = booking.agent?.user?.name || booking.agent?.user?.firstName || 'Assigned Representative';
    const agentEmail = booking.agent?.user?.email || 'N/A';
    const agentPhone = booking.agent?.user?.phone || 'N/A';

    await sendBookingEmail(recipientEmail, recipientName, {
      unitCode: unitCode,
      propertyName: propertyTitle,
      date: new Date(booking.startAt).toLocaleString(),
      price: 'Free Visit',
      status: 'Confirmed',
      agentInfo: {
        name: agentName,
        email: agentEmail,
        phone: agentPhone
      }
    });

    res.status(200).json({ success: true, message: 'Visit info email sent successfully' });
  } catch (error) {
    console.error('Send visit info error:', error);
    res.status(500).json({ success: false, message: 'Server error sending email' });
  }
};

module.exports = {
  createBooking,
  getBookingById,
  updateBooking,
  updateBookingStatus,
  cancelBooking,
  deleteBooking,
  checkAvailability,
  getAllBookings,
  getBookingStats,
  getUserBookings,
  sendVisitInfo
};
