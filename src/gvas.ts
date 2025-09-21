import * as fs from 'fs';
import * as path from 'path';

interface GVASError {
  code: number;
  message: string;
}

class GVAS {
  private banListFile: string;
  private bannedPlayers: string[] = [];

  // Tracking file contents
  private startIdx: number = -1;
  private endIdx: number = -1;

  // Hexadecimal patterns to denote the start and end of the banned players array
  private readonly startPattern: Buffer = Buffer.from([0x00, 0x00, 0x00, 0x12, 0x00, 0x00, 0x00]);
  private readonly endPattern: Buffer = Buffer.from([0x00, 0x05, 0x00, 0x00, 0x00]);
  
  // Alternative patterns for different file versions
  private readonly altStartPatterns: Buffer[] = [
    Buffer.from([0x12, 0x00, 0x00, 0x00]),
    Buffer.from([0x00, 0x12, 0x00, 0x00, 0x00]),
    Buffer.from([0x00, 0x00, 0x12, 0x00, 0x00, 0x00])
  ];

  // Delimiter buffer between each player entry in the array
  private readonly delimiter: Buffer = Buffer.from([0x00, 0x12, 0x00, 0x00, 0x00]);

  static readonly Error = {
    FileNotFound: 0,
    FileNotAccessible: 1,
    InvalidFileFormat: 2,
  } as const;

  constructor(filePath: string, options?: { createBackup?: boolean }) {
    // Check first to see if the file exists
    const fileExists = fs.existsSync(filePath);

    if (!fileExists) {
      throw new Error(`File doesn't exist: ${filePath}`);
    }

    try {
      // Check to see that the file can be opened as r/w
      // const fd = fs.openSync(filePath, 'r+');
      // fs.closeSync(fd);
    } catch {
      throw new Error(`File cannot be read/written: ${filePath}`);
    }

    // Create a backup of the current ban list (optional)
    if (options?.createBackup !== false) {
      try {
        fs.copyFileSync(
          filePath,
          path.join(
            path.dirname(filePath),
            `${path.basename(filePath, '.sav')}-${new Date().toISOString().replace(/[-:T]/g, '').split('.')[0]}.sav.backup`
          )
        );
      } catch {
        // ignore backup failures
      }
    }

    this.banListFile = filePath;

    this.getBanList();
  }

  getBanList(): string[] {
    const buffer = fs.readFileSync(this.banListFile);

    this.startIdx = this.findPattern(buffer, this.startPattern);
    if (this.startIdx !== -1) {
      const forwardFrom = this.startIdx + this.startPattern.length;
      this.endIdx = buffer.indexOf(this.endPattern, forwardFrom);
    } else {
      this.endIdx = -1;
    }

    if (this.startIdx === -1 || this.endIdx === -1 || this.endIdx < this.startIdx) {
      this.endIdx = this.findPattern(buffer, this.endPattern);
      if (this.endIdx !== -1) {
        this.startIdx = this.findPattern(buffer, this.startPattern, this.endIdx - 1);
        
        if (this.startIdx === -1) {
          for (const altPattern of this.altStartPatterns) {
            this.startIdx = this.findPattern(buffer, altPattern, this.endIdx - 1);
            if (this.startIdx !== -1) break;
          }
        }
      }
    }

    let extracted: Buffer;
    if (this.startIdx !== -1 && this.endIdx !== -1 && this.endIdx >= this.startIdx) {
      extracted = buffer.slice(this.startIdx + this.startPattern.length, this.endIdx);
    } else {
      if (buffer.length === 0) {
        return [];
      }
      
      if (this.endIdx !== -1) {
        const searchStart = Math.max(0, this.endIdx - 500);
        const searchEnd = this.endIdx;
        let foundIds: string[] = [];
        
        for (let pos = searchStart; pos < searchEnd - 17; pos++) {
          const slice = buffer.slice(pos, pos + 17);
          const str = slice.toString('utf8');
          if (/^7656\d{13}$/.test(str)) {
            foundIds.push(str);
            pos += 16;
          }
        }
        
        if (foundIds.length > 0) {
          this.bannedPlayers = foundIds;
          return foundIds;
        }
      }
      
      const altStartPattern = Buffer.from('BannedPlayerArray');
      const altStartIdx = buffer.indexOf(altStartPattern);
      if (altStartIdx !== -1) {
        const searchFrom = altStartIdx + altStartPattern.length;
        let foundIds: string[] = [];
        let pos = searchFrom;
        
        while (pos < buffer.length - 17) {
          const slice = buffer.slice(pos, pos + 17);
          const str = slice.toString('utf8');
          if (/^7656\d{13}$/.test(str)) {
            foundIds.push(str);
            pos += 17;
          } else {
            pos++;
          }
        }
        
        this.bannedPlayers = foundIds;
        return foundIds;
      }
      
      throw new Error(
        `GVAS parsing failed. File size: ${buffer.length} bytes. Start pattern found at: ${this.startIdx}, End pattern found at: ${this.endIdx}`
      );
    }

    const segments = this.splitBufferOnDelimiter(extracted, this.delimiter);
    const ids = this.extractFirst64BitsAsString(segments);

    this.bannedPlayers = ids;

    return this.bannedPlayers;
  }

  addPlayersToBanList(players: string[]): number {
    const bannedPlayers = this.getBanList();

    const updatedBanList = Array.from(new Set([...bannedPlayers, ...players]));

    const bufferMap = updatedBanList.map((id) => Buffer.from(id, 'utf8'));

    this.updateBanList(bufferMap);

    return updatedBanList.length - bannedPlayers.length;
  }

  removePlayerFromBanList(playerToRemove: string): number {
    const bannedPlayers = this.getBanList();

    const updatedBanList = bannedPlayers.filter((steamID) => steamID !== playerToRemove);

    const bufferMap = updatedBanList.map((id) => Buffer.from(id, 'utf8'));

    this.updateBanList(bufferMap);

    return bannedPlayers.length - updatedBanList.length;
  }

  private updateBanList(updatedList: Buffer[]): void {
    const buffer = fs.readFileSync(this.banListFile);

    const mergedData = Buffer.concat(
      updatedList.flatMap((buf, i, arr) => (i < arr.length - 1 ? [buf, this.delimiter] : [buf]))
    );

    const before = buffer.slice(0, this.startIdx + this.startPattern.length);
    const after = buffer.slice(this.endIdx);

    const updated = Buffer.concat([before, mergedData, after]);

    // Update array length in the buffer - always incremented by 1 past the number of players
    updated[this.startIdx - 1] = parseInt(updatedList.length.toString(16), 16);

    // Update array allocation length
    updated.writeInt32LE(22 * updatedList.length + 4, this.startIdx - 6);

    fs.writeFileSync(this.banListFile, updated);
  }

  private findPattern(
    buffer: Buffer,
    pattern: Buffer,
    startIndex: number = buffer.length - pattern.length
  ): number {
    for (let i = startIndex; i >= 0; i--) {
      if (buffer.slice(i, i + pattern.length).equals(pattern)) {
        return i;
      }
    }
    return -1;
  }

  private splitBufferOnDelimiter(buffer: Buffer, delimiter: Buffer): Buffer[] {
    let parts: Buffer[] = [];
    let start = 0;
    let index: number;

    while ((index = buffer.indexOf(delimiter, start)) !== -1) {
      parts.push(buffer.slice(start, index));
      start = index + delimiter.length;
    }
    parts.push(buffer.slice(start)); // Include the final chunk
    return parts;
  }

  private extractFirst64BitsAsString(parts: Buffer[]): string[] {
    return parts
      .map((part) => {
        if (part.length >= 17) {
          return part.slice(0, 17).toString('utf8');
        }
        return null;
      })
      .filter((id): id is string => id !== null);
  }
}

export default GVAS;
