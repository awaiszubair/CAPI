const axios = require('axios');
const ZohoToken = require('./zohoToken');

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
            return { id: existingId, isNew: false };
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
                    Lead_Status: 'Contacted', // Updated as requested
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
            return { id: result.details.id, isNew: true };
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

module.exports = { saveLeadToZoho };
