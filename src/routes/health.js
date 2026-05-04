const express = require('express');
const router = express.Router();
const ZohoToken = require('../services/zohoToken');

router.get('/', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        zohoToken: ZohoToken.accessToken ? 'active' : 'not loaded',
        tokenExpiry: ZohoToken.expiresAt
            ? new Date(ZohoToken.expiresAt).toISOString()
            : 'N/A'
    });
});

module.exports = router;
