const { prisma } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

// Process payment with ACID transaction
const processPayment = async (req, res) => {
  try {
    const { bookingId, paymentMethod, amount } = req.body;
    const userId = req.user.id;
    const tenantId = req.tenant?.id;

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        message: 'Tenant ID is required'
      });
    }

    // Start transaction for ACID compliance
    const result = await prisma.$transaction(async (tx) => {
      // Get booking details
      const booking = await tx.booking.findUnique({
        where: { id: bookingId },
        include: {
          user: {
            select: {
              id: true,
              name: true,    // Fixed: was firstName/lastName
              email: true,
            }
          },
          unit: true,      // Fixed: was seats
          // Removed: payments (Payment model doesn't exist)
        }
      });

      if (!booking) {
        throw new Error('Booking not found');
      }

      // Check if user owns this booking AND belongs to same tenant
      if (booking.userId !== userId || booking.tenantId !== tenantId) {
        throw new Error('Access denied');
      }

      // Check if booking is confirmed (using integer status)
      if (booking.status !== 2) {  // Fixed: was 'CONFIRMED'
        throw new Error('Booking must be confirmed before payment');
      }

      // Check if payment amount is valid
      if (amount <= 0 || amount > booking.totalPrice) {
        throw new Error('Invalid payment amount');
      }

      // Process payment (in real implementation, integrate with Stripe/PayPal)
      let paymentStatus = 'COMPLETED';
      let transactionId = `txn_${Date.now()}_${uuidv4().substring(0, 8)}`;

      // Simulate payment processing
      if (Math.random() < 0.05) { // 5% failure rate for demo
        paymentStatus = 'FAILED';
        transactionId = null;
      }

      // Create payment record
      const payment = await tx.payment.create({
        data: {
          bookingId,
          userId,
          amount,
          currency: 'USD',
          status: paymentStatus,
          paymentMethod,
          transactionId,
        }
      });

      // Update booking payment status if fully paid
      const newTotalPaid = totalPaid + (paymentStatus === 'COMPLETED' ? amount : 0);
      let bookingPaymentStatus = booking.paymentStatus;

      if (newTotalPaid >= booking.totalPrice) {
        bookingPaymentStatus = 'COMPLETED';
      } else if (newTotalPaid > 0) {
        bookingPaymentStatus = 'PARTIALLY_PAID';
      }

      if (bookingPaymentStatus !== booking.paymentStatus) {
        await tx.booking.update({
          where: { id: bookingId },
          data: { paymentStatus: bookingPaymentStatus }
        });
      }

      // Create notification
      await tx.notification.create({
        data: {
          userId: booking.userId,
          title: paymentStatus === 'COMPLETED' ? 'Payment Received' : 'Payment Failed',
          message: paymentStatus === 'COMPLETED'
            ? `Payment of $${amount} for your booking has been received successfully.`
            : `Payment of $${amount} for your booking has failed. Please try again.`,
          type: paymentStatus === 'COMPLETED' ? 'PAYMENT_RECEIVED' : 'PAYMENT_FAILED',
          data: {
            bookingId,
            paymentId: payment.id,
            amount,
            status: paymentStatus,
          }
        }
      });

      return { payment, booking };
    });

    res.status(201).json({
      success: true,
      message: result.payment.status === 'COMPLETED'
        ? 'Payment processed successfully'
        : 'Payment processing failed',
      data: {
        payment: result.payment,
        booking: result.booking
      }
    });
  } catch (error) {
    console.error('Process payment error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error processing payment'
    });
  }
};

// Get payment by ID
const getPaymentById = async (req, res) => {
  try {
    const { id } = req.params;

    const payment = await prisma.payment.findUnique({
      where: { id },
      include: {
        booking: {
          include: {
            seats: {
              select: {
                id: true,
                name: true,
                type: true,
              }
            }
          }
        },
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          }
        }
      }
    });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    // Check if user has permission to view this payment
    if (payment.userId !== req.user.id && req.user.role !== 'ADMIN' && req.user.role !== 'OWNER') {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    res.status(200).json({
      success: true,
      data: { payment }
    });
  } catch (error) {
    console.error('Get payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching payment'
    });
  }
};

// Get user payments
const getUserPayments = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      startDate,
      endDate
    } = req.query;

    const skip = (page - 1) * limit;

    // Build where clause
    const where = {
      userId: req.user.id,
      ...(status && { status: status.toUpperCase() }),
    };

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        include: {
          booking: {
            select: {
              id: true,
              startDate: true,
              endDate: true,
              status: true,
              seats: {
                select: {
                  id: true,
                  name: true,
                  type: true,
                }
              }
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit),
      }),
      prisma.payment.count({ where })
    ]);

    res.status(200).json({
      success: true,
      data: {
        payments,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit),
        }
      }
    });
  } catch (error) {
    console.error('Get user payments error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching payments'
    });
  }
};

// Get all payments (Admin/Owner only)
const getAllPayments = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      userId,
      bookingId,
      startDate,
      endDate,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      industryType,
      ownerId: queryOwnerId,
      tenantId: queryTenantId
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const isAdmin = req.user.role === 2;

    // Build where clause
    const where = {};
    const bookingWhere = {};

    const effectiveTenantId = queryTenantId || req.tenant?.id || (req.user && !isAdmin ? req.user.tenantId : null);
    if (effectiveTenantId) {
      bookingWhere.tenantId = effectiveTenantId;
    }

    if (industryType) {
      bookingWhere.tenant = { type: parseInt(industryType) };
    }

    // Role-based filtering
    if (req.user.role === 3) { // OWNER
      // Owners can only see payments for their properties
      bookingWhere.unit = {
        property: {
          userPropertyAccess: {
            some: { userId: req.user.id }
          }
        }
      };
    } else if (isAdmin) {
      // Admin can filter by ownerId
      if (queryOwnerId) {
        bookingWhere.unit = {
          property: {
            userPropertyAccess: {
              some: { userId: queryOwnerId }
            }
          }
        };
      }
    }

    if (Object.keys(bookingWhere).length > 0) {
      where.booking = bookingWhere;
    }

    if (status) where.status = status.toUpperCase();
    if (userId) where.userId = userId;
    if (bookingId) where.bookingId = bookingId;

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            }
          },
          booking: {
            select: {
              id: true,
              status: true,
              totalPrice: true,
              seats: {
                select: {
                  id: true,
                  name: true,
                  type: true,
                }
              }
            }
          }
        },
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: parseInt(limit),
      }),
      prisma.payment.count({ where })
    ]);

    res.status(200).json({
      success: true,
      data: {
        payments,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit),
        }
      }
    });
  } catch (error) {
    console.error('Get all payments error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching payments'
    });
  }
};

// Process refund (Admin/Owner only)
const processRefund = async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, reason } = req.body;

    // Start transaction for ACID compliance
    const result = await prisma.$transaction(async (tx) => {
      // Get payment details
      const payment = await tx.payment.findUnique({
        where: { id },
        include: {
          booking: {
            include: {
              user: true,
              payments: {
                where: { status: 'COMPLETED' }
              }
            }
          }
        }
      });

      if (!payment) {
        throw new Error('Payment not found');
      }

      if (payment.status !== 'COMPLETED') {
        throw new Error('Only completed payments can be refunded');
      }

      if (amount <= 0 || amount > payment.amount) {
        throw new Error('Invalid refund amount');
      }

      // Process refund (in real implementation, integrate with payment gateway)
      const refundStatus = 'REFUNDED';
      const refundTransactionId = `refund_${Date.now()}_${uuidv4().substring(0, 8)}`;

      // Update payment status
      const updatedPayment = await tx.payment.update({
        where: { id },
        data: {
          status: refundStatus,
          transactionId: refundTransactionId,
        }
      });

      // Update booking payment status
      const totalPaid = payment.booking.payments.reduce((sum, p) => sum + p.amount, 0);
      const newTotalPaid = totalPaid - amount;

      let bookingPaymentStatus = 'COMPLETED';
      if (newTotalPaid <= 0) {
        bookingPaymentStatus = 'REFUNDED';
      } else if (newTotalPaid < payment.booking.totalPrice) {
        bookingPaymentStatus = 'PARTIALLY_REFUNDED';
      }

      await tx.booking.update({
        where: { id: payment.bookingId },
        data: { paymentStatus: bookingPaymentStatus }
      });

      // Create notification
      await tx.notification.create({
        data: {
          userId: payment.booking.userId,
          title: 'Payment Refunded',
          message: `A refund of $${amount} has been processed for your booking. ${reason ? `Reason: ${reason}` : ''}`,
          type: 'PAYMENT_FAILED', // Using existing type
          data: {
            bookingId: payment.bookingId,
            paymentId: payment.id,
            refundAmount: amount,
            reason,
          }
        }
      });

      return { payment: updatedPayment, booking: payment.booking };
    });

    res.status(200).json({
      success: true,
      message: 'Refund processed successfully',
      data: {
        payment: result.payment,
        booking: result.booking
      }
    });
  } catch (error) {
    console.error('Process refund error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error processing refund'
    });
  }
};

// Get payment statistics (Admin/Owner only)
const getPaymentStats = async (req, res) => {
  try {
    const { period = 'month' } = req.query;

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

    const [
      paymentStats,
      totalRevenue,
      refundStats,
      paymentMethods
    ] = await Promise.all([
      // Payment statistics by status
      prisma.payment.groupBy({
        by: ['status'],
        where: { createdAt: dateFilter },
        _count: { id: true },
        _sum: { amount: true }
      }),
      // Total revenue
      prisma.payment.aggregate({
        where: {
          status: 'COMPLETED',
          createdAt: dateFilter
        },
        _sum: { amount: true },
        _count: { id: true }
      }),
      // Refund statistics
      prisma.payment.aggregate({
        where: {
          status: 'REFUNDED',
          createdAt: dateFilter
        },
        _sum: { amount: true },
        _count: { id: true }
      }),
      // Payment method statistics
      prisma.payment.groupBy({
        by: ['paymentMethod'],
        where: {
          status: 'COMPLETED',
          createdAt: dateFilter
        },
        _count: { id: true },
        _sum: { amount: true }
      })
    ]);

    res.status(200).json({
      success: true,
      data: {
        paymentStats,
        totalRevenue: totalRevenue._sum.amount || 0,
        totalTransactions: totalRevenue._count.id,
        totalRefunds: refundStats._sum.amount || 0,
        refundCount: refundStats._count.id,
        netRevenue: (totalRevenue._sum.amount || 0) - (refundStats._sum.amount || 0),
        paymentMethods,
        period
      }
    });
  } catch (error) {
    console.error('Get payment stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching payment statistics'
    });
  }
};

module.exports = {
  processPayment,
  getPaymentById,
  getUserPayments,
  getAllPayments,
  processRefund,
  getPaymentStats,
};
