const mineflayer = require('mineflayer');
const fs = require('fs');
const path = require('path');
const auth = require('./auth');
const dashboard = require('./dashboard');

let bots = [];
let config = null;

function createDefaultConfig(configPath) {
    const defaultConfig = {
        server: "example.minecraftserver.net",
        target: "TargetPlayerIGN",
        emails: [
            "bot1@example.com",
            "bot2@example.com",
            "bot3@example.com"
        ]
    };
    
    fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 4));
    return defaultConfig;
}

function loadConfig(mainDir) {
    const configPath = path.join(mainDir, 'config.json');
    
    if (!fs.existsSync(configPath)) {
        console.log('[-] config.json not found. Creating default config file...');
        createDefaultConfig(configPath);
        console.log('[+] Created config.json. Please add your email accounts and restart the program.');
        process.exit(0);
    }
    
    try {
        const configData = fs.readFileSync(configPath, 'utf8');
        config = JSON.parse(configData);
        
        // Validate config structure
        if (!config.emails || !Array.isArray(config.emails)) {
            console.log('[-] Invalid config: missing "emails" array');
            process.exit(1);
        }
        
        if (config.emails.length === 0) {
            console.log('[-] No email accounts found in config.json. Please add your accounts.');
            process.exit(1);
        }
        
        // Check for target
        if (!config.target) {
            console.log('[-] No target specified in config.json. Please add a "target" field.');
            process.exit(1);
        }
        
        return config;
    } catch (error) {
        console.log(`[-] Error loading config.json: ${error.message}`);
        process.exit(1);
    }
}

function connectBotsToServer() {
    if (!auth.isReadyToConnect()) {
        console.log('[/] Please wait for Microsoft authentication to complete first');
        return;
    }

    const botCount = config.emails.length;
    
    bots = []; // Clear previous bots
    
    for (let i = 0; i < botCount; i++) {
        const email = config.emails[i];
        setTimeout(() => {
            createBot(email, i);
        }, i * 2000); // Stagger connections by 2 seconds to avoid rate limits
    }
}

function createBot(email, index) {
    console.log(`[/] Connecting bot ${index + 1}: ${email}`);
    
    const bot = mineflayer.createBot({
        host: config.server,
        username: email,
        auth: 'microsoft',
        version: '1.8.9',
        checkTimeoutInterval: 60 * 1000
    });

    bot.email = email;
    bot.id = index + 1; // Add ID for dashboard
    bot.isFinding = false;
    bot.targetFound = false;
    bot.connectionError = false;
    bot.currentLobby = 'unknown';
    bot.swapFailed = false;
    bot.retryTime = null;

    bot.on('login', () => {
        console.log(`[+] Bot ${index + 1} (${email}) connected to server`);
        dashboard.updateBotStatus(bot, 'connected');
    });

    bot.on('error', (err) => {
        console.log(`[-] Bot ${index + 1} (${email}) error: ${err.message}`);
        dashboard.updateBotStatus(bot, 'connectionError');
    });

    bot.on('end', (reason) => {
        console.log(`[-] Bot ${index + 1} (${email}) disconnected: ${reason}`);
        // Remove from bots array
        const botIndex = bots.findIndex(b => b === bot);
        if (botIndex !== -1) {
            bots.splice(botIndex, 1);
            dashboard.updateBotList(bots); // Update dashboard
        }
        // Clear find interval if exists
        if (bot.findInterval) {
            clearInterval(bot.findInterval);
        }
    });

    bot.on('kicked', (reason) => {
        console.log(`[-] Bot ${index + 1} (${email}) kicked: ${reason}`);
        dashboard.updateBotStatus(bot, 'connectionError');
    });

    bot.on('message', (message) => {
        const text = message.toString();
        if (!text.includes('§') && text.length > 1) { // Filter out system messages
            console.log(`[Bot ${index + 1}] 💬 ${text}`);
        }
        
        // Detect lobby changes and target presence
        if (text.includes('Sending you to') || text.includes('Sending to')) {
            const lobbyMatch = text.match(/Sending (?:you|to) (.*?)[!.]/);
            if (lobbyMatch) {
                bot.currentLobby = lobbyMatch[1];
                dashboard.updateBotStatus(bot, 'lobbyChange', bot.currentLobby);
                console.log(`[Bot ${index + 1}] 🎯 Now in lobby: ${bot.currentLobby}`);
            }
        }
        
        // Check if target is in the same lobby
        if (bot.isFinding && text.includes(config.target)) {
            console.log(`🎯🎯🎯 [Bot ${index + 1}] TARGET FOUND: ${config.target} is in the same lobby! 🎯🎯🎯`);
            dashboard.updateBotStatus(bot, 'targetFound');
            // Stop finding for this bot since target is found
            bot.isFinding = false;
            if (bot.findInterval) {
                clearInterval(bot.findInterval);
                bot.findInterval = null;
            }
        }
        
        // Detect when we're in hub
        if (text.includes('You are currently in the Hub')) {
            bot.currentLobby = 'Hub';
            dashboard.updateBotStatus(bot, 'lobbyChange', 'Hub');
        }
        
        // Detect when we're in pit
        if (text.includes('The Pit') || text.toLowerCase().includes('pit')) {
            bot.currentLobby = 'Pit';
            dashboard.updateBotStatus(bot, 'lobbyChange', 'Pit');
        }
        
        // Detect swap failures
        if (text.includes('You are already connected to this server') || 
            text.includes('Cannot join another game') ||
            text.includes('You were spawned in Limbo')) {
            
            bot.swapFailed = true;
            bot.retryTime = 10; // Retry in 10 seconds
            dashboard.updateBotStatus(bot, 'swapFailed', 10);
            
            console.log(`[Bot ${index + 1}] ⚠️ Swap failed, retrying in 10 seconds`);
            
            // Clear existing interval and set retry
            if (bot.retryTimeout) clearTimeout(bot.retryTimeout);
            bot.retryTimeout = setTimeout(() => {
                bot.swapFailed = false;
                bot.retryTime = null;
                dashboard.updateBotStatus(bot, 'swapRetrying');
                // Retry the command
                if (bot.currentLobby === 'Hub' || bot.currentLobby === 'unknown') {
                    bot.chat('/play pit');
                } else {
                    bot.chat('/hub');
                }
            }, 10000);
        }
    });

    // Listen for player spawn events (when players join the same world)
    bot.on('playerJoined', (player) => {
        if (bot.isFinding && player.username === config.target) {
            console.log(`[!] [Bot ${index + 1}] TARGET FOUND via player join: ${config.target} joined the same world!`);
            dashboard.updateBotStatus(bot, 'targetFound');
            bot.isFinding = false;
            if (bot.findInterval) {
                clearInterval(bot.findInterval);
                bot.findInterval = null;
            }
        }
    });

    // Listen for entity spawn (alternative method to detect players)
    bot.on('entitySpawn', (entity) => {
        if (entity.type === 'player' && bot.isFinding && entity.username === config.target) {
            console.log(`[!] [Bot ${index + 1}] TARGET FOUND via entity spawn: ${config.target} is in the same world!`);
            dashboard.updateBotStatus(bot, 'targetFound');
            bot.isFinding = false;
            if (bot.findInterval) {
                clearInterval(bot.findInterval);
                bot.findInterval = null;
            }
        }
    });

    bots.push(bot);
    dashboard.updateBotList(bots);
    return bot;
}

function sendChatMessage(message) {
    bots.forEach((bot, index) => {
        setTimeout(() => {
            if (bot._client && bot._client.connected) {
                bot.chat(message);
                console.log(`[Bot ${index + 1}] 📤 Sent: ${message}`);
            }
        }, index * 1000); // Stagger messages by 1 second
    });
}

function disconnectAllBots() {
    bots.forEach(bot => {
        if (bot.findInterval) {
            clearInterval(bot.findInterval);
        }
        if (bot.retryTimeout) {
            clearTimeout(bot.retryTimeout);
        }
        bot.end();
    });
    bots = [];
    dashboard.updateBotList(bots);
}

function getBots() {
    return bots;
}

function getConfig() {
    return config;
}

module.exports = {
    loadConfig,
    connectBotsToServer,
    sendChatMessage,
    disconnectAllBots,
    getBots,
    getConfig
};