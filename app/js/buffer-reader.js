import { bitbuf } from './bit-buffer';

export default class BufferReader {
  constructor( buffer, offset = 0 ) {
    this.buffer = buffer;
    this.offset = offset;
    this.length = buffer.length;
  }

  peek( length ) {
    return this.buffer.slice( this.offset, this.offset + length );
  }

  read( length ) {
    var buffer = this.peek( length );
    this.offset += length;
    return buffer;
  }

  // Default to little-endian.
  // uint8.
  peekUInt8() {
    return this.buffer.readUInt8( this.offset );
  }

  readUInt8() {
    var value = this.peekUInt8();
    this.offset++;
    return value;
  }

  peekByte() { return this.peekUInt8(); }
  readByte() { return this.readUInt8(); }

  peekChar() { return this.peekUInt8(); }
  readChar() { return this.readUInt8(); }

  // int16.
  peekInt16() {
    return this.buffer.readInt16LE( this.offset );
  }

  readInt16() {
    var value = this.peekInt16();
    this.offset += 2;
    return value;
  }

  peekShort() { return this.peekInt16(); }
  readShort() { return this.readInt16(); }

  // uint16.
  peekUInt16() {
    return this.buffer.readUInt16LE( this.offset );
  }

  readUInt16() {
    var value = this.peekUInt16();
    this.offset += 2;
    return value;
  }

  peekWord() { return this.peekUInt16(); }
  readWord() { return this.readUInt16(); }

  // int32.
  peekInt32() {
    return this.buffer.readInt32LE( this.offset );
  }

  readInt32() {
    var value = this.peekInt32();
    this.offset += 4;
    return value;
  }

  //  uint32.
  peekUInt32() {
    return this.buffer.readUInt32LE( this.offset );
  }

  readUInt32() {
    var value = this.peekUInt32();
    this.offset += 4;
    return value;
  }

  // float.
  peekFloat() {
    return this.buffer.readFloatLE( this.offset );
  }

  readFloat() {
    var value = this.peekFloat();
    this.offset += 4;
    return value;
  }

  readString( length, encoding = 'ascii' ) {
    var value = this.buffer.toString(
      encoding,
      this.offset,
      this.offset + length
    );
    this.offset += length;
    return value;
  }

  readCString( length ) {
    var array = [];
    var ch;
    for ( var i = 0; i < length; i++ ) {
      ch = this.buffer[ this.offset + i ];
      if ( !ch ) {
        break;
      }

      array.push( ch );
    }

    // Add string length and one NULL character.
    this.offset += i + 1;
    return String.fromCharCode( ...array );
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
  readVarInt32() {
    var result = 0;
    var count = 0;
    var b;

    do {
      if ( count === bitbuf.kMaxVarint32Bytes ) {
        return result;
      }

      b = this.readUInt8();
      result |= ( b & 0x7F ) << ( 7 * count );
      count++;
    } while ( b & 0x80 );

    return result;
  }

  readSignedVarInt32() {
    return bitbuf.zigZagDecode32( this.readVarInt32() );
  }
}
