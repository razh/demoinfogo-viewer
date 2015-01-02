import BufferReader from './buffer-reader';
import { BitCoordType } from './bit-buffer';

var Buffer = require( 'buffer' ).Buffer;

var temp = new DataView( new ArrayBuffer( 8 ) );

// OVERALL Coordinate Size Limits used in COMMON.C MSG_*BitCoord() Routines
// (and someday the HUD).
const COORD_INTEGER_BITS = 14;
const COORD_FRACTIONAL_BITS = 5;
const COORD_DENOMINATOR = ( 1 << COORD_FRACTIONAL_BITS );
const COORD_RESOLUTION = ( 1.0 / COORD_DENOMINATOR );

// Special threshold for networking multiplayer origins.
const COORD_INTEGER_BITS_MP = 11;
const COORD_FRACTIONAL_BITS_MP_LOWPRECISION = 3;
const COORD_DENOMINATOR_LOWPRECISION = ( 1 << COORD_FRACTIONAL_BITS_MP_LOWPRECISION );
const COORD_RESOLUTION_LOWPRECISION = ( 1.0 / COORD_DENOMINATOR_LOWPRECISION );

const NORMAL_FRACTIONAL_BITS = 11;
const NORMAL_DENOMINATOR = ( ( 1 << NORMAL_FRACTIONAL_BITS ) - 1 );
const NORMAL_RESOLUTION = ( 1.0 / NORMAL_DENOMINATOR );

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

  readBool() { return !!this.readUInt8(); }

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
    var end = false;
    var ch;
    for ( var i = 0; i < length; i++ ) {
      ch = this.readUInt8();
      if ( !ch ) {
        end = true;
      }

      if ( !end ) {
        array.push( ch );
      }
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

  readUBitVar() {
    var ret = this.readUBits( 6 );
    switch ( ret & ( 16 | 32 ) ) {
      case 16:
        ret = ( ret & 15 ) | ( this.readBits( 4 ) << 4 );
        break;

      case 32:
        ret = ( ret & 15 ) | ( this.readBits( 8 ) << 4 );
        break;

      case 48:
        ret = ( ret & 15 ) | ( this.readBits( 32 - 4 ) << 4 );
        break;
    }

    return ret;
  }

  readBitCoord() {
    var value = 0;

    var intValue = 0;
    var fractValue = 0;
    var signBit = 0;

    // Read the required integer and fraction flags.
    intValue = this.readBit();
    fractValue = this.readBit();

    // If we got either parse them, otherwise it's a zero.
    if ( intValue || fractValue ) {
      // Read the sign bit.
      signBit = this.readBit();

      // If there's an integer, read it in.
      if ( intValue ) {
        // Adjust the integers from [0..MAX_COORD_VALUE - 1] to [1..MAX_COORD_VALUE].
        intValue = this.readUBits( COORD_INTEGER_BITS ) + 1;
      }

      // If there's a fraction, read it in.
      if ( fractValue ) {
        fractValue = this.readUBits( COORD_FRACTIONAL_BITS );
      }

      // Calculate the correct floating-point value.
      value = intValue + fractValue * COORD_RESOLUTION;

      // Fix-up the sign if negative.
      if ( signBit ) {
        value = -value;
      }
    }

    return value;
  }

  readBitCoordMP( coordType ) {
    var integral = coordType === BitCoordType.Integral;
    var lowPrecision = coordType === BitCoordType.LowPrecision;

    var value = 0;

    var intValue = 0;
    var fractValue = 0;
    var signBit = 0;

    var inBounds = !!this.readBit();

    if ( integral ) {
      // Read the required integer and fraction flags.
      intValue = this.readBit();

      // If we got either parse them, otherwise it's a zero.
      if ( intValue ) {
        // Read the sign bit.
        signBit = this.readBit();

        // If there's an integer, read it in.
        // Adjust the integers from [0..MAX_COORD_VALUE - 1] to [1..MAX_COORD_VALUE].
        if ( inBounds ) {
          value = this.readUBits( COORD_INTEGER_BITS_MP ) + 1;
        } else {
          value = this.readUBits( COORD_INTEGER_BITS ) + 1;
        }
      }
    } else {
      // Read the required integer and fraction flags.
      intValue = this.readBit();

      // Read the sign bit.
      signBit = this.readBit();

      // If we got either parse them, otherwise it's a zero.
      if ( intValue ) {
        if ( inBounds ) {
          intValue = this.readUBits( COORD_INTEGER_BITS_MP ) + 1;
        } else {
          intValue = this.readUBits( COORD_INTEGER_BITS ) + 1;
        }
      }

      // If there's a fraction, read it in.
      fractValue = this.readUBits( lowPrecision ? COORD_FRACTIONAL_BITS_MP_LOWPRECISION : COORD_FRACTIONAL_BITS );

      // Calculate the correct floating point value.
      value = intValue + ( fractValue * ( lowPrecision ? COORD_RESOLUTION_LOWPRECISION : COORD_RESOLUTION ) );
    }

    // Fix-up the sign if negative.
    if ( signBit ) {
      value = -value;
    }

    return value;
  }

  readBitCellCoord( bits, coordType ) {
    var integral = coordType === BitCoordType.Integral;
    var lowPrecision = coordType === BitCoordType.LowPrecision;

    var value = 0;

    var intValue = 0;
    var fractValue = 0;

    if ( integral ) {
      value = this.readUBits( bits );
    } else {
      intValue = this.readUBits( bits );

      // If there's a fraction, read it in.
      fractValue = this.readUBits( lowPrecision ? COORD_RESOLUTION_LOWPRECISION : COORD_RESOLUTION );

      // Calculate the correct floating point value.
      value = intValue + ( fractValue * ( lowPrecision ? COORD_RESOLUTION_LOWPRECISION : COORD_RESOLUTION ) );
    }

    return value;
  }

  readBitNormal() {
    // Read the sign bit.
    var signBit = this.readBit();

    // Read the fractional part.
    var fractValue = this.readUBits( NORMAL_FRACTIONAL_BITS );

    // Calculate the correct floating point value.
    var value = fractValue * NORMAL_RESOLUTION;

    // Fix-up the sign if negative.
    if ( signBit ) {
      value = -value;
    }

    return value;
  }

  readBitFloat() { return this.readFloat(); }
}
