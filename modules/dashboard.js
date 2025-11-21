const readline = require('readline');

let bots = [];
let config = null;
let lastBotStates = [];
let rl = null;

function startDashboard(botList, configObj) {
    bots = botList;
    config = configObj;
    lastBotStates = bots.map(bot => JSON.stringify(getBotState(bot)));
    
    // Clear console initially
    console.clear();
    renderDashboard();
    
    // Set up command interface
    setupCommandInterface();
}

function setupCommandInterface() {
    rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    showPrompt();
    
    rl.on('line', (input) => {
        processCommand(input.trim());
        showPrompt();
    });
}

function showPrompt() {
    process.stdout.write('> ');
}

function processCommand(command) {
    // Handle commands here - you can emit events or call functions
    console.log(`Executing: ${command}`);
    // Add your command logic here
}

function updateBotList(botList) {
    bots = botList;
    checkAndRender();
}

function updateBotStatus(bot, statusType, data = null) {
    switch (statusType) {
        case 'targetFound':
            bot.targetFound = true;
            bot.isFinding = false;
            break;
        case 'connectionError':
            bot.connectionError = true;
            break;
        case 'lobbyChange':
            bot.currentLobby = data;
            break;
        case 'findingStarted':
            bot.isFinding = true;
            bot.targetFound = false;
            bot.connectionError = false;
            break;
        case 'findingStopped':
            bot.isFinding = false;
            break;
        case 'connected':
            bot.connectionError = false;
            break;
        case 'swapFailed':
            bot.swapFailed = true;
            bot.retryTime = data; // retry time in seconds
            break;
        case 'swapRetrying':
            bot.swapFailed = false;
            break;
    }
    
    checkAndRender();
}

function getBotState(bot) {
    return {
        targetFound: bot.targetFound,
        isFinding: bot.isFinding,
        connectionError: bot.connectionError,
        currentLobby: bot.currentLobby,
        swapFailed: bot.swapFailed,
        retryTime: bot.retryTime,
        connected: bot._client?.connected
    };
}

function checkAndRender() {
    const currentStates = bots.map(bot => JSON.stringify(getBotState(bot)));
    
    // Only render if something changed
    if (JSON.stringify(currentStates) !== JSON.stringify(lastBotStates)) {
        lastBotStates = currentStates;
        renderDashboard();
    }
}

function renderDashboard() {
    // Clear console and move cursor to top
    process.stdout.write('\x1B[2J\x1B[0f');
    
    console.log('Dashboard');
    console.log('______________________________________');
    
    if (bots.length === 0) {
        console.log('No bots connected');
    } else {
        bots.forEach((bot, index) => {
            const status = getBotStatus(bot);
            console.log(status);
        });
    }
    
    console.log('______________________________________');
}

function getBotStatus(bot) {
    const colors = {
        green: '\x1b[32m',
        yellow: '\x1b[33m',
        red: '\x1b[31m',
        reset: '\x1b[0m'
    };
    
    const botName = `Bot${bot.id || bots.indexOf(bot) + 1}`;
    let status = '';
    let color = colors.reset;
    
    if (!bot._client || !bot._client.connected) {
        color = colors.red;
        status = 'DISCONNECTED';
    } else if (bot.targetFound) {
        color = colors.green;
        status = `found target (${config.target})!`;
    } else if (bot.swapFailed) {
        color = colors.red;
        status = `failed to swap lobbies... retrying in ${bot.retryTime} seconds`;
    } else if (bot.isFinding) {
        if (bot.currentLobby === 'Pit') {
            color = colors.yellow;
            status = 'finding target...';
        } else {
            color = colors.yellow;
            status = 'swapping lobbies...';
        }
    } else if (bot.connectionError) {
        color = colors.red;
        status = 'connection error...';
    } else if (bot._client.connected) {
        color = colors.green;
        status = 'READY';
    } else {
        color = colors.yellow;
        status = 'connecting...';
    }
    
    return `${botName} - ${color}${status}${colors.reset}`;
}

function stopDashboard() {
    if (rl) {
        rl.close();
    }
}

module.exports = {
    startDashboard,
    stopDashboard,
    updateBotStatus,
    updateBotList
};