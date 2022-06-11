# Insurmountable: A WebGL/Tiny-Graphics Game
## -> Final Project for CS C174C (Spring 2022)

## How to run

There are two ways to run the project: 
1. Run `python3 server.py`
2. Run a live server on index.html in VSCode or WebStorm

## Team members

- Max Zhang 205171726
- Charlie Zhao 205059635
- Eric Fang 605108653
- Young He 205417200

## Theme and Scene Design

- We implemented a rock climbing game with a robot-like character. The user can control one hand at a time, and move it to grab one of the pre-defined holds on the wall. The wall will constantly be scrolling downwards, and the player must try to advance upwards to not lose. The player gains a point when they grabs onto a new grip, and loses a point when they let a grip go out of bounds. In addition to the scores, the player must also watch out for the falling rocks from the sky: the robot will have an initial HP of 3, and being hit will decrease the HP by 1 (the player can gain 1 HP back every 5 grips). The game will progressively become faster and faster (speed will increase by 20% every 5 grips) as the player gains more points. 

- The scene is polished by adding texture to the models. A skybox is implemented by stitching six large squares, where the texture on each square is designed to create an illustration of a continuous sky. We also added textures to the wall and the falling rocks that made the scene look more coherent and pleasant. 

//TODO: PUT SCREENSHOT HERE (LONGLONG)

## Computer animation algorithms and techniques
 
1. Hermite and Catmull Rom splines

For the splines, we basically imported from Assignment 1, but with some features added for convenience. The most significant change is to enable setting up Catmull Rom splines, the Hermite spline that automatically calculates the control tangent on each control point. With this function we could easily set up random Hermite splines by simply setting up random points without worrying about their tangents.

2. Grips

We store the position of each grip through a Hermite spline and the parameter on the spline. The parameter will evolve in time for each update, so that each grip moves along the spline as time goes on, adding more fun and difficulty to the game. In order not to create a spline object for each grip so that the graphics card would receive too many shape objects, the Hermite spline is represented by a list of control points, and in each member function that needs to use the spline, we pass in a spline object and modify the Catmull Rom control points accordingly in the function.

We also periodically generate new grips as the camera “moves up”. The new grip will have a partially-randomized (random height but equally distributed horizontal position) set of control points initialized, so that each grip has a randomly unique trajectory.
The grip supports an interface that returns the closest grip of some target point in space. This will be helpful in updating the robot below.

3. Cyclic Coordinate Descent

For our inverse kinematics engine, we decided to implement Cyclic Coordinate Descent (CCD). We started off with the original approach used in assignment 2 (which was inverse Jacobian), and then modified it to calculate and update the articulations one joint at a time. For each iteration, we calculate the optimal rotation at the current arc, and set the new current arc to its parent.

Because both hands need to move simultaneously, one with the moving grips and the other with the user’s controls, we decide to use one hand as the root with translational DOF and the other as the end effector to avoid having 2 end effectors. (If the torso is the root that has translational DOF and both hands are end effectors, updating the torso’s translation according to 2 end effectors simultaneously can get tricky.) Using one hand as the root and the other as the end effector also create a dangling effect on the body, where the body follows the hands’ movements; which is also desirable. To realize this, we implement a reverse root logic to change the original end effector as the new root and the original root as the new end effector. All of the articulations of each arc are inverted accordingly.

4. Rigid body

To simulate random falling rocks that can hit the player, we implement a rigid body simulator to simulate the linear and angular motion of rigid bodies of any shape. We approach rigid body dynamics with the traditional Newtonian method, which is suitable for non-articulated rigid bodies. The linear and angular momentum is computed by the Newton-Euler formula, and position and orientation are then integrated using the forward Euler integration scheme. A crucial point to make the whole system work is to re-project the rotational matrix to the space of orthonormal matrices at each update so that the error won’t accumulate. The projection is done in a Gram-Smith fashion, implemented by cross dots. Theoretically, our simulator supports rigid bodies of any shape if the physical properties of the rigid body are provided. Considering the difficulty of computing the inertia tensor of different shapes, we decide to approximate rocks with rectangular blocks. 

5.  Collision detection and resolution

We implement collision between the rigid body with the character's torso, which is a sphere. The traditional axis-aligned bounding box (AABB) method is used to represent the block, and the sphere is represented by its center and radius. Since the rigid body can have an arbitrary orientation at any timestamp, we transform the sphere to the AABB's frame so that the bounding box's axis is aligned with the world axis. The closest point on the bounding box to the center of the sphere is found by clamping the sphere's position to the bounding box's scale, which is then compared to the sphere's radius to determine intersection. If intersected, the velocity of the rigid body is simply negated. Even though this collision resolution is not physically accurate, it gives visible plausible results suitable for our purpose. 

## Contributions of each team member
- Eric: I wrote the spline and grip classes, including how to represent a grip, how to draw the grip and spline based on some relative position and interface that other parts need (such as find_closest() and position_list()). I also designed moving texture to represent the robot moving up, and the game speed logic that supports the moving texture abstraction.
- Young: I designed the CCD inverse kinematics engine, and developed the first iteration of the robot model and root switching logic. I also designed most of the game logic, including the scoring system, win/loss mechanics, the health system, etc. I also helped Charlie with the design and debugging of the collision resolution mechanisms. 
- Max: I worked on CCD and the inverse kinematics algorithm with Young, as well as some other robot movement logics, including the specific cyclic implementation of CCD on each arc, root reversing algorithm, the WASD controls, the grabbing logic of the robot, etc. I also worked on the in game logic of warnings and falling rigid bodies, including the random rock dropping algorithm.
- Charlie:  I implement the skybox and the simulation of the rigid body dynamics. I also work with Young to implement rigid body collision detection and resolution. 
## Changes since the finals week demo
- We implemented the random rock dropping behavior, that would cause the robot character to lose health. This feature was not fully realized in the final demo. 
- The smaller splines that the grips move along were changed to Catmull Rom splines, and were displayed for player convenience (so that they could somewhat predict more accurately the trajectory of the grips).
- Some textures were added to make the game more visually appealing. 

## Video demo
//TODO: PUT VIDEO HERE, OR LIST FILE NAME (LONGLONG)