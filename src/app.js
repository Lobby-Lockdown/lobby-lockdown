const GVAS = require('./gvas.js');
const prompt = require('prompt-sync')();
const axios = require('axios');
const path = require('path');

const discord = `https://discord.gg/Kc9KRBJPMA`;
const github = `https://github.com/Lobby-Lockdown`;

var banList = undefined;
var banListFilePath = path.join(process.env.LOCALAPPDATA, 'LockdownProtocol/Saved/SaveGames/Save_BanList.sav');
var retries = 3;

console.log( 
`
.____         ___.  ___.           .____                  __       .___                   
|    |    ____\\_ |__\\_ |__ ___.__. |    |    ____   ____ |  | __ __| _/______  _  ______  
|    |   /  _ \\| __ \\| __ <   |  | |    |   /  _ \\_/ ___\\|  |/ // __ |/  _ \\ \\/ \\/ /    \\ 
|    |__(  <_> ) \\_\\ \\ \\_\\ \\___  | |    |__(  <_> )  \\___|    </ /_/ (  <_> )     /   |  \\
|_______ \\____/|___  /___  / ____| |_______ \\____/ \\___  >__|_ \\____ |\\____/ \\/\\_/|___|  /
        \\/         \\/    \\/\\/              \\/          \\/     \\/    \\/                 \\/ 
                                                                             
Thanks for using Lobby Lockdown! This is a tool designed to modify your local ban list
on Lockdown Protocol. Please note that users that are on your list will only be banned 
if you are the host of the game. This tool will not override your current ban list, but
will add/remove to it. We are not affiliated in any way with Lockdown Protocol,
Mirage Creative Lab, and/or any subsidiaries related to the aforementioned entities.

GitHub:     ${github}
Discord:    ${discord}


By continuing, you confirm that you have read and agree to our disclaimer:
https://raw.githubusercontent.com/Lobby-Lockdown/lobby-lockdown/refs/heads/main/DISCLAIMER

Please press ENTER to continue.`);
prompt(``);

var fatalError = false;

while(!banList && retries-- > 0 && !fatalError) {
    try {
        banList = new GVAS(banListFilePath);
    } catch(error) {
        switch(error.code) {
            case GVAS.Error.FileNotFound:
                console.log(`\nThe Lockdown Protocol ban list was not found. Please specify the full path to your Save_BanList.sav file.`);
                banListFilePath = prompt(`Enter file path: `);
                break;

            case GVAS.Error.FileNotAccessible:
                console.log(`\nYour Lockdown Protocol ban list was found, but can't be opened for reading/writing. Please close your game if running and try again.`);
                console.log(`If you keep encountering this error, please reach out for support on the Discord: ${discord}`);
                fatalError = true;
                break;

            case GVAS.Error.InvalidFileFormat:
                console.log(`Could not successfully parse your ban list file. Please reach out for support on the Discord: ${discord}`);
                fatalError = true;
                break;

            default:
                console.log(`\nAn unknown error has occurred. Please reach out for support on the Discord: ${discord}`);
        }
    }
}

if(retries <= 0) {
    console.log(`\n\nMax amount of retries exceeded. Please join our Discord for support: ${discord}`);
    process.exit(1);
}

(async () => {
    var choice = "0";
    while (!fatalError) {
        console.log(`\n\n--------------------------[ Main Menu ]--------------------------
            1) View current list of Steam64 IDs on your ban list
            2) Add a user to your ban list by Steam64 ID
            3) Remove a user from your ban list by Steam64 ID
            4) Add all Steam64 IDs from the community-driven ban list to yours
            5) Exit
        `.replace(/^[ \t]+/gm, ''));
        choice = prompt(`Enter a number: `);

        switch(choice) {
            case "1":
                viewBanList();
                break;
            
            case "2":
                addPlayerToBanList();
                break;

            case "3":
                removePlayerFromBanList();
                break;
            
            case "4":
                await applyGlobalBanList();
                break;

            case "5":
                process.exit(0);

            default:
                break;
        }
    }

    prompt(`\nPress ENTER to quit.`);
})();

function viewBanList() {
    console.log('\n\nBanned players:')
    const bannedPlayers = banList.getBanList();
    for(var i = 0; i < bannedPlayers.length; ++i) {
        console.log(`${ i + 1 }) ${bannedPlayers[i]}`);
    }
}

function addPlayerToBanList() {
    const player = prompt(`\n\nEnter Steam64 ID: `);
    if(/^7656\d{13}$/.test(player)) {
        const numAdded = banList.addPlayersToBanList([ player ]);
        console.log(`Successfully added ${numAdded} players to your ban list!`);
    } else {
        console.log(`Steam ID was valid. Try again.`);
    }
}

function removePlayerFromBanList() {
    const player = prompt(`\n\nEnter Steam64 ID: `);
    if(/^7656\d{13}$/.test(player)) {
        const numRemoved = banList.removePlayerFromBanList(player);
        console.log(`Successfully removed ${numRemoved} players from your ban list!`);
    } else {
        console.log(`Steam ID was valid. Try again.`);
    }
}

async function applyGlobalBanList() {
    // Get latest version of bans from main branch
    const res = await axios.get('https://raw.githubusercontent.com/Lobby-Lockdown/lobby-lockdown/refs/heads/main/bans.txt');
    const steamIds = res.data.split('\n').filter(line => line.trim() !== '').map(line => Buffer.from(line.trim(), 'base64').toString('utf8'));

    var numAdded = 0;
    try {
        numAdded = banList.addPlayersToBanList(steamIds);
    } catch(error) {
        switch(error.code) {
            case GVAS.Error.InvalidFileFormat:
                console.log(`The specified ban list is in an invalid format. Please reach out for support on the Discord: ${discord}`)
                fatalError = true;

            default:
                console.log(`\nAn unknown error has occurred. Please reach out for support on the Discord: ${discord}`);
        }
    }

    console.log(`\n\nSuccessfully added ${numAdded} players from the community ban list to your ban list!`);
}
