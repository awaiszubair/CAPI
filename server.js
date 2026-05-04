const express = require('express');
require('dotenv').config();

const whatsappRoutes = require('./src/routes/whatsappWebhook');
const healthRoutes = require('./src/routes/health');
const ZohoToken = require('./src/services/zohoToken');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

// Routes
app.use('/webhook/whatsapp', whatsappRoutes);
app.use('/health', healthRoutes);

// Start Server
app.listen(PORT, async () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📡 Webhook: http://localhost:${PORT}/webhook/whatsapp`);

    try {
        await ZohoToken.refresh();
        console.log('🔑 Zoho token pre-loaded at startup');
    } catch (err) {
        console.warn('⚠️  Could not pre-load Zoho token — will retry on first API call:', err.message);
    }
});