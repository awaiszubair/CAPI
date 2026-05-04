const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
require('dotenv').config();

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

// ─────────────────────────────────────────────
// ZOHO OAuth2 Token Manager
// Auto-refreshes access token before it expires
// ─────────────────────────────────────────────
const ZohoToken = {
    accessToken: null,
    expiresAt: null,

    async get() {
        const isExpired = !this.accessToken || !this.expiresAt || Date.now() >= this.expiresAt;
        if (isExpired) {
            console.log('🔄 Zoho access token expired — refreshing...');
            await this.refresh();
        }
        return this.accessToken;
    },

    async refresh() {
        const params = new URLSearchParams();
        params.append('grant_type', 'refresh_token');
        params.append('client_id', process.env.ZOHO_CLIENT_ID);
        params.append('client_secret', process.env.ZOHO_CLIENT_SECRET);
        params.append('refresh_token', process.env.ZOHO_REFRESH_TOKEN);

        const response = await axios.post(
            'https://accounts.zoho.com/oauth/v2/token',
            params,
            { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
        );

        const data = response.data;
        if (data.error) throw new Error(`Zoho token refresh failed: ${data.error}`);

        this.accessToken = data.access_token;
        // Expire 5 minutes early to avoid mid-request edge case
        this.expiresAt = Date.now() + (data.expires_in - 300) * 1000;
        console.log(`✅ Zoho token refreshed — valid for ~${Math.floor((data.expires_in - 300) / 60)} minutes`);
    }
};

// ─────────────────────────────────────────────
// Parse WhatsApp Payload
// Extracts all useful fields from Meta's payload
// ─────────────────────────────────────────────
function parseWhatsAppPayload(body) {
    const value = body?.entry?.[0]?.changes?.[0]?.value;
    const messages = value?.messages;
    const contacts = value?.contacts;
    const metadata = value?.metadata;

    if (!messages || messages.length === 0) return null;

    const msg = messages[0];
    const contact = contacts?.[0];

    // ── Sender Info ──────────────────────────
    const phone = msg.from || contact?.wa_id || '';
    const fullName = contact?.profile?.name || '';
    const nameParts = fullName.trim().split(' ');
    const firstName = nameParts[0] || 'WhatsApp';
    const lastName = nameParts.slice(1).join(' ') || phone; // fallback to phone if no last name
    const waId = contact?.wa_id || phone;
    const userId = contact?.user_id || '';

    // ── Message Info ─────────────────────────
    const msgId = msg.id || '';
    const msgType = msg.type || 'text';
    const timestamp = msg.timestamp
        ? new Date(parseInt(msg.timestamp) * 1000).toISOString()
        : new Date().toISOString();

    let msgBody = '';
    switch (msgType) {
        case 'text': msgBody = msg.text?.body || ''; break;
        case 'image': msgBody = '[Image message]'; break;
        case 'audio': msgBody = '[Audio message]'; break;
        case 'video': msgBody = '[Video message]'; break;
        case 'document': msgBody = '[Document message]'; break;
        case 'location':
            msgBody = `[Location: ${msg.location?.latitude}, ${msg.location?.longitude}]`;
            break;
        default: msgBody = `[${msgType} message]`;
    }

    // ── Business Phone Info ───────────────────
    const businessPhone = metadata?.display_phone_number || '';
    const phoneNumberId = metadata?.phone_number_id || '';

    return {
        // Sender
        phone,
        firstName,
        lastName,
        fullName,
        waId,
        userId,
        // Message
        msgId,
        msgType,
        msgBody,
        timestamp,
        // Business
        businessPhone,
        phoneNumberId
    };
}

// ─────────────────────────────────────────────
// ZOHO CRM — Save Lead
// ─────────────────────────────────────────────
async function saveLeadToZoho(data, retried = false) {
    try {
        const token = await ZohoToken.get();

        // ── Step 1: Check if lead already exists by phone ──
        const searchRes = await axios.get(
            `https://sandbox.zohoapis.com/crm/v2/Leads/search?criteria=(Phone:equals:${data.phone})`,
            {
                headers: {
                    'Authorization': `Zoho-oauthtoken ${token}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        if (searchRes.data?.data?.length > 0) {
            const existingId = searchRes.data.data[0].id;
            console.log(`⏭️  Lead already exists for ${data.phone} | Zoho ID: ${existingId} — skipping.`);
            return existingId;
        }

        // ── Step 2: Not found — create new lead ──
        const description = [
            `Message: ${data.msgBody}`,
            `Type: ${data.msgType}`,
            `Received: ${data.timestamp}`,
            `WA ID: ${data.waId}`,
            `Message ID: ${data.msgId}`,
            `Business Phone: ${data.businessPhone}`,
            `Phone Number ID: ${data.phoneNumberId}`,
        ].join('\n');

        const leadData = {
            data: [
                {
                    First_Name: data.firstName,
                    Last_Name: data.lastName,
                    Phone: data.phone,
                    Description: description,
                    Lead_Source: 'WhatsApp',
                    Company: 'TEST - DO NOT USE',
                    Tag: [{ name: 'whatsapp_test' }]
                }
            ],
            trigger: []
        };

        const response = await axios.post(
            'https://sandbox.zohoapis.com/crm/v2/Leads',
            leadData,
            {
                headers: {
                    'Authorization': `Zoho-oauthtoken ${token}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        const result = response.data?.data?.[0];

        if (result?.status === 'success') {
            console.log(`✅ Lead saved | Zoho ID: ${result.details.id} | Name: ${data.firstName} ${data.lastName} | Phone: ${data.phone}`);
            return result.details.id;
        } else {
            console.warn('⚠️  Zoho non-success:', JSON.stringify(result));
            return null;
        }

    } catch (err) {
        if (err.response?.status === 401 && !retried) {
            console.warn('⚠️  401 — forcing token refresh and retrying...');
            await ZohoToken.refresh();
            return saveLeadToZoho(data, true);
        }
        // 404 from search means no leads found — safe to proceed to create
        if (err.response?.status === 404) {
            console.log('ℹ️  No existing lead found via search — will create new.');
            return saveLeadToZoho(data, retried);
        }
        console.error('❌ Zoho CRM Error:', err.response?.data || err.message);
        return null;
    }
}

// ─────────────────────────────────────────────
// TikTok Conversion API (optional)
// ─────────────────────────────────────────────
const hashData = (data) => {
    if (!data) return null;
    return crypto.createHash('sha256').update(data.trim()).digest('hex');
};

async function sendToTikTokCAPI(hashedPhone) {
    const payload = {
        event_source_id: process.env.TIKTOK_PIXEL_ID,
        event_source: 'offline',
        test_event_code: 'TEST02168',
        data: [{
            event: 'Contact',
            event_id: `event_${Date.now()}`,
            event_time: Math.floor(Date.now() / 1000),
            context: { user: { phone_number: hashedPhone } }
        }]
    };

    try {
        const response = await axios.post(
            'https://business-api.tiktok.com/open_api/v1.3/event/track/',
            payload,
            {
                headers: {
                    'Access-Token': process.env.TIKTOK_ACCESS_TOKEN,
                    'Content-Type': 'application/json'
                }
            }
        );
        console.log('📊 TikTok CAPI Response:', response.data);
    } catch (err) {
        console.error('❌ TikTok CAPI Error:', err.response?.data || err.message);
    }
}

// ─────────────────────────────────────────────
// WhatsApp Webhook — Verification (GET)
// ─────────────────────────────────────────────
app.get('/webhook/whatsapp', (req, res) => {
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
app.post('/webhook/whatsapp', async (req, res) => {
    // Always respond 200 immediately — Meta retries if response is slow
    res.sendStatus(200);

    try {
        console.log('📩 Incoming WhatsApp payload:');
        console.log(JSON.stringify(req.body, null, 2));

        const parsed = parseWhatsAppPayload(req.body);

        if (!parsed) {
            console.log('ℹ️  No messages found — likely a status update, skipping.');
            return;
        }

        console.log(`📱 From: ${parsed.phone} | Name: ${parsed.fullName} | Type: ${parsed.msgType} | Body: ${parsed.msgBody}`);

        // 1. Save to Zoho CRM
        await saveLeadToZoho(parsed);

        // 2. TikTok CAPI (only if configured)
        if (process.env.TIKTOK_PIXEL_ID && process.env.TIKTOK_ACCESS_TOKEN) {
            await sendToTikTokCAPI(hashData(parsed.phone));
        }

    } catch (err) {
        console.error('❌ Webhook processing error:', err.message);
    }
});

// ─────────────────────────────────────────────
// Health Check
// ─────────────────────────────────────────────
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        zohoToken: ZohoToken.accessToken ? 'active' : 'not loaded',
        tokenExpiry: ZohoToken.expiresAt
            ? new Date(ZohoToken.expiresAt).toISOString()
            : 'N/A'
    });
});

// ─────────────────────────────────────────────
// Start Server
// ─────────────────────────────────────────────
app.listen(PORT, async () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📡 Webhook: http://localhost:${PORT}/webhook/whatsapp`);

    try {
        await ZohoToken.refresh();
        console.log('🔑 Zoho token pre-loaded at startup');
    } catch {
        console.warn('⚠️  Could not pre-load Zoho token — will retry on first API call');
    }
});