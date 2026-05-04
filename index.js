const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const LEADS_FILE = path.join(__dirname, 'leads.txt');

// Helper to hash phone number (TikTok CAPI requirement: SHA256)
const hashData = (data) => {
    if (!data) return null;
    return crypto.createHash('sha256').update(data.trim()).digest('hex');
};

// 1. WhatsApp Webhook (Verification for Cloud API)
app.get('/webhook/whatsapp', (req, res) => {
    console.log("WhatsApp webhook Triggered GET method");
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === process.env.WHATSAPP_TOKEN) {
        console.log('Webhook verified');
        return res.status(200).send(challenge);
    }
    res.sendStatus(403);
});


app.post('/webhook/whatsapp', (req, res) => {
    console.log("Incoming webhook:");

    const body = req.body;
    console.log(JSON.stringify(body, null, 2));

    // Always respond 200 OK
    res.sendStatus(200);
});

// Function to simulate TikTok Conversion API call
async function sendToTikTokCAPI(hashedPhone, originalPhone) {
    const pixelId = process.env.TIKTOK_PIXEL_ID;
    const accessToken = process.env.TIKTOK_ACCESS_TOKEN;

    const url = "https://business-api.tiktok.com/open_api/v1.3/event/track/";

    const payload = {
        event_source_id: pixelId,
        event_source: "web",
        test_event_code: "TEST97325",   // ← add this temporarily
        data: [
            {
                event: "Contact",
                event_id: `event_${Date.now()}`,
                event_time: Math.floor(Date.now() / 1000),
                context: {
                    user: {
                        phone_number: hashedPhone
                    }
                }
            }
        ]
    };

    try {
        const response = await axios.post(url, payload, {
            headers: {
                "Access-Token": accessToken,
                "Content-Type": "application/json"
            }
        });

        console.log("TikTok Response:", response.data);
    } catch (err) {
        console.error("TikTok API Error:", err.response?.data || err.message);
    }
}

// 5. Route to view leads in browser
app.get('/leads', (req, res) => {
    if (!fs.existsSync(LEADS_FILE)) {
        return res.send('<h1>No leads created yet.</h1>');
    }
    const content = fs.readFileSync(LEADS_FILE, 'utf8');
    res.send(`<pre>${content}</pre>`);
});

app.listen(PORT, () => {
    console.log(`Mock server running on http://localhost:${PORT}`);
    console.log(`Webhook URL: http://localhost:${PORT}/webhook/whatsapp`);
});
