const getTenantId = (req) => {
    let tenantId = req.query?.tenantId || req.user?.tenantId || req.tenant?.id || null;
    if (tenantId === 'undefined' || tenantId === 'null') tenantId = null;
    return tenantId;
};

const checkTenantId = (req, res) => {
    const tenantId = getTenantId(req);
    if (!tenantId) {
        res.status(400).json({ success: false, message: 'Tenant context required' });
        return null;
    }
    return tenantId;
};

module.exports = {
    getTenantId,
    checkTenantId
};
