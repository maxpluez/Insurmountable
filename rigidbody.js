import {defs, tiny} from './examples/common.js';

const {Vector, Vector3, vec, Matrix, vec3, vec4, color, hex_color, Mat4, Mat3, Shape, Material, Shader, Texture, Component } = tiny;

export
class Rigidbody
{
    constructor() {
        this.shape = new defs.Cube();
        this.scale = Mat4.identity();

        this.g = vec3(0, -9.81, 0);

        this.m = 1;
        this.I_body = Mat3.identity();
        this.I_body_inv = Mat3.identity();

        this.x = vec3(0,0,0); //position
        this.R = Mat3.identity(); //rotation
        this.p = vec3(0,0,0); //linear momentum
        this.r = vec3(0,0,0); //angular momentun

        this.f = vec3(0,0,0); //external force (applied on center of mass)
        this.tau = vec3(0,0,0); //external torque (pivot on center of mass)
    }

    static cube_inertia(m, scale) {
        let x = scale[0]*2;
        let y = scale[1]*2;
        let z = scale[2]*2;
        return Matrix.of(
            [y*y+z*z, 0, 0],
            [0, x*x+z*z, 0],
            [0,0,x*x+y*y]
        ).times(m/12);
    }

    //set a callback function which will be automatically called when the rigidbody hit the ground
    set_on_hit_ground_callback(func) {
        this.hit_ground_callback = func;
    }

    get_transform() {
        let T = Mat4.translation(this.x[0], this.x[1], this.x[2]);
        let R = Mat3.rot_to_mat4(this.R);
        let S = this.scale;
        return (T.times(R)).times(S);
    }

    draw(caller, uniforms, material) {
        this.shape.draw( caller, uniforms, this.get_transform(), material);
    }

    set_property(shape, m, I_body, scale, g) {
        this.shape = shape;
        this.m = m;
        this.I_body = I_body;
        this.I_body_inv = Matrix.of(
            [1/I_body[0][0], 0, 0],
            [0, 1/I_body[1][1], 0],
            [0, 0, 1/I_body[2][2]]
        )
        this.scale = Mat4.scale(scale[0], scale[1], scale[2]);
        this.g = vec3(0,g,0);
    }

    set_initial_condition(pos, rot, linear_vel, angular_vel) {
        this.x = pos;
        this.R = rot;
        this.p = linear_vel.times(this.m);
        let mul = this.get_current_I().times(angular_vel)
        this.r = vec3(mul[0], mul[1], mul[2]);
    }

    get_current_I() {
        return ((this.R).times(this.I_body)).times(this.R.transposed());
    }

    get_current_I_inv() {
        return ((this.R.transposed()).times(this.I_body_inv)).times(this.R);
    }

    derivative() {

        let x_d = this.p.times(1/this.m);

        let w = this.get_current_I_inv().times(this.r, vec3(0,0,0));
        let W = Mat3.skew_symmetric(w);
        let R_d = this.R.times(W);

        let p_d = this.f.plus(this.g);
        let r_d = this.tau;
        return [x_d, R_d, p_d, r_d];
    }

    //forward euler
    update(dt) {
        let ds = this.derivative();
        this.x = this.x.plus(ds[0].times(dt));
        //console.log(this.x);
        this.R = this.R.plus(ds[1].times(dt)); this.R = Mat3.project_to_rot(this.R);
        //console.log(this.R);
        this.p = this.p.plus(ds[2].times(dt));
        this.r = this.r.plus(ds[3].times(dt));

        if(this.x[1] < 0 && this.hit_ground_callback)
        {
            this.hit_ground_callback();
        }
    }
}




