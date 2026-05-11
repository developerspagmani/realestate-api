const { prisma } = require('../config/database');
const { generateAIResponse } = require('../services/aiService');
const { sendPropertyRecommendationEmail, sendBookingEmail } = require('../utils/emailService');

/**
 * Handle AI Chatbot Messages
 * Builds rich property context and passes it to Gemini for accurate responses.
 */
const handleChat = async (req, res) => {
  try {
    const { messages, propertyId, tenantId: bodyTenantId } = req.body;
    const tenantId = req.tenant?.id || bodyTenantId;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ success: false, message: 'Messages are required' });
    }

    if (!tenantId) {
      return res.status(400).json({ success: false, message: 'Tenant context is required for AI chat' });
    }

    // 1. Fetch Tenant AI Config
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { settings: true, name: true }
    });
    const aiConfig = tenant?.settings?.chatbotConfig || {};

    // 2. Fetch Full Property Details (mirrors propertyController getProperties structure)
    const properties = await prisma.property.findMany({
      where: {
        tenantId,
        status: 1,
        ...(propertyId && { id: propertyId })
      },
      take: 10,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        description: true,
        propertyType: true,
        listingType: true,
        // Location
        addressLine1: true,
        addressLine2: true,
        city: true,
        state: true,
        country: true,
        postalCode: true,
        locality: true,
        subLocality: true,
        neighborhood: true,
        apartmentSociety: true,
        // Pricing
        price: true,
        pricePerSqft: true,
        priceNegotiable: true,
        allInclusivePrice: true,
        camCharges: true,
        // Property Stats (on Property directly)
        bedrooms: true,
        bathrooms: true,
        area: true,
        carpetArea: true,
        builtUpArea: true,
        superBuiltUpArea: true,
        lotSize: true,
        balconies: true,
        parkingSpaces: true,
        totalFloors: true,
        floorNo: true,
        yearBuilt: true,
        // Status & Features
        availabilityStatus: true,
        furnishing: true,
        facing: true,
        flooring: true,
        ownership: true,
        powerBackup: true,
        reservedParking: true,
        vaastuCompliant: true,
        extraRooms: true,
        propertyFeatures: true,
        overlooking: true,
        videoUrl: true,
        // Amenities
        propertyAmenities: {
          select: {
            amenity: {
              select: { name: true }
            }
          }
        },
        // Units (for multi-unit properties)
        units: {
          where: { status: 1 },
          select: {
            unitCode: true,
            unitCategory: true,
            sizeSqft: true,
            capacity: true,
            unitPricing: {
              select: { price: true, currency: true, pricingModel: true }
            },
            realEstateDetails: {
              select: { bedrooms: true, bathrooms: true, furnishing: true }
            }
          }
        },
        // Category
        category: {
          select: { name: true }
        }
      }
    });

    // 3. Build Rich Context String for Gemini
    let context = '';

    if (properties.length > 0) {
      const companyName = tenant?.name || 'our company';
      context = `You are representing ${companyName}. Here are the available properties:\n\n`;

      context += properties.map((p, idx) => {
        const lines = [];

        lines.push(`[Property ${idx + 1}] ${p.title}`);

        // Location
        const locationParts = [p.addressLine1, p.locality, p.subLocality, p.neighborhood, p.city, p.state, p.country].filter(Boolean);
        if (locationParts.length) lines.push(`  Location: ${locationParts.join(', ')}`);
        if (p.apartmentSociety) lines.push(`  Society/Building: ${p.apartmentSociety}`);

        // Type & Listing
        const typeMap = { 1: 'Apartment', 2: 'Villa', 3: 'Commercial', 4: 'Plot', 5: 'Office', 6: 'Shop', 7: 'Warehouse', 8: 'House', 9: 'Penthouse' };
        lines.push(`  Type: ${typeMap[p.propertyType] || p.propertyType} | Listing: ${p.listingType || 'N/A'}`);
        if (p.category?.name) lines.push(`  Category: ${p.category.name}`);

        // Pricing
        if (p.price) {
          lines.push(`  Price: ${p.price.toLocaleString()} ${p.priceNegotiable ? '(Negotiable)' : '(Fixed)'}`);
        }
        if (p.pricePerSqft) lines.push(`  Price/sqft: ${p.pricePerSqft}`);
        if (p.camCharges) lines.push(`  CAM Charges: ${p.camCharges}`);
        if (p.allInclusivePrice) lines.push(`  All-Inclusive Pricing: Yes`);

        // Size & Dimensions
        const sizes = [];
        if (p.area) sizes.push(`Total: ${p.area} sqft`);
        if (p.carpetArea) sizes.push(`Carpet: ${p.carpetArea} sqft`);
        if (p.builtUpArea) sizes.push(`Built-Up: ${p.builtUpArea} sqft`);
        if (p.superBuiltUpArea) sizes.push(`Super Built-Up: ${p.superBuiltUpArea} sqft`);
        if (sizes.length) lines.push(`  Size: ${sizes.join(' | ')}`);

        // Rooms
        const rooms = [];
        if (p.bedrooms) rooms.push(`${p.bedrooms} Bedrooms`);
        if (p.bathrooms) rooms.push(`${p.bathrooms} Bathrooms`);
        if (p.balconies) rooms.push(`${p.balconies} Balconies`);
        if (rooms.length) lines.push(`  Rooms: ${rooms.join(', ')}`);

        // Building Details
        const building = [];
        if (p.floorNo) building.push(`Floor ${p.floorNo}`);
        if (p.totalFloors) building.push(`of ${p.totalFloors} total floors`);
        if (p.yearBuilt) building.push(`Built in ${p.yearBuilt}`);
        if (building.length) lines.push(`  Building: ${building.join(', ')}`);

        // Parking & Features
        if (p.parkingSpaces) lines.push(`  Parking: ${p.parkingSpaces} spaces`);
        if (p.furnishing) lines.push(`  Furnishing: ${p.furnishing}`);
        if (p.facing) lines.push(`  Facing: ${p.facing}`);
        if (p.ownership) lines.push(`  Ownership: ${p.ownership}`);
        if (p.availabilityStatus) lines.push(`  Availability: ${p.availabilityStatus}`);
        if (p.powerBackup) lines.push(`  Power Backup: ${p.powerBackup}`);
        if (p.vaastuCompliant) lines.push(`  Vaastu Compliant: Yes`);
        if (p.reservedParking) lines.push(`  Reserved Parking: Yes`);

        // Extra Rooms & Features
        if (p.extraRooms?.length) lines.push(`  Extra Rooms: ${p.extraRooms.join(', ')}`);
        if (p.propertyFeatures?.length) lines.push(`  Features: ${p.propertyFeatures.join(', ')}`);
        if (p.overlooking?.length) lines.push(`  Overlooking: ${p.overlooking.join(', ')}`);

        // Amenities
        const amenityNames = p.propertyAmenities?.map(pa => pa.amenity?.name).filter(Boolean) || [];
        if (amenityNames.length) lines.push(`  Amenities: ${amenityNames.join(', ')}`);

        // Description
        if (p.description) {
          lines.push(`  Description: ${p.description.substring(0, 300)}${p.description.length > 300 ? '...' : ''}`);
        }

        // Units (for multi-unit)
        if (p.units?.length > 0) {
          lines.push(`  Units Available (${p.units.length}):`);
          p.units.slice(0, 5).forEach(u => {
            const unitParts = [u.unitCode, u.unitCategory];
            if (u.sizeSqft) unitParts.push(`${u.sizeSqft} sqft`);
            if (u.unitPricing?.price) unitParts.push(`Price: ${u.unitPricing.price}`);
            if (u.realEstateDetails?.bedrooms) unitParts.push(`${u.realEstateDetails.bedrooms}BR`);
            lines.push(`    - ${unitParts.filter(Boolean).join(' | ')}`);
          });
        }

        return lines.join('\n');
      }).join('\n\n');
    } else {
      context = 'No properties are currently listed. Please ask users to contact our team directly for availability.';
    }

    // 4. Call AI Service with rich context
    const botResponse = await generateAIResponse(messages, context, aiConfig);

    res.status(200).json({
      success: true,
      data: { message: botResponse }
    });

  } catch (error) {
    console.error('AI Chat Error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal AI Error'
    });
  }
};

/**
 * Handle Chatbot Real Actions (Email, Booking, Compare)
 * Called when the AI detects a user's intent to perform a real action.
 */
const handleAction = async (req, res) => {
  try {
    const { action, email, propertyIds, tenantId: bodyTenantId, leadName, date, notes } = req.body;
    const tenantId = req.tenant?.id || bodyTenantId;

    if (!action || !tenantId) {
      return res.status(400).json({ success: false, message: 'Action and tenantId are required' });
    }

    // Fetch tenant for email styling
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { name: true, settings: true }
    });

    // --- ACTION: SEND_EMAIL ---
    if (action === 'SEND_EMAIL') {
      if (!email) return res.status(400).json({ success: false, message: 'Email address is required' });

      const uuidRegex = /^[0-9a-f-]{36}$/i;
      const safeIds = (propertyIds || []).filter(id => uuidRegex.test(id));

      // Fetch the properties to send
      const properties = await prisma.property.findMany({
        where: { tenantId, status: 1, ...(safeIds.length > 0 ? { id: { in: safeIds } } : {}) },
        take: 5,
        include: {
          mainImage: true,
          units: { include: { unitPricing: true } }
        }
      });

      if (properties.length === 0) {
        return res.status(404).json({ success: false, message: 'No matching properties found to send.' });
      }

      const tenantInfo = { name: tenant?.name, currencySymbol: tenant?.settings?.currencySymbol };
      const sent = await sendPropertyRecommendationEmail(email, leadName || 'Valued Customer', properties, tenantInfo);

      if (sent) {
        return res.json({ success: true, message: `Property details sent to ${email} successfully!`, count: properties.length });
      } else {
        return res.status(500).json({ success: false, message: 'Failed to send email. Please try again.' });
      }
    }

    // --- ACTION: BOOK_VISIT ---
    if (action === 'BOOK_VISIT') {
      const uuidRegex = /^[0-9a-f-]{36}$/i;
      const propertyId = propertyIds?.[0];
      const safePropertyId = propertyId && uuidRegex.test(propertyId) ? propertyId : null;

      const property = safePropertyId ? await prisma.property.findFirst({
        where: { id: safePropertyId, tenantId }
      }) : null;

      // Create or find lead by email
      let lead = email ? await prisma.lead.findFirst({
        where: { tenantId, email: email.toLowerCase() }
      }) : null;

      if (!lead) {
        lead = await prisma.lead.create({
          data: {
            tenantId,
            name: leadName || 'Chatbot Visitor',
            email: email?.toLowerCase() || null,
            source: 7, // Website chatbot
            status: 1,
            propertyId: safePropertyId,
            notes: `Booking request via AI chatbot. ${notes || ''}`,
            preferences: { tags: ['Booking', 'ChatbotAI'] }
          }
        });
      }

      // Create booking record
      const startAt = date ? new Date(date) : new Date(Date.now() + 24 * 60 * 60 * 1000); // default tomorrow
      const endAt = new Date(startAt.getTime() + 60 * 60 * 1000); // 1h slot
      const qrCode = 'BK-' + Math.random().toString(36).substr(2, 9).toUpperCase();

      const booking = await prisma.booking.create({
        data: {
          tenantId,
          leadId: lead.id,
          propertyId: safePropertyId,
          guestName: lead.name,
          guestEmail: lead.email,
          guestPhone: lead.phone,
          startAt,
          endAt,
          status: 1,
          paymentStatus: 1,
          qrCode,
          notes: `Booked via AI Chatbot. ${notes || ''}`
        }
      });

      // Send confirmation email if email provided
      if (email) {
        await sendBookingEmail(email, lead.name, {
          unitCode: 'Visit',
          propertyName: property?.title || 'Selected Property',
          date: startAt.toLocaleDateString(),
          price: 'FREE SITE VISIT',
          status: 'Pending Confirmation'
        });
      }

      return res.json({
        success: true,
        message: `Booking confirmed! Reference: ${qrCode}. ${email ? `Confirmation sent to ${email}.` : ''}`,
        booking: { id: booking.id, qrCode, startAt, propertyName: property?.title }
      });
    }

    // --- ACTION: COMPARE_PROPERTIES ---
    if (action === 'COMPARE_PROPERTIES') {
      const uuidRegex = /^[0-9a-f-]{36}$/i;
      const safeIds = (propertyIds || []).filter(id => uuidRegex.test(id));
      if (safeIds.length < 2) {
        return res.status(400).json({ success: false, message: 'At least 2 property IDs are required for comparison' });
      }

      const properties = await prisma.property.findMany({
        where: { id: { in: safeIds }, tenantId },
        select: {
          id: true, title: true, price: true, propertyType: true, listingType: true,
          city: true, area: true, bedrooms: true, bathrooms: true, balconies: true,
          furnishing: true, facing: true, availabilityStatus: true, parkingSpaces: true,
          yearBuilt: true, totalFloors: true, pricePerSqft: true, priceNegotiable: true,
          propertyAmenities: { select: { amenity: { select: { name: true } } } },
          mainImage: { select: { url: true } }
        }
      });

      return res.json({ success: true, data: properties });
    }

    return res.status(400).json({ success: false, message: `Unknown action: ${action}` });

  } catch (error) {
    console.error('AI Action Error:', error);
    res.status(500).json({ success: false, message: error.message || 'Action failed' });
  }
};

module.exports = { handleChat, handleAction };
