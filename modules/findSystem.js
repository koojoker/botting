const botManager = require('./botManager');
const dashboard = require('./dashboard');

let isFinding = false;

function startFinding() {
    const bots = botManager.getBots();
    const config = botManager.getConfig();
    
    if (bots.length === 0) {
        console.log('[-] No bots connected. Use "start" first.');
        return;
    }
    
    if (isFinding) {
        console.log('[-] Finding is already active.');
        return;
    }
    
    console.log(`[/] Starting to search for target: ${config.target}`);
    isFinding = true;
    
    bots.forEach((bot, index) => {
        if (!bot.isFinding && bot._client && bot._client.connected) {
            bot.isFinding = true;
            bot.targetFound = false;
            bot.swapFailed = false;
            bot.retryTime = null;
            dashboard.updateBotStatus(bot, 'findingStarted');
            
            // Initial command to start the cycle
            setTimeout(() => {
                bot.chat('/play pit');
            }, index * 500); // Stagger initial commands
            
            // Set up the find interval
            bot.findInterval = setInterval(() => {
                if (!bot.isFinding || bot.targetFound || !bot._client || !bot._client.connected) {
                    if (bot.findInterval) {
                        clearInterval(bot.findInterval);
                        bot.findInterval = null;
                    }
                    return;
                }
                
                // Only swap if not already waiting for a retry
                if (!bot.swapFailed) {
                    // Alternate between pit and hub
                    if (bot.currentLobby === 'Hub' || bot.currentLobby === 'unknown') {
                        bot.chat('/play pit');
                    } else {
                        bot.chat('/hub');
                    }
                }
            }, 10000); // 10 second cycle
        }
    });
}

function stopFinding() {
    if (!isFinding) {
        return;
    }
    
    console.log('[/] Stopping search for all bots');
    isFinding = false;
    
    const bots = botManager.getBots();
    bots.forEach((bot, index) => {
        bot.isFinding = false;
        bot.swapFailed = false;
        bot.retryTime = null;
        dashboard.updateBotStatus(bot, 'findingStopped');
        if (bot.findInterval) {
            clearInterval(bot.findInterval);
            bot.findInterval = null;
        }
        if (bot.retryTimeout) {
            clearTimeout(bot.retryTimeout);
            bot.retryTimeout = null;
        }
    });
}

function isFindingActive() {
    return isFinding;
}

module.exports = {
    startFinding,
    stopFinding,
    isFindingActive
};