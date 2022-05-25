import {tiny, defs} from './examples/common.js';
import {txts} from './textures.js';
import {spls} from './spline.js';
import { Robot } from './robot.js';
import {Skybox} from './skybox.js';

// Pull these names into this module's scope for convenience:
const { vec3, vec4, color, hex_color, Mat4, Shape, Material, Shader, Texture, Component } = tiny;

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

function calc_angle(p1 /* from */, p2 /* vertex */, p3 /* to */, n = vec3(0, 0, 1)) {
  let dot = (p1.minus(p2)).dot(p3.minus(p2));
  let mag = (p1.minus(p2)).norm()*(p3.minus(p2)).norm();
  let angle = 0;
  if (dot/mag >= 1) {
    angle = 0; // cap
  } else if (dot/mag <= -1) {
    angle = Math.PI; // cap
  } else {
    angle = Math.acos(dot/mag);
  }
  let det = ((p1.minus(p2)).cross(p3.minus(p2))).dot(n);
  return (det > 0) ? angle : -angle;
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
          'axis' : new defs.Axis_Arrows() ,
          // 'hermite' : new spls.Hermite_Spline(100)
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
          }
        }

        this.ball_location = vec3(1, 1, 1);
        this.ball_radius = 0.25;

        // Declaring walls and grips
        this.scene_height = 0;
        this.robot_range_width = 10;
        this.wall_width = 15;
        this.wall_height = 15;

        this.grip_dh = 2; // height difference between two consecutive grips
        this.grips = [vec3(1, 8, 0)]; // testing

        // initialize grips
        // for (let curr_h = 0; curr_h < this.wall_height; curr_h += this.grip_dh) {
        //   let x_prev = (this.grips.length > 0) ? this.grips[this.grips.length-1][0] : 0;
        //   let x_left = Math.max(x_prev - 2, -this.robot_range_width/2);
        //   let x_right = Math.min(x_prev + 2, this.robot_range_width/2);
        //   let x_curr = Math.random() * (x_right - x_left) + x_left;
        //   this.grips.push([x_curr, curr_h, 0]);
        // }

        this.speed_rate = 1.0;
        this.scene_speed_base = 2;

        // Declaring the robot
        this.robot = new Robot();

        this.skybox = new Skybox();

        //IK related
        this.grab = false;
        // this.robot.r_elbow.articulation_matrix = Mat4.rotation(Math.PI/6, 0, 0, 1);
        this.dof_r_wrist = 0;
        this.dof_r_elbow = 0;
        this.dof_r_shoulder = 0;
        this.dof_l_shoulder = 0;
        this.dof_l_elbow = 0;
        this.dof_l_wrist = 0;
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
          Shader.assign_camera( Mat4.look_at (vec3 (0, 8, 25), vec3 (0, 5, 0), vec3 (0, 1, 0)), this.uniforms );
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


export class IK extends Insurmountable_base
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

    // update texture
    let n_grips_before = Math.floor(this.scene_height / this.grip_dh);
    this.scene_height += dt * this.speed_rate * this.scene_speed_base;
    this.uniforms.scene_height = this.scene_height;
    this.uniforms.wall_height = this.wall_height;
    this.uniforms.wall_width = this.robot_range_width;
    let n_grips_after = Math.floor(this.scene_height / this.grip_dh);

    // update grips
    // for (let i = 0; i < this.grips.length; i++) {
    //   this.grips[i][1] -= dt * this.speed_rate * this.scene_speed_base;
    //   if (this.grips[i][1] < -2 * this.grip_dh) { // out of wall
    //     this.grips.splice(i, 1);
    //     i--;
    //   }
    // }

    // generate new grips if necessary
    // if (n_grips_after > n_grips_before) {
    //   let x_prev = (this.grips.length > 0) ? this.grips[this.grips.length-1][0] : 0;
    //   let x_left = Math.max(x_prev - 2, -this.robot_range_width/2);
    //   let x_right = Math.min(x_prev + 2, this.robot_range_width/2);
    //   let x_curr = Math.random() * (x_right - x_left) + x_left;
    //   this.grips.push([x_curr, this.scene_height - n_grips_after * this.grip_dh + this.wall_height + this.grip_dh, 0]);
    // }

    // update Hermite Spline
    // this.shapes.hermite.set_ctrl_points(this.grips);
    // this.shapes.hermite.sync_card( caller.context );

    // !!! Draw ground
    let floor_transform = Mat4.translation(0, 0, 0).times(Mat4.scale(50, 0.01, 50));
    this.shapes.box.draw( caller, this.uniforms, floor_transform, this.materials.grass);

    // TODO: you can change the wall and board as needed.
    let wall_center_transform = Mat4.translation(0, this.wall_height/2, -1.2);
    let wall_transform = wall_center_transform.times(Mat4.scale(this.robot_range_width/2, this.wall_height/2, 0.1));
    this.shapes.box.draw( caller, this.uniforms, wall_transform, this.materials.wall );
    for (let grip of this.grips) {
      if (grip[1] > this.wall_height || grip[1] < 0) {
        continue;
      }
      let grip_transform = Mat4.translation(grip[0], grip[1],grip[2]).times(Mat4.scale(0.3, 0.3, 0.3));
      this.shapes.ball.draw( caller, this.uniforms, grip_transform, { ...this.materials.plastic, color: blue });
    }
    // this.shapes.hermite.draw( caller, this.uniforms, Mat4.identity(), { ...this.materials.plastic, color: hex_color("#FFFFFF") }, "LINE_STRIP" );

    // let t_robot = binary_solve_mono((t) => (this.shapes.hermite.curve_func(t)[1] - 5), 0, 1, 0.01);
    // let tranform_robot = Mat4.translation(this.shapes.hermite.curve_func(t_robot)[0], 0, 0);

    //IK Updates
    this.grips[0] = vec3(1+2*Math.sin(t), 10-2*Math.cos(t), 0); 
    let target = this.grips[0];
    this.shapes.ball.draw( caller, this.uniforms, Mat4.translation(...target).times(Mat4.scale(0.3, 0.3, 0.3)), { ...this.materials.plastic, color: green });
    let end_effector = this.robot.get_r_hand_pos();
    let anchor = this.robot.r_elbow.get_absolute_location().times(vec4(0,0,0,1)).to3();
    let delta = (end_effector.minus(target)).norm();
    
    while (delta > 0.0001) {
      end_effector = this.robot.get_r_hand_pos();
      anchor = this.robot.r_wrist.get_absolute_location().times(vec4(0,0,0,1)).to3();
      this.dof_r_wrist += calc_angle(end_effector, anchor, target);
      this.robot.r_wrist.articulation_matrix = Mat4.rotation(this.dof_r_wrist, 0, 0, 1);

      end_effector = this.robot.get_r_hand_pos();
      anchor = this.robot.r_elbow.get_absolute_location().times(vec4(0,0,0,1)).to3();
      this.dof_r_elbow += calc_angle(end_effector, anchor, target);
      this.robot.r_elbow.articulation_matrix = Mat4.rotation(this.dof_r_elbow, 0, 0, 1);

      end_effector = this.robot.get_r_hand_pos();
      anchor = this.robot.r_shoulder.get_absolute_location().times(vec4(0,0,0,1)).to3();
      this.dof_r_shoulder += calc_angle(end_effector, anchor, target);
      this.robot.r_shoulder.articulation_matrix = Mat4.rotation(this.dof_r_shoulder, 0, 0, 1);

      end_effector = this.robot.get_r_hand_pos();
      anchor = this.robot.l_shoulder.get_absolute_location().times(vec4(0,0,0,1)).to3();
      this.dof_l_shoulder += calc_angle(end_effector, anchor, target);
      this.robot.l_shoulder.articulation_matrix = Mat4.rotation(this.dof_l_shoulder, 0, 0, 1);

      end_effector = this.robot.get_r_hand_pos();
      anchor = this.robot.l_elbow.get_absolute_location().times(vec4(0,0,0,1)).to3();
      this.dof_l_elbow += calc_angle(end_effector, anchor, target);
      this.robot.l_elbow.articulation_matrix = Mat4.rotation(this.dof_l_elbow, 0, 0, 1);

      end_effector = this.robot.get_r_hand_pos();
      anchor = this.robot.l_wrist.get_absolute_location().times(vec4(0,0,0,1)).to3();
      this.dof_l_wrist += calc_angle(end_effector, anchor, target);
      this.robot.l_wrist.articulation_matrix = Mat4.rotation(this.dof_l_wrist, 0, 0, 1);

      if (Math.abs((end_effector.minus(target)).norm()-delta) < 0.0001) break;
      delta = (end_effector.minus(target)).norm();
    }

    // if (this.debug) {
    //   console.log(end_effector);
    //   console.log((this.robot.r_wrist.get_absolute_location().times(this.robot.r_hand_node.transform_matrix)).times(vec4(0,0,0,1)).to3());
    //   this.debug = !this.debug;
    // }

    // Drawing the robot
    this.robot.draw( caller, this.uniforms, Mat4.identity(), { ...this.materials.metal, color: hex_color("#C4CACE") });
    this.skybox.display(caller, this.uniforms, 1000);
  }

  render_controls()
  {                                 
    // render_controls(): Sets up a panel of interactive HTML elements, including
    // buttons with key bindings for affecting this scene, and live info readouts.
    this.control_panel.innerHTML += "Assignment 2: IK Engine";
    this.new_line();    
    // TODO: You can add your button events for debugging. (optional)
    this.key_triggered_button( "Debug", [ "Shift", "D" ], () => { this.debug = !this.debug; } );
    this.key_triggered_button( "Pause", [ "=" ], () => { this.speed_rate = (this.speed_rate === 0) ? 1 : 0; } );
    this.key_triggered_button( "Switch hold", [ "!" ], () => { this.grab = !this.grab; })
    this.new_line();
  }
}
