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
  MAX_EDICTS,
  MAX_USERDATA_BITS,
  SUBSTRING_BITS,
  NUM_NETWORKED_EHANDLE_SERIAL_NUMBER_BITS,
  MAX_PLAYER_NAME_LENGTH,
  MAX_CUSTOM_FILES,
  SIGNED_GUID_LEN,
  ENTITY_SENTINEL,
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

  const stringTables  = [];
  let serverClassBits = 0;
  const serverClasses = [];
  const playerInfos   = [];
  const entities      = [];

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

      let userData;
      if ( buffer.readBit() ) {
        let bytes;
        let tempBuf;
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

  function getSendPropByIndex( classIndex, index ) {
    if ( index < serverClasses[ classIndex ].flattenedProps.length ) {
      return serverClasses[ classIndex ].flattenedProps[ index ];
    }
  }

  function readFieldIndex( entityBitBuffer, lastIndex, newWay ) {
    if ( newWay ) {
      if ( entityBitBuffer.readBit() ) {
        return lastIndex + 1;
      }
    }

    let ret = 0;
    if ( newWay && entityBitBuffer.readBit() ) {
      // Read 3 bits.
      ret = entityBitBuffer.readUBits( 3 );
    } else {
      // Read 7 bits.
      ret = entityBitBuffer.readUBits( 7 );
      switch ( ret & ( 32 | 64 ) ) {
        case 32:
          ret = ( ret & ~96 ) | ( entityBitBuffer.readUBits( 2 ) << 5 );
          break;

        case 64:
          ret = ( ret & ~96 ) | ( entityBitBuffer.readUBits( 4 ) << 5 );
          break;

        case 96:
          ret = ( ret & ~96 ) | ( entityBitBuffer.readUBits( 7 ) << 5 );
          break;
      }
    }

    // End marker is 4095 for CS:GO.
    if ( ret === 0xFFF ) {
      return -1;
    }

    return lastIndex + 1 + ret;
  }

  function readNewEntity( entityBitBuffer, entity ) {
    //  0 = old way, 1 = new way.
    const newWay = entityBitBuffer.readBit() === 1;

    const fieldIndices = [];
    let index = -1;
    do {
      index = readFieldIndex( entityBitBuffer, index, newWay );
      if ( index !== -1 ) {
        fieldIndices.push( index );
      }
    } while ( index !== -1 );

    for ( let i = 0, il = fieldIndices.length; i < il; i++ ) {
      let sendProp = getSendPropByIndex( entity.classIndex, fieldIndices[i] );
      if ( sendProp ) {
        let prop = decodeProp(
          entityBitBuffer,
          sendProp,
          entity.classIndex,
          fieldIndices[i],
          // Quiet.
          true
        );
        entity.addOrUpdateProp( sendProp, prop );
      } else {
        return false;
      }
    }

    return true;
  }

  function findEntity( entity ) {
    return entities[ entity ];
  }

  function addEntity( entity, classIndex, serialNum ) {
    // If entity already exists, then replace it, else add it.
    let entry = findEntity( entity );
    if ( entry ) {
      entry.classIndex = classIndex;
      entry.serialNum = serialNum;
    } else {
      entry = new EntityEntry( entity, classIndex, serialNum );
      entities[ entity ] = entry;
    }

    return entry;
  }

  function removeEntity( entity ) {
    entities[ entity ] = undefined;
  }

  function parsePacketEntities( message ) {
    const entityBitBuffer = new BitBufferReader( message.entity_data );

    const asDelta = message.is_delta;
    let headerCount = message.updated_entries;
    let headerBase = -1;
    let newEntity = -1;
    let updateFlags = 0;

    let updateType = UpdateType.PreserveEnt;

    let entity;
    while ( updateType < UpdateType.Finished ) {
      headerCount--;

      const isEntity = headerCount >= 0;
      if ( isEntity ) {
        updateFlags = HeaderFlags.FHDR_ZERO;

        newEntity = headerBase + 1 + entityBitBuffer.readUBitVar();
        headerBase = newEntity;

        // Leave PVS flag.
        if ( entityBitBuffer.readBit() === 0 ) {
          // Enter PVS flag.
          if ( entityBitBuffer.readBit() !== 0 ) {
            updateFlags |= HeaderFlags.FHDR_ENTERPVS;
          }
        } else {
          updateFlags |= HeaderFlags.FHDR_LEAVEPVS;

          // Force delete flag.
          if ( entityBitBuffer.readBit() !== 0 ) {
            updateFlags |= HeaderFlags.FHDR_DELETE;
          }
        }
      }

      for ( updateType = UpdateType.PreserveEnt;
            updateType === UpdateType.PreserveEnt; ) {
        // Figure out what kind of an update this is.
        if ( !isEntity || newEntity > ENTITY_SENTINEL ) {
          updateType = UpdateType.Finished;
        } else {
          if ( updateFlags & HeaderFlags.FHDR_ENTERPVS ) {
            updateType = UpdateType.EnterPVS;
          } else if ( updateFlags & HeaderFlags.FHDR_LEAVEPVS ) {
            updateType = UpdateType.LeavePVS;
          } else {
            updateType = UpdateType.DeltaEnt;
          }
        }
      }

      switch ( updateType ) {
        case UpdateType.EnterPVS:
          const classIndex = entityBitBuffer.readUBits( serverClassBits );
          const serialNum = entityBitBuffer.readUBits( NUM_NETWORKED_EHANDLE_SERIAL_NUMBER_BITS );
          entity = addEntity( newEntity, classIndex, serialNum );
          readNewEntity( entityBitBuffer, entity );
          break;

        case UpdateType.LeavePVS:
          // Should never happen on a full update.
          if ( !asDelta ) {
            updateType = UpdateType.Failed;
            // Break out.
            throw new Error( 'WARNING: LeavePVS on full update.' );
          }

          removeEntity( newEntity );
          break;

        case UpdateType.DeltaEnt:
          entity = findEntity( newEntity );
          if ( entity ) {
            readNewEntity( entityBitBuffer, entity );
          } else {
            throw new Error();
          }

          break;

        case UpdateType.PreserveEnt:
          // Should never happen on a full update.
          if ( !asDelta ) {
            updateType = UpdateType.Failed;
            // Break out.
            throw new Error( 'WARNING: PreserveEnt on full update.' );
          }

          if ( newEntity >= MAX_EDICTS ) {
            throw new Error( 'PreserveEnt: newEntity == MAX_EDICTS.' );
          }

          break;

        default:
          break;
      }
    }
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
      } else if ( commandType === 'PacketEntities' ) {
        parsePacketEntities( message );
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
