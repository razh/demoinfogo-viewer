import _ from 'lodash';

export class Vector {
  constructor( x = 0, y = 0, z = 0 ) {
    this.x = x;
    this.y = y;
    this.z = z;
  }

  read( reader ) {
    this.x = reader.readFloat();
    this.y = reader.readFloat();
    this.z = reader.readFloat();
    return this;
  }

  static read( reader ) {
    return new Vector().read( reader );
  }
}

export class QAngle extends Vector {
  static read( reader ) {
    return new QAngle().read( reader );
  }
}

export const FDEMO_NORMAL = 0;
export const FDEMO_USE_ORIGIN2 = ( 1 << 0 );
export const FDEMO_USE_ANGLES2 = ( 1 << 1 );
export const FDEMO_NOINTERP    = ( 1 << 2 );

export class Split {
  constructor() {
    this.flags = FDEMO_NORMAL;

    // Original origin/viewangles.
    this.viewOrigin = new Vector();
    this.viewAngles = new QAngle();
    this.localViewAngles = new QAngle();

    // Resampled origin/viewangles.
    this.viewOrigin2 = new Vector();
    this.viewAngles2 = new QAngle();
    this.localViewAngles2 = new QAngle();
  }

  read( reader ) {
    this.flags = reader.readInt32();

    this.viewOrigin.read( reader );
    this.viewAngles.read( reader );
    this.localViewAngles.read( reader );

    this.viewOrigin2.read( reader );
    this.viewAngles2.read( reader );
    this.localViewAngles2.read( reader );
    return this;
  }
}

export const MAX_SPLITSCREEN_CLIENTS = 2;

export class DemoCommandInfo {
  constructor() {
    this.u = [];

    for ( var i = 0; i < MAX_SPLITSCREEN_CLIENTS; i++ ) {
      this.u.push( new Split() );
    }
  }

  read( reader ) {
    this.u.forEach( u => u.read( reader ) );
    return this;
  }

  static read( reader ) {
    return new DemoCommandInfo().read( reader );
  }
}

export class EntityEntry {
  constructor( entity, classIndex, serialNum ) {
    this.entity = entity;
    this.classIndex = classIndex;
    this.serialNum = serialNum;
    this.props = [];
  }

  findProp( name ) {
    var prop;
    for ( var i = 0, il = this.props.length; i < il; i++ ) {
      var prop = this.props[i];
      if ( prop.flattenedProp.prop.var_name === name ) {
        return prop;
      }
    }
  }

  addOrUpdateProp( flattenedProp, propValue ) {
    var prop = this.findProp( flattenedProp.prop.var_name );
    if ( prop ) {
      prop.propValue = propValue;
    } else {
      this.props.push( { flattenedProp, propValue } );
    }
  }
}

export const UpdateType = {
  // Entity came back into PVS, create new entity if one doesn't exist.
  EnterPVS: 0,
  // Entity left PVS.
  LeavePVS: 1,
  // There is a delta for this entity.
  DeltaEnt: 2,
  // Entity stays alive but no delta ( could be LOD, or just unchanged ).
  PreserveEnt: 3,
  // Finished parsing entities successfully.
  Finished: 4,
  // Parsing error occured while reading entities.
  Failed: 5,
};

// Flags for delta encoding header.
export const HeaderFlags = {
  FHDR_ZERO: 0,
  FHDR_LEAVEPVS: 1,
  FHDR_DELETE: 2,
  FHDR_ENTERPVS: 4
};
