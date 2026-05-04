const express = require('express');
const router = express.Router();
const webhookQueue = require('../config/queue');
const { parseWhatsAppPayload } = require('../utils/whatsappParser');
const { saveLeadToZoho } = require('../services/zohoService');
const { hashData, sendToTikTokCAPI } = require('../services/tiktokService');

// ─────────────────────────────────────────────
// WhatsApp Webhook — Verification (GET)
// ─────────────────────────────────────────────
router.get('/', (req, res) => {
    console.log('📡 Meta verification request received');
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === process.env.WHATSAPP_TOKEN) {
        console.log('✅ Webhook verified');
        return res.status(200).send(challenge);
    }

    console.warn('❌ Webhook verification failed — token mismatch');
    res.sendStatus(403);
});

// ─────────────────────────────────────────────
// WhatsApp Webhook — Incoming Messages (POST)
// ─────────────────────────────────────────────
router.post('/', async (req, res) => {
    // Always respond 200 immediately — Meta retries if response is slow
    res.sendStatus(200);

    const body = req.body;

    // Push all heavy processing into the queue — safe under burst traffic
    webhookQueue.add(async () => {
        try {
            console.log('📩 Incoming WhatsApp payload:');
            console.log(JSON.stringify(body, null, 2));

            const parsed = parseWhatsAppPayload(body);

            if (!parsed) {
                console.log('ℹ️  No messages found — likely a status update, skipping.');
                return;
            }

            console.log(`📱 From: ${parsed.phone} | Name: ${parsed.fullName} | Type: ${parsed.msgType} | Body: ${parsed.msgBody}`);

            // 1. Save to Zoho CRM
            const zohoResult = await saveLeadToZoho(parsed);

            // 2. TikTok CAPI (only if configured AND it's a new lead)
            if (zohoResult?.isNew && process.env.TIKTOK_PIXEL_ID && process.env.TIKTOK_ACCESS_TOKEN) {
                await sendToTikTokCAPI(hashData(parsed.phone));
            } else if (!zohoResult?.isNew) {
                console.log('⏭️  Existing lead — skipping TikTok event to prevent duplication.');
            }

        } catch (err) {
            console.error('❌ Webhook processing error:', err.message);
        }
    });
});

module.exports = router;
