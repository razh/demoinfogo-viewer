import protobuf from 'protocol-buffers';
import BufferReader from './buffer-reader';
import { DemoCommandInfo } from './defs';

// brfs packages.
var fs = require( 'fs' );
var Buffer = require( 'buffer' ).Buffer;

var netMessages = fs.readFileSync( __dirname + '/../proto/netmessages_public.proto', 'utf8' );
// console.log( netMessages );

var messages = protobuf( netMessages );
console.log( messages );

const MAX_OSPATH = 260;
// Largest message that can be sent in bytes.
const NET_MAX_PAYLOAD = 262144 - 4;

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

/*jshint camelcase:false*/
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
/*jshint camelcase:true*/

const bitbuf = {
  kMaxVarintBytes: 10,
  kMaxVarint32Bytes: 5
};

document.addEventListener( 'drop', event => {
  event.stopPropagation();
  event.preventDefault();

  Promise.all(
    Array.from( event.dataTransfer.files )
      .map(file => {
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

      function readRawData() {
        // Size.
        var size = reader.readInt32();
        console.log( 'size:', size );
        reader.offset += size;
      }

      // Read 1-5 bytes in order to extract a 32-bit unsigned value from the
      // stream. 7 data bits are extracted from each byte with the 8th bit used
      // to indicate whether the loop should continue.
      // This allows variable size numbers to be stored with tolerable
      // efficiency. Numbers sizes that can be stored for various numbers of
      // encoded bits are:
      //  8-bits: 0-127
      // 16-bits: 128-16383
      // 24-bits: 16384-2097151
      // 32-bits: 2097152-268435455
      // 40-bits: 268435456-0xFFFFFFFF
      function readVarInt32() {
        var result = 0;
        var count = 0;
        var b;

        do {
          if ( count === bitbuf.kMaxVarint32Bytes ) {
            return result;
          }

          b = reader.readUInt8();
          result = result | ( b & 0x7F ) << ( 7 * count );
          count++;
        } while ( b & 0x80 );

        return result;
      }

      function dumpDemoPacket( start, length ) {
        while ( reader.offset - start < length ) {
          var command = readVarInt32();
          var size = readVarInt32();
          if ( reader.offset - start + size > length ) {
            throw new Error();
          }

          if ( !size ) {
            return;
          }

          console.log( 'command:', command, 'size:', size );

          /*jshint camelcase:false*/
          // NET_Messages.
          var commandType = [
            'NOP',
            'Disconnect',
            'File',
            'Tick',
            'StringCmd',
            'SetConVar',
            'SignonState'
          ].find( type => command === NET_Messages[ 'net_' + type ] );

          var commandHandler = null;
          if ( commandType ) {
            commandHandler = messages[ 'CNETMsg_' + commandType ];
          }

          // SVC_Messages.
          commandType = commandType || [
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
          ].find( type => command === SVC_Messages[ 'svc_' + type ] );
          /*jshint camelcase:true*/

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
            readRawData();
            break;

          case DemoMessage.DEM_STRINGTABLES:
            console.log( 'dem_stringtables' );
            readRawData();
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
