export const bitbuf = {
  kMaxVarintBytes: 10,
  kMaxVarint32Bytes: 5
};

export const maskTable = [
  0,
  ( 1 << 1 ) - 1,
  ( 1 << 2 ) - 1,
  ( 1 << 3 ) - 1,
  ( 1 << 4 ) - 1,
  ( 1 << 5 ) - 1,
  ( 1 << 6 ) - 1,
  ( 1 << 7 ) - 1,
  ( 1 << 8 ) - 1,
  ( 1 << 9 ) - 1,
  ( 1 << 10 ) - 1,
  ( 1 << 11 ) - 1,
  ( 1 << 12 ) - 1,
  ( 1 << 13 ) - 1,
  ( 1 << 14 ) - 1,
  ( 1 << 15 ) - 1,
  ( 1 << 16 ) - 1,
  ( 1 << 17 ) - 1,
  ( 1 << 18 ) - 1,
  ( 1 << 19 ) - 1,
  ( 1 << 20 ) - 1,
  ( 1 << 21 ) - 1,
  ( 1 << 22 ) - 1,
  ( 1 << 23 ) - 1,
  ( 1 << 24 ) - 1,
  ( 1 << 25 ) - 1,
  ( 1 << 26 ) - 1,
  ( 1 << 27 ) - 1,
  ( 1 << 28 ) - 1,
  ( 1 << 29 ) - 1,
  ( 1 << 30 ) - 1,
  0x7fffffff,
  0xffffffff
];

export default class BitBuffer {
  constructor( data, bytes, bits = -1 ) {
    this.inBufWord = 0;
    this.bitsAvail = 0;

    this.data = null;
    this.offset = 0;

    this.overflow = false;
    this.dataBits = -1;
    this.dataBytes = 0;

    this.startReading( data, bytes, 0, bits );
  }

  startReading( data, bytes, startBit = 0, bits = -1 ) {
    this.data = data;
    this.offset = 0;
    this.dataBytes = bytes;

    if ( bits === -1 ) {
      this.dataBits = bytes << 3;
    } else {
      if ( bits <= bytes * 8 ) {
        throw new Error();
      }

      this.dataBits = bits;
    }

    this.overflow = false;
    if ( this.data ) {
      this.seek( startBit );
    }
  }

  seek( position ) {
    var success = true;
    if ( 0 > position || position > this.dataBits ) {
      this.overflow = true;
      success = false;
      position = this.dataBits;
    }

    // Non-multiple-of-4 bytes at head of buffer. We put the "round off"
    // at the head to make reading and detecting the end efficient.
    var head = this.dataBytes & 3;

    var byteOffset = position / 8;
    if ( this.dataBytes < 4 || ( head && byteOffset < head ) ) {
      // Partial first dword.
      if ( this.data ) {
        this.inBufWord = this.offset++;

        if ( head > 1 ) {
          this.inBufWord |= ( this.offset++ ) << 8;
        }

        if ( head > 2 ) {
          this.inBufWord |= ( this.offset++ ) << 16;
        }

        this.inBufWord >>= ( position & 31 );
        this.bitsAvail = ( head << 3 ) - ( position & 31 );
      }
    } else {
      var adjPosition = position - ( head << 3 );
      this.offset += ( adjPosition / 32 ) << 2 + head;
      if ( this.data ) {
        this.bitsAvail = 32;
        this.grabNextDWord();
      } else {
        this.inBufWord = 0;
        this.bitsAvail = 1;
      }

      this.inBufWord >>= ( adjPosition  & 31 );
      // In case grabNextDWord overflowed.
      this.bitsAvail = Math.min( this.bitsAvail, 32 - ( adjPosition & 31 ) );
    }

    return success;
  }
}
