import THREE from 'three';

export default class Player {
  constructor( ticks, id ) {
    this.vertices = [];

    for ( let i = ticks.start, il = ticks.length - ticks.start; i < il; i++ ) {
      const tick = ticks[i];

      for ( let j = 0, jl = tick.length; j < jl; j++ ) {
        const player = tick[j];
        if ( player.id === id ) {
          this.vertices.push( new THREE.Vector3().copy( player ) );
        }
      }
    }
  }
}
