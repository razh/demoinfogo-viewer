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
      prop = this.props[i];
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
