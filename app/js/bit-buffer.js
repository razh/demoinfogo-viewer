export const BitCoordType = {
  None: 0,
  LowPrecision: 1,
  Integral: 2
};

// Little endian.
export const bitbuf = {
  // ZigZag Transform:  Encodes signed integers so that they can be
  // effectively used with varint encoding.
  //
  // varint operates on unsigned integers, encoding smaller numbers into
  // fewer bytes.  If you try to use it on a signed integer, it will treat
  // this number as a very large unsigned integer, which means that even
  // small signed numbers like -1 will take the maximum number of bytes
  // (10) to encode.  ZigZagEncode() maps signed integers to unsigned
  // in such a way that those with a small absolute value will have smaller
  // encoded values, making them appropriate for encoding using varint.
  //
  //       int32 ->     uint32
  // -------------------------
  //           0 ->          0
  //          -1 ->          1
  //           1 ->          2
  //          -2 ->          3
  //         ... ->        ...
  //  2147483647 -> 4294967294
  // -2147483648 -> 4294967295
  //
  //        >> encode >>
  //        << decode <<
  zigZagEncode32( n ) {
    // Note: the right-shift must be arithmetic.
    return ( n << 1 ) ^ ( n >> 31 );
  },

  zigZagDecode32( n ) {
    return ( n >> 1 ) ^ -( n & 1 );
  },

  // Requires big numbers (bn.js).
  zigZagEncode64( n ) {
    // Note the right-shift must be arithmetic.
    // return ( n << 1 ) ^ ( n >> 63 );
    return n.shln( 1 ).xor( n.shrn( 63 ) );
  },

  // Requires big numbers (bn.js).
  zigZagDecode64( n ) {
    // return ( n >> 1 ) ^ -( n & 1 );
    // Note: .andln() will be replaced with .andn() some time in the future.
    return n.shrn( 1 ).xor( n.andln( 1 ).neg() );
  },

  kMaxVarintBytes: 10,
  kMaxVarint32Bytes: 5
};
