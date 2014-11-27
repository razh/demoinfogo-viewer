import protobuf from 'protocol-buffers';

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
      var length = buffer.length;

      var offset = 8;
      // Demo filestamp. Should be HL2DEMO.
      console.log( buffer.toString( 'ascii', 0, offset ) );
      // Demo protocol. Should be 4.
      console.log( buffer.readInt32LE( offset ) );
      offset += 4;
      // Network protocol. Protocol version.
      console.log( buffer.readInt32LE( offset ) );
      offset += 4;
      // Server name.
      console.log( buffer.toString( 'ascii', offset, offset + MAX_OSPATH ) );
      offset += MAX_OSPATH;
      // Client name.
      console.log( buffer.toString( 'ascii', offset, offset + MAX_OSPATH ) );
      offset += MAX_OSPATH;
      // Map name.
      console.log( buffer.toString( 'ascii', offset, offset + MAX_OSPATH ) );
      offset += MAX_OSPATH;
      // Game directory.
      console.log( buffer.toString( 'ascii', offset, offset + MAX_OSPATH ) );
      offset += MAX_OSPATH;
      // Playback time.
      console.log( buffer.readFloatLE( offset ) );
      offset += 4;
      // Playback ticks.
      console.log( buffer.readInt32LE( offset ) );
      offset += 4;
      // Playback frames.
      console.log( buffer.readInt32LE( offset ) );
      offset += 4;
      // Sign-on length.
      console.log( buffer.readInt32LE( offset ) );
      offset += 4;

      function readRawData() {
        // Size.
        var size = buffer.readInt32LE( offset );
        offset += 4;
        console.log( 'size', size );
        offset += size;
      }

      console.log( 'commands' );
      while ( offset < length ) {
        // Read command header.
        // Command.
        var command = buffer.readUInt8( offset );
        console.log( command );
        offset++;

        // Time stamp.
        console.log( buffer.readInt32LE( offset ) );
        offset += 4;

        // Player slot.
        console.log( buffer.readUInt8( offset ) );
        offset++;

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
