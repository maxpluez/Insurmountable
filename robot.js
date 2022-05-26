import {tiny, defs} from './examples/common.js';

// Pull these names into this module's scope for convenience:
const { vec3, vec4, color, Mat4, Shape, Material, Shader, Texture, Component } = tiny;

const shapes = {
    'sphere': new defs.Subdivision_Sphere( 5 ),
    'box': new defs.Cube(), 
    'dood': new defs.Subdivision_Sphere( 0 )
};

export const Robot = class Robot {
    constructor() {
        // left hand node
        let l_hand_transform = Mat4.scale(.3, .3, .3);
        this.l_hand_node = new Node("l_hand", shapes.sphere, l_hand_transform);
        //root->l_hand
        const root_location = Mat4.translation(-2.6, 6.4, 0);
        this.root = new Arc("root", null, this.l_hand_node, root_location); 

        // left lower arm node
        let ll_arm_transform = Mat4.scale(0.2, 0.6, .2);
        ll_arm_transform.pre_multiply(Mat4.translation(0, -0.6, 0));
        this.ll_arm_node = new Node("ll_arm", shapes.box, ll_arm_transform);
        // l_hand->l_wrist->ll_arm
        const l_wrist_location = Mat4.translation(0, -0.3, 0);
        this.l_wrist = new Arc("l_wrist", this.l_hand_node, this.ll_arm_node, l_wrist_location);

        // left upper arm node
        let lu_arm_transform = Mat4.scale(0.8, 0.2, .2);
        lu_arm_transform.pre_multiply(Mat4.translation(0.8, 0, 0));
        this.lu_arm_node = new Node("lu_arm", shapes.box, lu_arm_transform);
        // ll_arm->l_elbow->lu_arm
        const l_elbow_location = Mat4.translation(0, -1.1, 0);
        this.l_elbow = new Arc("l_elbow", this.ll_arm_node, this.lu_arm_node, l_elbow_location);

        // torso
        const torso_transform = Mat4.scale(1.1, 1.1, 1.1);
        torso_transform.pre_multiply(Mat4.translation(1, 0, 0));
        this.torso_node = new Node("torso", shapes.sphere, torso_transform);
        // lu_arm->l_shoulder->torso
        const l_shoulder_location = Mat4.translation(1.6, 0, 0);
        this.l_shoulder = new Arc("l_shoulder", this.lu_arm_node, this.torso_node, l_shoulder_location);

        // right upper arm node
        let ru_arm_transform = Mat4.scale(0.8, 0.2, .2);
        ru_arm_transform.pre_multiply(Mat4.translation(0.8, 0, 0));
        this.ru_arm_node = new Node("ru_arm", shapes.box, ru_arm_transform);
        // torso->r_shoulder->ru_arm
        const r_shoulder_location = Mat4.translation(2.0, 0, 0);
        this.r_shoulder = new Arc("r_shoulder", this.torso_node, this.ru_arm_node, r_shoulder_location);

        // right lower arm node
        let rl_arm_transform = Mat4.scale(0.2, 0.6, .2);
        rl_arm_transform.pre_multiply(Mat4.translation(0, 0.6, 0));
        this.rl_arm_node = new Node("rl_arm", shapes.box, rl_arm_transform);
        // ru_arm->r_elbow->rl_arm
        const r_elbow_location = Mat4.translation(1.6, 0, 0);
        this.r_elbow = new Arc("r_elbow", this.ru_arm_node, this.rl_arm_node, r_elbow_location);

        // right hand node
        let r_hand_transform = Mat4.scale(.3, .3, .3);
        r_hand_transform.pre_multiply(Mat4.translation(0, 0.3, 0));
        this.r_hand_node = new Node("r_hand", shapes.dood, r_hand_transform);
        // rl_arm->r_wrist->r_hand
        const r_wrist_location = Mat4.translation(0, 1.1, 0);
        this.r_wrist = new Arc("r_wrist", this.rl_arm_node, this.r_hand_node, r_wrist_location);

        this.left_base = true; // true -> left root, false -> right root
    }

    invert_root() {
        if (this.left_base) {
            const root_location = Mat4.translation(...this.get_r_hand_pos());
            // right hand node
            let r_hand_transform = Mat4.scale(.3, .3, .3);
            this.r_hand_node = new Node("r_hand", shapes.dood, r_hand_transform);
            //root->r_hand
            this.root = new Arc("root", null, this.r_hand_node, root_location); 
            this.root.articulation_matrix = Mat4.rotation(Math.PI/4, 0, 0, 1);

            // right lower arm node
            let rl_arm_transform = Mat4.scale(0.2, 0.6, .2);
            rl_arm_transform.pre_multiply(Mat4.translation(0, -0.6, 0));
            this.rl_arm_node = new Node("rl_arm", shapes.box, rl_arm_transform);
            // r_hand->r_wrist->rl_arm
            const r_wrist_location = Mat4.translation(0, -0.3, 0);
            this.r_wrist = new Arc("r_wrist", this.r_hand_node, this.rl_arm_node, r_wrist_location);
            this.r_wrist.articulation_matrix;

            // right upper arm node
            let ru_arm_transform = Mat4.scale(0.8, 0.2, .2);
            ru_arm_transform.pre_multiply(Mat4.translation(-0.8, 0, 0));
            this.ru_arm_node = new Node("ru_arm", shapes.box, ru_arm_transform);
            // rl_arm->r_elbow->ru_arm
            const r_elbow_location = Mat4.translation(0, -1.1, 0);
            this.r_elbow = new Arc("r_elbow", this.rl_arm_node, this.ru_arm_node, r_elbow_location);
            this.r_elbow.articulation_matrix;

            // torso
            const torso_transform = Mat4.scale(1.1, 1.1, 1.1);
            torso_transform.pre_multiply(Mat4.translation(-1, 0, 0));
            this.torso_node = new Node("torso", shapes.sphere, torso_transform);
            // ru_arm->r_shoulder->torso
            const r_shoulder_location = Mat4.translation(-1.6, 0, 0);
            this.r_shoulder = new Arc("r_shoulder", this.ru_arm_node, this.torso_node, r_shoulder_location);
            this.r_shoulder.articulation_matrix;

            // left upper arm node
            let lu_arm_transform = Mat4.scale(0.8, 0.2, .2);
            lu_arm_transform.pre_multiply(Mat4.translation(-0.8, 0, 0));
            this.lu_arm_node = new Node("lu_arm", shapes.box, lu_arm_transform);
            // torso->l_shoulder->lu_arm
            const l_shoulder_location = Mat4.translation(-2.0, 0, 0);
            this.l_shoulder = new Arc("l_shoulder", this.torso_node, this.lu_arm_node, l_shoulder_location);
            this.l_shoulder.articulation_matrix;

            // left lower arm node
            let ll_arm_transform = Mat4.scale(0.2, 0.6, .2);
            ll_arm_transform.pre_multiply(Mat4.translation(0, 0.6, 0));
            this.ll_arm_node = new Node("ll_arm", shapes.box, ll_arm_transform);
            // lu_arm->l_elbow->ll_arm
            const l_elbow_location = Mat4.translation(-1.6, 0, 0);
            this.l_elbow = new Arc("l_elbow", this.lu_arm_node, this.ll_arm_node, l_elbow_location);
            this.l_elbow.articulation_matrix;

            // left hand node
            let l_hand_transform = Mat4.scale(.3, .3, .3);
            l_hand_transform.pre_multiply(Mat4.translation(0, 0.3, 0));
            this.l_hand_node = new Node("l_hand", shapes.sphere, l_hand_transform);
            // ll_arm->l_wrist->l_hand
            const l_wrist_location = Mat4.translation(0, 1.1, 0);
            this.l_wrist = new Arc("l_wrist", this.ll_arm_node, this.l_hand_node, l_wrist_location);
            this.l_wrist.articulation_matrix;
        } else {
            const root_location = Mat4.translation(...this.get_l_hand_pos());
            // left hand node
            let l_hand_transform = Mat4.scale(.3, .3, .3);
            this.l_hand_node = new Node("l_hand", shapes.sphere, l_hand_transform);
            //root->l_hand
            this.root = new Arc("root", null, this.l_hand_node, root_location); 
    
            // left lower arm node
            let ll_arm_transform = Mat4.scale(0.2, 0.6, .2);
            ll_arm_transform.pre_multiply(Mat4.translation(0, -0.6, 0));
            this.ll_arm_node = new Node("ll_arm", shapes.box, ll_arm_transform);
            // l_hand->l_wrist->ll_arm
            const l_wrist_location = Mat4.translation(0, -0.3, 0);
            this.l_wrist = new Arc("l_wrist", this.l_hand_node, this.ll_arm_node, l_wrist_location);
    
            // left upper arm node
            let lu_arm_transform = Mat4.scale(0.8, 0.2, .2);
            lu_arm_transform.pre_multiply(Mat4.translation(0.8, 0, 0));
            this.lu_arm_node = new Node("lu_arm", shapes.box, lu_arm_transform);
            // ll_arm->l_elbow->lu_arm
            const l_elbow_location = Mat4.translation(0, -1.1, 0);
            this.l_elbow = new Arc("l_elbow", this.ll_arm_node, this.lu_arm_node, l_elbow_location);
    
            // torso
            const torso_transform = Mat4.scale(1.1, 1.1, 1.1);
            torso_transform.pre_multiply(Mat4.translation(1, 0, 0));
            this.torso_node = new Node("torso", shapes.sphere, torso_transform);
            // lu_arm->l_shoulder->torso
            const l_shoulder_location = Mat4.translation(1.6, 0, 0);
            this.l_shoulder = new Arc("l_shoulder", this.lu_arm_node, this.torso_node, l_shoulder_location);
    
            // right upper arm node
            let ru_arm_transform = Mat4.scale(0.8, 0.2, .2);
            ru_arm_transform.pre_multiply(Mat4.translation(0.8, 0, 0));
            this.ru_arm_node = new Node("ru_arm", shapes.box, ru_arm_transform);
            // torso->r_shoulder->ru_arm
            const r_shoulder_location = Mat4.translation(2.0, 0, 0);
            this.r_shoulder = new Arc("r_shoulder", this.torso_node, this.ru_arm_node, r_shoulder_location);
    
            // right lower arm node
            let rl_arm_transform = Mat4.scale(0.2, 0.6, .2);
            rl_arm_transform.pre_multiply(Mat4.translation(0, 0.6, 0));
            this.rl_arm_node = new Node("rl_arm", shapes.box, rl_arm_transform);
            // ru_arm->r_elbow->rl_arm
            const r_elbow_location = Mat4.translation(1.6, 0, 0);
            this.r_elbow = new Arc("r_elbow", this.ru_arm_node, this.rl_arm_node, r_elbow_location);
    
            // right hand node
            let r_hand_transform = Mat4.scale(.3, .3, .3);
            r_hand_transform.pre_multiply(Mat4.translation(0, 0.3, 0));
            this.r_hand_node = new Node("r_hand", shapes.dood, r_hand_transform);
            // rl_arm->r_wrist->r_hand
            const r_wrist_location = Mat4.translation(0, 1.1, 0);
            this.r_wrist = new Arc("r_wrist", this.rl_arm_node, this.r_hand_node, r_wrist_location);
        }
        this.left_base = !this.left_base;
    }

    get_r_hand_pos() {
        return (this.r_wrist.get_absolute_location().times(this.r_hand_node.transform_matrix)).times(vec4(0,0,0,1)).to3();
    }

    get_l_hand_pos() {
        return (this.l_wrist.get_absolute_location().times(this.l_hand_node.transform_matrix)).times(vec4(0,0,0,1)).to3();
    }

    draw(webgl_manager, uniforms, transform_matrix, material) {
        this._rec_draw(this.root, transform_matrix, webgl_manager, uniforms, material);
    }

    _rec_draw(arc, matrix, webgl_manager, uniforms, material) {
        if (arc !== null) {
            matrix.post_multiply(arc.location_matrix.times(arc.articulation_matrix));
            arc.child_node.shape.draw(webgl_manager, uniforms, matrix.times(arc.child_node.transform_matrix), material);
            this._rec_draw(arc.child_node.child_arc, matrix, webgl_manager, uniforms, material);
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
        if (parent != null) parent.child_arc = this;
        if (child != null) child.parent_arc = this;
    }

    get_absolute_location() {
        let matrix = this.location_matrix.times(this.articulation_matrix);
        if (this.parent_node == null) {
            return matrix;
        } else {
            return (this.parent_node.parent_arc.get_absolute_location()).times(matrix);
        }
    }

    get_default_location() {
        if (this.parent_node == null) {
            return this.location_matrix;
        } else {
            return (this.parent_node.parent_arc.get_default_location()).times(this.location_matrix);
        }
    }
    
    get_loc_vec() {
        return this.get_absolute_location().times(vec4(0,0,0,1)).to3();
    }
}
