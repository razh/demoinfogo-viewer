import protobuf from 'protocol-buffers';

// brfs packages.
var fs = require( 'fs' );
var Buffer = require( 'buffer' ).Buffer;

var netMessages = fs.readFileSync( __dirname + '/../proto/netmessages_public.proto', 'utf8' );
// console.log( netMessages );

var messages = protobuf( netMessages );
console.log(messages);

const MAX_OSPATH = 260;

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
    });
  });
});

document.addEventListener( 'dragover', event => {
  event.stopPropagation();
  event.preventDefault();
});
