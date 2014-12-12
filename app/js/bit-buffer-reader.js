import BufferReader from './buffer-reader';

var Buffer = require( 'buffer' );

var temp = new DataView( new ArrayBuffer( 8 ) );

/**
 * Prior art:
 * https://github.com/inolen/bit-buffer
 * https://github.com/Piot/nybble
 * https://github.com/wiedi/node-bitbuffer/blob/master/bitbuffer.js
 */
export default class BitBufferReader extends BufferReader {
  constructor( buffer ) {
    super( buffer );
    this.bitOffset = 0;
  }

  peekBit() {
    return this.buffer[ this.offset ] >> ( this.bitOffset & 7 ) & 1;
  }

  readBit() {
    var bit = this.peekBit();
    this.bitOffset++;

    if ( this.bitOffset > 7 ) {
      this.bitOffset = 0;
      this.offset++;
    }

    return bit;
  }

  readBool() { return !!this.readBit(); }

  readUBits( bits ) {
    var value = 0;

    for ( var i = 0; i < bits; ) {
      if ( !this.bitOffset && bits - i > 7 ) {
        // Read byte.
        value |= this.buffer[ this.offset ] << i;
        this.offset++;
        i += 8;
      } else {
        value |= this.readBit() << i;
        i++;
      }
    }

    return value;
  }

  readBits( bits ) {
    var value = this.readUBits( bits );

    // Check most significant bit for sign.
    if ( bits !== 32 && value & ( 1 << ( bits - 1 ) ) ) {
      value |= -1 ^ ( ( 1 << bits ) - 1 );
    }

    return value;
  }

  read( length ) {
    if ( !this.bitOffset ) {
      return super( length );
    }

    var buffer = new Uint8Array( length );
    for ( var i = 0; i < length; i++ ) {
      buffer[i] = this.readUInt8();
    }

    return new Buffer( buffer );
  }

  readUInt8() {
    if ( !this.bitOffset ) {
      return super();
    }

    return this.readUBits( 8 );
  }

  readInt16() {
    if ( !this.bitOffset ) {
      return super();
    }

    return this.readBits( 16 );
  }

  readUInt16() {
    if ( !this.bitOffset ) {
      return super();
    }

    return this.readUBits( 16 );
  }

  readInt32() {
    if ( !this.bitOffset ) {
      return super();
    }

    return this.readBits( 32 );
  }

  readUInt32() {
    if ( !this.bitOffset ) {
      return super();
    }

    return this.readUBits( 32 );
  }

  readFloat() {
    if ( !this.bitOffset ) {
      return super();
    }

    var value = this.readBits( 32 );
    temp.setUint32( 0, value, true );
    return temp.getFloat32( 0, true );
  }

  readString( length ) {
    var array = [];
    for ( var i = 0; i < length; i++ ) {
      array.push( this.readUInt8() );
    }

    return String.fromCharCode( ...array );
  }

  readCString( length ) {
    var array = [];
    var ch;
    for ( var i = 0; i < length; i++ ) {
      ch = this.readUInt8();
      if ( !ch ) {
        break;
      }

      array.push( ch );
    }

    return String.fromCharCode( ...array );
  }
}
