import {tiny, defs} from './examples/common.js';
import {Text_Line} from './examples/text-demo.js';
import {txts} from './textures.js';
import {spls} from './spline.js';
import {grips} from './grips.js'
import {Robot} from './robot.js';
import {Skybox} from './skybox.js';
import {Rigidbody} from "./rigidbody.js";

// Pull these names into this module's scope for convenience:
const { vec3, vec4, color, hex_color, Mat4, Mat3, Shape, Material, Shader, Texture, Component } = tiny;

function binary_solve_mono(f /* a monotonic function */, t_min, t_max, epsilon) {
  let f_min = f(t_min);
  let f_max = f(t_max);
  if (Math.abs(f_min) < epsilon) {
    return t_min; // found solution
  }
  if (Math.abs(f_max) < epsilon ) {
    return t_max; // found solution
  }
  if (f_min * f_max > 0) {
    return "Not Found"; // no solution for monotonic function
  }

  let f_mid = f((t_min + t_max)/2);
  if (f_mid * f_min < 0) {
    return binary_solve_mono(f, t_min, (t_min + t_max)/2, epsilon);
  } else {
    return binary_solve_mono(f, (t_min + t_max)/2, t_max, epsilon);
  }
}

function generate_random_x(max) {
  return Math.random() * max - max / 2;
}

function random_in_range(min, max) {
  return Math.random() * (max - min) + min;
}


export
const Insurmountable_base = defs.Insurmountable_base =
    class Insurmountable_base extends Component
    {                                          
      init()
      {
        console.log("init")

        // constructor(): Scenes begin by populating initial values like the Shapes and Materials they'll need.
        this.hover = this.swarm = false;
        this.debug = false;
        // At the beginning of our program, load one of each of these shape
        // definitions onto the GPU.  NOTE:  Only do this ONCE per shape it
        // would be redundant to tell it again.  You should just re-use the
        // one called "box" more than once in display() to draw multiple cubes.
        // Don't define more than one blueprint for the same thing here.
        this.shapes = { 'box'  : new defs.Cube(),
          'ball' : new defs.Subdivision_Sphere( 4 ),
          'axis' : new defs.Axis_Arrows(),
          'hermite' : new spls.Hermite_Spline(100),
          'cube': new defs.Cube(), 
          'square': new defs.Square(),
          'text': new Text_Line(35)
        };

        // *** Materials: ***  A "material" used on individual shapes specifies all fields
        // that a Shader queries to light/color it properly.  Here we use a Phong shader.
        // We can now tweak the scalar coefficients from the Phong lighting formulas.
        // Expected values can be found listed in Phong_Shader::update_GPU().
        const basic = new defs.Basic_Shader();
        const phong = new defs.Phong_Shader();
        const tex_phong = new defs.Textured_Phong();
        const tex_wall = new txts.Texture_Wall();
        this.materials = {
          plastic:  { shader: phong, ambient: .2, diffusivity: 1, specularity: .5, color: color( .9,.5,.9,1 ) },
          metal:    { shader: phong, ambient: .2, diffusivity: 1, specularity:  1, color: color( .9,.5,.9,1 ) },
          rgb:      { shader: tex_phong, ambient: .5, texture: new Texture( "assets/rgb.jpg" ) },
          grass: { shader: tex_phong, ambient: 1, diffusivity: 0, specularity: 0, texture: new Texture( "assets/T_Grass.png" ) },
          wall:     {
            shader: tex_wall,
            color: hex_color("#000000"),
            ambient: .6, diffusivity: 0.3, specularity: 0.1,
            texture: new Texture("assets/rock.jpg", "NEAREST")
          },
          warning:  {
            shader: tex_phong,
            color: hex_color("#000000"),
            ambient: 1, diffusivity: 0.3, specularity: 0.1,
            texture: new Texture("assets/warning.png")
          },
          rock: {
            shader: tex_phong,
            color: color(0,0,0,1),
            ambient: 1,
            texture: new Texture("assets/stars.png")
          }
        }

        this.ball_location = vec3(1, 1, 1);
        this.ball_radius = 0.25;

        // Declaring walls and grips
        this.scene_height = 0;
        this.robot_range_width = 10;
        this.wall_width = 17;
        this.wall_height = 60;

        this.grip_dh = 3; // height difference between two consecutive grips
        this.grips = new grips.Grips();
        this.grip_x_deviation = 8;
        // initialize grips
        // for (let curr_h = 0; curr_h < this.wall_height + this.grip_dh; curr_h += this.grip_dh) {
        //   let x_prev = (this.grips.length > 0) ? this.grips[this.grips.length-1].position()[0] : 0;
        //   let x_left = Math.max(x_prev - this.grip_x_deviation, -this.robot_range_width/2);
        //   let x_right = Math.min(x_prev + this.grip_x_deviation, this.robot_range_width/2);
        //   let x_curr = Math.random() * (x_right - x_left) + x_left;
        //   let spline = new spls.Parametric_Spline(5, color(1,1,1,1), Mat4.translation(x_curr, curr_h, 0));
        //   this.grips.add_grip(spline, 0, 1);
        // }

        this.speed_rate = 1.0;
        this.curr_speed_rate = 1.0;
        this.scene_speed_base = 2;

        // Declaring the robot
        this.robot = new Robot();
        this.robot.root.location_matrix = Mat4.translation(-2.5,10,0); // Temp offset
        this.held_hand = this.robot.reversed ? this.robot.tail : this.robot.root;

        // Rigid bodies
        this.skybox = new Skybox();
        this.rigidbodies = [];
        this.rigidbody_generated = false;
        this.random_x = generate_random_x(this.wall_width);

        // hand target
        this.target = vec3(2.7, 10, 0);
        this.target_rel_vel_base = vec3(0, 0, 0);
        this.grabbed_grip = null;
        this.prev_robot_root_pos = this.robot.root.location_matrix.times(vec4(0,0,0,1)).to3();
        this.curr_robot_root_pos = this.robot.root.location_matrix.times(vec4(0,0,0,1)).to3();
        
        // text object
        const texture = new defs.Textured_Phong( 1 );
        this.grey       = { shader: phong, color: color( .5,.5,.5,1 ), ambient: 0,
                                        diffusivity: .3, specularity: .5, smoothness: 10 };
        this.text_image = { shader: texture, ambient: 1, diffusivity: 0, specularity: 0,
          texture: new Texture( "assets/text.png" ) };

        // game variables
        this.score = 0;
        this.hp = 3;
        this.message = "Insurmountable!";
        this.lost = false;
        this.pause = false;
        this.is_first_grip = true;
      }

      render_animation( caller )
      {
        // Setup -- This part sets up the scene's overall camera matrix, projection matrix, and lights:
        if( !caller.controls )
        { this.animated_children.push( caller.controls = new defs.Movement_Controls( { uniforms: this.uniforms } ) );
          caller.controls.add_mouse_controls( caller.canvas );

          // Define the global camera and projection matrices, which are stored in shared_uniforms.  The camera
          // matrix follows the usual format for transforms, but with opposite values (cameras exist as
          // inverted matrices).  The projection matrix follows an unusual format and determines how depth is
          // treated when projecting 3D points onto a plane.  The Mat4 functions perspective() or
          // orthographic() automatically generate valid matrices for one.  The input arguments of
          // perspective() are field of view, aspect ratio, and distances to the near plane and far plane.

          // !!! Camera changed here
          // TODO: you can change the camera as needed.
          Shader.assign_camera( Mat4.look_at (vec3 (15, 10, 30), vec3 (5, 9, 0), vec3 (0, 1, 0)), this.uniforms );
        }
        this.uniforms.projection_transform = Mat4.perspective( Math.PI/4, caller.width/caller.height, 0.01, 500000 );

        // *** Lights: *** Values of vector or point lights.  They'll be consulted by
        // the shader when coloring shapes.  See Light's class definition for inputs.
        const t = this.t = this.uniforms.animation_time/1000;

        // const light_position = Mat4.rotation( angle,   1,0,0 ).times( vec4( 0,-1,1,0 ) ); !!!
        // !!! Light changed here
        const light_position = vec4(0, 20, 10, 1.0);
        this.uniforms.lights = [ defs.Phong_Shader.light_source( light_position, color( 1,1,1,1 ), 1000000 ) ];
      }
    }


export class Insurmountable extends Insurmountable_base
{                                                    
  // This particular scene is broken up into two pieces for easier understanding.
  // See the other piece, My_Demo_Base, if you need to see the setup code.
  // The piece here exposes only the display() method, which actually places and draws
  // the shapes.  We isolate that code so it can be experimented with on its own.
  // This gives you a very small code sandbox for editing a simple scene, and for
  // experimenting with matrix transformations.
  render_animation( caller )
  {                                                // display():  Called once per frame of animation.  For each shape that you want to
    // appear onscreen, place a .draw() call for it inside.  Each time, pass in a
    // different matrix value to control where the shape appears.

    // Variables that are in scope for you to use:
    // this.shapes.box:   A vertex array object defining a 2x2x2 cube.
    // this.shapes.ball:  A vertex array object defining a 2x2x2 spherical surface.
    // this.materials.metal:    Selects a shader and draws with a shiny surface.
    // this.materials.plastic:  Selects a shader and draws a more matte surface.
    // this.lights:  A pre-made collection of Light objects.
    // this.hover:  A boolean variable that changes when the user presses a button.
    // shared_uniforms:  Information the shader needs for drawing.  Pass to draw().
    // caller:  Wraps the WebGL rendering context shown onscreen.  Pass to draw().

    // Call the setup code that we left inside the base class:
    super.render_animation( caller );

    /**********************************
     Start coding down here!!!!
     **********************************/
    // From here on down it's just some example shapes drawn for you -- freely
    // replace them with your own!  Notice the usage of the Mat4 functions
    // translation(), scale(), and rotation() to generate matrices, and the
    // function times(), which generates products of matrices.

    const blue = color( 0,0,1,1 ), yellow = color( 1,0.7,0,1 ), green = color( 0,1,0,1 ),
          wall_color = color( 0.6, 0.5, 0.3, 1 ), 
          blackboard_color = color( 0.2, 0.2, 0.2, 1 );

    const t = this.t = this.uniforms.animation_time/1000;
    const dt = this.dt = this.uniforms.animation_delta_time/1000;

    this.speed_rate = this.pause ? 0 : this.curr_speed_rate;
    if (this.is_first_grip) this.first_grip_time = t;

    // update texture
    let n_grips_before = Math.floor(this.scene_height / this.grip_dh);
    this.scene_height += dt * this.speed_rate * this.scene_speed_base;
    this.uniforms.scene_height = this.scene_height;
    this.uniforms.wall_height = this.wall_height;
    this.uniforms.wall_width = this.robot_range_width;
    let n_grips_after = Math.floor(this.scene_height / this.grip_dh);

    // update grips
    this.score -= this.grips.update(this.shapes.hermite, dt * this.speed_rate * this.scene_speed_base, dt * this.speed_rate);

    // generate new grips if necessary
    if (n_grips_after > n_grips_before) {
      let x_prev = (this.grips.length > 0) ? this.grips[this.grips.length-1].position(this.shapes.hermite)[0] : 0;
      let x_left = Math.max(x_prev - this.grip_x_deviation, -this.robot_range_width/2);
      let x_right = Math.min(x_prev + this.grip_x_deviation, this.robot_range_width/2);
      let x_curr = (1-Math.random()/2) * (x_right - x_left) + x_left;
      let curr_h = this.scene_height + this.wall_height/2;
      // generate random control points around a certain range
      let n_ctrl_pts = Math.max(3, Math.floor(Math.random() * 10));
      let catmull_pts = [];
      for (let i = 0; i < n_ctrl_pts; i++) {
        catmull_pts.push([
            (x_left - x_right)/2 / n_ctrl_pts * i,
            generate_random_x(2),
            0
        ]);
      }
      this.grips.add_grip(catmull_pts, Mat4.translation(x_curr, curr_h, 0), 0, 1);
    }

    // Draw ground
    if (this.scene_height < 40) { // TODO: change the hardcoded 40 to some calculated value for generality
      let floor_transform = Mat4.translation(0, -this.scene_height, 0).times(Mat4.scale(50, 0.01, 50));
      this.shapes.box.draw( caller, this.uniforms, floor_transform, this.materials.grass);
    }

    // wall
    let wall_center_transform = Mat4.translation(0, 0, -1.2);
    let wall_transform = wall_center_transform.times(Mat4.scale(this.wall_width/2, this.wall_height/2, 0.1));
    this.shapes.box.draw( caller, this.uniforms, wall_transform, this.materials.wall );
    this.grips.draw( this.shapes.hermite, caller, this.uniforms );

    if (this.grabbed_grip) {
      let root_pos = Mat4.translation(0, -this.grips.height, 0).times(this.grabbed_grip.position(this.shapes.hermite).to4(true)).to3();
      this.robot.move_root(root_pos);
      this.target = this.target.plus(this.curr_robot_root_pos.minus(this.prev_robot_root_pos));
    }

    this.target = this.target.plus(this.target_rel_vel_base.times(dt * this.speed_rate));
    this.robot.move_ik(this.target);

    // if target moves too far for the end effector to reach, bring it back to the maximum
    this.prev_robot_root_pos = this.curr_robot_root_pos;
    this.curr_robot_root_pos = this.held_hand.location_matrix.times(vec4(0,0,0,1)).to3();
    const end_effector_pos = this.robot.get_end_effector();
    const target_dist = this.target.minus(this.curr_robot_root_pos).norm();
    const end_dist = end_effector_pos.minus(this.curr_robot_root_pos).norm();
    this.target = this.curr_robot_root_pos.mix(this.target, end_dist / target_dist);

    if ((this.robot.get_torso_pos()[1] < -4 || this.hp <= 0) && this.speed_rate !== 0) {
      this.lost = true;
      this.final_time = t;
      this.curr_speed_rate = 0;
    }

    // Drawing the robot
    this.robot.draw( caller, this.uniforms, Mat4.identity(), { ...this.materials.metal, color: hex_color("#ADD8E6") });
    this.skybox.display(caller, this.uniforms, 1000);

    // Rigid body
    let torso_pos_global = this.robot.get_torso_pos();
    torso_pos_global = vec4(torso_pos_global[0],torso_pos_global[1],torso_pos_global[2],1);
    for (const rigidbody of this.rigidbodies) {
      //add a lifetime to help performance
      rigidbody.life_time -= dt * this.speed_rate;
      if(rigidbody.life_time < 0) {
        continue;
      }
      //convert the torso sphere to rigid body's frame
      if(rigidbody.enable_collision) {
        let torso_pos_local = ((Mat4.inverse(rigidbody.get_transform_no_scale())).times(torso_pos_global)).to3();
        let intersected = rigidbody.sphere_intersection(torso_pos_local, 1.1);
        if(intersected) {
          if (!this.is_first_grip) {
            this.hp--;
          }
          rigidbody.p = rigidbody.p.times(-1);
          rigidbody.enable_collision = false;
          //if collided, disable collision for 1 second to avoid jitter
          rigidbody.enable_collision_timer = 1;
        }
      }
      else {
        rigidbody.enable_collision_timer -= dt * this.speed_rate;
        if(rigidbody.enable_collision_timer < 0) {
          rigidbody.enable_collision = true;
        }
      }
      rigidbody.update(dt * this.speed_rate);
      rigidbody.draw(caller, this.uniforms, this.materials.rock);
    }

    // delete rigidbody that is below camera
    for (let i = this.rigidbodies.length-1; i >= 0; i--) {
      if (this.rigidbodies[i].x[1] < -10) {
        this.rigidbodies.splice(i, 1);
      }
    }

      // Every 10 seconds a warning shows and a rigid body falls
      if (t % 10 < 3) {
        this.rigidbody_generated = false;
        let warning_transform = Mat4.translation(this.random_x, 20, 0).times(Mat4.scale(1, 1, 0.1));
        this.shapes.box.draw(caller, this.uniforms, warning_transform, this.materials.warning);
      }
      else if (!this.rigidbody_generated) {
        let new_rigidbody = new Rigidbody();
        let scale = [random_in_range(1,2), random_in_range(1,2), random_in_range(1,2)];
        new_rigidbody.set_property(new defs.Cube(), 1, Rigidbody.cube_inertia(1, scale), scale, -3.981);
        new_rigidbody.set_initial_condition(vec3(this.random_x,25,0), Mat3.identity(),
            vec3(random_in_range(-2,2),random_in_range(-2,2)-this.scene_speed_base*this.speed_rate /* so that the speed is 0 wrt conceptual ground */,0),
            vec3(random_in_range(-2,2),random_in_range(-2,2),random_in_range(-2,2)));
        new_rigidbody.set_on_hit_ground_callback(()=>new_rigidbody.p[1]*=-1);
        this.rigidbodies.push(new_rigidbody);
        this.rigidbody_generated = true;
        this.random_x = generate_random_x(this.wall_width);
      }


    // Drawing target for debugging purposes
    const target_transform = Mat4.translation(this.target[0], this.target[1], 0.3).times(Mat4.scale(0.1, 0.1, 0.1));
    this.shapes.box.draw( caller, this.uniforms, target_transform, { ...this.materials.metal, color: hex_color("#FF0000") });

    // hightlight the closest grip
    // this.shapes.box.draw( caller, this.uniforms, Mat4.translation(...this.grips.find_closest(this.robot.get_end_effector()).position)
    //   .times(Mat4.scale(0.3, 0.3, 0.3)), {...this.materials.plastic, color: hex_color("#FFFFFF")});
  
    // text stuff
    let bkgd_transform = Mat4.translation(14,2,-1).times(Mat4.scale(5,2,0));
    let text_transform = Mat4.translation(10,3,-0.9).times(Mat4.scale(5,5,0));

    this.shapes.square.draw( caller, this.uniforms, bkgd_transform, this.grey);
    if (this.is_first_grip) {
      this.message = "Insurmountable!\n\n\n"+"Grab a grip to start\n\n\n"+"Made with <3 by Bruins";
    } else if (this.lost) {
      this.message = "You lost!\n\n\n"+`Final score: ${this.score}\n\n\n`+`Time survived: ${Math.round(this.final_time-this.first_grip_time)}s`;
    } else {
      this.message = "Insurmountable!\n\n\n"+`Current score: ${this.score}\n\n\n`+`Current HP: ${this.hp}`;
    }

    let multi_line_string = this.message.split('\n');
    // Draw a Text_String for every line in our string
    for( let line of multi_line_string.slice( 0,30 ) ) { // Assign the string to Text_String, and then draw it
      // Sample each line and draw
      this.shapes.text.set_string( line, caller );
      this.shapes.text.draw( caller, this.uniforms, text_transform.times( Mat4.scale( .05,.05,.05 ) ), this.text_image );
      // Move basis down a line
      text_transform.post_multiply( Mat4.translation( 0,-0.06,0 ) );
    }
  }

  try_to_grab() {
    const { grip, position, min_dist } = this.grips.find_closest(this.shapes.hermite, this.robot.get_end_effector());

    if (min_dist > 1 || !grip.grabable) {
      return;
    }

    // First, set the grabbed grip to the current point
    this.grabbed_grip = grip;
    grip.grabable = false;
    grip.color = hex_color("#77DD77");

    // Then, move the end effector to the grip
    this.robot.move_ik(vec3(...position));

    // Next, reverse
    this.robot.reverse();

    // Lastly, change target to the other hand
    this.target = this.robot.get_end_effector();
    this.held_hand = this.robot.reversed ? this.robot.tail : this.robot.root;
    this.prev_robot_root_pos = this.curr_robot_root_pos = this.held_hand.location_matrix.times(vec4(0,0,0,1)).to3();

    this.is_first_grip = false;

    this.score += 1;
    if (this.score > 0 && this.score % 5 === 0) {
      this.curr_speed_rate += 0.5;
      this.hp++;
    }
  }

  render_controls()
  {
    const button_color = '#f3acac';
    const target_rel_speed_base = 6;
    // render_controls(): Sets up a panel of interactive HTML elements, including
    // buttons with key bindings for affecting this scene, and live info readouts.
    // this.control_panel.innerHTML += "Insurmountable: a rock-climbing game";  

    // TODO: You can add your button events for debugging. (optional)
    // this.key_triggered_button( "Debug", [ "Shift", "D" ], () => { this.debug = !this.debug; } );
    // this.new_line();

    // WASD
    this.key_triggered_button( "Up", [ "w" ], () => { this.target_rel_vel_base[1] = target_rel_speed_base }, button_color, () => { this.target_rel_vel_base[1] = 0 } );
    this.key_triggered_button( "Left", [ "a" ], () => { this.target_rel_vel_base[0] = -target_rel_speed_base }, button_color, () => { this.target_rel_vel_base[0] = 0 } );
    this.key_triggered_button( "Down", [ "s" ], () => { this.target_rel_vel_base[1] = -target_rel_speed_base }, button_color, () => { this.target_rel_vel_base[1] = 0 } );
    this.key_triggered_button( "Right", [ "d" ], () => { this.target_rel_vel_base[0] = target_rel_speed_base }, button_color, () => { this.target_rel_vel_base[0] = 0 } );
    // Other buttons
    this.new_line();
    this.key_triggered_button( "Grab!", [ " " ], this.try_to_grab);
    this.key_triggered_button( "Pause", [ "=" ], () => { this.pause = !this.pause } );
  }
}
