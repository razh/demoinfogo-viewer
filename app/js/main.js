import protobuf from 'protocol-buffers';
import BufferReader from './buffer-reader';

// brfs packages.
var fs = require( 'fs' );
var Buffer = require( 'buffer' ).Buffer;

var netMessages = fs.readFileSync( __dirname + '/../proto/netmessages_public.proto', 'utf8' );
// console.log( netMessages );

var messages = protobuf( netMessages );
console.log(messages);

const MAX_OSPATH = 260;

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
          reader.readAsArrayBuffer( file.slice( 0, 2048 ) );
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
        console.log( 'size', size );
        buffer.offset += size;
      }

      console.log( 'commands' );
      while ( reader.offset < length ) {
        // Read command header.
        // Command.
        var command = reader.readUInt8();
        console.log( command );

        // Time stamp.
        var timestamp = reader.readInt32();
        console.log( timestamp );

        // Player slot.
        var playerSlot = reader.readUInt8();
        console.log( playerSlot );

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
            readRawData();
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
