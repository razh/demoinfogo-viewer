// Property decoding.
export const SendPropType = {
  DPT_Int: 0,
  DPT_Float: 1,
  DPT_Vector: 2,
  // Only encodes the XY of a vector, ignores Z.
  DPT_VectorXY: 3,
  DPT_String: 4,
  // An array of the base types (can't be of datatables).
  DPT_Array: 5,
  DPT_DataTable: 6,
  DPT_Int64: 7,
  DPT_NUMSendPropTypes: 8
};

export const SPROP = {
  // Unsigned integer data.
  UNSIGNED: ( 1 << 0 ),
  // If this is set, the float/vector is treated like a world coordinate.
  // Note that the bit count is ignored in this case.
  COORD: ( 1 << 1 ),
  // For floating point, don't scale into range, just take value as is.
  NOSCALE: ( 1 << 2 ),
  // For floating point, limit high value to range minus one bit unit.
  ROUNDDOWN: ( 1 << 3 ),
  // For floating point, limit low value to range minus one bit unit.
  ROUNDUP: ( 1 << 4 ),
  // If this is set, the vector is treated like a normal (only valid for vectors).
  NORMAL: ( 1 << 5 ),
  // This is an exclude prop (not excludED, but it points at another prop to be excluded).
  EXCLUDE: ( 1 << 6 ),
  // Use XYZ/Exponent encoding for vectors.
  XYZE: ( 1 << 7 ),
  // This tells us that the property is inside an array, so it shouldn't be put
  // into the flattened property list. Its array will point at it when it needs to.
  INSIDEARRAY: ( 1 << 8 ),
  // Set for datatable props using one of the default datatable proxies like
  // SendProxy_DataTableToDataTable that always send the data to all clients.
  PROXY_ALWAYS_YES: ( 1 << 9 ),
  // Set automatically if SPROP_VECTORELEM is used.
  IS_A_VECTOR_ELEM: ( 1 << 10 ),
  // Set automatically if it's a datatable with an offset of 0 that doesn't
  // change the pointer (ie: for all automatically-chained base classes).
  COLLAPSIBLE: ( 1 << 11 ),
  // Like SPROP_COORD, but special handling for multiplayer games.
  COORD_MP: ( 1 << 12 ),
  // Like SPROP_COORD, but special handling for multiplayer games where the
  // fractional component only gets a 3 bits instead of 5.
  COORD_MP_LOWPRECISION: ( 1 << 13 ),
  // SPROP_COORD_MP, but coordinates are rounded to integral boundaries.
  COORD_MP_INTEGRAL: ( 1 << 14 ),
  // Like SPROP_COORD, but special encoding for cell coordinates that can't be
  // negative, bit count indicate maximum value.
  CELL_COORD: ( 1 << 15 ),
  // Like SPROP_CELL_COORD, but special handling where the fractional component
  // only gets a 3 bits instead of 5.
  CELL_COORD_LOWPRECISION: ( 1 << 16 ),
  // SPROP_CELL_COORD, but coordinates are rounded to integral boundaries.
  CELL_COORD_INTEGRAL: ( 1 << 17 ),
  // this is an often changed field, moved to head of sendtable so it gets a
  // small index.
  CHANGES_OFTEN: ( 1 << 18 ),
  // use var int encoded (google protobuf style), note you want to include
  // SPROP_UNSIGNED if needed, its more efficient.
  VARINT: ( 1 << 19 )
};

const DT_MAX_STRING_BITS = 9;
// Maximum length of a string that can be sent.
const DT_MAX_STRING_BUFFERSIZE = ( 1 << DT_MAX_STRING_BITS );

export class Prop {
  constructor( type ) {
    this.type = type;
    this.numElements = 0;
    this.value = 0;
  }

  print( maxElements ) {
    var output = '';
    if ( maxElements > 0 ) {
      output = ' Element: ' +
        ( maxElements ? maxElements : this.numElements ) -
        this.numElements;
    }

    switch ( this.type ) {
      case SendPropType.DPT_Int:
      case SendPropType.DPT_Float:
      case SendPropType.DPT_String:
      case SendPropType.DPT_Int64:
        output += this.value;
        break;

      case SendPropType.DPT_Vector:
        output += this.value.x + ', ' + this.value.y + ', ' + this.value.z;
        break;

      case SendPropType.DPT_VectorXY:
        output += this.value.x + ', ' + this.value.y;
        break;

      case SendPropType.DPT_Array:
      case SendPropType.DPT_DataTable:
        break;

      default:
        break;
    }

    console.log( output );

    if ( this.numElements > 1 ) {
      this[ 1 ].print( maxElements ? maxElements : this.numElements );
    }
  }
}

function intDecode( entityBitBuffer, sendProp ) {
  var flags = sendProp.flags;

  if ( flags & SPROP.VARINT ) {
    if ( flags & SPROP.UNSIGNED ) {
      return entityBitBuffer.readVarInt32();
    } else {
      return entityBitBuffer.readSignedVarInt32();
    }
  } else {
    if ( flags & SPROP.UNSIGNED ) {
      return entityBitBuffer.readUBits( sendProp.num_bits );
    } else {
      return entityBitBuffer.readBits( sendProp.num_bits );
    }
  }
}

function floatDecode() {}

function vectorDecode( entityBitBuffer, sendProp ) {
  var v = {
    x: floatDecode( entityBitBuffer, sendProp ),
    y: floatDecode( entityBitBuffer, sendProp ),
    z: 0
  };

  var signBit;
  var distanceSquared;
  // Don't read in the third component for normals.
  if ( ( sendProp.flags & SPROP.NORMAL ) === 0 ) {
    v.z = floatDecode( entityBitBuffer, sendProp );
  } else {
    signBit = entityBitBuffer.readBit();

    distanceSquared = v.x * v.x + v.y * v.y;
    if ( distanceSquared < 1 ) {
      v.z = Math.sqrt( 1 - distanceSquared );
    } else {
      v.z = 0;
    }
  }

  return v;
}

function vectorXYDecode( entityBitBuffer, sendProp ) {
  return {
    x: floatDecode( entityBitBuffer, sendProp ),
    y: floatDecode( entityBitBuffer, sendProp )
  };
}

function stringDecode( entityBitBuffer, sendProp ) {
  // Read it in.
  var length = entityBitBuffer.readUBits( DT_MAX_STRING_BITS );

  if ( length >= DT_MAX_STRING_BUFFERSIZE ) {
    console.log(
      'String Decode( ' + sendProp.var_name +
      ' ) invalid length (' + length + ')'
    );
  }

  return entityBitBuffer.readString( length );
}

function arrayDecode() {}
function int64Decode() {}

export function decodeProp(
  entityBitBuffer,
  flattenedProp,
  classIndex,
  fieldIndex,
  quiet
) {
  var sendProp = flattenedProp.prop;

  var result;
  if ( result.type !== SendPropType.DPT_Array &&
       result.type !== SendPropType.DPT_DataTable ) {
    result = new Prop( sendProp.type );
  }

  var output;
  if ( !quiet ) {
    output = 'Field: ' + fieldIndex + ', ' + sendProp.var_name + ' = ';
  }

  switch ( sendProp.type ) {
    case SendPropType.DPT_Int:
      result.value = intDecode( entityBitBuffer, sendProp );
      break;

    case SendPropType.DPT_Float:
      result.value = floatDecode( entityBitBuffer, sendProp );
      break;

    case SendPropType.DPT_Vector:
      result.value = vectorDecode( entityBitBuffer, sendProp );
      break;

    case SendPropType.DPT_VectorXY:
      result.value = vectorXYDecode( entityBitBuffer, sendProp );
      break;

    case SendPropType.DPT_String:
      result.value = stringDecode( entityBitBuffer, sendProp );
      break;

    case SendPropType.DPT_Array:
      result = arrayDecode(
        entityBitBuffer,
        flattenedProp,
        sendProp.num_elements,
        classIndex,
        fieldIndex,
        quiet
      );
      break;

    case SendPropType.DPT_DataTable:
      break;

    case SendPropType.DPT_Int64:
      result.value = int64Decode( entityBitBuffer, sendProp );
      break;
  }

  if ( !quiet ) {
    result.print();
  }

  return result;
}
