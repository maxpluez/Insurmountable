import {tiny, defs} from './examples/common.js';
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
          'hermite' : new spls.Hermite_Spline(100)
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
        this.grips = new grips.Grips();
        // initialize grips
        for (let curr_h = 0; curr_h < this.wall_height + this.grip_dh; curr_h += this.grip_dh) {
          let x_prev = (this.grips.length > 0) ? this.grips[this.grips.length-1].position()[0] : 0;
          let x_left = Math.max(x_prev - 2, -this.robot_range_width/2);
          let x_right = Math.min(x_prev + 2, this.robot_range_width/2);
          let x_curr = Math.random() * (x_right - x_left) + x_left;
          let spline = new spls.Parametric_Spline(5, color(1,1,1,1), Mat4.translation(x_curr, curr_h, 0));
          this.grips.add_grip(spline, 0, 1);
        }

        this.speed_rate = 2.0; // TODO: for IK demo only
        this.scene_speed_base = 2;

        // Declaring the robot
        this.robot = new Robot();
        this.robot.root.location_matrix = Mat4.translation(0,10,0); // Temp offset

        this.skybox = new Skybox();
        this.rigidbody = new Rigidbody();
        let scale = [1, 2, 1.5];
        this.rigidbody.set_property(new defs.Cube(), 1, Rigidbody.cube_inertia(1, scale), scale, -3.981);
        this.rigidbody.set_initial_condition(vec3(0,13,0), Mat3.identity(), vec3(1,3,1),vec3(1,1,1));
        this.rigidbody.set_on_hit_ground_callback(()=>this.rigidbody.p[1]*=-1);


        // hand target
        this.target = vec3(5, 10, 0);
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

    // update texture
    let n_grips_before = Math.floor(this.scene_height / this.grip_dh);
    this.scene_height += dt * this.speed_rate * this.scene_speed_base;
    this.uniforms.scene_height = this.scene_height;
    this.uniforms.wall_height = this.wall_height;
    this.uniforms.wall_width = this.robot_range_width;
    let n_grips_after = Math.floor(this.scene_height / this.grip_dh);

    // update grips
    this.grips.update(dt * this.speed_rate * this.scene_speed_base, dt);

    // generate new grips if necessary
    if (n_grips_after > n_grips_before) {
      let x_prev = (this.grips.length > 0) ? this.grips[this.grips.length-1].position()[0] : 0;
      let x_left = Math.max(x_prev - 2, -this.robot_range_width/2);
      let x_right = Math.min(x_prev + 2, this.robot_range_width/2);
      let x_curr = (1-Math.random()/2) * (x_right - x_left) + x_left;
      let curr_h = this.scene_height + this.wall_height + this.grip_dh;
      let spline = new spls.Parametric_Spline(5, color(1,1,1,1), Mat4.translation(x_curr, curr_h, 0));
      this.grips.add_grip(spline, 0, 1);
    }

    // update Hermite Spline
    this.shapes.hermite.set_ctrl_points(this.grips.position_list());
    this.shapes.hermite.sync_card( caller.context );

    // !!! Draw ground
    let floor_transform = Mat4.translation(0, 0, 0).times(Mat4.scale(50, 0.01, 50));
    this.shapes.box.draw( caller, this.uniforms, floor_transform, this.materials.grass);

    // wall
    let wall_center_transform = Mat4.translation(0, this.wall_height/2, -1.2);
    let wall_transform = wall_center_transform.times(Mat4.scale(this.robot_range_width/2, this.wall_height/2, 0.1));
    this.shapes.box.draw( caller, this.uniforms, wall_transform, this.materials.wall );
    this.grips.draw( caller, this.uniforms );
    this.shapes.hermite.draw( caller, this.uniforms, Mat4.identity(), { ...this.materials.plastic, color: hex_color("#FFFFFF") }, "LINE_STRIP" );

    let t_robot = binary_solve_mono((t) => (this.shapes.hermite.curr_pos(t)[1] - 5), 0, 1, 0.01);
    // let transform_robot = Mat4.translation(this.shapes.hermite.curr_pos(t_robot)[0], 0, 0);
    // this.robot.root.articulation_matrix = transform_robot;

    this.robot.move(this.target);

    // Drawing the robot
    this.robot.draw( caller, this.uniforms, Mat4.identity(), { ...this.materials.metal, color: hex_color("#C4CACE") });
    this.skybox.display(caller, this.uniforms, 1000);

    this.rigidbody.update(dt);
    this.rigidbody.draw(caller, this.uniforms, this.materials.plastic);

    // Drawing target for debugging purposes
    const target_transform = Mat4.translation(this.target[0], this.target[1], 1).times(Mat4.scale(0.1, 0.1, 0.1));
    this.shapes.box.draw( caller, this.uniforms, target_transform, { ...this.materials.metal, color: hex_color("#FF0000") });

    // hightlight the closest grip
    this.shapes.box.draw( caller, this.uniforms, Mat4.translation(0, -this.grips.height, 0).times(Mat4.translation(...this.grips.find_closest(this.target).position())).times(Mat4.scale(0.5, 0.5, 0.5)), {...this.materials.plastic, color: hex_color("#FFFFFF")});
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

    // WASD
    this.new_line();
    this.key_triggered_button( "Up", [ "w" ], () => { this.target[1] += 0.1 } );
    this.key_triggered_button( "Left", [ "a" ], () => { this.target[0] -= 0.1 } );
    this.key_triggered_button( "Down", [ "s" ], () => { this.target[1] -= 0.1 } );
    this.key_triggered_button( "Right", [ "d" ], () => { this.target[0] += 0.1 } );
    this.new_line();
    this.key_triggered_button( "Grab!", [ " " ], () => {
      this.robot.reverse();
      this.target = this.robot.get_end_effector();
    });
  }
}
