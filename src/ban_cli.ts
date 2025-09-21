import GVAS from './gvas.js';
import * as path from 'path';
import * as fs from 'fs';
import axios from 'axios';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Path to the ban list file (same as in main process logic)
const banListFilePath: string = path.join(
  process.env.LOCALAPPDATA || '',
  'LockdownProtocol/Saved/SaveGames/Save_BanList.sav'
);
const bakFilePath: string = banListFilePath.replace('.sav', '.bak');

// Get command line arguments
const args: string[] = process.argv.slice(2);

// Validate arguments
if (args.length < 1) {
  printUsage();
  process.exit(1);
}

const action: string = args[0].toLowerCase();
// Flags (optional)
const listFlags = new Set<string>(args.slice(1));

// Check argument count based on action
if ((action === 'list' || action === 'revert' || action === 'update') && args.length !== 1) {
  console.log(`Action "${action}" does not require additional arguments.`);
  printUsage();
  process.exit(1);
} else if ((action === 'add' || action === 'remove') && args.length !== 2) {
  console.log(`Action "${action}" requires a Steam64 ID.`);
  printUsage();
  process.exit(1);
} else if (!['add', 'remove', 'list', 'revert', 'update'].includes(action)) {
  console.log(`Invalid action: ${action}`);
  printUsage();
  process.exit(1);
}

/**
 * Prints usage information
 */
function printUsage(): void {
  console.log('Usage:');
  console.log('  ts-node src/ban_cli.ts <add|remove> <STEAM64_ID>');
  console.log('  ts-node src/ban_cli.ts list [--plain] [--fast]');
  console.log('  ts-node src/ban_cli.ts update');
  console.log('  ts-node src/ban_cli.ts revert');
  console.log('Examples:');
  console.log('  ts-node src/ban_cli.ts add 76561198000000000');
  console.log('  ts-node src/ban_cli.ts remove 76561198000000000');
  console.log('  ts-node src/ban_cli.ts list');
  console.log('  ts-node src/ban_cli.ts update');
  console.log('  ts-node src/ban_cli.ts revert');
}

/**
 * Handles GVAS-specific errors
 * @param error - The error object
 */
function handleGVASError(error: unknown): void {
  const err = error as { code?: number; message?: string };
  switch (err.code) {
    case GVAS.Error.FileNotFound:
      console.log('The Lockdown Protocol ban list was not found. Please check the file path.');
      break;
    case GVAS.Error.FileNotAccessible:
      console.log(
        "Your Lockdown Protocol ban list was found, but can't be opened for reading/writing. Please close the game if running."
      );
      break;
    case GVAS.Error.InvalidFileFormat:
      console.log('Could not successfully parse your ban list file.');
      break;
    default:
      console.log('An unknown error occurred:', err.message);
  }
}

if (action === 'revert') {
  // Revert from backup
  if (!fs.existsSync(bakFilePath)) {
    console.log('No backup file (.bak) found to revert from.');
    process.exit(1);
  }
  try {
    fs.copyFileSync(bakFilePath, banListFilePath);
    console.log('Successfully reverted ban list from backup.');
  } catch (error: unknown) {
    const err = error as { message?: string };
    console.log('Error reverting from backup:', err.message || error);
    process.exit(1);
  }
  process.exit(0);
}

if (action === 'list') {
  // List current banned players
  (async () => {
    try {
      const banList = new GVAS(banListFilePath);
      const bannedPlayers = banList.getBanList();
      if (bannedPlayers.length === 0) {
        console.log('No players are currently banned.');
      } else {
        const plain = listFlags.has('--plain');
        const fast = listFlags.has('--fast') || /^true$/i.test(String(process.env.FAST_LIST || ''));

        if (plain) {
          // Minimal output for machine parsing
          bannedPlayers.forEach((id: string) => console.log(id));
          process.exit(0);
        }

        console.log('Current banned Steam64 IDs:');
        bannedPlayers.forEach((id: string, index: number) => {
          console.log(`${index + 1}) ${id}`);
        });

        if (!fast) {
          // Lookup player names if API key is set
          const apiKey = process.env.STEAM_API_KEY;
          if (apiKey) {
            console.log('\nLooking up player names...');
            for (const steamId of bannedPlayers) {
              try {
                const response = await axios.get<{
                  response: { players: { personaname: string }[] };
                }>(
                  `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?key=${apiKey}&steamids=${steamId}`
                );
                const player = response.data.response.players[0];
                if (player) {
                  console.log(`${steamId}: ${player.personaname}`);
                } else {
                  console.log(`${steamId}: No data found`);
                }
              } catch (error: unknown) {
                const err = error as { message?: string };
                console.log(
                  `${steamId}: Error looking up name - ${err.message || 'Unknown error'}`
                );
              }
            }
          } else {
            console.log('\nTo look up player names, set STEAM_API_KEY in .env file.');
          }
        }
      }
    } catch (error: unknown) {
      handleGVASError(error);
      process.exit(1);
    }
    process.exit(0);
  })();
}

if (action === 'update') {
  // Update ban list with latest from GitHub
  (async () => {
    try {
      console.log('Fetching latest community ban list...');
      const response = await axios.get<string>(
        'https://raw.githubusercontent.com/Lobby-Lockdown/lobby-lockdown/refs/heads/main/bans.txt'
      );
      const steamIds = response.data
        .split('\n')
        .filter((line: string) => line.trim() !== '')
        .map((line: string) => Buffer.from(line.trim(), 'base64').toString('utf8'));

      console.log(`Found ${steamIds.length} Steam IDs in the community list.`);

      // Create backup before modifications
      if (fs.existsSync(banListFilePath)) {
        fs.copyFileSync(banListFilePath, bakFilePath);
        console.log('Backup created: Save_BanList.bak');
      } else {
        console.log('Warning: Original file not found, no backup created.');
      }

      const banList = new GVAS(banListFilePath);
      const numAdded = banList.addPlayersToBanList(steamIds);
      console.log(`Successfully added ${numAdded} new players from the community ban list!`);
    } catch (error: unknown) {
      const err = error as {
        response?: { status?: number; statusText?: string };
        message?: string;
      };
      if (err.response) {
        console.log(
          'Error fetching community ban list:',
          err.response.status,
          err.response.statusText
        );
      } else {
        handleGVASError(error);
      }
      process.exit(1);
    }
    process.exit(0);
  })();
} else if (action === 'add' || action === 'remove') {
  // For add/remove, validate Steam ID
  const steamId: string = args[1];
  if (!/^7656\d{13}$/.test(steamId)) {
    console.log('Invalid Steam64 ID format. It should be 17 digits starting with 7656.');
    process.exit(1);
  }

  // Create backup before modifications
  try {
    if (fs.existsSync(banListFilePath)) {
      fs.copyFileSync(banListFilePath, bakFilePath);
      console.log('Backup created: Save_BanList.bak');
    } else {
      console.log('Warning: Original file not found, no backup created.');
    }
  } catch (error: unknown) {
    const err = error as { message?: string };
    console.log('Error creating backup:', err.message || error);
    process.exit(1);
  }

  try {
    const banList = new GVAS(banListFilePath);

    if (action === 'add') {
      const numAdded = banList.addPlayersToBanList([steamId]);
      console.log(`Successfully added ${numAdded} player(s) to your ban list!`);
    } else if (action === 'remove') {
      const numRemoved = banList.removePlayerFromBanList(steamId);
      console.log(`Successfully removed ${numRemoved} player(s) from your ban list!`);
    }
  } catch (error: unknown) {
    handleGVASError(error);
    process.exit(1);
  }
}
