import {tiny} from "./tiny-graphics.js";
import {math} from "./tiny-graphics-math.js";
import {defs} from "./examples/common.js";
// Pull these names into this module's scope for convenience:
const { vec3, vec4, color, hex_color, Mat4, Shape, Material, Shader, Texture, Component } = tiny;

const spls = {};

export {spls};

const material_white = { shader: new defs.Phong_Shader(), ambient: 1, color: color(1,1,1,1) };

/*

Part 1 Example Commands:
(1)
add point  0.0 5.0 0.0   -5.0  0.0   5.0
add point  0.0 5.0 5.0    5.0  0.0   5.0
add point  5.0 5.0 5.0    5.0  0.0  -5.0
add point  5.0 5.0 0.0   -5.0  0.0  -5.0
add point  0.0 5.0 0.0   -5.0  0.0   5.0
get_arc_length

(2)
add point  0.0 4.0 0.0   -4.0  -1.0   4.0
add point  0.0 3.0 4.0    3.0  -1.0   3.0
add point  3.0 2.0 4.0    3.0  -1.0  -3.0
add point  3.0 1.0 0.0   -4.0  -1.0  -4.0
get_arc_length

Part 1 Example Load:
5
0.0 5.0 0.0   -5.0  0.0   5.0
0.0 5.0 5.0    5.0  0.0   5.0
5.0 5.0 5.0    5.0  0.0  -5.0
5.0 5.0 0.0   -5.0  0.0  -5.0
0.0 5.0 0.0   -5.0  0.0   5.0

*/

export
const Parametric_Spline = spls.Parametric_Spline =
    class Parametric_Spline extends Shape {
        constructor(n_pts, default_col = color(1,1,1,1), transform_matrix = Mat4.identity()) {
            super("position", "normal", "color", "param", "arclen");
            this.arrays.color.indexed = false;
            for (let i = 0; i < n_pts; i++) {
                this.arrays.param.push(i/(n_pts-1));
                this.arrays.position.push(vec3(0,0,0));
                this.arrays.normal.push(vec3(0,0,0));
                this.arrays.color.push(default_col);
                this.arrays.arclen.push(0);
            }
            this.need_update = false;
            this.need_graphics_sync = false;
            this.default_col = default_col;
            this.transform_matrix = transform_matrix;
        }

        curve_func(t) { return vec3(0,0,0); } // to be implemented by subclasses
        color_func(t) { return color(1,1,1,1); } // to be implemented by subclasses

        curr_pos(t) {
            return this.transform_matrix.times(this.curve_func(t).to4(true)).to3();
        }

        update_pts() {
            if (this.need_update) {
                for (let i = 0; i < this.arrays.position.length; i++) {
                    let t = i/(this.arrays.position.length-1);
                    this.arrays.param[i] = t;
                    this.arrays.position[i] = this.arrays.normal[i] = this.curve_func(t);
                    this.arrays.color[i] = this.color_func(t);
                    if (i === 0) {
                        this.arrays.arclen[i] = 0;
                    } else {
                        this.arrays.arclen[i] = this.arrays.arclen[i-1] +
                            this.arrays.position[i].minus(this.arrays.position[i-1]).norm();
                    }
                }
                this.need_update = false;
                this.need_graphics_sync = true;
            }
        }

        sync_card(context) {
            this.update_pts();
            if (this.need_graphics_sync) {
                this.copy_onto_graphics_card(context);
                this.need_graphics_sync = false;
            }
        }

        get_arclen(t = 1) { // get the arc length at a cetain parameter, by default the whole curve
            this.update_pts();
            let ind = this.arrays.param.findIndex((tt) => tt >= t);
            if (ind === 0) {
                return 0;
            } else if (ind === -1 || ind >= this.arrays.param.length) {
                ind = this.arrays.param.length - 1;
            }
            return this.arrays.arclen[ind-1] +
                (this.arrays.arclen[ind] - this.arrays.arclen[ind-1]) *
                (t-this.arrays.param[ind]) / (this.arrays.param[ind-1]-this.arrays.param[ind])
                ;
        }

        sync_draw( caller, uniforms, transform_matrix ) {
            this.sync_card( caller.context );
            this.draw( caller, uniforms, transform_matrix.times(this.transform_matrix), {...material_white}, "LINE_STRIP" );
        }
    }

export
const Hermite_Spline = spls.Hermite_Spline =
    class Hermite_Spline extends Parametric_Spline {
        constructor(n_pts, default_col = color(1,1,1,1), transform_matrix = Mat4.identity()) {
            super(n_pts, default_col, transform_matrix);
            this.ctrl_pts = [];
            this.ctrl_tgs = [];
            this.ctrl_col = [];
        }

        static interp_two_point(point1, point2, tangent1, tangent2, t /* parameter, between 0 and 1 */) {
            let T = math.Matrix.of(
                [t**3, t**2, t**1, t**0]
            );
            let B = math.Matrix.of(
                [0,0,0,1],
                [1,1,1,1],
                [0,0,1,0],
                [3,2,1,0]
            );
            let M = Mat4.inverse(B);
            let G = math.Matrix.of(
                point1,
                point2,
                tangent1,
                tangent2
            );
            return vec3(...T.times(M).times(G)[0]);
        }

        add_ctrl_point(point, tangent, col = this.default_col) {
            this.ctrl_pts.push(point);
            this.ctrl_tgs.push(tangent);
            this.ctrl_col.push(col);
            this.need_update = true;
        }

        delete_ctrl_point(index) {
            if (index < this.ctrl_pts.length) {
                this.ctrl_pts.splice(index, 1);
                this.ctrl_tgs.splice(index, 1);
                this.ctrl_col.splice(index, 1);
                this.need_update = true;
            }
        }

        change_ctrl_point(index, point) {
            if (index < this.ctrl_pts.length) {
                this.ctrl_pts[index] = point;
                this.need_update = true;
            }
        }

        change_ctrl_tangent(index, tangent) {
            if (index < this.ctrl_tgs.length) {
                this.ctrl_tgs[index] = tangent;
                this.need_update = true;
            }
        }

        catmull_ctrl_points(pts) {
            // set points according to Catmull-Rom rule
            this.ctrl_pts = [];
            this.ctrl_tgs = [];
            for (let i = 0; i < pts.length; i++) {
                let x_prev = vec3(...pts[Math.max(i-1, 0)]);
                let x_curr = vec3(...pts[i]);
                let x_next = vec3(...pts[Math.min(i+1, pts.length-1)]);
                this.ctrl_pts.push([...x_curr]);
                this.ctrl_tgs.push([...x_next.minus(x_prev).times(1/2)]);
            }
            this.ctrl_col = pts.map((x, i) => hex_color("#FFFFFF"));
            this.need_update = true;
        }

        clear_ctrl() {
            this.ctrl_pts = [];
            this.ctrl_tgs = [];
            this.ctrl_col = [];
            this.need_update = true;
        }

        curve_func(t) {
            if (
                this.ctrl_pts.length < 2 // not enough points
                || (t < 0 || t > 1) // not valid parameter
            ) {
                return vec3(0,0,0); // return origin to avoid drawing curves
            }
            let n = Math.min(this.ctrl_pts.length - 2, Math.floor(t * (this.ctrl_pts.length - 1)));
            let tt = t * (this.ctrl_pts.length - 1) - n;
            return Hermite_Spline.interp_two_point(this.ctrl_pts[n], this.ctrl_pts[n+1], this.ctrl_tgs[n], this.ctrl_tgs[n+1], tt);
        }

        color_func(t) {
            if (this.ctrl_col.length < 2) {
                // not enough points, return white by default
                return this.default_col;
            }
            let n = Math.ceil(t * (this.ctrl_col.length - 1));
            return this.ctrl_col[n];
        }
    }