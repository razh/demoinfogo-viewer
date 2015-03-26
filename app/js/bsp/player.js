import THREE from 'three';

export default class Player {
  constructor( playerTicks, id ) {
    this.geometry = new THREE.Geometry();

    const { ticks, start } = playerTicks;

    for ( let i = start, il = ticks.length - start; i < il; i++ ) {
      const tick = ticks[i];
      if ( !tick ) {
        continue;
      }

      for ( let j = 0, jl = tick.length; j < jl; j++ ) {
        const player = tick[j];
        if ( player.id === id ) {
          this.geometry.vertices.push( new THREE.Vector3().copy( player ) );
        }
      }
    }
  }
}
