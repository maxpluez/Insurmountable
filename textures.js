import {tiny, defs} from './examples/common.js';

const { vec3, vec4, color, hex_color, Mat4, Light, Shape, Material, Shader, Texture, Scene } = tiny;
const txts = {};

export {txts};

const Texture_Wall = txts.Texture_Wall =
class Texture_Wall extends defs.Textured_Phong {
    constructor() {
        super();
    }
    fragment_glsl_code() {
        return this.shared_glsl_code() + `
        varying vec2 f_tex_coord;
        uniform sampler2D texture;
        uniform float scene_height;
        uniform float wall_height;
        uniform float wall_width;
        
        void main(){
            // Sample the texture image in the correct place:
            
            vec2 f_tex_coord_new = f_tex_coord;
            f_tex_coord_new.y *= (wall_height / wall_width);
            f_tex_coord_new.y += mod(scene_height / wall_width, 1.);
            
            vec4 tex_color = texture2D( texture, f_tex_coord_new);
            if( tex_color.w < .01 ) discard;
                                                                     // Compute an initial (ambient) color:
            gl_FragColor = vec4( ( tex_color.xyz + shape_color.xyz ) * ambient, shape_color.w * tex_color.w ); 
                                                                     // Compute the final color with contributions from lights:
            gl_FragColor.xyz += phong_model_lights( normalize( N ), vertex_worldspace );
    } `;
    }

    update_GPU(context, gpu_addresses, uniforms, model_transform, material) {
        super.update_GPU(context, gpu_addresses, uniforms, model_transform, material);
        context.uniform1f(gpu_addresses.scene_height, uniforms.scene_height);
        context.uniform1f(gpu_addresses.wall_height, uniforms.wall_height);
        context.uniform1f(gpu_addresses.wall_width, uniforms.wall_width);
    }
}