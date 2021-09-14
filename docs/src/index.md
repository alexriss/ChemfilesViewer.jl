```@meta
CurrentModule = ChemfilesViewer
```

# ChemfilesViewer

Documentation for [ChemfilesViewer](https://github.com/alexriss/ChemfilesViewer.jl).

## About

A julia library to visualize chemical molecules and other structures in the [Chemfiles](https://github.com/chemfiles/Chemfiles.jl) format.


## Usage

```
# read molecule using Chemfiles
using Chemfiles
trajectory = Trajectory("mol.sdf")
mol = read(trajectory)

# render molecule
viewer_id = render_molecule(mol)
viewer_id = render_molecule(mol, chemviewer_id=viewer_id)  # render another molecule in the same window

# change properties
d = generate_dict_molecule(mol)
d["atoms"][1]["color"] = "#f00000"
d["atoms"][1]["label"] = "Important atom"
d["atoms"][1]["radius"] = 1.0
viewer_id = render_dict_molecule(d, chemviewer_id=viewer_id)

# change view
set_camera_position("x", "-")
set_options(Dict("drawingType" => "wireframe"))
set_camera_position("c", "+")
set_options(Dict("drawingType" => "ball and stick"))

# save image
save_image("test.png")
```

Use mouse to rotate, zoom and pan. Keyboard shortcuts `x`, `y`, `z` set the view along the x, y and z axis.
Analogously, `a`, `b`, `c` set the view alonmg the unit cell vectors. Uppercase letters (`X`, `Y`, `Z`, `A`, `B`, `C`) set the opposite view direction.

A more detailed description can be found in the [Reference](@ref)