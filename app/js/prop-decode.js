const SendPropType = {
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

function intDecode() {}
function floatDecode() {}
function vectorDecode() {}
function vectorXYDecode() {}
function stringDecode() {}
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
