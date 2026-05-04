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

module.exports = { parseWhatsAppPayload };
