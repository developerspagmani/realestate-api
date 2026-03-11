const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const prisma = new PrismaClient();

async function generateSampleData() {
  console.log('🌱 Generating comprehensive sample data...');

  try {
    // ─── CLEAN (reverse dependency order) ────────────────────────────────────
    await prisma.workflowLog.deleteMany();
    await prisma.workflowEnrollment.deleteMany();
    await prisma.marketingWorkflow.deleteMany();
    await prisma.campaignLog.deleteMany();
    await prisma.campaign.deleteMany();
    await prisma.audienceGroup.deleteMany();
    await prisma.emailTemplate.deleteMany();
    await prisma.formBuilder.deleteMany();
    await prisma.whatsAppMessage.deleteMany();
    await prisma.whatsAppCampaign.deleteMany();
    await prisma.whatsAppTemplate.deleteMany();
    await prisma.publishedPost.deleteMany();
    await prisma.scheduledPost.deleteMany();
    await prisma.connectedAccount.deleteMany();
    await prisma.commission.deleteMany();
    await prisma.payment.deleteMany();
    await prisma.agentLead.deleteMany();
    await prisma.agentProperty.deleteMany();
    await prisma.agent.deleteMany();
    await prisma.leadInteraction.deleteMany();
    await prisma.booking.deleteMany();
    await prisma.lead.deleteMany();
    await prisma.listing.deleteMany();
    await prisma.auditLog.deleteMany();
    await prisma.planUpgradeRequest.deleteMany();
    await prisma.integration.deleteMany();
    await prisma.widget.deleteMany();
    await prisma.page.deleteMany();
    await prisma.website.deleteMany();
    await prisma.media.deleteMany();
    await prisma.userPropertyAccess.deleteMany();
    await prisma.property3DConfig.deleteMany();
    await prisma.propertyAmenity.deleteMany();
    await prisma.unitAmenity.deleteMany();
    await prisma.realEstateUnitDetails.deleteMany();
    await prisma.unitPricing.deleteMany();
    await prisma.unit.deleteMany();
    await prisma.property.deleteMany();
    await prisma.propertyCategory.deleteMany();
    await prisma.amenity.deleteMany();
    await prisma.licenseKey.deleteMany();
    await prisma.tenantModule.deleteMany();
    await prisma.module.deleteMany();
    await prisma.plan.deleteMany();
    await prisma.user.deleteMany();
    await prisma.tenant.deleteMany();
    await prisma.systemSetting.deleteMany();
    console.log('🧹 Database cleaned');

    // ─── SYSTEM SETTINGS ─────────────────────────────────────────────────────
    await prisma.systemSetting.createMany({
      data: [
        { key: 'platform_name', value: 'RealEstate Pro', type: 'string' },
        { key: 'platform_email', value: 'admin@platform.com', type: 'string' },
        { key: 'trial_days', value: '14', type: 'number' },
        { key: 'max_properties', value: '100', type: 'number' },
        { key: 'maintenance_mode', value: 'false', type: 'boolean' },
        { key: 'support_whatsapp', value: '+919999900000', type: 'string' },
      ]
    });
    console.log('⚙️  System settings created');

    // ─── MODULES ─────────────────────────────────────────────────────────────
    const modDefs = [
      { name: 'Properties', slug: 'properties', description: 'Core property management' },
      { name: 'Units', slug: 'units', description: 'Unit and floor management' },
      { name: 'Bookings', slug: 'bookings', description: 'Booking and reservation system' },
      { name: 'Leads', slug: 'leads', description: 'Lead capture and tracking' },
      { name: 'Agents', slug: 'agents', description: 'Agent management and commissions' },
      { name: 'Payments', slug: 'payments', description: 'Payment processing' },
      { name: 'Widget Creator', slug: 'widget_creator', description: 'Embeddable listing widgets' },
      { name: 'Marketing Hub', slug: 'marketing_hub', description: 'Email campaigns and workflows' },
      { name: 'Advanced Analytics', slug: 'analytics_pro', description: 'Advanced analytics dashboard' },
      { name: '3D Property Viewer', slug: '3d_viewer', description: '3D floor plan and tour builder' },
      { name: 'Discovery Portal', slug: 'discovery', description: 'Public property discovery' },
      { name: 'Website CMS', slug: 'website_cms', description: 'Property micro-site builder' },
      { name: 'Social Media', slug: 'social_posts', description: 'Schedule and publish social posts' },
      { name: 'WhatsApp Campaigns', slug: 'social_whatsapp', description: 'WhatsApp campaign management' },
      { name: 'Automation Engine', slug: 'automation_engine', description: 'Lead workflow automation' },
      { name: 'Portal Market', slug: 'portal_market', description: 'Sync leads and post to external portals' },
      { name: 'Brochure Intelligent', slug: 'brochure_ai', description: 'AI-powered property brochure generator' },
    ];
    const modules = [];
    for (const m of modDefs) {
      modules.push(await prisma.module.create({ data: { ...m, status: 1 } }));
    }
    console.log(`📦 ${modules.length} modules created`);

    // ─── PLANS ───────────────────────────────────────────────────────────────
    const starterModIds = ['properties', 'units', 'bookings', 'leads'].map(
      s => ({ id: modules.find(m => m.slug === s).id })
    );
    const proModIds = modules.map(m => ({ id: m.id }));

    const starterPlan = await prisma.plan.create({
      data: {
        name: 'Starter', slug: 'starter',
        description: 'Essential tools for small agencies',
        price: 0, interval: 'monthly',
        features: { maxProperties: 10, maxUsers: 3 },
        modules: { connect: starterModIds }
      }
    });
    const growthPlan = await prisma.plan.create({
      data: {
        name: 'Growth', slug: 'growth',
        description: 'More power for growing teams',
        price: 29, interval: 'monthly',
        features: { maxProperties: 50, maxUsers: 10, analyticsEnabled: true },
        modules: { connect: modules.slice(0, 10).map(m => ({ id: m.id })) }
      }
    });
    const proPlan = await prisma.plan.create({
      data: {
        name: 'Professional', slug: 'pro-realestate',
        description: 'All features for high-volume agencies',
        price: 79, interval: 'monthly',
        features: { maxProperties: -1, maxUsers: -1, whatsappEnabled: true, socialEnabled: true, portalMarketEnabled: true },
        modules: { connect: proModIds }
      }
    });
    console.log('💎 Plans created: Starter, Growth, Professional');

    // ─── TENANTS ─────────────────────────────────────────────────────────────
    const tenantRE = await prisma.tenant.create({
      data: {
        name: 'Elite Real Estate Ltd', type: 1,
        domain: 'elite-re.com', website: 'https://elite-re.com',
        address: '12 Mayfair Lane', city: 'London',
        state: 'Greater London', country: 'UK', postalCode: 'W1K 2AX',
        status: 1, planId: proPlan.id, subscriptionStatus: 1,
        subscriptionExpiresAt: new Date('2027-01-01'),
        settings: { currency: 'GBP', timezone: 'Europe/London' }
      }
    });
    const tenantCW = await prisma.tenant.create({
      data: {
        name: 'Innovation Coworking Spaces', type: 2,
        domain: 'innovation-cw.com', website: 'https://innovation-cw.com',
        address: '45 Tech Boulevard', city: 'Bangalore',
        state: 'Karnataka', country: 'India', postalCode: '560001',
        status: 1, planId: growthPlan.id, subscriptionStatus: 1,
        subscriptionExpiresAt: new Date('2026-06-01'),
        settings: { currency: 'INR', timezone: 'Asia/Kolkata' }
      }
    });
    console.log('🏢 Tenants created: Real Estate (Pro) + Co-working (Growth)');

    // ─── LICENSE KEYS ─────────────────────────────────────────────────────────
    // Assign one active key to tenantRE
    const _licKeyRE = await prisma.licenseKey.create({
      data: {
        key: 'ELITE-PRO-2025-XXXX-XXXX',
        planId: proPlan.id, status: 2,
        tenantId: tenantRE.id, activatedAt: new Date()
      }
    });
    const _licKeyCW = await prisma.licenseKey.create({
      data: {
        key: 'INNOV-GRW-2025-YYYY-YYYY',
        planId: growthPlan.id, status: 2,
        tenantId: tenantCW.id, activatedAt: new Date()
      }
    });
    // Unused keys for admin to assign
    await prisma.licenseKey.createMany({
      data: [
        { key: 'KEY-PRO-UNUSED-AAAA-1111', planId: proPlan.id, status: 1 },
        { key: 'KEY-PRO-UNUSED-BBBB-2222', planId: proPlan.id, status: 1 },
        { key: 'KEY-GRW-UNUSED-CCCC-3333', planId: growthPlan.id, status: 1 },
        { key: 'KEY-STR-UNUSED-DDDD-4444', planId: starterPlan.id, status: 1 },
      ]
    });

    // ─── TENANT MODULES ───────────────────────────────────────────────────────
    for (const mod of modules) {
      await prisma.tenantModule.create({ data: { tenantId: tenantRE.id, moduleId: mod.id, isActive: true } });
    }
    for (const mod of modules.slice(0, 10)) {
      await prisma.tenantModule.create({ data: { tenantId: tenantCW.id, moduleId: mod.id, isActive: true } });
    }

    // ─── USERS ────────────────────────────────────────────────────────────────
    const hash = await bcrypt.hash('password123', 12);
    const _adminUser = await prisma.user.create({
      data: {
        name: 'Super Admin', email: 'admin@system.com',
        passwordHash: hash, role: 2,
        tenantId: null, status: 1, isVerified: true,
        phone: '+441234567890'
      }
    });
    const ownerRE = await prisma.user.create({
      data: {
        name: 'James Hartford', email: 'owner@elite-re.com',
        firstName: 'James', lastName: 'Hartford',
        passwordHash: hash, role: 3,
        tenantId: tenantRE.id, status: 1, isVerified: true,
        phone: '+441234567891', companyName: 'Elite Real Estate Ltd'
      }
    });
    const ownerCW = await prisma.user.create({
      data: {
        name: 'Priya Sharma', email: 'owner@innovation-cw.com',
        firstName: 'Priya', lastName: 'Sharma',
        passwordHash: hash, role: 3,
        tenantId: tenantCW.id, status: 1, isVerified: true,
        phone: '+919876543210', companyName: 'Innovation Coworking Spaces'
      }
    });

    const reUsers = [], cwUsers = [];
    const reNames = [
      ['Alice', 'Carter'], ['Bob', 'Mitchell'], ['Charles', 'Newman'],
      ['Diana', 'Powell'], ['Edward', 'Quinn']
    ];
    const cwNames = [
      ['Ananya', 'Rao'], ['Bikram', 'Sinha'], ['Charu', 'Mehta'],
      ['Deepak', 'Joshi'], ['Esha', 'Patel']
    ];
    for (let i = 0; i < 5; i++) {
      reUsers.push(await prisma.user.create({
        data: {
          name: `${reNames[i][0]} ${reNames[i][1]}`,
          firstName: reNames[i][0], lastName: reNames[i][1],
          email: `${reNames[i][0].toLowerCase()}@elite-re.com`,
          passwordHash: hash, role: 1,
          tenantId: tenantRE.id, status: 1, isVerified: true,
          phone: `+4412345678${90 + i}`
        }
      }));
      cwUsers.push(await prisma.user.create({
        data: {
          name: `${cwNames[i][0]} ${cwNames[i][1]}`,
          firstName: cwNames[i][0], lastName: cwNames[i][1],
          email: `${cwNames[i][0].toLowerCase()}@innovation-cw.com`,
          passwordHash: hash, role: 1,
          tenantId: tenantCW.id, status: 1, isVerified: true,
          phone: `+9198765432${10 + i}`
        }
      }));
    }
    console.log('👤 Users created: 1 Admin, 2 Owners, 10 Sub-users');

    // ─── PROPERTY CATEGORIES ─────────────────────────────────────────────────
    const catResidential = await prisma.propertyCategory.create({
      data: { tenantId: tenantRE.id, name: 'Residential', slug: 're-residential', icon: 'bi-house', sortOrder: 1 }
    });
    const _catCommercial = await prisma.propertyCategory.create({
      data: { tenantId: tenantRE.id, name: 'Commercial', slug: 're-commercial', icon: 'bi-building', sortOrder: 2 }
    });
    const catOffice = await prisma.propertyCategory.create({
      data: { tenantId: tenantCW.id, name: 'Office Space', slug: 'cw-office', icon: 'bi-briefcase', sortOrder: 1 }
    });

    // ─── AMENITIES ────────────────────────────────────────────────────────────
    const amenityDefs = [
      { name: 'Swimming Pool', category: 1, icon: 'waves', tenantId: tenantRE.id },
      { name: 'Gym', category: 1, icon: 'dumbbell', tenantId: tenantRE.id },
      { name: 'Parking', category: 1, icon: 'car', tenantId: tenantRE.id },
      { name: 'CCTV Security', category: 4, icon: 'camera', tenantId: tenantRE.id },
      { name: 'Garden', category: 3, icon: 'tree', tenantId: tenantRE.id },
      { name: 'High Speed WiFi', category: 2, icon: 'wifi', tenantId: tenantCW.id },
      { name: 'Coffee Lounge', category: 3, icon: 'cup-hot', tenantId: tenantCW.id },
      { name: 'Meeting Rooms', category: 1, icon: 'people', tenantId: tenantCW.id },
      { name: 'Standing Desks', category: 2, icon: 'layout-wtf', tenantId: tenantCW.id },
      { name: 'Printer Access', category: 2, icon: 'printer', tenantId: tenantCW.id },
    ];
    const amenities = [];
    for (const a of amenityDefs) {
      amenities.push(await prisma.amenity.create({ data: { ...a, status: 1 } }));
    }

    // ─── RE PROPERTIES + UNITS ────────────────────────────────────────────────
    const reProps = [], reUnits = [];
    const rePropData = [
      { title: 'Mayfair Gardens Block A', city: 'London', lat: 51.5109, lng: -0.1491 },
      { title: 'Chelsea Heights Tower', city: 'London', lat: 51.4875, lng: -0.1687 },
      { title: 'Kensington Court Villas', city: 'London', lat: 51.5016, lng: -0.1942 },
      { title: 'Canary Wharf Residences', city: 'London', lat: 51.5054, lng: -0.0235 },
      { title: 'Richmond Green Estates', city: 'Richmond', lat: 51.4613, lng: -0.3037 },
    ];
    for (let i = 0; i < 5; i++) {
      const pd = rePropData[i];
      const prop = await prisma.property.create({
        data: {
          tenantId: tenantRE.id, categoryId: catResidential.id,
          propertyType: 1, title: pd.title,
          slug: pd.title.toLowerCase().replace(/\s+/g, '-'),
          description: `Premium ${pd.title} offering luxury living with world-class amenities.`,
          addressLine1: `${(i + 1) * 10} Regent Street`, city: pd.city,
          state: 'Greater London', country: 'UK', postalCode: `W${i + 1}K 3BX`,
          latitude: pd.lat, longitude: pd.lng, status: 1,
          area: 3500 + i * 200, yearBuilt: 2018 + i,
          parkingSpaces: 2, bedrooms: 3, bathrooms: 2,
          price: 1200000 + i * 150000, listingType: 'Sale',
          metadata: { featured: i < 2, tags: ['luxury', 'central-london'] }
        }
      });
      reProps.push(prop);

      await prisma.userPropertyAccess.create({
        data: { tenantId: tenantRE.id, userId: ownerRE.id, propertyId: prop.id, accessLevel: 3 }
      });

      // Amenities
      for (const a of amenities.slice(0, 5)) {
        await prisma.propertyAmenity.create({ data: { propertyId: prop.id, amenityId: a.id } });
      }

      // Media
      const imgUrls = [
        'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?q=80&w=800',
        'https://images.unsplash.com/photo-1600585154340-be6161a46108?q=80&w=800',
        'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?q=80&w=800',
      ];
      const propMedia = [];
      for (let m = 0; m < 3; m++) {
        propMedia.push(await prisma.media.create({
          data: {
            tenantId: tenantRE.id, userId: ownerRE.id,
            filename: `re-prop-${i + 1}-${m + 1}.jpg`, type: 'image',
            url: imgUrls[m % imgUrls.length], category: 'properties', size: 204800
          }
        }));
      }
      await prisma.property.update({
        where: { id: prop.id },
        data: { mainImageId: propMedia[0].id, gallery: propMedia.map(m => m.id) }
      });

      // Units (2 per property)
      for (let u = 0; u < 2; u++) {
        const unitCode = `APT-${(i + 1) * 100 + u + 1}`;
        const unit = await prisma.unit.create({
          data: {
            tenantId: tenantRE.id, propertyId: prop.id,
            unitCategory: 1, unitCode,
            slug: unitCode.toLowerCase().replace(/-/g, '-') + `-${uuidv4().slice(0, 4)}`,
            floorNo: u + 1, capacity: 4, sizeSqft: 1100 + u * 200, status: u === 0 ? 1 : 2,
          }
        });
        reUnits.push(unit);

        await prisma.realEstateUnitDetails.create({
          data: { unitId: unit.id, bedrooms: 2 + u, bathrooms: 2, furnishing: 3, parkingSlots: 1, facing: (u + 1) % 4 + 1 }
        });
        await prisma.unitPricing.create({
          data: { unitId: unit.id, pricingModel: 4, price: 2500 + i * 100 + u * 200, currency: 'GBP' }
        });

        const uMedia = await prisma.media.create({
          data: {
            tenantId: tenantRE.id, userId: ownerRE.id,
            filename: `re-unit-${i + 1}-${u + 1}.jpg`, type: 'image',
            url: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?q=80&w=800',
            category: 'units', size: 153600
          }
        });
        await prisma.unit.update({ where: { id: unit.id }, data: { mainImageId: uMedia.id, gallery: [uMedia.id] } });

        for (const a of amenities.slice(0, 3)) {
          await prisma.unitAmenity.create({ data: { unitId: unit.id, amenityId: a.id } });
        }
      }

      // 3D Config
      await prisma.property3DConfig.create({
        data: {
          propertyId: prop.id,
          config: { scene: { background: '#f5f5f0', ambient: 0.6 }, camera: { fov: 60 } },
          layout: [
            { id: uuidv4(), unitId: reUnits[reUnits.length - 2].id, type: 'apartment', position: { x: 0, y: 0, z: 0 }, dimensions: { w: 12, h: 3, d: 8 }, color: '#e2e8f0' },
            { id: uuidv4(), unitId: reUnits[reUnits.length - 1].id, type: 'apartment', position: { x: 0, y: 3, z: 0 }, dimensions: { w: 12, h: 3, d: 8 }, color: '#dbeafe' }
          ],
          tourData: { hotspots: [{ id: uuidv4(), label: 'Living Room', position: { x: 2, y: 1.5, z: 2 } }] }
        }
      });

      // Listing
      await prisma.listing.create({
        data: {
          tenantId: tenantRE.id, unitId: reUnits[reUnits.length - 2].id,
          slug: `listing-${pd.title.toLowerCase().replace(/\s+/g, '-')}-${uuidv4().slice(0, 4)}`,
          isPublished: true, publishedAt: new Date(),
          seoTitle: `${pd.title} - Luxury Apartment`, seoDescription: `Book ${pd.title} today.`
        }
      });
    }
    console.log('🏘️ RE Properties (5) + Units (10) + Listings created');

    // ─── CW PROPERTIES + UNITS ────────────────────────────────────────────────
    const cwProps = [], cwUnits = [];
    const cwPropData = [
      { title: 'Innovation Hub Alpha', city: 'Bangalore' },
      { title: 'StartupNest Koramangala', city: 'Bangalore' },
      { title: 'TechPark Whitefield', city: 'Bangalore' },
    ];
    for (let i = 0; i < 3; i++) {
      const pd = cwPropData[i];
      const prop = await prisma.property.create({
        data: {
          tenantId: tenantCW.id, categoryId: catOffice.id,
          propertyType: 2, title: pd.title,
          slug: pd.title.toLowerCase().replace(/\s+/g, '-') + `-cw`,
          description: `${pd.title} — a modern coworking space for innovators and founders.`,
          addressLine1: `${(i + 1) * 15} MG Road`, city: pd.city,
          state: 'Karnataka', country: 'India', postalCode: `56000${i + 1}`,
          latitude: 12.9716 + i * 0.05, longitude: 77.5946 + i * 0.05,
          status: 1, area: 5000 + i * 1000, yearBuilt: 2020 + i,
          listingType: 'Rent'
        }
      });
      cwProps.push(prop);

      await prisma.userPropertyAccess.create({
        data: { tenantId: tenantCW.id, userId: ownerCW.id, propertyId: prop.id, accessLevel: 3 }
      });

      for (const a of amenities.slice(5)) {
        await prisma.propertyAmenity.create({ data: { propertyId: prop.id, amenityId: a.id } });
      }

      const cwPropMedia = await prisma.media.create({
        data: {
          tenantId: tenantCW.id, userId: ownerCW.id,
          filename: `cw-prop-${i + 1}.jpg`, type: 'image',
          url: 'https://images.unsplash.com/photo-1497366216548-37526070297c?q=80&w=800',
          category: 'properties', size: 163840
        }
      });
      await prisma.property.update({
        where: { id: prop.id },
        data: { mainImageId: cwPropMedia.id, gallery: [cwPropMedia.id] }
      });

      // 3 desks per CW property
      for (let u = 0; u < 3; u++) {
        const unitCode = `DESK-${(i + 1) * 10 + u + 1}`;
        const unit = await prisma.unit.create({
          data: {
            tenantId: tenantCW.id, propertyId: prop.id,
            unitCategory: 2, unitCode,
            slug: `${unitCode.toLowerCase()}-${uuidv4().slice(0, 4)}`,
            floorNo: 1, capacity: 1, sizeSqft: 50, status: 1,
          }
        });
        cwUnits.push(unit);
        await prisma.unitPricing.create({
          data: { unitId: unit.id, pricingModel: 3, price: 1500 + i * 200 + u * 50, currency: 'INR' }
        });
        for (const a of amenities.slice(5, 8)) {
          await prisma.unitAmenity.create({ data: { unitId: unit.id, amenityId: a.id } });
        }
      }

      await prisma.property3DConfig.create({
        data: {
          propertyId: prop.id,
          config: { scene: { background: '#eceff1', ambient: 0.8 } },
          layout: cwUnits.slice(-3).map((u, idx) => ({
            id: uuidv4(), unitId: u.id, type: 'desk',
            position: { x: idx * 2 - 2, y: 0.5, z: 0 },
            dimensions: { w: 1.5, h: 0.8, d: 1 }, color: '#34d399'
          }))
        }
      });
    }
    console.log('🖥️ CW Properties (3) + Units (9) created');

    // ─── AGENTS ───────────────────────────────────────────────────────────────
    const agentUsers = [reUsers[0], reUsers[1]];
    const agents = [];
    for (let i = 0; i < 2; i++) {
      const agent = await prisma.agent.create({
        data: {
          tenantId: tenantRE.id, userId: agentUsers[i].id,
          specialization: i === 0 ? 'Residential Sales' : 'Commercial Leasing',
          commissionRate: 3.5 + i * 0.5,
          status: 1, totalLeads: 5, totalDeals: 2
        }
      });
      agents.push(agent);
      for (let p = 0; p < 3; p++) {
        await prisma.agentProperty.create({
          data: {
            agentId: agent.id, propertyId: reProps[p + i].id,
            commissionRate: 3.5, isPrimary: p === 0, status: 1
          }
        });
      }
    }

    // ─── LEADS ────────────────────────────────────────────────────────────────
    const reLeads = [], cwLeads = [];
    const sources = [1, 2, 4, 5, 7];
    const leadNames = ['Oliver Brown', 'Sophia Davis', 'Harry Wilson', 'Emma Jones', 'Noah Taylor'];
    for (let i = 0; i < 5; i++) {
      const lead = await prisma.lead.create({
        data: {
          tenantId: tenantRE.id, propertyId: reProps[i % 5].id, unitId: reUnits[i * 2].id,
          name: leadNames[i], email: `${leadNames[i].split(' ')[0].toLowerCase()}@prospects.co`,
          phone: `+4477000000${10 + i}`, source: sources[i], status: (i % 5) + 1,
          priority: (i % 3) + 1, budget: 150000 + i * 50000,
          leadScore: 20 + i * 15, message: `Interested in viewing a 2-bed apartment.`,
          notes: 'Qualified buyer, follow up within 2 days.',
          preferences: { bedrooms: 2, maxBudget: 200000, area: 'Central London' }
        }
      });
      reLeads.push(lead);

      await prisma.agentLead.create({
        data: { agentId: agents[i % 2].id, leadId: lead.id, isPrimary: true, status: 1 }
      });

      // Lead interactions
      for (let j = 0; j < 3; j++) {
        await prisma.leadInteraction.create({
          data: {
            tenantId: tenantRE.id, leadId: lead.id,
            type: ['PROPERTY_VIEW', 'EMAIL_OPEN', 'FORM_SUBMIT'][j],
            metadata: { propertyId: reProps[i % 5].id },
            scoreWeight: [5, 3, 10][j]
          }
        });
      }
    }
    for (let i = 0; i < 3; i++) {
      const lead = await prisma.lead.create({
        data: {
          tenantId: tenantCW.id, propertyId: cwProps[i].id,
          name: cwNames[i].join(' '), email: `${cwNames[i][0].toLowerCase()}@startup.io`,
          phone: `+9190000000${10 + i}`, source: 1, status: i + 1,
          budget: 8000 + i * 2000, leadScore: 30 + i * 10,
          message: 'Looking for a dedicated desk for 3 months.'
        }
      });
      cwLeads.push(lead);
    }
    console.log('📋 Leads created (5 RE + 3 CW) with interactions and agent assignments');

    // ─── BOOKINGS + PAYMENTS + COMMISSIONS ────────────────────────────────────
    const bookings = [];
    const now = new Date();
    for (let i = 0; i < 5; i++) {
      const isRE = i < 3;
      const tenant = isRE ? tenantRE : tenantCW;
      const unit = isRE ? reUnits[i * 2] : cwUnits[i - 3];
      const prop = isRE ? reProps[i] : cwProps[i - 3];
      const user = isRE ? reUsers[i] : cwUsers[i - 3];
      const lead = isRE ? reLeads[i] : cwLeads[i - 3];
      const statusVal = [2, 4, 2, 3, 4][i];
      const totalPrice = isRE ? 2500 + i * 300 : 1500 + i * 100;

      const booking = await prisma.booking.create({
        data: {
          tenantId: tenant.id, propertyId: prop.id, unitId: unit.id,
          userId: user.id, leadId: lead.id,
          agentId: isRE ? agents[i % 2].id : null,
          guestName: user.name, guestEmail: user.email, guestPhone: user.phone,
          startAt: new Date(now.getTime() + i * 7 * 86400000),
          endAt: new Date(now.getTime() + (i + 1) * 7 * 86400000),
          status: statusVal, totalPrice, paymentStatus: 2,
          notes: `Booking ${i + 1} — all requirements confirmed.`,
          specialRequests: i % 2 === 0 ? 'Late check-in requested' : null
        }
      });
      bookings.push(booking);

      const _payment = await prisma.payment.create({
        data: {
          tenantId: tenant.id, bookingId: booking.id, userId: user.id,
          amount: totalPrice, currency: isRE ? 'GBP' : 'INR',
          status: 'COMPLETED', paymentMethod: ['Credit Card', 'UPI', 'Bank Transfer'][i % 3],
          transactionId: `TXN-${uuidv4().slice(0, 12).toUpperCase()}`
        }
      });

      if (isRE) {
        await prisma.commission.create({
          data: {
            tenantId: tenantRE.id, agentId: agents[i % 2].id, bookingId: booking.id,
            amount: totalPrice * 0.035, rateSnapshot: 3.5, status: 'PAID'
          }
        });
      }
    }
    console.log('📅 Bookings (5), Payments, Commissions created');

    // ─── WIDGETS ─────────────────────────────────────────────────────────────
    await prisma.widget.create({
      data: {
        tenantId: tenantRE.id, propertyId: reProps[0].id,
        name: 'Elite Property Listings', uniqueId: 'elite-listing-v2',
        type: 'listing', status: 1,
        configuration: { theme: { primaryColor: '#1e40af', fontFamily: 'Inter' }, display: { layout: 'grid', columns: 3 } }
      }
    });
    await prisma.widget.create({
      data: {
        tenantId: tenantRE.id, name: 'Elite Booking Form', uniqueId: 'elite-booking-v2',
        type: 'booking', status: 1,
        configuration: { theme: { primaryColor: '#059669' }, display: { layout: 'compact' } }
      }
    });
    await prisma.widget.create({
      data: {
        tenantId: tenantCW.id, name: 'Innovation Desk Finder', uniqueId: 'innov-desk-v1',
        type: 'listing', status: 1,
        configuration: { theme: { primaryColor: '#7c3aed' }, display: { layout: 'list' } }
      }
    });

    // ─── WEBSITES + PAGES ─────────────────────────────────────────────────────
    const _websiteRE = await prisma.website.create({
      data: {
        tenantId: tenantRE.id, propertyId: reProps[0].id,
        slug: 'mayfair-gardens', name: 'Mayfair Gardens Official Site',
        customDomain: 'mayfairgardens.co.uk', status: 1,
        configuration: {
          hero: { title: 'Luxury Living in London', subtitle: 'Discover your dream home', buttonText: 'Explore' },
          colors: { primary: '#1e3a8a', accent: '#f59e0b' },
          sections: ['hero', 'listings', 'amenities', 'contact']
        }
      }
    });
    await prisma.page.create({
      data: {
        tenantId: tenantRE.id, title: 'About Elite Real Estate',
        slug: 'about-elite-re', status: 2,
        content: '<h1>About Us</h1><p>Elite Real Estate has been serving London for over 20 years.</p>',
        seoTitle: 'About Elite Real Estate London', seoDescription: 'Award-winning luxury property agency.',
        seoKeywords: 'luxury real estate, london property', publishedAt: new Date()
      }
    });
    await prisma.page.create({
      data: {
        tenantId: tenantRE.id, title: 'Contact Us', slug: 'contact-elite-re', status: 2,
        content: '<h1>Contact</h1><p>Reach us at owner@elite-re.com</p>',
        seoTitle: 'Contact Elite Real Estate', seoDescription: 'Get in touch with our team.',
        publishedAt: new Date()
      }
    });

    // ─── MARKETING MODULE ─────────────────────────────────────────────────────
    const emailTpl = await prisma.emailTemplate.create({
      data: {
        tenantId: tenantRE.id, name: 'New Property Alert', subject: '🏠 New Listing: {{propertyName}}',
        content: '<h2>New Property Available</h2><p>Dear {{name}}, we have a new property matching your criteria.</p>',
        type: 'email', isDefault: true
      }
    });
    const followUpTpl = await prisma.emailTemplate.create({
      data: {
        tenantId: tenantRE.id, name: 'Follow-Up Template', subject: 'Following up on your enquiry',
        content: '<p>Hi {{name}}, just checking in regarding your interest in {{propertyName}}.</p>',
        type: 'email'
      }
    });

    const audienceGroup = await prisma.audienceGroup.create({
      data: {
        tenantId: tenantRE.id, name: 'High-Value London Buyers',
        description: 'Leads with budget > £150k in Central London',
        isDynamic: true,
        filters: { minBudget: 150000, location: 'London', status: [1, 2, 3] },
        leads: { connect: reLeads.map(l => ({ id: l.id })) }
      }
    });
    const audienceGroup2 = await prisma.audienceGroup.create({
      data: {
        tenantId: tenantRE.id, name: 'Recent Enquiries (7 days)',
        description: 'All leads from the past week', isDynamic: true,
        filters: { daysAgo: 7 }
      }
    });

    const campaign1 = await prisma.campaign.create({
      data: {
        tenantId: tenantRE.id, name: 'Spring Launch 2025',
        templateId: emailTpl.id, groupId: audienceGroup.id, status: 4,
        scheduledAt: new Date('2025-03-01'), sentAt: new Date('2025-03-01'),
        totalRecipients: 5, deliveredCount: 5, openedCount: 3, clickedCount: 2
      }
    });
    const _campaign2 = await prisma.campaign.create({
      data: {
        tenantId: tenantRE.id, name: 'Summer Follow-Up',
        templateId: followUpTpl.id, groupId: audienceGroup2.id, status: 2,
        scheduledAt: new Date('2025-06-01'), totalRecipients: 5
      }
    });

    // Campaign Logs
    for (const lead of reLeads) {
      await prisma.campaignLog.create({
        data: {
          tenantId: tenantRE.id, campaignId: campaign1.id, leadId: lead.id,
          status: 'DELIVERED', ipAddress: '82.44.55.66'
        }
      });
    }

    // Marketing Workflow
    const workflow = await prisma.marketingWorkflow.create({
      data: {
        tenantId: tenantRE.id, name: 'New Lead Nurture Sequence',
        description: 'Automatically nurture new leads over 7 days',
        status: 1,
        trigger: { event: 'LEAD_CREATED', filters: { source: [1, 4] } },
        steps: [
          { id: 's1', type: 'EMAIL', delay: 0, templateId: emailTpl.id, label: 'Welcome Email' },
          { id: 's2', type: 'DELAY', delay: 86400, unit: 'seconds', label: 'Wait 1 Day' },
          { id: 's3', type: 'EMAIL', delay: 0, templateId: followUpTpl.id, label: 'Follow-Up Email' },
          { id: 's4', type: 'TAG', delay: 0, tag: 'nurtured', label: 'Tag as Nurtured' }
        ]
      }
    });

    for (let i = 0; i < 3; i++) {
      const enrollment = await prisma.workflowEnrollment.create({
        data: {
          workflowId: workflow.id, leadId: reLeads[i].id,
          currentStep: 's2', status: 1,
          nextActionAt: new Date(Date.now() + 86400000)
        }
      });
      await prisma.workflowLog.create({
        data: {
          tenantId: tenantRE.id, enrollmentId: enrollment.id,
          stepId: 's1', actionType: 'EMAIL', status: 'SUCCESS',
          result: { messageId: `msg_${uuidv4().slice(0, 8)}`, recipient: reLeads[i].email }
        }
      });
    }

    // Form Builder
    await prisma.formBuilder.create({
      data: {
        tenantId: tenantRE.id, name: 'Property Enquiry Form',
        targetGroupId: audienceGroup.id, status: 1,
        configuration: {
          title: 'Book a Viewing', submitLabel: 'Send Enquiry',
          fields: [
            { id: 'f1', label: 'Full Name', type: 'text', required: true },
            { id: 'f2', label: 'Email', type: 'email', required: true },
            { id: 'f3', label: 'Phone', type: 'tel', required: false },
            { id: 'f4', label: 'Message', type: 'textarea', required: false },
            {
              id: 'f5', label: 'Budget Range', type: 'select',
              options: ['< £100k', '£100k–£300k', '£300k–£500k', '> £500k'], required: false
            }
          ]
        }
      }
    });
    await prisma.formBuilder.create({
      data: {
        tenantId: tenantCW.id, name: 'Desk Trial Request', status: 1,
        configuration: {
          title: 'Try a Free Day Pass', submitLabel: 'Request Trial',
          fields: [
            { id: 'f1', label: 'Name', type: 'text', required: true },
            { id: 'f2', label: 'Email', type: 'email', required: true },
            { id: 'f3', label: 'Company', type: 'text', required: false },
            { id: 'f4', label: 'Date', type: 'date', required: true }
          ]
        }
      }
    });
    console.log('📢 Marketing: Templates, Audiences, Campaigns, Workflow, Forms created');

    // ─── SOCIAL MEDIA MODULE ──────────────────────────────────────────────────
    const _connectedFB = await prisma.connectedAccount.create({
      data: {
        tenantId: tenantRE.id, userId: ownerRE.id,
        platform: 'FACEBOOK', accountId: 'fb_104567890123456',
        accountName: 'Elite Real Estate London',
        accessToken: 'EAALongFBAccessToken_SAMPLE', tokenExpiry: new Date('2026-01-01'),
        isActive: true, metadata: { pageId: '104567890123456', category: 'Real Estate' }
      }
    });
    const _connectedIG = await prisma.connectedAccount.create({
      data: {
        tenantId: tenantRE.id, userId: ownerRE.id,
        platform: 'INSTAGRAM', accountId: 'ig_17841450123456',
        accountName: '@eliterealestatelondon',
        accessToken: 'EAALongIGAccessToken_SAMPLE', tokenExpiry: new Date('2026-01-01'),
        isActive: true, metadata: { businessAccountId: '17841450123456' }
      }
    });

    const _scheduledPost1 = await prisma.scheduledPost.create({
      data: {
        tenantId: tenantRE.id, userId: ownerRE.id, propertyId: reProps[0].id,
        title: '🏠 New Mayfair Listing — Limited Units!',
        description: 'Discover luxury 2-bed apartments in the heart of Mayfair. Call us today!',
        hashtags: '#MayfairLiving #LuxuryApartments #LondonRealEstate #EliteRE',
        platforms: ['FACEBOOK', 'INSTAGRAM'],
        scheduledDate: new Date('2025-04-10'),
        scheduledTime: '09:00', status: 'SCHEDULED',
        mediaUrls: ['https://images.unsplash.com/photo-1512917774080-9991f1c4c750?q=80&w=800'],
        imageData: { width: 1080, height: 1080, format: 'jpeg' }
      }
    });
    const scheduledPost2 = await prisma.scheduledPost.create({
      data: {
        tenantId: tenantRE.id, userId: ownerRE.id, propertyId: reProps[1].id,
        title: '✨ Chelsea Heights — Your Dream Home Awaits',
        description: 'Breathtaking views, premium finishes. Limited availability.',
        hashtags: '#ChelseaLiving #LondonProperties #LuxuryHomes',
        platforms: ['FACEBOOK'], scheduledDate: new Date('2025-04-12'),
        scheduledTime: '11:00', status: 'POSTED',
        mediaUrls: ['https://images.unsplash.com/photo-1600585154340-be6161a46108?q=80&w=800'],
        lastPostedAt: new Date('2025-04-12T11:00:00Z')
      }
    });

    await prisma.publishedPost.create({
      data: {
        tenantId: tenantRE.id, userId: ownerRE.id,
        scheduledPostId: scheduledPost2.id, platform: 'FACEBOOK',
        platformPostId: 'fb_post_987654321', postUrl: 'https://fb.com/posts/987654321',
        caption: '✨ Chelsea Heights — Your Dream Home Awaits',
        mediaUrls: scheduledPost2.mediaUrls,
        hashtags: scheduledPost2.hashtags, status: 'published',
        metrics: { likes: 142, comments: 23, shares: 44, reach: 3420 }
      }
    });
    console.log('📱 Social: Connected accounts, scheduled posts, published posts created');

    // ─── WHATSAPP MODULE ──────────────────────────────────────────────────────
    await prisma.whatsAppTemplate.create({
      data: {
        tenantId: tenantRE.id, wabaId: 'WABA_123456789',
        name: 'property_alert_v2', category: 'MARKETING',
        language: 'en', status: 'APPROVED',
        components: [
          { type: 'HEADER', format: 'IMAGE' },
          { type: 'BODY', text: 'Hi {{1}}, we have a new property matching your budget of £{{2}} in {{3}}. Tap below to view!' },
          { type: 'FOOTER', text: 'Reply STOP to unsubscribe' },
          { type: 'BUTTONS', buttons: [{ type: 'URL', text: 'View Property', url: 'https://elite-re.com/property/{{4}}' }] }
        ],
        variables: ['name', 'budget', 'location', 'propertySlug']
      }
    });

    const waCampaign = await prisma.whatsAppCampaign.create({
      data: {
        tenantId: tenantRE.id, userId: ownerRE.id,
        wabaId: 'WABA_123456789', phoneNumberId: 'PHN_44123456789',
        templateName: 'property_alert_v2',
        name: 'April Property Launch', status: 'SENT',
        scheduledAt: new Date('2025-04-05'), sentCount: 5, deliveredCount: 5,
        readCount: 3, failedCount: 0
      }
    });

    for (let i = 0; i < 3; i++) {
      await prisma.whatsAppMessage.create({
        data: {
          tenantId: tenantRE.id, businessId: 'WABA_123456789',
          campaignId: waCampaign.id,
          senderNumber: reLeads[i].phone || `+44770000001${i}`,
          messageText: `Hi ${reLeads[i].name}, we have a new property matching your budget...`,
          direction: 'OUTBOUND', metaMessageId: `wamid.${uuidv4().replace(/-/g, '')}`,
          status: 'read'
        }
      });
    }
    // Inbound chatbot message
    await prisma.whatsAppMessage.create({
      data: {
        tenantId: tenantRE.id, businessId: 'WABA_123456789',
        senderNumber: '+447700000100',
        messageText: 'Hi, I saw your listing and I am interested. Can you share more details?',
        direction: 'INBOUND', metaMessageId: `wamid.${uuidv4().replace(/-/g, '')}`,
        status: 'received'
      }
    });
    console.log('💬 WhatsApp: Templates, Campaigns, Messages created');

    // ─── PLAN UPGRADE REQUESTS ────────────────────────────────────────────────
    await prisma.planUpgradeRequest.create({
      data: {
        tenantId: tenantCW.id, ownerId: ownerCW.id,
        requestedPlanId: proPlan.id, status: 1,
        email: ownerCW.email,
        message: 'We need WhatsApp and social media features to scale our marketing efforts.'
      }
    });

    // ─── INTEGRATIONS ─────────────────────────────────────────────────────────
    await prisma.integration.create({
      data: {
        tenantId: tenantRE.id, platform: 'wordpress',
        siteUrl: 'https://eliterealstate-wp.com', siteName: 'Elite RE WordPress Site',
        apiKey: `INT-${uuidv4().slice(0, 16).toUpperCase()}`,
        environment: 'production', isSandbox: false, status: true,
        lastSyncAt: new Date()
      }
    });

    // ─── AUDIT LOGS ───────────────────────────────────────────────────────────
    const auditEvents = [
      { action: 'LOGIN', entity: 'User', userId: ownerRE.id, tenantId: tenantRE.id },
      { action: 'CREATE_PROPERTY', entity: 'Property', userId: ownerRE.id, tenantId: tenantRE.id, entityId: reProps[0].id },
      { action: 'CREATE_BOOKING', entity: 'Booking', userId: reUsers[0].id, tenantId: tenantRE.id, entityId: bookings[0].id },
      { action: 'SEND_CAMPAIGN', entity: 'Campaign', userId: ownerRE.id, tenantId: tenantRE.id, entityId: campaign1.id },
      { action: 'LOGIN', entity: 'User', userId: ownerCW.id, tenantId: tenantCW.id },
    ];
    for (const ev of auditEvents) {
      await prisma.auditLog.create({
        data: { ...ev, ipAddress: '82.44.' + Math.floor(Math.random() * 255) + '.' + Math.floor(Math.random() * 255) }
      });
    }

    console.log('\n✅ ─────────────────────────────────────────────');
    console.log('   Comprehensive sample data generation COMPLETE');
    console.log('   ─────────────────────────────────────────────');
    console.log('   Admin login:  admin@system.com / password123');
    console.log('   RE Owner:     owner@elite-re.com / password123');
    console.log('   CW Owner:     owner@innovation-cw.com / password123');
    console.log('   Sub-user:     alice@elite-re.com / password123');
    console.log('✅ ─────────────────────────────────────────────\n');

  } catch (error) {
    console.error('❌ Error generating sample data:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

generateSampleData();
