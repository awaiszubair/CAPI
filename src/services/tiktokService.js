const axios = require('axios');
const crypto = require('crypto');

const hashData = (data) => {
    if (!data) return null;
    return crypto.createHash('sha256').update(data.trim()).digest('hex');
};

async function sendToTikTokCAPI(hashedPhone) {
    const payload = {
        event_source_id: process.env.TIKTOK_PIXEL_ID,
        event_source: 'offline',
        // test_event_code: 'TEST02168',
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

module.exports = { hashData, sendToTikTokCAPI };
