const PQueue = require('p-queue').default;

const webhookQueue = new PQueue({ concurrency: 5 });

webhookQueue.on('add', () => {
    console.log(`📋 Queue size: ${webhookQueue.size} | Active jobs: ${webhookQueue.pending}`);
});

webhookQueue.on('idle', () => {
    console.log('✅ Queue is idle — all jobs processed.');
});

module.exports = webhookQueue;
