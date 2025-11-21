const mineflayer = require('mineflayer');

let readyToConnect = false;
let authCompleted = false;

function doMicrosoftAuth(config) {
    let authenticatedCount = 0;

    config.emails.forEach((email, index) => {
        console.log(`[/] Authenticating ${email}... (${index + 1}/${config.emails.length})`);
        
        const authBot = mineflayer.createBot({
            host: 'localhost',
            port: 12345,
            username: email,
            auth: 'microsoft',
            version: '1.8.9',
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
        console.log();
        console.log('[+] Type "start" to connect bots to server');
        console.log('[+] Available bots:', config.emails.length);
        readyToConnect = true;
        authCompleted = true;
    }
}

function isReadyToConnect() {
    return readyToConnect;
}

module.exports = {
    doMicrosoftAuth,
    isReadyToConnect
};