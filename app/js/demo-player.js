/**
 * A lightweight parser that only extracts data of particular interest to an
 * average player.
 */
const { Buffer } = require( 'buffer' );

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
  const dataTables    = [];
  let currentExcludes = [];
  const entities      = [];
  let playerInfos     = [];

  // Advance by read size.
  function readRawData() {
    const size = reader.readInt32();
    reader.offset += size;
  }

  function readFromBuffer( buffer ) {
    const size = buffer.readVarInt32();
    // Assume read buffer is byte-aligned.
    return buffer.read( size );
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

  function handlePlayerConnectDisconnectEvents( message, descriptor ) {
    // Need to handle player_connect and player_disconnect because this is
    // the only place bots get added to our player info array.
    // Actual players come in via string tables.
    const playerDisconnect = descriptor.name === 'player_disconnect';
    if ( descriptor.name !== 'player_connect' && !playerDisconnect ) {
      return false;
    }

    let userid = -1;
    let index  = -1;
    let name;
    let bot = false;
    for ( let i = 0, il = message.keys.length; i < il; i++ ) {
      const key   = descriptor.keys[i];
      const value = message.keys[i];

      if ( key.name === 'userid' ) {
        userid = value.val_short;
      } else if ( key.name === 'index' ) {
        index = value.val_byte;
      } else if ( key.name === 'name' ) {
        name = value.val_string;
      } else if ( key.name === 'networkid' ) {
        bot = value.val_string === 'BOT';
      } else if ( key.name === 'bot' ) {
        bot = value.val_bool;
      }
    }

    if ( playerDisconnect ) {
      // Mark the player info slot as disconnected.
      const playerInfo  = findPlayerInfo( userid );
      playerInfo.name   = 'disconnected';
      playerInfo.userID = -1;
      playerInfo.guid   = '';
    } else {
      const newPlayer      = {};
      newPlayer.userID     = userid;
      newPlayer.name       = name;
      newPlayer.fakeplayer = bot;
      if ( bot ) {
        newPlayer.guid = 'BOT';
      }

      if ( index < playerInfos.length ) {
        // Only replace existing player slot if the userID is different
        // (very unlikely).
        if ( playerInfos[ index ].userID !== userid ) {
          playerInfos[ index ] = newPlayer;
        }
      } else {
        playerInfos.push( newPlayer );
      }
    }

    return true;
  }

  function parsePlayerInfo( field, index ) {
    const playerInfo = findPlayerInfo( index );
    if ( !playerInfo ) {
      return;
    }

    console.log( ` ${ field }: ${ playerInfo.name } (id:${ index })` );

    const entityIndex = findPlayerEntityIndex( index ) + 1;
    const entity      = findEntity( entityIndex );

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

    if ( handlePlayerConnectDisconnectEvents( message, descriptor ) ) {
      return;
    }

    for ( let i = 0, il = message.keys.length; i < il; i++ ) {
      const key   = descriptor.keys[i];
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
          const index       = buffer.readUBits( 5 );
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
          bytes   = userDataSize;
          tempBuf = buffer.readCString( Math.floor( userDataSizeBits / 8 ) ) +
            String.fromCharCode( buffer.readBits( userDataSizeBits % 8 ) );
        } else {
          bytes   = buffer.readUBits( MAX_USERDATA_BITS );
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

  function getTableByName( name ) {
    for ( let i = 0, il = dataTables.length; i < il; i++ ) {
      if ( dataTables[i].net_table_name === name ) {
        return dataTables[i];
      }
    }
  }

  function getSendPropByIndex( classIndex, index ) {
    if ( index < serverClasses[ classIndex ].flattenedProps.length ) {
      return serverClasses[ classIndex ].flattenedProps[ index ];
    }
  }

  function gatherExcludes( table ) {
    for ( let i = 0, il = table.props.length; i < il; i++ ) {
      const sendProp = table.props[i];
      if ( sendProp.flags & SPROP.EXCLUDE ) {
        currentExcludes.push({
          var_name:       sendProp.var_name,
          dt_name:        sendProp.dt_name,
          net_table_name: sendProp.net_table_name
        });
      }

      if ( sendProp.type === SendPropType.DPT_DataTable ) {
        const subTable = getTableByName( sendProp.dt_name );
        if ( subTable ) {
          gatherExcludes( subTable );
        }
      }
    }
  }

  function isPropExcluded( table, checkSendProp ) {
    for ( let i = 0, il = currentExcludes.length; i < il; i++ ) {
      if ( table.net_table_name   === currentExcludes[i].dt_name &&
           checkSendProp.var_name === currentExcludes[i].var_name ) {
        return true;
      }
    }

    return false;
  }

  function gatherProps_IterateProps( table, serverClassIndex, flattenedProps ) {
    for ( let i = 0, il = table.props.length; i < il; i++ ) {
      const sendProp = table.props[i];
      if ( sendProp.flags & SPROP.INSIDEARRAY ||
           sendProp.flags & SPROP.EXCLUDE     ||
           isPropExcluded( table, sendProp ) ) {
        continue;
      }

      if ( sendProp.type === SendPropType.DPT_DataTable ) {
        const subTable = getTableByName( sendProp.dt_name );
        if ( subTable ) {
          if ( sendProp.flags & SPROP.COLLAPSIBLE ) {
            gatherProps_IterateProps( subTable, serverClassIndex, flattenedProps );
          } else {
            gatherProps( subTable, serverClassIndex );
          }
        }
      } else {
        flattenedProps.push({
          prop:             sendProp,
          arrayElementProp: sendProp.type === SendPropType.DPT_Array ?
            table.props[ i - 1 ] :
            undefined
        });
      }
    }
  }

  function gatherProps( table, serverClassIndex ) {
    const tempFlattenedProps = [];
    gatherProps_IterateProps( table, serverClassIndex, tempFlattenedProps );

    const flattenedProps = serverClasses[ serverClassIndex ].flattenedProps;
    for ( let i = 0, il = tempFlattenedProps.length; i < il; i++ ) {
      flattenedProps.push( tempFlattenedProps[i] );
    }
  }

  function flattenDataTable( serverClassIndex )  {
    const table = dataTables[ serverClasses[ serverClassIndex ].dataTable ];

    currentExcludes = [];
    gatherExcludes( table );

    gatherProps( table, serverClassIndex );

    const flattenedProps = serverClasses[ serverClassIndex ].flattenedProps;

    // Get priorities.
    const priorities = [ 64 ];
    for ( let i = 0, il = flattenedProps.length; i < il; i++ ) {
      let priority = flattenedProps[i].prop.priority;
      let found    = false;
      for ( let j = 0, jl = priorities.length; j < jl; j++ ) {
        if ( priorities[j] === priority ) {
          found = true;
          break;
        }
      }

      if ( !found ) {
        priorities.push( priority );
      }
    }

    priorities.sort( ( a, b ) => a - b );

    // Sort flattenedProps by priority.
    let start = 0;
    for (
      let priorityIndex = 0, prioritiesLength = priorities.length;
      priorityIndex < prioritiesLength;
      priorityIndex++
    ) {
      const priority = priorities[ priorityIndex ];

      while ( true ) {
        let currentProp = start;
        while ( currentProp < flattenedProps.length ) {
          const prop = flattenedProps[ currentProp ].prop;

          if ( prop.priority === priority ||
               priority      === 64 && ( SPROP.CHANGES_OFTEN & prop.flags ) ) {
            if ( start !== currentProp ) {
              const temp = flattenedProps[ start ];
              flattenedProps[ start ] = flattenedProps[ currentProp ];
              flattenedProps[ currentProp ] = temp;
            }

            start++;
            break;
          }

          currentProp++;
        }

        if ( currentProp === flattenedProps.length ) {
          break;
        }
      }
    }
  }

  function parseDataTable( slice ) {
    while ( true ) {
      // type.
      slice.readVarInt32();

      const buffer  = readFromBuffer( slice );
      const message = messages.CSVCMsg_SendTable.decode( buffer );
      if ( message.is_end ) {
        break;
      }

      dataTables.push( message );
    }

    const serverClassCount = slice.readShort();
    for ( let i = 0; i < serverClassCount; i++ ) {
      const entry = {
        classID:        slice.readShort(),
        name:           slice.readCString( 256 ),
        dtName:         slice.readCString( 256 ),
        dataTable:      -1,
        flattenedProps: []
      };

      // Find the data table by name.
      for ( let j = 0, jl = dataTables.length; j < jl; j++ ) {
        if ( entry.dtName === dataTables[j].net_table_name ) {
          entry.dataTable = j;
          break;
        }
      }

      serverClasses.push( entry );
    }

    for ( let i = 0; i < serverClassCount; i++ ) {
      flattenDataTable( i );
    }

    // Perform integer log2() to set serverClassBits
    let temp = serverClassCount;
    serverClassBits = 0;
    while ( temp >>= 1 ) { ++serverClassBits; }
    serverClassBits++;
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
      const sendProp = getSendPropByIndex( entity.classIndex, fieldIndices[i] );
      if ( sendProp ) {
        const prop = decodeProp(
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
      entry.serialNum  = serialNum;
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

    const asDelta   = message.is_delta;
    let headerCount = message.updated_entries;
    let headerBase  = -1;
    let newEntity   = -1;
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
          const serialNum  = entityBitBuffer.readUBits( NUM_NETWORKED_EHANDLE_SERIAL_NUMBER_BITS );
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
      name:       message.name,
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

  function dumpStringTable( slice, isUserInfo ) {
    const stringCount = slice.readWord();
    if ( isUserInfo ) {
      playerInfos = [];
    }

    for ( let i = 0; i < stringCount; i++ ) {
      const stringName = slice.readCString( 4096 );
      if ( stringName.length >= 100 ) {
        throw new Error();
      }

      if ( slice.readBit() === 1 ) {
        const userDataSize = slice.readWord();
        if ( !userDataSize ) {
          throw new Error();
        }

        const data = slice.read( userDataSize );
        if ( isUserInfo && data ) {
          const playerInfo = readPlayerInfo( new BitBufferReader( data ) );
          playerInfos.push( playerInfo );
        }
      }
    }

    // Client side stuff.
    // Read bit.
    if ( slice.readBit() === 1 ) {
      const stringCount = slice.readWord();
      for ( let i = 0; i < stringCount; i++ ) {
        // stringName.
        slice.readCString( 4096 );

        if ( slice.readBit() === 1 ) {
          const userDataSize = slice.readWord();
          if ( !userDataSize ) {
            throw new Error();
          }

          // data.
          slice.readCString( userDataSize + 1 );
        }
      }
    }
  }

  function dumpStringTables( slice ) {
    const tableCount = slice.readByte();
    for ( let i = 0; i < tableCount; i++ ) {
      const tableName  = slice.readCString( 256 );
      const isUserInfo = tableName === 'userinfo';
      dumpStringTable( slice, isUserInfo );
    }
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

      if ( commandType === 'CreateStringTable' ) {
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
    // democmdinfo struct.
    DemoCommandInfo.read( reader );

    // seqNrIn.
    reader.readInt32();
    // seqNrOut.
    reader.readInt32();

    const length = reader.readInt32();
    dumpDemoPacket( reader.offset, length );
  }

  while ( reader.offset < length ) {
    const command = reader.readUInt8();
    // timestamp.
    reader.readInt32();
    // playerSlot.
    reader.readUInt8();

    let size, slice;
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
        size  = reader.readInt32();
        slice = new BitBufferReader( reader.read( size ) );
        parseDataTable( slice );
        break;

      case DemoMessage.DEM_STRINGTABLES:
        size  = reader.readInt32();
        slice = new BitBufferReader( reader.read( size ) );
        dumpStringTables( slice );
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
