import _ from 'lodash';
import protobuf from 'protocol-buffers';
import BN from 'bn.js';
import BufferReader from './buffer-reader';
import BitBufferReader from './bit-buffer-reader';
import { DemoCommandInfo, EntityEntry, UpdateType, HeaderFlags } from './defs';
import { SendPropType, SPROP, decodeProp } from './prop-decode';

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

// Protocol buffer definitions.
const messages = protobuf(
  fs.readFileSync( __dirname + '/../proto/netmessages_public.proto', 'utf8' ) +
  fs.readFileSync( __dirname + '/../proto/cstrike15_usermessages_public.proto', 'utf8' )
);

console.log( messages );

// Constants.
const { NET_Messages, SVC_Messages, ECstrike15UserMessages } = messages;

const MAX_OSPATH = 260;
// Largest message that can be sent in bytes.
const NET_MAX_PAYLOAD = 262144 - 4;

// How many bits to use to encode an edict?
// # of bits needed to represent max edicts.
const MAX_EDICT_BITS = 11;
// Max # of edicts in a level.
const MAX_EDICTS = ( 1 << MAX_EDICT_BITS );

const MAX_USERDATA_BITS = 14;
const MAX_USERDATA_SIZE = ( 1 << MAX_USERDATA_BITS );
const SUBSTRING_BITS = 5;

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

const GameEventValue = {
  TYPE_STRING: 1,
  TYPE_FLOAT: 2,
  TYPE_LONG: 3,
  TYPE_SHORT: 4,
  TYPE_BYTE: 5,
  TYPE_BOOL: 6,
  TYPE_UINT64: 7,
  TYPE_WSTRING: 8
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
      console.log( 'demofilestamp:', demoFilestamp );
      // Demo protocol. Should be 4.
      var demoProtocol = reader.readInt32();
      console.log( 'demoProtocol:', demoProtocol );
      // Network protocol. Protocol version.
      var networkProtocol = reader.readInt32();
      console.log( 'networkprotocol:', networkProtocol );
      // Server name.
      var serverName = reader.readString( MAX_OSPATH );
      console.log( 'servername:', serverName );
      // Client name.
      var clientName = reader.readString( MAX_OSPATH );
      console.log( 'clientname:', clientName );
      // Map name.
      var mapName = reader.readString( MAX_OSPATH );
      console.log( 'mapname:', mapName );
      // Game directory.
      var gameDirectory = reader.readString( MAX_OSPATH );
      console.log( 'gamedirectory:', gameDirectory );
      // Playback time.
      var playbackTime = reader.readFloat();
      console.log( 'playback_time:', playbackTime );
      // Playback ticks.
      var playbackTicks = reader.readInt32();
      console.log( 'playback_ticks:', playbackTicks );
      // Playback frames.
      var playbackFrames = reader.readInt32();
      console.log( 'playback_frames:', playbackFrames );
      // Sign-on length.
      var signonLength = reader.readInt32();
      console.log( 'signonlength:', signonLength );

      var gameEventList;

      var stringTables = [];
      var serverClassBits = 0;
      var serverClasses = [];
      var dataTables = [];
      var currentExcludes = [];
      var entities = [];
      var playerInfos = [];

      var matchStartOccurred = false;

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

      function printUserMessage( buffer, command, size ) {
        console.log( 'command:', command, 'size:', size );

        var commandType = _.find([
          'VGUIMenu',
          'Geiger',
          'Train',
          'HudText',
          'SayText',
          'SayText2',
          'TextMsg',
          'HudMsg',
          'ResetHud',
          'GameTitle',
          'Shake',
          'Fade',
          'Rumble',
          'CloseCaption',
          'CloseCaptionDirect',
          'SendAudio',
          'RawAudio',
          'VoiceMask',
          'RequestState',
          'Damage',
          'RadioText',
          'HintText',
          'KeyHintText',
          'ProcessSpottedEntityUpdate',
          'ReloadEffect',
          'AdjustMoney',
          'UpdateTeamMoney',
          'StopSpectatorMode',
          'KillCam',
          'DesiredTimescale',
          'CurrentTimescale',
          'AchievementEvent',
          'MatchEndConditions',
          'DisconnectToLobby',
          'DisplayInventory',
          'WarmupHasEnded',
          'ClientInfo',
          'CallVoteFailed',
          'VoteStart',
          'VotePass',
          'VoteFailed',
          'VoteSetup',
          'SendLastKillerDamageToClient',
          'ItemPickup',
          'ShowMenu',
          'BarTime',
          'AmmoDenied',
          'MarkAchievement',
          'ItemDrop',
          'GlowPropTurnOff'
        ], type => command === ECstrike15UserMessages[ 'CS_UM_' + type ] );

        if ( !commandType ) {
          return;
        }

        var commandHandler = messages[ 'CCSUsrMsg_' + commandType ];
        var message = commandHandler.decode( buffer );

        console.log( commandHandler );
        console.log( message );
      }

      function dumpUserMessage( message ) {
        var command = message.msg_type;
        var size = message.msg_data.length;
        printUserMessage( message.msg_data, command, size );
      }

      function findPlayerInfo( userID ) {
        var playerInfo;
        for ( var i = 0, il = playerInfos.length; i < il; i++ )  {
          playerInfo = playerInfos[i];
          if ( playerInfo.userID === userID ) {
            return playerInfo;
          }
        }
      }

      function findPlayerEntityIndex( userID ) {
        for ( var i = 0, il = playerInfos.length; i < il; i++ ) {
          if ( playerInfos[i].userID === userID ) {
            return i;
          }
        }

        return -1;
      }

      function getGameEventDescriptor( message ) {
        var descriptor;
        for ( var i = 0, il = gameEventList.descriptors.length; i < il; i++ ) {
          descriptor = gameEventList.descriptors[i];
          if ( descriptor.eventid === message.eventid ) {
            return descriptor;
          }
        }
      }

      function handlePlayerConnectDisconnectEvents( message, descriptor ) {
        // Need to handle player_connect and player_disconnect because this is
        // the only place bots get added to our player info array.
        // Actual players come in via string tables.
        var playerDisconnect = descriptor.name === 'player_disconnect';
        if ( descriptor.name !== 'player_connect' && !playerDisconnect ) {
          return false;
        }

        var userid = -1;
        var index = -1;
        var name, reason;
        var bot = false;
        var key, value;
        for ( var i = 0, il = message.keys.length; i < il; i++ ) {
          key = descriptor.keys[i];
          value = message.keys[i];

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
          } else if ( key.name === 'reason' ) {
            reason = value.val_string;
          }
        }

        if ( playerDisconnect ) {
          if ( options.dumpGameEvents ) {
            console.log(
              'Player ' + name +
              ' (id:' + userid +
              ') disconnected. reason:' + reason
            );
          }

          // Mark the player info slot as disconnected.
          var playerInfo = findPlayerInfo( userid );
          playerInfo.name = 'disconnected';
          playerInfo.userID = -1;
          playerInfo.guid = '';
        } else {
          var newPlayer = {};
          newPlayer.userID = userid;
          newPlayer.name = name;
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
            if ( options.dumpGameEvents ) {
              console.log(
                'Player ' + newPlayer.guid +
                ' ' + name +
                ' (id:' + userid + ') connected.'
              );
            }

            playerInfos.push( newPlayer );
          }
        }

        return true;
      }

      function showPlayerInfo( field, index, showDetails = true, csv = false ) {
        var playerInfo = findPlayerInfo( index );
        if ( !playerInfo ) {
          return false;
        }

        if ( csv ) {
          console.log( field + ', ' + playerInfo.name + ', ' + index );
        } else {
          console.log(
            ' ' + field +
            ': ' + playerInfo.name +
            ' (id:' + index + ')'
          );
        }

        if ( showDetails ) {
          var entityIndex = findPlayerEntityIndex( index ) + 1;
          var entity = findEntity( entityIndex );

          if ( entity ) {
            var xyProp = entity.findProp( 'm_vecOrigin' );
            var zProp = entity.findProp( 'm_vecOrigin[2]' );

            if ( xyProp && zProp ) {
              var { x, y } = xyProp.propValue.value;
              var z = zProp.propValue.value;

              if ( csv ) {
                console.log( ', ' + x + ', ' + y + ', ' + z );
              } else {
                console.log( '  position: ' + x + ', ' + y +', ' + z );
              }
            }

            var angle0Prop = entity.findProp( 'm_angEyeAngles[0]' );
            var angle1Prop = entity.findProp( 'm_angEyeAngles[1]' );

            if ( angle0Prop && angle1Prop ) {
              var angle0 = angle0Prop.propValue.value;
              var angle1 = angle1Prop.propValue.value;

              if ( csv ) {
                console.log( ', ' + angle0 + ', ' + angle1 );
              } else {
                console.log( '  facing: pitch:' + angle0 + ', yaw:' + angle1 );
              }
            }

            var teamProp = entity.findProp( 'm_iTeamNum' );
            if ( teamProp ) {
              var team = teamProp.propValue.value === 2 ? 'T' : 'CT';
              if ( csv ) {
                console.log( ', ' + team );
              } else {
                console.log( '  team: '  + team );
              }
            }
          }
        }

        return true;
      }

      function handlePlayerDeath( message, descriptor ) {
        var userid = -1;
        var attackerid = -1;
        var assisterid = 0;
        var weaponName = '';
        var headshot = false;
        var key, value;
        for ( var i = 0, il = message.keys.length; i < il; i++ ) {
          key = descriptor.keys[i];
          value = message.keys[i];

          if ( key.name === 'userid' ) {
            userid = value.val_short;
          } else if ( key.name === 'attacker' ) {
            attackerid = value.val_short;
          } else if ( key.name === 'assister' ) {
            assisterid = value.val_short;
          } else if ( key.name === 'weapon' ) {
            weaponName = value.val_string;
          } else if ( key.name === 'headshot' ) {
            headshot = value.val_bool;
          }
        }

        showPlayerInfo( 'victim', userid, true, true );
        console.log( ', ' );
        showPlayerInfo( 'attacker', attackerid, true, true );
        console.log( ', ' + weaponName + ', ' + ( headshot ? 'true' : 'false' ) );
        if ( assisterid ) {
          console.log( ', ' );
          showPlayerInfo( 'assister', assisterid, true, true );
        }
      }

      function parseGameEvent( message, descriptor ) {
        if ( !descriptor ) {
          return;
        }

        if ( !( descriptor.name === 'player_footstep' &&
                options.supressFootstepEvents ) ) {
          if ( !handlePlayerConnectDisconnectEvents( message, descriptor ) ) {
            if ( descriptor.name === 'round_announce_match_start' ) {
              matchStartOccurred = true;
            }

            var allowDeathReport = !options.supressWarmupDeaths || matchStartOccurred;
            if ( descriptor.name === 'death' &&
                options.dumpDeaths &&
                allowDeathReport ) {
              handlePlayerDeath( message, descriptor );
            }

            if ( options.dumpGameEvents ) {
              console.log( descriptor.name + '\n{' );
            }

            var key, value;
            for ( var i = 0, il = message.keys.length; i < il; i++ ) {
              key = descriptor.keys[i];
              value = message.keys[i];

              if ( options.dumpGameEvents ) {
                var handled = false;
                if ( key.name === 'userid' ||
                     key.name === 'attacker' ||
                     key.name === 'assister' ) {
                  handled = showPlayerInfo(
                    key.name,
                    value.val_short,
                    options.showExtraPlayerInfoInGameEvents
                  );
                }

                if ( !handled ) {
                  var output = ' ' + key.name + ': ';

                  if ( value.type === GameEventValue.TYPE_STRING ) {
                    output += value.val_string + ' ';
                  } else if ( value.type === GameEventValue.TYPE_FLOAT ) {
                    output += value.val_float + ' ';
                  } else if ( value.type === GameEventValue.TYPE_LONG ) {
                    output += value.val_long + ' ';
                  } else if ( value.type === GameEventValue.TYPE_SHORT ) {
                    output += value.val_short + ' ';
                  } else if ( value.type === GameEventValue.TYPE_BYTE ) {
                    output += value.val_byte + ' ';
                  } else if ( value.type === GameEventValue.TYPE_BOOL ) {
                    output += value.val_bool + ' ';
                  } else if ( value.type === GameEventValue.TYPE_UINT64 ) {
                    output += value.val_uint64 + ' ';
                  } else if ( value.type === GameEventValue.TYPE_WSTRING ) {
                    output += value.val_wstring + ' ';
                  }

                  console.log( output );
                }
              }
            }

            if ( options.dumpGameEvents ) {
              console.log( '}' );
            }
          }
        }
      }

      function printNetMessageGameEvent( message ) {
        var descriptor = getGameEventDescriptor( message );
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
        var lastEntry = -1;
        var lastDictionaryIndex = -1;

        // Perform integer log2() to set entryBits.
        var temp = maxEntries;
        var entryBits = 0;
        while ( temp >>= 1 ) { ++entryBits; }

        var encodeUsingDictionaries = buffer.readBit();

        if ( encodeUsingDictionaries ) {
          console.log( 'ParseStringTableUpdate: Encoded with dictionaries, unable to decode.' );
          return;
        }

        var history = [];

        for ( var i = 0; i < entries; i++ ) {
          var entryIndex = lastEntry + 1;

          if ( !buffer.readBit() ) {
            entryIndex = buffer.readUBits( entryBits );
          }

          lastEntry = entryIndex;

          if ( 0 > entryIndex || entryIndex >= maxEntries ) {
            console.log( 'ParseStringTableUpdate: bogus string index ' + entryIndex );
            return;
          }

          var currentEntry;
          var entry = '';
          var substr = '';

          if ( buffer.readBit() ) {
            var substringCheck = buffer.readBit();

            if ( substringCheck ) {
              var index = buffer.readUBits( 5 );
              var bytesToCopy = buffer.readUBits( SUBSTRING_BITS );
              entry = history[ index ].string.slice( 0, bytesToCopy + 1 );
              substr = buffer.readCString( 1024 );
              entry += substr;
            } else {
              entry = buffer.readCString( 1024 );
            }

            var currentEntry = entry;
          }

          // Read in the user data.
          var tempBuf = '';
          var userData = null;
          var bytes = 0;

          if ( buffer.readBit() ) {
            if ( userDataFixedSize ) {
              // Don't need to read length, it's fixed length and the length was networked down already.
              bytes = userDataSize;
              // Equivalent to a readBits( userDataSizeBits ).
              tempBuf = buffer.readCString( Math.floor( userDataSizeBits / 8 ) );
              tempBuf += String.fromCharCode( buffer.readBits( userDataSizeBits % 8 ) );
            } else {
              bytes = buffer.readUBits( MAX_USERDATA_BITS );
              if ( bytes > MAX_USERDATA_SIZE ) {
                console.log( 'ParseStringTableUpdate: user data too large (' + bytes + ' bytes).');
                return;
              }

              tempBuf = buffer.read( bytes );
            }

            userData = tempBuf;
          }

          if ( !currentEntry ) {
            // Avoid crash because of NULL strings.
            currentEntry = '';
          }

          if ( isUserInfo && userData ) {
            var playerInfo = readPlayerInfo( new BitBufferReader( userData ) );

            var added = false;
            if ( entryIndex < playerInfos.length ) {
              playerInfos[ entryIndex ] = playerInfo;
            } else {
              added = true;
              playerInfos.push( playerInfo );
            }

            if ( options.dumpStringTables ) {
              console.log( 'player info' );
              console.log( '{' );
              console.log( ' ' + ( added ? 'adding' : 'updating' ) + ':true' );
              printPlayerInfo( playerInfo );
              console.log( '}' );
            }
          } else if ( options.dumpStringTables ) {
            console.log(
              ' ' + entryIndex +
              ', ' + currentEntry +
              ', ' + bytes +
              ', ' + userData
            );
          }

          if ( history.length > 31 ) {
            history.shift();
          }

          history.push({
            string: currentEntry
          });
        }
      }

      function printNetMessageCreateStringTable( message ) {
        var isUserInfo = message.name === 'userinfo';
        if ( options.dumpStringTables ) {
          console.log(
            'CreateStringTable:' +
            message.name + ':' +
            message.max_entries + ':' +
            message.num_entries + ':' +
            message.user_data_size + ':' +
            message.user_data_size_bits + ':'
          );
        }

        var data = new BitBufferReader( message.string_data );
        parseStringTableUpdate(
          data,
          message.num_entries,
          message.max_entries,
          message.user_data_size,
          message.user_data_size_bits,
          message.user_data_fixed_size,
          isUserInfo
        );

        stringTables.push({
          name: message.name,
          maxEntries: message.max_entries
        });
      }

      function printNetMessageUpdateStringTable( message ) {
        var data = new BitBufferReader( message.string_data );
        if ( message.table_id < stringTables.length &&
             stringTables[ message.table_id ].maxEntries > message.num_changed_entries ) {
          var isUserInfo = stringTables[ message.table_id ].name === 'userinfo';
          if ( options.dumpStringTables ) {
            console.log(
              'UpdateStringTable:' +
              message.table_id + '(' +
              stringTables[ message.table_id ].name + '):' +
              message.num_changed_entries + ':'
            );
          }

          parseStringTableUpdate(
            data,
            message.num_changed_entries,
            stringTables[ message.table_id ].maxEntries,
            0, 0, 0,
            isUserInfo
          );
        } else {
          console.log(
            'Bad UpdateStringTable:' + message.table_id +
            ':' + message.num_changed_entries + '!'
          );
        }
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
        for ( var i = 0, il = table.props.length; i < il; i++ ) {
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
        for ( var i = 0, il = table.props.length; i < il; i++ ) {
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
          console.log( 'Table: ' + table.net_table_name );
        }

        var sendProp;
        var prop;
        for ( var i = 0, il = fieldIndices.length; i < il; i++ ) {
          sendProp = getSendPropByIndex( entity.classIndex, fieldIndices[i] );
          if ( sendProp ) {
            prop = decodeProp(
              entityBitBuffer,
              sendProp,
              entity.classIndex,
              fieldIndices[i],
              !options.dumpPacketEntities
            );
            entity.addOrUpdateProp( sendProp, prop );
          } else {
            return false;
          }
        }

        return true;
      }

      function findEntity( entity ) {
        var entry;
        for ( var i = 0, il = entities.length; i < il; i++ ) {
          entry = entities[i];
          if ( entry.entity === entity ) {
            return entry;
          }
        }
      }

      function addEntity( entity, classIndex, serialNum ) {
        // If entity already exists, then replace it, else add it.
        var entry = findEntity( entity );
        if ( entry ) {
          entry.classIndex = classIndex;
          entry.serialNum = serialNum;
        } else {
          entry = new EntityEntry( entity, classIndex, serialNum );
          entities.push( entry );
        }

        return entry;
      }

      function removeEntity( entity ) {
        return _.remove( entities, { entity } );
      }

      function printNetMessagePacketEntities( message ) {
        var entityBitBuffer = new BitBufferReader( message.entity_data );

        var asDelta = message.is_delta;
        var headerCount = message.updated_entries;
        var baseline = message.baseline;
        var updateBaselines = message.update_baseline;
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
        console.log( ' version:' + playerInfo.version );
        console.log( ' xuid:' + playerInfo.xuid );
        console.log( ' name:' + playerInfo.name );
        console.log( ' userID:' + playerInfo.userID );
        console.log( ' guid:' + playerInfo.guid );
        console.log( ' friendsID:' + playerInfo.friendsID );
        console.log( ' friendsName:' + playerInfo.friendsName );
        console.log( ' fakeplayer:' + playerInfo.fakeplayer );
        console.log( ' ishltv:' + playerInfo.ishltv );
        console.log( ' customFiles:' + playerInfo.customFiles );
        console.log( ' filesDownloaded:' + playerInfo.filesDownloaded );
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

          if ( !commandType ) {
            return;
          }

          if ( commandType && !commandHandler ) {
            commandHandler = messages[ 'CSVCMsg_' + commandType ];
          }

          var message = commandHandler.decode( reader.read( size ) );
          console.log( commandHandler );
          console.log( message );

          if ( commandType === 'CreateStringTable' ) {
            printNetMessageCreateStringTable( message );
          } else if ( commandType === 'UpdateStringTable' ) {
            printNetMessageUpdateStringTable( message );
          } else if ( commandType === 'UserMessage' ) {
            dumpUserMessage( message );
          } else if ( commandType === 'PacketEntities' ) {
            printNetMessagePacketEntities( message );
          } else if ( commandType === 'GameEvent' ) {
            printNetMessageGameEvent( message );
          } else if ( commandType === 'GameEventList' ) {
            gameEventList = message;
          }
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
