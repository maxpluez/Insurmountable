


import {tiny, defs} from './examples/common.js';
const {Vector, Vector3, vec, Matrix, vec3, vec4, color, hex_color, Mat4, Shape, Material, Shader, Texture, Component } = tiny;

export
class Skybox
{
    constructor() {
        this.up = new defs.Square();
        this.down = new defs.Square();
        this.fwd = new defs.Square();
        this.bwd = new defs.Square();
        this.right = new defs.Square();
        this.left = new defs.Square();

        this.up.arrays.position = Vector3.cast ([1,1,1],[1,1,-1],[-1,1,-1],[-1,1,1]);
        this.down.arrays.position = Vector3.cast ([1,-1,1],[1,-1,-1],[-1,-1,-1],[-1,-1,1]);
        this.fwd.arrays.position = Vector3.cast ([1,-1,-1],[1,1,-1],[-1,1,-1],[-1,-1,-1]);
        this.bwd.arrays.position = Vector3.cast ([1,-1,1],[1,1,1],[-1,1,1],[-1,-1,1]);
        this.right.arrays.position = Vector3.cast ([1,1,-1],[1,1,1],[1,-1,1],[1,-1,-1]);
        this.left.arrays.position = Vector3.cast ([-1,1,-1],[-1,1,1],[-1,-1,1],[-1,-1,-1]);

        this.up.arrays.texture_coord = Vector.cast ([1, 0], [1, 1], [0, 1], [0, 0]);
        this.down.arrays.texture_coord = Vector.cast ([1, 0], [1, 1], [0, 1], [0, 0]);
        this.fwd.arrays.texture_coord = Vector.cast ([1, 0], [1, 1], [0, 1], [0, 0]);
        this.bwd.arrays.texture_coord = Vector.cast ([1, 0], [1, 1], [0, 1], [0, 0]);
        this.right.arrays.texture_coord = Vector.cast ([1, 0], [1, 1], [0, 1], [0, 0]);
        this.left.arrays.texture_coord = Vector.cast ([1, 0], [1, 1], [0, 1], [0, 0]);

        this.up.indices = [0,1,2,2,3,0];
        this.down.indices = [0,1,2,2,3,0];
        this.fwd.indices = [0,1,2,2,3,0];
        this.bwd.indices = [0,1,2,2,3,0];
        this.right.indices = [0,1,2,2,3,0];
        this.left.indices = [0,1,2,2,3,0];

        const texture = new defs.Textured_Phong( 1 );
        this.up_mat = { shader: texture, ambient: 1, diffusivity: 0, specularity: 0, texture: new Texture( "assets/top.png" ) };
        this.down_mat = { shader: texture, ambient: 1, diffusivity: 0, specularity: 0, texture: new Texture( "assets/bottom.png" ) };
        this.fwd_mat = { shader: texture, ambient: 1, diffusivity: 0, specularity: 0, texture: new Texture( "assets/front.png" ) };
        this.bwd_mat = { shader: texture, ambient: 1, diffusivity: 0, specularity: 0, texture: new Texture( "assets/back.png" ) };
        this.right_mat = { shader: texture, ambient: 1, diffusivity: 0, specularity: 0, texture: new Texture( "assets/left.png" ) };
        this.left_mat = { shader: texture, ambient: 1, diffusivity: 0, specularity: 0, texture: new Texture( "assets/right.png" ) };
    }

    display(caller, uniforms, scale) {
        const scale_mat = Mat4.scale_uniform(scale);
        this.up.draw(caller, uniforms, scale_mat, this.up_mat);
        this.down.draw(caller, uniforms, scale_mat, this.down_mat);
        this.fwd.draw(caller, uniforms, scale_mat, this.fwd_mat);
        this.bwd.draw(caller, uniforms, scale_mat, this.bwd_mat);
        this.right.draw(caller, uniforms, scale_mat, this.right_mat);
        this.left.draw(caller, uniforms, scale_mat, this.left_mat);
    }
}




