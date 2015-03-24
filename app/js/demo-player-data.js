export class PlayerTick {
  constructor( {
    id = '',
    name = '',
    x = 0,
    y = 0,
    z = 0,
    pitch = 0,
    yaw = 0
  } = {} ) {
    this.id = id;
    this.name = name;

    this.x = x;
    this.y = y;
    this.z = z;

    this.pitch = pitch;
    this.yaw = yaw;
  }
}

export class PlayerTicks {
  constructor() {
    this.ticks = [];
    this.tick = 0;
  }

  push( player ) {
    const tick = this.ticks[ this.tick ] || [];
    tick.push( new PlayerTick( player ) );
    this.ticks[ this.tick ] = tick;
    return this;
  }
}
