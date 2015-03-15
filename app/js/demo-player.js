/**
 * A lightweight parser that only extracts data of particular interest to an
 * average player.
 */
const { Buffer } = require( 'buffer' );

import BN from 'bn.js';
import BufferReader from './buffer-reader';
import BitBufferReader from './bit-buffer-reader';

import {
  MAX_OSPATH,
  MAX_USERDATA_BITS,
  SUBSTRING_BITS,
  MAX_PLAYER_NAME_LENGTH,
  MAX_CUSTOM_FILES,
  SIGNED_GUID_LEN,
  UpdateType,
  HeaderFlags
} from './constants';

import {
  DemoCommandInfo,
  EntityEntry
} from './classes';

import {
  SendPropType,
  SPROP,
  decodeProp
} from './prop';

import {
  messages,
  UserMessageTypes,
  NETMessageTypes,
  SVCMessageTypes,
  DemoMessage
} from './messages';

export function parse( file ) {
  console.time( 'parsing' );

  const buffer = new Buffer( new Uint8Array( file ) );
  const reader = new BufferReader( buffer );
  const { length } = buffer;

  const demoHeader = {
    demoFileStamp:   reader.readString( 8 ),
    demoProtocol:    reader.readInt32(),
    networkProtocol: reader.readInt32(),
    serverName:      reader.readString( MAX_OSPATH ),
    clientName:      reader.readString( MAX_OSPATH ),
    mapName:         reader.readString( MAX_OSPATH ),
    gameDirectory:   reader.readString( MAX_OSPATH ),
    playbackTime:    reader.readFloat(),
    playbackTicks:   reader.readInt32(),
    playbackFrames:  reader.readInt32(),
    signonLength:    reader.readInt32()
  };

  console.log( demoHeader );

  let gameEventList;

  const stringTables = [];
  const playerInfos  = [];
  const entities     = [];

  // Advance by read size.
  function readRawData() {
    const size = reader.readInt32();
    reader.offset += size;
  }

  function findPlayerInfo( userID ) {
    for ( let i = 0, il = playerInfos.length; i < il; i++ ) {
      const playerInfo = playerInfos[i];
      if ( playerInfo.userID === userID ) {
        return playerInfo;
      }
    }
  }

  function findPlayerEntityIndex( userID ) {
    for ( let i = 0, il = playerInfos.length; i < il; i++ ) {
      if ( playerInfos[i].userID === userID ) {
        return i;
      }
    }

    return -1;
  }

  function getGameEventDescriptor( message ) {
    for ( let i = 0, il = gameEventList.descriptors.length; i < il; i++ ) {
      const descriptor = gameEventList.descriptors[i];
      if ( descriptor.eventid === message.eventid ) {
        return descriptor;
      }
    }
  }

  function parsePlayerInfo( field, index ) {
    const playerInfo = findPlayerInfo( index );
    if ( !playerInfo ) {
      return;
    }

    console.log( ` ${ field }: ${ playerInfo.name } (id: ${ index })` );

    const entityIndex = findPlayerEntityIndex( index ) + 1;
    const entity = findEntity( entityIndex );

    if ( !entity ) {
      return;
    }

    const xyProp = entity.findProp( 'm_vecOrigin' );
    const zProp  = entity.findProp( 'm_vecOrigin[2]' );

    if ( xyProp && zProp ) {
      const { x, y } = xyProp.propValue.value;
      const z = zProp.propValue.value;

      console.log( `  position: ${ x }, ${ y }, ${ z }` );
    }

    const angle0Prop = entity.findProp( 'm_angEyeAngles[0]' );
    const angle1Prop = entity.findProp( 'm_angEyeAngles[1]' );

    if ( angle0Prop && angle1Prop ) {
      const angle0 = angle0Prop.propValue.value;
      const angle1 = angle1Prop.propValue.value;

      console.log( `  facing: pitch:${ angle0 }, yaw:${ angle1 }` );
    }

    const teamProp = entity.findProp( 'm_iTeamNum' );
    if ( teamProp ) {
      const team = teamProp.propValue.value === 2 ? 'T' : 'CT';
      console.log( '  team: '  + team );
    }
  }

  function parseGameEvent( message, descriptor ) {
    if ( !descriptor ) {
      return;
    }

    for ( let i = 0, il = message.keys.length; i < il; i++ ) {
      const key = descriptor.keys[i];
      const value = message.keys[i];

      if ( key.name === 'userid'   ||
           key.name === 'attacker' ||
           key.name === 'assister' ) {
        parsePlayerInfo( key.name, value.val_short );
      }
    }
  }

  function handleGameEvent( message ) {
    const descriptor = getGameEventDescriptor( message );
    if ( descriptor ) {
      parseGameEvent( message, descriptor );
    }
  }

  function parseStringTableUpdate(
    buffer,
    entries,
    maxEntries,
    userDataSize,
    userDataSizeBits,
    userDataFixedSize,
    isUserInfo
  ) {
    let lastEntry = -1;

    let temp = maxEntries;
    let entryBits = 0;
    while ( temp >>= 1 ) { ++entryBits; }

    // Unable to decode if encoded using dictionaries.
    if ( buffer.readBit() ) {
      return;
    }

    const history = [];
    let currentEntry;
    for ( let i = 0; i < entries; i++ ) {
      let entryIndex = lastEntry + 1;
      if ( !buffer.readBit() ) {
        entryIndex = buffer.readUBits( entryBits );
      }

      lastEntry = entryIndex;

      let entry;
      if ( buffer.readBit() ) {
        const substringCheck = buffer.readBit();

        if ( substringCheck ) {
          const index = buffer.readUBits( 5 );
          const bytesToCopy = buffer.readUBits( SUBSTRING_BITS );
          entry = history[ index ].string.slice( 0, bytesToCopy + 1 ) +
            buffer.readCString( 1024 );
        } else {
          entry = buffer.readCString( 1024 );
        }

        currentEntry = entry;
      }

      let tempBuf = '';
      let userData;
      let bytes = 0;

      if ( buffer.readBit() ) {
        if ( userDataFixedSize ) {
          bytes = userDataSize;
          tempBuf = buffer.readCString( Math.floor( userDataSizeBits / 8 ) ) +
            String.fromCharCode( buffer.readBits( userDataSizeBits % 8 ) );
        } else {
          bytes = buffer.readUBits( MAX_USERDATA_BITS );
          tempBuf = buffer.read( bytes );
        }

        userData = tempBuf;
      }

      if ( !currentEntry ) {
        currentEntry = '';
      }

      if ( isUserInfo && userData ) {
        const playerInfo = readPlayerInfo( new BitBufferReader( userData ) );

        if ( entryIndex < playerInfos.length ) {
          playerInfos[ entryIndex ] = playerInfo;
        } else {
          playerInfos.push( playerInfo );
        }
      }
    }

    if ( history.length > 31 ) {
      history.shift();
    }

    history.push({
      string: currentEntry
    });
  }

  function findEntity( entity ) {
    return entities[ entity ];
  }

  function createStringTable( message ) {
    if ( message.name !== 'userinfo' ) {
      return;
    }

    const buffer = new BitBufferReader( message.string_data );
    parseStringTableUpdate(
      buffer,
      message.num_entries,
      message.max_entries,
      message.user_data_size,
      message.user_data_size_bits,
      message.user_data_fixed_size,
      true
    );

    stringTables.push({
      name: message.name,
      maxEntries: message.max_entries
    });
  }

  function readCRC32( buffer ) {
    const array = [];

    for ( let i = 0; i < MAX_CUSTOM_FILES; i++ ) {
      array.push( buffer.readUInt32() );
    }

    return array;
  }

  function readPlayerInfo( buffer ) {
    // Some fields are missing a byte-swap.
    return {
      version:         buffer.read( 8 ),
      xuid:            buffer.read( 8 ),
      name:            buffer.readString( MAX_PLAYER_NAME_LENGTH ),
      userID:          buffer.read( 4 ),
      guid:            buffer.readString( SIGNED_GUID_LEN ),
      friendsID:       buffer.read( 8 ),
      friendsName:     buffer.readString( MAX_PLAYER_NAME_LENGTH ),
      fakeplayer:      buffer.readBool(),
      ishltv:          buffer.readBool(),
      customFiles:     readCRC32( buffer ),
      filesDownloaded: buffer.readUInt8()
    };
  }

  function dumpDemoPacket( start, length ) {
    while ( reader.offset - start < length ) {
      const command = reader.readVarInt32();
      const size    = reader.readVarInt32();

      if ( !size || ( reader.offset - start + size > length ) ) {
        return;
      }

      let commandHandler;

      // NET_Messages.
      let commandType = NETMessageTypes[ command ];
      if ( commandType ) {
        commandHandler = messages[ 'CNETMsg_' + commandType ];
      }

      // SVC_Messages.
      commandType = commandType || SVCMessageTypes[ command ];
      if ( !commandType ) {
        return;
      }

      if ( !commandHandler ) {
        commandHandler = messages[ 'CSVCMsg_' + commandType ];
      }

      const message = commandHandler.decode( reader.read( size ) );

      if ( commandType === 'PacketEntities' ) {
        createStringTable( message );
      } else if ( commandType === 'GameEvent' ) {
        handleGameEvent( message );
      } else if ( commandType === 'GameEventList' ) {
        gameEventList = message;
      }
    }
  }

  function handleDemoPacket() {
    const democmdinfo = DemoCommandInfo.read( reader );

    const seqNrIn  = reader.readInt32();
    const seqNrOut = reader.readInt32();

    const length = reader.readInt32();
    dumpDemoPacket( reader.offset, length );
  }

  while ( reader.offset < length ) {
    const command    = reader.readUInt8();
    const timestamp  = reader.readInt32();
    const playerSlot = reader.readUInt8();

    switch ( command ) {
      case DemoMessage.DEM_SYNCTICK:
        break;

      case DemoMessage.DEM_STOP:
        console.timeEnd( 'parsing' );
        return;

      case DemoMessage.DEM_CONSOLECMD:
        readRawData();
        break;

      case DemoMessage.DEM_DATATABLES:
        readRawData();
        break;

      case DemoMessage.DEM_STRINGTABLES:
        readRawData();
        break;

      case DemoMessage.DEM_USERCMD:
        readRawData();
        break;

      case DemoMessage.DEM_SIGNON:
      case DemoMessage.DEM_PACKET:
        handleDemoPacket();
        break;
    }
  }
}
