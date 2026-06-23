# Canvas encoder

## Formal deinition

1. Lattice Points
A lattice point is any point on the grid. It is a place where a curve can bend or pass through, but it is not a dot you draw yourself.
Think of lattice points as the invisible grid lines on graph paper. They are there to help you space things evenly.
2. Anchor Dots
An anchor dot is a special lattice point where you actually place a dot. It is where your pattern starts, turns, or meets another line.
Anchor dots sit on top of lattice points, but only on every other one. They are spaced apart so curves have room to bend between them.

## drawing a initial grid :
For an m × n kolam, draw a (2m+1) × (2n+1) grid of lattice points.
Place your anchor dots at every other lattice point, starting from the second one.
Skip the first lattice point, place an anchor, skip one, place an anchor, and so on.
The anchor dots are where your pattern lives. The in-between lattice points are just space for your curves to bend smoothly.

## Kolam Splines

The path between anchor dots is drawn with curved lines called splines. Each spline is a quadratic Bézier curve that starts at one anchor dot and ends at the next. Between every pair of neighboring anchor dots lies exactly one lattice point. This midpoint serves as the control point that pulls the curve outward, giving it a smooth bend. The curve never touches the control point itself; it only bends in its direction.

When one spline meets another at an anchor dot, they form a joint. Because the control points before and after any anchor dot lie on the same straight grid line, the two curves share the same direction as they pass through the dot. This makes every joint smooth and continuous, with no sharp corners. The path is a chain of these splines that visits anchor dots in order and closes back on itself to form a complete loop.

For clarity during drawing, the joints and control points should be displayed on the canvas. Joints appear as small marks at every anchor dot where two curves meet, and control points appear as faint guides at the lattice points between anchors. Showing these elements helps verify that the curves connect cleanly and that the control points sit at the correct midpoints. Once the pattern is confirmed, the guides may be hidden to reveal only the finished kolam.

niw