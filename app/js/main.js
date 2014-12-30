import _ from 'lodash';
import protobuf from 'protocol-buffers';
import BN from 'bn.js';
import BufferReader from './buffer-reader';
import BitBufferReader from './bit-buffer-reader';
import { DemoCommandInfo, EntityEntry, UpdateType, HeaderFlags } from './defs';
import { decodeProp } from './prop-decode';

// brfs packages.
var fs = require( 'fs' );
var Buffer = require( 'buffer' ).Buffer;

// Default is to dump out everything.
var options = {
  dumpGameEvents: true,
  supressFootstepEvents: false,
  showExtraPlayerInfoInGameEvents: true,
  dumpDeaths: true,
  supressWarmupDeaths: false,
  dumpStringTables: true,
  dumpDataTables: true,
  dumpPacketEntities: true,
  dumpNetMessages: true
};

var netMessages = fs.readFileSync( __dirname + '/../proto/netmessages_public.proto', 'utf8' );
// console.log( netMessages );

var messages = protobuf( netMessages );
console.log( messages );

const MAX_OSPATH = 260;
// Largest message that can be sent in bytes.
const NET_MAX_PAYLOAD = 262144 - 4;

// How many bits to use to encode an edict?
// # of bits needed to represent max edicts.
const MAX_EDICT_BITS = 11;
// Max # of edicts in a level.
const MAX_EDICTS = ( 1 << MAX_EDICT_BITS );

const NUM_NETWORKED_EHANDLE_SERIAL_NUMBER_BITS = 10;

const MAX_PLAYER_NAME_LENGTH = 128;
// Max 4 files.
const MAX_CUSTOM_FILES = 4;
// Hashed CD Key (32 hex alphabetic chars + 0 terminator).
const SIGNED_GUID_LEN = 32;

const ENTITY_SENTINEL = 9999;

const DemoMessage = {
  // Startup message. Process as fast as possible.
  DEM_SIGNON: 1,
  // Normal network packet that is stored off.
  DEM_PACKET: 2,
  // Sync client clock to demo tick.
  DEM_SYNCTICK: 3,
  // Console command.
  DEM_CONSOLECMD: 4,
  // User input command.
  DEM_USERCMD: 5,
  // Network data tables.
  DEM_DATATABLES: 6,
  // End of time.
  DEM_STOP: 7,
  // A blob of binary data understood by a callback function.
  DEM_CUSTOMDATA: 8,
  DEM_STRINGTABLES: 9,
  // Last command. Same as DEM_STRINGTABLES.
  DEM_LASTCMD: 9
};

const NET_Messages = {
  net_NOP: 0,
  net_Disconnect: 1,
  net_File: 2,
  net_Tick: 4,
  net_StringCmd: 5,
  net_SetConVar: 6,
  net_SignonState: 7
};

const SVC_Messages = {
  svc_ServerInfo: 8,
  svc_SendTable: 9,
  svc_ClassInfo: 10,
  svc_SetPause: 11,
  svc_CreateStringTable: 12,
  svc_UpdateStringTable: 13,
  svc_VoiceInit: 14,
  svc_VoiceData: 15,
  svc_Print: 16,
  svc_Sounds: 17,
  svc_SetView: 18,
  svc_FixAngle: 19,
  svc_CrosshairAngle: 20,
  svc_BSPDecal: 21,
  svc_UserMessage: 23,
  svc_GameEvent: 25,
  svc_PacketEntities: 26,
  svc_TempEntities: 27,
  svc_Prefetch: 28,
  svc_Menu: 29,
  svc_GameEventList: 30,
  svc_GetCvarValue: 31
};

// Property decoding.
const SendPropType = {
  DPT_Int: 0,
  DPT_Float: 1,
  DPT_Vector: 2,
  // Only encodes the XY of a vector, ignores Z.
  DPT_VectorXY: 3,
  DPT_String: 4,
  // An array of the base types (can't be of datatables).
  DPT_Array: 5,
  DPT_DataTable: 6,
  DPT_Int64: 7,
  DPT_NUMSendPropTypes: 8
};

const SPROP = {
  // Unsigned integer data.
  UNSIGNED: ( 1 << 0 ),
  // If this is set, the float/vector is treated like a world coordinate.
  // Note that the bit count is ignored in this case.
  COORD: ( 1 << 1 ),
  // For floating point, don't scale into range, just take value as is.
  NOSCALE: ( 1 << 2 ),
  // For floating point, limit high value to range minus one bit unit.
  ROUNDDOWN: ( 1 << 3 ),
  // For floating point, limit low value to range minus one bit unit.
  ROUNDUP: ( 1 << 4 ),
  // If this is set, the vector is treated like a normal (only valid for vectors).
  NORMAL: ( 1 << 5 ),
  // This is an exclude prop (not excludED, but it points at another prop to be excluded).
  EXCLUDE: ( 1 << 6 ),
  // Use XYZ/Exponent encoding for vectors.
  XYZE: ( 1 << 7 ),
  // This tells us that the property is inside an array, so it shouldn't be put
  // into the flattened property list. Its array will point at it when it needs to.
  INSIDEARRAY: ( 1 << 8 ),
  // Set for datatable props using one of the default datatable proxies like
  // SendProxy_DataTableToDataTable that always send the data to all clients.
  PROXY_ALWAYS_YES: ( 1 << 9 ),
  // Set automatically if SPROP_VECTORELEM is used.
  IS_A_VECTOR_ELEM: ( 1 << 10 ),
  // Set automatically if it's a datatable with an offset of 0 that doesn't
  // change the pointer (ie: for all automatically-chained base classes).
  COLLAPSIBLE: ( 1 << 11 ),
  // Like SPROP_COORD, but special handling for multiplayer games.
  COORD_MP: ( 1 << 12 ),
  // Like SPROP_COORD, but special handling for multiplayer games where the
  // fractional component only gets a 3 bits instead of 5.
  COORD_MP_LOWPRECISION: ( 1 << 13 ),
  // SPROP_COORD_MP, but coordinates are rounded to integral boundaries.
  COORD_MP_INTEGRAL: ( 1 << 14 ),
  // Like SPROP_COORD, but special encoding for cell coordinates that can't be
  // negative, bit count indicate maximum value.
  CELL_COORD: ( 1 << 15 ),
  // Like SPROP_CELL_COORD, but special handling where the fractional component
  // only gets a 3 bits instead of 5.
  CELL_COORD_LOWPRECISION: ( 1 << 16 ),
  // SPROP_CELL_COORD, but coordinates are rounded to integral boundaries.
  CELL_COORD_INTEGRAL: ( 1 << 17 ),
  // this is an often changed field, moved to head of sendtable so it gets a
  // small index.
  CHANGES_OFTEN: ( 1 << 18 ),
  // use var int encoded (google protobuf style), note you want to include
  // SPROP_UNSIGNED if needed, its more efficient.
  VARINT: ( 1 << 19 )
};

document.addEventListener( 'drop', event => {
  event.stopPropagation();
  event.preventDefault();

  Promise.all(
    _.map( event.dataTransfer.files, file => {
      return new Promise(( resolve, reject ) => {
        var reader = new FileReader();
        reader.onload = resolve;
        reader.onerror = reject;
        reader.readAsArrayBuffer( file.slice( 0, 1 << 19 ) );
      });
    })
  ).then( events => {
    return events.map( event => {
      var result = event.srcElement.result;
      var buffer = new Buffer( new Uint8Array( result ) );
      var reader = new BufferReader( buffer );
      var length = buffer.length;

      // Demo filestamp. Should be HL2DEMO.
      var demoFilestamp = reader.readString( 8 );
      console.log( demoFilestamp );
      // Demo protocol. Should be 4.
      var demoProtocol = reader.readInt32();
      console.log( demoProtocol );
      // Network protocol. Protocol version.
      var networkProtocol = reader.readInt32();
      console.log( networkProtocol );
      // Server name.
      var serverName = reader.readString( MAX_OSPATH );
      console.log( serverName );
      // Client name.
      var clientName = reader.readString( MAX_OSPATH );
      console.log( clientName );
      // Map name.
      var mapName = reader.readString( MAX_OSPATH );
      console.log( mapName );
      // Game directory.
      var gameDirectory = reader.readString( MAX_OSPATH );
      console.log( gameDirectory );
      // Playback time.
      var playbackTime = reader.readFloat();
      console.log( playbackTime );
      // Playback ticks.
      var playbackTicks = reader.readInt32();
      console.log( playbackTicks );
      // Playback frames.
      var playbackFrames = reader.readInt32();
      console.log( playbackFrames );
      // Sign-on length.
      var signonLength = reader.readInt32();
      console.log( signonLength );

      var serverClassBits = 0;
      var serverClasses = [];
      var dataTables = [];
      var currentExcludes = [];
      var entities = [];
      var playerInfos = [];

      function readRawData() {
        // Size.
        var size = reader.readInt32();
        console.log( 'size:', size );
        reader.offset += size;
      }

      function readFromBuffer( buffer ) {
        var size = buffer.readVarInt32();
        // Assume read buffer is byte-aligned.
        return buffer.read( size );
      }

      function recvTable_ReadInfos( message ) {
        if ( !options.dumpDataTables ) {
          return;
        }

        console.log( message.net_table_name, ':', message.props.length );

        for ( var i = 0, il = message.props.length; i < il; i++ ) {
          var sendProp = message.props[i];
          if ( sendProp.type === SendPropType.DPT_DataTable || sendProp.flags & SPROP.EXCLUDE ) {
            console.log(
              sendProp.type + ':' +
              sendProp.flags.toString( 16 ) + ':' +
              sendProp.var_name + ':' +
              sendProp.dt_name +
              ( sendProp.flags & SPROP.EXCLUDE ? ' exclude' : '' )
            );
          } else if ( sendProp.type === SendPropType.DPT_Array ) {
            console.log(
              sendProp.type + ':' +
              sendProp.flags.toString( 16 ) + ':' +
              sendProp.var_name + '[' +
              sendProp.num_elements + ']'
            );
          } else {
            console.log(
              sendProp.type + ':' +
              sendProp.flags.toString( 16 ) + ':' +
              sendProp.var_name + ':' +
              sendProp.low_value + ',' +
              sendProp.high_value + ',' +
              sendProp.num_bits.toString( 16 ) +
              ( sendProp.flags & SPROP.INSIDEARRAY ? ' inside array' : '' )
            );
          }
        }
      }

      function getTableByClassID( classID ) {
        for ( var i = 0, il = serverClasses.length; i < il; i++ ) {
          if ( serverClasses[i].classID === classID ) {
            return dataTables[ serverClasses[i].dataTable ];
          }
        }
      }

      function getTableByName( name ) {
        for ( var i = 0, il = dataTables.length; i < il; i++ ) {
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
        for ( var i = 0, il = table.props_size; i < il; i++ ) {
          var sendProp = table.props[i];
          if ( sendProp.flags & SPROP.EXCLUDE ) {
            currentExcludes.push({
              var_name: sendProp.var_name,
              dt_name: sendProp.dt_name,
              net_table_name: sendProp.net_table_name
            });
          }

          if ( sendProp.type === SendPropType.DPT_DataTable ) {
            var subTable = getTableByName( sendProp.dt_name );
            if ( subTable ) {
              gatherExcludes( subTable );
            }
          }
        }
      }

      function isPropExcluded( table, checkSendProp ) {
        for ( var i = 0, il = currentExcludes.length; i < il; i++ ) {
          if ( table.net_table_name === currentExcludes[i].dt_name &&
               checkSendProp.var_name === currentExcludes[i].var_name ) {
            return true;
          }
        }

        return false;
      }

      function gatherProps_IterateProps( table, serverClassIndex, flattenedProps ) {
        for ( var i = 0, il = table.props_size; i < il; i++ ) {
          var sendProp = table.props[i];
          if ( sendProp.flags & SPROP.INSIDEARRAY ||
               sendProp.flags & SPROP.EXCLUDE ||
               isPropExcluded( table, sendProp ) ) {
            continue;
          }

          if ( sendProp.type === SendPropType.DPT_DataTable ) {
            var subTable = getTableByName( sendProp.dt_name );
            if ( subTable ) {
              if ( sendProp.flags & SPROP.COLLAPSIBLE ) {
                gatherProps_IterateProps( subTable, serverClassIndex, flattenedProps );
              } else {
                gatherProps( subTable, serverClassIndex );
              }
            }
          } else {
            if ( sendProp.type === SendPropType.DPT_Array ) {
              flattenedProps.push({
                prop: sendProp,
                arrayElementProp: table.props[ i - 1 ]
              });
            } else {
              flattenedProps.push({
                prop: sendProp
              });
            }
          }
        }
      }

      function gatherProps( table, serverClassIndex ) {
        var tempFlattenedProps = [];
        gatherProps_IterateProps( table, serverClassIndex, tempFlattenedProps );

        var flattenedProps = serverClasses[ serverClassIndex ].flattenedProps;
        for ( var i = 0, il = tempFlattenedProps.length; i < il; i++ ) {
          flattenedProps.push( tempFlattenedProps[i] );
        }
      }

      function flattenDataTable( serverClassIndex )  {
        var table = dataTables[ serverClasses[ serverClassIndex ].dataTable ];

        currentExcludes = [];
        gatherExcludes( table );

        gatherProps( table, serverClassIndex );

        var flattenedProps = serverClasses[ serverClassIndex ].flattenedProps;

        // Get priorities.
        var priorities = [ 64 ];
        var priority;
        for ( var i = 0, il = flattenedProps.length; i < il; i++ ) {
          priority = flattenedProps[i].prop.priority;
          var found = false;
          for ( var j = 0, jl = priorities.length; j < jl; j++ ) {
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
        var start = 0;
        for (
          var priorityIndex = 0, prioritiesLength = priorities.length;
          priorityIndex < prioritiesLength;
          priorityIndex++
        ) {
          priority = priorities[ priorityIndex ];

          while ( true ) {
            var currentProp = start;
            while ( currentProp < flattenedProps.length ) {
              var prop = flattenedProps[ currentProp ].prop;

              if ( prop.priority === priority ||
                   priority === 64 && ( SPROP.CHANGES_OFTEN & prop.flags ) ) {
                if ( start !== currentProp ) {
                  var temp  = flattenedProps[ start ];
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
        while ( 1 ) {
          var type = slice.readVarInt32();

          var buffer = readFromBuffer( slice );
          var message = messages.CSVCMsg_SendTable.decode( buffer );
          if ( message.is_end ) {
            break;
          }

          recvTable_ReadInfos( message );
          dataTables.push( message );
        }

        var serverClassCount = slice.readShort();
        var i;
        for ( i = 0; i < serverClassCount; i++ ) {
          var entry = {
            classID: slice.readShort(),
            name: slice.readCString( 256 ),
            dtName: slice.readCString( 256 ),
            dataTable: -1,
            flattenedProps: []
          };

          // Find the data table by name.
          for ( var j = 0, jl = dataTables.length; j < jl; j++ ) {
            if ( entry.dtName === dataTables[j].net_table_name ) {
              entry.dataTable = j;
              break;
            }
          }

          if ( options.dumpDataTables ) {
            console.log(
              'class:' +
              entry.classID + ':' +
              entry.name + ':' +
              entry.dtName + '(' +
              entry.dataTable + ')'
            );
          }

          serverClasses.push( entry );
        }

        if ( options.dumpDataTables ) {
          console.log( 'Flattening data tables...' );
        }

        for ( i = 0; i < serverClassCount; i++ ) {
          flattenDataTable( i );
        }

        if ( options.dumpDataTables ) {
          console.log( 'Done.' );
        }

        // Perform integer log2() to set serverClassBits
        var temp = serverClassCount;
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

        var ret = 0;
        if ( newWay && entityBitBuffer.readBit() ) {
          // Read 3 bits.
          ret = entityBitBuffer.readUBits( 3 );
        } else {
          // Read 7 bits.
          ret = entityBitBuffer.readUBits( 7 );
          switch ( ret & ( 32 | 64 ) ) {
          }
        }
      }

      function readNewEntity( entityBitBuffer, entity ) {
        //  0 = old way, 1 = new way.
        var newWay = entityBitBuffer.readBit() === 1;

        var fieldIndices = [];
        var index = -1;
        do {
          index = readFieldIndex( entityBitBuffer, index, newWay );
          if ( index !== -1 ) {
            fieldIndices.push( index );
          }
        } while ( index !== -1 );

        var table = getTableByClassID( entity.classIndex );
        if ( options.dumpPacketEntities ) {
          console.log( 'Table: ', table.net_table_name );
        }

        var sendProp;
        var prop;
        for ( var i = 0, il = fieldIndices.length; i < il; i++ ) {
          sendProp = getSendPropByIndex( entity.classIndex, fieldIndices[ i ] );
          if ( sendProp ) {
            prop = decodeProp(
              entityBitBuffer,
              sendProp,
              entity.classIndex,
              fieldIndices[ i ]
            );
            entity.addOrUpdateProp( sendProp, prop );
          } else {
            return false;
          }
        }

        return true;
      }

      function findEntity( entity ) {
        return _.find( entities, { entity } );
      }

      function addEntity( entity, classIndex, serialNum ) {
        var entityEntry = findEntity( entity );
        if ( entityEntry ) {
          entity.classIndex = classIndex;
          entity.serialNum = serialNum;
        } else {
          entityEntry = new EntityEntry( entity, classIndex, serialNum );
          entities.push( entityEntry );
        }

        return entityEntry;
      }

      function removeEntity( entity ) {
        return _.remove( entities, { entity } );
      }

      function printNetMessagePacketEntities( msg ) {
        var entityBitBuffer = new BitBufferReader( msg.entity_data );

        var asDelta = msg.is_delta;
        var headerCount = msg.updated_entries;
        var baseline = msg.baseline;
        var updateBaselines = msg.update_baseline;
        var headerBase = -1;
        var newEntity = -1;
        var updateFlags = 0;

        var updateType = UpdateType.PreserveEnt;

        var isEntity;
        var entity;
        while ( updateType < UpdateType.Finished ) {
          headerCount--;

          isEntity = headerCount >= 0;
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
            if ( isEntity || newEntity > ENTITY_SENTINEL ) {
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
              var classIndex = entityBitBuffer.readUBits( serverClassBits );
              var serialNum = entityBitBuffer.readUBits( NUM_NETWORKED_EHANDLE_SERIAL_NUMBER_BITS );
              if ( options.dumpPacketEntities ) {
                console.log(
                  'Entity Enters PVS: id:' +
                  newEntity + ', class:' +
                  classIndex + ', serial:' +
                  serialNum
                );
              }

              entity = addEntity( newEntity, classIndex, serialNum );
              readNewEntity( entityBitBuffer, entity );
              break;

            case UpdateType.LeavePVS:
              // Should never happen on a full update.
              if ( !asDelta ) {
                console.error( 'WARNING: LeavePVS on full update.' );
                updateType = UpdateType.Failed;
                // Break out.
                throw new Error();
              }

              if ( options.dumpPacketEntities ) {
                if ( updateFlags & HeaderFlags.FHDR_DELETE ) {
                  console.log( 'Entity leaves PVS and is deleted: id:' + newEntity );
                } else {
                  console.log( 'Entity leaves PVS: id:' + newEntity );
                }

                removeEntity( newEntity );
              }

              break;

            case UpdateType.DeltaEnt:
              entity = findEntity( newEntity );
              if ( entity ) {
                if ( options.dumpPacketEntities ) {
                  console.log(
                    'Entity Delta update: id:' +
                    entity.entity + ', class:' +
                    entity.classIndex + ', serial:' +
                    entity.serialNum
                  );
                }

                readNewEntity( entityBitBuffer, entity );
              } else {
                throw new Error();
              }

              break;

            case UpdateType.PreserveEnt:
              // Should never happen on a full update.
              if ( !asDelta ) {
                console.error( 'WARNING: PreserveEnt on full update.' );
                updateType = UpdateType.Failed;
                // Break out.
                throw new Error();
              }

              if ( newEntity >= MAX_EDICTS ) {
                console.log( 'PreserveEnt: newEntity == MAX_EDICTS.' );
                throw new Error();
              }

              if ( options.dumpPacketEntities ) {
                console.log( 'PreserveEnt: id:' + newEntity );
              }

              break;

            default:
              break;
          }
        }
      }

      function readCRC32( buffer ) {
        var array = [];
        for ( var i = 0; i < MAX_CUSTOM_FILES; i++ ) {
          array.push( buffer.readUInt32() );
        }

        return array;
      }

      function lowLevelByteSwap( array ) {
        return [].slice.call( array ).reverse();
      }

      // userinfo string table contains these.
      function readPlayerInfo( buffer ) {
        // Version for future compatibility.
        // 64-bit.
        var version = buffer.read( 8 );
        version = new BN( lowLevelByteSwap( version ), 10, 'le' ).toString();
        // Network xuid.
        var xuid = buffer.read( 8 );
        xuid = new BN( lowLevelByteSwap( xuid ), 10, 'le' ).toString();
        // Scoreboard information.
        var name = buffer.readString( MAX_PLAYER_NAME_LENGTH );
        // Local server user ID, unique while server is running.
        // 32-bit.
        var userID = buffer.read( 4 );
        userID = new Buffer( lowLevelByteSwap( userID ) ).readUInt32LE( 0 );
        // Global unique player identifier.
        // Original length is SIGNED_GUID_LEN + 1.
        var guid = buffer.readString( SIGNED_GUID_LEN );
        // Friend's identification number.
        // Original length is 4 bytes.
        var friendsID = buffer.read( 8 );
        friendsID = new Buffer( lowLevelByteSwap( friendsID ) ).readUInt32LE( 0 );
        // Friend's name.
        var friendsName = buffer.readString( MAX_PLAYER_NAME_LENGTH );
        // True, if player is a bot controlled by game.dll.
        var fakeplayer = buffer.readBool();
        // True, if player is the HLTV proxy.
        var ishltv = buffer.readBool();
        // Custom files CRC for this player.
        var customFiles = readCRC32( buffer );
        // This counter increases each time the server has a downloaded a new file.
        var filesDownloaded = buffer.readUInt8();

        return {
          version,
          xuid,
          name,
          userID,
          guid,
          friendsID,
          friendsName,
          fakeplayer,
          ishltv,
          customFiles,
          filesDownloaded
        };
      }

      function printPlayerInfo( playerInfo ) {
        console.log( 'version:', playerInfo.version );
        console.log( 'xuid:', playerInfo.xuid );
        console.log( 'name:', playerInfo.name );
        console.log( 'userID:', playerInfo.userID );
        console.log( 'guid:', playerInfo.guid );
        console.log( 'friendsID:', playerInfo.friendsID );
        console.log( 'friendsName:', playerInfo.friendsName );
        console.log( 'fakeplayer:', playerInfo.fakeplayer );
        console.log( 'ishltv:', playerInfo.ishltv );
        console.log( 'customFiles:', playerInfo.customFiles );
        console.log( 'filesDownloaded:', playerInfo.filesDownloaded );
      }

      function dumpStringTable( slice, isUserInfo ) {
        var stringCount = slice.readWord();
        if ( options.dumpStringTables ) {
          console.log( stringCount );
        }

        if ( isUserInfo ) {
          if ( options.dumpStringTables ) {
            console.log( 'Clearing player info array.' );
          }

          playerInfos = [];
        }

        var stringName;
        var userDataSize;
        var data;
        var playerInfo;
        var i;
        for ( i = 0; i < stringCount; i++ ) {
          stringName = slice.readCString( 4096 );
          if ( stringName.length >= 100 ) {
            throw new Error();
          }

          if ( slice.readBit() === 1 ) {
            userDataSize = slice.readWord();
            if ( !userDataSize ) {
              throw new Error();
            }

            data = slice.read( userDataSize );
            if ( isUserInfo && data ) {
              console.log( 'adding:player info:' );
              playerInfo = readPlayerInfo( new BitBufferReader( data ) );
              if ( dumpStringTables ) {
                printPlayerInfo( playerInfo );
              }

              playerInfos.push( playerInfo );
            } else if ( options.dumpStringTables ) {
              console.log( ' ' + i + ', ' + stringName + ', userdata[' + userDataSize + ']' );
            }
          } else if ( options.dumpStringTables ) {
            console.log( ' ' + i + ', ' + stringName );
          }
        }

        // Client side stuff.
        // Read bit.
        if ( slice.readBit() === 1 ) {
          stringCount = slice.readWord();
          for ( i = 0; i < stringCount; i++ ) {
            stringName = slice.readCString( 4096 );

            if ( slice.readBit() === 1 ) {
              userDataSize = slice.readWord();
              if ( !userDataSize ) {
                throw new Error();
              }

              data = slice.readCString( userDataSize + 1 );
              if ( i >= 2 && options.dumpStringTables ) {
                console.log( ' ' + i + ', ' + stringName + ', userdata[' + userDataSize + ']' );
              }
            } else if ( i >= 2 && options.dumpStringTables ) {
              console.log( ' ' + i + ', ' + stringName );
            }
          }
        }
      }

      function dumpStringTables( slice ) {
        var tableCount = slice.readByte();
        for ( var i = 0; i < tableCount; i++ ) {
          var tableName = slice.readCString( 256 );

          if ( options.dumpStringTables ) {
            console.log( 'ReadStringTable:' + tableName + ':' );
          }

          var isUserInfo = tableName === 'userinfo';
          dumpStringTable( slice, isUserInfo );
        }
      }

      function dumpDemoPacket( start, length ) {
        while ( reader.offset - start < length ) {
          var command = reader.readVarInt32();
          var size = reader.readVarInt32();
          if ( reader.offset - start + size > length ) {
            throw new Error();
          }

          if ( !size ) {
            return;
          }

          console.log( 'command:', command, 'size:', size );

          // NET_Messages.
          var commandType = _.find([
            'NOP',
            'Disconnect',
            'File',
            'Tick',
            'StringCmd',
            'SetConVar',
            'SignonState'
          ], type => command === NET_Messages[ 'net_' + type ] );

          var commandHandler = null;
          if ( commandType ) {
            commandHandler = messages[ 'CNETMsg_' + commandType ];
          }

          // SVC_Messages.
          commandType = commandType || _.find([
            'ServerInfo',
            'SendTable',
            'ClassInfo',
            'SetPause',
            'CreateStringTable',
            'UpdateStringTable',
            'VoiceInit',
            'VoiceData',
            'Print',
            'Sounds',
            'SetView',
            'FixAngle',
            'CrosshairAngle',
            'BSPDecal',
            'UserMessage',
            'GameEvent',
            'PacketEntities',
            'TempEntities',
            'Prefetch',
            'Menu',
            'GameEventList',
            'GetCvarValue'
          ], type => command === SVC_Messages[ 'svc_' + type ] );

          if ( commandType && !commandHandler ) {
            commandHandler = messages[ 'CSVCMsg_' + commandType ];
          }

          console.log( commandHandler );
          console.log( commandHandler.decode( reader.read( size ) ) );
        }
      }

      function handleDemoPacket() {
        var democmdinfo = DemoCommandInfo.read( reader );
        console.log( democmdinfo );

        // Read sequence info.
        var seqNrIn = reader.readInt32();
        var seqNrOut = reader.readInt32();
        console.log( 'seqNrIn:', seqNrIn, 'seqNrOut:', seqNrOut );

        var length = reader.readInt32();
        console.log( 'length:', length );

        dumpDemoPacket( reader.offset, length );
      }

      console.log( 'commands' );
      var size, slice;
      while ( reader.offset < length ) {
        // Read command header.
        // Command.
        var command = reader.readUInt8();
        console.log( 'command:', command );

        // Time stamp.
        var timestamp = reader.readInt32();
        console.log( 'timestamp:', timestamp );

        // Player slot.
        var playerSlot = reader.readUInt8();
        console.log('playerSlot:', playerSlot );

        switch ( command ) {
          case DemoMessage.DEM_SYNCTICK:
            console.log( 'dem_synctick' );
            break;

          case DemoMessage.DEM_STOP:
            console.log( 'dem_stop' );
            return;

          case DemoMessage.DEM_CONSOLECMD:
            console.log( 'dem_consolecmd' );
            readRawData();
            break;

          case DemoMessage.DEM_DATATABLES:
            console.log( 'dem_datatables' );
            size = reader.readInt32();
            console.log( 'size:', size );
            slice = new BitBufferReader( reader.read( size ) );
            parseDataTable( slice );
            break;

          case DemoMessage.DEM_STRINGTABLES:
            console.log( 'dem_stringtables' );
            size = reader.readInt32();
            console.log( 'size:', size );
            slice = new BitBufferReader( reader.read( size ) );
            dumpStringTables( slice );
            break;

          case DemoMessage.DEM_USERCMD:
            console.log( 'dem_usercmd' );
            readRawData();
            break;

          case DemoMessage.DEM_SIGNON:
          case DemoMessage.DEM_PACKET:
            console.log( 'dem_signon|dem_packet' );
            handleDemoPacket();
            break;

          default:
            console.log( 'default' );
        }
      }
    });
  });
});

document.addEventListener( 'dragover', event => {
  event.stopPropagation();
  event.preventDefault();
});
