import {tiny, defs} from './examples/common.js';

// Pull these names into this module's scope for convenience:
const { vec3, vec4, color, Mat4, Shape, Material, Shader, Texture, Component } = tiny;

const shapes = {
    'sphere': new defs.Subdivision_Sphere( 5 ),
    'box': new defs.Cube()
};

export const calc_angle = (p1 /* from */, p2 /* vertex */, p3 /* to */, n = vec3(0, 0, 1)) => {
    let dot = (p1.minus(p2)).dot(p3.minus(p2));
    let mag = (p1.minus(p2)).norm()*(p3.minus(p2)).norm();
    let angle = 0;
    if (dot/mag >= 1) {
      angle = 0;
    } else if (dot/mag <= -1) {
      angle = Math.PI;
    } else {
      angle = Math.acos(dot/mag);
    }
    let det = ((p1.minus(p2)).cross(p3.minus(p2))).dot(n);
    return (det > 0) ? angle : -angle;
}

export const Robot = class Robot {
    constructor() {
        // If the skeleton linked list should be reversed
        this.reversed = false;

        // Skeleton
        // left hand node
        let l_hand_transform = Mat4.scale(.3, .3, .3);
        this.l_hand_node = new Node("l_hand", shapes.sphere, l_hand_transform);
        //root->l_hand
        const root_location = Mat4.translation(-2.6, 6.4, 0);
        this.root = new Arc("root", null, this.l_hand_node, root_location);

        // An easier way of difining DOF, since we only need translations or 1 deg of rotations
        this.root.allow_translation = true;
        this.root.allow_rotation = true

        // left lower arm node
        let ll_arm_transform = Mat4.scale(0.2, 0.6, .2);
        ll_arm_transform.pre_multiply(Mat4.translation(0, -0.6, 0));
        this.ll_arm_node = new Node("ll_arm", shapes.box, ll_arm_transform);
        // l_hand->l_wrist->ll_arm
        const l_wrist_location = Mat4.translation(0, -0.3, 0);
        this.l_wrist = new Arc("l_wrist", this.l_hand_node, this.ll_arm_node, l_wrist_location);
        this.l_hand_node.child_arc = this.l_wrist;

        // left upper arm node
        let lu_arm_transform = Mat4.scale(0.8, 0.2, .2);
        lu_arm_transform.pre_multiply(Mat4.translation(0.8, 0, 0));
        this.lu_arm_node = new Node("lu_arm", shapes.box, lu_arm_transform);
        // ll_arm->l_elbow->lu_arm
        const l_elbow_location = Mat4.translation(0, -1.1, 0);
        this.l_elbow = new Arc("l_elbow", this.ll_arm_node, this.lu_arm_node, l_elbow_location);
        this.l_elbow.allow_rotation = true;
        this.ll_arm_node.child_arc = this.l_elbow;

        // torso
        const torso_transform = Mat4.scale(1.1, 1.1, 1.1);
        torso_transform.pre_multiply(Mat4.translation(1, 0, 0));
        this.torso_node = new Node("torso", shapes.sphere, torso_transform);
        // lu_arm->l_shoulder->torso
        const l_shoulder_location = Mat4.translation(1.6, 0, 0);
        this.l_shoulder = new Arc("l_shoulder", this.lu_arm_node, this.torso_node, l_shoulder_location);
        this.l_shoulder.allow_rotation = true;
        this.lu_arm_node.child_arc = this.l_shoulder;

        // right upper arm node
        let ru_arm_transform = Mat4.scale(0.8, 0.2, .2);
        ru_arm_transform.pre_multiply(Mat4.translation(0.8, 0, 0));
        this.ru_arm_node = new Node("ru_arm", shapes.box, ru_arm_transform);
        // torso->r_shoulder->ru_arm
        const r_shoulder_location = Mat4.translation(2.0, 0, 0);
        this.r_shoulder = new Arc("r_shoulder", this.torso_node, this.ru_arm_node, r_shoulder_location);
        this.r_shoulder.allow_rotation = true;
        this.torso_node.child_arc = this.r_shoulder;

        // right lower arm node
        let rl_arm_transform = Mat4.scale(0.2, 0.6, .2);
        rl_arm_transform.pre_multiply(Mat4.translation(0, 0.6, 0));
        this.rl_arm_node = new Node("rl_arm", shapes.box, rl_arm_transform);
        // ru_arm->r_elbow->rl_arm
        const r_elbow_location = Mat4.translation(1.6, 0, 0);
        this.r_elbow = new Arc("r_elbow", this.ru_arm_node, this.rl_arm_node, r_elbow_location);
        this.r_elbow.allow_rotation = true;
        this.ru_arm_node.child_arc = this.r_elbow;

        // right hand node
        let r_hand_transform = Mat4.scale(.3, .3, .3);
        r_hand_transform.pre_multiply(Mat4.translation(0, 0.3, 0));
        this.r_hand_node = new Node("r_hand", shapes.sphere, r_hand_transform);
        // rl_arm->r_wrist->r_hand
        const r_wrist_location = Mat4.translation(0, 1.1, 0);
        this.r_wrist = new Arc("r_wrist", this.rl_arm_node, this.r_hand_node, r_wrist_location);
        this.rl_arm_node.child_arc = this.r_wrist;

        this.tail = new Arc("tail", this.r_hand_node, null, Mat4.identity());
        this.r_hand_node.child_arc = this.tail;
        this.tail.allow_rotation = false;
    }

    get_r_hand_pos() {
        return (this.r_wrist.get_absolute_location(this.reversed).times(this.r_hand_node.transform_matrix)).times(vec4(0,0,0,1)).to3();
    }

    get_l_hand_pos() {
        return (this.l_wrist.get_absolute_location(this.reversed).times(this.l_hand_node.transform_matrix)).times(vec4(0,0,0,1)).to3();
    }

    get_end_effector() {
        if (!this.reversed) {
            return this.get_r_hand_pos();
        } else {
            return this.get_l_hand_pos();
        }
    }

    draw(webgl_manager, uniforms, transform_matrix, material) {
        this.matrix_stack = [];
        this._rec_draw(this.reversed ? this.tail : this.root, transform_matrix, webgl_manager, uniforms, material);
    }

    _rec_draw(arc, matrix, webgl_manager, uniforms, material, reversed = this.reversed) {
        if (arc && ((!reversed && arc.child_node) || (reversed && arc.parent_node))) {
            const L = arc.location_matrix;
            const A = arc.articulation_matrix;
            matrix.post_multiply(L.times(A));
            this.matrix_stack.push(matrix.copy());

            const node = reversed ? arc.parent_node : arc.child_node;
            const T = node.transform_matrix;
            matrix.post_multiply(T);
            node.shape.draw(webgl_manager, uniforms, matrix, material);

            matrix = this.matrix_stack.pop();
            /* no more children_arcs array
            for (const next_arc of node.children_arcs) {
                this.matrix_stack.push(matrix.copy());
                this._rec_draw(next_arc, matrix, webgl_manager, uniforms, material);
                matrix = this.matrix_stack.pop();
            }
            */
            this.matrix_stack.push(matrix.copy());
            this._rec_draw(reversed ? node.parent_arc : node.child_arc, matrix, webgl_manager, uniforms, material);
            matrix = this.matrix_stack.pop();
        }
    }

    // TODO: FINISH THIS!!!
    reverse() {
        if (!this.reversed) {
            // angles???
            
            this.tail.location_matrix = Mat4.translation(...this.get_end_effector());
            this.tail.articulation_matrix = this.r_elbow.articulation_matrix;
            this.tail.allow_translation = true;

            // negate all arc angles
            /*
            let curr_arc = this.r_wrist;
            while (true) {
                curr_arc.articulation_matrix = curr_arc.articulation_matrix.transposed();
                if (!curr_arc.parent_node || !curr_arc.parent_node.parent_arc) {
                    break;
                }
                curr_arc = curr_arc.parent_node.parent_arc;
            }
            */

            this.r_hand_node.transform_matrix = Mat4.scale(0.3, 0.3, 0.3);

            this.r_wrist.location_matrix = Mat4.translation(0, -0.3, 0);

            this.rl_arm_node.transform_matrix = Mat4.translation(0, -0.6, 0).times(Mat4.scale(0.2, 0.6, 0.2));

            this.r_elbow.location_matrix = Mat4.translation(0, -1.1, 0);
            this.r_elbow.articulation_matrix = Mat4.inverse(this.r_elbow.articulation_matrix);

            this.ru_arm_node.transform_matrix = Mat4.translation(-0.8, 0, 0).times(Mat4.scale(0.8, 0.2, 0.2));

            this.r_shoulder.location_matrix = Mat4.translation(-1.6, 0, 0);
            this.r_shoulder.articulation_matrix = this.r_shoulder.articulation_matrix.transposed();

            this.torso_node.transform_matrix = Mat4.translation(-1, 0, 0).times(Mat4.scale(1.1, 1.1, 1.1));

            this.l_shoulder.location_matrix = Mat4.translation(-2.0, 0, 0);
            this.l_shoulder.articulation_matrix = this.l_shoulder.articulation_matrix.transposed();

            this.lu_arm_node.transform_matrix = Mat4.translation(-0.8, 0, 0).times(Mat4.scale(0.8, 0.2, .2));

            this.l_elbow.location_matrix = Mat4.translation(-1.6, 0, 0);

            this.ll_arm_node.transform_matrix = Mat4.translation(0, 0.6, 0).times(Mat4.scale(0.2, 0.6, .2));

            this.l_wrist.location_matrix = Mat4.translation(0, 1.1, 0);

            this.l_hand_node.transform_matrix = Mat4.translation(0, 0.3, 0).times(Mat4.scale(.3, .3, .3));

            this.root.location_matrix = Mat4.identity();
            this.root.articulation_matrix = Mat4.identity();
            this.root.allow_translation = false;

            this.reversed = true;
        } else {
            // angles???
            /*
            this.root.location_matrix = Mat4.translation(...this.get_end_effector());
            this.root.articulation_matrix = Mat4.identity();
            this.root.allow_translation = true;

            this.l_hand_node.transform_matrix = Mat4.scale(0.3, 0.3, 0.3);

            let curr_child_arc = this.l_hand_node.child_arc;
            let curr_child_node = curr_child_arc.child_node;

            while (curr_child_node && curr_child_arc) {
                curr_child_arc.location_matrix[0][3] *= -1;
                curr_child_arc.articulation_matrix = curr_child_arc.articulation_matrix.transposed();
                curr_child_arc = curr_child_node.child_arc;

                curr_child_node.transform_matrix[0][3] *= -1;
                curr_child_node = curr_child_arc.child_node;
            }

            this.r_hand_node.transform_matrix = Mat4.translation(0, 0.3, 0).times(Mat4.scale(.3, .3, .3));

            this.tail.location_matrix = Mat4.identity();
            this.tail.articulation_matrix = Mat4.identity();
            this.tail.allow_translation = false;

            this.reversed = false;
            */
        }
    }

    move(target) {
        let end_effector = this.get_end_effector();
        let anchor_joint = this.r_elbow;
        let anchor;
        let delta = (end_effector.minus(target)).norm();

        while (delta > 0.0001) {
            if (anchor_joint.allow_rotation) {
                anchor = anchor_joint.get_loc_vec(this.reversed);
                anchor_joint.dof += calc_angle(end_effector, anchor, target);
                anchor_joint.articulation_matrix = Mat4.rotation(anchor_joint.dof, 0, 0, 1);
            }

            if (!this.reversed) {
                anchor_joint = anchor_joint.parent_node ? anchor_joint.parent_node.parent_arc : this.r_elbow;
            } else {
                anchor_joint = anchor_joint.child_node ? anchor_joint.child_node.child_arc : this.l_elbow;
            }

            end_effector = this.get_end_effector();
            delta = (end_effector.minus(target)).norm();
        }
    }
}

class Node {
    constructor(name, shape, transform) {
        this.name = name;
        this.shape = shape;
        this.transform_matrix = transform;
        this.parent_arc = null;
        this.child_arc = null;
    }
}

class Arc {
    constructor(name, parent, child, location) {
        this.name = name;
        this.parent_node = parent;
        this.child_node = child;
        this.location_matrix = location;
        this.articulation_matrix = Mat4.identity();
        if (child) {
            child.parent_arc = this;
        }
        // Easy DOF
        this.allow_rotation = false;
        this.allow_translation = false;
        this.dof = 0;
    }

    get_absolute_location(reversed) {
        let matrix = this.location_matrix.times(this.articulation_matrix);
        if (!reversed) {
            if (!this.parent_node) {
                return matrix;
            } else {
                return (this.parent_node.parent_arc.get_absolute_location(reversed)).times(matrix);
            }
        } else {
            if (!this.child_node) {
                return matrix;
            } else {
                return (this.child_node.child_arc.get_absolute_location(reversed)).times(matrix);
            }
        }
    }
    
    get_loc_vec(reversed) {
        return this.get_absolute_location(reversed).times(vec4(0,0,0,1)).to3();
    }
}
