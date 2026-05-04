const axios = require('axios');

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

module.exports = ZohoToken;
