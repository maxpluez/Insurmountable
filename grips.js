import {tiny, defs} from './examples/common.js';

// Pull these names into this module's scope for convenience:
const { vec3, vec4, color, hex_color, Mat4, Shape, Material, Shader, Texture, Component } = tiny;

export const grips = {};

const ball = new defs.Subdivision_Sphere( 5 );
const material_grip = { shader: new defs.Phong_Shader(), ambient: .2, diffusivity: 1, specularity: .5, color: color( .9,.5,.9,1 ) };

const Grip = grips.Grip = class Grip {
    constructor(spline, t, omega) {
        this.spline = spline;
        this.t = t;
        this.omega = omega;
        this.shape = ball;
        this.grabable = true;
        this.color = hex_color("#ee9494");
    }

    position() {
        return this.spline.curr_pos( (Math.sin(this.omega * this.t) + 1) / 2);
    }
};

const Grips = grips.Grips = class Grips extends Array {
    constructor(height = 0) {
        super();
        this.height = height;
    }

    add_grip(spline, init_t, omega) {
        let grip = new Grip(spline, init_t, omega);
        this.push(grip);
    }

    remove_grip(ind) {
        if (ind < this.length) {
            this.splice(ind, 1);
        }
    }

    update(dh, dt) {
        let counter = 0;
        this.height += dh;
        for (let i = this.length-1; i >= 0; i--) {
            this[i].t += dt * this[i].omega;
            if (this[i].position()[1] < this.height - 20 /* TODO: so does here: change to some calculated value */) {
                if (this[i].grabable) counter++;
                this.remove_grip(i);
            }
        }
        return counter;
    }

    position_list() {
        let pos_list = [];
        for (let grip of this) {
            pos_list.push(Mat4.translation(0, -this.height, 0).times(grip.position().to4(true)).to3());
        }
        return pos_list;
    }

    find_closest(pos) {
        let pos_list = this.position_list();
        let min_dist = -1;
        let closest_grip = null;
        for (let grip of this) {
            let grip_pos = Mat4.translation(0, -this.height, 0).times(grip.position().to4(true)).to3();
            let dist = vec3(...pos).minus(vec3(...grip_pos)).norm();
            if (min_dist < 0 || dist < min_dist) {
                min_dist = dist;
                closest_grip = grip;
            }
        }
        const position = closest_grip.position();
        position[1] -= this.height;
        return { grip: closest_grip, position: position, min_dist: min_dist };
    }

    draw( caller, uniforms ) {
        for (let grip of this) {
            grip.shape.draw( caller, uniforms, Mat4.translation(0, -this.height, 0)
                                            .times(Mat4.translation(...grip.position()))
                                            .times(Mat4.scale(0.3, 0.3, 0.3))
                , {...material_grip, color: grip.color});
            grip.spline.sync_draw( caller, uniforms, Mat4.translation(0, -this.height, 0) );
        }
    }
}