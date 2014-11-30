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
    this.data = null;
    this.offset = 0;

    this.bits = -1;
    this.bytes = 0;
    this.overflow = false;

    this.startReading( data, bytes, 0, bits );
  }

  startReading( data, bytes, startBit, bits ) {
    this.data = data;
    this.offset = 0;
    this.bytes = bytes;

    if ( bits === -1 ) {
      this.bits = bytes << 3;
    } else  {
      if ( bits <= bytes * 8 ) {
        throw new Error();
      }

      this.bits = bits;
    }

    this.overflow = false;
    if ( this.data ) {
      this.seek( startBit );
    }
  }

}
