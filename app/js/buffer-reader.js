export const bitbuf = {
  kMaxVarintBytes: 10,
  kMaxVarint32Bytes: 5
};

export default class BufferReader {
  constructor( buffer ) {
    this.buffer = buffer;
    this.offset = 0;
    this.length = buffer.length;
  }

  read( length ) {
    var buffer = this.buffer.slice( this.offset, this.offset + length );
    this.offset += length;
    return buffer;
  }

  // Default to little-endian.
  readUInt8() {
    var value = this.buffer.readUInt8( this.offset );
    this.offset++;
    return value;
  }

  readByte() { return this.readUInt8(); }
  readChar() { return this.readUInt8(); }

  readInt16() {
    var value = this.buffer.readInt16LE( this.offset );
    this.offset += 2;
    return value;
  }

  readShort() { return this.readInt16(); }

  readInt32() {
    var value = this.buffer.readInt32LE( this.offset );
    this.offset += 4;
    return value;
  }

  readFloat() {
    var value = this.buffer.readFloatLE( this.offset );
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
      result = result | ( b & 0x7F ) << ( 7 * count );
      count++;
    } while ( b & 0x80 );

    return result;
  }
}
