import {tiny, defs} from './examples/common.js';

// Pull these names into this module's scope for convenience:
const { vec3, vec4, color, Mat4, Shape, Material, Shader, Texture, Component } = tiny;

const shapes = {
    'sphere': new defs.Subdivision_Sphere( 5 ),
    'box': new defs.Cube()
};

export const Robot = class Robot {
    constructor() {
        // torso
        const torso_transform = Mat4.scale(1.1, 1.1, 1.1);
        this.torso_node = new Node("torso", shapes.sphere, torso_transform);
        // root->torso
        const root_location = Mat4.translation(0, 5, 2);
        this.root = new Arc("root", null, this.torso_node, root_location);

        // right upper arm node
        let ru_arm_transform = Mat4.scale(0.8, 0.2, .2);
        ru_arm_transform.pre_multiply(Mat4.translation(0.8, 0, 0));
        this.ru_arm_node = new Node("ru_arm", shapes.box, ru_arm_transform);
        // torso->r_shoulder->ru_arm
        const r_shoulder_location = Mat4.translation(1.0, 0, 0);
        this.r_shoulder = new Arc("r_shoulder", this.torso_node, this.ru_arm_node, r_shoulder_location);
        this.torso_node.children_arcs.push(this.r_shoulder)

        // right lower arm node
        let rl_arm_transform = Mat4.scale(0.2, 0.6, .2);
        rl_arm_transform.pre_multiply(Mat4.translation(0, 0.6, 0));
        this.rl_arm_node = new Node("rl_arm", shapes.box, rl_arm_transform);
        // ru_arm->r_elbow->rl_arm
        const r_elbow_location = Mat4.translation(1.6, 0, 0);
        this.r_elbow = new Arc("r_elbow", this.ru_arm_node, this.rl_arm_node, r_elbow_location);
        this.ru_arm_node.children_arcs.push(this.r_elbow)

        // right hand node
        let r_hand_transform = Mat4.scale(.3, .3, .3);
        r_hand_transform.pre_multiply(Mat4.translation(0, 0.3, 0));
        this.r_hand_node = new Node("r_hand", shapes.sphere, r_hand_transform);
        // rl_arm->r_wrist->r_hand
        const r_wrist_location = Mat4.translation(0, 1.1, 0);
        this.r_wrist = new Arc("r_wrist", this.rl_arm_node, this.r_hand_node, r_wrist_location);
        this.rl_arm_node.children_arcs.push(this.r_wrist)

        // left upper arm node
        let lu_arm_transform = Mat4.scale(0.8, 0.2, .2);
        lu_arm_transform.pre_multiply(Mat4.translation(-0.8, 0, 0));
        this.lu_arm_node = new Node("lu_arm", shapes.box, lu_arm_transform);
        // torso->r_shoulder->ru_arm
        const l_shoulder_location = Mat4.translation(-1.0, 0, 0);
        this.l_shoulder = new Arc("l_shoulder", this.torso_node, this.lu_arm_node, l_shoulder_location);
        this.torso_node.children_arcs.push(this.l_shoulder)

        // left lower arm node
        let ll_arm_transform = Mat4.scale(0.2, 0.6, .2);
        ll_arm_transform.pre_multiply(Mat4.translation(0, 0.6, 0));
        this.ll_arm_node = new Node("ll_arm", shapes.box, ll_arm_transform);
        // ru_arm->r_elbow->rl_arm
        const l_elbow_location = Mat4.translation(-1.6, 0, 0);
        this.l_elbow = new Arc("l_elbow", this.lu_arm_node, this.ll_arm_node, l_elbow_location);
        this.lu_arm_node.children_arcs.push(this.l_elbow)

        // left hand node
        let l_hand_transform = Mat4.scale(.3, .3, .3);
        l_hand_transform.pre_multiply(Mat4.translation(0, 0.3, 0));
        this.l_hand_node = new Node("l_hand", shapes.sphere, l_hand_transform);
        // rl_arm->r_wrist->r_hand
        const l_wrist_location = Mat4.translation(0, 1.1, 0);
        this.l_wrist = new Arc("l_wrist", this.ll_arm_node, this.l_hand_node, l_wrist_location);
        this.ll_arm_node.children_arcs.push(this.l_wrist)
    }

    draw(webgl_manager, uniforms, transform_matrix, material) {
        this.matrix_stack = [];
        this._rec_draw(this.root, transform_matrix, webgl_manager, uniforms, material);
    }

    _rec_draw(arc, matrix, webgl_manager, uniforms, material) {
        if (arc !== null) {
            const L = arc.location_matrix;
            const A = arc.articulation_matrix;
            matrix.post_multiply(L.times(A));
            this.matrix_stack.push(matrix.copy());

            const node = arc.child_node;
            const T = node.transform_matrix;
            matrix.post_multiply(T);
            node.shape.draw(webgl_manager, uniforms, matrix, material);

            matrix = this.matrix_stack.pop();
            for (const next_arc of node.children_arcs) {
                this.matrix_stack.push(matrix.copy());
                this._rec_draw(next_arc, matrix, webgl_manager, uniforms, material);
                matrix = this.matrix_stack.pop();
            }
        }
    }
}

class Node {
    constructor(name, shape, transform) {
        this.name = name;
        this.shape = shape;
        this.transform_matrix = transform;
        this.children_arcs = [];
    }
}

class Arc {
    constructor(name, parent, child, location) {
        this.name = name;
        this.parent_node = parent;
        this.child_node = child;
        this.location_matrix = location;
        this.articulation_matrix = Mat4.identity();
    }
}