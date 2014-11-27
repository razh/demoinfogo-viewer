export default class BufferReader {
  constructor( buffer ) {
    this.buffer = buffer;
    this.offset = 0;
    this.length = buffer.length;
  }

  // Default to little-endian.
  readUInt8() {
    var value = this.buffer.readUInt8( this.offset );
    this.offset++;
    return value;
  }

  readChar() { return this.readUInt8(); }

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
}
