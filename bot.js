const readline = require('readline');
const auth = require('./modules/auth');
const botManager = require('./modules/botManager');
const findSystem = require('./modules/findSystem');
const dashboard = require('./modules/dashboard');
require('./modules/warningSuppression');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// Load config from main directory
const config = botManager.loadConfig(__dirname);

console.log(`[+] Loaded ${config.emails.length} email account(s) from config.json`);
console.log(`[+] Target: ${config.target}`);

// Start dashboard with empty bot list
dashboard.startDashboard([], config);

// Handle user commands
rl.on('line', (input) => {
    const command = input.toLowerCase().trim();
    
    if (command.startsWith('start')) {
        botManager.connectBotsToServer();
        // Update dashboard with current bots
        dashboard.updateBotList(botManager.getBots());

    } else if (command === 'quit' || command === 'exit') {
        console.log('[/] Disconnecting all bots and shutting down...');
        findSystem.stopFinding();
        botManager.disconnectAllBots();
        dashboard.stopDashboard();
        rl.close();
        process.exit();
        
    } else if (command.startsWith('chat ')) {
        const bots = botManager.getBots();
        if (bots.length === 0) {
            console.log('[-] No bots connected. Use "start" first.');
            return;
        }
        
        const message = command.substring(5);
        botManager.sendChatMessage(message);
        
    } else if (command === 'stop') {
        console.log('[/] Disconnecting all bots...');
        findSystem.stopFinding();
        botManager.disconnectAllBots();
        dashboard.updateBotList([]);

    } else if (command === 'find') {
        findSystem.startFinding();
        
    } else {
        console.log('[/] Available commands:');
        console.log('   - start: Connect bot(s) to server');
        console.log('   - stop: Disconnect all bots');
        console.log('   - chat <message>: Send message from all bots');
        console.log('   - find: Start searching for target player');
        console.log('   - quit/exit: Exit program');
    }
});

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n[/] Shutting down...');
    findSystem.stopFinding();
    botManager.disconnectAllBots();
    dashboard.stopDashboard();
    rl.close();
    process.exit();
});

// Start authentication
auth.doMicrosoftAuth(config);