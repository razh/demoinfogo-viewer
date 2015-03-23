export class PlayerTick {
  constructor( {
    name = '',
    x = 0,
    y = 0,
    z = 0,
    pitch = 0,
    yaw = 0
  } = {} ) {
    this.name = name;

    this.x = x;
    this.y = y;
    this.z = z;

    this.pitch = pitch;
    this.yaw = yaw;
  }
}

export default class PlayerTicks {
  constructor( offset = 0 ) {
    this.ticks = [];
    this.offset = offset;
    this.tick = 0;
  }

  push( player ) {
    const index = this.tick - this.offset;
    this.ticks[ index ].push( new PlayerTick( player ) );
  }
}
