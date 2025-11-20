const mineflayer = require('mineflayer');
const readline = require('readline');
const fs = require('fs');
const path = require('path');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// Config file handling
const CONFIG_FILE = 'config.json';

function createDefaultConfig() {
    const defaultConfig = {
        server: "example.minecraftserver.net",
        emails: [
            "bot1@example.com",
            "bot2@example.com",
            "bot3@example.com"
        ]
    };
    
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(defaultConfig, null, 4));
    return defaultConfig;
}

function loadConfig() {
    if (!fs.existsSync(CONFIG_FILE)) {
        console.log('[-] config.json not found. Creating default config file...');
        createDefaultConfig();
        console.log('[+] Created config.json. Please add your email accounts and restart the program.');
        process.exit(0);
    }
    
    try {
        const configData = fs.readFileSync(CONFIG_FILE, 'utf8');
        const config = JSON.parse(configData);
        
        // Validate config structure
        if (!config.emails || !Array.isArray(config.emails)) {
            console.log('[-] Invalid config: missing "emails" array');
            process.exit(1);
        }
        
        if (config.emails.length === 0) {
            console.log('[-] No email accounts found in config.json. Please add your accounts.');
            process.exit(1);
        }
        
        console.log(`[+] Loaded ${config.emails.length} email account(s) from config.json`);
        return config;
    } catch (error) {
        console.log(`[-] Error loading config.json: ${error.message}`);
        process.exit(1);
    }
}

let bots = [];
let readyToConnect = false;
let config = null;

console.log('[/] Starting Minecraft Bot Manager...');
config = loadConfig();

function doMicrosoftAuth() {
    console.log(`[+] Starting Microsoft authentication for ${config.emails.length} account(s)...`);
    console.log('[!] A browser window will open for each account to complete Microsoft login');
    console.log('[!] This only happens once per account');
    
    let authenticatedCount = 0;
    let authCompleted = false;

    config.emails.forEach((email, index) => {
        console.log(`[/] Authenticating ${email}... (${index + 1}/${config.emails.length})`);
        
        const authBot = mineflayer.createBot({
            host: 'localhost',
            port: 12345,
            username: email,
            auth: 'microsoft',
            version: SERVER.version,
            hideErrors: true,
            logErrors: false
        });

        authBot.on('login', () => {
            if (!authCompleted) {
                authenticatedCount++;
                console.log(`[+] ${email} authentication successful! (${authenticatedCount}/${config.emails.length})`);
                authBot.end();
                
                if (authenticatedCount === config.emails.length) {
                    completeAuthentication();
                }
            }
        });

        authBot.on('error', (err) => {
            if (!authCompleted) {
                if (err.code === 'ECONNREFUSED' || err.message.includes('connect')) {
                    authenticatedCount++;
                    console.log(`[+] ${email} authentication process completed! (${authenticatedCount}/${config.emails.length})`);
                    
                    if (authenticatedCount === config.emails.length) {
                        completeAuthentication();
                    }
                    return;
                }
                
                console.log(`[-] Authentication error for ${email}: ${err.message}`);
                authenticatedCount++;
                
                if (authenticatedCount === config.emails.length) {
                    completeAuthentication();
                }
            }
        });
    });

    function completeAuthentication() {
        console.log('[+] All accounts authenticated successfully!');
        console.log('[+] Type "start <number>" to connect bots to server');
        console.log('[+] Example: "start 5" - connects 5 bots');
        console.log('[+] Available bots:', config.emails.length);
        readyToConnect = true;
        authCompleted = true;
    }
}

function connectBotsToServer(count) {
    if (!readyToConnect) {
        console.log('[/] Please wait for Microsoft authentication to complete first');
        return;
    }

    const maxBots = config.emails.length;
    
    if (count > maxBots) {
        console.log(`[-] Only ${maxBots} bots available, but ${count} requested`);
        console.log(`[/] Connecting ${maxBots} bots instead`);
        count = maxBots;
    }

    console.log(`[/] Connecting ${count} bots to server...`);
    
    bots = []; // Clear previous bots
    
    for (let i = 0; i < count; i++) {
        const email = config.emails[i];
        setTimeout(() => {
            createBot(email, i);
        }, i * 2000); // Stagger connections by 2 seconds to avoid rate limits
    }
}

const SERVER = {
    host: config.server, 
    version: '1.8.9'
};

function createBot(email, index) {
    console.log(`[/] Connecting bot ${index + 1}: ${email}`);
    
    const bot = mineflayer.createBot({
        host: SERVER.host,
        username: email,
        auth: 'microsoft',
        version: SERVER.version,
        checkTimeoutInterval: 60 * 1000
    });

    bot.email = email;
    bot.index = index;

    bot.on('login', () => {
        console.log(`[+] Bot ${index + 1} (${email}) connected to server`);
    });

    bot.on('spawn', () => {
        console.log(`[+] Bot ${index + 1} (${email}) spawned in world`);
    });

    bot.on('error', (err) => {
        console.log(`[-] Bot ${index + 1} (${email}) error: ${err.message}`);
    });

    bot.on('end', (reason) => {
        console.log(`[-] Bot ${index + 1} (${email}) disconnected: ${reason}`);
        // Remove from bots array
        const botIndex = bots.findIndex(b => b === bot);
        if (botIndex !== -1) {
            bots.splice(botIndex, 1);
        }
    });

    bot.on('kicked', (reason) => {
        console.log(`[-] Bot ${index + 1} (${email}) kicked: ${reason}`);
    });

    bot.on('message', (message) => {
        const text = message.toString();
        if (!text.includes('§') && text.length > 1) { // Filter out system messages
            console.log(`[Bot ${index + 1}] 💬 ${text}`);
        }
    });

    bots.push(bot);
}

// Handle user commands
rl.on('line', (input) => {
    const command = input.toLowerCase().trim();
    
    if (command.startsWith('start')) {
        const parts = command.split(' ');
        let count = 1;
        
        if (parts.length > 1) {
            count = parseInt(parts[1]);
            if (isNaN(count) || count < 1) {
                console.log('[-] Invalid number. Usage: start <number>');
                return;
            }
        }
        
        connectBotsToServer(count);
        
    } else if (command === 'quit' || command === 'exit') {
        console.log('[/] Disconnecting all bots and shutting down...');
        bots.forEach(bot => bot.end());
        rl.close();
        process.exit();
        
    } else if (command.startsWith('chat ')) {
        if (bots.length === 0) {
            console.log('[-] No bots connected. Use "start" first.');
            return;
        }
        
        const message = command.substring(5);
        bots.forEach((bot, index) => {
            setTimeout(() => {
                bot.chat(message);
                console.log(`[Bot ${index + 1}] 📤 Sent: ${message}`);
            }, index * 1000); // Stagger messages by 1 second
        });
        
    } else if (command === 'stop') {
        console.log('[/] Disconnecting all bots...');
        bots.forEach(bot => bot.end());
        bots = [];
        
    } else if (command === 'status') {
        console.log(`[/] Connected bots: ${bots.length}/${config.emails.length}`);
        bots.forEach((bot, index) => {
            console.log(`   Bot ${index + 1}: ${bot.email} (${bot.username})`);
        });
        
    } else if (command === 'list') {
        console.log(`[/] Available accounts: ${config.emails.length}`);
        config.emails.forEach((email, index) => {
            const isConnected = bots.some(bot => bot.email === email);
            console.log(`   ${index + 1}. ${email} ${isConnected ? '[CONNECTED]' : ''}`);
        });
        
    } else if (command === 'reconnect') {
        console.log('[/] Reconnecting all bots...');
        const connectedCount = bots.length;
        bots.forEach(bot => bot.end());
        bots = [];
        setTimeout(() => {
            connectBotsToServer(connectedCount);
        }, 3000);
        
    } else {
        console.log('[/] Available commands:');
        console.log('   - start <number>: Connect specified number of bots');
        console.log('   - stop: Disconnect all bots');
        console.log('   - chat <message>: Send message from all bots');
        console.log('   - status: Show connected bots');
        console.log('   - list: Show available accounts');
        console.log('   - reconnect: Reconnect all bots');
        console.log('   - quit/exit: Exit program');
    }
});

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n[/] Shutting down...');
    bots.forEach(bot => bot.end());
    rl.close();
    process.exit();
});

// Start authentication
doMicrosoftAuth();